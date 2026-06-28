// ── Firebase Service Layer ── BotClínica
// Todas as chamadas ao backend via /api/fb

const API = '/api/fb';

async function post(action: string, payload: Record<string, unknown> = {}) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
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

// ── MÉDICOS ──
export async function fbListDoctors() {
  const d = await post('crmListClientes', {});
  return d.clientes || [];
}

export async function fbSaveDoctor(doctor: Record<string, unknown>) {
  return post('crmSaveCliente', { cliente: doctor });
}

export async function fbDeleteDoctor(id: string) {
  return post('crmDeleteCliente', { id });
}

// ── BOT CONFIG ──
export async function fbGetBotConfig(docId: string) {
  const d = await post('getBotConfig', { docId });
  return d.config || null;
}

export async function fbSaveBotConfig(docId: string, config: Record<string, unknown>) {
  return post('saveBotConfig', { docId, config });
}

// ── CONFIGURAÇÕES DA CLÍNICA ──
export async function fbGetClinicConfig() {
  const d = await post('getBotConfig', { docId: 'clinic_settings' });
  return d.config || null;
}

export async function fbSaveClinicConfig(config: Record<string, unknown>) {
  return post('saveBotConfig', { docId: 'clinic_settings', config });
}

// ── AGENDAMENTOS ──
export async function fbListAppointments() {
  const d = await post('crmListClientes', { collection: 'appointments' });
  return d.clientes || [];
}

export async function fbSaveAppointment(apt: Record<string, unknown>) {
  return post('crmSaveCliente', { cliente: apt, collection: 'appointments' });
}

// ── REPLY (enviar mensagem manual) ──
export async function sendReply(to: string, text: string, convId: string) {
  const r = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, convId }),
  });
  return r.json();
}
