import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  Download, Calendar, Repeat, X, ShieldCheck, Search, Users, Phone,
  Target, AlertTriangle, FileSpreadsheet, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Doctor, Appointment, Conversation, AtendiaPlan } from '../types';
import LockOverlay from './LockOverlay';
import {
  fbCheckFinanceiroPin, fbSetFinanceiroPin, fbListFinanceiroEntries,
  fbSaveFinanceiroEntry, fbDeleteFinanceiroEntry,
  fbGetFinanceiroConfig, fbSetFinanceiroConfig
} from '../firebase';

interface FinanceiroEntry {
  id: string;
  type: 'receita' | 'despesa';
  category: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  recurring?: boolean;
  createdAt?: string;
}

interface FinanceiroPanelProps {
  clinicId: string;
  doctors: Doctor[];
  appointments: Appointment[];
  conversations: Conversation[];
  currentPlan: AtendiaPlan;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setActiveTab?: (tab: any) => void;
}

const DESPESA_CATEGORIES = [
  'Aluguel', 'Condomínio/IPTU', 'Água/Luz/Internet', 'Salários', 'Pró-labore',
  'Encargos (INSS/FGTS)', 'Repasse médico', 'Insumos/Materiais',
  'Manutenção/Equipamentos', 'Marketing', 'Impostos/Taxas', 'Contabilidade',
  'Convênios (taxas)', 'Outras despesas'
];

const RECEITA_CATEGORIES = [
  'Consulta particular', 'Consulta convênio', 'Procedimento/Exame',
  'Aluguel de sala', 'Venda de produtos', 'Outras receitas'
];

