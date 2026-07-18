import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, User, Clock, Phone, FileText, Save, LogOut, CalendarOff, X } from 'lucide-react';
import { Doctor, Appointment, ProntuarioEntry, PatientProfile } from '../types';
import {
  fbListDoctors, fbListAppointments, fbCheckDoctorPin, fbSetDoctorPin,
  fbListProntuario, fbSaveProntuarioEntry, fbGetPatientProfile, fbGetPlano,
  fbListScheduleBlocks, fbSaveScheduleBlock, fbDeleteScheduleBlock
} from '../firebase';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(dateStr: string) {
  const today = todayISO();
  if (dateStr === today) return 'Hoje';
  if (dateStr === addDaysISO(today, 1)) return 'Amanhã';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1, 3)} ${d}/${m}`;
}

type Step = 'email' | 'pickDoctor' | 'pin' | 'home';

export default function DoctorPortalApp() {
  const [step, setStep] = useState<Step>('email');
  const [restoringSession, setRestoringSession] = useState(true);
  const [clinicEmail, setClinicEmail] = useState(localStorage.getItem('doctorPortal_clinicEmail') || '');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [planBlocked, setPlanBlocked] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(todayISO());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [scheduleBlocks, setScheduleBlocks] = useState<any[]>([]);
  const [blockDate, setBlockDate] = useState(todayISO());
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Appointment | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [prontuarioEntries, setProntuarioEntries] = useState<ProntuarioEntry[]>([]);
  const [complaint, setComplaint] = useState('');
  const [conduct, setConduct] = useState('');
  const [prescription, setPrescription] = useState('');
  const [savingEvolution, setSavingEvolution] = useState(false);

  const clinicId = clinicEmail.trim().toLowerCase();

  const handleSubmitEmail = async () => {
    if (!clinicEmail.trim()) return;
    setLoading(true);
    setPlanBlocked(false);
    try {
      const plano = await fbGetPlano(clinicId);
      if (plano !== 'premium') {
        setPlanBlocked(true);
        setLoading(false);
        return;
      }
      const list = await fbListDoctors(clinicId);
      if (list.length === 0) {
        setPinError('Nenhum médico encontrado para esse e-mail de clínica. Confirme o e-mail com a recepção.');
        setLoading(false);
        return;
      }
      setDoctors(list);
      localStorage.setItem('doctorPortal_clinicEmail', clinicId);
      setStep('pickDoctor');
      setPinError('');
    } catch {
      setPinError('Erro ao buscar a clínica. Tente novamente.');
    }
    setLoading(false);
  };

  const handlePickDoctor = async (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setPinError('');
    setLoading(true);
    const r = await fbCheckDoctorPin(clinicId, doctor.id, '');
    setHasPin(r.hasPin);
    setLoading(false);
    setStep('pin');
  };

  const saveSession = (doctor: Doctor) => {
    localStorage.setItem('doctorPortal_session', JSON.stringify({
      clinicEmail: clinicId,
      doctorId: doctor.id,
      timestamp: Date.now(),
    }));
  };

  const handleUnlock = async () => {
    if (!selectedDoctor) return;
    setPinError('');
    if (hasPin === false) {
      if (pinInput.length < 4) { setPinError('O PIN precisa ter ao menos 4 dígitos.'); return; }
      if (pinInput !== pinConfirm) { setPinError('Os PINs não coincidem.'); return; }
      await fbSetDoctorPin(clinicId, selectedDoctor.id, pinInput);
      saveSession(selectedDoctor);
      setStep('home');
      return;
    }
    const r = await fbCheckDoctorPin(clinicId, selectedDoctor.id, pinInput);
    if (r.valid) {
      saveSession(selectedDoctor);
      setStep('home');
    } else {
      setPinError('PIN incorreto.');
    }
  };

  useEffect(() => {
    if (step !== 'home' || !selectedDoctor) return;
    const load = () => {
      fbListAppointments(clinicId).then((list) => {
        setAppointments(
          list
            .filter((a) => (a.doctorId === selectedDoctor.id || a.doctorName === selectedDoctor.name) && a.status !== 'canceled')
            .filter((a) => a.date === selectedAgendaDate)
            .sort((a, b) => a.time.localeCompare(b.time))
        );
      });
      fbListScheduleBlocks(clinicId).then((list) => {
        setScheduleBlocks(list.filter((b) => b.doctorId === selectedDoctor.id));
      });
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [step, selectedDoctor, clinicId, selectedAgendaDate]);

  const handleSaveBlock = async () => {
    if (!selectedDoctor || !blockDate) return;
    const block = {
      id: `block_${Date.now()}`,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      date: blockDate,
      allDay: blockAllDay,
      startTime: blockAllDay ? '' : blockStartTime,
      endTime: blockAllDay ? '' : blockEndTime,
      reason: blockReason,
      createdAt: new Date().toISOString(),
    };
    await fbSaveScheduleBlock(clinicId, block);
    setScheduleBlocks((prev) => [...prev, block]);
    setBlockDate(todayISO()); setBlockAllDay(true); setBlockStartTime(''); setBlockEndTime(''); setBlockReason('');
  };

  const handleDeleteBlock = async (id: string) => {
    await fbDeleteScheduleBlock(clinicId, id);
    setScheduleBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const nowTime = new Date().toTimeString().slice(0, 5);
  const nextPatientIndex = selectedAgendaDate === todayISO() ? appointments.findIndex((a) => a.time >= nowTime) : -1;

  const openPatient = async (appt: Appointment) => {
    setSelectedPatient(appt);
    setComplaint(''); setConduct(''); setPrescription('');
    const patientId = appt.patientPhone.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const [profile, entries] = await Promise.all([
      fbGetPatientProfile(clinicId, patientId),
      fbListProntuario(clinicId, patientId),
    ]);
    setPatientProfile(profile);
    setProntuarioEntries(entries || []);
  };

  const handleSaveEvolution = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    if (!complaint.trim() && !conduct.trim()) return;
    setSavingEvolution(true);
    const patientId = selectedPatient.patientPhone.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const entry = {
      date: new Date().toLocaleDateString('pt-BR'),
      doctorName: selectedDoctor.name,
      specialty: selectedDoctor.specialty,
      complaint, conduct, prescription,
    };
    const saved = await fbSaveProntuarioEntry(clinicId, patientId, entry);
    setProntuarioEntries((prev) => [saved, ...prev]);
    setComplaint(''); setConduct(''); setPrescription('');
    setSavingEvolution(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('doctorPortal_session');
    setStep('email'); setSelectedDoctor(null); setPinInput(''); setPinConfirm('');
    setAppointments([]); setSelectedPatient(null);
  };

  // ── Restaura sessão salva ao carregar a página (evita pedir PIN de novo
  // toda vez que der F5) — sessão válida por 12 horas.
  useEffect(() => {
    const raw = localStorage.getItem('doctorPortal_session');
    if (!raw) { setRestoringSession(false); return; }
    try {
      const session = JSON.parse(raw);
      const twelveHours = 12 * 60 * 60 * 1000;
      if (!session.clinicEmail || !session.doctorId || Date.now() - session.timestamp > twelveHours) {
        localStorage.removeItem('doctorPortal_session');
        setRestoringSession(false);
        return;
      }
      setClinicEmail(session.clinicEmail);
      fbListDoctors(session.clinicEmail).then((list) => {
        const doc = list.find((d) => d.id === session.doctorId);
        if (doc) {
          setDoctors(list);
          setSelectedDoctor(doc);
          setStep('home');
        } else {
          localStorage.removeItem('doctorPortal_session');
        }
        setRestoringSession(false);
      }).catch(() => setRestoringSession(false));
    } catch {
      setRestoringSession(false);
    }
  }, []);

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs text-slate-400 font-sans">Carregando...</p>
      </div>
    );
  }

  // ── TELA: EMAIL DA CLÍNICA ─────────────────────────────────────────────
  if (step === 'email') {
    if (planBlocked) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-sm text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 font-sans mb-1">Recurso Premium</h1>
            <p className="text-xs text-slate-500 font-sans mb-6">
              O Portal do Médico é exclusivo do plano <strong>Premium</strong>. Fale com a administração da clínica pra fazer upgrade do plano.
            </p>
            <button onClick={() => setPlanBlocked(false)} className="w-full text-xs font-bold text-[#1A6FA8] font-sans">← Tentar outro e-mail</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-[#1A6FA8]" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 font-sans mb-1">Portal do Médico</h1>
          <p className="text-xs text-slate-500 font-sans mb-6">Digite o e-mail de acesso da sua clínica no BotClínica.</p>
          <input
            type="email"
            value={clinicEmail}
            onChange={(e) => setClinicEmail(e.target.value)}
            placeholder="email@clinica.com.br"
            className="w-full text-center p-3 border border-slate-200 rounded-lg mb-3 font-sans text-sm"
          />
          {pinError && <p className="text-xs text-red-500 font-sans mb-3">{pinError}</p>}
          <button onClick={handleSubmitEmail} disabled={loading} className="w-full bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold py-3 rounded-lg text-sm font-sans disabled:opacity-50">
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
        </div>
      </div>
    );
  }

  // ── TELA: ESCOLHER MÉDICO ────────────────────────────────────────────────
  if (step === 'pickDoctor') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold text-slate-800 font-sans mb-1 text-center">Quem é você?</h1>
          <p className="text-xs text-slate-500 font-sans mb-5 text-center">Selecione seu nome na lista.</p>
          <div className="space-y-2">
            {doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => handlePickDoctor(d)}
                className="w-full text-left flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#1A6FA8] text-white flex items-center justify-center font-bold text-sm font-sans">
                  {d.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 font-sans">{d.name}</p>
                  <p className="text-[11px] text-slate-400 font-sans">{d.specialty}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── TELA: PIN ────────────────────────────────────────────────────────────
  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-[#1A6FA8]" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 font-sans mb-1">
            {hasPin === false ? `Criar PIN, Dr(a). ${selectedDoctor?.name}` : `Bem-vindo(a), Dr(a). ${selectedDoctor?.name}`}
          </h2>
          <p className="text-xs text-slate-500 font-sans mb-6">
            {hasPin === false ? 'Defina um PIN pessoal de acesso ao seu portal.' : 'Digite seu PIN de acesso.'}
          </p>
          <input
            type="password" inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="PIN (4 a 6 dígitos)"
            className="w-full text-center text-lg tracking-widest p-3 border border-slate-200 rounded-lg mb-3 font-sans"
          />
          {hasPin === false && (
            <input
              type="password" inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Confirme o PIN"
              className="w-full text-center text-lg tracking-widest p-3 border border-slate-200 rounded-lg mb-3 font-sans"
            />
          )}
          {pinError && <p className="text-xs text-red-500 font-sans mb-3">{pinError}</p>}
          <button onClick={handleUnlock} className="w-full bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold py-3 rounded-lg text-sm font-sans flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {hasPin === false ? 'Criar e Entrar' : 'Entrar'}
          </button>
          <button onClick={() => setStep('pickDoctor')} className="w-full text-xs text-slate-400 font-sans mt-3">← Não sou eu</button>
        </div>
      </div>
    );
  }

  // ── TELA PRINCIPAL: AGENDA + PRONTUÁRIO ─────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800 font-sans">Dr(a). {selectedDoctor?.name}</p>
          <p className="text-[11px] text-slate-400 font-sans">{selectedDoctor?.specialty} · Agenda de hoje</p>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-xs font-sans">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>

      <div className="p-4 grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
        {/* Agenda do dia */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          {/* Seletor de dias */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {Array.from({ length: 7 }).map((_, i) => {
              const dateStr = addDaysISO(todayISO(), i);
              const isSelected = dateStr === selectedAgendaDate;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedAgendaDate(dateStr)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition-colors ${
                    isSelected ? 'bg-[#1A6FA8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {formatDayLabel(dateStr)}
                </button>
              );
            })}
          </div>
          <h2 className="text-sm font-bold text-slate-700 font-sans mb-3 flex items-center justify-between">
            Agenda de {formatDayLabel(selectedAgendaDate)} ({appointments.length})
            <button onClick={() => setShowBlockModal(true)} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700">
              <CalendarOff className="w-3.5 h-3.5" /> Bloquear Agenda
            </button>
          </h2>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {appointments.length === 0 && <p className="text-xs text-slate-400 font-sans text-center py-8">Nenhum agendamento nesse dia.</p>}
            {appointments.map((a, i) => (
              <button
                key={a.id}
                onClick={() => openPatient(a)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedPatient?.id === a.id ? 'border-[#1A6FA8] bg-blue-50' :
                  i === nextPatientIndex ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700 font-sans flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />{a.time}
                  </p>
                  {i === nextPatientIndex && <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full font-sans">PRÓXIMO</span>}
                </div>
                <p className="text-xs text-slate-600 font-sans mt-1">{a.patientName}</p>
                <p className="text-[10px] text-slate-400 font-sans flex items-center gap-1"><Phone className="w-3 h-3" />{a.patientPhone}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Prontuário do paciente selecionado */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          {!selectedPatient ? (
            <p className="text-xs text-slate-400 font-sans text-center py-16">Selecione um paciente na agenda pra ver o prontuário.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1A6FA8]" />
                <p className="text-sm font-bold text-slate-800 font-sans">{selectedPatient.patientName}</p>
              </div>

              {patientProfile && (
                <div className="grid grid-cols-2 gap-2 text-[11px] font-sans bg-slate-50 rounded-lg p-3">
                  <div><span className="text-slate-400">Alergias:</span> {patientProfile.allergies || 'Nenhuma'}</div>
                  <div><span className="text-slate-400">Comorbidades:</span> {patientProfile.comorbidities || 'Nenhuma'}</div>
                  <div><span className="text-slate-400">Medicações:</span> {patientProfile.continuousMeds || 'Nenhuma'}</div>
                  <div><span className="text-slate-400">Cirurgias:</span> {patientProfile.prevSurgeries || 'Nenhuma'}</div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase font-sans">Nova Evolução</p>
                <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Queixa principal..." rows={2} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                <textarea value={conduct} onChange={(e) => setConduct(e.target.value)} placeholder="Conduta / observações..." rows={2} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} placeholder="Prescrição (opcional)..." rows={2} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                <button onClick={handleSaveEvolution} disabled={savingEvolution} className="w-full bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold py-2.5 rounded-lg text-xs font-sans flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {savingEvolution ? 'Salvando...' : 'Salvar Evolução'}
                </button>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase font-sans mb-2">Histórico ({prontuarioEntries.length})</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {prontuarioEntries.map((e) => (
                    <div key={e.id} className="border border-slate-100 rounded-lg p-2.5 text-[11px] font-sans">
                      <p className="text-slate-400">{e.date} · {e.doctorName}</p>
                      {e.complaint && <p className="mt-1"><strong>Queixa:</strong> {e.complaint}</p>}
                      {e.conduct && <p><strong>Conduta:</strong> {e.conduct}</p>}
                      {e.prescription && <p><strong>Prescrição:</strong> {e.prescription}</p>}
                    </div>
                  ))}
                  {prontuarioEntries.length === 0 && <p className="text-xs text-slate-300 font-sans text-center py-4">Nenhuma evolução registrada ainda.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Bloqueio de Agenda */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 font-sans flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-amber-600" /> Bloquear Minha Agenda
              </h3>
              <button onClick={() => setShowBlockModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Data</label>
                <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
              </div>
              <label className="flex items-center gap-2 text-xs font-sans text-slate-600">
                <input type="checkbox" checked={blockAllDay} onChange={(e) => setBlockAllDay(e.target.checked)} />
                Bloquear o dia todo
              </label>
              {!blockAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Das</label>
                    <input type="time" value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Até</label>
                    <input type="time" value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Motivo (opcional)</label>
                <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Ex: Imprevisto" className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
              </div>
              <button
                onClick={handleSaveBlock}
                disabled={!blockDate || (!blockAllDay && (!blockStartTime || !blockEndTime))}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-xs font-sans"
              >
                Adicionar Bloqueio
              </button>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase font-sans mb-2">Meus bloqueios ativos</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {scheduleBlocks.length === 0 && <p className="text-xs text-slate-400 font-sans text-center py-3">Nenhum bloqueio cadastrado.</p>}
                  {scheduleBlocks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs font-sans">
                      <div>
                        <span className="font-bold text-slate-700">{b.date}</span>
                        <span className="text-slate-500 ml-1.5">{b.allDay ? '(dia todo)' : `(${b.startTime}-${b.endTime})`}</span>
                      </div>
                      <button onClick={() => handleDeleteBlock(b.id)} className="text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
