import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Smartphone, AlertCircle, Loader } from 'lucide-react';

// App ID do BotClínica na Meta (publicado)
const META_APP_ID = '1350636587005556';

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
  const [sdkReady, setSdkReady] = useState(false);

  // Carrega o SDK do Facebook
  useEffect(() => {
    if (document.getElementById('fb-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'fb-sdk';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).FB?.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v20.0',
      });
      setSdkReady(true);
    };
    document.head.appendChild(script);
  }, []);

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

  const handleConnect = useCallback(() => {
    if (!sdkReady || !(window as any).FB) {
      onAddSystemLog('error', 'SDK do Facebook não carregou. Recarregue a página e tente novamente.');
      return;
    }

    setStatus('loading');

    (window as any).FB.login((response: any) => {
      if (response.authResponse?.code) {
        exchangeCodeForToken(response.authResponse.code);
      } else {
        setStatus('idle');
        onAddSystemLog('warning', 'Conexão com WhatsApp cancelada.');
      }
    }, {
      config_id: META_APP_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: '3',
      },
    });
  }, [sdkReady, clinicId]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      // Troca o code por um token de acesso e busca as credenciais do WABA
      const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=20e8a34c67874880aa0b897148e8311c&code=${code}`);
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        throw new Error('Token não recebido');
      }

      const accessToken = tokenData.access_token;

      // Busca os WABAs disponíveis para esse token
      const wabaRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses?fields=whatsapp_business_accounts&access_token=${accessToken}`);
      const wabaData = await wabaRes.json();

      const waba = wabaData.data?.[0]?.whatsapp_business_accounts?.data?.[0];
      if (!waba) throw new Error('Nenhuma conta WhatsApp Business encontrada.');

      const wabaId = waba.id;

      // Busca o número de telefone registrado nesse WABA
      const phoneRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}`);
      const phoneData = await phoneRes.json();

      const phoneInfo = phoneData.data?.[0];
      if (!phoneInfo) throw new Error('Nenhum número de telefone encontrado no WABA.');

      const creds = {
        phoneNumberId: phoneInfo.id,
        accessToken,
        wabaId,
        phoneNumber: phoneInfo.display_phone_number,
      };

      // Salva no Firestore
      await fetch('/api/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveWhatsAppCredentials', payload: { clinicId, ...creds } }),
      });

      setCredentials({ ...creds, connectedAt: new Date().toISOString() });
      setStatus('connected');
      onAddSystemLog('success', `WhatsApp ${phoneInfo.display_phone_number} conectado com sucesso ao AtendIA!`);
    } catch (e: any) {
      setStatus('error');
      onAddSystemLog('error', `Erro ao conectar WhatsApp: ${e.message}`);
    }
  };

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
          onClick={() => { setStatus('idle'); setCredentials(null); }}
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
              Autorize o AtendIA a enviar e receber mensagens pelo seu número oficial. O processo leva menos de 2 minutos.
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

      <button
        onClick={handleConnect}
        disabled={status === 'loading' || !sdkReady}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1EB958] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors font-sans"
      >
        {status === 'loading' ? (
          <><Loader className="w-4 h-4 animate-spin" /> Conectando...</>
        ) : (
          <><Smartphone className="w-4 h-4" /> Conectar WhatsApp Business</>
        )}
      </button>
    </div>
  );
}
