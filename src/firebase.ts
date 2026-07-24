import { Doctor, Appointment, Conversation } from './types';

// ── Helper genérico (compatível com o estilo já usado no projeto) ──
async function post(action: string, payload: Record<string, unknown> = {}) {
  const r = await fetch('/api/fb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── AUTH (real, via Firebase Auth + Firestore acessos_autorizados) ──
export async function fbLogin(email: string, password: string) {
  return post('login', { email, password });
}

export async function fbGetPlan(email: string) {
  return post('getPlan', { email });
}

/** Envia e-mail de redefinição de senha via Firebase Auth (link real, sem senha provisória). */
export async function fbSendPasswordReset(email: string) {
  // BUGFIX (23/07): o template de e-mail do Firebase ficou travado no
  // console (sem conseguir editar texto/remetente). Agora usamos nosso
  // próprio endpoint, que gera o link via Admin SDK e manda o e-mail via
  // Resend, com nosso texto em português.
  const r = await fetch('/api/send-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return r.json();
}

// ── CONVERSAS (mecanismo legado, usado pelo webhook real do WhatsApp na VPS) ──
// Mantido enquanto o número é único e compartilhado (antes do Embedded Signup por clínica).
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
export async function fbListDoctors(clinicId: string): Promise<Doctor[]> {
  const d = await post('listDoctors', { clinicId: clinicId || '' });
  return d.doctors || [];
}

export async function fbSaveDoctor(clinicId: string, doctor: Doctor): Promise<void> {
  await post('saveDoctor', { doctor, clinicId: clinicId || '' });
}

export async function fbDeleteDoctor(clinicId: string, doctorId: string): Promise<void> {
  await post('deleteDoctor', { id: doctorId, clinicId: clinicId || '' });
}

// ── AGENDAMENTOS ──
export async function fbListAppointments(clinicId: string): Promise<Appointment[]> {
  const d = await post('listAppointments', { clinicId: clinicId || '' });
  return d.appointments || [];
}

export async function fbSaveAppointment(clinicId: string, appointment: Appointment): Promise<void> {
  await post('saveAppointment', { appointment, clinicId: clinicId || '' });
}

export async function fbDeleteAppointment(id: string, clinicId?: string) {
  return post('deleteAppointment', { id, clinicId: clinicId || '' });
}

export async function fbDeleteConversation(id: string, clinicId?: string) {
  return post('deleteConversation', { id, clinicId: clinicId || '' });
}

/** Cancela um agendamento via PATCH parcial (não sobrescreve o documento inteiro). */
export async function fbCancelAppointment(appointmentId: string, clinicId: string) {
  return post('cancelAppointment', { clinicId: clinicId || '', appointmentId });
}

/** Marca o lembrete de um agendamento como enviado via PATCH parcial. */
export async function fbMarkReminderSent(appointmentId: string, clinicId: string) {
  return post('markReminderSent', { clinicId: clinicId || '', appointmentId });
}

// ── CONVERSAS POR CLÍNICA (multi-tenant — preparado para quando cada clínica
// tiver seu próprio número via Embedded Signup; ainda não usado em produção) ──
export async function fbListConversations(clinicId: string): Promise<Conversation[]> {
  const d = await post('listConversations', { clinicId: clinicId || '' });
  return Array.isArray(d) ? d : (d.conversations || []);
}

export async function fbSaveConversation(clinicId: string, conversation: Conversation) {
  return post('saveConversation', { clinicId: clinicId || '', conversation });
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
  return d || null;
}

export async function fbSaveBotConfig(docId: string, config: Record<string, unknown>) {
  return post('saveBotConfig', { docId, config });
}

// ── ADMIN / CRM ──
export async function fbListClients(token?: string) {
  const d = await post('listClients', { token });
  return d.clients || [];
}

export async function fbSetAccess(email: string, plano: string, senha?: string) {
  return post('setAccess', { email, plano, senha });
}

export async function fbRemoveAccess(email: string) {
  return post('removeAccess', { email });
}

export async function fbCrmListClientes() {
  const d = await post('crmListClientes', {});
  return d.clientes || [];
}

export async function fbCrmSaveCliente(cliente: Record<string, unknown>) {
  return post('crmSaveCliente', { cliente });
}

export async function fbCrmDeleteCliente(id: string) {
  return post('crmDeleteCliente', { id });
}

// ── PRONTUÁRIO ELETRÔNICO (Premium) ──
export async function fbListProntuario(clinicId: string, patientId: string): Promise<any[]> {
  const d = await post('listProntuario', { clinicId: clinicId || '', patientId });
  return Array.isArray(d) ? d : (d.entries || []);
}

export async function fbSaveProntuarioEntry(clinicId: string, patientId: string, entry: any) {
  return post('saveProntuarioEntry', { clinicId: clinicId || '', patientId, entry });
}

export async function fbGetPatientProfile(clinicId: string, patientId: string) {
  return post('getPatientProfile', { clinicId: clinicId || '', patientId });
}

export async function fbSavePatientProfile(clinicId: string, patientId: string, profile: any) {
  return post('savePatientProfile', { clinicId: clinicId || '', patientId, profile });
}

/** Troca a senha do usuário autenticado via Firebase Auth. */
export async function fbChangePassword(idToken: string, newPassword: string) {
  return post('changePassword', { idToken, newPassword });
}

/** Marca o primeiro acesso como concluído (após o cliente definir a própria senha). */
export async function fbSetFirstAccessDone(clinicId: string, token?: string) {
  return post('setFirstAccessDone', { clinicId, token });
}

/** Salva as credenciais WhatsApp da clínica (vindas do Embedded Signup). */
export async function fbSaveWhatsAppCredentials(clinicId: string, creds: {
  phoneNumberId: string; accessToken: string; wabaId: string; phoneNumber: string;
}, token?: string) {
  return post('saveWhatsAppCredentials', { clinicId, ...creds, token });
}

/** Busca as credenciais WhatsApp da clínica. */
export async function fbGetWhatsAppCredentials(clinicId: string) {
  return post('getWhatsAppCredentials', { clinicId });
}
// Ainda não conectado à API oficial do WhatsApp — aguardando aprovação da Meta
// (ver Embedded Signup, pendência registrada nas conversas anteriores).
export async function sendReply(to: string, text: string, convId: string) {
  const r = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, convId }),
  });
  return r.json();
}

