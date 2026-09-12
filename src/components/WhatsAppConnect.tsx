import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Smartphone, AlertCircle, Loader, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

const WA_SERVICE = 'https://api.botclinica.com.br/wa';
const CLOUDAPI_BASE = 'https://whatsapp.botclinica.com.br';

// Dados fixos do App da Meta — o App ID é público (aparece até na URL do
// painel de desenvolvedor), não é segredo. O App Secret NUNCA fica aqui no
// frontend — ele mora só no backend (VPS), usado na troca do código.
const META_APP_ID = '1350636587005556';
const META_CONFIG_ID = '1698558158077812'; // "Cadastro Integrado com token de 60 dias"

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

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
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Embedded Signup (conexão automática, oficial) ─────────────────────
  const [esStatus, setEsStatus] = useState<'idle' | 'connecting' | 'onboarding' | 'success' | 'error'>('idle');
  const [esError, setEsError] = useState('');
  const esSessionData = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    // Inicializa o SDK do Facebook assim que ele terminar de carregar
    // (carregado via <script> no index.html). Se já estiver pronto (SDK
    // carregou antes desse componente montar), inicializa na hora.
    const initFB = () => {
      if (window.FB) {
        window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' });
      }
    };
    if (window.FB) initFB();
    else window.fbAsyncInit = initFB;

    // Escuta as mensagens que a Meta manda com o resultado do cadastro
    // (WABA ID e Phone Number ID) — esse evento chega ANTES ou DEPOIS do
    // callback do FB.login, então guardamos numa ref pra combinar os dois.
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        // BUGFIX: o event.data pode chegar como string (precisa JSON.parse)
        // ou já como objeto, dependendo do navegador/versão do SDK — antes
        // só tratava o caso "string", e o caso "objeto" quebrava o parse
        // silenciosamente (o catch engolia sem avisar nada).
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        console.log('[Embedded Signup] Mensagem recebida da Meta:', data); // LOG TEMPORÁRIO DE DIAGNÓSTICO
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          esSessionData.current = { waba_id: data.data.waba_id, phone_number_id: data.data.phone_number_id };
        } else if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'CANCEL') {
          onAddSystemLog('warning', 'Conexão do WhatsApp cancelada antes de terminar.');
        }
      } catch (e) { console.log('[Embedded Signup] Mensagem ignorada (não era JSON válido):', event.data); }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // NOVO: extraída como função própria (não-async na assinatura de fora)
  // porque o SDK da Meta faz uma checagem de tipo estrita no callback do
  // FB.login e rejeita uma função "async" passada diretamente ali
  // (erro: "Expression is of type asyncfunction, not function"). A lógica
  // continua assíncrona por dentro, só a função em si não é declarada
  // "async" — é chamada como uma IIFE async lá dentro.
  function handleLoginCallback(response: any) {
    (async () => {
      if (!response.authResponse) {
        setEsStatus('idle');
        return; // usuário fechou/cancelou — não é erro, só volta ao normal
      }
      const code = response.authResponse.code;

      // Dá um instante pro evento de "message" (com waba_id/phone_number_id)
      // chegar, já que ele pode vir um pouco depois desse callback.
      await new Promise(r => setTimeout(r, 800));

      const { waba_id, phone_number_id } = esSessionData.current;
      if (!waba_id || !phone_number_id) {
        setEsStatus('error');
        setEsError('Não conseguimos identificar o número conectado. Tenta de novo — se persistir, usa o botão de suporte abaixo.');
        return;
      }

      setEsStatus('onboarding');
      onAddSystemLog('info', 'Finalizando a conexão do WhatsApp da clínica...');

      try {
        const r = await fetch(`${CLOUDAPI_BASE}/onboard-clinic-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId, code, wabaId: waba_id, phoneNumberId: phone_number_id }),
        });
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || 'Falha ao finalizar a conexão.');

        setEsStatus('success');
        setPhone(d.displayPhone || '');
        setStatus('connected');
        onAddSystemLog('success', 'WhatsApp conectado automaticamente com sucesso! 🎉');
      } catch (e: any) {
        setEsStatus('error');
        setEsError(e.message);
        onAddSystemLog('error', `Erro ao finalizar conexão: ${e.message}`);
      }
    })();
  }

  function handleEmbeddedSignup() {
    if (!window.FB) {
      setEsError('O sistema de login da Meta ainda está carregando — espera 2 segundos e tenta de novo.');
      setEsStatus('error');
      return;
    }
    setEsStatus('connecting');
    setEsError('');
    esSessionData.current = {};

    window.FB.login(
      handleLoginCallback,
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }

  useEffect(() => {
    if (!clinicId) return;
    checkStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    };
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

  async function fetchQR() {
    try {
      const r = await fetch(`${WA_SERVICE}/qr/${encodeURIComponent(clinicId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  async function handleConnect() {
    if (!clinicId) {
      setError('Email da clínica não identificado. Faça logout e login novamente.');
      setStatus('error');
      return;
    }
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    setStatus('loading');
    setError('');
    setQrData(null);
    onAddSystemLog('info', 'Gerando QR Code do WhatsApp...');

    try {
      const d = await fetchQR();

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
        startQRRefresh();
        return;
      }

      throw new Error(d.error || 'Erro ao gerar QR Code.');
    } catch (e: any) {
      setStatus('error');
      setError(e.message);
      onAddSystemLog('error', `Erro: ${e.message}`);
    }
  }

  function startQRRefresh() {
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    qrRefreshRef.current = setInterval(async () => {
      try {
        const d = await fetchQR();
        if (d.connected) {
          clearInterval(qrRefreshRef.current!);
          clearInterval(pollRef.current!);
          setPhone(d.phone || '');
          setStatus('connected');
          setQrData(null);
        } else if (d.qr) {
          setQrData(d.qr);
        }
      } catch (e) {}
    }, 18000);
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(pollRef.current!);
        clearInterval(qrRefreshRef.current!);
        setStatus('idle');
        setQrData(null);
        return;
      }
      try {
        const r = await fetch(`${WA_SERVICE}/status/${encodeURIComponent(clinicId)}`);
        const d = await r.json();
        if (d.connected) {
          clearInterval(pollRef.current!);
          clearInterval(qrRefreshRef.current!);
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
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
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
            Aguardando leitura... QR atualiza automaticamente
          </div>
          <button onClick={handleConnect} className="mt-3 flex items-center gap-1 text-xs text-[#1A6FA8] font-sans mx-auto hover:underline">
            <RefreshCw className="w-3 h-3" /> Gerar novo QR Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#1A6FA8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-700 font-sans">Conecte o WhatsApp da sua clínica</p>
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Conexão via API oficial da Meta — sem risco de bloqueio do número. Nossa equipe faz a ativação pra você em poucos minutos.
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

      {esError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-sans">{esError}</p>
        </div>
      )}

      <button
        onClick={handleEmbeddedSignup}
        disabled={esStatus === 'connecting' || esStatus === 'onboarding'}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A6FA8] hover:bg-[#135480] disabled:opacity-70 disabled:cursor-wait text-white font-bold text-sm rounded-xl transition-colors font-sans"
      >
        {esStatus === 'connecting' && <><Loader className="w-4 h-4 animate-spin" /> Abrindo o cadastro da Meta...</>}
        {esStatus === 'onboarding' && <><Loader className="w-4 h-4 animate-spin" /> Finalizando conexão...</>}
        {(esStatus === 'idle' || esStatus === 'error') && <><Sparkles className="w-4 h-4" /> Conectar WhatsApp Automaticamente</>}
      </button>

      <p className="text-[10px] text-slate-400 font-sans text-center">
        Conexão 100% automática — nossa equipe cuida de qualquer detalhe restante nos bastidores, sem você precisar fazer mais nada.
      </p>

      <a
        href={`https://wa.me/553191030288?text=${encodeURIComponent('Preciso de ajuda para conectar meu WhatsApp no painel.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2 text-[#1A6FA8] font-sans text-xs hover:underline"
      >
        Prefere que a gente conecte pra você? Fala com o suporte
      </a>
    </div>
  );
}
