import React, { useState } from 'react';
import { Bot, Lock, Mail, Eye, EyeOff, Loader } from 'lucide-react';
import { fbLogin, fbGetPlan } from '../firebase';

interface LoginScreenProps {
  onLogin: (email: string, plan: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const loginRes = await fbLogin(email, password);
      if (loginRes.error) {
        setError('Email ou senha incorretos.');
        setLoading(false);
        return;
      }
      const planRes = await fbGetPlan(email);
      const plan = planRes.plano || 'starter';
      localStorage.setItem('bc_email', email);
      localStorage.setItem('bc_plan', plan);
      onLogin(email, plan);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4 shadow-lg">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Atend<span className="text-cyan-400">IA</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">by BotClínica</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Bem-vindo de volta</h2>
          <p className="text-gray-500 text-sm mb-6">Entre com suas credenciais para acessar o painel</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Ainda não tem conta?{' '}
              <a href="/checkout" className="text-blue-600 font-semibold hover:underline">
                Assinar agora →
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 BotClínica · botclinica.com.br
        </p>
      </div>
    </div>
  );
}
