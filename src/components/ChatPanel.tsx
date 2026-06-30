import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldAlert,
  ArrowRight,
  Phone,
  FileText,
  Bookmark,
  Sparkles,
  CalendarCheck,
  UserCheck
} from 'lucide-react';
import { Conversation, Message, Doctor } from '../types';

// React class ErrorBoundary to prevent media message parsing or rendering errors from crashing the page
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  public state: { hasError: boolean } = { hasError: false };
  public props!: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-red-805 text-xs font-sans flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>Erro ao carregar esta mensagem (formato de mídia ou texto inválido).</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper to render message content based on type (text, image, audio, document)
const renderMessageContent = (msg: Message) => {
  const msgType = msg.type || 'text';
  
  // Guard: Ensure text is safely stringified or set to empty if it's an object or null/undefined
  let displayText = '';
  if (msg.text !== undefined && msg.text !== null) {
    if (typeof msg.text === 'string') {
      displayText = msg.text;
    } else if (typeof msg.text === 'object') {
      displayText = (msg.text as any).caption || (msg.text as any).text || JSON.stringify(msg.text);
    } else {
      displayText = String(msg.text);
    }
  }

  switch (msgType) {
    case 'image':
      return (
        <div className="space-y-1.5 max-w-full">
          {msg.mediaUrl ? (
            <img 
              src={msg.mediaUrl} 
              alt={displayText || "Imagem recebida"} 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[220px] rounded-lg object-cover border border-slate-200/60 shadow-xs"
              onError={(e) => {
                // Fallback image URL
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594322436404-5a0526db4d13?q=80&w=200&auto=format&fit=crop';
              }}
            />
          ) : (
            <div className="flex items-center gap-2 text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-dashed border-slate-300">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px]">Imagem indisponível</span>
            </div>
          )}
          {displayText && <p className="text-[11.5px] mt-1 leading-relaxed">{displayText}</p>}
        </div>
      );
    case 'audio':
      return (
        <div className="space-y-1.5 min-w-[200px] max-w-full">
          {msg.mediaUrl ? (
            <audio controls src={msg.mediaUrl} className="w-full max-h-9 mt-1 focus:outline-hidden">
              Seu navegador não suporta áudio.
            </audio>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-dashed border-slate-300">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px]">Áudio indisponível</span>
            </div>
          )}
          {displayText && <p className="text-[11px] opacity-90 mt-1 leading-relaxed">{displayText}</p>}
        </div>
      );
    case 'document':
      return (
        <div className="space-y-1.5 max-w-full">
          {msg.mediaUrl ? (
            <a 
              href={msg.mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-blue-600 font-semibold"
            >
              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="underline truncate max-w-[160px] text-xs">
                {displayText || 'Visualizar Documento'}
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-dashed border-slate-300">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px]">Documento indisponível</span>
            </div>
          )}
          {displayText && msg.mediaUrl && <p className="text-[11px] leading-relaxed mt-1">{displayText}</p>}
        </div>
      );
    case 'text':
    default:
      return <span className="block leading-relaxed">{displayText}</span>;
  }
};

interface ChatPanelProps {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  doctors: Doctor[];
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  onOpenQuickAppointmentWithPatient: (patientName: string, patientPhone: string) => void;
}

