import React, { useEffect, useRef } from 'react';
import { PhoneCall, X, MessageCircle } from 'lucide-react';
import { Conversation } from '../types';

interface HumanAlertProps {
  conversations: Conversation[];
  onGoToChat: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function HumanAlert({ conversations, onGoToChat, onDismiss }: HumanAlertProps) {
  const audioRef = useRef<AudioContext | null>(null);
  const pendingChats = conversations.filter(c => c.status === 'human_needed');

  useEffect(() => {
    if (pendingChats.length === 0) return;

    // Som de alerta urgente
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;

      const playBeep = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
      };

      // Toca 3 beeps
      playBeep(ctx.currentTime, 880);
      playBeep(ctx.currentTime + 0.35, 880);
      playBeep(ctx.currentTime + 0.70, 1100);
    } catch (e) {}

    // Notificação do navegador
    // BUGFIX: em alguns navegadores/tablets (principalmente WebViews Android
    // mais antigos), "new Notification(...)" pode lançar um erro mesmo
    // quando "Notification" existe em window — isso derrubava o app inteiro
    // com tela branca no momento exato em que um cliente pedia atendimento.
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('🚨 AtendIA — Atendimento Humano Solicitado!', {
            body: `${pendingChats[0]?.patientName || 'Paciente'} está aguardando você!`,
            icon: '/favicon.ico',
            requireInteraction: true,
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch (e) {
      // Alguns navegadores/tablets não suportam Notification de verdade,
      // mesmo reportando que a API existe. Ignora e segue — o alerta visual
      // na tela e o som já cumprem o papel de avisar o atendente.
    }
  }, [pendingChats.length]);

  if (pendingChats.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-6 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm animate-bounce">
        <div className="bg-red-600 rounded-2xl shadow-2xl border-4 border-red-400 overflow-hidden">
          {/* Header pulsante */}
          <div className="flex items-center gap-3 px-4 py-3 bg-red-700">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 animate-ping absolute" />
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 relative">
              <PhoneCall className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-sm font-sans">🚨 ATENDIMENTO HUMANO!</p>
              <p className="text-red-200 text-xs font-sans">{pendingChats.length} paciente{pendingChats.length > 1 ? 's' : ''} aguardando</p>
            </div>
          </div>

          {/* Lista de pacientes */}
          <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
            {pendingChats.map(chat => (
              <div key={chat.id} className="bg-red-500 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${chat.avatarColor || 'bg-red-400'}`}>
                    {chat.patientName?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xs font-sans truncate">{chat.patientName}</p>
                    <p className="text-red-200 text-[10px] font-sans truncate">{chat.lastMessage}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onGoToChat(chat.id)}
                    className="flex items-center gap-1 bg-white text-red-600 text-[11px] font-black px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-sans"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Atender
                  </button>
                  <button
                    onClick={() => onDismiss(chat.id)}
                    className="w-7 h-7 flex items-center justify-center bg-red-400 hover:bg-red-300 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-red-700 text-center">
            <p className="text-red-200 text-[10px] font-sans">Clique em "Atender" para assumir o controle do chat</p>
          </div>
        </div>
      </div>
    </div>
  );
}