// ── FINANCEIRO ──
export async function fbCheckFinanceiroPin(clinicId: string, pin: string): Promise<{ hasPin: boolean; valid: boolean }> {
  return post('checkFinanceiroPin', { clinicId, pin });
}

export async function fbSetFinanceiroPin(clinicId: string, pin: string) {
  return post('setFinanceiroPin', { clinicId, pin });
}

export async function fbListFinanceiroEntries(clinicId: string): Promise<any[]> {
  const d = await post('listFinanceiroEntries', { clinicId });
  return Array.isArray(d) ? d : [];
}

export async function fbSaveFinanceiroEntry(clinicId: string, entry: any) {
  return post('saveFinanceiroEntry', { clinicId, entry });
}

export async function fbDeleteFinanceiroEntry(clinicId: string, id: string) {
  return post('deleteFinanceiroEntry', { clinicId, id });
}

export async function fbGetFinanceiroConfig(clinicId: string): Promise<any> {
  return post('getFinanceiroConfig', { clinicId });
}

export async function fbGetPlano(email: string): Promise<string> {
  const r = await post('getPlano', { email });
  return r?.plano || 'starter';
}

// ── BLOQUEIO DE AGENDA DO MÉDICO ──
export async function fbListScheduleBlocks(clinicId: string): Promise<any[]> {
  const d = await post('listScheduleBlocks', { clinicId });
  return Array.isArray(d) ? d : [];
}

export async function fbSaveScheduleBlock(clinicId: string, block: any) {
  return post('saveScheduleBlock', { clinicId, block });
}

export async function fbDeleteScheduleBlock(clinicId: string, id: string) {
  return post('deleteScheduleBlock', { clinicId, id });
}

export async function fbSetFinanceiroConfig(clinicId: string, config: any) {
  return post('setFinanceiroConfig', { clinicId, config });
}

// ── PORTAL DO MÉDICO ──
export async function fbCheckDoctorPin(clinicId: string, doctorId: string, pin: string): Promise<{ hasPin: boolean; valid: boolean }> {
  return post('checkDoctorPin', { clinicId, doctorId, pin });
}

export async function fbSetDoctorPin(clinicId: string, doctorId: string, pin: string) {
  return post('setDoctorPin', { clinicId, doctorId, pin });
}
