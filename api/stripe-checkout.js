// ── BotClínica — Stripe Checkout ─────────────────────────────────────────────
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter:      'price_1U0vvfD2SvjWdknTG8H0O1d8',
  profissional: 'price_1U0vw3D2SvjWdknTFpCEfzlv',
  clinica:      'price_1U0vwND2SvjWdknTABxXdeov',
  premium:      'price_1U0vwhD2SvjWdknToikbi9UW',
};
const ADDON_DOCUMENTOS_PRICE_ID = 'price_1UAQ0DD2SvjWdknTCuIN9qBA';

// ── PIX (pagamento único, adiantado) ───────────────────────────────────────
// Contas do Stripe no Brasil só aceitam Pix em pagamento ÚNICO (o Pix
// Automático/recorrente não existe aqui), então o Pix funciona como "pago
// por período": a clínica paga 1, 3 ou 12 meses de uma vez e renova quando
// vencer. Valores em REAIS por mês (iguais aos preços de assinatura do Stripe).
const PIX_PRECOS_MENSAIS = { starter: 397, profissional: 597, clinica: 997, premium: 1497 };
const PIX_ADDON_MENSAL = 97;
const PIX_MESES_VALIDOS = [1, 3, 12];
// Desconto (%) por período adiantado. Zero = preço cheio. Ex.: { 1: 0, 3: 5, 12: 10 }
const PIX_DESCONTO_PERCENT = { 1: 0, 3: 0, 12: 0 };
// O Stripe limita cada Pix a ~US$ 3.000. Usamos um teto conservador em reais
// (câmbio muda), então combinações muito grandes (ex.: Premium por 12 meses)
// são recusadas com uma mensagem clara em vez de falhar na tela do Stripe.
const PIX_LIMITE_REAIS = 15000;
const PIX_NOME_PLANO = { starter: 'Starter', profissional: 'Profissional', clinica: 'Clínica', premium: 'Premium' };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = require('stripe')(STRIPE_SECRET);

  // ── Buscar dados da sessão para login automático ─────────────────────────
  if (req.method === 'POST' && !req.headers['stripe-signature']) {
    const { action, sessionId, plano, email, clinicName, adminName, incluirAddon, metodo, meses } = req.body;

    if (action === 'getSession' && sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const { email, clinicName } = session.metadata || {};
        
        if (!email) return res.status(200).json({ error: 'Sessão inválida' });

        // NOVO: confirma o pagamento direto no Stripe (a sessão veio do próprio
        // Stripe, não do navegador) e libera o acesso AGORA — sem esperar o
        // webhook, que pode atrasar ou falhar. Se o webhook chegar depois, ele
        // reconhece que a sessão já foi processada e não repete nada.
        let pagamentoConfirmado = false;
        if (['paid', 'no_payment_required'].includes(session.payment_status)) {
          try {
            const r = await require('./stripe-webhook.js').confirmCheckoutSession(session);
            pagamentoConfirmado = !(r && (r.aguardando || r.ignorado));
          } catch (e) {
            console.error('Falha ao liberar o acesso no retorno do pagamento:', e.message);
          }
        }

        // Busca senha temporária do Firestore
        const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
        const FB_PROJECT = 'botclinica-60b6f';
        const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
        const key = email.toLowerCase().replace(/[@.]/g, '_');
        const r = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
        const d = await r.json();
        const senhaTemp = d.fields?.senhaTemp?.stringValue || '';
        const loginExistente = d.fields?.loginOrfao?.booleanValue === true;

        return res.status(200).json({ email, clinicName, senhaTemp, plano: d.fields?.plano?.stringValue || 'starter', pagamentoConfirmado,
          // Login que já existia: não há senha temporária; um e-mail de redefinição foi enviado.
          loginExistente,
          mensagem: loginExistente ? 'Pagamento confirmado! Esse e-mail já tinha um login, então enviamos um link para você criar a senha. Confira a caixa de entrada (e o spam).' : undefined });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // ── Criar sessão de checkout ────────────────────────────────────────────

    if (!plano || !email) return res.status(400).json({ error: 'Plano e email são obrigatórios' });
    const priceId = PRICE_IDS[plano.toLowerCase()];
    if (!priceId) return res.status(400).json({ error: 'Plano inválido' });

    // ── Pagamento por Pix (único, adiantado) ──────────────────────────────
    if (metodo === 'pix') {
      try {
        const chave = plano.toLowerCase();
        const nMeses = PIX_MESES_VALIDOS.includes(Number(meses)) ? Number(meses) : 1;
        const desconto = PIX_DESCONTO_PERCENT[nMeses] || 0;
        const textoPeriodo = nMeses === 1 ? '1 mês' : `${nMeses} meses`;
        // centavos = reais × meses × (100 − desconto%)
        const centavosPlano = Math.round(PIX_PRECOS_MENSAIS[chave] * nMeses * (100 - desconto));
        const centavosAddon = Math.round(PIX_ADDON_MENSAL * nMeses * (100 - desconto));

        const totalCentavos = centavosPlano + (incluirAddon ? centavosAddon : 0);
        if (totalCentavos > PIX_LIMITE_REAIS * 100) {
          return res.status(400).json({ error: 'Esse valor passa do limite de um único Pix. Escolha um período menor (ex.: 3 meses) ou pague no cartão.' });
        }

        await createPendingAccount({ email, plano, clinicName, adminName });

        const itens = [{
          price_data: {
            currency: 'brl',
            unit_amount: centavosPlano,
            product_data: { name: `BotClínica — Plano ${PIX_NOME_PLANO[chave]} (${textoPeriodo})` },
          },
          quantity: 1,
        }];
        if (incluirAddon) {
          itens.push({
            price_data: {
              currency: 'brl',
              unit_amount: centavosAddon,
              product_data: { name: `Add-on Documentos por IA (${textoPeriodo})` },
            },
            quantity: 1,
          });
        }
        const meta = {
          plano,
          email,
          clinicName: clinicName || '',
          adminName: adminName || '',
          addon: incluirAddon ? 'true' : 'false',
          metodo: 'pix',
          meses: String(nMeses),
        };
        const sessionPix = await stripe.checkout.sessions.create({
          mode: 'payment',
          // O Stripe não aceita mais "payment_method_types" (erro 400). O
          // substituto é "allowed_payment_method_types": esta sessão só pode
          // mostrar o Pix (o Painel continua mandando no resto).
          allowed_payment_method_types: ['pix'],
          line_items: itens,
          customer_email: email,
          metadata: meta,
          payment_intent_data: { metadata: meta },
          payment_method_options: { pix: { expires_after_seconds: 86400 } },
          success_url: `https://botclinica.com.br/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `https://botclinica.com.br/checkout?status=cancelled`,
          locale: 'pt-BR',
        });
        return res.status(200).json({ ok: true, url: sessionPix.url });
      } catch (e) {
        console.error('Stripe error (Pix):', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    try {
      // Prepara as credenciais de login (SEM ativar ainda — só o webhook
      // ativa de verdade, depois que o Stripe confirmar o pagamento).
      await createPendingAccount({ email, plano, clinicName, adminName });

      const lineItems = [{ price: priceId, quantity: 1 }];
      if (incluirAddon) lineItems.push({ price: ADDON_DOCUMENTOS_PRICE_ID, quantity: 1 });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        // Sem "payment_method_types" (não é mais aceito pelo Stripe). Assinatura
        // mensal é só no cartão: o Pix (pagamento único) fica de fora desta sessão.
        allowed_payment_method_types: ['card'],
        line_items: lineItems,
        customer_email: email,
        metadata: {
          plano,
          email,
          clinicName: clinicName || '',
          adminName: adminName || '',
          addon: incluirAddon ? 'true' : 'false',
        },
        success_url: `https://botclinica.com.br/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://botclinica.com.br/checkout?status=cancelled`,
        locale: 'pt-BR',
        subscription_data: {
          metadata: { plano, email, clinicName: clinicName || '', addon: incluirAddon ? 'true' : 'false' },
        },
        allow_promotion_codes: true,
      });

      return res.status(200).json({ ok: true, url: session.url });
    } catch (e) {
      console.error('Stripe error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// ── Ativa conta no Firebase ───────────────────────────────────────────────────
// BUGFIX CRÍTICO (05/08): essa função rodava ANTES do pagamento acontecer
// de verdade (só ao CRIAR a sessão do Stripe, antes até da pessoa ver a
// tela de cartão) e já marcava "ativo: true" — ou seja, qualquer um que
// simplesmente chegasse até essa etapa (sem nunca pagar nada) já ganhava
// acesso completo. Agora essa função só PREPARA as credenciais de login
// (pra funcionar o login automático quando a pessoa voltar do Stripe), mas
// deixa "ativo: false" — só o webhook (que só dispara com pagamento
// confirmado DE VERDADE pelo Stripe) é que liga o acesso de fato.
async function createPendingAccount({ email, plano, clinicName, adminName }) {
  const FB_PROJECT = 'botclinica-60b6f';
  const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
  const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
  const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;

  const emailToKey = (e) => e.toLowerCase().replace(/[@.]/g, '_');
  const key = emailToKey(email);

  const existingR = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
  const existingD = await existingR.json();
  const jaTemSenha = !!existingD.fields?.senhaTemp?.stringValue;

  // Só considera "já ativo de verdade" se AMBOS baterem: ativo=true e
  // statusPagamento=em_dia (ou seja, alguém que já é cliente pagante
  // de verdade). Nesse caso específico, não mexe em nada — é normal um
  // cliente já ativo clicar em "Assinar" de novo por engano/curiosidade,
  // e isso não pode desativar quem já está pagando certinho.
  const jaEstaAtivoDeVerdade =
    existingD.fields?.ativo?.booleanValue === true &&
    existingD.fields?.statusPagamento?.stringValue === 'em_dia';

  if (jaEstaAtivoDeVerdade) {
    return;
  }

  // NOVO: clínica em TESTE GRÁTIS que clica em "Assinar" não pode perder o
  // acesso enquanto o pagamento não sai (o fluxo abaixo marcaria a conta
  // como "ativo: false / aguardando_pagamento"). Mantém o teste como está e
  // atualiza só os dados da assinatura; quem liga o acesso pago de verdade
  // continua sendo o webhook, quando o Stripe confirmar o pagamento.
  if (existingD.fields?.statusPagamento?.stringValue === 'trial') {
    const keep = {
      plano: { stringValue: plano || existingD.fields?.plano?.stringValue || 'starter' },
    };
    if (clinicName) keep.clinicName = { stringValue: clinicName };
    if (adminName) keep.adminName = { stringValue: adminName };
    const keepMask = Object.keys(keep).map(f => `updateMask.fieldPaths=${f}`).join('&');
    await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}&${keepMask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: keep }),
    });
    return;
  }

  // BUGFIX (05/08 — 2ª rodada): a versão anterior desse código, quando a
  // conta já existia por QUALQUER motivo (teste antigo, tentativa anterior,
  // etc), simplesmente não fazia nada — deixando o "ativo" antigo intacto,
  // mesmo que fosse true de antes. Isso permitiu uma conta continuar
  // "ativa" mesmo começando um checkout novo sem pagar. Agora, toda vez
  // que uma sessão de checkout é criada (exceto pra quem já é cliente
  // pagante de verdade, tratado acima), marcamos explicitamente como
  // não-ativo/aguardando pagamento — não importa o estado anterior. Só o
  // webhook (pagamento confirmado de verdade) liga o acesso de novo.
  let senhaTemp = existingD.fields?.senhaTemp?.stringValue;

  // Contas criadas à mão pelo CRM guardam a senha em "senha" (não em "senhaTemp"):
  // é uma senha CONHECIDA, então o login automático depois do pagamento funciona.
  const senhaLegada = existingD.fields?.senha?.stringValue || '';
  let loginOrfao = false;

  if (!jaTemSenha && senhaLegada) {
    senhaTemp = senhaLegada;
  } else if (!jaTemSenha) {
    senhaTemp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
    try {
      const sr = await fetch(`${AUTH_URL}:signUp?key=${FB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senhaTemp, returnSecureToken: true }),
      });
      const sd = await sr.json();
      // Já existe um LOGIN com esse e-mail (ex.: cliente apagado do CRM, mas o login
      // ficou). Não sabemos a senha dele, então NÃO guardamos uma senha inventada
      // (ela nunca bateria): marcamos o login como "órfão" e, depois do pagamento
      // confirmado, mandamos um e-mail para a pessoa criar a senha.
      if (sd.error && /EMAIL_EXISTS/.test(sd.error.message || '')) {
        loginOrfao = true;
        senhaTemp = '';
      }
    } catch (e) {
      console.log('Falha ao criar o login no Auth, continuando...');
    }
  }

  const fieldsToWrite = {
    email: { stringValue: email },
    plano: { stringValue: plano || 'starter' },
    clinicName: { stringValue: clinicName || '' },
    adminName: { stringValue: adminName || '' },
    senhaTemp: { stringValue: senhaTemp || '' },
    firstAccess: { booleanValue: loginOrfao ? false : (existingD.fields?.firstAccess?.booleanValue ?? true) },
    loginOrfao: { booleanValue: loginOrfao },
    ativo: { booleanValue: false },
    statusPagamento: { stringValue: 'aguardando_pagamento' },
    createdAt: { stringValue: existingD.fields?.createdAt?.stringValue || new Date().toISOString() },
  };
  // BUGFIX (26/09): sem updateMask, essa escrita apagava qualquer outro
  // campo já existente na conta (ex: phoneNumberId de uma conexão via
  // Embedded Signup, documentsAddonActive, etc.) sempre que alguém fazia
  // um novo checkout numa conta que já existia.
  const maskParams = Object.keys(fieldsToWrite).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${FS}/acessos_autorizados/${key}?key=${FB_KEY}&${maskParams}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fieldsToWrite }),
  });
}