export default function ChatPanel({
  conversations,
  setConversations,
  doctors,
  selectedChatId,
  setSelectedChatId,
  onAddSystemLog,
  onOpenQuickAppointmentWithPatient
}: ChatPanelProps) {
  const [filter, setFilter] = useState<'all' | 'bot' | 'human_needed' | 'human_active' | 'resolved'>('all');
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically select first conversation if none is selected
  useEffect(() => {
    if (!selectedChatId && conversations.length > 0) {
      setSelectedChatId(conversations[0].id);
    }
  }, [selectedChatId, conversations, setSelectedChatId]);

  const activeChat = conversations.find(c => c.id === selectedChatId) || conversations[0];

  // Scroll to bottom of message list on update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages]);

  // Handle switching chat
  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    // Mark as read
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
  };

  // Handle human intervention
  const handleTakeOver = (chatId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          status: 'human_active',
          messages: [
            ...c.messages,
            {
              id: `sys-${Date.now()}`,
              sender: 'bot',
              text: '⚠️ O chatbot foi pausado. Um atendente humano assumiu o controle deste chat.',
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return c;
    }));
    onAddSystemLog('warning', `Atendente assumiu atendimento de ${activeChat?.patientName || 'Paciente'}.`);
  };

  // Handle returning conversation to bot
  const handleReturnToBot = (chatId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          status: 'bot',
          messages: [
            ...c.messages,
            {
              id: `sys-${Date.now()}`,
              sender: 'bot',
              text: '🤖 Chatbot AtendIA reativado com sucesso.',
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return c;
    }));
    onAddSystemLog('info', `Atendimento de ${activeChat?.patientName} devolvido para o chatbot.`);
  };

  // Mark conversation as resolved
  const handleMarkResolved = (chatId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          status: 'resolved',
          messages: [
            ...c.messages,
            {
              id: `sys-${Date.now()}`,
              sender: 'bot',
              text: '✅ Atendimento encerrado e marcado como resolvido.',
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return c;
    }));
    onAddSystemLog('success', `Atendimento de ${activeChat?.patientName} marcado como RESOLVIDO.`);
  };

  // Send message as human
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeChat) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'human',
      text: replyText.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const currentChatId = activeChat.id;
    const currentPatientName = activeChat.patientName;

    // Update conversation message stream
    setConversations(prev => prev.map(c => {
      if (c.id === currentChatId) {
        return {
          ...c,
          lastMessage: replyText.trim(),
          lastMessageTime: newMsg.timestamp,
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    setReplyText('');

    // Simulate automatic patient response after 2 seconds
    setTimeout(() => {
      const patientResponses = [
        "Muito obrigado pela resposta! Certo, combinado.",
        "Excelente. Vou enviar os documentos hoje à tarde.",
        "Perfeito, farei isso. Obrigado pela ajuda!",
        "Ok, entendi. No dia do exame eu aviso na recepção então.",
        "Maravilha, vou me programar."
      ];
      const randomReply = patientResponses[Math.floor(Math.random() * patientResponses.length)];

      const patientMsg: Message = {
        id: `msg-sim-${Date.now()}`,
        sender: 'patient',
        text: randomReply,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setConversations(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return {
            ...c,
            lastMessage: randomReply,
            lastMessageTime: patientMsg.timestamp,
            unreadCount: c.id !== selectedChatId ? c.unreadCount + 1 : 0,
            messages: [...c.messages, patientMsg]
          };
        }
        return c;
      }));

      onAddSystemLog('info', `Simulação: Paciente ${currentPatientName} respondeu no chat.`);
    }, 2000);
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div id="chat-panel" className="flex h-[calc(100vh-70px)] bg-slate-100 overflow-hidden">
      
      {/* 1. Left Sidebar: Conversation Queue */}
      <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
        
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800 font-sans mb-3">
            Fila de Atendimento
          </h3>
          
          {/* Quick Filter tabs */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'bot', label: 'Robô' },
              { id: 'human_needed', label: 'Transbordo' },
              { id: 'human_active', label: 'Humano' },
              { id: 'resolved', label: 'Resolvidos' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  filter === tab.id 
                    ? 'bg-[#1A6FA8] text-white shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-all ${
                  selectedChatId === chat.id 
                    ? 'bg-blue-50/70 border-l-4 border-[#1A6FA8]' 
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                {/* Initials avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${chat.avatarColor}`}>
                  {chat.patientName.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 truncate font-sans">
                      {chat.patientName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {chat.lastMessageTime}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate mt-1 font-sans">
                    {chat.lastMessage}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      chat.status === 'human_needed' 
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : chat.status === 'human_active'
                        ? 'bg-blue-100 text-blue-800'
                        : chat.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {chat.status === 'human_needed' ? '🚨 Transbordo' : 
                       chat.status === 'human_active' ? '👤 Humano Ativo' : 
                       chat.status === 'resolved' ? '✅ Resolvido' : '🤖 IA Bot'}
                    </span>

                    {chat.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 font-sans text-xs">
              Nenhuma conversa nesta categoria.
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle Area: Active Chat Stream */}
      {activeChat ? (
        <div className="flex-1 flex flex-col h-full bg-[#FAFBFD]">
          
          {/* Chat Panel Header / Status Banner */}
          <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold ${activeChat.avatarColor}`}>
                {activeChat.patientName.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-sans leading-snug">
                  {activeChat.patientName}
                </h4>
                <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {activeChat.patientPhone}
                </p>
              </div>
            </div>

            {/* Quick action triggers */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenQuickAppointmentWithPatient(activeChat.patientName, activeChat.patientPhone)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold border border-emerald-200/50 cursor-pointer"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Agendar Consulta</span>
              </button>
            </div>
          </div>

          {/* Status Alert Banner */}
          <div className={`px-4 py-2 border-b text-xs font-medium flex items-center justify-between font-sans ${
            activeChat.status === 'human_needed' 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : activeChat.status === 'human_active'
              ? 'bg-blue-50 text-blue-800 border-blue-100'
              : activeChat.status === 'resolved'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : 'bg-slate-50 text-slate-600 border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              {activeChat.status === 'bot' && (
                <>
                  <Bot className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Este paciente está conversando com a inteligência artificial <strong className="font-semibold">AtendIA Bot</strong>.</span>
                </>
              )}
              {activeChat.status === 'human_needed' && (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
                  <span>O paciente solicitou falar com um humano ou necessita de aprovação manual.</span>
                </>
              )}
              {activeChat.status === 'human_active' && (
                <>
                  <UserCheck className="w-4 h-4 text-[#1A6FA8] shrink-0" />
                  <span>Você está no comando do atendimento. O chatbot automático está desativado.</span>
                </>
              )}
              {activeChat.status === 'resolved' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Atendimento marcado como concluído.</span>
                </>
              )}
            </div>

            {/* Banner action buttons */}
            <div className="flex gap-1.5">
              {activeChat.status === 'bot' && (
                <button
                  onClick={() => handleTakeOver(activeChat.id)}
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-bold cursor-pointer"
                >
                  Intervir (Pausar Bot)
                </button>
              )}
              {activeChat.status === 'human_needed' && (
                <button
                  onClick={() => handleTakeOver(activeChat.id)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold animate-pulse cursor-pointer"
                >
                  Assumir Conversa
                </button>
              )}
              {activeChat.status === 'human_active' && (
                <>
                  <button
                    onClick={() => handleReturnToBot(activeChat.id)}
                    className="px-2 py-0.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold cursor-pointer"
                  >
                    Devolver pro Bot
                  </button>
                  <button
                    onClick={() => handleMarkResolved(activeChat.id)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer"
                  >
                    Marcar Resolvido
                  </button>
                </>
              )}
              {activeChat.status === 'resolved' && (
                <button
                  onClick={() => handleReturnToBot(activeChat.id)}
                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-[10px] font-semibold cursor-pointer"
                >
                  Reabrir para Bot
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f3f5f8]">
            {activeChat.messages.map((msg) => {
              const isPatient = msg.sender === 'patient';
              const isBot = msg.sender === 'bot';
              const isHuman = msg.sender === 'human';

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col max-w-[70%] ${
                    isPatient ? 'mr-auto items-start' : 'ml-auto items-end'
                  }`}
                >
                  {/* Sender label tag */}
                  <span className="text-[9px] font-mono text-slate-400 mb-0.5 px-1 flex items-center gap-1">
                    {isPatient && <User className="w-2.5 h-2.5 text-indigo-500" />}
                    {isBot && <Bot className="w-2.5 h-2.5 text-[#1A6FA8]" />}
                    {isHuman && <UserCheck className="w-2.5 h-2.5 text-amber-500" />}
                    {isPatient ? 'Paciente' : isBot ? 'AtendIA Bot' : 'Secretária (Humano)'}
                  </span>

                  {/* Message Bubble */}
                  <div className={`p-3 rounded-xl shadow-xs text-xs font-sans whitespace-pre-wrap ${
                    isPatient 
                      ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200' 
                      : isBot 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-emerald-600 text-white rounded-tr-none'
                  }`}>
                    <ErrorBoundary>
                      {renderMessageContent(msg)}
                    </ErrorBoundary>
                  </div>

                  {/* Timestamp */}
                  <span className="text-[9px] text-slate-400 mt-0.5 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Typing Bar */}
          <div className="p-4 bg-white border-t border-slate-200">
            {activeChat.status === 'human_active' ? (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  id="chat-input-field"
                  type="text"
                  placeholder={`Responda para ${activeChat.patientName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
                />
                <button
                  id="chat-send-btn"
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center text-xs text-slate-500 font-sans flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>O chat automático está ativo. Para digitar, clique em <strong className="font-semibold text-slate-700">"Intervir (Pausar Bot)"</strong> no topo.</span>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
          <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-sans">Selecione uma conversa ao lado para visualizar</p>
        </div>
      )}

      {/* 3. Right Sidebar: Patient Bio Details & Active Referral */}
      {activeChat && (
        <div className="w-[240px] bg-white border-l border-slate-200 p-4 space-y-4 hidden xl:block overflow-y-auto h-full shrink-0">
          <div className="text-center pb-4 border-b border-slate-100">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans mb-3">
              Ficha do Paciente
            </h5>
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-extrabold text-base mb-2 ${activeChat.avatarColor}`}>
              {activeChat.patientName.charAt(0)}
            </div>
            <h4 className="text-sm font-bold text-slate-800 font-sans">
              {activeChat.patientName}
            </h4>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono mt-1 inline-block">
              {activeChat.category}
            </span>
          </div>

          {/* Quick Info list */}
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Telefone</span>
              <span className="text-slate-700 font-mono font-medium">{activeChat.patientPhone}</span>
            </div>

            <div>
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Doutor Indicado</span>
              <span className="text-slate-700 font-sans font-medium">
                {doctors.find(d => d.id === activeChat.assignedDoctorId)?.name || 'Nenhum / Triagem Inicial'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Especialidade Pretendida</span>
              <span className="text-slate-700 font-sans font-medium">
                {doctors.find(d => d.id === activeChat.assignedDoctorId)?.specialty || 'Clínica Geral / Outros'}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              Notas de Recepção
            </h5>
            <textarea
              placeholder="Adicione observações internas sobre o paciente que ficarão salvas na ficha..."
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden min-h-[80px] font-sans"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Apenas visível para a clínica</span>
              <Bookmark className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
