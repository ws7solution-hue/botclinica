// ── Criar Preferência de Pagamento (Checkout Pro) ──────────────────────
// Em vez de usar Link de Pagamento estático (que não dispara webhook),
// criamos a preferência via API — isso ativa as notificações automáticas.

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const PLAN_PRICES = {
  starter: 397,
  profissional: 597,
  clinica: 997,
  premium: 0.02,
};

const PLAN_NAMES = {
  starter: "BotClínica - Plano Starter",
  profissional: "BotClínica - Plano Profissional",
  clinica: "BotClínica - Plano Clínica",
  premium: "BotClínica - Plano Premium",
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plano, email, clinicName, adminName } = req.body;

    if (!plano || !PLAN_PRICES[plano]) {
      return res.status(400).json({ error: "Plano inválido" });
    }
    if (!email) {
      return res.status(400).json({ error: "Email obrigatório" });
    }

    const price = PLAN_PRICES[plano];
    const title = PLAN_NAMES[plano];

    // external_reference guarda o plano + email para o webhook usar depois
    const externalRef = JSON.stringify({ plano, email, clinicName: clinicName || '', adminName: adminName || '' });

    const preference = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: price,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: email,
      },
      external_reference: externalRef,
      notification_url: "https://botclinica.com.br/api/mp-webhook",
      back_urls: {
        success: "https://botclinica.com.br/checkout?status=success",
        failure: "https://botclinica.com.br/checkout?status=failure",
        pending: "https://botclinica.com.br/checkout?status=pending",
      },
      auto_return: "approved",
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },      // remove boleto
          { id: "debit_card" },  // remove cartões de débito (ex: Débito Virtual CAIXA)
          // NÃO excluir "bank_transfer" — é o tipo do PIX no Brasil
        ],
        installments: 1,
      },
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await r.json();

    if (data.error) {
      console.log("MP preference error:", data);
      return res.status(400).json({ error: data.message || "Erro ao criar preferência" });
    }

    return res.status(200).json({
      ok: true,
      init_point: data.init_point,
      preference_id: data.id,
    });

  } catch (err) {
    console.error("create-preference error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