const COLORS = ['#1A6FA8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FinanceiroPanel({ clinicId, doctors, appointments, conversations, currentPlan, onAddSystemLog, setActiveTab }: FinanceiroPanelProps) {
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedPatientPhone, setSelectedPatientPhone] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [checkingPin, setCheckingPin] = useState(true);

  const [entries, setEntries] = useState<FinanceiroEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [metaMensal, setMetaMensal] = useState<number>(0);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'crm' | 'medicos' | 'receitas' | 'despesas' | 'relatorios'>('overview');

  // Filtros de data (usados no relatório e na exportação)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(todayISO());

  // Modal de novo lançamento
  const [showEntryModal, setShowEntryModal] = useState<'receita' | 'despesa' | null>(null);
  const [formCategory, setFormCategory] = useState('');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formRecurring, setFormRecurring] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    setCheckingPin(true);
    fbCheckFinanceiroPin(clinicId, '').then((r) => {
      setHasPin(r.hasPin);
      setCheckingPin(false);
    }).catch(() => setCheckingPin(false));
  }, [clinicId]);

  useEffect(() => {
    if (!unlocked || !clinicId) return;
    setLoadingEntries(true);
    fbListFinanceiroEntries(clinicId).then((list) => {
      setEntries(list.filter((e) => e && e.type));
      setLoadingEntries(false);
    }).catch(() => setLoadingEntries(false));
    fbGetFinanceiroConfig(clinicId).then((cfg) => {
      if (cfg && cfg.metaMensal) setMetaMensal(Number(cfg.metaMensal));
    }).catch(() => {});
  }, [unlocked, clinicId]);

  const handleSaveMeta = async () => {
    const value = parseFloat(metaInput.replace(',', '.'));
    if (!value || value <= 0) return;
    setMetaMensal(value);
    setEditingMeta(false);
    await fbSetFinanceiroConfig(clinicId, { metaMensal: value });
    onAddSystemLog('success', `Meta mensal definida: ${formatBRL(value)}`);
  };

  const handleUnlock = async () => {
    setPinError('');
    if (hasPin === false) {
      if (pinInput.length < 4) { setPinError('O PIN precisa ter ao menos 4 dígitos.'); return; }
      if (pinInput !== pinConfirm) { setPinError('Os PINs não coincidem.'); return; }
      await fbSetFinanceiroPin(clinicId, pinInput);
      onAddSystemLog('success', 'PIN do Financeiro criado com sucesso.');
      setUnlocked(true);
      return;
    }
    const r = await fbCheckFinanceiroPin(clinicId, pinInput);
    if (r.valid) {
      setUnlocked(true);
    } else {
      setPinError('PIN incorreto.');
    }
  };

  // Receitas automáticas: derivadas dos agendamentos confirmados (não cancelados)
  const autoReceitas = useMemo(() => {
    return (appointments || [])
      .filter((a: any) => a.status !== 'canceled' && a.status !== 'cancelled')
      .map((a: any) => {
        const doctor = doctors.find((d) => d.name === a.doctorName || d.id === a.doctorId);
        const fee = doctor ? Number((doctor as any).consultationFee || (doctor as any).price || 0) : 0;
        return {
          id: `auto_${a.id}`,
          type: 'receita' as const,
          category: 'Consulta (agendamento)',
          description: `${a.patientName || 'Paciente'} — ${a.doctorName || 'Médico'}`,
          amount: fee,
          date: a.date,
          source: 'auto',
        };
      })
      .filter((e) => e.amount > 0);
  }, [appointments, doctors]);

  const manualEntries = entries;

  const allReceitas = useMemo(
    () => [...autoReceitas, ...manualEntries.filter((e) => e.type === 'receita')],
    [autoReceitas, manualEntries]
  );
  const allDespesas = useMemo(() => manualEntries.filter((e) => e.type === 'despesa'), [manualEntries]);

  const inRange = (dateStr: string) => dateStr >= dateFrom && dateStr <= dateTo;

  const receitasNoPeriodo = allReceitas.filter((e) => inRange(e.date));
  const despesasNoPeriodo = allDespesas.filter((e) => inRange(e.date));

  const totalReceitas = receitasNoPeriodo.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalDespesas = despesasNoPeriodo.reduce((s, e) => s + Number(e.amount || 0), 0);
  const lucro = totalReceitas - totalDespesas;
  const ticketMedio = receitasNoPeriodo.length > 0 ? totalReceitas / receitasNoPeriodo.length : 0;

  // ── 1) Comparação mês a mês (período anterior de mesma duração) ─────────
  const periodComparison = useMemo(() => {
    const from = new Date(dateFrom + 'T12:00:00');
    const to = new Date(dateTo + 'T12:00:00');
    const durationDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (durationDays - 1) * 86400000);
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const prevFromStr = toISO(prevFrom), prevToStr = toISO(prevTo);
    const prevReceitas = allReceitas.filter((e) => e.date >= prevFromStr && e.date <= prevToStr).reduce((s, e) => s + Number(e.amount || 0), 0);
    const prevDespesas = allDespesas.filter((e) => e.date >= prevFromStr && e.date <= prevToStr).reduce((s, e) => s + Number(e.amount || 0), 0);
    const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    return {
      receitaPct: pct(totalReceitas, prevReceitas),
      despesaPct: pct(totalDespesas, prevDespesas),
      lucroPct: pct(lucro, prevReceitas - prevDespesas),
    };
  }, [dateFrom, dateTo, allReceitas, allDespesas, totalReceitas, totalDespesas, lucro]);

  // ── 2) Alerta de despesa fora do padrão (mês atual vs média 3 meses anteriores) ──
  const despesaAlertas = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthKeys: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const byCategoryMonth: Record<string, Record<string, number>> = {};
    allDespesas.forEach((e) => {
      const mk = (e.date || '').slice(0, 7);
      if (!byCategoryMonth[e.category]) byCategoryMonth[e.category] = {};
      byCategoryMonth[e.category][mk] = (byCategoryMonth[e.category][mk] || 0) + Number(e.amount || 0);
    });
    const alerts: { category: string; current: number; avg: number; pct: number }[] = [];
    Object.entries(byCategoryMonth).forEach(([cat, months]) => {
      const current = months[currentMonthKey] || 0;
      const pastValues = monthKeys.map((mk) => months[mk] || 0);
      const avg = pastValues.reduce((s, v) => s + v, 0) / (pastValues.filter((v) => v > 0).length || 1);
      if (avg > 0 && current > avg * 1.3) {
        alerts.push({ category: cat, current, avg, pct: ((current - avg) / avg) * 100 });
      }
    });
    return alerts;
  }, [allDespesas]);

  // ── 3) Fluxo de caixa projetado (saldo até o fim do mês atual) ───────────
  const fluxoProjetado = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const firstDayStr = `${monthKey}-01`;
    const receitasMes = allReceitas.filter((e) => e.date >= firstDayStr && e.date <= lastDayStr).reduce((s, e) => s + Number(e.amount || 0), 0);
    const despesasFixasMes = allDespesas.filter((e) => (e.date || '').slice(0, 7) === monthKey).reduce((s, e) => s + Number(e.amount || 0), 0);
    const despesasRecorrentesAnteriores = allDespesas
      .filter((e) => e.recurring && (e.date || '').slice(0, 7) < monthKey)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return {
      saldoProjetado: receitasMes - despesasFixasMes - despesasRecorrentesAnteriores,
      receitasMes, despesasMes: despesasFixasMes + despesasRecorrentesAnteriores,
    };
  }, [allReceitas, allDespesas]);

  const metaProgress = metaMensal > 0 ? Math.min(100, (totalReceitas / metaMensal) * 100) : 0;

  // ── Ranking de médicos: receita, nº de consultas, ticket médio ──────────
  const rankingMedicos = useMemo(() => {
    const map: Record<string, { name: string; specialty: string; count: number; total: number }> = {};
    receitasNoPeriodo.forEach((e: any) => {
      const name = e.description?.split(' — ')[1] || 'Outros';
      if (!map[name]) {
        const doctor = doctors.find((d) => d.name === name);
        map[name] = { name, specialty: (doctor as any)?.specialty || '', count: 0, total: 0 };
      }
      map[name].count += 1;
      map[name].total += Number(e.amount || 0);
    });
    const totalGeral = Object.values(map).reduce((s, m) => s + m.total, 0);
    return Object.values(map)
      .map((m) => ({ ...m, avgTicket: m.count > 0 ? m.total / m.count : 0, pctOfTotal: totalGeral > 0 ? (m.total / totalGeral) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [receitasNoPeriodo, doctors]);

  // ── 5) Exportar CSV ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [['Tipo', 'Categoria', 'Descrição', 'Valor', 'Data']];
    receitasNoPeriodo.forEach((e: any) => rows.push(['Receita', e.category, e.description || '', String(e.amount).replace('.', ','), e.date]));
    despesasNoPeriodo.forEach((e) => rows.push(['Despesa', e.category, e.description || '', String(e.amount).replace('.', ','), e.date]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_${dateFrom}_a_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gráfico: últimos 6 meses receita x despesa
  const last6MonthsChart = useMemo(() => {
    const months: { key: string; label: string; receita: number; despesa: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      months.push({ key, label, receita: 0, despesa: 0 });
    }
    allReceitas.forEach((e) => {
      const key = (e.date || '').slice(0, 7);
      const m = months.find((mo) => mo.key === key);
      if (m) m.receita += Number(e.amount || 0);
    });
    allDespesas.forEach((e) => {
      const key = (e.date || '').slice(0, 7);
      const m = months.find((mo) => mo.key === key);
      if (m) m.despesa += Number(e.amount || 0);
      // Despesas recorrentes: replica pros meses seguintes até hoje
      if (e.recurring) {
        months.forEach((mo) => {
          if (mo.key > key) mo.despesa += Number(e.amount || 0);
        });
      }
    });
    return months;
  }, [allReceitas, allDespesas]);

  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    despesasNoPeriodo.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [despesasNoPeriodo]);

  const receitaPorMedico = useMemo(() => {
    const map: Record<string, number> = {};
    receitasNoPeriodo.forEach((e: any) => {
      const key = e.description?.split(' — ')[1] || 'Outros';
      map[key] = (map[key] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [receitasNoPeriodo]);

  // ── CRM: funil de pacientes, lista e histórico comercial ─────────────────
  const patientsCrm = useMemo(() => {
    const byPhone: Record<string, {
      name: string; phone: string; category: string;
      appointmentsCount: number; totalSpent: number;
      hasFuture: boolean; hasPast: boolean; lastContact: string;
    }> = {};

    (conversations || []).forEach((c) => {
      if (!c.patientPhone) return;
      if (!byPhone[c.patientPhone]) {
        byPhone[c.patientPhone] = {
          name: c.patientName || c.patientPhone, phone: c.patientPhone,
          category: c.category || 'Contato', appointmentsCount: 0, totalSpent: 0,
          hasFuture: false, hasPast: false, lastContact: c.lastMessageTime || '',
        };
      }
    });

    const todayStr = todayISO();
    (appointments || []).forEach((a: any) => {
      if (a.status === 'canceled' || a.status === 'cancelled') return;
      const phone = a.patientPhone;
      if (!phone) return;
      if (!byPhone[phone]) {
        byPhone[phone] = {
          name: a.patientName || phone, phone, category: 'Agendamento',
          appointmentsCount: 0, totalSpent: 0, hasFuture: false, hasPast: false, lastContact: '',
        };
      }
      const doctor = doctors.find((d) => d.name === a.doctorName || d.id === a.doctorId);
      const fee = doctor ? Number((doctor as any).consultationFee || (doctor as any).price || 0) : 0;
      byPhone[phone].appointmentsCount += 1;
      byPhone[phone].totalSpent += fee;
      if (a.date >= todayStr) byPhone[phone].hasFuture = true;
      if (a.date < todayStr) byPhone[phone].hasPast = true;
    });

    return Object.values(byPhone).map((p) => {
      let stage: 'lead' | 'agendado' | 'atendido' | 'recorrente';
      if (p.appointmentsCount === 0) stage = 'lead';
      else if (p.appointmentsCount >= 2) stage = 'recorrente';
      else if (p.hasFuture) stage = 'agendado';
      else stage = 'atendido';
      return { ...p, stage };
    });
  }, [conversations, appointments, doctors]);

  const crmFiltered = useMemo(() => {
    const term = crmSearch.trim().toLowerCase();
    if (!term) return patientsCrm;
    return patientsCrm.filter((p) => p.name.toLowerCase().includes(term) || p.phone.includes(term));
  }, [patientsCrm, crmSearch]);

  const funilColumns: { key: 'lead' | 'agendado' | 'atendido' | 'recorrente'; label: string; color: string }[] = [
    { key: 'lead', label: 'Lead', color: 'bg-slate-100 text-slate-600' },
    { key: 'agendado', label: 'Agendado', color: 'bg-amber-100 text-amber-700' },
    { key: 'atendido', label: 'Atendido', color: 'bg-blue-100 text-blue-700' },
    { key: 'recorrente', label: 'Recorrente', color: 'bg-emerald-100 text-emerald-700' },
  ];

  const selectedPatient = patientsCrm.find((p) => p.phone === selectedPatientPhone) || null;

  const handleSaveEntry = async () => {
    const category = formCategory === '__custom__' ? formCustomCategory.trim() : formCategory;
    if (!category || !formAmount || !formDate) {
      onAddSystemLog('warning', 'Preencha categoria, valor e data.');
      return;
    }
    const entry: FinanceiroEntry = {
      id: `fin_${Date.now()}`,
      type: showEntryModal as 'receita' | 'despesa',
      category,
      description: formDescription,
      amount: parseFloat(formAmount.replace(',', '.')),
      date: formDate,
      recurring: showEntryModal === 'despesa' ? formRecurring : false,
      createdAt: new Date().toISOString(),
    };
    await fbSaveFinanceiroEntry(clinicId, entry);
    setEntries((prev) => [...prev, entry]);
    onAddSystemLog('success', `${showEntryModal === 'receita' ? 'Receita' : 'Despesa'} adicionada: ${formatBRL(entry.amount)}`);
    setShowEntryModal(null);
    setFormCategory(''); setFormCustomCategory(''); setFormDescription('');
    setFormAmount(''); setFormDate(todayISO()); setFormRecurring(false);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Excluir este lançamento?')) return;
    await fbDeleteFinanceiroEntry(clinicId, id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleExportPDF = () => {
    window.print();
  };

  // ── TELA DE PIN ─────────────────────────────────────────────────────────
  // Bloqueio: Financeiro/CRM é exclusivo do plano Premium
  if (currentPlan !== 'premium') {
    return (
      <div className="p-4 md:p-6 relative min-h-[calc(100vh-60px)]">
        <LockOverlay requiredPlan="premium" featureName="Financeiro / CRM" onUpgradeClick={setActiveTab ? () => setActiveTab('settings') : undefined} />
      </div>
    );
  }

  if (checkingPin) {
    return <div className="p-8 text-center text-slate-400 font-sans text-sm">Carregando...</div>;
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-[#1A6FA8]" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 font-sans mb-1">
            {hasPin === false ? 'Criar PIN do Financeiro' : 'Área Restrita'}
          </h2>
          <p className="text-xs text-slate-500 font-sans mb-6">
            {hasPin === false
              ? 'Defina um PIN de acesso exclusivo para o Financeiro (diferente da sua senha de login).'
              : 'Digite o PIN do Financeiro para continuar. Apenas o responsável pela clínica deve ter acesso.'}
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="PIN (4 a 6 dígitos)"
            className="w-full text-center text-lg tracking-widest p-3 border border-slate-200 rounded-lg mb-3 focus:outline-hidden focus:border-[#1A6FA8] font-sans"
          />
          {hasPin === false && (
            <input
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Confirme o PIN"
              className="w-full text-center text-lg tracking-widest p-3 border border-slate-200 rounded-lg mb-3 focus:outline-hidden focus:border-[#1A6FA8] font-sans"
            />
          )}
          {pinError && <p className="text-xs text-red-500 font-sans mb-3">{pinError}</p>}
          <button
            onClick={handleUnlock}
            className="w-full bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold py-3 rounded-lg text-sm font-sans transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {hasPin === false ? 'Criar PIN e Entrar' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  // ── DASHBOARD PRINCIPAL ─────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 font-sans">Financeiro</h1>
          <p className="text-xs text-slate-500 font-sans">Receitas, despesas e relatórios da clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-2 font-sans" />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-2 font-sans" />
          <button onClick={handleExportPDF} className="flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-sans">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-sans">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-1 border-b border-slate-200 print:hidden">
        {[
          { id: 'overview', label: 'Visão Geral' },
          { id: 'crm', label: 'CRM / Pacientes' },
          { id: 'medicos', label: 'Médicos' },
          { id: 'receitas', label: 'Receitas' },
          { id: 'despesas', label: 'Despesas' },
          { id: 'relatorios', label: 'Relatórios' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold font-sans border-b-2 transition-colors ${
              activeSubTab === t.id ? 'border-[#1A6FA8] text-[#1A6FA8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cards resumo (sempre visíveis) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-1"><TrendingUp className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Receitas</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(totalReceitas)}</p>
          <p className={`text-[10px] font-sans flex items-center gap-0.5 mt-0.5 ${periodComparison.receitaPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {periodComparison.receitaPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(periodComparison.receitaPct).toFixed(0)}% vs período anterior
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1"><TrendingDown className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Despesas</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(totalDespesas)}</p>
          <p className={`text-[10px] font-sans flex items-center gap-0.5 mt-0.5 ${periodComparison.despesaPct <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {periodComparison.despesaPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(periodComparison.despesaPct).toFixed(0)}% vs período anterior
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className={`flex items-center gap-2 mb-1 ${lucro >= 0 ? 'text-[#1A6FA8]' : 'text-red-500'}`}><DollarSign className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Lucro Líquido</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(lucro)}</p>
          <p className={`text-[10px] font-sans flex items-center gap-0.5 mt-0.5 ${periodComparison.lucroPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {periodComparison.lucroPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(periodComparison.lucroPct).toFixed(0)}% vs período anterior
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Ticket Médio</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(ticketMedio)}</p>
        </div>
      </div>


      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Alerta de despesa fora do padrão */}
          {despesaAlertas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold font-sans">Atenção: despesas acima do padrão este mês</span>
              </div>
              <ul className="space-y-1">
                {despesaAlertas.map((a) => (
                  <li key={a.category} className="text-[11px] text-amber-800 font-sans">
                    <strong>{a.category}</strong> subiu {a.pct.toFixed(0)}% em relação à média dos últimos meses ({formatBRL(a.current)} vs média de {formatBRL(a.avg)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Meta mensal */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-700"><Target className="w-4 h-4" /><span className="text-xs font-bold font-sans">Meta de Receita Mensal</span></div>
                <button onClick={() => { setEditingMeta(true); setMetaInput(String(metaMensal || '')); }} className="text-[10px] font-bold text-[#1A6FA8] font-sans print:hidden">
                  {metaMensal > 0 ? 'Editar' : '+ Definir meta'}
                </button>
              </div>
              {editingMeta ? (
                <div className="flex items-center gap-2">
                  <input value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="Ex: 15000" className="flex-1 text-xs p-2 border border-slate-200 rounded-lg font-sans" />
                  <button onClick={handleSaveMeta} className="text-xs font-bold bg-[#1A6FA8] text-white px-3 py-2 rounded-lg font-sans">Salvar</button>
                </div>
              ) : metaMensal > 0 ? (
                <>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1.5">
                    <div className="bg-[#1A6FA8] h-2.5 rounded-full transition-all" style={{ width: `${metaProgress}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans">{formatBRL(totalReceitas)} de {formatBRL(metaMensal)} ({metaProgress.toFixed(0)}%)</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 font-sans">Nenhuma meta definida ainda.</p>
              )}
            </div>

            {/* Fluxo de caixa projetado */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-700 mb-2"><Calendar className="w-4 h-4" /><span className="text-xs font-bold font-sans">Fluxo de Caixa Projetado (mês atual)</span></div>
              <p className={`text-lg font-bold font-sans ${fluxoProjetado.saldoProjetado >= 0 ? 'text-[#1A6FA8]' : 'text-red-500'}`}>
                {formatBRL(fluxoProjetado.saldoProjetado)}
              </p>
              <p className="text-[11px] text-slate-400 font-sans mt-1">
                Considera receitas de agendamentos já confirmados + despesas recorrentes deste mês.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 font-sans mb-4">Receita x Despesa (últimos 6 meses)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={last6MonthsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeSubTab === 'crm' && (
        <div className="space-y-4">
          {/* Funil Kanban */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {funilColumns.map((col) => {
              const patients = crmFiltered.filter((p) => p.stage === col.key);
              return (
                <div key={col.key} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className={`inline-block text-[10px] font-bold px-2 py-1 rounded-full mb-2 font-sans ${col.color}`}>
                    {col.label} ({patients.length})
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {patients.map((p) => (
                      <button
                        key={p.phone}
                        onClick={() => setSelectedPatientPhone(p.phone)}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg p-2 transition-colors"
                      >
                        <p className="text-xs font-bold text-slate-700 font-sans truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-sans">{p.appointmentsCount} consulta(s)</p>
                      </button>
                    ))}
                    {patients.length === 0 && <p className="text-[10px] text-slate-300 font-sans text-center py-3">Vazio</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Busca + Lista completa */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                placeholder="Buscar paciente por nome ou telefone..."
                className="flex-1 text-xs p-2 border border-slate-200 rounded-lg font-sans"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {crmFiltered.map((p) => (
                  <button
                    key={p.phone}
                    onClick={() => setSelectedPatientPhone(p.phone)}
                    className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg border text-xs font-sans transition-colors ${
                      selectedPatientPhone === p.phone ? 'border-[#1A6FA8] bg-blue-50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">{p.name}</p>
                        <p className="text-slate-400">{p.phone}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${funilColumns.find((c) => c.key === p.stage)?.color}`}>
                      {funilColumns.find((c) => c.key === p.stage)?.label}
                    </span>
                  </button>
                ))}
                {crmFiltered.length === 0 && <p className="text-xs text-slate-400 font-sans text-center py-6">Nenhum paciente encontrado.</p>}
              </div>

              {/* Painel de detalhe / histórico comercial */}
              <div className="border border-slate-100 rounded-lg p-4">
                {!selectedPatient ? (
                  <p className="text-xs text-slate-400 font-sans text-center py-8">Selecione um paciente pra ver o histórico comercial.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#1A6FA8] text-white flex items-center justify-center font-bold text-sm">
                        {selectedPatient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 font-sans">{selectedPatient.name}</p>
                        <p className="text-xs text-slate-400 font-sans flex items-center gap-1"><Phone className="w-3 h-3" />{selectedPatient.phone}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-sans">Consultas</p>
                        <p className="text-base font-bold text-slate-700 font-sans">{selectedPatient.appointmentsCount}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-sans">Total gasto</p>
                        <p className="text-base font-bold text-emerald-600 font-sans">{formatBRL(selectedPatient.totalSpent)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase font-sans mb-1">Estágio no funil</p>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${funilColumns.find((c) => c.key === selectedPatient.stage)?.color}`}>
                        {funilColumns.find((c) => c.key === selectedPatient.stage)?.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'medicos' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 font-sans mb-4">Ranking de Médicos (por receita no período)</h3>
          {rankingMedicos.length === 0 ? (
            <p className="text-xs text-slate-400 font-sans text-center py-8">Nenhuma receita registrada no período selecionado.</p>
          ) : (
            <div className="space-y-3">
              {rankingMedicos.map((m, i) => (
                <div key={m.name} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-sans ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                      }`}>{i + 1}º</span>
                      <div>
                        <p className="text-xs font-bold text-slate-700 font-sans">{m.name}</p>
                        {m.specialty && <p className="text-[10px] text-slate-400 font-sans">{m.specialty}</p>}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 font-sans">{formatBRL(m.total)}</p>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="bg-[#1A6FA8] h-2 rounded-full" style={{ width: `${m.pctOfTotal}%` }} />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-sans">
                    <span>{m.count} consulta(s)</span>
                    <span>Ticket médio: {formatBRL(m.avgTicket)}</span>
                    <span>{m.pctOfTotal.toFixed(0)}% da receita total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'receitas' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 font-sans">Receitas ({receitasNoPeriodo.length})</h3>
            <button onClick={() => setShowEntryModal('receita')} className="flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-sans print:hidden">
              <Plus className="w-3.5 h-3.5" /> Nova Receita Manual
            </button>
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {receitasNoPeriodo.length === 0 && <p className="text-xs text-slate-400 font-sans py-4 text-center">Nenhuma receita no período.</p>}
            {receitasNoPeriodo.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 text-xs font-sans">
                <div>
                  <p className="font-bold text-slate-700">{e.description || e.category}</p>
                  <p className="text-slate-400">{e.category} · {e.date} {e.id.startsWith('auto_') && <span className="text-blue-500">(automático)</span>}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">{formatBRL(e.amount)}</span>
                  {!e.id.startsWith('auto_') && (
                    <button onClick={() => handleDeleteEntry(e.id)} className="text-slate-300 hover:text-red-500 print:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'despesas' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 font-sans">Despesas ({despesasNoPeriodo.length})</h3>
            <button onClick={() => setShowEntryModal('despesa')} className="flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 px-3 py-1.5 rounded-lg font-sans print:hidden">
              <Plus className="w-3.5 h-3.5" /> Nova Despesa
            </button>
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {despesasNoPeriodo.length === 0 && <p className="text-xs text-slate-400 font-sans py-4 text-center">Nenhuma despesa no período.</p>}
            {despesasNoPeriodo.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-slate-100 text-xs font-sans">
                <div>
                  <p className="font-bold text-slate-700">{e.description || e.category}</p>
                  <p className="text-slate-400 flex items-center gap-1">
                    {e.category} · {e.date} {e.recurring && <span className="flex items-center gap-0.5 text-amber-500"><Repeat className="w-3 h-3" />recorrente</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-500 font-bold">{formatBRL(e.amount)}</span>
                  <button onClick={() => handleDeleteEntry(e.id)} className="text-slate-300 hover:text-red-500 print:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'relatorios' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 font-sans mb-4">Despesas por Categoria</h3>
            {despesasPorCategoria.length === 0 ? (
              <p className="text-xs text-slate-400 font-sans text-center py-8">Sem despesas no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d: any) => d.name}>
                    {despesasPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 font-sans mb-4">Receita por Médico</h3>
            {receitaPorMedico.length === 0 ? (
              <p className="text-xs text-slate-400 font-sans text-center py-8">Sem receitas no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={receitaPorMedico} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="#1A6FA8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Modal novo lançamento */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 font-sans">
                Nova {showEntryModal === 'receita' ? 'Receita' : 'Despesa'}
              </h3>
              <button onClick={() => setShowEntryModal(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Categoria</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans">
                  <option value="">Selecione...</option>
                  {(showEntryModal === 'receita' ? RECEITA_CATEGORIES : DESPESA_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Outra categoria (digitar)</option>
                </select>
                {formCategory === '__custom__' && (
                  <input value={formCustomCategory} onChange={(e) => setFormCustomCategory(e.target.value)} placeholder="Nome da categoria" className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans mt-2" />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Descrição</label>
                <input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Ex: Aluguel de julho" className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Valor (R$)</label>
                  <input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0,00" className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans mb-1">Data</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-sans" />
                </div>
              </div>
              {showEntryModal === 'despesa' && (
                <label className="flex items-center gap-2 text-xs font-sans text-slate-600">
                  <input type="checkbox" checked={formRecurring} onChange={(e) => setFormRecurring(e.target.checked)} />
                  Despesa recorrente (repete todo mês)
                </label>
              )}
              <button onClick={handleSaveEntry} className="w-full bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold py-2.5 rounded-lg text-xs font-sans mt-2">
                Salvar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
