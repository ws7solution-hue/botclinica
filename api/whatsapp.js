// Webhook Meta WhatsApp Business API — BotClínica Suporte
const VERIFY_TOKEN  = "botclinica2026";
const PHONE_ID      = "1187041601162259";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const WA_TOKEN      = process.env.WA_TOKEN;

const SYSTEM_PROMPT = `Você é Sofia, assistente virtual de suporte do BotClínica.
Ajude clientes com: acesso ao painel (botclinica.com.br/app), cadastro de médicos, configurações, lembretes, relatórios e problemas técnicos.
Seja simpática, objetiva e profissional. Máximo 3 frases por resposta.
Se não souber resolver, diga: "Vou escalar para nossa equipe. Escreva para contato@botclinica.com.br 📧"`;

const sessions = {};

module.exports = async (req, res) => {
  // ── VERIFICAÇÃO (GET) ──
  if (req.method === "GET") {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).json({ error: "Token inválido" });
  }

  // ── RECEBER MENSAGENS (POST) ──
  if (req.method === "POST") {
    res.status(200).json({ status: "ok" });

    try {
      const msg      = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const from     = msg?.from;
      const text     = msg?.text?.body || "";
      if (!msg || !from || !text) return;

      console.log(`[WA] ${from}: ${text}`);

      // Histórico por conversa
      if (!sessions[from]) sessions[from] = [];
      sessions[from].push({ role: "user", content: text });
      if (sessions[from].length > 20) sessions[from] = sessions[from].slice(-20);

      // Chamar Claude
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: sessions[from]
        })
      });

      const data  = await r.json();
      const reply = data.content?.[0]?.text || "Desculpe, tive um problema. Tente novamente!";

      sessions[from].push({ role: "assistant", content: reply });

      // Responder via Meta API
      await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WA_TOKEN}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: reply }
        })
      });

    } catch (err) {
      console.error("Erro webhook:", err.message);
    }
  }
};
