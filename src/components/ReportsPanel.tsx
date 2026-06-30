import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  UserCheck, 
  Percent, 
  CheckCircle,
} from 'lucide-react';
import { Conversation, Appointment, Doctor } from '../types';

interface ReportsPanelProps {
  conversations: Conversation[];
  appointments: Appointment[];
  doctors: Doctor[];
}

const SPECIALTY_COLORS = ['#1A6FA8', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#0EA5E9', '#F43F5E'];

export default function ReportsPanel({ conversations, appointments, doctors }: ReportsPanelProps) {

  // ── Estatísticas reais de conversas ──
  const totalConversations = conversations.length;
  const resolvedByBotCount = conversations.filter(c => c.status === 'resolved' || c.status === 'bot').length;
  const resolutionRate = totalConversations > 0 ? Math.round((resolvedByBotCount / totalConversations) * 100) : 0;

  // ── Status do atendimento (Bot vs Transbordo Humano) ──
  const statusData = [
    { name: 'Resolvido pelo Bot', value: conversations.filter(c => c.status === 'bot' || c.status === 'resolved').length },
    { name: 'Transbordo Humano', value: conversations.filter(c => c.status === 'human_needed' || c.status === 'human_active').length },
  ];

  // ── Distribuição real de agendamentos por especialidade ──
  const specialtyCounts: Record<string, number> = {};
  appointments.forEach(a => {
    const key = a.specialty || 'Não informado';
    specialtyCounts[key] = (specialtyCounts[key] || 0) + 1;
  });
  const specialtyData = Object.entries(specialtyCounts)
    .map(([name, consultas], i) => ({ name, consultas, fill: SPECIALTY_COLORS[i % SPECIALTY_COLORS.length] }))
    .sort((a, b) => b.consultas - a.consultas);

  // ── Efetividade real dos lembretes (a partir de reminderStatus) ──
  const totalReminders = appointments.filter(a => a.reminderSent).length;
  const confirmedCount = appointments.filter(a => a.reminderStatus === 'confirmed_by_patient').length;
  const canceledCount = appointments.filter(a => a.reminderStatus === 'canceled_by_patient').length;
  const pendingCount = Math.max(totalReminders - confirmedCount - canceledCount, 0);
  const confirmationRate = totalReminders > 0 ? Math.round((confirmedCount / totalReminders) * 100) : 0;

  const reminderStatsData = totalReminders > 0 ? [
    { name: 'Confirmado pelo Paciente', value: confirmedCount, color: '#10B981' },
    { name: 'Pendente / Sem Resposta', value: pendingCount, color: '#F59E0B' },
    { name: 'Cancelado pelo Paciente', value: canceledCount, color: '#EF4444' },
  ] : [];

  const topSpecialty = specialtyData[0];
  const secondSpecialty = specialtyData[1];

  return (
    <div id="reports-panel" className="p-6 space-y-6">
      
      {/* 4 Summary stat cards — todos com dados reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Conversas Totais
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {totalConversations}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Total acumulado no WhatsApp
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-[#1A6FA8] rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Resolução Automática
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {resolutionRate}%
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Conversas fechadas sem humano
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Médicos Ativos
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {doctors.filter(d => d.isActive).length} / {doctors.length}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Cadastrados no AtendIA
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Confirmação de Lembretes
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {totalReminders > 0 ? `${confirmationRate}%` : '—'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              {totalReminders > 0 ? 'Vagas confirmadas via lembrete' : 'Nenhum lembrete enviado ainda'}
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main charts display section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status atual das conversas (bot vs humano) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans">
              Conversas por Status
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Comparativo de contatos resolvidos pelo Robô vs Transbordo Humano (snapshot atual).
            </p>
          </div>

          {totalConversations > 0 ? (
            <div className="h-[280px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', fontFamily: 'Inter' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="value" name="Conversas" radius={[4, 4, 0, 0]} fill="#1A6FA8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400 font-sans">
              Nenhuma conversa registrada ainda.
            </div>
          )}
        </div>

        {/* Reminder Confirmation Status chart (1 column) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans">
              Efetividade dos Lembretes
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Resultados de confirmação após recebimento de notificação.
            </p>
          </div>

          {totalReminders > 0 ? (
            <>
              <div className="h-[200px] flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={{ fontSize: '11px' }} />
                    <Pie
                      data={reminderStatsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {reminderStatsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-slate-800 font-sans">{confirmationRate}%</span>
                  <p className="text-[10px] text-slate-400 font-medium">Sucesso</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                {reminderStatsData.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-sans text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span>{stat.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{stat.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 font-sans text-center px-4">
              Nenhum lembrete enviado ainda.
            </div>
          )}
        </div>

      </div>

      {/* Specialty Bar Chart panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans">
              Agendamentos por Especialidade Médica
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Distribuição real de consultas geradas via chatbot.
            </p>
          </div>

          {specialtyData.length > 0 ? (
            <div className="h-[240px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={specialtyData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="consultas" radius={[0, 4, 4, 0]}>
                    {specialtyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400 font-sans">
              Nenhum agendamento registrado ainda.
            </div>
          )}
        </div>

        {/* Resumo real, sem texto fictício */}
        <div className="bg-[#0F1623] text-slate-300 p-5 rounded-xl shadow-xs border border-slate-850 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Resumo da Clínica
            </h4>
            <div className="space-y-4 text-xs font-sans text-slate-400">
              {appointments.length > 0 ? (
                <p>
                  Até o momento, o AtendIA registrou <strong className="text-white">{appointments.length} agendamento(s)</strong> no total.
                </p>
              ) : (
                <p>Ainda não há agendamentos registrados nesta clínica.</p>
              )}
              {topSpecialty && (
                <p>
                  A especialidade de <strong className="text-white">{topSpecialty.name}</strong> lidera em volume ({topSpecialty.consultas} consulta{topSpecialty.consultas !== 1 ? 's' : ''})
                  {secondSpecialty ? <>, seguida por <strong className="text-white">{secondSpecialty.name}</strong> ({secondSpecialty.consultas})</> : null}.
                </p>
              )}
              <p>
                {doctors.filter(d => d.isActive).length} de {doctors.length} médico(s) cadastrado(s) estão ativos no momento.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
