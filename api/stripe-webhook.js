// ── BotClínica — Stripe Webhook ──────────────────────────────────────────────
// Endpoint dedicado SÓ para receber eventos do Stripe.
// Precisa do corpo bruto (raw) da requisição para validar a assinatura,
// por isso o bodyParser automático do Vercel é desativado abaixo (config).
//
// BUGFIX CRÍTICO (05/08): antes, cancelamento de assinatura e falha de
// pagamento não faziam NADA de verdade — a conta continuava ativa pra
// sempre, mesmo sem pagar. Agora:
//   - customer.subscription.deleted  → desativa a conta de vez (ativo:false)
//   - invoice.payment_failed         → marca "atrasado" (fica dentro do
//     período de tentativas automáticas do próprio Stripe — normalmente
//     alguns dias/semanas, configurável no Stripe — sem cortar acesso ainda)
//   - invoice.payment_succeeded      → volta pra "em dia", atualiza a data
//     da próxima cobrança de verdade (vinda do Stripe, não mais digitada)
//   - customer.subscription.updated  → também sincroniza status/data agora
//
// PIX (pagamento único, adiantado):
//   - checkout.session.completed / async_payment_succeeded (mode=payment,
//     metadata.metodo=pix) → só libera se payment_status = 'paid'; grava
//     pixPagoAte (soma os meses ao vencimento atual) e evita somar 2x.

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
// .trim() e sem aspas: um espaço ou quebra de linha colados junto com a chave na
// Vercel são a causa mais comum de "No signatures found matching...".
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim().replace(/^["']|["']$/g, '');

const FB_PROJECT = 'botclinica-60b6f';
const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const emailToKey = (e) => (e || '').toLowerCase().replace(/[@.]/g, '_');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = require('stripe')(STRIPE_SECRET);

  let event;
  let rawBody = '';
  try {
    rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    // "diag" ajuda a achar a causa olhando só a resposta no painel do Stripe.
    // Não revela a chave: só diz se existe, se tem o formato certo e se o
    // corpo chegou. (Pode ser removido depois que o webhook estiver estável.)
    const diag = {
      secretDefinido: !!STRIPE_WEBHOOK_SECRET,
      secretComecaComWhsec: STRIPE_WEBHOOK_SECRET.startsWith('whsec_'),
      temAssinaturaNoPedido: !!req.headers['stripe-signature'],
      tamanhoDoCorpo: typeof rawBody === 'string' ? rawBody.length : 0,
    };
    console.error('Webhook signature error:', e.message, JSON.stringify(diag));
    return res.status(400).json({ error: `Webhook error: ${e.message}`, diag });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // Toda a lógica fica em confirmCheckoutSession, que também é usada
        // pelo retorno do pagamento (getSession) — assim o acesso é liberado
        // mesmo se este webhook demorar ou falhar, sem duplicar nada.
        // O aviso "pagamento assíncrono confirmado" só existe para o Pix; para
        // qualquer outra forma de pagamento ele é ignorado (como sempre foi).
        if (event.type === 'checkout.session.async_payment_succeeded'
            && !(event.data.object.mode === 'payment' && event.data.object.metadata?.metodo === 'pix')) break;
        const r = await confirmCheckoutSession(event.data.object);
        if (r && r.aguardando) console.log(`⏳ Pagamento ainda não confirmado (sessão ${event.data.object.id})`);
        if (r && r.duplicado) console.log(`ℹ️ Pagamento já processado (sessão ${event.data.object.id}) — ignorado`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const { email, metodo } = session.metadata || {};
        console.log(`❌ Pagamento assíncrono falhou (${metodo || 'sem método'}): ${email || session.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        // Cobre trocas de plano feitas via portal do Stripe ou proration,
        // e também sincroniza status de pagamento + próxima cobrança.
        const sub = event.data.object;
        const { email, plano } = sub.metadata || {};
        if (email && plano) {
          await updatePlano({ email, plano });
          console.log(`🔄 Plano atualizado: ${email} — Novo plano: ${plano}`);
        }
        if (email) {
          const proximaCobranca = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;

          if (sub.status === 'active' || sub.status === 'trialing') {
            await setStatusPagamento({ email, statusPagamento: 'em_dia', proximaCobranca, ativo: true });
          } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
            await setStatusPagamento({ email, statusPagamento: 'atrasado', proximaCobranca });
          } else if (sub.status === 'canceled') {
            await deactivateAccount(email);
            console.log(`🚫 Assinatura cancelada (status=canceled): ${email}`);
          }
        }
        break;
      }

      // NOVO: quando a assinatura é cancelada de vez (seja pelo cliente, por
      // você, ou pelo Stripe desistir depois de tentar cobrar várias vezes),
      // a conta é desativada de verdade — sem isso, o cliente tinha acesso
      // pra sempre, mesmo cancelando.
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { email } = sub.metadata || {};
        if (email) {
          await deactivateAccount(email);
          await cancelCommissionIfPending(email);
          console.log(`🚫 Conta desativada (assinatura cancelada): ${email}`);
        }
        break;
      }

      // NOVO: marca "atrasado" — não corta o acesso ainda (o Stripe já
      // tenta cobrar de novo automaticamente por um tempo, isso funciona
      // como o período de tolerância natural antes do corte de vez).
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        if (email) {
          await setStatusPagamento({ email, statusPagamento: 'atrasado' });
          console.log(`⚠️ Pagamento atrasado: ${email}`);
        }
        break;
      }

      // NOVO: quando o pagamento (inclusive uma nova tentativa depois de
      // falhar) é confirmado, volta pra "em dia" e atualiza a data real da
      // próxima cobrança.
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        if (email) {
          const proximaCobranca = invoice.period_end
            ? new Date(invoice.period_end * 1000).toISOString()
            : null;
          await setStatusPagamento({ email, statusPagamento: 'em_dia', proximaCobranca, ativo: true });
          console.log(`✅ Pagamento confirmado, conta em dia: ${email}`);
        }
        break;
      }

      default:
        // Evento não tratado — apenas confirma recebimento
        break;
    }
  } catch (e) {
    console.error('Erro ao processar evento do webhook:', e.message);
    // Mesmo com erro no processamento, respondemos 200 para o Stripe não
    // ficar retentando um evento que já foi recebido corretamente.
  }

  return res.status(200).json({ received: true });
};

// Desativa o bodyParser automático do Vercel — precisamos do corpo BRUTO
// para validar a assinatura do webhook (stripe.webhooks.constructEvent).
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// Exportados para o stripe-checkout.js liberar o acesso no retorno do pagamento.
module.exports.confirmCheckoutSession = (...args) => confirmCheckoutSession(...args);

// ── Ativa conta no Firebase (a conta já foi PREPARADA — sem estar ativa —
// no momento em que a pessoa criou a sessão de checkout. Aqui só ligamos
// o "ativo" de vez, sem mexer na senha já gerada, senão quebraríamos o
// login automático de quem acabou de pagar). ─────────────────────────────
async function activateAccount({ email, plano, clinicName, adminName, addon }) {
  const key = emailToKey(email);

  // Confere se a conta já foi preparada antes (fluxo normal, via checkout)
  const existingR = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
  const existingD = await existingR.json();

  // Conta preparada = tem senha temporária (valor não vazio) OU foi marcada como
  // "login órfão" (o login já existia no Firebase e não sabemos a senha dele).
  const loginOrfaoPendente = existingD.fields?.loginOrfao?.booleanValue === true;
  if (existingD.fields?.senhaTemp?.stringValue || loginOrfaoPendente) {
    // Conta já existe com senha já criada — só liga o "ativo", sem tocar
    // em mais nada (preserva a senha real do Firebase Auth).
    const maskFields = ['ativo', 'statusPagamento', 'plano', 'pagamentoMetodo'];
    const fields = {
      ativo: { booleanValue: true },
      statusPagamento: { stringValue: 'em_dia' },
      plano: { stringValue: plano || existingD.fields?.plano?.stringValue || 'starter' },
      // Assinatura no cartão: o vencimento vem do Stripe, não de uma data de Pix.
      pagamentoMetodo: { stringValue: 'cartao' },
    };
    // NOVO: se o checkout incluiu o add-on de Documentos, já liga ele
    // também — sem isso, quem pagou pelo add-on no ato da assinatura
    // continuaria vendo a tela de bloqueio, mesmo já tendo pago por ele.
    if (addon) {
      fields.documentsAddonActive = { booleanValue: true };
      maskFields.push('documentsAddonActive');
    }
    const url = `${FS}/acessos_autorizados/${key}?${maskFields.map(f => `updateMask.fieldPaths=${f}`).join('&')}&key=${FB_KEY}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (loginOrfaoPendente) await enviarRedefinicaoDeSenha(email, key, existingD.fields?.resetEnviadoEm?.stringValue);
    return;
  }

  // Caso raro (webhook chegando antes do checkout preparar a conta, ou
  // pagamento feito por outro caminho) — cria do zero, com senha nova.
  const senhaTemp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';

  let idToken = '';
  let loginOrfaoNovo = false;
  try {
    const r = await fetch(`${AUTH_URL}:signUp?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senhaTemp, returnSecureToken: true }),
    });
    const d = await r.json();
    idToken = d.idToken || '';
    // O login já existia (conta apagada no CRM, login ficou): não sabemos a senha.
    if (d.error && /EMAIL_EXISTS/.test(d.error.message || '')) loginOrfaoNovo = true;
  } catch (e) {
    console.log('Usuário já existe, continuando...');
  }

  const url = `${FS}/acessos_autorizados/${key}?key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        email: { stringValue: email },
        plano: { stringValue: plano || 'starter' },
        clinicName: { stringValue: clinicName || '' },
        adminName: { stringValue: adminName || '' },
        senhaTemp: { stringValue: loginOrfaoNovo ? '' : senhaTemp },
        firstAccess: { booleanValue: !loginOrfaoNovo },
        loginOrfao: { booleanValue: loginOrfaoNovo },
        ativo: { booleanValue: true },
        statusPagamento: { stringValue: 'em_dia' },
        createdAt: { stringValue: new Date().toISOString() },
        documentsAddonActive: { booleanValue: !!addon },
      }
    }),
  });

  if (loginOrfaoNovo) await enviarRedefinicaoDeSenha(email, key, '');

  if (idToken) {
    await fetch(`${AUTH_URL}:sendOobCode?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
    });
  }
}

// ── Manda o e-mail "criar nova senha" para quem pagou e já tinha um login ──
// Só roda DEPOIS do pagamento confirmado (nunca no clique em "Assinar", para
// ninguém usar o checkout como disparador de e-mails para terceiros). Não repete
// se já foi enviado há menos de 30 minutos (webhook e retorno do pagamento
// podem chegar quase juntos).
async function enviarRedefinicaoDeSenha(email, key, enviadoEm) {
  try {
    if (enviadoEm && Date.now() - new Date(enviadoEm).getTime() < 30 * 60 * 1000) return;
    const r = await fetch(`${AUTH_URL}:sendOobCode?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    const d = await r.json();
    if (d.error) { console.error('❌ Não consegui enviar o e-mail de redefinição:', d.error.message); return; }
    await fetch(`${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=resetEnviadoEm&key=${FB_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { resetEnviadoEm: { stringValue: new Date().toISOString() } } }),
    });
    console.log(`📧 E-mail de redefinição de senha enviado para ${email} (login já existia).`);
  } catch (e) {
    console.error('❌ Falha ao enviar o e-mail de redefinição:', e.message);
  }
}

// ── Confirma um checkout PAGO e libera o acesso ─────────────────────────────
// Usada em DOIS lugares: pelo webhook do Stripe e pelo retorno do pagamento
// (getSession em stripe-checkout.js). Quem chegar primeiro libera; o outro
// reconhece que a mesma sessão já foi processada e não repete (nem soma
// meses de Pix duas vezes, nem avisa o dono duas vezes).
async function confirmCheckoutSession(session) {
  const { email, plano, clinicName, adminName, addon, metodo, meses } = session.metadata || {};
  if (!email) return { ignorado: true };

  // PIX (pagamento único, adiantado): só libera com o dinheiro confirmado.
  if (session.mode === 'payment' && metodo === 'pix') {
    if (session.payment_status !== 'paid') return { aguardando: true };
    return activatePixPayment({
      email, plano, clinicName, adminName,
      addon: addon === 'true',
      meses: Number(meses) || 1,
      sessionId: session.id,
      amountTotal: session.amount_total,
    });
  }

  // CARTÃO (assinatura mensal)
  if (session.mode === 'subscription') {
    if (!['paid', 'no_payment_required'].includes(session.payment_status)) return { aguardando: true };
    const key = emailToKey(email);
    const atual = await (await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`)).json();
    if (session.id && atual.fields?.cartaoUltimaSessao?.stringValue === session.id) return { duplicado: true };

    await activateAccount({ email, plano, clinicName, adminName, addon: addon === 'true' });
    if (session.id) {
      await fetch(`${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=cartaoUltimaSessao&key=${FB_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { cartaoUltimaSessao: { stringValue: session.id } } }),
      });
    }
    console.log(`✅ Conta ativada: ${email} — Plano: ${plano}${addon === 'true' ? ' + Add-on Documentos' : ''}`);

    // Avisa o dono na hora que uma venda nova acontece, pra ele conseguir
    // marcar uma reunião de boas-vindas ou ligar pra clínica.
    const valorPago = session.amount_total ? (session.amount_total / 100).toFixed(2) : '?';
    notifyOwner(
      '🎉 Nova venda confirmada!',
      `${clinicName || email} acabou de assinar o plano ${plano || 'desconhecido'} (R$ ${valorPago}). Contato: ${adminName || ''} — ${email}. Já pode marcar uma reunião de boas-vindas ou ligar pra ela.`,
      'https://botclinica.com.br/crm'
    ).catch(() => {});
    return { ok: true };
  }
  return { ignorado: true };
}

// ── PIX: libera ou RENOVA o acesso por N meses ──────────────────────────────
// O Pix não renova sozinho, então gravamos até quando a clínica pagou
// (pixPagoAte). Se ela renova antes de vencer, os meses novos são SOMADOS ao
// vencimento atual (ninguém perde dias). A sessão do Stripe fica gravada para
// o mesmo pagamento não ser somado duas vezes (o Stripe pode mandar o aviso
// de "concluído" e o de "pagamento confirmado" para a mesma compra).
const PIX_TOLERANCIA_DIAS = 3; // (o corte de acesso acontece no login e na VPS)

function somarMeses(dataBase, meses) {
  const d = new Date(dataBase);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // 31/01 + 1 mês cairia em 03/03; volta para o último dia do mês certo
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

async function activatePixPayment({ email, plano, clinicName, adminName, addon, meses, sessionId, amountTotal }) {
  const key = emailToKey(email);
  const r = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
  const atual = await r.json();
  const f = atual.fields || {};

  if (sessionId && f.pixUltimaSessao?.stringValue === sessionId) return { duplicado: true };

  const eraPixAtivo = !!f.pixPagoAte?.stringValue;
  await activateAccount({ email, plano, clinicName, adminName, addon });

  const base = Math.max(Date.now(), new Date(f.pixPagoAte?.stringValue || 0).getTime());
  const novoVencimento = somarMeses(base, meses).toISOString();

  const campos = {
    pagamentoMetodo: { stringValue: 'pix' },
    pixPagoAte: { stringValue: novoVencimento },
    proximaCobranca: { stringValue: novoVencimento },
    pixUltimaSessao: { stringValue: sessionId || '' },
    ativo: { booleanValue: true },
    statusPagamento: { stringValue: 'em_dia' },
  };
  const mask = Object.keys(campos).map(c => `updateMask.fieldPaths=${c}`).join('&');
  await fetch(`${FS}/acessos_autorizados/${key}?${mask}&key=${FB_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: campos }),
  });

  const valor = amountTotal ? (amountTotal / 100).toFixed(2) : '?';
  const ate = new Date(novoVencimento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log(`✅ Pix confirmado: ${email} — ${meses} mês(es), acesso até ${ate}`);
  notifyOwner(
    eraPixAtivo ? '🔁 Pix renovado' : '🎉 Nova venda confirmada (Pix)!',
    `${clinicName || f.clinicName?.stringValue || email} pagou R$ ${valor} por Pix (${meses} mês(es), plano ${plano || f.plano?.stringValue || '?'}). Acesso até ${ate}. ${email}`,
    'https://botclinica.com.br/crm'
  ).catch(() => {});
  return { ok: true, vencimento: novoVencimento };
}

// ── Atualiza só o campo "plano" de uma conta já existente ────────────────────
async function updatePlano({ email, plano }) {
  const key = emailToKey(email);
  const url = `${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=plano&key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        plano: { stringValue: plano },
      }
    }),
  });
}

// ── NOVO: desativa a conta de vez (cancelamento real ou falha definitiva) ────
async function deactivateAccount(email) {
  const key = emailToKey(email);
  const url = `${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=ativo&updateMask.fieldPaths=statusPagamento&updateMask.fieldPaths=desativadoEm&key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        ativo: { booleanValue: false },
        statusPagamento: { stringValue: 'cancelado' },
        desativadoEm: { stringValue: new Date().toISOString() },
      }
    }),
  });
}

