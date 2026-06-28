import React, { useState, useEffect } from 'react';
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
import { SidebarTab } from '../types';

interface TopbarProps {
  activeTab: SidebarTab;
  whatsappConnected: boolean;
  onToggleWhatsapp: () => void;
  onSimulateIncomingChat: () => void;
  onOpenQuickAppointment: () => void;
  systemLogsCount: number;
}

export default function Topbar({
  activeTab,
  whatsappConnected,
  onToggleWhatsapp,
  onSimulateIncomingChat,
  onOpenQuickAppointment,
  systemLogsCount
}: TopbarProps) {
  const [time, setTime] = useState<string>('');

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

        {/* Notification Bell */}
        <div className="relative cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-all">
          <Bell className="w-4 h-4 text-slate-600" />
          {systemLogsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </div>
      </div>
    </header>
  );
}
