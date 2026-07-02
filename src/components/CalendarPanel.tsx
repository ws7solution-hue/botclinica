import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { Appointment, Doctor, AtendiaPlan } from '../types';
import LockOverlay from './LockOverlay';
import { fbCancelAppointment, fbMarkReminderSent } from '../firebase';

interface CalendarPanelProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  doctors: Doctor[];
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setQuickAddOpen: (open: boolean) => void;
  currentPlan: AtendiaPlan;
}

export default function CalendarPanel({
  appointments,
  setAppointments,
  doctors,
  onAddSystemLog,
  setQuickAddOpen,
  currentPlan
}: CalendarPanelProps) {
  if (currentPlan === 'starter') {
    return (
      <div className="relative h-[calc(100vh-60px)] min-h-[500px]">
        <LockOverlay requiredPlan="profissional" featureName="Agenda & Consultas" />
      </div>
    );
  }

  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);

  const clinicId = localStorage.getItem('atendia_email')?.toLowerCase().replace(/[@.]/g, '_') || '';

  // Toggle Reminder Status to simulate resending
  const handleTriggerReminder = async (apptId: string) => {
    setUpdatingApptId(apptId);
    try {
      // 1. Update in backend
      await fbMarkReminderSent(apptId, clinicId);
      
      // 2. Update local state
      setAppointments(prev => prev.map(a => {
        if (a.id === apptId) {
          return {
            ...a,
            reminderSent: true,
            reminderStatus: 'sent'
          };
        }
        return a;
      }));
      
      const appt = appointments.find(a => a.id === apptId);
      if (appt) {
        onAddSystemLog('success', `Disparado lembrete manual via WhatsApp para ${appt.patientName}.`);
        // TODO: notificar paciente via WhatsApp sobre envio de lembrete
      }
    } catch (err: any) {
      console.error(err);
      onAddSystemLog('error', `Falha ao registrar envio de lembrete: ${err.message}`);
    } finally {
      setUpdatingApptId(null);
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

  // Filtered appointments
  const filteredAppointments = appointments.filter(appt => {
    const matchesDoc = selectedDoctorFilter === 'all' || appt.doctorId === selectedDoctorFilter;
    const matchesStatus = selectedStatusFilter === 'all' || appt.status === selectedStatusFilter;
    const matchesSearch = appt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          appt.patientPhone.includes(searchTerm);
    return matchesDoc && matchesStatus && matchesSearch;
  });

  return (
    <div id="calendar-panel" className="p-6 space-y-6">
      
      {/* Page header with Filter controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
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
