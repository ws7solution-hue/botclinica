import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageSquare, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Phone, 
  Stethoscope, 
  ChevronRight,
  ShieldAlert,
  Users
} from 'lucide-react';
import { Conversation, Appointment } from '../types';

interface AtendimentosHojeModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  appointments: Appointment[];
  onViewChat: (chatId: string) => void;
  onScheduleNew: () => void;
}

export function AtendimentosHojeModal({
  isOpen,
  onClose,
  conversations,
  appointments,
  onViewChat,
  onScheduleNew
}: AtendimentosHojeModalProps) {
  const [activeTab, setActiveTab] = useState<'chats' | 'appointments'>('chats');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Format today's date for display
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
  const formattedToday = todayDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Today's appointments (filter appointments matching current system date)
  const todayAppointments = appointments.filter(appt => appt.date === todayStr);

  // Search filtered lists
  const filteredConversations = conversations.filter(chat => 
    chat.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAppointments = appointments.filter(appt => 
    appt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appt.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appt.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay with motion */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" 
          onClick={onClose}
        />
        
        {/* Modal content with motion */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#1A6FA8]/10 text-[#1A6FA8] rounded-lg">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800 font-sans">
                  Atendimentos de Hoje
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 capitalize font-sans">
                {formattedToday}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer focus:outline-hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab switches & search bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200 max-w-sm w-full">
                <button
                  onClick={() => {
                    setActiveTab('chats');
                    setSearchTerm('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'chats'
                      ? 'bg-white text-[#1A6FA8] shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chats do WhatsApp ({conversations.length})
                </button>
                <button
                  onClick={() => {
                    setActiveTab('appointments');
                    setSearchTerm('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'appointments'
                      ? 'bg-white text-[#1A6FA8] shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Consultas ({appointments.length})
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative flex-1 max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              </div>
            </div>
          </div>

          {/* List content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'chats' ? (
              filteredConversations.length > 0 ? (
                <div className="space-y-3">
                  {filteredConversations.map((chat) => (
                    <div 
                      key={chat.id}
                      onClick={() => {
                        onViewChat(chat.id);
                        onClose();
                      }}
                      className="p-4 bg-white border border-slate-150 rounded-xl hover:border-[#1A6FA8] hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${chat.avatarColor}`}>
                          {chat.patientName.charAt(0)}
                        </div>
                        {/* Information */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 truncate font-sans">
                              {chat.patientName}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-medium">
                              {chat.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-1.5 font-sans italic">
                            "{chat.lastMessage}"
                          </p>
                        </div>
                      </div>

                      {/* Status and Action */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          chat.status === 'human_needed' 
                            ? 'bg-amber-100 text-amber-800 font-bold animate-pulse'
                            : chat.status === 'human_active'
                            ? 'bg-blue-100 text-blue-800'
                            : chat.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {chat.status === 'human_needed' ? 'Transbordo Humano' : 
                           chat.status === 'human_active' ? 'Atend. Humano' : 
                           chat.status === 'resolved' ? 'Resolvido Bot' : 'Com o Bot'}
                        </span>
                        
                        <div className="text-xs font-bold text-[#1A6FA8] flex items-center gap-1 group">
                          <span>Acessar</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-sans">Nenhuma conversa encontrada na pesquisa.</p>
                </div>
              )
            ) : (
              /* Appointments list tab */
              <div className="space-y-4">
                {/* Highlight/Notice about Today's date filter */}
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-600 font-sans">
                    Exibindo todos os agendamentos registrados no sistema.
                  </span>
                  <button 
                    onClick={() => {
                      onScheduleNew();
                      onClose();
                    }}
                    className="text-xs font-bold text-[#1A6FA8] hover:text-[#135480] bg-white border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    + Agendar Novo
                  </button>
                </div>

                {filteredAppointments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredAppointments.map((appt) => {
                      // Format appointment date for presentation
                      const [year, month, day] = appt.date.split('-');
                      const apptDateFormatted = `${day}/${month}/${year}`;
                      const isToday = appt.date === todayStr;

                      return (
                        <div 
                          key={appt.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 bg-white ${
                            isToday ? 'border-[#1A6FA8] ring-1 ring-blue-100/50' : 'border-slate-200/85'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 font-sans flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {appt.patientName}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-bold bg-[#1A6FA8] text-white px-1.5 py-0.5 rounded-md uppercase font-sans tracking-wide">
                                  Hoje
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 space-y-1 font-sans">
                              <div className="flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-[#1A6FA8]/80 shrink-0" />
                                <span>{appt.doctorName} ({appt.specialty})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{apptDateFormatted} às <strong>{appt.time}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                              appt.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {appt.status === 'confirmed' ? 'Confirmado' :
                               appt.status === 'pending' ? 'Pendente' : 'Cancelado'}
                            </span>

                            <span className="text-[10px] font-mono text-slate-400">
                              {appt.patientPhone}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-3">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-sans">Nenhum agendamento encontrado.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors focus:outline-hidden"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* =========================================================================
   AwaitingHumanModal Component
   ========================================================================= */

interface AwaitingHumanModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onTakeAction: (chatId: string) => void;
}

export function AwaitingHumanModal({
  isOpen,
  onClose,
  conversations,
  onTakeAction
}: AwaitingHumanModalProps) {
  if (!isOpen) return null;

  // Filter conversations that are waiting for human intervention
  const awaitingChats = conversations.filter(chat => chat.status === 'human_needed');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" 
          onClick={onClose}
        />
        
        {/* Modal content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg animate-pulse">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-sans">
                  Aguardando Atendimento Humano
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Fila de transbordo: conversas que solicitaram auxílio ou secretária.
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer focus:outline-hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto p-5">
            {awaitingChats.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 font-sans flex items-center gap-1">
                  <Users className="w-4 h-4 text-slate-400" />
                  Há {awaitingChats.length} paciente(s) na fila de transbordo:
                </p>

                <div className="space-y-3">
                  {awaitingChats.map((chat) => (
                    <div 
                      key={chat.id}
                      className="p-4 bg-slate-50 hover:bg-white rounded-xl border border-slate-200/80 hover:border-amber-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Avatar initials */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${chat.avatarColor}`}>
                          {chat.patientName.charAt(0)}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 font-sans">{chat.patientName}</span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                              Pendente
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-700 font-sans mt-1.5 font-medium">
                            Última mensagem:
                          </p>
                          <p className="text-xs text-slate-500 italic font-sans bg-white p-2 rounded-lg border border-slate-100 mt-1">
                            "{chat.lastMessage}"
                          </p>

                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                            <span>Tel: {chat.patientPhone}</span>
                            <span>•</span>
                            <span>Aguardando às {chat.lastMessageTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => {
                          onTakeAction(chat.id);
                          onClose();
                        }}
                        className="w-full sm:w-auto self-stretch sm:self-center px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-hidden"
                      >
                        <span>Assumir Atendimento</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 animate-bounce" />
                <h4 className="text-sm font-bold text-slate-700 font-sans">Fila de transbordo limpa!</h4>
                <p className="text-xs font-sans max-w-xs mx-auto">
                  Excelente! Todas as conversas estão sendo geridas pelo assistente inteligente AtendIA no momento.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors focus:outline-hidden"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
