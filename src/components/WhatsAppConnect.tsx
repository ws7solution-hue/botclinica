import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Smartphone, AlertCircle, Loader, RefreshCw } from 'lucide-react';

// URL do serviço multi-tenant na VPS
const WA_SERVICE = 'https://api.botclinica.com.br/wa';

interface WhatsAppConnectProps {
  clinicId: string;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

export default function WhatsAppConnect({ clinicId, onAddSystemLog }: WhatsAppConnectProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'qr' | 'connected' | 'error'>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    checkStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [clinicId]);

  async function checkStatus() {
    try {
      const r = await fetch(`${WA_SERVICE}/status/${encodeURIComponent(clinicId)}`);
      const d = await r.json();
      if (d.connected) {
        setPhone(d.phone || '');
        setStatus('connected');
      }
    } catch (e) {}
  }

  async function handleConnect() {
    setStatus('loading');
    setError('');
    setQrData(null);
    onAddSystemLog('info', 'Gerando QR Code do WhatsApp...');

    try {
      const r = await fetch(`${WA_SERVICE}/qr/${encodeURIComponent(clinicId)}`);
      const d = await r.json();

      if (d.connected) {
        setPhone(d.phone || '');
        setStatus('connected');
        onAddSystemLog('success', `WhatsApp ${d.phone} já está conectado!`);
        return;
      }

      if (d.qr) {
        setQrData(d.qr);
        setStatus('qr');
        onAddSystemLog('info', 'QR Code gerado! Escaneie com o WhatsApp da clínica.');
        startPolling();
        return;
      }

      throw new Error(d.error || 'Erro ao gerar QR Code.');
    } catch (e: any) {
      setStatus('error');
      setError(e.message);
      onAddSystemLog('error', `Erro: ${e.message}`);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) { // 2 minutos
        clearInterval(pollRef.current!);
        setStatus('idle');
        setQrData(null);
        return;
      }
      try {
        const r = await fetch(`${WA_SERVICE}/status/${encodeURIComponent(clinicId)}`);
        const d = await r.json();
        if (d.connected) {
          clearInterval(pollRef.current!);
          setPhone(d.phone || '');
          setStatus('connected');
          setQrData(null);
          onAddSystemLog('success', `WhatsApp ${d.phone} conectado com sucesso!`);
        }
      } catch (e) {}
    }, 2000);
  }

  async function handleDisconnect() {
    try {
      await fetch(`${WA_SERVICE}/disconnect/${encodeURIComponent(clinicId)}`, { method: 'DELETE' });
      setStatus('idle');
      setPhone('');
      setQrData(null);
      if (pollRef.current) clearInterval(pollRef.current);
      onAddSystemLog('info', 'WhatsApp desconectado.');
    } catch (e) {
      onAddSystemLog('error', 'Erro ao desconectar.');
    }
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-700 font-sans">WhatsApp Conectado ✅</p>
          <p className="text-xs text-emerald-600 font-sans">{phone ? `+${phone}` : 'Número ativo'}</p>
          <p className="text-[10px] text-emerald-500 font-sans mt-0.5">Mensagens sendo recebidas e respondidas automaticamente</p>
        </div>
        <button onClick={handleDisconnect} className="text-xs text-emerald-600 hover:text-red-500 font-sans font-medium transition-colors">
          Desconectar
        </button>
      </div>
    );
  }

  if (status === 'qr' && qrData) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-xs font-bold text-slate-700 font-sans mb-1">Escaneie o QR Code com o WhatsApp da clínica</p>
          <p className="text-[11px] text-slate-500 font-sans mb-4">
            Abra o WhatsApp → Menu → Aparelhos conectados → Conectar um aparelho
          </p>
          <div className="flex justify-center mb-4">
            <img src={qrData} alt="QR Code WhatsApp" className="w-52 h-52 rounded-xl border border-slate-100" />
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-sans">
            <Loader className="w-3 h-3 animate-spin text-[#1A6FA8]" />
            Aguardando leitura do QR Code...
          </div>
          <button onClick={handleConnect} className="mt-3 flex items-center gap-1 text-xs text-[#1A6FA8] font-sans mx-auto hover:underline">
            <RefreshCw className="w-3 h-3" /> Gerar novo QR Code
          </button>
        </div>
        <p className="text-[10px] text-slate-400 font-sans text-center">O QR Code expira em 2 minutos. Se expirar, clique em "Gerar novo QR Code".</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-[#1A6FA8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-700 font-sans">Conecte o WhatsApp da sua clínica</p>
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Escaneie um QR Code com o WhatsApp do número da clínica. Qualquer chip funciona — sem burocracia.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-sans">{error}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1EB958] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors font-sans"
      >
        {status === 'loading' ? (
          <><Loader className="w-4 h-4 animate-spin" /> Gerando QR Code...</>
        ) : (
          <><Smartphone className="w-4 h-4" /> Conectar WhatsApp via QR Code</>
        )}
      </button>
    </div>
  );
}
