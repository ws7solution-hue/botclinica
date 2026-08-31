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

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('Webhook signature error:', e.message);
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { email, plano, clinicName, adminName, addon } = session.metadata || {};

        if (email) {
          await activateAccount({ email, plano, clinicName, adminName, addon: addon === 'true' });
          console.log(`✅ Conta ativada: ${email} — Plano: ${plano}${addon === 'true' ? ' + Add-on Documentos' : ''}`);
        }
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

// ── Ativa conta no Firebase (a conta já foi PREPARADA — sem estar ativa —
// no momento em que a pessoa criou a sessão de checkout. Aqui só ligamos
// o "ativo" de vez, sem mexer na senha já gerada, senão quebraríamos o
// login automático de quem acabou de pagar). ─────────────────────────────
async function activateAccount({ email, plano, clinicName, adminName, addon }) {
  const key = emailToKey(email);

  // Confere se a conta já foi preparada antes (fluxo normal, via checkout)
  const existingR = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
  const existingD = await existingR.json();

  if (existingD.fields?.senhaTemp) {
    // Conta já existe com senha já criada — só liga o "ativo", sem tocar
    // em mais nada (preserva a senha real do Firebase Auth).
    const maskFields = ['ativo', 'statusPagamento', 'plano'];
    const fields = {
      ativo: { booleanValue: true },
      statusPagamento: { stringValue: 'em_dia' },
      plano: { stringValue: plano || existingD.fields?.plano?.stringValue || 'starter' },
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
    return;
  }

  // Caso raro (webhook chegando antes do checkout preparar a conta, ou
  // pagamento feito por outro caminho) — cria do zero, com senha nova.
  const senhaTemp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';

  let idToken = '';
  try {
    const r = await fetch(`${AUTH_URL}:signUp?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senhaTemp, returnSecureToken: true }),
    });
    const d = await r.json();
    idToken = d.idToken || '';
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
        senhaTemp: { stringValue: senhaTemp },
        firstAccess: { booleanValue: true },
        ativo: { booleanValue: true },
        statusPagamento: { stringValue: 'em_dia' },
        createdAt: { stringValue: new Date().toISOString() },
        documentsAddonActive: { booleanValue: !!addon },
      }
    }),
  });

  if (idToken) {
    await fetch(`${AUTH_URL}:sendOobCode?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
    });
  }
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

// ── Helper para ler o corpo bruto da requisição ──────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
