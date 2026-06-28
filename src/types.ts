/**
 * Types for the AtendIA SaaS Platform (Medical Clinic WhatsApp Chatbot)
 */

export interface Message {
  id: string;
  sender: 'patient' | 'bot' | 'human';
  text: string;
  timestamp: string; // ISO or HH:MM
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
  messages: Message[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  rating: number;
  avatarUrl: string;
  schedules: string[]; // e.g., 'Seg, Qua 08:00 - 12:00'
  consultationFee: number;
  activePatientsCount: number;
  isActive: boolean;
  attendanceDays: string[]; // ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  startTime: string; // '08:00'
  endTime: string; // '18:00'
  
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
}

export interface UserProfile {
  accountType: 'clinic' | 'individual';
  name: string; // fallback or responsible person name
  role: string; // fallback or role/specialty
  avatarUrl: string;
  clinicName?: string;
  doctorName?: string;
  specialty?: string;
  crm?: string;
}

export type SidebarTab = 'overview' | 'chats' | 'calendar' | 'doctors' | 'settings' | 'reports';

export interface SystemLogs {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}
