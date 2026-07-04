import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Star, 
  Clock, 
  Coins, 
  Plus, 
  Activity,
  UserCheck,
  UserX,
  X,
  Trash2,
  Pencil,
  Sparkles,
  Heart,
  User,
  Check,
  ChevronRight,
  ShieldCheck,
  Calendar,
  DollarSign,
  AlertTriangle,
  BookOpen,
  Settings,
  Smile,
  Upload
} from 'lucide-react';
import { Doctor, AtendiaPlan } from '../types';
import { fbSaveDoctor, fbDeleteDoctor } from '../firebase';

interface DoctorsPanelProps {
  doctors: Doctor[];
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  specialties: string[];
  setActiveTab: (tab: any) => void;
  currentPlan: AtendiaPlan;
  clinicId?: string;
}

const DAYS_OF_WEEK = [
  { key: 'Seg', label: 'Seg' },
  { key: 'Ter', label: 'Ter' },
  { key: 'Qua', label: 'Qua' },
  { key: 'Qui', label: 'Qui' },
  { key: 'Sex', label: 'Sex' },
  { key: 'Sáb', label: 'Sáb' }
];

export default function DoctorsPanel({ 
  doctors, 
  setDoctors, 
  onAddSystemLog,
  specialties,
  setActiveTab,
  currentPlan,
  clinicId
}: DoctorsPanelProps) {
  // Plan limits check
  const doctorLimit = useMemo(() => {
    if (currentPlan === 'starter') return 1;
    if (currentPlan === 'profissional') return 5;
    return Infinity;
  }, [currentPlan]);

  const isLimitReached = doctors.length >= doctorLimit;

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  
  // Form active tab
  const [formActiveTab, setFormActiveTab] = useState<'basic' | 'bot_config' | 'bot_behavior'>('basic');

  // New/Edit form state
  const [formName, setFormName] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formCrm, setFormCrm] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formAttendanceDays, setFormAttendanceDays] = useState<string[]>(['Seg', 'Qua']);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formSlotDuration, setFormSlotDuration] = useState<number>(30);
  const [formBreakStart, setFormBreakStart] = useState('');
  const [formBreakEnd, setFormBreakEnd] = useState('');
  const [formBreak2Start, setFormBreak2Start] = useState('');
  const [formBreak2End, setFormBreak2End] = useState('');
  const [formConsultationFee, setFormConsultationFee] = useState(300);
  const [formIsActive, setFormIsActive] = useState(true);
  
  // Bot config
  const [formProcedures, setFormProcedures] = useState('');
  const [formInsurancePlans, setFormInsurancePlans] = useState('');
  const [formExams, setFormExams] = useState('');
  const [formDiscounts, setFormDiscounts] = useState('');
  const [formSchedulingPolicy, setFormSchedulingPolicy] = useState('');
  const [formPreparationInstructions, setFormPreparationInstructions] = useState('');
  const [formAdditionalNotes, setFormAdditionalNotes] = useState('');

  // Bot behavior
  const [formBotName, setFormBotName] = useState('');
  const [formBotTone, setFormBotTone] = useState<'Cordial' | 'Formal' | 'Descontraído'>('Cordial');

  // Image upload and drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert("A imagem é muito grande. Escolha uma imagem com até 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 3 * 1024 * 1024) {
        alert("A imagem é muito grande. Escolha uma imagem com até 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Initials fallback generator
  const getInitials = (name: string) => {
    if (!name) return 'DR';
    const parts = name.trim().replace(/^(dr|dra|dr\.|dra\.)\s+/i, '').split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper to hash initials to a consistent elegant background color
  const getAvatarBg = (name: string) => {
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-blue-500 to-indigo-600 text-white',
      'from-emerald-500 to-teal-600 text-white',
      'from-purple-500 to-violet-600 text-white',
      'from-rose-500 to-pink-600 text-white',
      'from-amber-500 to-orange-600 text-white',
      'from-sky-500 to-cyan-600 text-white'
    ];
    return gradients[sum % gradients.length];
  };

  // Toggle active/inactive status
  const handleToggleActive = (docId: string, name: string, currentStatus: boolean) => {
    setDoctors(prev => prev.map(doc => {
      if (doc.id === docId) {
        const nextStatus = !currentStatus;
        onAddSystemLog(
          nextStatus ? 'success' : 'warning', 
          `Dr(a). ${doc.name} foi ${nextStatus ? 'ativado(a)' : 'desativado(a)'} no sistema AtendIA.`
        );
        return { ...doc, isActive: nextStatus };
      }
      return doc;
    }));
  };

  // Open Form modal for creation
  const handleOpenCreateModal = () => {
    setEditingDoctor(null);
    setFormName('');
    setFormSpecialty(specialties[0] || '');
    setFormCrm('');
    setFormAvatarUrl('');
    setFormAttendanceDays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
    setFormStartTime('08:00');
    setFormEndTime('18:00');
    setFormSlotDuration(30);
    setFormBreakStart('');
    setFormBreakEnd('');
    setFormBreak2Start('');
    setFormBreak2End('');
    setFormConsultationFee(300);
    setFormIsActive(true);
    
    // Bot configs empty presets
    setFormProcedures('Consultas de rotina, diagnóstico, acompanhamento terapêutico e orientações clínicas periódicas.');
    setFormInsurancePlans('Unimed, Bradesco Saúde, Amil, SulAmérica, Particular.');
    setFormExams('Exames diagnósticos pertinentes à especialidade.');
    setFormDiscounts('10% de desconto para agendamentos particulares realizados integralmente pelo WhatsApp.');
    setFormSchedulingPolicy('Tolerância de atraso de até 15 minutos. Cancelamentos devem ser realizados com no mínimo 24h de antecedência.');
    setFormPreparationInstructions('Trazer exames anteriores pertinentes e a lista de medicamentos de uso contínuo.');
    setFormAdditionalNotes('Sempre agir de maneira compassiva, focando em esclarecer dúvidas de forma clara e objetiva.');
    
    setFormBotName('Sofia');
    setFormBotTone('Cordial');

    setFormActiveTab('basic');
    setIsFormOpen(true);
  };

  // Open Form modal for editing
  const handleOpenEditModal = (doc: Doctor) => {
    setEditingDoctor(doc);
    setFormName(doc.name);
    setFormSpecialty(doc.specialty);
    setFormCrm(doc.crm);
    setFormAvatarUrl(doc.avatarUrl || '');
    setFormAttendanceDays(doc.attendanceDays || ['Seg', 'Qua']);
    setFormStartTime(doc.startTime || '08:00');
    setFormEndTime(doc.endTime || '18:00');
    setFormSlotDuration(doc.slotDuration || 30);
    setFormBreakStart(doc.breakStart || '');
    setFormBreakEnd(doc.breakEnd || '');
    setFormBreak2Start(doc.break2Start || '');
    setFormBreak2End(doc.break2End || '');
    setFormConsultationFee(doc.consultationFee);
    setFormIsActive(doc.isActive);

    setFormProcedures(doc.procedures || '');
    setFormInsurancePlans(doc.insurancePlans || '');
    setFormExams(doc.exams || '');
    setFormDiscounts(doc.discounts || '');
    setFormSchedulingPolicy(doc.schedulingPolicy || '');
    setFormPreparationInstructions(doc.preparationInstructions || '');
    setFormAdditionalNotes(doc.additionalNotes || '');

    setFormBotName(doc.botName || doc.name.split(' ')[1] || 'Bot');
    setFormBotTone(doc.botTone || 'Cordial');

    setFormActiveTab('basic');
    setIsFormOpen(true);
  };

  // Save/Submit Add or Edit form
  const handleSaveDoctor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName || !formCrm) {
      alert("Por favor, preencha o nome completo e o número de CRM.");
      return;
    }

    // Build schedule representation array
    const daysFormatted = formAttendanceDays.join(', ');
    const schedulesString = [`${daysFormatted} (${formStartTime} - ${formEndTime})`];

    if (editingDoctor) {
      // Update Doctor
      const updated = {
        ...editingDoctor,
        name: formName,
        specialty: formSpecialty,
        crm: formCrm,
        avatarUrl: formAvatarUrl,
        attendanceDays: formAttendanceDays,
        startTime: formStartTime,
        endTime: formEndTime,
        slotDuration: formSlotDuration,
        breakStart: formBreakStart || undefined,
        breakEnd: formBreakEnd || undefined,
        break2Start: formBreak2Start || undefined,
        break2End: formBreak2End || undefined,
        schedules: schedulesString,
        consultationFee: Number(formConsultationFee),
        isActive: formIsActive,
        procedures: formProcedures,
        insurancePlans: formInsurancePlans,
        exams: formExams,
        discounts: formDiscounts,
        schedulingPolicy: formSchedulingPolicy,
        preparationInstructions: formPreparationInstructions,
        additionalNotes: formAdditionalNotes,
        botName: formBotName,
        botTone: formBotTone
      };
      setDoctors(prev => prev.map(doc => doc.id === editingDoctor.id ? updated : doc));
      if (clinicId) fbSaveDoctor(clinicId, updated).catch(console.error);
      onAddSystemLog('success', `Informações e bot de atendimento do(a) Dr(a). ${formName} foram atualizados.`);
    } else {
      // Create Doctor
      const newDoctor: Doctor = {
        id: `doc-${Date.now()}`,
        name: formName,
        specialty: formSpecialty,
        crm: formCrm,
        rating: 4.8,
        avatarUrl: formAvatarUrl,
        schedules: schedulesString,
        consultationFee: Number(formConsultationFee),
        activePatientsCount: 0,
        isActive: formIsActive,
        attendanceDays: formAttendanceDays,
        startTime: formStartTime,
        endTime: formEndTime,
        slotDuration: formSlotDuration,
        breakStart: formBreakStart || undefined,
        breakEnd: formBreakEnd || undefined,
        break2Start: formBreak2Start || undefined,
        break2End: formBreak2End || undefined,
        procedures: formProcedures,
        insurancePlans: formInsurancePlans,
        exams: formExams,
        discounts: formDiscounts,
        schedulingPolicy: formSchedulingPolicy,
        preparationInstructions: formPreparationInstructions,
        additionalNotes: formAdditionalNotes,
        botName: formBotName,
        botTone: formBotTone
      };
      setDoctors(prev => [...prev, newDoctor]);
      if (clinicId) fbSaveDoctor(clinicId, newDoctor).catch(console.error);
      onAddSystemLog('success', `Novo médico Dr(a). ${formName} cadastrado com sucesso e sincronizado ao AtendIA.`);
    }

    setIsFormOpen(false);
    setEditingDoctor(null);
  };

  // Handle Delete Doctor
  const handleDeleteConfirm = () => {
    if (doctorToDelete) {
      setDoctors(prev => prev.filter(doc => doc.id !== doctorToDelete.id));
      if (clinicId) fbDeleteDoctor(clinicId, doctorToDelete.id).catch(console.error);
      onAddSystemLog('error', `Dr(a). ${doctorToDelete.name} foi removido(a) do sistema.`);
      setDoctorToDelete(null);
    }
  };

  // Toggle day checkbox in form
  const handleToggleDay = (dayKey: string) => {
    if (formAttendanceDays.includes(dayKey)) {
      setFormAttendanceDays(prev => prev.filter(d => d !== dayKey));
    } else {
      setFormAttendanceDays(prev => [...prev, dayKey]);
    }
  };

  // Filtered list: show only doctors whose specialty is registered in the clinic's specialties list!
  const filteredDoctors = useMemo(() => {
    return doctors.filter(doc => {
      // Must be a registered clinic specialty
      const isRegistered = specialties.includes(doc.specialty);
      if (!isRegistered) return false;

      const matchesSearch = 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        doc.crm.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSpecialty = selectedSpecialty === 'all' || doc.specialty === selectedSpecialty;
      
      return matchesSearch && matchesSpecialty;
    });
  }, [doctors, searchTerm, selectedSpecialty, specialties]);

  // Active doctors of registered specialties
  const activeSpecialtiesDoctors = useMemo(() => {
    return doctors.filter(doc => specialties.includes(doc.specialty));
  }, [doctors, specialties]);

  // Specialties list with doctors count for dynamic chips
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activeSpecialtiesDoctors.length };
    activeSpecialtiesDoctors.forEach(doc => {
      counts[doc.specialty] = (counts[doc.specialty] || 0) + 1;
    });
    return counts;
  }, [activeSpecialtiesDoctors]);

  // Active status count badges (only for doctors in active specialties)
  const activeDoctorsCount = activeSpecialtiesDoctors.filter(d => d.isActive).length;

  return (
    <div id="doctors-panel" className="p-6 space-y-6">
      
      {/* Top statistics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-sans uppercase font-semibold">Total de Médicos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 font-sans">{doctors.length}</span>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                Sincronizados
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1A6FA8] flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-sans uppercase font-semibold">Robôs de Triagem</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 font-sans">{activeDoctorsCount}</span>
              <span className="text-xs text-slate-400 font-medium">ativos no chat</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-sans uppercase font-semibold">Atendimento Ativo</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 font-sans">
                {doctors.reduce((acc, curr) => acc + (curr.activePatientsCount || 0), 0)}
              </span>
              <span className="text-xs text-blue-600 font-medium">pacientes hoje</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {isLimitReached && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-amber-900 font-sans">Limite de Médicos Atingido</h4>
            <p className="mt-1 font-sans">
              Seu plano atual (<span className="font-bold">{currentPlan === 'starter' ? '🌱 Starter' : '⭐ Profissional'}</span>) permite cadastrar no máximo <strong className="font-bold">{doctorLimit}</strong> {doctorLimit === 1 ? 'médico' : 'médicos'}. Atualmente você possui <strong className="font-bold">{doctors.length}</strong> médicos cadastrados.
            </p>
            <div className="mt-2 text-slate-500">
              Para adicionar mais médicos especialistas e expandir o atendimento de sua clínica, faça o upgrade da sua assinatura.
            </div>
            <div className="mt-2.5">
              <a
                href="https://botclinica.com.br/checkout"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer shadow-sm inline-flex items-center gap-1"
              >
                Fazer upgrade agora
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Control header bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2">
              Corpo Clínico AtendIA
              <span className="bg-blue-100 text-[#1A6FA8] text-xs font-bold px-2.5 py-0.5 rounded-full font-sans">
                {filteredDoctors.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Gerencie os dados dos médicos, escalas de horários e configure as regras de cada assistente virtual no WhatsApp.
            </p>
          </div>
          
          <button
            id="add-doctor-btn"
            onClick={() => {
              if (isLimitReached) {
                alert(`Limite de médicos atingido para o plano ${currentPlan === 'starter' ? 'Starter' : 'Profissional'} (Máximo: ${doctorLimit}). Por favor, faça o upgrade de plano para cadastrar mais médicos.`);
              } else {
                handleOpenCreateModal();
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1A6FA8] hover:bg-[#145683] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Adicionar Médico
          </button>
        </div>

        {/* Filters and Search controls */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-doctor-input"
              type="text"
              placeholder="Buscar por médico, CRM ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans bg-slate-50/50"
            />
          </div>

          {/* Specialty Filter Dropdown */}
          <div className="w-full sm:w-56">
            <select
              id="specialty-filter-select"
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans bg-slate-50/50"
            >
              <option value="all">Todas as especialidades ({activeSpecialtiesDoctors.length})</option>
              {specialties.map(spec => (
                <option key={spec} value={spec}>
                  {spec} ({specialtyCounts[spec] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
 
        {/* Dynamic Specialty Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0 mr-1">Rápido:</span>
          <button
            onClick={() => setSelectedSpecialty('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border shrink-0 ${
              selectedSpecialty === 'all'
                ? 'bg-[#1A6FA8]/10 text-[#1A6FA8] border-[#1A6FA8]/30'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos ({activeSpecialtiesDoctors.length})
          </button>
          {specialties.map(spec => {
            const count = specialtyCounts[spec] || 0;
            return (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border shrink-0 ${
                  selectedSpecialty === spec
                    ? 'bg-[#1A6FA8]/10 text-[#1A6FA8] border-[#1A6FA8]/30'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {spec} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid View */}
      {specialties.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 bg-blue-50 text-[#1A6FA8] rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100/60">
            <Settings className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-sans">Nenhuma especialidade cadastrada</h3>
          <p className="text-xs text-slate-500 font-sans mt-2 max-w-md mx-auto leading-relaxed">
            Para gerenciar o seu corpo clínico, é necessário primeiro cadastrar as especialidades atendidas pela sua clínica na aba de Configurações.
          </p>
          <div className="mt-5">
            <button
              onClick={() => setActiveTab('settings')}
              className="px-4 py-2 bg-[#1A6FA8] hover:bg-[#145683] text-white rounded-lg text-xs font-bold font-sans cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              <span>Cadastrar Especialidades</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => {
            const hasPhoto = !!doc.avatarUrl;
            const initials = getInitials(doc.name);
            const fallbackBg = getAvatarBg(doc.name);

            return (
              <div 
                key={doc.id}
                id={`doctor-card-${doc.id}`}
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden flex flex-col relative ${
                  doc.isActive 
                    ? 'border-slate-200 shadow-xs hover:shadow-md' 
                    : 'border-slate-200 bg-slate-50/50 opacity-80 shadow-xs'
                }`}
              >
                {/* Active/Inactive Ribbon */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    doc.isActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {doc.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Upper Body Info */}
                <div className="p-5 flex items-start gap-4 flex-1">
                  {/* Photo / Initials fallback */}
                  {hasPhoto ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs">
                      <img 
                        src={doc.avatarUrl} 
                        alt={doc.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Fail fallback
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`w-14 h-14 rounded-full shrink-0 flex items-center justify-center font-bold text-sm tracking-wide bg-gradient-to-br shadow-xs ${fallbackBg}`}>
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 pr-12">
                    <span className="text-[9px] text-[#1A6FA8] bg-[#1A6FA8]/10 font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md font-sans inline-block">
                      {doc.specialty}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 font-sans mt-1.5 leading-snug truncate">
                      {doc.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wide">
                      {doc.crm}
                    </p>

                    {/* Star quality indicator */}
                    <div className="flex items-center gap-1 mt-2 text-amber-500 text-xs font-bold font-sans">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const ratingVal = doc.rating || 4.8;
                          const filled = star <= Math.round(ratingVal);
                          return (
                            <Star 
                              key={star} 
                              className={`w-3 h-3 ${filled ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                            />
                          );
                        })}
                      </div>
                      <span className="ml-1 text-slate-700">{doc.rating || 4.8}</span>
                      <span className="text-slate-400 font-normal">({doc.activePatientsCount || 0} Atendimentos)</span>
                    </div>
                  </div>
                </div>

                {/* Quick highlights: consultation fee & config indicator */}
                <div className="px-5 py-3 bg-slate-50 border-t border-b border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-sans">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Valor Consulta</span>
                    <div className="flex items-center gap-1 text-slate-700 font-bold font-mono mt-0.5">
                      <Coins className="w-3.5 h-3.5 text-[#1A6FA8]" />
                      <span>R$ {doc.consultationFee},00</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Agente IA Ativo</span>
                    <div className="flex items-center gap-1 text-slate-700 font-bold mt-0.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-violet-700">"{doc.botName || 'Sofia'}"</span>
                    </div>
                  </div>
                </div>

                {/* Attendance details and actions */}
                <div className="p-4 space-y-3.5 bg-white">
                  <div className="space-y-1 text-xs">
                    <span className="text-[9px] font-bold text-slate-400 font-sans flex items-center gap-1 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Escala de Atendimento
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doc.attendanceDays?.map((day) => (
                        <span key={day} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold">
                          {day}
                        </span>
                      ))}
                      <span className="text-slate-500 text-[10px] font-mono ml-1 flex items-center font-bold">
                        ({doc.startTime} - {doc.endTime})
                      </span>
                    </div>
                  </div>

                  {/* Operational Settings / Bottom layout */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Status switch */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(doc.id, doc.name, doc.isActive)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          doc.isActive ? 'bg-[#1A6FA8]' : 'bg-slate-300'
                        }`}
                        aria-label="Toggle active state"
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            doc.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-[11px] text-slate-500 font-medium font-sans">
                        {doc.isActive ? 'Online' : 'Pausado'}
                      </span>
                    </div>

                    {/* Edit/Delete Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(doc)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                        title="Editar Médico e Assistente"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDoctorToDelete(doc)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        title="Excluir Médico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Empty search state */
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-xs">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <UserX className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-sans">Nenhum médico encontrado</h3>
          <p className="text-xs text-slate-500 font-sans mt-2 max-w-md mx-auto">
            Não encontramos nenhum profissional correspondente à busca "{searchTerm}" ou com o filtro selecionado. Tente alterar os termos ou adicione um novo profissional.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedSpecialty('all');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold font-sans cursor-pointer transition-all"
            >
              Limpar Filtros
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 bg-[#1A6FA8] hover:bg-[#145683] text-white rounded-lg text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Médico
            </button>
          </div>
        </div>
      )}

      {/* DETAILED ADD / EDIT DIALOG (MODAL / SIDE DRAWER) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0F1623] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-sans flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {editingDoctor ? `Configurar Dr(a). ${editingDoctor.name}` : 'Cadastrar Novo Médico'}
                </h3>
                <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                  Insira as credenciais clínicas e configure as regras do agente de inteligência artificial.
                </p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Row */}
            <div className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto">
              <button
                type="button"
                onClick={() => setFormActiveTab('basic')}
                className={`flex-1 py-3 px-4 text-xs font-bold font-sans border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  formActiveTab === 'basic' 
                    ? 'text-[#1A6FA8] border-[#1A6FA8] bg-white' 
                    : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                1. Informações Básicas
              </button>
              
              <button
                type="button"
                onClick={() => setFormActiveTab('bot_config')}
                className={`flex-1 py-3 px-4 text-xs font-bold font-sans border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  formActiveTab === 'bot_config' 
                    ? 'text-[#1A6FA8] border-[#1A6FA8] bg-white' 
                    : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                2. Configuração do Bot
              </button>

              <button
                type="button"
                onClick={() => setFormActiveTab('bot_behavior')}
                className={`flex-1 py-3 px-4 text-xs font-bold font-sans border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  formActiveTab === 'bot_behavior' 
                    ? 'text-[#1A6FA8] border-[#1A6FA8] bg-white' 
                    : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Smile className="w-4 h-4" />
                3. Comportamento do Bot
              </button>
            </div>

            {/* Modal Body (Scrollable form body) */}
            <form onSubmit={handleSaveDoctor} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Tab 1: Basic Info */}
              {formActiveTab === 'basic' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name input */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Nome Completo do Médico <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Dra. Mariana Vasconcelos"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                      />
                    </div>

                    {/* CRM */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Número de CRM (com Estado) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: CRM-SP 185942"
                        value={formCrm}
                        onChange={(e) => setFormCrm(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Specialty dropdown */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Especialidade Médica
                      </label>
                      {specialties.length === 0 ? (
                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-sans">
                          Nenhuma especialidade ativa. 
                          <button
                            type="button"
                            onClick={() => {
                              setIsFormOpen(false);
                              setActiveTab('settings');
                            }}
                            className="ml-1 text-[#1A6FA8] font-bold hover:underline cursor-pointer"
                          >
                            Cadastrar em Configurações
                          </button>
                        </div>
                      ) : (
                        <select
                          value={formSpecialty}
                          onChange={(e) => setFormSpecialty(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden text-xs font-sans bg-white"
                        >
                          {specialties.map(spec => (
                            <option key={spec} value={spec}>{spec}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Consultation fee */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Valor da Consulta Particular (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold font-mono">R$</span>
                        <input
                          type="number"
                          min="0"
                          value={formConsultationFee}
                          onChange={(e) => setFormConsultationFee(Number(e.target.value))}
                          className="w-full pl-9 pr-4 p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>
                  </div>

                   {/* Photo Upload Area */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Foto do Médico
                    </label>
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-5 transition-all flex flex-col items-center justify-center gap-3 text-center min-h-[140px] ${
                        isDragging 
                          ? 'border-[#1A6FA8] bg-blue-50/50' 
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {formAvatarUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#1A6FA8]/50 shadow-xs">
                            <img 
                              src={formAvatarUrl} 
                              alt="Visualização" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] text-emerald-600 font-bold font-sans">Sua foto foi carregada com sucesso!</p>
                            <button
                              type="button"
                              onClick={() => setFormAvatarUrl('')}
                              className="mt-1 text-[11px] text-red-600 hover:text-red-700 font-bold cursor-pointer underline underline-offset-2"
                            >
                              Remover Foto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-2">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-[#1A6FA8] flex items-center justify-center mb-2 border border-slate-200/60">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-xs text-slate-700 font-bold font-sans">
                            Arraste a foto do médico para cá ou clique para selecionar
                          </p>
                          <p className="text-[10px] text-slate-400 font-sans mt-1">
                            Formatos aceitos: PNG, JPG, JPEG ou WEBP (Máx: 3MB)
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            id="doctor-avatar-upload"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <label
                            htmlFor="doctor-avatar-upload"
                            className="mt-3 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold font-sans cursor-pointer shadow-xs transition-all inline-block"
                          >
                            Selecionar Arquivo
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attendance hours and Days checkboxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Dias de Atendimento
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map(({ key, label }) => {
                          const isSelected = formAttendanceDays.includes(key);
                          return (
                            <button
                              type="button"
                              key={key}
                              onClick={() => handleToggleDay(key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                isSelected 
                                  ? 'bg-[#1A6FA8] text-white border-[#1A6FA8] shadow-xs' 
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 font-sans block">
                        Horário de Atendimento (Início / Fim)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={(e) => setFormStartTime(e.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white"
                        />
                        <span className="text-slate-400 text-xs">até</span>
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={(e) => setFormEndTime(e.target.value)}
                          className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duração e Pausas */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 font-sans">⏱️ Configuração da Agenda</h4>
                    
                    {/* Duração da consulta */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1.5">Duração de cada consulta</label>
                      <select
                        value={formSlotDuration}
                        onChange={(e) => setFormSlotDuration(Number(e.target.value))}
                        className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] bg-white font-sans"
                      >
                        <option value={15}>15 minutos</option>
                        <option value={20}>20 minutos</option>
                        <option value={30}>30 minutos</option>
                        <option value={45}>45 minutos</option>
                        <option value={60}>1 hora</option>
                        <option value={90}>1h30</option>
                      </select>
                    </div>

                    {/* Pausa 1 */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1.5">Pausa (almoço ou lanche)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-sans mb-1">Início</label>
                          <input type="time" value={formBreakStart} onChange={(e) => setFormBreakStart(e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-sans mb-1">Fim</label>
                          <input type="time" value={formBreakEnd} onChange={(e) => setFormBreakEnd(e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white" />
                        </div>
                      </div>
                    </div>

                    {/* Pausa 2 */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1.5">Segunda pausa (opcional)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-sans mb-1">Início</label>
                          <input type="time" value={formBreak2Start} onChange={(e) => setFormBreak2Start(e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-sans mb-1">Fim</label>
                          <input type="time" value={formBreak2End} onChange={(e) => setFormBreak2End(e.target.value)}
                            className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-mono bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Toggle Option inside modal */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Status Operacional Inicial</span>
                      <p className="text-[10px] text-slate-500">Se inativo, o médico fica cadastrado no painel porém pausado para agendamentos automáticos no chatbot.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormIsActive(!formIsActive)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          formIsActive ? 'bg-[#1A6FA8]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            formIsActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-xs font-bold text-slate-700 min-w-12">
                        {formIsActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Bot Configuration */}
              {formActiveTab === 'bot_config' && (
                <div className="space-y-4">
                  <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4 flex gap-3 text-xs text-slate-600 mb-2">
                    <Sparkles className="w-5 h-5 text-[#1A6FA8] shrink-0" />
                    <div>
                      <span className="font-bold text-[#1A6FA8] block">Configuração do Bot (Base de Conhecimento)</span>
                      As caixas de texto abaixo alimentam diretamente a Inteligência Artificial durante a triagem de pacientes no WhatsApp. Preencha com o máximo de detalhes do médico.
                    </div>
                  </div>

                  {/* Procedures */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Procedimentos Realizados
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Consultas de rotina ginecológica, aplicação de DIU Mirena e Kyleena, cauterizações..."
                      value={formProcedures}
                      onChange={(e) => setFormProcedures(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                    />
                  </div>

                  {/* Accepted Health Insurance */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Convênios e Planos de Saúde Aceitos
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Bradesco Saúde (Nacional), SulAmérica, Amil, Allianz e Particular..."
                      value={formInsurancePlans}
                      onChange={(e) => setFormInsurancePlans(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                    />
                  </div>

                  {/* Exams performed */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Exames Realizados
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Ultrassonografia Transvaginal, Papanicolau, Colposcopia diagnóstica..."
                      value={formExams}
                      onChange={(e) => setFormExams(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                    />
                  </div>

                  {/* Advanced Bot Rules Block */}
                  {currentPlan === 'starter' ? (
                    <div className="p-4 bg-slate-900/5 rounded-xl border border-dashed border-slate-300 relative overflow-hidden space-y-3">
                      <div className="absolute inset-0 bg-slate-150/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center text-center p-4">
                        <Lock className="w-5 h-5 text-amber-500 mb-1" />
                        <span className="text-[11px] font-bold text-slate-700">Regras de IA Avançadas Bloqueadas</span>
                        <p className="text-[10px] text-slate-500 max-w-[280px] leading-tight mb-2">
                          Seu plano <strong className="text-slate-800">🌱 Starter</strong> permite apenas configuração básica (Procedimentos, Convênios e Exames). Faça o upgrade para personalizar regras avançadas de descontos, políticas de desmarcação e orientações clínicas.
                        </p>
                        <a 
                          href="https://botclinica.com.br/checkout" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded text-[10px] transition-colors cursor-pointer"
                        >
                          Fazer upgrade para Profissional
                        </a>
                      </div>
                      
                      {/* Greyed out fields */}
                      <div className="opacity-25 pointer-events-none space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 font-sans block">Descontos e Promoções Ativas</label>
                          <textarea rows={1} disabled className="w-full p-1 border border-slate-200 rounded-lg bg-slate-100" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 font-sans block">Política de Agendamento</label>
                          <textarea rows={1} disabled className="w-full p-1 border border-slate-200 rounded-lg bg-slate-100" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Discounts & Promotions */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 font-sans block">
                          Descontos e Promoções Ativas
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ex: 10% de desconto para agendamentos de rotina feitos no mesmo mês no WhatsApp..."
                          value={formDiscounts}
                          onChange={(e) => setFormDiscounts(e.target.value)}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                        />
                      </div>

                      {/* Appointment scheduling policy */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 font-sans block">
                          Política de Agendamento e Desmarcação
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ex: Cancelamentos de consultas devem ser comunicados com 24 horas de antecedência..."
                          value={formSchedulingPolicy}
                          onChange={(e) => setFormSchedulingPolicy(e.target.value)}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                        />
                      </div>

                      {/* Exam preparation instructions */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 font-sans block">
                          Instruções para Preparo de Exames
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ex: Para exames transvaginais, não é necessário jejum. Para Papanicolau, evitar relação sexual anterior..."
                          value={formPreparationInstructions}
                          onChange={(e) => setFormPreparationInstructions(e.target.value)}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                        />
                      </div>

                      {/* Additional notes for the bot */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 font-sans block">
                          Observações Adicionais para o Bot
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Ex: Priorize gestantes sintomáticas no direcionamento rápido ou encaminhe de imediato à recepção física..."
                          value={formAdditionalNotes}
                          onChange={(e) => setFormAdditionalNotes(e.target.value)}
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 3: Bot Behavior */}
              {formActiveTab === 'bot_behavior' && (
                <div className="space-y-6">
                  <div className="bg-violet-50 border border-violet-200/50 rounded-xl p-4 flex gap-3 text-xs text-slate-600">
                    <Smile className="w-5 h-5 text-violet-600 shrink-0" />
                    <div>
                      <span className="font-bold text-violet-700 block">Personalidade & Tom de Voz</span>
                      Defina a identidade do robô específico deste médico. O bot agirá sob o nome escolhido e usará as inflexões selecionadas ao interagir com os pacientes.
                    </div>
                  </div>

                  {/* Bot Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Nome do Robô Assistente
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Sofia, Gabriel, Cláudio Bot..."
                      value={formBotName}
                      onChange={(e) => setFormBotName(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                    />
                    <p className="text-[10px] text-slate-400 font-sans">
                      O robô começará o contato dizendo "Olá, sou {formBotName || 'Sofia'}, assistente do(a) Dr(a)..."
                    </p>
                  </div>

                  {/* Tone of Voice */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 font-sans block">
                      Tom de Voz (Inflexão Linguística)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      
                      {/* Cordial */}
                      <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        formBotTone === 'Cordial' 
                          ? 'border-blue-500 bg-blue-50/20 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="botTone"
                          value="Cordial"
                          checked={formBotTone === 'Cordial'}
                          onChange={() => setFormBotTone('Cordial')}
                          className="mt-0.5 text-[#1A6FA8]"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-800 font-sans block">Cordial</span>
                          <p className="text-[10px] text-slate-500 font-sans leading-snug">
                            Calmo, prestativo, empático e de fácil compreensão. Usa muitos termos de cortesia. Ideal para todas as idades.
                          </p>
                        </div>
                      </label>

                      {/* Formal */}
                      <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        formBotTone === 'Formal' 
                          ? 'border-blue-500 bg-blue-50/20 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="botTone"
                          value="Formal"
                          checked={formBotTone === 'Formal'}
                          onChange={() => setFormBotTone('Formal')}
                          className="mt-0.5 text-[#1A6FA8]"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-800 font-sans block">Formal</span>
                          <p className="text-[10px] text-slate-500 font-sans leading-snug">
                            Polido, direto, gramaticalmente formal e extremamente respeitoso. Indicado para clínicas executivas ou idosos.
                          </p>
                        </div>
                      </label>

                      {/* Descontraído */}
                      <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        formBotTone === 'Descontraído' 
                          ? 'border-blue-500 bg-blue-50/20 shadow-xs' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}>
                        <input
                          type="radio"
                          name="botTone"
                          value="Descontraído"
                          checked={formBotTone === 'Descontraído'}
                          onChange={() => setFormBotTone('Descontraído')}
                          className="mt-0.5 text-[#1A6FA8]"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-800 font-sans block">Descontraído</span>
                          <p className="text-[10px] text-slate-500 font-sans leading-snug">
                            Usa termos amigáveis, emojis e linguagem mais leve. Perfeito para consultórios de Pediatria ou Dermatologia jovem.
                          </p>
                        </div>
                      </label>

                    </div>
                  </div>
                </div>
              )}

            </form>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                {/* Visual indicator of step */}
                <span className="text-[11px] text-slate-400 font-sans font-bold">
                  {formActiveTab === 'basic' && 'Passo 1 de 3 (Dados Clínicos)'}
                  {formActiveTab === 'bot_config' && 'Passo 2 de 3 (Treinamento)'}
                  {formActiveTab === 'bot_behavior' && 'Passo 3 de 3 (Sintonia)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 hover:bg-slate-200/80 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                >
                  Cancelar
                </button>
                
                {formActiveTab !== 'basic' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formActiveTab === 'bot_behavior') setFormActiveTab('bot_config');
                      else if (formActiveTab === 'bot_config') setFormActiveTab('basic');
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                  >
                    Voltar
                  </button>
                )}

                {formActiveTab !== 'bot_behavior' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (formActiveTab === 'basic') setFormActiveTab('bot_config');
                      else if (formActiveTab === 'bot_config') setFormActiveTab('bot_behavior');
                    }}
                    className="px-4 py-2 bg-[#1A6FA8] hover:bg-[#145683] text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans flex items-center gap-1.5"
                  >
                    Próximo Passo
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDoctor}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans flex items-center gap-1.5 shadow-sm"
                  >
                    Salvar Configurações
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DELETE DIALOG */}
      {doctorToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-sans">Confirmar Exclusão de Médico</h4>
                  <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">
                    Tem certeza que deseja excluir o Dr(a). <strong className="text-slate-700">{doctorToDelete.name}</strong>? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDoctorToDelete(null)}
                className="px-3 py-1.5 hover:bg-slate-200/80 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
