/**
 * Types for the AtendIA SaaS Platform (Medical Clinic WhatsApp Chatbot)
 */

export interface Message {
  id: string;
  sender: 'patient' | 'bot' | 'human';
  text: string;
  timestamp: string; // ISO or HH:MM
  type?: 'text' | 'image' | 'audio' | 'document'; // default 'text'
  mediaUrl?: string;   // used when type !== 'text'
}

export interface Conversation {
  id: string;
  patientName: string;
  patientPhone: string;
  status: 'bot' | 'human_needed' | 'human_active' | 'resolved';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatarColor: string;
  category: string; // e.g., 'Agendamento', 'Dúvida', 'Exames', 'Urgência'
  assignedDoctorId?: string;
  receptionNote?: string;
  messages: Message[];
  updatedAt?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  rating?: number;
  avatarUrl: string;
  schedules: string[];
  consultationFee: number;
  activePatientsCount: number;
  isActive: boolean;
  attendanceDays: string[];
  startTime: string;
  endTime: string;
  
  // Configuração de agenda
  slotDuration?: number; // duração da consulta em minutos (15, 20, 30, 45, 60)
  breakStart?: string;   // início da pausa (ex: '12:00')
  breakEnd?: string;     // fim da pausa (ex: '13:00')
  break2Start?: string;  // segunda pausa opcional
  break2End?: string;

  // Bot Configuration Section
  procedures?: string;
  insurancePlans?: string;
  exams?: string;
  discounts?: string;
  schedulingPolicy?: string;
  preparationInstructions?: string;
  additionalNotes?: string;

  // Bot Behavior
  botName: string;
  botTone: 'Cordial' | 'Formal' | 'Descontraído';

  // Repasse financeiro — quanto do valor da consulta fica pra clínica vs
  // pro médico. Comum em clínicas onde o médico não é CLT, é "associado"
  // ou presta serviço (padrão de mercado, não é exclusividade de nenhuma
  // especialidade).
  repasseType?: 'percentual' | 'fixo'; // % sobre o valor da consulta, ou valor fixo por consulta
  repasseValue?: number; // se percentual: 0-100 (% que fica pra clínica); se fixo: valor em R$ que fica pra clínica
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: 'confirmed' | 'pending' | 'canceled';
  reminderSent: boolean;
  reminderStatus: 'none' | 'sent' | 'read' | 'confirmed_by_patient' | 'canceled_by_patient';
  // Separado do "status" de agendamento — só é preenchido DEPOIS que a data
  // da consulta já passou, marcado manualmente pelo médico/secretária.
  // É isso que decide se a consulta vira receita de verdade no Financeiro
  // (nunca antes disso, e nunca só por estar "confirmada").
  attendanceStatus?: 'pending' | 'attended' | 'no_show';
}

export interface UserProfile {
  accountType: 'clinic' | 'individual';
  name: string;
  role: string;
  avatarUrl: string;
  clinicName?: string;
  doctorName?: string;
  specialty?: string;
  crm?: string;
  email?: string;
  idToken?: string;
  firstAccess?: boolean;
}

export type SidebarTab = 'overview' | 'chats' | 'calendar' | 'doctors' | 'settings' | 'reports' | 'prontuario' | 'financeiro' | 'alerts' | 'documents';

export interface ClinicAlert {
  id: string;
  type: 'sem_retorno' | 'conversa_parada' | 'documento';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type DocumentCategory = 'geral' | 'contas' | 'convenios' | 'pacientes';
export type DocumentType = 'exame' | 'atestado' | 'receita' | 'convenio' | 'encaminhamento' | 'outro';

export interface ClinicDocument {
  docId: string;
  category: DocumentCategory;
  patientId: string; // vazio quando category !== 'pacientes'
  patientName: string;
  docType: DocumentType;
  filename: string;
  summary: string;
  extractedDate: string;
  alert: string;
  fileUrl: string;
  uploadedAt: string;
}

export type AtendiaPlan = 'starter' | 'profissional' | 'clinica' | 'premium';

export interface SystemLogs {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface PatientProfile {
  id?: string; // patientId (phone normalized)
  name: string;
  phone: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  allergies?: string;
  comorbidities?: string;
  continuousMeds?: string;
  prevSurgeries?: string;
}

export interface ProntuarioEntry {
  id: string; // patientId_timestamp
  patientId: string;
  date: string; // e.g., "12/05/2026"
  doctorName: string;
  specialty: string;
  complaint: string; // queixa/motivo da consulta
  conduct: string; // conduta/observações
  prescription?: string; // prescrição (se houver)
  attachments?: string; // anexos (URL/texto)
  timestamp?: number;
}
