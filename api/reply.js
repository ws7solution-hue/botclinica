// Enviar resposta manual do painel para o paciente via Meta API
const PHONE_ID  = "1187041601162259";
const WA_TOKEN  = process.env.WA_TOKEN;
const PROJECT_ID = "botclinica-60b6f";
const API_KEY   = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const FS        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const {to, text, convId} = req.body || {};
  if (!to || !text) return res.status(400).json({error:"to e text são obrigatórios"});

  try {
    // Enviar via Meta
    const r = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${WA_TOKEN}`},
      body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:text}})
    });
    const d = await r.json();
    if (d.error) return res.status(200).json({error:d.error.message});

    // Salvar no Firebase
    const cId = convId || to.replace(/\D/g,'');
    const docId = Date.now()+'_manual';
    const now = new Date().toISOString();
    await fetch(`${FS}/conversas/${cId}/msgs/${docId}?key=${API_KEY}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({fields:{
        text:{stringValue:text},
        from:{stringValue:"human"},
        time:{stringValue:now},
        status:{stringValue:"sent"}
      }})
    });
    // Atualizar conversa
    await fetch(`${FS}/conversas/${cId}?key=${API_KEY}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({fields:{
        lastMsg:{stringValue:text},
        lastTime:{stringValue:now},
        status:{stringValue:"human"}
      }})
    });

    return res.status(200).json({ok:true});
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
};
