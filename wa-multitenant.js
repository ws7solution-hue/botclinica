// ── BotClínica — Serviço Multi-Tenant WhatsApp (Baileys) ─────────────────────
// Gerencia uma instância Baileys por clínica.
// Endpoints:
//   GET  /qr/:clinicId          → retorna QR code em base64 (para o app exibir)
//   GET  /status/:clinicId      → retorna { connected, phone }
//   POST /send/:clinicId        → { to, text } envia mensagem
//   DELETE /disconnect/:clinicId → desconecta e apaga auth
//   GET  /health                → lista todas as instâncias

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const Pino = require('pino');
const qrcode = require('qrcode');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.WA_MULTI_PORT || 3010;
const AUTH_DIR = path.join(__dirname, 'auth_sessions');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const FB_PROJECT = 'botclinica-60b6f';
const FB_KEY = 'AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ── Estado global ─────────────────────────────────────────────────────────────
// clinicId → { sock, connected, phone, qr, qrBase64, history, retries }
const instances = {};

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function fsGet(path_) {
  const r = await fetch(`${FS_BASE}/${path_}?key=${FB_KEY}`);
  return r.json();
}
async function fsPatch(path_, body) {
  const r = await fetch(`${FS_BASE}/${path_}?key=${FB_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
function emailToKey(email) { return email.toLowerCase().replace(/[@.]/g, '_'); }
function g(f, k) { return f?.[k]?.stringValue || f?.[k]?.booleanValue || ''; }

// ── Busca configurações da clínica no Firestore ───────────────────────────────
async function getClinicConfig(clinicId) {
  try {
    const key = emailToKey(clinicId);
    const [settingsDoc, doctorsDoc] = await Promise.all([
      fsGet(`clinic_settings_${key}/whatsapp`),
      fsGet(`doctors_${key}`),
    ]);

    const doctors = (doctorsDoc.documents || []).map(d => {
      const f = d.fields || {};
      return {
        id: d.name.split('/').pop(),
        name: g(f, 'name'),
        specialty: g(f, 'specialty'),
        scheduleText: g(f, 'scheduleText') || g(f, 'schedule'),
        price: g(f, 'price') || g(f, 'consultationPrice'),
        crm: g(f, 'crm'),
        botPersonality: g(f, 'botPersonality'),
        procedures: g(f, 'procedures'),
        healthPlans: g(f, 'healthPlans'),
      };
    });

    // Busca configurações do bot
    const botDoc = await fsGet(`clinic_settings_${key}/bot`);
    const bf = botDoc.fields || {};

    return {
      clinicName: g(bf, 'clinicName') || clinicId.split('@')[0],
      welcomeMessage: g(bf, 'welcomeMessage') || '',
      aiTone: g(bf, 'aiTone') || 'profissional',
      doctors,
    };
  } catch (e) {
    return { clinicName: clinicId.split('@')[0], welcomeMessage: '', aiTone: 'profissional', doctors: [] };
  }
}

// ── Monta prompt dinâmico por clínica ─────────────────────────────────────────
function buildPrompt(config) {
  const { clinicName, aiTone, doctors } = config;

  const docsText = doctors.length > 0
    ? doctors.map(d => {
        let info = `• ${d.name} — ${d.specialty}`;
        if (d.scheduleText) info += `\n  Horários: ${d.scheduleText}`;
        if (d.price) info += `\n  Valor: R$${d.price}`;
        if (d.healthPlans) info += `\n  Convênios: ${d.healthPlans}`;
        if (d.procedures) info += `\n  Procedimentos: ${d.procedures}`;
        if (d.botPersonality) info += `\n  Personalidade do bot: ${d.botPersonality}`;
        return info;
      }).join('\n\n')
    : 'Nenhum médico cadastrado ainda.';

  return `Você é Sofia, assistente virtual da ${clinicName}.
Seu papel é atender pacientes via WhatsApp de forma ${aiTone}, eficiente e humanizada.

MÉDICOS DISPONÍVEIS:
${docsText}

SUAS FUNÇÕES:
- Informar especialidades, horários e valores de consulta
- Agendar consultas (pergunte: nome, data preferida, horário, médico)
- Confirmar, cancelar ou reagendar consultas
- Responder dúvidas sobre a clínica
- Encaminhar para atendimento humano quando necessário

REGRAS:
- Seja concisa (máximo 3 frases por resposta)
- Nunca invente informações que não estão acima
- Se não souber algo, diga que vai verificar e passar pra equipe
- Sempre termine com uma pergunta ou ação clara para o paciente
- Use emojis com moderação (1-2 por mensagem)`;
}

// ── Histórico de conversa por clínica+paciente ────────────────────────────────
function getHistory(clinicId, phone) {
  const inst = instances[clinicId];
  if (!inst) return [];
  if (!inst.history[phone]) inst.history[phone] = [];
  return inst.history[phone];
}

function addToHistory(clinicId, phone, role, content) {
  const inst = instances[clinicId];
  if (!inst) return;
  if (!inst.history[phone]) inst.history[phone] = [];
  inst.history[phone].push({ role, content });
  if (inst.history[phone].length > 20) inst.history[phone] = inst.history[phone].slice(-20);
}

// ── Responde com IA ───────────────────────────────────────────────────────────
async function replyWithAI(clinicId, phone, userText, pushName) {
  const inst = instances[clinicId];
  if (!inst) return;

  try {
    addToHistory(clinicId, phone, 'user', userText);
    const history = getHistory(clinicId, phone);
    const config = await getClinicConfig(clinicId);
    const systemPrompt = buildPrompt(config);

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: history,
    });

    const reply = response.content[0]?.text || 'Desculpe, não consegui processar sua mensagem.';
    addToHistory(clinicId, phone, 'assistant', reply);

    // Salva conversa no Firestore
    const key = emailToKey(clinicId);
    const docId = phone.replace(/[^a-zA-Z0-9]/g, '_');
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    await fsPatch(`conversations_${key}/${docId}`, {
      fields: {
        name: { stringValue: pushName || phone },
        phone: { stringValue: phone },
        patientName: { stringValue: pushName || phone },
        patientPhone: { stringValue: phone },
        last: { stringValue: userText },
        lastMessage: { stringValue: userText },
        time: { stringValue: now },
        lastMessageTime: { stringValue: now },
        status: { stringValue: 'bot' },
        category: { stringValue: 'WhatsApp' },
        avatarColor: { stringValue: 'bg-blue-500' },
        updatedAt: { stringValue: new Date().toISOString() },
      }
    });

    await inst.sock.sendMessage(phone, { text: reply });
    console.log(`[${clinicId}] ✅ Resposta enviada para ${phone}`);
  } catch (e) {
    console.error(`[${clinicId}] Erro ao responder:`, e.message);
  }
}

// ── Conecta uma instância Baileys para uma clínica ────────────────────────────
async function connectInstance(clinicId) {
  if (instances[clinicId]?.connected) {
    console.log(`[${clinicId}] Já conectado.`);
    return;
  }

  const authDir = path.join(AUTH_DIR, emailToKey(clinicId));
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: Pino({ level: 'silent' }),
    generateHighQualityLinkPreview: false,
  });

  if (!instances[clinicId]) {
    instances[clinicId] = { sock, connected: false, phone: '', qr: null, qrBase64: null, history: {}, retries: 0 };
  } else {
    instances[clinicId].sock = sock;
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      instances[clinicId].qr = qr;
      // Gera QR em base64 pra exibir no app
      try {
        instances[clinicId].qrBase64 = await qrcode.toDataURL(qr);
      } catch (e) {}
      console.log(`[${clinicId}] 📱 QR Code gerado`);
    }

    if (connection === 'close') {
      instances[clinicId].connected = false;
      instances[clinicId].qr = null;
      instances[clinicId].qrBase64 = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      if (shouldReconnect && (instances[clinicId].retries || 0) < 5) {
        instances[clinicId].retries = (instances[clinicId].retries || 0) + 1;
        console.log(`[${clinicId}] 🔄 Reconectando (tentativa ${instances[clinicId].retries})...`);
        setTimeout(() => connectInstance(clinicId), 5000);
      } else if (!shouldReconnect) {
        console.log(`[${clinicId}] 🚫 Deslogado — apagando sessão.`);
        disconnectInstance(clinicId);
      }
    }

    if (connection === 'open') {
      instances[clinicId].connected = true;
      instances[clinicId].retries = 0;
      instances[clinicId].qr = null;
      instances[clinicId].qrBase64 = null;
      const phone = sock.user?.id?.split(':')[0] || '';
      instances[clinicId].phone = phone;
      console.log(`[${clinicId}] ✅ Conectado! Número: ${phone}`);

      // Salva número conectado no Firestore
      const key = emailToKey(clinicId);
      await fsPatch(`clinic_settings_${key}/whatsapp_baileys`, {
        fields: {
          phone: { stringValue: phone },
          connectedAt: { stringValue: new Date().toISOString() },
          provider: { stringValue: 'baileys' },
          status: { stringValue: 'connected' },
        }
      }).catch(() => {});
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from || from.includes('@g.us')) continue;
      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.buttonsResponseMessage?.selectedButtonId
        || '';
      if (!text) continue;
      const pushName = msg.pushName || '';
      console.log(`[${clinicId}] 📨 Mensagem de ${from}: ${text.substring(0, 50)}`);
      await replyWithAI(clinicId, from, text, pushName);
    }
  });
}

// ── Desconecta e apaga sessão ─────────────────────────────────────────────────
async function disconnectInstance(clinicId) {
  const inst = instances[clinicId];
  if (inst?.sock) {
    try { await inst.sock.logout(); } catch (e) {}
    try { inst.sock.ev.removeAllListeners(); } catch (e) {}
  }
  delete instances[clinicId];

  // Apaga pasta de auth
  const authDir = path.join(AUTH_DIR, emailToKey(clinicId));
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });

  // Atualiza Firestore
  const key = emailToKey(clinicId);
  await fsPatch(`clinic_settings_${key}/whatsapp_baileys`, {
    fields: { status: { stringValue: 'disconnected' }, disconnectedAt: { stringValue: new Date().toISOString() } }
  }).catch(() => {});

  console.log(`[${clinicId}] 🔌 Desconectado e sessão apagada.`);
}

// ── Restaura sessões existentes ao iniciar ────────────────────────────────────
async function restoreSessions() {
  if (!fs.existsSync(AUTH_DIR)) return;
  const dirs = fs.readdirSync(AUTH_DIR);
  for (const dir of dirs) {
    const authDir = path.join(AUTH_DIR, dir);
    if (!fs.statSync(authDir).isDirectory()) continue;
    // Converte key de volta pra email (aproximado)
    const clinicId = dir.replace(/_/g, (_, i) => i === dir.lastIndexOf('_') ? '@' : '.');
    console.log(`[init] Restaurando sessão: ${dir}`);
    // Usa o dir como clinicId já que não temos o email original
    await connectInstance(dir).catch(e => console.error(`Erro ao restaurar ${dir}:`, e.message));
  }
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

// QR Code — app chama isso pra mostrar o QR pro cliente
app.get('/qr/:clinicId', async (req, res) => {
  const { clinicId } = req.params;
  const decoded = decodeURIComponent(clinicId);

  if (!instances[decoded]) {
    await connectInstance(decoded);
    // Aguarda até 3s pelo QR
    await new Promise(r => setTimeout(r, 3000));
  }

  const inst = instances[decoded];
  if (!inst) return res.json({ error: 'Falha ao iniciar instância' });
  if (inst.connected) return res.json({ connected: true, phone: inst.phone });
  if (inst.qrBase64) return res.json({ qr: inst.qrBase64, connected: false });

  // Aguarda mais 5s pelo QR
  await new Promise(r => setTimeout(r, 5000));
  if (instances[decoded]?.qrBase64) return res.json({ qr: instances[decoded].qrBase64, connected: false });

  return res.json({ error: 'QR Code ainda não gerado. Tente novamente.' });
});

// Status da conexão
app.get('/status/:clinicId', (req, res) => {
  const { clinicId } = req.params;
  const decoded = decodeURIComponent(clinicId);
  const inst = instances[decoded];
  if (!inst) return res.json({ connected: false });
  return res.json({ connected: inst.connected, phone: inst.phone });
});

// Enviar mensagem manualmente (pelo painel)
app.post('/send/:clinicId', async (req, res) => {
  const { clinicId } = req.params;
  const decoded = decodeURIComponent(clinicId);
  const { to, text } = req.body;
  const inst = instances[decoded];
  if (!inst?.connected) return res.status(400).json({ error: 'Não conectado' });
  try {
    const jid = to.includes('@') ? to : to.replace(/\D/g, '') + '@s.whatsapp.net';
    await inst.sock.sendMessage(jid, { text });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Desconectar
app.delete('/disconnect/:clinicId', async (req, res) => {
  const { clinicId } = req.params;
  const decoded = decodeURIComponent(clinicId);
  await disconnectInstance(decoded);
  res.json({ ok: true });
});

// Health check — lista todas as instâncias
app.get('/health', (req, res) => {
  const status = Object.entries(instances).map(([id, inst]) => ({
    clinicId: id,
    connected: inst.connected,
    phone: inst.phone,
    hasQR: !!inst.qrBase64,
  }));
  res.json({ instances: status, total: status.length });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 BotClínica Multi-Tenant WhatsApp rodando na porta ${PORT}`);
  await restoreSessions();
});
