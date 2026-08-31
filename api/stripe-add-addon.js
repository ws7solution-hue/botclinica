// ── BotClínica — Comprar Add-on (cliente já ativo) ───────────────────────────
// Adiciona o add-on de Documentos por IA a uma assinatura JÁ EXISTENTE, sem
// precisar cancelar/recriar nada — usa a API de Subscription Items da Stripe
// pra acrescentar uma segunda cobrança dentro da mesma assinatura.

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  const stripe = require('stripe')(STRIPE_SECRET);

  try {
    // 1. Confere se já está ativo pra não cobrar duas vezes por engano
    const key = emailToKey(email);
    const existingR = await fetch(`${FS}/acessos_autorizados/${key}?key=${FB_KEY}`);
    const existingD = await existingR.json();
    if (existingD.fields?.documentsAddonActive?.booleanValue) {
      return res.status(200).json({ ok: true, jaAtivo: true, message: 'Add-on já está ativo pra essa conta' });
    }

    // 2. Acha o customer e a assinatura ativa dele na Stripe
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado no Stripe — verifique se o e-mail é o mesmo usado na assinatura' });

    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 1 });
    const subscription = subs.data[0];
    if (!subscription) return res.status(404).json({ error: 'Assinatura ativa não encontrada' });

    // 3. Confere se o add-on já não está de alguma forma nessa assinatura
    //    (evita duplicar cobrança se o cliente clicar duas vezes)
    const jaTemItem = subscription.items.data.some((item) => item.price.id === ADDON_DOCUMENTOS_PRICE_ID);
    if (jaTemItem) {
      await ativarAddonFirestore(email);
      return res.status(200).json({ ok: true, jaAtivo: true, message: 'Add-on já estava na assinatura — só sincronizei o acesso' });
    }

    // 4. Adiciona o add-on como um NOVO item dentro da MESMA assinatura —
    //    a Stripe já calcula e cobra a diferença proporcional do período
    //    atual automaticamente (proration), sem precisar esperar o próximo
    //    ciclo nem criar uma assinatura separada.
    await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: ADDON_DOCUMENTOS_PRICE_ID,
      proration_behavior: 'create_prorations',
    });

    // 5. Libera o acesso no Firestore imediatamente (o webhook também
    //    sincronizaria depois, mas isso garante resposta rápida pro app)
    await ativarAddonFirestore(email);

    return res.status(200).json({ ok: true, jaAtivo: false });
  } catch (e) {
    console.error('Erro ao adicionar add-on:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

async function ativarAddonFirestore(email) {
  const key = emailToKey(email);
  const url = `${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=documentsAddonActive&key=${FB_KEY}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { documentsAddonActive: { booleanValue: true } } }),
  });
}
