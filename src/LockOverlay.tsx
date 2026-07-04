import React from 'react';
import { Lock, Sparkles, ArrowUpRight } from 'lucide-react';

interface LockOverlayProps {
  requiredPlan: 'profissional' | 'clinica' | 'premium';
  featureName: string;
}

export default function LockOverlay({ requiredPlan, featureName }: LockOverlayProps) {
  const planNames: Record<string, string> = {
    profissional: 'Profissional',
    clinica: 'Clínica',
    premium: 'Premium'
  };

  const planPrices: Record<string, string> = {
    profissional: 'R$ 497/mês',
    clinica: 'R$ 897/mês',
    premium: 'R$ 1.497/mês'
  };

  const displayPlanName = planNames[requiredPlan] || requiredPlan;
  const displayPlanPrice = planPrices[requiredPlan] || '';

  return (
    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decorative effect */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#1A6FA8]/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

        {/* Lock badge icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center border border-slate-750 mx-auto shadow-inner mb-6">
          <Lock className="w-7 h-7 text-amber-500 animate-bounce" />
        </div>

        <h3 className="text-lg font-bold text-white font-sans flex items-center justify-center gap-2 mb-2">
          <span>Recurso Bloqueado</span>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-mono">
            {featureName}
          </span>
        </h3>

        <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
          Esta funcionalidade exige o plano <strong className="text-white font-bold">{displayPlanName}</strong> ou superior para ser acessada e utilizada em sua clínica.
        </p>

        {/* Benefit callout */}
        <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 mb-6 text-left space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">Benefício da Assinatura:</span>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1A6FA8] shrink-0" />
            <span className="text-xs font-medium text-slate-200">Acesso ilimitado e imediato a este módulo</span>
          </div>
          {displayPlanPrice && (
            <p className="text-[10px] text-slate-400">
              Disponível por apenas <span className="text-emerald-400 font-bold">{displayPlanPrice}</span>
            </p>
          )}
        </div>

        {/* Action button */}
        <a 
          href="https://botclinica.com.br/checkout" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Fazer upgrade para o {displayPlanName}</span>
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
