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
import { SidebarTab, UserProfile } from '../types';

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  unreadChats: number;
  whatsappConnected: boolean;
  userProfile: UserProfile;
  onEditProfile: () => void;
  onLogout?: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  unreadChats, 
  whatsappConnected,
  userProfile,
  onEditProfile,
  onLogout
}: SidebarProps) {
  const menuItems = [
    { id: 'overview' as SidebarTab, label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'chats' as SidebarTab, label: 'Conversas', icon: MessageSquare, badge: unreadChats },
    { id: 'calendar' as SidebarTab, label: 'Agenda', icon: Calendar },
    { id: 'doctors' as SidebarTab, label: 'Médicos', icon: Users },
    { id: 'reports' as SidebarTab, label: 'Relatórios', icon: BarChart3 },
    { id: 'settings' as SidebarTab, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside 
      id="sidebar"
      className="w-[220px] min-w-[220px] bg-[#0F1623] text-slate-300 flex flex-col h-screen border-r border-slate-800 transition-all duration-300"
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

      {/* Connection Quick Badge */}
      <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-sans">Canal WhatsApp</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className={whatsappConnected ? 'text-emerald-400' : 'text-red-400'}>
              {whatsappConnected ? 'Online' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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
      </nav>

      {/* Sidebar Footer User Profile */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={onEditProfile}
            className="flex-1 flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-800/40 text-left transition-all cursor-pointer group relative overflow-hidden focus:outline-hidden"
            title="Clique para editar seu perfil"
          >
            <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-800 group-hover:border-[#1A6FA8] transition-all shrink-0 relative">
              <img 
                src={userProfile.avatarUrl} 
                alt={userProfile.name}
                className="w-full h-full object-cover group-hover:opacity-80 transition-all"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight font-sans group-hover:text-blue-300 transition-colors">
                {userProfile.accountType === 'clinic' ? (userProfile.clinicName || userProfile.name) : (userProfile.doctorName || userProfile.name)}
              </p>
              <p className="text-[11px] text-slate-500 truncate font-sans">
                {userProfile.accountType === 'clinic' ? userProfile.role : `${userProfile.specialty || 'Médico'} • CRM ${userProfile.crm || 'N/A'}`}
              </p>
            </div>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer focus:outline-hidden shrink-0"
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* System Micro Credits (Humble, clean, professional) */}
        <div className="text-[10px] text-slate-600 flex items-center justify-between px-1">
          <span className="font-mono">v2.4.0-prod</span>
          <span className="flex items-center gap-0.5 font-sans">
            <CircleDot className="w-2.5 h-2.5 text-emerald-500" /> Ativo
          </span>
        </div>
      </div>
    </aside>
  );
}
