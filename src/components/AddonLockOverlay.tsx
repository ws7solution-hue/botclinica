import React from 'react';
import { Lock, FileStack, MessageCircle } from 'lucide-react';

interface AddonLockOverlayProps {
  featureName: string;
  price: string;
  description: string;
}

// Diferente do LockOverlay (que trava por PLANO), esse trava por ADD-ON —
// um recurso vendido à parte, disponível pra qualquer plano (inclusive
// Premium) que queira contratar, sem estar incluso automaticamente em
// nenhum. Ainda não existe checkout self-service pra add-on, então o CTA
// leva direto pro WhatsApp de Suporte.
export default function AddonLockOverlay({ featureName, price, description }: AddonLockOverlayProps) {
  return (
    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#1A6FA8]/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

        <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center border border-slate-750 mx-auto shadow-inner mb-6">
          <Lock className="w-7 h-7 text-amber-500" />
        </div>

        <h3 className="text-lg font-bold text-white font-sans flex items-center justify-center gap-2 mb-2">
          <FileStack className="w-4 h-4 text-[#1A6FA8]" />
          <span>{featureName}</span>
        </h3>
        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-mono inline-block mb-4">
          Recurso adicional
        </span>

        <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
          {description}
        </p>

        <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 mb-6 text-left space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">Como funciona:</span>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Esse é um recurso vendido à parte, disponível pra qualquer plano — inclusive o Premium não inclui automaticamente.
          </p>
          <p className="text-[10px] text-slate-400 pt-1">
            Disponível por <span className="text-emerald-400 font-bold">{price}</span>
          </p>
        </div>

        <a
          href="https://wa.me/553191030288?text=Ol%C3%A1!%20Quero%20contratar%20o%20add-on%20de%20Documentos%20por%20IA%20do%20BotCl%C3%ADnica"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Falar com o Suporte pra contratar</span>
        </a>
      </div>
    </div>
  );
}
