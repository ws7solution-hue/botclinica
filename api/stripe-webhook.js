// ── BotClínica — Stripe Webhook ──────────────────────────────────────────────
// Endpoint dedicado SÓ para receber eventos do Stripe.
// Precisa do corpo bruto (raw) da requisição para validar a assinatura,
// por isso o bodyParser automático do Vercel é desativado abaixo (config).

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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
        const { email, plano, clinicName, adminName } = session.metadata || {};

        if (email) {
          await activateAccount({ email, plano, clinicName, adminName });
          console.log(`✅ Conta ativada: ${email} — Plano: ${plano}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Cobre trocas de plano feitas via portal do Stripe ou proration
        const sub = event.data.object;
        const { email, plano } = sub.metadata || {};
        if (email && plano) {
          await updatePlano({ email, plano });
          console.log(`🔄 Plano atualizado: ${email} — Novo plano: ${plano}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`⚠️ Falha de pagamento: ${invoice.customer_email || invoice.customer}`);
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

// ── Ativa conta no Firebase (mesma lógica usada no checkout) ─────────────────
async function activateAccount({ email, plano, clinicName, adminName }) {
  const FB_PROJECT = 'botclinica-60b6f';
  const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
  const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
  const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;

  const emailToKey = (e) => e.toLowerCase().replace(/[@.]/g, '_');

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
  const FB_PROJECT = 'botclinica-60b6f';
  const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
  const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

  const emailToKey = (e) => e.toLowerCase().replace(/[@.]/g, '_');
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

// ── Helper para ler o corpo bruto da requisição ──────────────────────────────
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
