const VERIFY_TOKEN  = "botclinica2026";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const WA_TOKEN      = process.env.WA_TOKEN;
const PHONE_ID      = "1187041601162259";
const PROJECT_ID    = "botclinica-60b6f";
const API_KEY       = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const FS            = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const SYSTEM_PROMPT = `Você é Sofia, assistente virtual de suporte do BotClínica.
Ajude clientes com: acesso ao painel (botclinica.com.br/app), cadastro de médicos, configurações, lembretes, relatórios e problemas técnicos.
Seja simpática, objetiva e profissional. Máximo 3 frases por resposta.
Se não souber resolver, diga: "Vou escalar para nossa equipe. Escreva para contato@botclinica.com.br 📧"`;

const sessions = {};

async function saveMsg(convId, msg) {
  const docId = Date.now() + '_' + Math.random().toString(36).slice(2,7);
  await fetch(`${FS}/conversas/${convId}/msgs/${docId}?key=${API_KEY}`, {
    method: "PATCH",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({fields:{
      text:      {stringValue: msg.text},
      from:      {stringValue: msg.from},
      time:      {stringValue: new Date().toISOString()},
      status:    {stringValue: msg.status || "bot"}
    }})
  });
}

async function updateConv(convId, data) {
  const fields = {};
  Object.keys(data).forEach(k => {
    fields[k] = {stringValue: String(data[k])};
  });
  await fetch(`${FS}/conversas/${convId}?key=${API_KEY}`, {
    method: "PATCH",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({fields})
  });
}

async function sendWA(to, text) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {"Content-Type":"application/json","Authorization":`Bearer ${WA_TOKEN}`},
    body: JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:text}})
  });
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const {["hub.mode"]:mode,["hub.verify_token"]:token,["hub.challenge"]:challenge} = req.query;
    if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).end();
  }

  if (req.method === "POST") {
    res.status(200).json({status:"ok"});
    try {
      const value    = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg      = value?.messages?.[0];
      const contact  = value?.contacts?.[0];
      if (!msg || msg.type !== "text") return;

      const from    = msg.from;
      const text    = msg.text.body;
      const name    = contact?.profile?.name || from;
      const convId  = from.replace(/\D/g,'');
      const time    = new Date().toISOString();

      console.log(`[WA IN] ${name} (${from}): ${text}`);

      // Salvar mensagem do paciente
      await saveMsg(convId, {text, from:"patient", status:"received"});
      await updateConv(convId, {
        from, name,
        lastMsg: text,
        lastTime: time,
        status: "bot",
        unread: "1"
      });

      // Histórico
      if (!sessions[from]) sessions[from] = [];
      sessions[from].push({role:"user", content:text});
      if (sessions[from].length > 20) sessions[from] = sessions[from].slice(-20);

      // Chamar Claude
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:400,system:SYSTEM_PROMPT,messages:sessions[from]})
      });
      const data  = await r.json();
      const reply = data.content?.[0]?.text || "Desculpe, tente novamente!";
      sessions[from].push({role:"assistant", content:reply});

      // Salvar resposta do bot
      await saveMsg(convId, {text:reply, from:"bot", status:"sent"});
      await updateConv(convId, {lastMsg:reply, lastTime:new Date().toISOString(), status:"bot"});

      // Enviar via Meta
      await sendWA(from, reply);

    } catch(e) { console.error("Webhook error:", e.message); }
  }
};
