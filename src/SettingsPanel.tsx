import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Sparkles, 
  Bot, 
  Smartphone, 
  FileText, 
  Volume2, 
  CheckCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  AlertCircle,
  Lock
} from 'lucide-react';
import { Doctor, SidebarTab, AtendiaPlan } from '../types';
import WhatsAppConnect from './WhatsAppConnect';

interface Rule {
  trigger: string;
  action: string;
}

interface SettingsProps {
  botSettings: {
    clinicName: string;
    phone: string;
    welcomeMessage: string;
    allowDirectDoctorScheduling: boolean;
    enableAutoReminders: boolean;
    daysBeforeAppointmentForReminder: number;
    aiTone: string;
    rulesList: Rule[];
  };
  setBotSettings: React.Dispatch<React.SetStateAction<any>>;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  specialties: string[];
  setSpecialties: React.Dispatch<React.SetStateAction<string[]>>;
  doctors: Doctor[];
  setActiveTab: (tab: SidebarTab) => void;
  currentPlan: AtendiaPlan;
  clinicId?: string;
}

export default function SettingsPanel({ 
  botSettings, 
  setBotSettings, 
  onAddSystemLog,
  specialties,
  setSpecialties,
  doctors,
  setActiveTab,
  currentPlan,
  clinicId
}: SettingsProps) {
  // Local form states
  const [clinicName, setClinicName] = useState(botSettings.clinicName);
  const [phone, setPhone] = useState(botSettings.phone);
  const [welcomeMessage, setWelcomeMessage] = useState(botSettings.welcomeMessage);
  const [aiTone, setAiTone] = useState(botSettings.aiTone);
  const [allowDirectDoctorScheduling, setAllowDirectDoctorScheduling] = useState(botSettings.allowDirectDoctorScheduling);
  const [enableAutoReminders, setEnableAutoReminders] = useState(botSettings.enableAutoReminders);
  const [daysBeforeAppointmentForReminder, setDaysBeforeAppointmentForReminder] = useState(botSettings.daysBeforeAppointmentForReminder);

  // Premium specific states
  const [enableAutoRescheduling, setEnableAutoRescheduling] = useState(currentPlan === 'premium');
  const [enableDelayAlerts, setEnableDelayAlerts] = useState(currentPlan === 'premium');
  
  // Custom Keyword Rules states
  const [rules, setRules] = useState<Rule[]>(botSettings.rulesList);
  const [newTrigger, setNewTrigger] = useState('');
  const [newAction, setNewAction] = useState('');

  // BUGFIX: sincroniza os campos locais quando botSettings é atualizado
  // de forma assíncrona (ex: após o fetch do Firestore terminar depois do
  // mount inicial). Sem isso, a tela ficava presa nos valores padrão
  // (INITIAL_BOT_SETTINGS) mesmo depois dos dados reais chegarem, e um
  // "Salvar" nesse estado sobrescrevia a configuração real da clínica.
  React.useEffect(() => {
    setClinicName(botSettings.clinicName);
    setPhone(botSettings.phone);
    setWelcomeMessage(botSettings.welcomeMessage);
    setAiTone(botSettings.aiTone);
    setAllowDirectDoctorScheduling(botSettings.allowDirectDoctorScheduling);
    setEnableAutoReminders(botSettings.enableAutoReminders);
    setDaysBeforeAppointmentForReminder(botSettings.daysBeforeAppointmentForReminder);
    setRules(botSettings.rulesList);
  }, [botSettings]);

  // Specialty management states
  const [newSpecialty, setNewSpecialty] = useState('');
  const [specialtyToDelete, setSpecialtyToDelete] = useState<string | null>(null);

  // Add specialty
  const handleAddSpecialty = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSpecialty.trim();
    if (!trimmed) return;

    // Check for duplicate (case-insensitive)
    const exists = specialties.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert("Esta especialidade já está cadastrada.");
      return;
    }

    setSpecialties(prev => [...prev, trimmed]);
    onAddSystemLog('success', `Nova especialidade cadastrada na clínica: "${trimmed}"`);
    setNewSpecialty('');
  };

  // Delete specialty confirmation handler
  const confirmDeleteSpecialty = () => {
    if (!specialtyToDelete) return;
    const specToDelete = specialtyToDelete;
    const docsWithSpec = doctors.filter(d => d.specialty === specToDelete);
    
    setSpecialties(prev => prev.filter(s => s !== specToDelete));
    onAddSystemLog('warning', `Especialidade removida da clínica: "${specToDelete}". ${docsWithSpec.length} médico(s) ocultado(s).`);
    setSpecialtyToDelete(null);
  };

  // Handle saving general configuration
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setBotSettings((prev: any) => ({
      ...prev,
      clinicName,
      phone,
      welcomeMessage,
      aiTone,
      allowDirectDoctorScheduling,
      enableAutoReminders,
      daysBeforeAppointmentForReminder,
      rulesList: rules
    }));

    // Salva no Firestore pra o bot ler
    if (clinicId) {
      fetch('/api/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveBotConfig',
          payload: {
            docId: `clinic_settings_${clinicId.toLowerCase().replace(/[@.]/g, '_')}/bot`,
            config: {
              clinicName,
              welcomeMessage,
              aiTone,
              phone,
            }
          }
        }),
      }).catch(() => {});
    }

    onAddSystemLog('success', 'Configurações gerais do AtendIA salvas e aplicadas em tempo real.');
    alert("Configurações atualizadas com sucesso!");
  };

  // Add keyword trigger rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newAction.trim()) return;

    const updatedRules = [...rules, { trigger: newTrigger.trim().toLowerCase(), action: newAction.trim() }];
    setRules(updatedRules);
    setBotSettings((prev: any) => ({
      ...prev,
      rulesList: updatedRules
    }));
    
    onAddSystemLog('success', `Adicionada regra de disparo de palavra-chave: "${newTrigger.trim()}"`);
    setNewTrigger('');
    setNewAction('');
  };

  // Delete keyword trigger rule
  const handleDeleteRule = (index: number, triggerName: string) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
    setBotSettings((prev: any) => ({
      ...prev,
      rulesList: updatedRules
    }));
    onAddSystemLog('warning', `Regra de palavra-chave deletada: "${triggerName}"`);
  };

  return (
    <div id="settings-panel" className="p-6 space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: General configuration form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
              Configurações do Robô & Fluxos
            </h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">
              IA AtendIA Engine
            </span>
          </div>

          <form onSubmit={handleSaveConfig} className="p-6 space-y-5">
            
            {/* Clinic details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                  Nome Comercial da Clínica
                </label>
                <input
                  id="settings-clinic-name"
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                  Número de WhatsApp da Clínica
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="settings-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 (31) 99105-8485"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-sans mt-1">Número que os pacientes usam para contato. O bot informará este número se solicitado.</p>
              </div>
            </div>

            {/* WhatsApp Embedded Signup */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-2">
                Conexão WhatsApp Business
              </label>
              <WhatsAppConnect
                clinicId={clinicId || ''}
                onAddSystemLog={onAddSystemLog}
              />
            </div>

            {/* AI Welcome Message Textarea */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                Mensagem de Boas-Vindas Inicial (WhatsApp)
              </label>
              <textarea
                id="settings-welcome-message"
                rows={4}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans leading-relaxed"
                placeholder="Ex: Olá, seja muito bem-vindo!"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-sans">
                Esta é a mensagem inicial enviada automaticamente para qualquer paciente que fizer contato fora de agendamentos agendados.
              </p>
            </div>

            {/* AI Custom parameterization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                  Tom de voz da IA
                </label>
                <select
                  id="settings-ai-tone"
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-hidden font-sans"
                >
                  <option value="Acolhedor, prestativo e profissional">Acolhedor, prestativo e profissional</option>
                  <option value="Formal, direto e objetivo">Formal, direto e objetivo</option>
                  <option value="Alegre, dinâmico e enérgico">Alegre, dinâmico e enérgico</option>
                  <option value="Estritamente clínico e protocolar">Estritamente clínico e protocolar</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                  Antecedência do lembrete automático
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    id="settings-reminder-days"
                    value={daysBeforeAppointmentForReminder}
                    onChange={(e) => setDaysBeforeAppointmentForReminder(Number(e.target.value))}
                    className="w-full text-xs pl-9 pr-3 p-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-hidden font-sans"
                  >
                    <option value={1}>1 Dia antes da consulta</option>
                    <option value={2}>2 Dias antes da consulta</option>
                    <option value={3}>3 Dias antes da consulta</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Toggles features */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 font-sans">Permitir escolher médico diretamente</h4>
                  <p className="text-[10px] text-slate-400 font-sans">Paciente pode escolher o profissional no chat sem passar por triagem de recepção.</p>
                </div>
                <input
                  id="toggle-direct-scheduling"
                  type="checkbox"
                  checked={allowDirectDoctorScheduling}
                  onChange={(e) => setAllowDirectDoctorScheduling(e.target.checked)}
                  className="w-4 h-4 text-[#1A6FA8] focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 font-sans">Habilitar lembretes via WhatsApp</h4>
                  <p className="text-[10px] text-slate-400 font-sans">Disparo de alertas de confirmação automáticos para o dia anterior.</p>
                </div>
                <input
                  id="toggle-reminders"
                  type="checkbox"
                  checked={enableAutoReminders}
                  onChange={(e) => setEnableAutoReminders(e.target.checked)}
                  className="w-4 h-4 text-[#1A6FA8] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* PREMIUM: Reagendamento Automático via WhatsApp */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 relative">
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-700 font-sans">Reagendamento automático via WhatsApp</h4>
                    <span className="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider font-mono">Premium</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">Caso o paciente desmarque, o bot oferece automaticamente novos horários livres no WhatsApp.</p>
                </div>
                {currentPlan !== 'premium' ? (
                  <button
                    type="button"
                    onClick={() => {
                      alert("A funcionalidade de Reagendamento Automático está disponível apenas no plano Premium. Faça o upgrade de sua assinatura para habilitar.");
                    }}
                    className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                    title="Apenas no plano Premium"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                ) : (
                  <input
                    id="toggle-rescheduling"
                    type="checkbox"
                    checked={enableAutoRescheduling}
                    onChange={(e) => setEnableAutoRescheduling(e.target.checked)}
                    className="w-4 h-4 text-[#1A6FA8] focus:ring-0 cursor-pointer"
                  />
                )}
              </div>

              {/* PREMIUM: Alertas de Atraso de Médicos */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 relative">
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-700 font-sans">Alertas automáticos de atrasos de médicos</h4>
                    <span className="text-[8px] bg-amber-100 text-amber-700 border border-amber-200 font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider font-mono">Premium</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">Se o médico atrasar, o bot envia de forma proativa um aviso ao paciente pelo WhatsApp, reduzindo ansiedade.</p>
                </div>
                {currentPlan !== 'premium' ? (
                  <button
                    type="button"
                    onClick={() => {
                      alert("Os Alertas de Atraso de Médicos estão disponíveis apenas no plano Premium. Faça o upgrade de sua assinatura para habilitar.");
                    }}
                    className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                    title="Apenas no plano Premium"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                ) : (
                  <input
                    id="toggle-delay-alerts"
                    type="checkbox"
                    checked={enableDelayAlerts}
                    onChange={(e) => setEnableDelayAlerts(e.target.checked)}
                    className="w-4 h-4 text-[#1A6FA8] focus:ring-0 cursor-pointer"
                  />
                )}
              </div>

            </div>

            {/* Save trigger button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                id="btn-save-settings"
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Configurações</span>
              </button>
            </div>

          </form>
        </div>

        {/* Right Column: Custom rules & Trigger Keywords list */}
        <div className="space-y-6">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
              Regras de Palavras-Chave
            </h4>
            <p className="text-xs text-slate-500 font-sans">
              Cadastre respostas automáticas rápidas caso o paciente digite termos específicos.
            </p>

            {/* Rules table list */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 p-2 bg-slate-50 rounded-lg border border-slate-150 text-xs">
                  <div>
                    <span className="font-semibold text-indigo-700 font-mono text-[10px] block uppercase">
                      Se digitado: "{rule.trigger}"
                    </span>
                    <span className="text-slate-600 mt-0.5 block font-sans">
                      {rule.action}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(idx, rule.trigger)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Rule Form */}
            <form onSubmit={handleAddRule} className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <input
                  id="settings-new-trigger"
                  type="text"
                  required
                  placeholder="Se o paciente digitar..."
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
                />
              </div>

              <div>
                <input
                  id="settings-new-action"
                  type="text"
                  required
                  placeholder="Responda automaticamente..."
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
                />
              </div>

              <button
                id="btn-add-rule-trigger"
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200/50 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Regra</span>
              </button>
            </form>
          </div>

          {/* Clinic Specialties Management */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-[#1A6FA8]" />
                Especialidades Atendidas
              </h4>
              <span className="bg-[#1A6FA8]/10 text-[#1A6FA8] text-[10px] font-bold px-2 py-0.5 rounded-full">
                {specialties.length} Ativas
              </span>
            </div>
            
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Cadastre as especialidades da clínica. Médicos de especialidades não cadastradas aqui serão temporariamente ocultados do Corpo Clínico.
            </p>

            {/* Specialties List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {specialties.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                  <p className="text-[11px] text-slate-500 font-sans font-medium">Nenhuma especialidade cadastrada.</p>
                </div>
              ) : (
                specialties.map((spec) => {
                  const docCount = doctors.filter(d => d.specialty === spec).length;
                  return (
                    <div key={spec} className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/50 rounded-lg border border-slate-100 text-xs transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 font-sans">{spec}</span>
                        <span className="text-[9px] bg-blue-50 text-[#1A6FA8] font-extrabold px-1.5 py-0.5 rounded">
                          {docCount} {docCount === 1 ? 'médico' : 'médicos'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpecialtyToDelete(spec)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Excluir Especialidade"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Specialty Form */}
            <form onSubmit={handleAddSpecialty} className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <input
                  id="settings-new-specialty"
                  type="text"
                  required
                  placeholder="Ex: Dermatologia, Ortopedia..."
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans bg-slate-50/50 focus:bg-white"
                />
              </div>

              <button
                id="btn-add-specialty"
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200/50 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Especialidade</span>
              </button>
            </form>
          </div>

          {/* Quick AI status */}
          <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl text-sky-800 text-xs">
            <h5 className="font-bold flex items-center gap-1.5 font-sans mb-1 text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              Sincronização AtendIA AI
            </h5>
            <p className="font-sans leading-relaxed">
              O modelo de linguagem natural processa mensagens analisando o contexto geral e intenções dos pacientes, recorrendo a estas regras de palavra-chave como diretrizes de validação rápida.
            </p>
          </div>

        </div>

      </div>

      {/* Custom Specialty Deletion Confirmation Modal */}
      {specialtyToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200/80 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 font-sans">Remover Especialidade?</h3>
                <p className="text-xs text-slate-500 font-sans">
                  Tem certeza que deseja remover a especialidade <strong className="text-slate-700">"{specialtyToDelete}"</strong>?
                </p>
              </div>
            </div>

            {doctors.filter(d => d.specialty === specialtyToDelete).length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-sans">
                <p className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                  ATENÇÃO: Impacto no Corpo Clínico
                </p>
                <p className="mt-1 leading-relaxed">
                  Existem <strong>{doctors.filter(d => d.specialty === specialtyToDelete).length} médico(s)</strong> cadastrados nesta especialidade. Eles ficarão ocultados do Corpo Clínico e desativados para agendamento até que a especialidade seja cadastrada novamente.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSpecialtyToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSpecialty}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold font-sans cursor-pointer transition-all shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
