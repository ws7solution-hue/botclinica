import React, { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Clock, DollarSign, FileText, X, ClipboardCheck } from 'lucide-react';
import { ExamType } from '../types';

interface ExamsPanelProps {
  examTypes: ExamType[];
  setExamTypes: React.Dispatch<React.SetStateAction<ExamType[]>>;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  clinicId?: string;
}

const DAYS_OF_WEEK = [
  { key: 'Seg', label: 'Seg' },
  { key: 'Ter', label: 'Ter' },
  { key: 'Qua', label: 'Qua' },
  { key: 'Qui', label: 'Qui' },
  { key: 'Sex', label: 'Sex' },
  { key: 'Sáb', label: 'Sáb' },
];

function generateId() {
  return `exam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ExamsPanel({ examTypes, setExamTypes, onAddSystemLog, clinicId }: ExamsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamType | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamType | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formSlotDuration, setFormSlotDuration] = useState(30);
  const [formAttendanceDays, setFormAttendanceDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formBreakStart, setFormBreakStart] = useState('');
  const [formBreakEnd, setFormBreakEnd] = useState('');
  const [formPreparationInstructions, setFormPreparationInstructions] = useState('');
  const [formAdditionalNotes, setFormAdditionalNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRepasseType, setFormRepasseType] = useState<'percentual' | 'fixo'>('percentual');
  const [formRepasseValue, setFormRepasseValue] = useState<number>(100);

  const filteredExams = useMemo(() => {
    if (!searchTerm.trim()) return examTypes;
    const term = searchTerm.toLowerCase();
    return examTypes.filter(e => e.name.toLowerCase().includes(term));
  }, [examTypes, searchTerm]);

  function resetForm() {
    setFormName('');
    setFormPrice(0);
    setFormSlotDuration(30);
    setFormAttendanceDays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
    setFormStartTime('08:00');
    setFormEndTime('18:00');
    setFormBreakStart('');
    setFormBreakEnd('');
    setFormPreparationInstructions('');
    setFormAdditionalNotes('');
    setFormIsActive(true);
    setFormRepasseType('percentual');
    setFormRepasseValue(100);
    setEditingExam(null);
  }

  function openNewExamForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEditExamForm(exam: ExamType) {
    setEditingExam(exam);
    setFormName(exam.name);
    setFormPrice(exam.price);
    setFormSlotDuration(exam.slotDuration);
    setFormAttendanceDays(exam.attendanceDays);
    setFormStartTime(exam.startTime);
    setFormEndTime(exam.endTime);
    setFormBreakStart(exam.breakStart || '');
    setFormBreakEnd(exam.breakEnd || '');
    setFormPreparationInstructions(exam.preparationInstructions || '');
    setFormAdditionalNotes(exam.additionalNotes || '');
    setFormIsActive(exam.isActive);
    setFormRepasseType(exam.repasseType || 'percentual');
    setFormRepasseValue(exam.repasseValue ?? 100);
    setIsFormOpen(true);
  }

  function toggleDay(day: string) {
    setFormAttendanceDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSaveExam() {
    if (!formName.trim()) {
      onAddSystemLog('warning', 'Preencha o nome do exame antes de salvar.');
      return;
    }
    if (formAttendanceDays.length === 0) {
      onAddSystemLog('warning', 'Selecione pelo menos um dia de atendimento.');
      return;
    }
    setSaving(true);
    try {
      const { fbSaveExamType } = await import('../firebase');
      const examData: ExamType = {
        id: editingExam?.id || generateId(),
        name: formName.trim(),
        price: formPrice,
        slotDuration: formSlotDuration,
        attendanceDays: formAttendanceDays,
        startTime: formStartTime,
        endTime: formEndTime,
        breakStart: formBreakStart || undefined,
        breakEnd: formBreakEnd || undefined,
        preparationInstructions: formPreparationInstructions || undefined,
        additionalNotes: formAdditionalNotes || undefined,
        isActive: formIsActive,
        repasseType: formRepasseType,
        repasseValue: Number(formRepasseValue),
      };
      await fbSaveExamType(clinicId || '', examData);
      setExamTypes(prev => {
        const exists = prev.some(e => e.id === examData.id);
        return exists ? prev.map(e => (e.id === examData.id ? examData : e)) : [...prev, examData];
      });
      onAddSystemLog('success', `Exame "${examData.name}" salvo com sucesso.`);
      setIsFormOpen(false);
      resetForm();
    } catch (e: any) {
      onAddSystemLog('error', `Erro ao salvar exame: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExam() {
    if (!examToDelete) return;
    try {
      const { fbDeleteExamType } = await import('../firebase');
      await fbDeleteExamType(clinicId || '', examToDelete.id);
      setExamTypes(prev => prev.filter(e => e.id !== examToDelete.id));
      onAddSystemLog('success', `Exame "${examToDelete.name}" removido.`);
    } catch (e: any) {
      onAddSystemLog('error', `Erro ao remover exame: ${e.message}`);
    } finally {
      setExamToDelete(null);
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-slate-800 font-sans flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#1A6FA8]" />
              Exames
            </h1>
            <p className="text-sm text-slate-500 font-sans">
              Exames que a clínica oferece, com horário próprio — sem depender de um médico específico.
            </p>
          </div>
          <button
            onClick={openNewExamForm}
            className="flex items-center gap-2 bg-[#1A6FA8] hover:bg-[#135480] text-white px-4 py-2.5 rounded-xl text-sm font-bold font-sans transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Exame
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar exame..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-sans"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredExams.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-sans text-sm">
            {examTypes.length === 0
              ? 'Nenhum exame cadastrado ainda. Clique em "Novo Exame" pra começar.'
              : 'Nenhum exame encontrado com esse nome.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map(exam => (
              <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-800 font-sans text-sm">{exam.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-sans ${exam.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {exam.isActive ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <DollarSign className="w-3.5 h-3.5" /> R$ {exam.price.toFixed(2)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                  <Clock className="w-3.5 h-3.5" /> {exam.slotDuration}min · {exam.startTime}-{exam.endTime}
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  {exam.attendanceDays.join(', ')}
                </div>
                {exam.preparationInstructions && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 font-sans mt-1">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{exam.preparationInstructions}</span>
                  </div>
                )}
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openEditExamForm(exam)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-[#1A6FA8] hover:bg-blue-50 rounded-lg py-1.5 font-sans"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => setExamToDelete(exam)}
                    className="flex items-center justify-center gap-1 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg px-3 py-1.5 font-sans"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 font-sans">
                {editingExam ? 'Editar Exame' : 'Novo Exame'}
              </h2>
              <button onClick={() => setIsFormOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Nome do exame *</label>
                <input
                  type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Ultrassom Abdominal"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Valor (R$)</label>
                  <input
                    type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Duração (min)</label>
                  <input
                    type="number" value={formSlotDuration} onChange={e => setFormSlotDuration(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 font-sans">Dias de atendimento</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-colors ${
                        formAttendanceDays.includes(day.key)
                          ? 'bg-[#1A6FA8] text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Início</label>
                  <input
                    type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Fim</label>
                  <input
                    type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Intervalo (início)</label>
                  <input
                    type="time" value={formBreakStart} onChange={e => setFormBreakStart(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Intervalo (fim)</label>
                  <input
                    type="time" value={formBreakEnd} onChange={e => setFormBreakEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Preparo necessário (opcional)</label>
                <textarea
                  value={formPreparationInstructions} onChange={e => setFormPreparationInstructions(e.target.value)}
                  placeholder="Ex: Jejum de 8 horas. Bexiga cheia."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 font-sans">Observações adicionais (opcional)</label>
                <textarea
                  value={formAdditionalNotes} onChange={e => setFormAdditionalNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans"
                />
              </div>

              {/* Repasse financeiro — quanto fica pra clínica em cada exame */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 font-sans">Repasse Financeiro</h4>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Define quanto fica pra clínica em cada exame feito — usado pra calcular o repasse automaticamente no Financeiro. Deixe 100% se o exame não tiver repasse pra ninguém.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 font-sans block">Tipo de repasse</label>
                    <select
                      value={formRepasseType}
                      onChange={(e) => setFormRepasseType(e.target.value as 'percentual' | 'fixo')}
                      className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-sans"
                    >
                      <option value="percentual">% sobre o exame</option>
                      <option value="fixo">Valor fixo por exame</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 font-sans block">
                      {formRepasseType === 'percentual' ? '% que fica pra clínica' : 'R$ que fica pra clínica'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold font-mono">
                        {formRepasseType === 'percentual' ? '%' : 'R$'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={formRepasseType === 'percentual' ? 100 : undefined}
                        value={formRepasseValue}
                        onChange={(e) => setFormRepasseValue(Number(e.target.value))}
                        className="w-full pl-8 pr-3 p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1A6FA8] focus:border-[#1A6FA8] focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-sans bg-white p-2 rounded-lg border border-slate-100">
                  {formRepasseType === 'percentual'
                    ? `Ex: exame de R$${formPrice} → clínica fica com R$${(formPrice * formRepasseValue / 100).toFixed(2)}, repasse de R$${(formPrice * (100 - formRepasseValue) / 100).toFixed(2)}.`
                    : `Ex: exame de R$${formPrice} → clínica fica com R$${formRepasseValue.toFixed(2)}, repasse de R$${Math.max(0, formPrice - formRepasseValue).toFixed(2)}.`}
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-600 font-sans">Exame ativo (disponível pra agendamento)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg font-sans">
                Cancelar
              </button>
              <button
                onClick={handleSaveExam}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white bg-[#1A6FA8] hover:bg-[#135480] rounded-lg font-sans disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar Exame'}
              </button>
            </div>
          </div>
        </div>
      )}

      {examToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-bold text-slate-800 font-sans mb-2">Excluir exame?</h3>
            <p className="text-sm text-slate-500 font-sans mb-5">
              Tem certeza que quer excluir "{examToDelete.name}"? Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setExamToDelete(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg font-sans">
                Cancelar
              </button>
              <button onClick={handleDeleteExam} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg font-sans">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
