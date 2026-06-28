// Firebase service — conecta o app ao backend via /api/fb
const API = '/api/fb';

async function post(action: string, payload: Record<string, unknown> = {}) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  return r.json();
}

// ── AUTH ──
export async function fbLogin(email: string, password: string) {
  return post('login', { email, password });
}

export async function fbGetPlan(email: string) {
  return post('getPlan', { email });
}

// ── CONVERSAS ──
export async function fbListConversas() {
  const d = await post('listConversas', {});
  return d.convs || [];
}

export async function fbGetMsgs(convId: string) {
  const d = await post('getMsgs', { convId });
  return d.msgs || [];
}

export async function fbMarkRead(convId: string) {
  return post('markRead', { convId });
}

export async function fbSetConvStatus(convId: string, status: string) {
  return post('setConvStatus', { convId, status });
}

// ── BOT CONFIG (por médico) ──
export async function fbGetBotConfig(docId: string) {
  const d = await post('getBotConfig', { docId });
  return d.config || null;
}

export async function fbSaveBotConfig(docId: string, config: Record<string, string>) {
  return post('saveBotConfig', { docId, config });
}

// ── MÉDICOS ──
export async function fbSaveDoctor(doctor: Record<string, unknown>) {
  return post('crmSaveCliente', { cliente: doctor });
}

// ── REPLY ──
export async function sendReply(to: string, text: string, convId: string) {
  const r = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, convId }),
  });
  return r.json();
}

// ── CLINIC CONFIG ──
export async function fbGetClinicConfig() {
  const d = await post('getBotConfig', { docId: 'main' });
  return d.config || null;
}

export async function fbSaveClinicConfig(config: Record<string, unknown>) {
  return post('saveBotConfig', { docId: 'main', config });
}
