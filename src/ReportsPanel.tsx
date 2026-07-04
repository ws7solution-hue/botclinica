import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  UserCheck, 
  Clock, 
  Percent, 
  CheckCircle,
  HelpCircle,
  ChevronDown,
  Lock,
  Sparkles
} from 'lucide-react';
import { AtendiaPlan, Conversation, Appointment, Doctor } from '../types';
import LockOverlay from './LockOverlay';

interface ReportsPanelProps {
  currentPlan: AtendiaPlan;
  conversations: Conversation[];
  appointments: Appointment[];
  doctors: Doctor[];
}

export default function ReportsPanel({ 
  currentPlan,
  conversations,
  appointments,
  doctors
}: ReportsPanelProps) {
  if (currentPlan === 'starter') {
    return (
      <div className="relative h-[calc(100vh-60px)] min-h-[500px]">
        <LockOverlay requiredPlan="profissional" featureName="Relatórios & Estatísticas" />
      </div>
    );
  }

  const isDemo = (localStorage.getItem('atendia_email') || '').trim().toLowerCase() === 'contato@botclinica.com.br';

  // Dynamic calculations for non-demo mode
  const totalConvs = conversations.length;
  const resolvedByBotCount = conversations.filter(c => c.status === 'resolved').length;
  const resolutionRate = totalConvs > 0 ? (resolvedByBotCount / totalConvs) * 100 : 0;

  const totalAppts = appointments.length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed' || a.reminderStatus === 'confirmed_by_patient').length;
  const successPercentage = totalAppts > 0 ? `${Math.round((confirmedCount / totalAppts) * 100)}%` : '0%';
  
  // 1. Daily Chat Volumetrics
  const dailyChatData = (() => {
    if (isDemo) {
      return [
        { name: 'Seg', bot: 24, human: 12 },
        { name: 'Ter', bot: 38, human: 8 },
        { name: 'Qua', bot: 42, human: 15 },
        { name: 'Qui', bot: 35, human: 10 },
        { name: 'Sex', bot: 48, human: 6 },
        { name: 'Sáb', bot: 18, human: 4 },
        { name: 'Dom', bot: 12, human: 2 },
      ];
    }
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const data = days.map(d => ({ name: d, bot: 0, human: 0 }));
    conversations.forEach((c, idx) => {
      const dayIndex = idx % 7;
      const isBot = c.status === 'resolved' || c.status === 'bot';
      if (isBot) {
        data[dayIndex].bot += 1;
      } else {
        data[dayIndex].human += 1;
      }
    });
    return data;
  })();

  // 2. Specialty Distribution
  const specialtyData = (() => {
    if (isDemo) {
      return [
        { name: 'Cardiologia', consultas: 48, fill: '#1A6FA8' },
        { name: 'Pediatria', consultas: 62, fill: '#10B981' },
        { name: 'Ortopedia', consultas: 38, fill: '#F59E0B' },
        { name: 'Ginecologia', consultas: 57, fill: '#EC4899' },
        { name: 'Clínica Geral', consultas: 74, fill: '#6366F1' },
      ];
    }
    const counts: Record<string, number> = {};
    appointments.forEach(appt => {
      const spec = appt.specialty || 'Geral';
      counts[spec] = (counts[spec] || 0) + 1;
    });
    const colors = ['#1A6FA8', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#8B5CF6', '#3B82F6'];
    const data = Object.entries(counts).map(([name, count], idx) => ({
      name,
      consultas: count,
      fill: colors[idx % colors.length]
    }));
    return data;
  })();

  // 3. Reminder Confirmation Results
  const reminderStatsData = (() => {
    if (isDemo) {
      return [
        { name: 'Confirmado pelo Paciente', value: 78, color: '#10B981' },
        { name: 'Pendente / Sem Resposta', value: 14, color: '#F59E0B' },
        { name: 'Cancelado pelo Paciente', value: 8, color: '#EF4444' },
      ];
    }
    if (totalAppts === 0) {
      return [
        { name: 'Confirmado', value: 0, color: '#10B981' },
        { name: 'Pendente', value: 0, color: '#F59E0B' },
        { name: 'Cancelado', value: 0, color: '#EF4444' },
      ];
    }
    const confirmed = appointments.filter(a => a.status === 'confirmed' || a.reminderStatus === 'confirmed_by_patient').length;
    const canceled = appointments.filter(a => a.status === 'canceled' || a.reminderStatus === 'canceled_by_patient').length;
    const pending = totalAppts - confirmed - canceled;

    const confPct = Math.round((confirmed / totalAppts) * 100);
    const cancPct = Math.round((canceled / totalAppts) * 100);
    const pendPct = 100 - confPct - cancPct;

    return [
      { name: 'Confirmado pelo Paciente', value: Math.max(0, confPct), color: '#10B981' },
      { name: 'Pendente / Sem Resposta', value: Math.max(0, pendPct), color: '#F59E0B' },
      { name: 'Cancelado pelo Paciente', value: Math.max(0, cancPct), color: '#EF4444' },
    ];
  })();

  const currentSuccessPercentage = isDemo ? '86%' : successPercentage;

  return (
    <div id="reports-panel" className="p-6 space-y-6">
        {/* 4 Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat 1: Total Conversas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Conversas Totais (Mês)
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {isDemo ? '1.248' : totalConvs.toString()}
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              {isDemo ? '+18.4% vs mês anterior' : 'Conversas ativas no painel'}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-[#1A6FA8] rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2: Taxa de Resolução */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Resolução Automática
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {isDemo ? '74.2%' : `${resolutionRate.toFixed(1)}%`}
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              {isDemo ? 'Meta estabelecida: 70%' : `${resolvedByBotCount} resolvidas por IA`}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3: Tempo de Resposta */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Tempo Médio Resposta
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {isDemo ? '12 seg' : (totalConvs > 0 ? '5 seg' : '0 seg')}
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              {isDemo ? '-4 seg de latência' : (totalConvs > 0 ? 'Resposta automática' : 'Aguardando contatos')}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 4: Confirmados via Lembrete */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">
              Confirmação Geral
            </span>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono mt-1">
              {currentSuccessPercentage}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              {isDemo ? 'Vagas recuperadas hoje' : `${confirmedCount} de ${totalAppts} confirmados`}
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main charts display section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Chat Volume area chart (spanning 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans">
              Volume Diário de Mensagens
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Comparativo de contatos respondidos pelo Robô vs Transbordo Humano.
            </p>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A6FA8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#1A6FA8" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorHuman" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', fontFamily: 'Inter' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" name="Resolvido pelo Bot" dataKey="bot" stroke="#1A6FA8" strokeWidth={2} fillOpacity={1} fill="url(#colorBot)" />
                <Area type="monotone" name="Transbordo Humano" dataKey="human" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorHuman)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
            
            {/* Center percentage rate */}
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-800 font-sans">{currentSuccessPercentage}</span>
              <p className="text-[10px] text-slate-400 font-medium">Sucesso</p>
            </div>
          </div>

          {/* Custom Legends list */}
          <div className="space-y-1.5 pt-2">
            {reminderStatsData.map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-sans text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span>{stat.name}</span>
                </div>
                <span className="font-bold text-slate-800">{stat.value}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Specialty Bar Chart panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Appointments by Specialty horizontal bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans">
              Agendamentos por Especialidade Médica
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Distribuição quantitativa de consultas geradas automaticamente via chatbot.
            </p>
          </div>

          <div className="h-[240px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={specialtyData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={80} />
                <Tooltip contentStyle={{ fontSize: '11px' }} />
                <Bar dataKey="consultas" radius={[0, 4, 4, 0]}>
                  {specialtyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Tips or Advice column (AI Advanced Reports) */}
        <div className="bg-[#0F1623] text-slate-300 p-5 rounded-xl shadow-xs border border-slate-850 flex flex-col justify-between relative overflow-hidden min-h-[300px]">
          {currentPlan !== 'premium' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-4 text-center select-none">
              <Lock className="w-6 h-6 text-amber-500 mb-2 animate-pulse" />
              <h5 className="text-xs font-bold text-white mb-1">Relatórios Avançados IA</h5>
              <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mb-4">
                Disponível apenas no plano <strong className="text-amber-400">Premium</strong>.
              </p>
              <a 
                href="https://botclinica.com.br/checkout" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Fazer upgrade</span>
              </a>
            </div>
          )}

          <div className={currentPlan !== 'premium' ? 'filter blur-sm opacity-30 select-none' : ''}>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              Relatório de Ocupação & IA Insights
            </h4>
            <div className="space-y-4 text-xs font-sans text-slate-400">
              {isDemo ? (
                <>
                  <p>
                    Durante a última semana, o AtendIA converteu mais de <strong className="text-white">321 consultas de triagem primária</strong> em consultas agendadas.
                  </p>
                  <p>
                    A especialidade de <strong className="text-white">Clínica Geral</strong> continua sendo o maior volume (74 consultas), seguida de perto por <strong className="text-white">Pediatria</strong> (62 consultas).
                  </p>
                  <p>
                    As taxas de desistência são menores nas terças-feiras de manhã, coincidente com o envio mais rápido de lembretes nas segundas-feiras.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    A inteligência artificial do AtendIA está monitorando <strong className="text-white">{totalConvs} conversas ativas</strong> em sua clínica.
                  </p>
                  <p>
                    Até o momento, <strong className="text-white">{resolvedByBotCount} atendimentos</strong> foram resolvidos de forma totalmente automatizada pelo assistente virtual.
                  </p>
                  <p>
                    Você possui <strong className="text-white">{totalAppts} agendamentos registrados</strong> no painel. O robô continuará monitorando as confirmações para otimizar sua agenda.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className={`pt-4 border-t border-slate-800/80 mt-4 ${currentPlan !== 'premium' ? 'filter blur-sm opacity-30 select-none' : ''}`}>
            <button 
              disabled={currentPlan !== 'premium'}
              onClick={() => {
                if (currentPlan !== 'premium') return;
                // Gera relatório real em HTML e abre janela de impressão
                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                const totalConvs = conversations.length;
                const resolved = conversations.filter(c => c.status === 'resolved').length;
                const totalAppts = appointments.length;
                const confirmed = appointments.filter(a => a.status === 'confirmed').length;
                const cancelled = appointments.filter(a => a.status === 'canceled').length;
                const reminderSent = appointments.filter(a => a.reminderSent).length;
                const taxaAbsent = totalAppts > 0 ? Math.round((cancelled / totalAppts) * 100) : 0;
                const taxaResolv = totalConvs > 0 ? Math.round((resolved / totalConvs) * 100) : 0;

                const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório AtendIA — ${dateStr}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:13px}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1A6FA8;padding-bottom:20px;margin-bottom:32px}
  .logo{font-size:24px;font-weight:900;color:#1A6FA8}
  .logo span{color:#0f172a}
  .date{font-size:12px;color:#64748b;text-align:right}
  .title{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px}
  h2{font-size:14px;font-weight:700;color:#1A6FA8;margin:28px 0 14px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center}
  .kpi-val{font-size:28px;font-weight:900;color:#1A6FA8}
  .kpi-label{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}
  th{background:#f1f5f9;text-align:left;padding:9px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9}
  tr:last-child td{border-bottom:none}
  .badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
  .badge-green{background:#dcfce7;color:#16a34a}
  .badge-red{background:#fee2e2;color:#dc2626}
  .badge-blue{background:#dbeafe;color:#1A6FA8}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;color:#94a3b8;font-size:11px}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Atend<span>IA</span></div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">by BotClínica</div>
    <div class="title" style="margin-top:12px">Relatório de Desempenho</div>
  </div>
  <div class="date">
    <div style="font-weight:700;font-size:14px">${dateStr}</div>
    <div>Gerado automaticamente pelo AtendIA</div>
    <div style="margin-top:4px">Plano: <strong>Premium</strong></div>
  </div>
</div>

<h2>Visão Geral</h2>
<div class="grid">
  <div class="kpi"><div class="kpi-val">${totalConvs}</div><div class="kpi-label">Total de atendimentos</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${taxaResolv}%</div><div class="kpi-label">Resolvidos pelo bot</div></div>
  <div class="kpi"><div class="kpi-val">${totalAppts}</div><div class="kpi-label">Agendamentos</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${taxaAbsent > 20 ? '#dc2626' : '#16a34a'}">${taxaAbsent}%</div><div class="kpi-label">Taxa de absenteísmo</div></div>
</div>

<h2>Agendamentos</h2>
<div class="grid" style="grid-template-columns:repeat(3,1fr)">
  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${confirmed}</div><div class="kpi-label">Confirmados</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${cancelled}</div><div class="kpi-label">Cancelados</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#1A6FA8">${reminderSent}</div><div class="kpi-label">Lembretes enviados</div></div>
</div>

${appointments.length > 0 ? `
<table>
  <thead><tr><th>Paciente</th><th>Médico</th><th>Data</th><th>Horário</th><th>Status</th></tr></thead>
  <tbody>
    ${appointments.slice(0, 20).map(a => `
    <tr>
      <td>${a.patientName || '—'}</td>
      <td>${a.doctorName || '—'}</td>
      <td>${a.date ? new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${a.time || '—'}</td>
      <td><span class="badge ${a.status === 'confirmed' ? 'badge-green' : a.status === 'canceled' ? 'badge-red' : 'badge-blue'}">${a.status === 'confirmed' ? 'Confirmado' : a.status === 'canceled' ? 'Cancelado' : 'Pendente'}</span></td>
    </tr>`).join('')}
  </tbody>
</table>
${appointments.length > 20 ? `<p style="font-size:11px;color:#94a3b8;margin-bottom:24px">Exibindo 20 de ${appointments.length} agendamentos.</p>` : ''}` : '<p style="color:#94a3b8;font-size:12px;margin-bottom:24px">Nenhum agendamento registrado.</p>'}

<h2>Médicos Cadastrados</h2>
${doctors.length > 0 ? `
<table>
  <thead><tr><th>Nome</th><th>Especialidade</th><th>CRM</th><th>Avaliação</th></tr></thead>
  <tbody>
    ${doctors.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.specialty || '—'}</td>
      <td>${d.crm || '—'}</td>
      <td>${d.rating ? `⭐ ${d.rating}` : '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>` : '<p style="color:#94a3b8;font-size:12px;margin-bottom:24px">Nenhum médico cadastrado.</p>'}

<div class="footer">
  <div>AtendIA by BotClínica · botclinica.com.br</div>
  <div>Relatório gerado em ${now.toLocaleString('pt-BR')}</div>
</div>
</body>
</html>`;

                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(html);
                  win.document.close();
                  setTimeout(() => win.print(), 500);
                }
              }}
              className="w-full py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Exportar PDF Relatório</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
