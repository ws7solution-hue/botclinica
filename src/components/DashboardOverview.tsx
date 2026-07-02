import React, { useState } from 'react';
import { 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Send, 
  QrCode, 
  Smartphone, 
  AlertTriangle,
  Server,
  ArrowRight,
  Database,
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Conversation, Appointment, SystemLogs, SidebarTab, AtendiaPlan } from '../types';
import { AtendimentosHojeModal, AwaitingHumanModal } from './DashboardModals';

interface DashboardOverviewProps {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  appointments: Appointment[];
  systemLogs: SystemLogs[];
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  whatsappConnected: boolean;
  onToggleWhatsapp: () => void;
  setActiveTab: (tab: SidebarTab) => void;
  setSelectedChatId: (id: string | null) => void;
  onClearLogs: () => void;
  setQuickAddOpen?: (open: boolean) => void;
  currentPlan: AtendiaPlan;
}

export default function DashboardOverview({
  conversations,
  setConversations,
  appointments,
  systemLogs,
  onAddSystemLog,
  whatsappConnected,
  onToggleWhatsapp,
  setActiveTab,
  setSelectedChatId,
  onClearLogs,
  setQuickAddOpen,
  currentPlan
}: DashboardOverviewProps) {
  // Modal open states
  const [isTodayModalOpen, setIsTodayModalOpen] = useState(false);
  const [isAwaitingModalOpen, setIsAwaitingModalOpen] = useState(false);
  
  // Dynamic metrics calculations
  const isDemo = (localStorage.getItem('atendia_email') || '').trim().toLowerCase() === 'contato@botclinica.com.br';

  const totalConversations = conversations.length + (isDemo ? 18 : 0); // Base baseline (only for demo) + current list length
  const resolvedByBotCount = conversations.filter(c => c.status === 'resolved').length + (isDemo ? 12 : 0);
  const awaitingHumanCount = conversations.filter(c => c.status === 'human_needed').length;
  const remindersSentCount = appointments.filter(a => a.reminderSent).length + (isDemo ? 38 : 0);

  // Percentage resolution rate
  const resolutionRate = totalConversations > 0 ? Math.round((resolvedByBotCount / totalConversations) * 100) : 0;

  const viewChat = (id: string) => {
    setSelectedChatId(id);
    setActiveTab('chats');
  };

  return (
    <div id="dashboard-overview" className="p-6 space-y-6">
      
      {/* 4 KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Atendimentos hoje */}
        <div 
          id="kpi-total-chats" 
          onClick={() => setIsTodayModalOpen(true)}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-[#1A6FA8] hover:shadow-md hover:scale-[1.01] transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Atendimentos Hoje
            </span>
            <div className="p-2 bg-blue-50 text-[#1A6FA8] rounded-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
              {totalConversations}
            </span>
            {totalConversations > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {isDemo ? '+14% vs ontem' : 'Ativo'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-sans">
            Fluxo ativo nas últimas 24 horas
          </p>
        </div>

        {/* KPI 2: Resolvidos pelo bot */}
        <div id="kpi-resolved" className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Resolvidos pelo Bot
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
              {resolvedByBotCount}
            </span>
            {totalConversations > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {resolutionRate}% taxa
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-sans">
            Sem intervenção de secretárias
          </p>
        </div>

        {/* KPI 3: Aguardando humano */}
        <div 
          id="kpi-awaiting" 
          onClick={() => setIsAwaitingModalOpen(true)}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-md hover:scale-[1.01] transition-all duration-300 relative overflow-hidden cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Aguardando Humano
            </span>
            <div className={`p-2 rounded-lg ${awaitingHumanCount > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold tracking-tight font-sans ${awaitingHumanCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {awaitingHumanCount}
            </span>
            {awaitingHumanCount > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                Urgente
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-sans">
            Fila de transbordo (atendentes)
          </p>
          {awaitingHumanCount > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
          )}
        </div>

        {/* KPI 4: Lembretes enviados */}
        <div id="kpi-reminders" className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Lembretes Enviados
            </span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
              {remindersSentCount}
            </span>
            {remindersSentCount > 0 && (
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                {isDemo ? '96% confirmado' : 'Confirmado'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-sans">
            Confirmação automática de agenda
          </p>
        </div>

      </div>

      {/* Main Grid Content (System status + Recent Conversations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Recent Chats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 font-sans">
                  Fila de Conversas Recentes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Últimos contatos triados ou aguardando resposta humana.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('chats')}
                className="text-xs font-bold text-[#1A6FA8] hover:text-[#135480] flex items-center gap-1 cursor-pointer"
              >
                <span>Ver Todos os Chats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {conversations.slice(0, 4).map((chat) => (
                <div 
                  key={chat.id}
                  onClick={() => viewChat(chat.id)}
                  className="p-4 hover:bg-slate-50/75 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${chat.avatarColor}`}>
                      {chat.patientName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate font-sans">
                          {chat.patientName}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-medium">
                          {chat.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-1 font-sans">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">
                      {chat.lastMessageTime}
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right 1 Column: System Status Panel */}
        <div className="space-y-6">
          
          {/* Quick Stats Grid */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-800 font-sans">
              Status Operacional
            </h4>
            
            <div className="space-y-3">
              {/* Service 1 */}
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 font-sans">Servidor API Gateway</span>
                </div>
                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm">Online</span>
              </div>

              {/* Service 2 */}
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 font-sans">Fila de Agendamento</span>
                </div>
                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm">Sincronizado</span>
              </div>

              {/* Service 3 */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 font-sans">IA Triagem Médica</span>
                </div>
                <span className="text-[#1A6FA8] font-bold bg-blue-50 px-2 py-0.5 rounded-sm">Pronto</span>
              </div>
            </div>
          </div>

          {/* Real-time System Logs Panel */}
          <div className="bg-[#0F1623] text-slate-300 p-5 rounded-xl shadow-xs border border-slate-850">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Log do Sistema AtendIA
                </h4>
              </div>
              <button 
                onClick={onClearLogs}
                className="text-[10px] text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                Limpar Logs
              </button>
            </div>

            <div className="space-y-3 font-mono text-[11px] leading-relaxed max-h-[220px] overflow-y-auto pr-1">
              {systemLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-800/40 pb-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>{log.timestamp}</span>
                    <span className={`text-[10px] ${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'warning' ? 'text-amber-400' :
                      log.type === 'error' ? 'text-red-400' : 'text-sky-400'
                    }`}>
                      [{log.type.toUpperCase()}]
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 font-sans">{log.message}</p>
                </div>
              ))}
              {systemLogs.length === 0 && (
                <p className="text-slate-600 text-center py-4">Nenhum log operacional recente.</p>
              )}
            </div>
          </div>

          {/* Quick Tip / Clinic Highlight */}
          <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl text-sky-800 text-xs">
            <h5 className="font-bold flex items-center gap-1.5 font-sans mb-1 text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              Dica de Otimização
            </h5>
            <p className="font-sans leading-relaxed">
              {isDemo ? (
                <>O chatbot AtendIA resolveu <strong className="font-semibold text-sky-950">64% das solicitações</strong> de hoje automaticamente. Você pode cadastrar mais horários para Dra. Sandra para suprir a alta demanda de ginecologia.</>
              ) : (
                <>O chatbot AtendIA está <strong className="font-semibold text-sky-950">ativo e pronto</strong> para automatizar sua clínica. Conforme novos pacientes entrarem em contato pelo WhatsApp, a IA os guiará e preencherá as estatísticas automaticamente!</>
              )}
            </p>
          </div>

        </div>

      </div>

      {/* Today's Conversations & Appointments Pop-up */}
      <AtendimentosHojeModal
        isOpen={isTodayModalOpen}
        onClose={() => setIsTodayModalOpen(false)}
        conversations={conversations}
        appointments={appointments}
        onViewChat={(chatId) => {
          setSelectedChatId(chatId);
          setActiveTab('chats');
        }}
        onScheduleNew={() => {
          setActiveTab('calendar');
          if (setQuickAddOpen) {
            setQuickAddOpen(true);
          }
        }}
      />

      {/* Waiting for Human support Pop-up */}
      <AwaitingHumanModal
        isOpen={isAwaitingModalOpen}
        onClose={() => setIsAwaitingModalOpen(false)}
        conversations={conversations}
        onTakeAction={(chatId) => {
          // Update status to human_active
          setConversations(prev => prev.map(c => {
            if (c.id === chatId) {
              onAddSystemLog('success', `Atendimento de ${c.patientName} assumido e migrado para o modo humano.`);
              return {
                ...c,
                status: 'human_active' as const
              };
            }
            return c;
          }));
          // Open chat and transition
          setSelectedChatId(chatId);
          setActiveTab('chats');
        }}
      />

    </div>
  );
}
