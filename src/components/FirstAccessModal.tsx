import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, Lock } from 'lucide-react';

interface FirstAccessModalProps {
  email: string;
  idToken: string;
  onComplete: () => void;
}

export default function FirstAccessModal({ email, idToken, onComplete }: FirstAccessModalProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const isStrong = password.length >= 8;
  const isMatch = password === confirm && confirm.length > 0;

  const handleSubmit = async () => {
    setError('');
    if (!isStrong) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (!isMatch) { setError('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      const r = await fetch('/api/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', payload: { idToken, newPassword: password } }),
      });
      const d = await r.json();

      if (d.error) {
        setError('Erro ao definir senha. Tente novamente.');
        setLoading(false);
        return;
      }

      // Marca firstAccess como false no Firestore
      await fetch('/api/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setFirstAccessDone', payload: { clinicId: email, token: idToken } }),
      });

      setDone(true);
      setTimeout(onComplete, 2000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#1A6FA8] to-[#135480] px-8 py-8 text-center">
          <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-white font-sans">Bem-vindo ao AtendIA!</h2>
          <p className="text-blue-100 text-xs mt-2 font-sans">Antes de começar, crie sua senha de acesso pessoal.</p>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-bold text-slate-800 font-sans">Senha definida com sucesso!</p>
              <p className="text-xs text-slate-500 font-sans">Acessando o painel...</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 font-sans mb-5">
                Logado como <span className="font-bold text-slate-700">{email}</span>. Use essa senha para entrar no sistema a partir de agora.
              </p>

              {/* Nova senha */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1.5">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full text-sm pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A6FA8] font-sans"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className={`text-[10px] mt-1 font-sans font-medium ${isStrong ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {isStrong ? '✓ Senha segura' : '⚠ Mínimo de 8 caracteres'}
                  </div>
                )}
              </div>

              {/* Confirmar senha */}
              <div className="mb-5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full text-sm pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A6FA8] font-sans"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm.length > 0 && (
                  <div className={`text-[10px] mt-1 font-sans font-medium ${isMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isMatch ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-sans rounded-lg px-4 py-2.5 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !isStrong || !isMatch}
                className="w-full py-3 bg-[#1A6FA8] hover:bg-[#135480] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors font-sans"
              >
                {loading ? 'Salvando...' : 'Definir Senha e Acessar o Painel →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
