// ── BotClínica — Stripe Checkout ─────────────────────────────────────────────
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter:      'price_1U0vvfD2SvjWdknTG8H0O1d8',
  profissional: 'price_1U0vw3D2SvjWdknTFpCEfzlv',
  clinica:      'price_1U0vwND2SvjWdknTABxXdeov',
  premium:      'price_1U0vwhD2SvjWdknToikbi9UW',
};
const ADDON_DOCUMENTOS_PRICE_ID = 'price_1UAQ0DD2SvjWdknTCuIN9qBA';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = require('stripe')(STRIPE_SECRET);

  // ── Buscar dados da sessão para login automático ─────────────────────────
  if (req.method === 'POST' && !req.headers['stripe-signature']) {
    const { action, sessionId, plano, email, clinicName, adminName, incluirAddon } = req.body;

    if (action === 'getSession' && sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const { email, clinicName } = session.metadata || {};
        
        if (!email) return res.status(200).json({ error: 'Sessão inválida' });

        // Busca senha temporária do Firestore
        const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
        const FB_PROJECT = 'botclinica-60b6f';
        const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
        const key = email.toLowerCase().replace(/[@.]/g, '_');
        const r = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
        const d = await r.json();
        const senhaTemp = d.fields?.senhaTemp?.stringValue || '';

        return res.status(200).json({ email, clinicName, senhaTemp, plano: d.fields?.plano?.stringValue || 'starter' });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // ── Criar sessão de checkout ────────────────────────────────────────────

    if (!plano || !email) return res.status(400).json({ error: 'Plano e email são obrigatórios' });
    const priceId = PRICE_IDS[plano.toLowerCase()];
    if (!priceId) return res.status(400).json({ error: 'Plano inválido' });

    try {
      // Prepara as credenciais de login (SEM ativar ainda — só o webhook
      // ativa de verdade, depois que o Stripe confirmar o pagamento).
      await createPendingAccount({ email, plano, clinicName, adminName });

      const lineItems = [{ price: priceId, quantity: 1 }];
      if (incluirAddon) lineItems.push({ price: ADDON_DOCUMENTOS_PRICE_ID, quantity: 1 });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
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

  if (!jaTemSenha) {
    senhaTemp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
    try {
      await fetch(`${AUTH_URL}:signUp?key=${FB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senhaTemp, returnSecureToken: true }),
      });
    } catch (e) {
      console.log('Usuário já existe no Auth, continuando...');
    }
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
        senhaTemp: { stringValue: senhaTemp || '' },
        firstAccess: { booleanValue: existingD.fields?.firstAccess?.booleanValue ?? true },
        ativo: { booleanValue: false },
        statusPagamento: { stringValue: 'aguardando_pagamento' },
        createdAt: { stringValue: existingD.fields?.createdAt?.stringValue || new Date().toISOString() },
      }
    }),
  });
}

