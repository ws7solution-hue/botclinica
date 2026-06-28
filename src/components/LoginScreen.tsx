import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  Stethoscope, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Sparkles, 
  Eye, 
  EyeOff, 
  CheckCircle,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

type AuthView = 'login' | 'register' | 'forgot';

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [view, setView] = useState<AuthView>('login');
  
  // Login form fields
  const [loginIdentifier, setLoginIdentifier] = useState('patricia@atendia.com.br');
  const [loginPassword, setLoginPassword] = useState('atendia123');
  const [showPassword, setShowPassword] = useState(false);

  // Register form fields
  const [registerAccountType, setRegisterAccountType] = useState<'clinic' | 'individual'>('clinic');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerResponsible, setRegisterResponsible] = useState('');

  // Forgot password form fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Validation/Error messages
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginIdentifier.trim()) {
      setError('Por favor, insira seu Nome ou E-mail.');
      return;
    }
    if (!loginPassword || loginPassword.length < 4) {
      setError('Por favor, insira uma senha válida.');
      return;
    }

    // Dynamic login mock success
    // Detect if they logged in with custom registered profile
    const registeredLocal = localStorage.getItem('atendia_registered_profile');
    if (registeredLocal) {
      try {
        const parsed = JSON.parse(registeredLocal);
        if (loginIdentifier.trim().toLowerCase() === parsed.email.toLowerCase() || loginIdentifier.trim() === parsed.name) {
          onLoginSuccess({
            accountType: parsed.accountType,
            clinicName: parsed.clinicName,
            doctorName: parsed.doctorName,
            name: parsed.name,
            role: parsed.role,
            avatarUrl: parsed.avatarUrl,
            crm: parsed.crm,
            specialty: parsed.specialty
          });
          return;
        }
      } catch (err) {
        // Fallback
      }
    }

    // Default Fallback success
    const defaultProfile: UserProfile = {
      accountType: 'clinic',
      clinicName: 'Clínica Atendia',
      name: 'Dra. Patrícia Lima',
      role: 'Diretora Clínica',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'
    };
    onLoginSuccess(defaultProfile);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!registerName.trim()) {
      setError(registerAccountType === 'clinic' ? 'Por favor, digite o Nome da Clínica.' : 'Por favor, digite o Nome do Médico.');
      return;
    }
    if (!registerEmail.trim()) {
      setError('Por favor, digite o e-mail de contato.');
      return;
    }
    if (!registerPassword || registerPassword.length < 6) {
      setError('Sua senha de segurança deve conter pelo menos 6 caracteres.');
      return;
    }

    // Auto-compute simulated details & fallback avatar
    const avatarUrl = registerAccountType === 'clinic' 
      ? 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150' // standard admin/clinic preview image
      : 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=150'; // standard doctor preview image

    const newProfile: UserProfile & { email: string } = {
      accountType: registerAccountType,
      name: registerAccountType === 'individual' ? registerName.trim() : (registerResponsible.trim() || 'Gestor Admin'),
      role: registerAccountType === 'individual' ? 'Médico Especialista' : 'Responsável Admin',
      clinicName: registerAccountType === 'clinic' ? registerName.trim() : undefined,
      doctorName: registerAccountType === 'individual' ? registerName.trim() : undefined,
      specialty: registerAccountType === 'individual' ? 'Clínica Geral' : undefined,
      crm: registerAccountType === 'individual' ? 'CRM-9988/SP' : undefined,
      avatarUrl: avatarUrl,
      email: registerEmail.trim()
    };

    // Save in storage to authorize dynamic login later
    localStorage.setItem('atendia_registered_profile', JSON.stringify(newProfile));
    
    // Simulate activation & direct redirect
    setSuccessMsg('Cadastro realizado com sucesso! Conectando você ao painel AtendIA...');
    setTimeout(() => {
      onLoginSuccess(newProfile);
    }, 1500);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!forgotEmail.trim()) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setForgotSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glowing Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />

      {/* Auth Card Frame */}
      <div className="w-full max-w-md bg-slate-850/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 md:p-8 relative z-10 text-white font-sans">
        
        {/* AtendIA Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-full text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#1A6FA8]" />
            Sistema Inteligente AtendIA
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            atend<span className="text-blue-400">IA</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma de Automação para Clínicas & Médicos
          </p>
        </div>

        {error && (
          <div className="p-3 mb-5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg text-center font-medium animate-pulse flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* 1. LOGIN VIEW */}
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome ou E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: patricia@atendia.com.br"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setView('forgot');
                      }}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 focus:outline-hidden"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-hidden p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#1A6FA8] hover:bg-[#135480] active:bg-[#0e3f60] text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-6"
                >
                  <span>Entrar no AtendIA</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="pt-4 mt-4 border-t border-slate-800 text-center">
                  <span className="text-xs text-slate-500">Não tem conta ainda? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setView('register');
                    }}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 focus:outline-hidden"
                  >
                    Cadastre-se
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* 2. REGISTER VIEW */}
          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Mode Select / Segment switch */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Tipo de Perfil de Atuação
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRegisterAccountType('clinic')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        registerAccountType === 'clinic'
                          ? 'bg-[#1A6FA8] text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Building className="w-3 h-3" />
                      Clínica Médica
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterAccountType('individual')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        registerAccountType === 'individual'
                          ? 'bg-[#1A6FA8] text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Stethoscope className="w-3 h-3" />
                      Médico Individual
                    </button>
                  </div>
                </div>

                {/* Name - Dynamic label based on Segment Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {registerAccountType === 'clinic' ? 'Nome da Clínica' : 'Nome do Médico'} *
                  </label>
                  <div className="relative">
                    {registerAccountType === 'clinic' ? (
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    ) : (
                      <Stethoscope className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    )}
                    <input
                      type="text"
                      required
                      placeholder={registerAccountType === 'clinic' ? 'Ex: Clínica Vida e Saúde' : 'Ex: Dr. Roberto Silveira'}
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                    />
                  </div>
                </div>

                {/* Admin responsible person for Clinic mode */}
                {registerAccountType === 'clinic' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Responsável Técnico / Admin
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Ex: Ana Souza (Diretora)"
                        value={registerResponsible}
                        onChange={(e) => setRegisterResponsible(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    E-mail de Login *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="Ex: contato@atendia.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Senha de Acesso *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#1A6FA8] hover:bg-[#135480] active:bg-[#0e3f60] text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-6"
                >
                  <span>Concluir Cadastro</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setView('login');
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 mx-auto focus:outline-hidden"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para Login
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* 3. FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {!forgotSubmitted ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    Insira seu e-mail cadastrado no sistema para receber instruções de recuperação de acesso.
                  </p>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      E-mail Cadastrado
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="Ex: patricia@atendia.com.br"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-750 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#1A6FA8] hover:bg-[#135480] text-white font-bold rounded-lg text-xs shadow-md transition-colors cursor-pointer mt-4"
                  >
                    Enviar Link de Recuperação
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setView('login');
                      }}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 mx-auto focus:outline-hidden"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar para o Login
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/25">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold font-sans text-white">E-mail de Recuperação Enviado!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-xs mx-auto">
                    Se o e-mail <strong>{forgotEmail}</strong> estiver cadastrado em nosso sistema, você receberá um link seguro para redefinir sua senha em instantes.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setForgotSubmitted(false);
                      setForgotEmail('');
                      setView('login');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Voltar para o Login
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
