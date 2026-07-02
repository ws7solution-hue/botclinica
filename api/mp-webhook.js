// ── Webhook do Mercado Pago ──────────────────────────────────────────
// Quando um pagamento é confirmado, cria a conta no Firebase e notifica via WhatsApp

const API_KEY    = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const PROJECT_ID = "botclinica-60b6f";
const FS         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL   = "https://identitytoolkit.googleapis.com/v1/accounts";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const WA_TOKEN        = process.env.WA_TOKEN || "";
const WA_PHONE_ID     = process.env.WA_PHONE_ID || "1187041601162259";

function emailToKey(email) {
  return email.toLowerCase().replace(/[@.]/g, "_");
}

async function fsReq(path, opts = {}) {
  const url = `${FS}/${path}?key=${API_KEY}`;
  return fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
}

async function getMpPayment(paymentId) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  return r.json();
}

// Busca a merchant order e retorna os detalhes do primeiro pagamento aprovado
async function getMpOrderPayment(orderId) {
  const r = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  const order = await r.json();
  console.log("Merchant order:", JSON.stringify(order).slice(0, 300));

  const approvedPayment = (order.payments || []).find(p => p.status === "approved");
  if (!approvedPayment) return null;

  // Busca detalhes completos do pagamento (tem external_reference, payer.email, etc.)
  return getMpPayment(approvedPayment.id);
}

async function createFirebaseUser(email, password) {
  const r = await fetch(`${AUTH_URL}:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  return r.json();
}

async function savePlan(email, plano) {
  const key = emailToKey(email);
  await fsReq(`acessos_autorizados/${key}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        email:       { stringValue: email.toLowerCase() },
        plano:       { stringValue: plano },
        senha:       { stringValue: "BotClinica@2026" },
        firstAccess: { booleanValue: true },
        createdAt:   { stringValue: new Date().toISOString() },
        source:      { stringValue: "mercadopago_webhook" },
      }
    }),
  });
}

async function sendWhatsApp(phone, email, plano) {
  if (!WA_TOKEN || !phone) return;
  const planNames = { starter: "Starter", profissional: "Profissional", clinica: "Clínica", premium: "Premium" };
  const msg = `🎉 *Bem-vindo ao BotClínica!*\n\n` +
    `Sua assinatura do plano *${planNames[plano] || plano}* foi confirmada!\n\n` +
    `*Seus dados de acesso:*\n` +
    `📧 E-mail: ${email}\n` +
    `🔑 Senha temporária: BotClinica@2026\n\n` +
    `👉 Acesse agora: https://botclinica.com.br/app\n\n` +
    `Na primeira entrada, você será solicitado a criar sua senha pessoal. É rápido!\n\n` +
    `Dúvidas? Estamos aqui! 🤖`;
  const cleanPhone = phone.replace(/\D/g, '');
  await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: msg } }),
  });
}

async function processPayment(payment) {
  if (!payment || payment.status !== "approved") {
    console.log("Pagamento não aprovado:", payment?.status);
    return null;
  }

  let email = payment.payer?.email;
  const phone = payment.payer?.phone?.number
    ? (payment.payer.phone.area_code || '') + payment.payer.phone.number
    : null;

  let plano = "starter";
  try {
    const ref = JSON.parse(payment.external_reference || "{}");
    if (ref.plano) plano = ref.plano;
    if (ref.email) email = ref.email;
  } catch {
    const valor = payment.transaction_amount;
    if (valor >= 1400) plano = "premium";
    else if (valor >= 900) plano = "clinica";
    else if (valor >= 550) plano = "profissional";
    else plano = "starter";
  }

  if (!email) {
    console.log("Sem email no pagamento:", payment.id);
    return null;
  }

  console.log(`Criando acesso: ${email} → ${plano}`);

  const authResult = await createFirebaseUser(email, "BotClinica@2026");
  if (authResult.error && !authResult.error.message.includes("EMAIL_EXISTS")) {
    console.log("Erro Auth:", authResult.error.message);
  }

  await savePlan(email, plano);
  await sendWhatsApp(phone, email, plano);

  console.log(`✅ Acesso criado: ${email} | ${plano}`);
  return { email, plano };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET");

  if (req.method === "GET") return res.status(200).send("OK");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body   = req.body || {};
    const qType  = req.query?.type;
    const qId    = req.query?.['data.id'];

    const type   = body.type    || qType || "";
    const dataId = body.data?.id || qId  || "";

    console.log("MP Webhook recebido:", JSON.stringify({ type, dataId }).slice(0, 200));

    let payment = null;

    // Formato 1: type=payment (notificação direta)
    if (type === "payment" && dataId) {
      payment = await getMpPayment(dataId);
    }
    // Formato 2: type=topic_merchant_order_wh (ordem de compra — Checkout Pro)
    else if (type === "topic_merchant_order_wh" && dataId) {
      payment = await getMpOrderPayment(dataId);
    }
    // Formato 3: query params legado
    else if (qType === "payment" && qId) {
      payment = await getMpPayment(qId);
    }
    else {
      console.log("Evento ignorado. type:", type, "dataId:", dataId);
      return res.status(200).json({ ok: true, msg: "Evento ignorado" });
    }

    const result = await processPayment(payment);
    return res.status(200).json({ ok: true, ...(result || { msg: "Pagamento não processado" }) });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ ok: true, error: err.message });
  }
};
