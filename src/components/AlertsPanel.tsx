import React, { useEffect, useState } from 'react';
import { Bell, Clock, Users, CheckCircle2 } from 'lucide-react';
import { ClinicAlert } from '../types';
import { fbListClinicAlerts, fbMarkAlertRead } from '../firebase';

interface AlertsPanelProps {
  clinicId?: string;
}

export default function AlertsPanel({ clinicId }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<ClinicAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    if (!clinicId) return;
    try {
      const data = await fbListClinicAlerts(clinicId);
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    // Os alertas são gerados por um job na VPS a cada 30 minutos — o
    // polling aqui só busca o que já foi gerado, não gera nada sozinho.
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [clinicId]);

  const handleMarkRead = async (alertId: string) => {
    if (!clinicId) return;
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    await fbMarkAlertRead(clinicId, alertId);
  };

  const iconFor = (type: string) => {
    if (type === 'conversa_parada') return <Clock className="w-5 h-5 text-amber-600" />;
    if (type === 'sem_retorno') return <Users className="w-5 h-5 text-blue-600" />;
    return <Bell className="w-5 h-5 text-slate-500" />;
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-5 h-5 text-[#1A6FA8]" />
        <h2 className="text-lg font-bold text-slate-800 font-sans">Alertas</h2>
        {unreadCount > 0 && (
          <span className="text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 font-mono font-bold">
            {unreadCount} novo{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 font-sans mb-6">
        Avisos automáticos sobre pacientes sem retorno e conversas esperando atendimento — atualizado a cada 30 minutos.
      </p>

      {loading && (
        <p className="text-sm text-slate-400 font-sans">Carregando...</p>
      )}

      {!loading && alerts.length === 0 && (
        <div className="text-center py-16 text-slate-400 font-sans">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
          <p className="text-sm">Nenhum alerta no momento. Tudo em dia!</p>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              alert.read ? 'bg-white border-slate-200' : 'bg-blue-50/60 border-blue-200'
            }`}
          >
            <div className="mt-0.5">{iconFor(alert.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-800 font-sans">{alert.title}</h4>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {alert.createdAt ? new Date(alert.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-sans mt-1">{alert.message}</p>
              {!alert.read && (
                <button
                  onClick={() => handleMarkRead(alert.id)}
                  className="text-[11px] text-[#1A6FA8] font-bold font-sans mt-2 hover:underline"
                >
                  Marcar como visto
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
