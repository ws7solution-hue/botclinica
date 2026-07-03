import React, { useState, useEffect } from 'react';
import { CheckCircle, Smartphone, AlertCircle, Loader, ExternalLink } from 'lucide-react';

const META_APP_ID = '1350636587005556';
const META_APP_SECRET = '20e8a34c67874880aa0b897148e8311c';
const REDIRECT_URI = 'https://botclinica.com.br/app';

interface WhatsAppConnectProps {
  clinicId: string;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

interface WACredentials {
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  connectedAt: string;
}

export default function WhatsAppConnect({ clinicId, onAddSystemLog }: WhatsAppConnectProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [credentials, setCredentials] = useState<WACredentials | null>(null);

  // Busca credenciais já salvas
  useEffect(() => {
    if (!clinicId) return;
    fetch('/api/fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getWhatsAppCredentials', payload: { clinicId } }),
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.phoneNumber) {
          setCredentials(d);
          setStatus('connected');
        }
      })
      .catch(() => {});
  }, [clinicId]);

  // Verifica se voltou do OAuth com ?code= na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) return;

    const savedState = localStorage.getItem('wa_oauth_state');
    const savedClinicId = localStorage.getItem('wa_oauth_clinic');

    if (state !== savedState) return;

    // Limpa os params da URL sem reload
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.toString());
    localStorage.removeItem('wa_oauth_state');
    localStorage.removeItem('wa_oauth_clinic');

    // Usa o clinicId salvo no localStorage (evita race condition)
    const effectiveClinicId = savedClinicId || clinicId;
    if (!effectiveClinicId) return;

    setStatus('loading');
    onAddSystemLog('info', 'Autorizando WhatsApp Business...');
    exchangeCodeForToken(code, effectiveClinicId);
  }, []); // Roda só uma vez no mount — código OAuth só aparece uma vez

  async function exchangeCodeForToken(code: string, effectiveClinicId: string) {
    try {
      // Troca o code pelo token via nossa API (evita expor o App Secret no frontend)
      const r = await fetch('/api/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exchangeWACode',
          payload: { code, redirectUri: REDIRECT_URI, clinicId: effectiveClinicId },
        }),
      });
      const d = await r.json();

      if (d.error || !d.phoneNumber) {
        throw new Error(d.error || 'Não foi possível obter as credenciais do WhatsApp.');
      }

      setCredentials(d);
      setStatus('connected');
      onAddSystemLog('success', `WhatsApp ${d.phoneNumber} conectado com sucesso ao AtendIA!`);
    } catch (e: any) {
      setStatus('error');
      onAddSystemLog('error', `Erro ao conectar WhatsApp: ${e.message}`);
    }
  }

  function handleConnect() {
    // Gera state aleatório pra segurança CSRF
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem('wa_oauth_state', state);
    localStorage.setItem('wa_oauth_clinic', clinicId);

    // Monta URL do OAuth da Meta — sem SDK, abre direto no navegador
    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'whatsapp_business_messaging,whatsapp_business_management',
      response_type: 'code',
      state,
    });

    const oauthUrl = `https://www.facebook.com/dialog/oauth?${params.toString()}`;
    window.location.href = oauthUrl;
  }

  async function handleDisconnect() {
    await fetch('/api/fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveWhatsAppCredentials',
        payload: { clinicId, phoneNumberId: '', accessToken: '', wabaId: '', phoneNumber: '' },
      }),
    });
    setCredentials(null);
    setStatus('idle');
    onAddSystemLog('info', 'WhatsApp desconectado.');
  }

  if (status === 'connected' && credentials) {
    return (
      <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-700 font-sans">WhatsApp Conectado</p>
          <p className="text-xs text-emerald-600 font-sans">{credentials.phoneNumber}</p>
          <p className="text-[10px] text-emerald-500 font-sans mt-0.5">
            Conectado em {new Date(credentials.connectedAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-emerald-600 hover:text-red-500 font-sans font-medium transition-colors"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-[#1A6FA8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-700 font-sans">Conecte o WhatsApp Business da sua clínica</p>
            <p className="text-[11px] text-slate-500 font-sans mt-1">
              Você será redirecionado para o Facebook para autorizar o acesso. O processo leva menos de 2 minutos.
            </p>
          </div>
        </div>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 font-sans">Erro ao conectar. Tente novamente.</p>
        </div>
      )}

      {status === 'loading' ? (
        <div className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 rounded-xl">
          <Loader className="w-4 h-4 animate-spin text-[#1A6FA8]" />
          <span className="text-sm text-slate-600 font-sans">Conectando...</span>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1EB958] text-white font-bold text-sm rounded-xl transition-colors font-sans"
        >
          <Smartphone className="w-4 h-4" />
          Conectar WhatsApp Business
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </button>
      )}
    </div>
  );
}