// ── Cancela a comissão do parceiro se o cliente indicado por ele cancelar
// a assinatura ANTES da comissão já ter sido paga — e avisa o parceiro por
// WhatsApp, pra ele nunca ficar sem saber o motivo da mudança de status.
// BUGFIX: antes, essa checagem assumia um ID de documento fixo baseado no
// e-mail — mas a comissão de verdade (criada quando você confirma uma
// venda no CRM) usa um ID diferente (baseado no ID do lead). Por isso,
// agora busca em TODAS as comissões procurando qual tem esse e-mail no
// campo "clinicEmail", em vez de tentar adivinhar o ID do documento.
async function cancelCommissionIfPending(email) {
  try {
    const r = await fetch(`${FS}/commissions?key=${FB_KEY}&pageSize=300`);
    const d = await r.json();
    const docs = d.documents || [];
    const emailLower = (email || '').toLowerCase();

    for (const doc of docs) {
      const f = doc.fields || {};
      const docEmail = (f.clinicEmail?.stringValue || '').toLowerCase();
      if (docEmail !== emailLower) continue;

      const currentStatus = f.status?.stringValue;
      if (currentStatus === 'pago') continue; // já foi paga — não mexe retroativamente

      const commissionId = doc.name.split('/').pop();
      await fetch(`${FS}/commissions/${commissionId}?updateMask.fieldPaths=status&key=${FB_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: { stringValue: 'cancelado' } } }),
      });
      console.log(`🚫 Comissão cancelada (cliente cancelou/estornou antes de pagar): ${email}`);

      // Avisa o parceiro — ele merece saber que essa comissão específica
      // não vai mais ser paga, e por qual motivo.
      try {
        const partnerId = f.partnerId?.stringValue;
        if (partnerId) {
          const partnerRes = await fetch(`${FS}/partners/${partnerId}?key=${FB_KEY}`);
          const partnerData = await partnerRes.json();
          const partnerPhone = partnerData.fields?.phone?.stringValue;
          const partnerName = partnerData.fields?.name?.stringValue || '';
          const clinicName = f.clinicName?.stringValue || email;
          if (partnerPhone) {
            await fetch('https://whatsapp.botclinica.com.br/notify-partner', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: partnerPhone,
                message: `Oi, ${partnerName}. Preciso te avisar: a comissão da venda de "${clinicName}" foi cancelada, porque o cliente cancelou ou pediu estorno da assinatura antes do pagamento ser liberado. Isso pode acontecer às vezes — continue mandando leads, combinado? 🙏`,
              }),
            });
          }
        }
      } catch (e) {
        console.error('❌ Falha ao notificar parceiro sobre cancelamento de comissão:', e.message);
      }
    }
  } catch (e) {
    console.error('❌ Falha ao verificar/cancelar comissão pendente:', e.message);
  }
}

// ── NOVO: sincroniza status de pagamento + data da próxima cobrança real ─────
async function setStatusPagamento({ email, statusPagamento, proximaCobranca, ativo }) {
  const key = emailToKey(email);
  const fields = {
    statusPagamento: { stringValue: statusPagamento },
  };
  const maskFields = ['statusPagamento'];

  if (proximaCobranca) {
    fields.proximaCobranca = { stringValue: proximaCobranca };
    maskFields.push('proximaCobranca');
  }
  if (typeof ativo === 'boolean') {
    fields.ativo = { booleanValue: ativo };
    maskFields.push('ativo');
  }

  const maskQuery = maskFields.map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${FS}/acessos_autorizados/${key}?${maskQuery}&key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
}

// ── Avisa o dono (push + WhatsApp), reaproveitando o endpoint que já existe
// na VPS pra isso — mesmo mecanismo usado pros outros alertas do sistema.
async function notifyOwner(title, body, url) {
  try {
    await fetch('https://whatsapp.botclinica.com.br/notify-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url }),
    });
  } catch (e) {
    console.error('❌ Falha ao notificar o dono sobre a venda:', e.message);
  }
}

// ── Helper para ler o corpo bruto da requisição ──────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
