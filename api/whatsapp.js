const VERIFY_TOKEN  = "botclinica2026";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const WA_TOKEN      = process.env.WA_TOKEN;
const PHONE_ID      = "1187041601162259";
const PROJECT_ID    = "botclinica-60b6f";
const API_KEY_FS    = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const FS            = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const KB            = require('../knowledge_base');

const sessions = {};

function emailToKey(email){return email.toLowerCase().replace(/[@.]/g,'_');}

// ── DESCOBRIR QUAL CLIENTE É DONO DESSE NÚMERO ──
const DEMO_EMAIL = "contato@botclinica.com.br";
async function getClinicEmailByPhoneId(phoneNumberId) {
  try {
    const r = await fetch(`${FS}/phone_number_mapping/${phoneNumberId}?key=${API_KEY_FS}`);
    const d = await r.json();
    if (d.error || !d.fields) return DEMO_EMAIL;
    return d.fields?.email?.stringValue || DEMO_EMAIL;
  } catch { return DEMO_EMAIL; }
}

// ── BUSCAR MÉDICOS CADASTRADOS NO APP (doctors_{clinicKey}) ──
async function getDoctorsForClinic(clinicKey) {
  try {
    const r = await fetch(`${FS}/doctors_${clinicKey}?key=${API_KEY_FS}`);
    const d = await r.json();
    return (d.documents || []).map(doc => {
      const f = doc.fields || {};
      const g = k => f[k]?.stringValue || "";
      return {
        name: g("name"), specialty: g("specialty"),
        consultationFee: f.consultationFee?.doubleValue || f.consultationFee?.integerValue || "",
        insurancePlans: g("insurancePlans"), exams: g("exams"),
        schedulingPolicy: g("schedulingPolicy"), preparationInstructions: g("preparationInstructions"),
        active: f.isActive?.booleanValue !== false,
      };
    }).filter(d => d.active && d.name);
  } catch { return []; }
}
async function getClinicConfig(phoneId) {
  try {
    const r = await fetch(`${FS}/clinic_config/${phoneId}?key=${API_KEY_FS}`);
    const d = await r.json();
    if (d.error) return null;
    const f = d.fields || {};
    const g = k => f[k]?.stringValue || "";
    return {
      nome:        g("nome") || "Clínica",
      especialidades: g("especialidades") || "",
      procedimentos:  g("procedimentos") || "",
      convenios:      g("convenios") || "",
      valores:        g("valores") || "",
      descontos:      g("descontos") || "",
      horarios:       g("horarios") || "",
      medicos:        g("medicos") || "",
      endereco:       g("endereco") || "",
      observacoes:    g("observacoes") || "",
    };
  } catch(e) { return null; }
}

// ── MONTAR SYSTEM PROMPT INTELIGENTE ──
function buildSystemPrompt(config) {
  // Base de conhecimento das especialidades configuradas
  let kbText = "";
  const specs = (config?.especialidades || "").toLowerCase();

  const specialtyMap = {
    "clínica geral": KB.clinica_geral,
    "clinica geral": KB.clinica_geral,
    "cardiologia": KB.cardiologia,
    "dermatologia": KB.dermatologia,
    "ortopedia": KB.ortopedia,
    "ginecologia": KB.ginecologia,
    "obstetrícia": KB.ginecologia,
    "oftalmologia": KB.oftalmologia,
    "pediatria": KB.pediatria,
    "urologia": KB.urologia,
    "neurologia": KB.neurologia,
    "endocrinologia": KB.endocrinologia,
  };

  Object.entries(specialtyMap).forEach(([key, data]) => {
    if (!specs || specs.includes(key)) {
      kbText += `\n\n=== ${data.nome.toUpperCase()} ===\n`;
      kbText += `Descrição: ${data.descricao}\n`;
      kbText += `Procedimentos: ${data.procedimentos_comuns.join(", ")}\n`;
      kbText += `Perguntas e respostas:\n`;
      Object.entries(data.perguntas_frequentes).forEach(([q, a]) => {
        kbText += `P: ${q}\nR: ${a}\n`;
      });
    }
  });

  // Info geral
  kbText += `\n\n=== POLÍTICAS GERAIS ===\n`;
  Object.entries(KB.geral).forEach(([k, v]) => {
    kbText += `${k}: ${v}\n`;
  });

  const clinicInfo = config ? `
=== INFORMAÇÕES DESTA CLÍNICA ===
Nome: ${config.nome}
Especialidades: ${config.especialidades || "Não informado"}
Procedimentos realizados: ${config.procedimentos || "Consulte nossa equipe"}
Convênios aceitos: ${config.convenios || "Consulte nossa equipe"}
Valores: ${config.valores || "Consulte nossa equipe"}
Descontos: ${config.descontos || "Não informado"}
Horários: ${config.horarios || "Consulte nossa equipe"}
Médicos: ${config.medicos || "Consulte nossa equipe"}
Endereço: ${config.endereco || "Consulte nossa equipe"}
Observações: ${config.observacoes || ""}
` : "";

  return `Você é um assistente virtual de recepção médica extremamente bem treinado.
Você atende pacientes em nome desta clínica médica via WhatsApp.

REGRAS ABSOLUTAS:
- Você é um RECEPCIONISTA inteligente, NUNCA um médico
- JAMAIS dê diagnósticos, receite medicamentos ou dê pareceres médicos
- NUNCA diga que algo é ou não é grave — sempre oriente a consultar o médico
- Seja sempre cordial, empático e profissional
- Respostas objetivas: máximo 4 linhas por mensagem
- Se não souber algo específico da clínica, diga "Vou verificar com nossa equipe e retorno em breve"
- Em emergências médicas, oriente SEMPRE a ligar para o SAMU (192) ou ir ao pronto-socorro

${clinicInfo}

BASE DE CONHECIMENTO MÉDICA (use para responder perguntas sobre procedimentos e especialidades):
${kbText}

Você pode responder sobre:
✅ Procedimentos que a clínica realiza
✅ O que esperar de cada especialidade
✅ Como se preparar para exames e consultas
✅ Documentos necessários
✅ Agendamentos, remarcações e cancelamentos
✅ Convênios e formas de pagamento
✅ Horários e localização
✅ Dúvidas gerais sobre as especialidades

Você NÃO pode:
❌ Diagnosticar doenças
❌ Receitar medicamentos
❌ Dizer se um sintoma é grave ou não
❌ Substituir a consulta médica`;
}

