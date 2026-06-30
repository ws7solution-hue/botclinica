// ── Webhook do Mercado Pago ──────────────────────────────────────────
// Quando um pagamento é confirmado, cria a conta no Firebase e notifica via WhatsApp

const API_KEY    = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const PROJECT_ID = "botclinica-60b6f";
const FS         = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL   = "https://identitytoolkit.googleapis.com/v1/accounts";

// Token de acesso do Mercado Pago (Access Token de produção)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

// WhatsApp — para notificar o cliente
const WA_TOKEN    = process.env.WA_TOKEN || "";
const WA_PHONE_ID = process.env.WA_PHONE_ID || "1187041601162259";

// Mapa de links MP → planos
const PLAN_BY_LINK = {
  "2nie3Qn": "starter",
  "2tFxdmw": "profissional",
  "1qHaMTD": "clinica",
  "1gG6G2h": "premium",
};

function emailToKey(email) {
  return email.toLowerCase().replace(/[@.]/g, "_");
}

async function fsReq(path, opts = {}) {
  const url = `${FS}/${path}?key=${API_KEY}`;
  return fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

// Buscar detalhes do pagamento no MP
async function getMpPayment(paymentId) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  return r.json();
}

// Criar usuário no Firebase Auth
async function createFirebaseUser(email, password) {
  const r = await fetch(`${AUTH_URL}:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  return r.json();
}

// Salvar plano no Firestore
async function savePlan(email, plano) {
  const key = emailToKey(email);
  await fsReq(`acessos_autorizados/${key}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        email:     { stringValue: email.toLowerCase() },
        plano:     { stringValue: plano },
        senha:     { stringValue: "BotClinica@2026" },
        createdAt: { stringValue: new Date().toISOString() },
        source:    { stringValue: "mercadopago_webhook" },
      }
    }),
  });
}

// Enviar WhatsApp para o cliente com credenciais
async function sendWhatsApp(phone, email, plano) {
  if (!WA_TOKEN || !phone) return;

  const planNames = {
    starter: "Starter", profissional: "Profissional",
    clinica: "Clínica", premium: "Premium"
  };

  const msg = `🎉 *Bem-vindo ao BotClínica!*\n\n` +
    `Sua assinatura do plano *${planNames[plano] || plano}* foi confirmada!\n\n` +
    `*Seus dados de acesso:*\n` +
    `📧 Email: ${email}\n` +
    `🔑 Senha: BotClinica@2026\n\n` +
    `👉 Acesse agora: https://botclinica.com.br/app\n\n` +
    `Na primeira entrada, altere sua senha nas configurações.\n\n` +
    `Dúvidas? Estamos aqui! 🤖`;

  // Formatar número (remover caracteres não numéricos)
  const cleanPhone = phone.replace(/\D/g, '');

  await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: msg },
    }),
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET");

  // Verificação do webhook (GET)
  if (req.method === "GET") {
    return res.status(200).send("OK");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    console.log("MP Webhook recebido:", JSON.stringify(body));

    // MP envia notificações de pagamento com type: "payment"
    if (body.type !== "payment" || !body.data?.id) {
      return res.status(200).json({ ok: true, msg: "Evento ignorado" });
    }

    const paymentId = body.data.id;
    const payment = await getMpPayment(paymentId);

    console.log("Payment status:", payment.status, "| id:", paymentId);

    // Só processar pagamentos aprovados
    if (payment.status !== "approved") {
      return res.status(200).json({ ok: true, msg: `Status ${payment.status} ignorado` });
    }

    // Dados do pagador
    const email = payment.payer?.email;
    const phone = payment.payer?.phone?.number || payment.payer?.phone?.area_code + payment.payer?.phone?.number;

    if (!email) {
      console.log("Sem email no pagamento:", paymentId);
      return res.status(200).json({ ok: true, msg: "Sem email" });
    }

    // Determinar o plano pelo título do pagamento ou valor
    let plano = "starter";
    const desc = (payment.description || "").toLowerCase();
    if (desc.includes("premium"))      plano = "premium";
    else if (desc.includes("clinica")) plano = "clinica";
    else if (desc.includes("profissional")) plano = "profissional";
    else {
      // Por valor
      const valor = payment.transaction_amount;
      if (valor >= 1400) plano = "premium";
      else if (valor >= 900) plano = "clinica";
      else if (valor >= 550) plano = "profissional";
      else plano = "starter";
    }

    console.log(`Criando acesso: ${email} → ${plano}`);

    // 1. Criar no Firebase Auth
    const authResult = await createFirebaseUser(email, "BotClinica@2026");
    if (authResult.error && !authResult.error.message.includes("EMAIL_EXISTS")) {
      console.log("Erro Auth:", authResult.error.message);
    }

    // 2. Salvar plano no Firestore
    await savePlan(email, plano);

    // 3. Notificar via WhatsApp
    await sendWhatsApp(phone, email, plano);

    console.log(`✅ Acesso criado: ${email} | ${plano}`);
    return res.status(200).json({ ok: true, email, plano });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ ok: true, error: err.message });
  }
};
