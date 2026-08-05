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
        const { email, plano, clinicName, adminName } = session.metadata || {};

        if (email) {
          await activateAccount({ email, plano, clinicName, adminName });
          console.log(`✅ Conta ativada: ${email} — Plano: ${plano}`);
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

// ── Ativa conta no Firebase (mesma lógica usada no checkout) ─────────────────
async function activateAccount({ email, plano, clinicName, adminName }) {
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
        statusPagamento: { stringValue: 'em_dia' },
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
