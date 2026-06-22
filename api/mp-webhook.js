const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
const FB_PROJECT = 'botclinica-60b6f';
const BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

async function fbPatch(path, body) {
  const r = await fetch(`${BASE}/${path}?key=${FB_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.ok;
}

async function authorizeEmail(email, plano, paymentId) {
  const key = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return fbPatch(`acessos_autorizados/${key}`, {
    fields: {
      email: { stringValue: email },
      plano: { stringValue: plano },
      paymentId: { stringValue: String(paymentId) },
      authorizedAt: { stringValue: new Date().toISOString() },
      active: { booleanValue: true }
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { type, data } = req.body;
    console.log('MP Webhook:', type, data?.id);

    // Only process successful payments
    if (type !== 'payment' && type !== 'subscription_preapproval') {
      return res.status(200).json({ ok: true });
    }

    const paymentId = data?.id;
    if (!paymentId) return res.status(200).json({ ok: true });

    // Get payment details from Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
    });
    const payment = await mpRes.json();

    console.log('Payment status:', payment.status, 'Email:', payment.payer?.email);

    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const email = payment.payer?.email;
    if (!email) return res.status(200).json({ ok: true, error: 'No email' });

    // Determine plan based on amount
    const amount = payment.transaction_amount;
    let plano = 'Starter';
    if (amount >= 800) plano = 'Clínica';
    else if (amount >= 450) plano = 'Profissional';

    const ok = await authorizeEmail(email, plano, paymentId);
    console.log(`✅ Acesso liberado: ${email} | ${plano} | OK: ${ok}`);

    return res.status(200).json({ ok, email, plano });
  } catch (e) {
    console.error('MP webhook error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
