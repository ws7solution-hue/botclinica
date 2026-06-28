// ── Firebase Service Layer ── BotClínica
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
export async function fbListDoctors(clinicId?: string) {
  const d = await post('listDoctors', { clinicId: clinicId || '' });
  return d.doctors || [];
}

export async function fbSaveDoctor(doctor: Record<string, unknown>, clinicId?: string) {
  return post('saveDoctor', { doctor, clinicId: clinicId || '' });
}

export async function fbDeleteDoctor(id: string, clinicId?: string) {
  return post('deleteDoctor', { id, clinicId: clinicId || '' });
}

// ── AGENDAMENTOS ──
export async function fbListAppointments(clinicId?: string) {
  const d = await post('listAppointments', { clinicId: clinicId || '' });
  return d.appointments || [];
}

export async function fbSaveAppointment(appointment: Record<string, unknown>, clinicId?: string) {
  return post('saveAppointment', { appointment, clinicId: clinicId || '' });
}

export async function fbDeleteAppointment(id: string, clinicId?: string) {
  return post('deleteAppointment', { id, clinicId: clinicId || '' });
}

// ── CONFIGURAÇÕES DA CLÍNICA ──
export async function fbGetClinicSettings(clinicId?: string) {
  const d = await post('getClinicSettings', { clinicId: clinicId || '' });
  return d.settings || null;
}

export async function fbSaveClinicSettings(settings: Record<string, unknown>, clinicId?: string) {
  return post('saveClinicSettings', { settings, clinicId: clinicId || '' });
}

// ── BOT CONFIG ──
export async function fbGetBotConfig(docId: string) {
  const d = await post('getBotConfig', { docId });
  return d.config || null;
}

export async function fbSaveBotConfig(docId: string, config: Record<string, unknown>) {
  return post('saveBotConfig', { docId, config });
}

// ── REPLY MANUAL ──
export async function sendReply(to: string, text: string, convId: string) {
  const r = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, convId }),
  });
  return r.json();
}