// ── SALVAR MENSAGEM NO FIREBASE ──
async function saveMsg(collection, convId, msg) {
  const docId = Date.now() + '_' + Math.random().toString(36).slice(2,7);
  await fetch(`${FS}/${collection}/${convId}/msgs/${docId}?key=${API_KEY_FS}`, {
    method: "PATCH",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({fields:{
      text:   {stringValue: msg.text},
      from:   {stringValue: msg.from},
      time:   {stringValue: new Date().toISOString()},
    }})
  }).catch(()=>{});
}

async function updateConv(collection, convId, data) {
  const fields = {};
  Object.keys(data).forEach(k => { fields[k] = {stringValue: String(data[k])}; });
  await fetch(`${FS}/${collection}/${convId}?key=${API_KEY_FS}`, {
    method: "PATCH", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({fields})
  }).catch(()=>{});
}

async function sendWA(to, text, phoneId) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneId || PHONE_ID}/messages`, {
    method: "POST",
    headers: {"Content-Type":"application/json","Authorization":`Bearer ${WA_TOKEN}`},
    body: JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:text}})
  }).catch(()=>{});
}

// ── WEBHOOK ──
module.exports = async (req, res) => {
  if (req.method === "GET") {
    const {["hub.mode"]:mode,["hub.verify_token"]:token,["hub.challenge"]:challenge} = req.query;
    if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).end();
  }

  if (req.method === "POST") {
    res.status(200).json({status:"ok"});
    try {
      const value   = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg     = value?.messages?.[0];
      const contact = value?.contacts?.[0];
      const incomingPhoneId = value?.metadata?.phone_number_id || PHONE_ID;
      if (!msg || msg.type !== "text") return;

      const from   = msg.from;
      const text   = msg.text.body;
      const name   = contact?.profile?.name || from;
      const convId = from.replace(/\D/g,'');
      const time   = new Date().toISOString();

      // ── Descobrir qual cliente é dono desse número ──
      const clinicEmail = await getClinicEmailByPhoneId(incomingPhoneId);
      const clinicKey = emailToKey(clinicEmail);
      const collection = `conversas_${clinicKey}`;

      console.log(`[WA] ${name}: ${text} | cliente: ${clinicEmail}`);

      // Salvar mensagem do paciente
      await saveMsg(collection, convId, {text, from:"patient"});
      await updateConv(collection, convId, {from, name, lastMsg:text, lastTime:time, status:"bot", unread:"1"});

      // Buscar médicos cadastrados pelo cliente no app
      const doctors = await getDoctorsForClinic(clinicKey);

      // Buscar config da clínica (legado) + montar contexto com médicos reais
      const config = await getClinicConfig(incomingPhoneId);
      if (doctors.length > 0) {
        config.medicos = doctors.map(d => `${d.name} (${d.specialty})${d.consultationFee ? ' - R$ '+d.consultationFee : ''}`).join('; ');
        config.convenios = doctors.map(d => d.insurancePlans).filter(Boolean).join('; ') || config.convenios;
        config.observacoes = doctors.map(d => d.preparationInstructions).filter(Boolean).join(' ') || config.observacoes;
      }

      // Histórico
      if (!sessions[from]) sessions[from] = [];
      sessions[from].push({role:"user", content:text});
      if (sessions[from].length > 20) sessions[from] = sessions[from].slice(-20);

      // Chamar Claude com base de conhecimento completa
      const systemPrompt = buildSystemPrompt(config);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:500,system:systemPrompt,messages:sessions[from]})
      });
      const data  = await r.json();
      const reply = data.content?.[0]?.text || "Desculpe, tive um problema. Tente novamente!";
      sessions[from].push({role:"assistant", content:reply});

      // Salvar resposta e enviar
      await saveMsg(collection, convId, {text:reply, from:"bot"});
      await updateConv(collection, convId, {lastMsg:reply, lastTime:new Date().toISOString()});
      await sendWA(from, reply, incomingPhoneId);

    } catch(e) { console.error("Webhook error:", e.message); }
  }
};
