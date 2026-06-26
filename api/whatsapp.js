// Webhook Meta WhatsApp Business API
const VERIFY_TOKEN = "botclinica2026";

module.exports = async (req, res) => {
  // ── VERIFICAÇÃO DO WEBHOOK (GET) ──
  if (req.method === "GET") {
    const mode      = req.query["hub.mode"];
    const token     = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado com sucesso!");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Token inválido" });
  }

  // ── RECEBER MENSAGENS (POST) ──
  if (req.method === "POST") {
    const body = req.body;

    // Confirmar recebimento imediatamente
    res.status(200).json({ status: "ok" });

    try {
      const entry   = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const messages = value?.messages;

      if (!messages || !messages.length) return;

      const msg     = messages[0];
      const from    = msg.from; // número do remetente
      const text    = msg?.text?.body || "";
      const phoneId = value?.metadata?.phone_number_id;

      if (!text || !phoneId) return;

      console.log(`[WA] De: ${from} | Msg: ${text}`);

      // Encaminhar para a VPS processar (bot de suporte)
      // Por enquanto: resposta automática simples
      await sendWAMessage(phoneId, from, "Olá! 😊 Recebi sua mensagem. Em breve um de nossos bots estará disponível aqui. Por enquanto acesse: botclinica.com.br");

    } catch (err) {
      console.error("Erro no webhook:", err.message);
    }
  }
};

async function sendWAMessage(phoneNumberId, to, text) {
  const token = process.env.WA_TOKEN;
  if (!token) { console.error("WA_TOKEN não configurado"); return; }

  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    })
  });
}
