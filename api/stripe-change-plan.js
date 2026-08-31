// ── BotClínica — Troca de Plano / Add-on (assinatura já ativa) ──────────────
// Dois recursos nesse mesmo arquivo, de propósito — o plano Hobby da Vercel
// limita a 12 funções serverless, e separar isso em 2 arquivos estourava
// esse limite. Como os dois mexem em "assinatura Stripe já ativa", faz
// sentido técnico juntar mesmo, não é só economia de função:
//   - action ausente (ou "changePlan"): troca de plano com proration
//   - action "addAddon": adiciona o add-on de Documentos à assinatura

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter:      'price_1U0vvfD2SvjWdknTG8H0O1d8',
  profissional: 'price_1U0vw3D2SvjWdknTFpCEfzlv',
  clinica:      'price_1U0vwND2SvjWdknTABxXdeov',
  premium:      'price_1U0vwhD2SvjWdknToikbi9UW',
};
const ADDON_DOCUMENTOS_PRICE_ID = 'price_1UAQ0DD2SvjWdknTCuIN9qBA';

const FB_PROJECT = 'botclinica-60b6f';
const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
const FS = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
const emailToKey = (e) => (e || '').toLowerCase().replace(/[@.]/g, '_');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body || {};

  if (action === 'addAddon') {
    return handleAddAddon(req, res);
  }
  return handleChangePlan(req, res);
};

// ── Troca de plano com proration (comportamento original, sem mudança) ──────
async function handleChangePlan(req, res) {
  const { email, novoPlano } = req.body || {};

  if (!email || !novoPlano) {
    return res.status(400).json({ error: 'email e novoPlano são obrigatórios' });
  }

  const novoPriceId = PRICE_IDS[novoPlano.toLowerCase()];
  if (!novoPriceId) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  const stripe = require('stripe')(STRIPE_SECRET);

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado no Stripe' });
    }

    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });
    const subscription = subs.data[0];

    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura ativa não encontrada' });
    }

    const currentItem = subscription.items.data[0];
    const planoAtualPriceId = currentItem.price.id;

    if (planoAtualPriceId === novoPriceId) {
      return res.status(200).json({ ok: true, message: 'Cliente já está nesse plano', semAlteracao: true });
    }

    const upcomingInvoice = await stripe.invoices.createPreview({
      customer: customer.id,
      subscription: subscription.id,
      subscription_details: {
        items: [{ id: currentItem.id, price: novoPriceId }],
        proration_behavior: 'create_prorations',
      },
    });

    const valorProrationCentavos = upcomingInvoice.lines.data
      .filter(line => {
        const parent = line.parent || {};
        return (
          parent.subscription_item_details?.proration === true ||
          parent.invoice_item_details?.proration === true
        );
      })
      .reduce((total, line) => total + line.amount, 0);

    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: currentItem.id, price: novoPriceId }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        plano: novoPlano.toLowerCase(),
        email,
      },
    });

    await updatePlanoFirestore({ email, plano: novoPlano.toLowerCase() });

    return res.status(200).json({
      ok: true,
      planoAnterior: Object.keys(PRICE_IDS).find(k => PRICE_IDS[k] === planoAtualPriceId) || null,
      novoPlano: novoPlano.toLowerCase(),
      valorProrationReais: (valorProrationCentavos / 100).toFixed(2),
      subscriptionId: updatedSubscription.id,
    });

  } catch (e) {
    console.error('Erro ao trocar de plano:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── Adicionar o add-on de Documentos a uma assinatura já ativa ──────────────
// (Movido de api/stripe-add-addon.js pra dentro deste arquivo, por causa do
// limite de 12 funções serverless do plano Hobby da Vercel.)
async function handleAddAddon(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  const stripe = require('stripe')(STRIPE_SECRET);

  try {
    const key = emailToKey(email);
    const existingR = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
    const existingD = await existingR.json();
    if (existingD.fields?.documentsAddonActive?.booleanValue) {
      return res.status(200).json({ ok: true, jaAtivo: true, message: 'Add-on já está ativo pra essa conta' });
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado no Stripe — verifique se o e-mail é o mesmo usado na assinatura' });

    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 1 });
    const subscription = subs.data[0];
    if (!subscription) return res.status(404).json({ error: 'Assinatura ativa não encontrada' });

    const jaTemItem = subscription.items.data.some((item) => item.price.id === ADDON_DOCUMENTOS_PRICE_ID);
    if (jaTemItem) {
      await ativarAddonFirestore(email);
      return res.status(200).json({ ok: true, jaAtivo: true, message: 'Add-on já estava na assinatura — só sincronizei o acesso' });
    }

    await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: ADDON_DOCUMENTOS_PRICE_ID,
      proration_behavior: 'create_prorations',
    });

    await ativarAddonFirestore(email);

    return res.status(200).json({ ok: true, jaAtivo: false });
  } catch (e) {
    console.error('Erro ao adicionar add-on:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function ativarAddonFirestore(email) {
  const key = emailToKey(email);
  const url = `${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=documentsAddonActive&key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { documentsAddonActive: { booleanValue: true } } }),
  });
}

// ── Atualiza só o campo "plano" de uma conta já existente ────────────────────
async function updatePlanoFirestore({ email, plano }) {
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
