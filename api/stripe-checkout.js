// ── BotClínica — Stripe Checkout ─────────────────────────────────────────────
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const PRICE_IDS = {
  starter:      'price_1Tq1FORiC3IX8iaz00PLfzrQ',
  profissional: 'price_1Tq1H9RiC3IX8iazJxHhJLZQ',
  clinica:      'price_1Tq1HoRiC3IX8iaz9lROVOzf',
  premium:      'price_1Tq1IORiC3IX8iazV16NV0IC',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripe = require('stripe')(STRIPE_SECRET);

  // ── Criar sessão de checkout ──────────────────────────────────────────────
  if (req.method === 'POST' && !req.headers['stripe-signature']) {
    const { plano, email, clinicName, adminName } = req.body;

    if (!plano || !email) {
      return res.status(400).json({ error: 'Plano e email são obrigatórios' });
    }

    const priceId = PRICE_IDS[plano.toLowerCase()];
    if (!priceId) {
      return res.status(400).json({ error: 'Plano inválido' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email,
        metadata: {
          plano,
          email,
          clinicName: clinicName || '',
          adminName: adminName || '',
        },
        success_url: `https://botclinica.com.br/app?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://botclinica.com.br/checkout?status=cancelled`,
        locale: 'pt-BR',
        subscription_data: {
          metadata: { plano, email, clinicName: clinicName || '' },
        },
        allow_promotion_codes: true,
      });

      return res.status(200).json({ ok: true, url: session.url });
    } catch (e) {
      console.error('Stripe error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Webhook Stripe ────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.headers['stripe-signature']) {
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { email, plano, clinicName, adminName } = session.metadata;

      if (email) {
        try {
          await activateAccount({ email, plano, clinicName, adminName });
          console.log(`✅ Conta ativada: ${email} — Plano: ${plano}`);
        } catch (e) {
          console.error('Erro ao ativar conta:', e.message);
        }
      }
    }

    return res.status(200).json({ received: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// ── Ativa conta no Firebase ───────────────────────────────────────────────────
async function activateAccount({ email, plano, clinicName, adminName }) {
  const FB_PROJECT = 'botclinica-60b6f';
  const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
  const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
  const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;

  const emailToKey = (e) => e.toLowerCase().replace(/[@.]/g, '_');

  // Gera senha temporária
  const senhaTemp = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';

  // Cria usuário no Firebase Auth
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

  // Salva no Firestore
  const key = emailToKey(email);
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
        createdAt: { stringValue: new Date().toISOString() },
      }
    }),
  });

  // Envia email de boas-vindas com senha temporária
  if (idToken) {
    await fetch(`${AUTH_URL}:sendOobCode?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
    });
  }
}

// ── Helper para raw body (webhook) ───────────────────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
