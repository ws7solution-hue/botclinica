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
  ChevronDown
} from 'lucide-react';

export default function ReportsPanel() {
  
  // 1. Mock Data for Daily Chat Volumetrics
  const dailyChatData = [
    { name: 'Seg', bot: 24, human: 12 },
    { name: 'Ter', bot: 38, human: 8 },
    { name: 'Qua', bot: 42, human: 15 },
    { name: 'Qui', bot: 35, human: 10 },
    { name: 'Sex', bot: 48, human: 6 },
    { name: 'Sáb', bot: 18, human: 4 },
    { name: 'Dom', bot: 12, human: 2 },
  ];

  // 2. Mock Data for Specialty Distribution
  const specialtyData = [
    { name: 'Cardiologia', consultas: 48, fill: '#1A6FA8' },
    { name: 'Pediatria', consultas: 62, fill: '#10B981' },
    { name: 'Ortopedia', consultas: 38, fill: '#F59E0B' },
    { name: 'Ginecologia', consultas: 57, fill: '#EC4899' },
    { name: 'Clínica Geral', consultas: 74, fill: '#6366F1' },
  ];

  // 3. Mock Data for Reminder Confirmation Results
  const reminderStatsData = [
    { name: 'Confirmado pelo Paciente', value: 78, color: '#10B981' },
    { name: 'Pendente / Sem Resposta', value: 14, color: '#F59E0B' },
    { name: 'Cancelado pelo Paciente', value: 8, color: '#EF4444' },
  ];

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
              1.248
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              +18.4% vs mês anterior
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
              74.2%
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              Meta estabelecida: 70%
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
              12 seg
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 font-sans">
              -4 seg de latência
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
              86.4%
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Vagas recuperadas hoje
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
              <span className="text-2xl font-black text-slate-800 font-sans">86%</span>
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

        {/* Quick Tips or Advice column */}
        <div className="bg-[#0F1623] text-slate-300 p-5 rounded-xl shadow-xs border border-slate-850 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Relatório de Ocupação Clinica
            </h4>
            <div className="space-y-4 text-xs font-sans text-slate-400">
              <p>
                Durante a última semana, o AtendIA converteu mais de <strong className="text-white">321 consultas de triagem primária</strong> em consultas agendadas.
              </p>
              <p>
                A especialidade de <strong className="text-white">Clínica Geral</strong> continua sendo o maior volume (74 consultas), seguida de perto por <strong className="text-white">Pediatria</strong> (62 consultas).
              </p>
              <p>
                As taxas de desistência são menores nas terças-feiras de manhã, coincidente com o envio mais rápido de lembretes nas segundas-feiras.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 mt-4">
            <button className="w-full py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1">
              <span>Exportar PDF Relatório</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
