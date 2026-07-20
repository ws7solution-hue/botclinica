import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  User, 
  Clock, 
  Phone, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Stethoscope,
  Send,
  X,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { Appointment, Doctor, AtendiaPlan } from '../types';
import LockOverlay from './LockOverlay';
import { fbCancelAppointment, fbMarkReminderSent, fbDeleteAppointment } from '../firebase';

interface CalendarPanelProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  doctors: Doctor[];
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setQuickAddOpen: (open: boolean) => void;
  currentPlan: AtendiaPlan;
  setActiveTab?: (tab: any) => void;
}

export default function CalendarPanel({
  appointments,
  setAppointments,
  doctors,
  onAddSystemLog,
  setQuickAddOpen,
  currentPlan,
  setActiveTab
}: CalendarPanelProps) {
  if (currentPlan === 'starter') {
    return (
      <div className="relative h-[calc(100vh-60px)] min-h-[500px]">
        <LockOverlay requiredPlan="profissional" featureName="Agenda & Consultas" onUpgradeClick={setActiveTab ? () => setActiveTab('settings') : undefined} />
      </div>
    );
  }

  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const clinicId = localStorage.getItem('atendia_email')?.toLowerCase().replace(/[@.]/g, '_') || '';

  // Toggle Reminder Status to simulate resending
  const handleTriggerReminder = async (apptId: string) => {
    setUpdatingApptId(apptId);
    try {
      const appt = appointments.find(a => a.id === apptId);
      if (!appt) return;

      // Envia via Baileys real
      const email = localStorage.getItem('atendia_email') || '';
      const msg = `Olá, ${appt.patientName}! 👋 Lembramos que você tem uma consulta com ${appt.doctorName} no dia ${new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR')}, às ${appt.time}.\n\nConfirme sua presença respondendo *Confirmo* ou cancele com *Cancelar*.\n\nAguardamos você! 🏥`;

      if (email) {
        await fetch(`https://api.botclinica.com.br/wa/send/${encodeURIComponent(email)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: appt.patientPhone, text: msg }),
        });
      }

      await fbMarkReminderSent(apptId, clinicId);
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, reminderSent: true, reminderStatus: 'sent' } : a));
      onAddSystemLog('success', `Lembrete enviado via WhatsApp para ${appt.patientName}.`);
    } catch (err: any) {
      onAddSystemLog('error', `Falha ao enviar lembrete: ${err.message}`);
    } finally {
      setUpdatingApptId(null);
    }
  };

  const handleDeleteAppointment = async (apptId: string) => {
    if (!confirm('Excluir esta consulta permanentemente?')) return;
    try {
      await fbDeleteAppointment(apptId, clinicId);
      setAppointments(prev => prev.filter(a => a.id !== apptId));
      onAddSystemLog('warning', 'Consulta excluída permanentemente.');
    } catch (err: any) {
      onAddSystemLog('error', `Falha ao excluir consulta: ${err.message}`);
    }
  };

  // Toggle booking status
  const handleCancelAppointment = async (apptId: string) => {
    setUpdatingApptId(apptId);
    try {
      // 1. Update in backend
      await fbCancelAppointment(apptId, clinicId);

      // 2. Update local state
      setAppointments(prev => prev.map(a => {
        if (a.id === apptId) {
          return {
            ...a,
            status: 'canceled',
            reminderStatus: 'canceled_by_patient'
          };
        }
        return a;
      }));
      
      const appt = appointments.find(a => a.id === apptId);
      if (appt) {
        onAddSystemLog('warning', `Consulta de ${appt.patientName} cancelada e vaga liberada.`);
        // TODO: notificar paciente via WhatsApp sobre cancelamento
      }
    } catch (err: any) {
      console.error(err);
      onAddSystemLog('error', `Falha ao cancelar consulta: ${err.message}`);
    } finally {
      setUpdatingApptId(null);
    }
  };

  // Calendar computation
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasAppt = appointments.some(a => a.date === dateStr && a.status !== 'canceled');
      days.push({ day: d, dateStr, hasAppt });
    }
    return days;
  }, [calendarDate, appointments]);

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const todayObj = new Date(); const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,'0')}-${String(todayObj.getDate()).padStart(2,'0')}`;

  // Filtered appointments
  const filteredAppointments = appointments.filter(appt => {
    const matchesDoc = selectedDoctorFilter === 'all' || appt.doctorId === selectedDoctorFilter;
    const matchesStatus = selectedStatusFilter === 'all' || appt.status === selectedStatusFilter;
    const matchesSearch = appt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          appt.patientPhone.includes(searchTerm);
    const matchesDay = !selectedDay || appt.date === selectedDay;
    return matchesDoc && matchesStatus && matchesSearch && matchesDay;
  });

  return (
    <div id="calendar-panel" className="p-6 space-y-6">

      {/* CALENDÁRIO MENSAL */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        {/* Header do calendário */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth()-1); setCalendarDate(d); setSelectedDay(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h3 className="text-sm font-bold text-slate-800 font-sans">
            {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
          </h3>
          <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth()+1); setCalendarDate(d); setSelectedDay(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1 font-sans">{d}</div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const isToday = day.dateStr === today;
            const isSelected = day.dateStr === selectedDay;
            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDay(selectedDay === day.dateStr ? null : day.dateStr)}
                className={`relative flex flex-col items-center justify-center py-2 rounded-lg text-xs font-sans font-semibold transition-all
                  ${isSelected ? 'bg-[#1A6FA8] text-white' : isToday ? 'bg-blue-50 text-[#1A6FA8] border border-[#1A6FA8]' : 'hover:bg-slate-50 text-slate-700'}
                `}
              >
                {day.day}
                {day.hasAppt && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Com agendamentos
          </div>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="flex items-center gap-1 text-[11px] text-[#1A6FA8] font-sans hover:underline ml-auto">
              <X className="w-3 h-3" /> Limpar filtro
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        {selectedDay && (
          <div className="flex items-center gap-2 w-full pb-2 border-b border-slate-100">
            <span className="text-sm font-bold text-[#1A6FA8] font-sans">
              📅 {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long'})}
            </span>
            <span className="bg-[#1A6FA8] text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-sans">
              {filteredAppointments.length} consulta{filteredAppointments.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setSelectedDay(null)} className="ml-auto text-[11px] text-slate-400 hover:text-red-500 font-sans flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar filtro de data
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-patient-calendar"
              type="text"
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[200px] text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans"
            />
          </div>

          {/* Filter Doctor dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="select-filter-doctor"
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg p-1.5 bg-white text-slate-600 focus:outline-hidden font-sans"
            >
              <option value="all">Filtrar por Médico (Todos)</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <select
            id="select-filter-status"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg p-1.5 bg-white text-slate-600 focus:outline-hidden font-sans"
          >
            <option value="all">Filtrar por Status (Todos)</option>
            <option value="confirmed">Confirmados</option>
            <option value="pending">Pendentes</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>

        {/* Add Appointment Trigger Button */}
        <button
          id="btn-trigger-schedule-modal"
          onClick={() => setQuickAddOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer self-stretch md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agendar Nova Consulta</span>
        </button>
      </div>

      {/* Main Grid: Calendar list & Upcoming Schedule Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Appointments List (Roster Sheet) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                Prontuário de Consultas ({filteredAppointments.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredAppointments.map((appt) => (
                <div 
                  key={appt.id}
                  className={`p-4 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    appt.status === 'canceled' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-50 text-[#1A6FA8] rounded-xl shrink-0 mt-0.5">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-800 font-sans">
                          {appt.patientName}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-medium">
                          {appt.patientPhone}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 font-sans flex items-center gap-1">
                        Consulta com <strong className="font-semibold text-[#1A6FA8]">{appt.doctorName}</strong> ({appt.specialty})
                      </p>

                      <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1 text-slate-500 font-sans">
                          <Calendar className="w-3.5 h-3.5" /> {appt.date}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 font-sans">
                          <Clock className="w-3.5 h-3.5" /> {appt.time}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Reminders status columns */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t border-slate-100 pt-3 md:border-none md:pt-0">
                    
                    {/* Reminder Info status */}
                    <div className="flex flex-col items-start md:items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        appt.status === 'canceled' ? 'bg-red-50 text-red-700 border border-red-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {appt.status === 'confirmed' ? 'Confirmado' : appt.status === 'canceled' ? 'Cancelado' : 'Pendente'}
                      </span>

                      {/* WhatsApp Reminder status tag */}
                      {appt.reminderSent && (
                        <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                          WhatsApp: 
                          <span className={`font-semibold ${
                            appt.reminderStatus === 'confirmed_by_patient' ? 'text-emerald-600' :
                            appt.reminderStatus === 'canceled_by_patient' ? 'text-red-500' :
                            appt.reminderStatus === 'read' ? 'text-[#1A6FA8]' : 'text-slate-400'
                          }`}>
                            {appt.reminderStatus === 'confirmed_by_patient' ? 'Confirmou' :
                             appt.reminderStatus === 'canceled_by_patient' ? 'Cancelou' :
                             appt.reminderStatus === 'read' ? 'Lido' : 'Enviado'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center gap-1.5">
                      {appt.status !== 'canceled' && (
                        <>
                          <button
                            disabled={updatingApptId !== null}
                            onClick={() => handleTriggerReminder(appt.id)}
                            className={`p-1.5 hover:bg-blue-50 text-[#1A6FA8] hover:text-[#135480] rounded-lg border border-slate-200 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-center ${
                              updatingApptId !== null ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Disparar lembrete via WhatsApp"
                          >
                            {updatingApptId === appt.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1A6FA8]" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            disabled={updatingApptId !== null}
                            onClick={() => handleCancelAppointment(appt.id)}
                            className={`p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg border border-slate-200 hover:border-red-200 transition-all cursor-pointer flex items-center justify-center ${
                              updatingApptId !== null ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Cancelar consulta"
                          >
                            {updatingApptId === appt.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteAppointment(appt.id)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer flex items-center justify-center"
                            title="Excluir consulta permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                </div>
              ))}
              {filteredAppointments.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-sans">
                  Nenhuma consulta encontrada correspondente aos filtros.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Panel: Statistics on appointments */}
        <div className="space-y-6">
          
          {/* Quick Schedule Statistics summary */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
              Status Geral da Agenda
            </h4>
            
            <div className="space-y-3 font-sans text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Confirmadas:</span>
                <span className="font-bold text-slate-800">{appointments.filter(a => a.status === 'confirmed').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aguardando Confirmação:</span>
                <span className="font-bold text-slate-800">{appointments.filter(a => a.status === 'pending').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Canceladas:</span>
                <span className="font-bold text-slate-800">{appointments.filter(a => a.status === 'canceled').length}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex items-center justify-between font-semibold">
                <span className="text-slate-700">Total de agendamentos:</span>
                <span className="text-[#1A6FA8]">{appointments.length}</span>
              </div>
            </div>
          </div>

          {/* Alerta de Absenteísmo Real */}
          <div className="bg-[#0F1623] text-slate-300 p-5 rounded-xl shadow-xs border border-slate-850">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-sans flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Índice de Absenteísmo
            </h5>
            {(() => {
              const total = appointments.length;
              const cancelados = appointments.filter(a => a.status === 'canceled').length;
              const confirmados = appointments.filter(a => a.status === 'confirmed').length;
              const comLembrete = appointments.filter(a => a.reminderSent).length;
              const taxaAbsent = total > 0 ? Math.round((cancelados / total) * 100) : 0;
              const taxaConfirm = total > 0 ? Math.round((confirmados / total) * 100) : 0;
              const cobertura = total > 0 ? Math.round((comLembrete / total) * 100) : 0;

              if (total === 0) return (
                <p className="text-xs text-slate-400 font-sans">Nenhum agendamento registrado ainda. Os dados de absenteísmo aparecerão aqui conforme sua agenda for preenchida.</p>
              );

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className={`text-lg font-bold ${taxaAbsent > 20 ? 'text-red-400' : taxaAbsent > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{taxaAbsent}%</div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">Taxa de falta</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-emerald-400">{taxaConfirm}%</div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">Confirmados</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-400">{cobertura}%</div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">Com lembrete</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {total} agendamento{total !== 1 ? 's' : ''} no total · {cancelados} cancelado{cancelados !== 1 ? 's' : ''} · {comLembrete} lembrete{comLembrete !== 1 ? 's' : ''} enviado{comLembrete !== 1 ? 's' : ''}
                  </p>
                  {taxaAbsent > 20 && (
                    <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      <p className="text-[11px] text-red-400 font-sans">Taxa de faltas alta. Ative lembretes automáticos para reduzir cancelamentos.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

        </div>

      </div>

    </div>
  );
}
