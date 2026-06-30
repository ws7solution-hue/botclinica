import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Sparkles, 
  MessageSquarePlus, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react';
import { SidebarTab, SystemLogs } from '../types';

interface TopbarProps {
  activeTab: SidebarTab;
  whatsappConnected: boolean;
  onToggleWhatsapp: () => void;
  onSimulateIncomingChat: () => void;
  onOpenQuickAppointment: () => void;
  systemLogsCount: number;
  systemLogs?: SystemLogs[];
  onClearLogs?: () => void;
}

export default function Topbar({
  activeTab,
  whatsappConnected,
  onToggleWhatsapp,
  onSimulateIncomingChat,
  onOpenQuickAppointment,
  systemLogsCount,
  systemLogs = [],
  onClearLogs
}: TopbarProps) {
  const [time, setTime] = useState<string>('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Visão Geral do Painel';
      case 'chats':
        return 'Central de Atendimento Chatbot';
      case 'calendar':
        return 'Agenda Médica Integrada';
      case 'doctors':
        return 'Corpo Clínico & Especialistas';
      case 'reports':
        return 'Relatórios & Estatísticas de Conversão';
      case 'settings':
        return 'Configurações do AtendIA';
      default:
        return 'AtendIA BotClínica';
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Acompanhe as taxas de resolução, agendamentos automáticos e fila de transbordo humano.';
      case 'chats':
        return 'Monitore e intervenha nas conversas do chatbot com os pacientes em tempo real.';
      case 'calendar':
        return 'Gerenciamento de consultas agendadas via WhatsApp e confirmação por lembretes.';
      case 'doctors':
        return 'Cadastro de profissionais, agendas de atendimento e controle de convênios.';
      case 'reports':
        return 'Desempenho do bot, taxas de sucesso no agendamento e canais de maior engajamento.';
      case 'settings':
        return 'Configure o tom da IA, a mensagem de saudação inicial e regras de negócios da clínica.';
      default:
        return 'Gestão integrada de WhatsApp Chatbot e Consultas Médicas.';
    }
  };

  return (
    <header 
      id="topbar"
      className="h-[70px] border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-40"
    >
      {/* Title & Description Column */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-slate-800 leading-tight font-sans tracking-tight">
          {getTitle()}
        </h2>
        <p className="text-xs text-slate-500 truncate mt-0.5 font-sans">
          {getSubtitle()}
        </p>
      </div>

      {/* Action / Simulation Controls */}
      <div className="flex items-center gap-3">
        {/* Real-time Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-600 border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time || '19:43'}</span>
        </div>

        {/* Dynamic Simulator Buttons - Styled to look like sleek dashboard actions */}
        <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
          {/* Quick Simulated Message trigger */}
          <button
            id="btn-simulate-message"
            onClick={onSimulateIncomingChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 rounded-lg text-xs font-semibold border border-sky-200/50 transition-all cursor-pointer"
            title="Simular paciente enviando mensagem no WhatsApp"
          >
            <Sparkles className="w-3.5 h-3.5 animate-bounce" />
            <span>Simular Mensagem</span>
          </button>

          {/* Quick Appointment scheduler trigger */}
          <button
            id="btn-quick-appointment"
            onClick={onOpenQuickAppointment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200/50 transition-all cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Marcar Consulta</span>
          </button>
        </div>

        {/* WhatsApp Connection Toggle Button */}
        <button
          id="btn-toggle-whatsapp"
          onClick={onToggleWhatsapp}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
            whatsappConnected 
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500' 
              : 'bg-red-500 hover:bg-red-600 text-white border-red-500'
          }`}
          title={whatsappConnected ? "Clique para desconectar o WhatsApp" : "Clique para conectar o WhatsApp"}
        >
          {whatsappConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden md:inline">WhatsApp Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">WhatsApp Offline</span>
            </>
          )}
        </button>

        {/* Notification Bell with Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-all flex items-center justify-center focus:outline-hidden"
            title="Visualizar notificações do sistema"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            {systemLogsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            )}
            {systemLogsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
              {/* Header */}
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 font-sans">
                  Notificações do Sistema ({systemLogs.length})
                </span>
                {systemLogs.length > 0 && onClearLogs && (
                  <button
                    onClick={() => {
                      onClearLogs();
                      setIsNotificationsOpen(false);
                    }}
                    className="text-[10px] text-red-500 hover:text-red-600 font-semibold cursor-pointer transition-colors"
                  >
                    Limpar todas
                  </button>
                )}
              </div>

              {/* Scrollable list */}
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {systemLogs.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400">
                    <p className="text-[11px] font-medium">Nenhuma notificação nova</p>
                  </div>
                ) : (
                  systemLogs.map((log) => {
                    let IconComponent = Clock;
                    let iconColor = 'text-blue-500 bg-blue-50';
                    if (log.type === 'success') {
                      IconComponent = UserCheck;
                      iconColor = 'text-emerald-500 bg-emerald-50';
                    } else if (log.type === 'warning') {
                      IconComponent = AlertCircle;
                      iconColor = 'text-amber-500 bg-amber-50';
                    } else if (log.type === 'error') {
                      IconComponent = AlertCircle;
                      iconColor = 'text-red-500 bg-red-50';
                    }

                    return (
                      <div key={log.id} className="p-3 hover:bg-slate-50 transition-colors flex gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center h-7 w-7 ${iconColor}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600 font-medium font-sans leading-snug">
                            {log.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                            {log.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
