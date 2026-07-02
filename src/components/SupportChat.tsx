import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronDown, Plus } from 'lucide-react';
import { AtendiaPlan } from '../types';

interface SupportChatProps {
  email: string;
  clinicName: string;
  currentPlan: AtendiaPlan;
}

interface Message {
  role: 'client' | 'agent';
  text: string;
  at: string;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// Planos que têm acesso ao chat de suporte
const SUPPORT_PLANS: AtendiaPlan[] = ['profissional', 'clinica', 'premium'];

export default function SupportChat({ email, clinicName, currentPlan }: SupportChatProps) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [view, setView] = useState<'list' | 'chat' | 'new'>('list');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasSupport = SUPPORT_PLANS.includes(currentPlan);

  useEffect(() => {
    if (!open || !hasSupport) return;
    loadTickets();
    const interval = setInterval(loadTickets, 8000);
    return () => clearInterval(interval);
  }, [open, email]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages]);

  // Poll pra notificar novas mensagens mesmo com chat fechado
  useEffect(() => {
    if (!hasSupport || !email) return;
    const interval = setInterval(async () => {
      const d = await callApi('getSupportTickets', { email });
      const total = (d.tickets || []).reduce((s: number, t: Ticket) =>
        s + t.messages.filter(m => m.role === 'agent').length, 0
      );
      setUnread(prev => total > prev ? total : prev);
    }, 30000);
    return () => clearInterval(interval);
  }, [email, hasSupport]);

  async function callApi(action: string, payload: any) {
    const r = await fetch('/api/fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    return r.json();
  }

  async function loadTickets() {
    const d = await callApi('getSupportTickets', { email });
    const t = d.tickets || [];
    setTickets(t);
    // Atualiza ticket ativo se estiver aberto
    if (activeTicket) {
      const updated = t.find((x: Ticket) => x.id === activeTicket.id);
      if (updated) setActiveTicket(updated);
    }
  }

  async function createTicket() {
    if (!newTicketTitle.trim()) return;
    setLoading(true);
    await callApi('createSupportTicket', {
      email, clinicName, plano: currentPlan,
      title: newTicketTitle.trim(),
      message: newTicketTitle.trim(),
    });
    setNewTicketTitle('');
    await loadTickets();
    setView('list');
    setLoading(false);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeTicket) return;
    const msg: Message = { role: 'client', text: newMessage.trim(), at: new Date().toISOString() };
    setNewMessage('');
    // Otimistic update
    setActiveTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
    await callApi('addSupportMessage', { ticketId: activeTicket.id, message: msg });
    await loadTickets();
  }

  function fmtTime(s: string) {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  if (!hasSupport) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-14 h-14 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-full shadow-2xl flex items-center justify-center transition-all"
          title="Suporte"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        {open && (
          <div className="absolute bottom-16 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 text-center">
            <div className="text-2xl mb-2">🔒</div>
            <p className="text-sm font-bold text-slate-800 font-sans mb-1">Chat de suporte</p>
            <p className="text-xs text-slate-500 font-sans mb-3">Disponível nos planos Profissional, Clínica e Premium.</p>
            <p className="text-xs text-slate-400 font-sans">Para suporte no plano Starter, envie e-mail para <a href="mailto:contato@botclinica.com.br" className="text-[#1A6FA8] font-semibold">contato@botclinica.com.br</a></p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Botão flutuante */}
      <button
        onClick={() => { setOpen(v => !v); setUnread(0); }}
        className="w-14 h-14 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-full shadow-2xl flex items-center justify-center transition-all relative"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: '480px' }}>

          {/* Header */}
          <div className="bg-[#1A6FA8] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-white font-bold text-sm font-sans">Suporte BotClínica</p>
                <p className="text-blue-200 text-xs font-sans">Respondemos em até 2h</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Lista de tickets */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 font-sans uppercase tracking-wider">Seus chamados</p>
                <button
                  onClick={() => setView('new')}
                  className="flex items-center gap-1 text-xs text-[#1A6FA8] font-bold font-sans hover:underline"
                >
                  <Plus className="w-3 h-3" /> Novo
                </button>
              </div>
              {tickets.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-3xl mb-2">💬</div>
                  <p className="text-sm font-bold text-slate-700 font-sans mb-1">Nenhum chamado ainda</p>
                  <p className="text-xs text-slate-500 font-sans mb-3">Abra um chamado e nossa equipe responde em até 2h.</p>
                  <button
                    onClick={() => setView('new')}
                    className="bg-[#1A6FA8] text-white text-xs font-bold px-4 py-2 rounded-lg font-sans"
                  >
                    Abrir chamado
                  </button>
                </div>
              ) : (
                tickets.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setActiveTicket(t); setView('chat'); }}
                    className="px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-800 font-sans truncate flex-1">{t.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${
                        t.status === 'resolvido' ? 'bg-emerald-100 text-emerald-700' :
                        t.status === 'andamento' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {t.status === 'resolvido' ? 'Resolvido' : t.status === 'andamento' ? 'Em andamento' : 'Aberto'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-sans truncate">
                      {t.messages[t.messages.length - 1]?.text || 'Aguardando resposta...'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-sans mt-1">{fmtTime(t.updatedAt || t.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Novo chamado */}
          {view === 'new' && (
            <div className="flex-1 flex flex-col p-4">
              <button onClick={() => setView('list')} className="text-xs text-[#1A6FA8] font-sans mb-4 text-left">← Voltar</button>
              <p className="text-sm font-bold text-slate-800 font-sans mb-1">Abrir novo chamado</p>
              <p className="text-xs text-slate-500 font-sans mb-4">Descreva o problema e nossa equipe responde em até 2h.</p>
              <textarea
                value={newTicketTitle}
                onChange={e => setNewTicketTitle(e.target.value)}
                placeholder="Descreva seu problema ou dúvida..."
                className="flex-1 text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A6FA8] font-sans resize-none"
                rows={5}
              />
              <button
                onClick={createTicket}
                disabled={loading || !newTicketTitle.trim()}
                className="mt-3 w-full py-2.5 bg-[#1A6FA8] hover:bg-[#135480] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors font-sans"
              >
                {loading ? 'Enviando...' : 'Enviar chamado →'}
              </button>
            </div>
          )}

          {/* Chat */}
          {view === 'chat' && activeTicket && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <p className="text-xs font-bold text-slate-700 font-sans truncate flex-1">{activeTicket.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTicket.status === 'resolvido' ? 'bg-emerald-100 text-emerald-700' :
                  activeTicket.status === 'andamento' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {activeTicket.status === 'resolvido' ? 'Resolvido' : activeTicket.status === 'andamento' ? 'Em andamento' : 'Aberto'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {activeTicket.messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'agent' ? 'items-start' : 'items-end'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs font-sans leading-relaxed ${
                      m.role === 'agent'
                        ? 'bg-slate-100 text-slate-800 rounded-tl-none'
                        : 'bg-[#1A6FA8] text-white rounded-tr-none'
                    }`}>
                      {m.text}
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 px-1">
                      {m.role === 'agent' ? '🤖 Suporte' : 'Você'} · {fmtTime(m.at)}
                    </p>
                  </div>
                ))}
                {activeTicket.messages.length === 0 && (
                  <p className="text-xs text-center text-slate-400 font-sans mt-4">Aguardando resposta da nossa equipe...</p>
                )}
                <div ref={messagesEndRef} />
              </div>
              {activeTicket.status !== 'resolvido' && (
                <div className="p-3 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A6FA8] font-sans"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="w-8 h-8 bg-[#1A6FA8] disabled:opacity-50 text-white rounded-lg flex items-center justify-center"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}
              {activeTicket.status === 'resolvido' && (
                <div className="p-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-emerald-600 font-sans font-bold">✅ Chamado resolvido</p>
                  <button onClick={() => setView('new')} className="text-xs text-[#1A6FA8] font-sans mt-1 hover:underline">Abrir novo chamado</button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {view === 'list' && (
            <div className="px-4 py-2 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-sans">Suporte disponível 24h · Resposta em até 2h</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
