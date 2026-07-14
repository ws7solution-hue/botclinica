import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, Plus, Trash2, TrendingUp, TrendingDown, DollarSign,
  Download, Calendar, Repeat, X, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Doctor, Appointment } from '../types';
import {
  fbCheckFinanceiroPin, fbSetFinanceiroPin, fbListFinanceiroEntries,
  fbSaveFinanceiroEntry, fbDeleteFinanceiroEntry
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
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
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

export default function FinanceiroPanel({ clinicId, doctors, appointments, onAddSystemLog }: FinanceiroPanelProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [checkingPin, setCheckingPin] = useState(true);

  const [entries, setEntries] = useState<FinanceiroEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'receitas' | 'despesas' | 'relatorios'>('overview');

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
  }, [unlocked, clinicId]);

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
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-1 border-b border-slate-200 print:hidden">
        {[
          { id: 'overview', label: 'Visão Geral' },
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
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1"><TrendingDown className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Despesas</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(totalDespesas)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className={`flex items-center gap-2 mb-1 ${lucro >= 0 ? 'text-[#1A6FA8]' : 'text-red-500'}`}><DollarSign className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Lucro Líquido</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(lucro)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1"><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase font-sans">Ticket Médio</span></div>
          <p className="text-lg font-bold text-slate-800 font-sans">{formatBRL(ticketMedio)}</p>
        </div>
      </div>

      {activeSubTab === 'overview' && (
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
