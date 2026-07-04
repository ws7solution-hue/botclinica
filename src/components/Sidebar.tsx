import React from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar, 
  Users, 
  Settings, 
  BarChart3,
  Bot,
  Activity,
  CircleDot,
  Edit2,
  LogOut
} from 'lucide-react';
import { SidebarTab, UserProfile, AtendiaPlan } from '../types';

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  unreadChats: number;
  whatsappConnected: boolean;
  userProfile: UserProfile;
  onEditProfile: () => void;
  onLogout?: () => void;
  currentPlan: AtendiaPlan;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  unreadChats, 
  whatsappConnected,
  userProfile,
  onEditProfile,
  onLogout,
  currentPlan
}: SidebarProps) {
  const menuItems = [
    { id: 'overview' as SidebarTab, label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'chats' as SidebarTab, label: 'Conversas', icon: MessageSquare, badge: unreadChats },
    { id: 'calendar' as SidebarTab, label: 'Agenda', icon: Calendar },
    { id: 'doctors' as SidebarTab, label: 'Médicos', icon: Users },
    { id: 'prontuario' as SidebarTab, label: 'Prontuário', icon: Activity },
    { id: 'reports' as SidebarTab, label: 'Relatórios', icon: BarChart3 },
    { id: 'settings' as SidebarTab, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside 
      id="sidebar"
      className="w-[220px] min-w-[220px] bg-[#0F1623] text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 shadow-2xl"
      style={{ height: '100dvh' }}
    >
      {/* Brand Logo Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1A6FA8] flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-sans font-bold text-white text-base tracking-tight leading-none">
            Atend<span className="text-[#1A6FA8]">IA</span>
          </h1>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase block mt-1">
            by BotClínica
          </span>
        </div>
      </div>

      {/* Connection Quick Badge & Plan Badge */}
      <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/40 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-sans">Canal WhatsApp</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className={whatsappConnected ? 'text-emerald-400' : 'text-red-400'}>
              {whatsappConnected ? 'Online' : 'Desconectado'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/40">
          <span className="text-slate-400 font-sans">Plano Atual</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
            currentPlan === 'starter' ? 'bg-slate-800 text-slate-300' :
            currentPlan === 'profissional' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
            currentPlan === 'clinica' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' :
            'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
          }`}>
            {currentPlan === 'starter' ? '🌱 Starter' :
             currentPlan === 'profissional' ? '⭐ Profissional' :
             currentPlan === 'clinica' ? '🏥 Clínica' :
             '👑 Premium'}
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              id={`nav-${item.id}`}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive 
                  ? 'bg-[#1A6FA8] text-white font-semibold' 
                  : 'hover:bg-slate-800/60 hover:text-white text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="font-sans">{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white text-[#1A6FA8]' : 'bg-[#1A6FA8] text-white'
                }`}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Divider */}
        <div className="border-t border-slate-800/60 my-2" />

        {/* Perfil */}
        <button
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 text-left transition-all cursor-pointer group"
          title="Editar perfil"
        >
          <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shrink-0">
            <img src={userProfile.avatarUrl} alt={userProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-300 truncate font-sans group-hover:text-white">
              {userProfile.accountType === 'clinic' ? (userProfile.clinicName || userProfile.name) : (userProfile.doctorName || userProfile.name)}
            </p>
          </div>
          <Edit2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
        </button>

        {/* Sair */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium font-sans">Sair</span>
          </button>
        )}

        {/* Versão */}
        <div className="px-3 pt-1">
          <span className="text-[10px] text-slate-700 font-mono">v2.4.0-prod</span>
        </div>
      </nav>
    </aside>
  );
}
