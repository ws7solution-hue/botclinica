// ── BotClínica — Troca de Plano com Proration ────────────────────────────────
// Troca o plano de uma assinatura já ativa, cobrando (ou creditando) apenas
// a diferença proporcional pelo tempo restante do ciclo atual — sem precisar
// cancelar e recriar a assinatura.

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const PRICE_IDS = {
  starter:      'price_1Tq1FORiC3IX8iaz00PLfzrQ',
  profissional: 'price_1Tq1H9RiC3IX8iazJxHhJLZQ',
  clinica:      'price_1Tq1HoRiC3IX8iaz9lROVOzf',
  premium:      'price_1Tq1IORiC3IX8iazV16NV0IC',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    // 1. Encontra o customer pelo email
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado no Stripe' });
    }

    // 2. Encontra a assinatura ativa desse customer
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

    // 3. Pré-visualiza o valor da cobrança proporcional antes de aplicar
    //    (útil para mostrar ao cliente quanto vai ser cobrado agora, se quiser)
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: customer.id,
      subscription: subscription.id,
      subscription_items: [{ id: currentItem.id, price: novoPriceId }],
      subscription_proration_behavior: 'create_prorations',
    });

    const valorProrationCentavos = upcomingInvoice.lines.data
      .filter(line => line.proration)
      .reduce((total, line) => total + line.amount, 0);

    // 4. Aplica a troca de fato — Stripe calcula e fatura a diferença
    //    proporcional automaticamente (ou credita, se for downgrade)
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: currentItem.id, price: novoPriceId }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        plano: novoPlano.toLowerCase(),
        email,
      },
    });

    // 5. Atualiza o plano no Firestore imediatamente
    //    (o webhook customer.subscription.updated também faz isso, mas
    //    atualizar aqui garante resposta imediata pro usuário no app)
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
};

// ── Atualiza o campo "plano" no Firestore ────────────────────────────────────
async function updatePlanoFirestore({ email, plano }) {
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
