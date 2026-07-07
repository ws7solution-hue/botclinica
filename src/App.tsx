import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardOverview from './components/DashboardOverview';
import ChatPanel from './components/ChatPanel';
import CalendarPanel from './components/CalendarPanel';
import DoctorsPanel from './components/DoctorsPanel';
import SettingsPanel from './components/SettingsPanel';
import ReportsPanel from './components/ReportsPanel';
import ProntuarioPanel from './components/ProntuarioPanel';
import FirstAccessModal from './components/FirstAccessModal';
import SupportChat from './components/SupportChat';
import HumanAlert from './components/HumanAlert';
import ProfileModal from './components/ProfileModal';
import LoginScreen from './components/LoginScreen';

import { 
  SidebarTab, 
  Conversation, 
  Appointment, 
  Doctor, 
  SystemLogs,
  UserProfile,
  AtendiaPlan
} from './types';

import { 
  INITIAL_DOCTORS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_SYSTEM_LOGS, 
  INITIAL_BOT_SETTINGS 
} from './data';

import { 
  fbListDoctors, 
  fbSaveDoctor, 
  fbDeleteDoctor, 
  fbListAppointments, 
  fbSaveAppointment, 
  fbListConversations, 
  fbSaveConversation 
} from './firebase';

import { Sparkles, X, Calendar, User, Phone, Clock, Stethoscope, AlertCircle, CalendarCheck } from 'lucide-react';

export const DEMO_EMAIL = 'contato@botclinica.com.br';

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  
  // Real-time State containers
  const [conversations, setRawConversations] = useState<Conversation[]>(() => {
    const email = localStorage.getItem('atendia_email') || '';
    return email === DEMO_EMAIL ? INITIAL_CONVERSATIONS : [];
  });
  const [appointments, setRawAppointments] = useState<Appointment[]>(() => {
    const email = localStorage.getItem('atendia_email') || '';
    return email === DEMO_EMAIL ? INITIAL_APPOINTMENTS : [];
  });
  const [doctors, setRawDoctors] = useState<Doctor[]>(() => {
    const email = localStorage.getItem('atendia_email') || '';
    return email === DEMO_EMAIL ? INITIAL_DOCTORS : [];
  });

  // State Wrappers for automatic Firestore persistence (transparently intercepts all calls)
  const setConversations = (update: React.SetStateAction<Conversation[]>) => {
    setRawConversations(prev => {
      const next = typeof update === 'function' ? (update as Function)(prev) : update;
      const userEmail = localStorage.getItem('atendia_email') || '';
      if (userEmail && userEmail !== DEMO_EMAIL && isLoggedIn) {
        const clinicId = userEmail.toLowerCase().replace(/[@.]/g, '_');
        const prevMap = new Map<string, Conversation>(prev.map(c => [c.id, c]));
        const nextMap = new Map<string, Conversation>(next.map(c => [c.id, c]));

        for (const [id, conv] of nextMap.entries()) {
          const prevConv = prevMap.get(id);
          if (!prevConv || JSON.stringify(prevConv) !== JSON.stringify(conv)) {
            fbSaveConversation(clinicId, conv).catch(e => console.error("Error saving conversation:", e));
          }
        }
      }
      return next;
    });
  };

  const setAppointments = (update: React.SetStateAction<Appointment[]>) => {
    setRawAppointments(prev => {
      const next = typeof update === 'function' ? (update as Function)(prev) : update;
      const userEmail = localStorage.getItem('atendia_email') || '';
      if (userEmail && userEmail !== DEMO_EMAIL && isLoggedIn) {
        const clinicId = userEmail.toLowerCase().replace(/[@.]/g, '_');
        const prevMap = new Map<string, Appointment>(prev.map(a => [a.id, a]));
        const nextMap = new Map<string, Appointment>(next.map(a => [a.id, a]));

        for (const [id, appt] of nextMap.entries()) {
          const prevAppt = prevMap.get(id);
          if (!prevAppt || JSON.stringify(prevAppt) !== JSON.stringify(appt)) {
            fbSaveAppointment(clinicId, appt).catch(e => console.error("Error saving appointment:", e));
          }
        }
      }
      return next;
    });
  };

  const setDoctors = (update: React.SetStateAction<Doctor[]>) => {
    setRawDoctors(prev => {
      const next = typeof update === 'function' ? (update as Function)(prev) : update;
      const userEmail = localStorage.getItem('atendia_email') || '';
      if (userEmail && userEmail !== DEMO_EMAIL && isLoggedIn) {
        const clinicId = userEmail.toLowerCase().replace(/[@.]/g, '_');
        const prevMap = new Map<string, Doctor>(prev.map(d => [d.id, d]));
        const nextMap = new Map<string, Doctor>(next.map(d => [d.id, d]));

        // Deletions
        for (const id of prevMap.keys()) {
          if (!nextMap.has(id)) {
            fbDeleteDoctor(clinicId, id).catch(e => console.error("Error deleting doctor:", e));
          }
        }
        // Additions/updates
        for (const [id, doc] of nextMap.entries()) {
          const prevDoc = prevMap.get(id);
          if (!prevDoc || JSON.stringify(prevDoc) !== JSON.stringify(doc)) {
            fbSaveDoctor(clinicId, doc).catch(e => console.error("Error saving doctor:", e));
          }
        }
      }
      return next;
    });
  };
  const [systemLogs, setSystemLogs] = useState<SystemLogs[]>(INITIAL_SYSTEM_LOGS);
  const [botSettings, setBotSettings] = useState(INITIAL_BOT_SETTINGS);
  const [whatsappConnected, setWhatsappConnected] = useState(true);
  
  // User Subscription Plan state (persisted in localStorage)
  const [currentPlan, setCurrentPlan] = useState<AtendiaPlan>(() => {
    const saved = localStorage.getItem('atendia_plan');
    if (saved && ['starter', 'profissional', 'clinica', 'premium'].includes(saved)) {
      return saved as AtendiaPlan;
    }
    localStorage.setItem('atendia_plan', 'starter');
    return 'starter';
  });
  
  // Clinic specialties list managed in settings and utilized in clinical body
  const [specialties, setSpecialties] = useState<string[]>([
    "Clínica Geral", 
    "Cardiologia", 
    "Dermatologia", 
    "Ortopedia", 
    "Ginecologia", 
    "Oftalmologia", 
    "Pediatria", 
    "Urologia", 
    "Neurologia", 
    "Endocrinologia"
  ]);
  
  // Interaction & UI Help States
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [prefilledPatientName, setPrefilledPatientName] = useState('');
  const [prefilledPatientPhone, setPrefilledPatientPhone] = useState('');

  // User Profile configuration state (persisted in localStorage)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('atendia_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore parsing error
      }
    }
    return {
      accountType: 'clinic',
      clinicName: 'Clínica Atendia',
      name: 'Dra. Patrícia Lima',
      role: 'Diretora Clínica',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100'
    };
  });
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Session Authentication status
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('atendia_logged_in') === 'true';
  });
  const [showFirstAccess, setShowFirstAccess] = useState(false);
  const [firstAccessIdToken, setFirstAccessIdToken] = useState('');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const handleLoginSuccess = (profile: UserProfile) => {
    const email = (profile.email || localStorage.getItem('atendia_email') || '').trim().toLowerCase();
    localStorage.setItem('atendia_email', email);
    localStorage.setItem('atendia_logged_in', 'true');
    setUserProfile({ ...profile, email });
    setIsLoggedIn(true);

    // LoginScreen já salvou o plano real (vindo do Firestore via fbLogin) em localStorage('atendia_plan').
    // Sincronizamos o estado currentPlan com isso agora, já que o useState inicial só roda 1x no mount do App.
    const savedPlan = localStorage.getItem('atendia_plan');
    if (savedPlan && ['starter', 'profissional', 'clinica', 'premium'].includes(savedPlan)) {
      setCurrentPlan(savedPlan as AtendiaPlan);
    }

    if (email === DEMO_EMAIL) {
      setConversations(prev => prev.length === 0 ? INITIAL_CONVERSATIONS : prev);
      setAppointments(prev => prev.length === 0 ? INITIAL_APPOINTMENTS : prev);
      setDoctors(prev => prev.length === 0 ? INITIAL_DOCTORS : prev);
    } else {
      setConversations([]);
      setAppointments([]);
      setDoctors([]);
    }

    addSystemLog('success', `Bem-vindo de volta, ${profile.accountType === 'clinic' ? (profile.clinicName || profile.name) : (profile.doctorName || profile.name)}! Login efetuado.`);

    // Primeiro acesso — abre modal pra definir senha própria
    // Só mostra se o servidor confirmou firstAccess: true (não depende só do profile local)
    // E só mostra em login novo (não em reload de sessão existente)
    if (profile.firstAccess === true && profile.idToken && !localStorage.getItem('atendia_password_set')) {
      setFirstAccessIdToken(profile.idToken);
      setShowFirstAccess(true);
    }
  };

  // Sincroniza email no localStorage sempre que userProfile mudar
  React.useEffect(() => {
    if (userProfile.email) {
      localStorage.setItem('atendia_email', userProfile.email);
    }
  }, [userProfile.email]);

  // Save profile to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('atendia_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Detecta redirect pós-pagamento
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success' && sessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      
      // Mostra loading enquanto processa
      document.getElementById('payment-loading')?.style.setProperty('display', 'flex');

      fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getSession', sessionId }),
      })
      .then(r => r.json())
      .then(async d => {
        console.log('getSession response:', JSON.stringify({email: d.email, hasPassword: !!d.senhaTemp, plano: d.plano}));
        if (d.email && d.senhaTemp) {
          const lr = await fetch('/api/fb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'login', 
              payload: { email: d.email, password: d.senhaTemp }
            }),
          });
          const ld = await lr.json();
          console.log('login response:', JSON.stringify({ok: ld.ok, error: ld.error}));
          if (ld.ok) {
            if (d.plano) localStorage.setItem('atendia_plan', d.plano);
            handleLoginSuccess({
              ...ld,
              email: d.email,
              clinicName: d.clinicName || '',
              firstAccess: true,
            });
            setTimeout(() => addSystemLog('success', '🎉 Pagamento confirmado! Crie sua senha para continuar.'), 500);
          }
        }
        document.getElementById('payment-loading')?.style.setProperty('display', 'none');
      })
      .catch(() => {
        document.getElementById('payment-loading')?.style.setProperty('display', 'none');
        addSystemLog('info', '✅ Pagamento confirmado! Faça login para acessar o painel.');
      });
    }
  }, []);

  // Verifica firstAccess para usuários já logados (ex: redirect pós-pagamento)
  React.useEffect(() => {
    if (!isLoggedIn) return;
    if (localStorage.getItem('atendia_password_set')) return;
    const email = (userProfile.email || localStorage.getItem('atendia_email') || '').trim().toLowerCase();
    if (!email || email === DEMO_EMAIL) return;

    // Busca direto do Firestore se é primeiro acesso
    fetch('/api/fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkFirstAccess', payload: { email } }),
    })
    .then(r => r.json())
    .then(d => {
      if (d.firstAccess === true && d.idToken) {
        setFirstAccessIdToken(d.idToken);
        setShowFirstAccess(true);
      }
    })
    .catch(() => {});
  }, [isLoggedIn]);

  // Synchronize Firestore Data for non-demo users
  React.useEffect(() => {
    if (!isLoggedIn) return;

    const email = (userProfile.email || localStorage.getItem('atendia_email') || '').trim().toLowerCase();
    if (!email || email === DEMO_EMAIL) return;

    const clinicId = email.replace(/[@.]/g, '_');
    let isMounted = true;

    addSystemLog('info', 'Sincronizando médicos cadastrados com o Firestore...');
    fbListDoctors(clinicId)
      .then((docsList) => {
        if (isMounted) {
          setRawDoctors(docsList || []);
          addSystemLog('success', `Médicos sincronizados: ${docsList.length} encontrados.`);
        }
      })
      .catch((err) => {
        console.error("Error fetching doctors:", err);
        addSystemLog('error', `Erro na sincronização de médicos: ${err.message}. Mantendo dados locais.`);
      });

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, userProfile.email]);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    const email = (userProfile.email || localStorage.getItem('atendia_email') || '').trim().toLowerCase();
    if (!email || email === DEMO_EMAIL) return;

    const clinicId = email.replace(/[@.]/g, '_');
    let isMounted = true;

    addSystemLog('info', 'Sincronizando agendamentos com o Firestore...');
    fbListAppointments(clinicId)
      .then((apptsList) => {
        if (isMounted) {
          setRawAppointments(apptsList || []);
          addSystemLog('success', `Agendamentos sincronizados: ${apptsList.length} encontrados.`);
        }
      })
      .catch((err) => {
        console.error("Error fetching appointments:", err);
        addSystemLog('error', `Erro na sincronização de agendamentos: ${err.message}. Mantendo dados locais.`);
      });

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, userProfile.email]);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    const email = (userProfile.email || localStorage.getItem('atendia_email') || '').trim().toLowerCase();
    if (!email || email === DEMO_EMAIL) return;

    const clinicId = email.replace(/[@.]/g, '_');
    let isMounted = true;
    let prevHumanNeeded = 0;

    const fetchConversations = () => {
      fbListConversations(clinicId)
        .then((convsList) => {
          if (!isMounted) return;
          setRawConversations(convsList || []);

          // Detecta novas conversas com human_needed e notifica
          const humanNeeded = (convsList || []).filter(c => c.status === 'human_needed').length;
          if (humanNeeded > prevHumanNeeded) {
            addSystemLog('warning', `🙋 Paciente solicitou atendimento humano! Vá em Conversas para responder.`);
          }
          prevHumanNeeded = humanNeeded;
        })
        .catch((err) => {
          console.error("Error fetching conversations:", err);
        });
    };

    addSystemLog('info', 'Sincronizando conversas com o Firestore...');
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn, userProfile.email]);

  // Global Appointment Modal states
  const [modalPatientName, setModalPatientName] = useState('');
  const [modalPatientPhone, setModalPatientPhone] = useState('');
  const [modalDoctorId, setModalDoctorId] = useState('');
  const [modalDayOfWeek, setModalDayOfWeek] = useState('');
  const [modalTime, setModalTime] = useState('');

  // Get upcoming YYYY-MM-DD date for a given Portuguese weekday abbreviation
  const getNextDateForDayOfWeek = (dayKey: string): string => {
    const daysMap: Record<string, number> = {
      'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sáb': 6
    };
    const targetDayNum = daysMap[dayKey] ?? 1;
    const today = new Date();
    const currentDayNum = today.getDay(); // 0 is Sunday, 6 is Saturday
    
    let diff = targetDayNum - currentDayNum;
    if (diff <= 0) {
      diff += 7; // Next week's occurrence
    }
    
    const resultDate = new Date(today);
    resultDate.setDate(today.getDate() + diff);
    return resultDate.toISOString().split('T')[0];
  };

  // Helper to format date as DD/MM/YYYY
  const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Translate abbreviations to Portuguese
  const getDayLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'Seg': 'Segunda-feira',
      'Ter': 'Terça-feira',
      'Qua': 'Quarta-feira',
      'Qui': 'Quinta-feira',
      'Sex': 'Sexta-feira',
      'Sáb': 'Sábado'
    };
    return labels[key] || key;
  };

  // Generate time slots for doctor respecting duration and breaks
  const getDoctorTimeSlots = (doctor: Doctor) => {
    const start = doctor.startTime || '08:00';
    const end = doctor.endTime || '18:00';
    const duration = doctor.slotDuration || 30; // padrão 30 minutos
    const slots: string[] = [];
    
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toStr = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

    const startMin = toMin(start);
    const endMin = toMin(end);
    const break1Start = doctor.breakStart ? toMin(doctor.breakStart) : null;
    const break1End = doctor.breakEnd ? toMin(doctor.breakEnd) : null;
    const break2Start = doctor.break2Start ? toMin(doctor.break2Start) : null;
    const break2End = doctor.break2End ? toMin(doctor.break2End) : null;

    for (let m = startMin; m + duration <= endMin; m += duration) {
      // Verifica se o slot cai dentro de alguma pausa
      const slotEnd = m + duration;
      const inBreak1 = break1Start !== null && break1End !== null && m < break1End && slotEnd > break1Start;
      const inBreak2 = break2Start !== null && break2End !== null && m < break2End && slotEnd > break2Start;
      if (!inBreak1 && !inBreak2) slots.push(toStr(m));
    }
    return slots;
  };

  // Sync modal states on open/change
  React.useEffect(() => {
    if (quickAddOpen) {
      setModalPatientName(prefilledPatientName);
      setModalPatientPhone(prefilledPatientPhone);
      
      // Auto-select first active doctor in active specialties
      const activeDocs = doctors.filter(d => d.isActive && specialties.includes(d.specialty));
      if (activeDocs.length > 0) {
        setModalDoctorId(activeDocs[0].id);
        const docDays = activeDocs[0].attendanceDays || [];
        if (docDays.length > 0) {
          setModalDayOfWeek(docDays[0]);
        } else {
          setModalDayOfWeek('');
        }
      } else {
        setModalDoctorId('');
        setModalDayOfWeek('');
      }
      setModalTime('');
    }
  }, [quickAddOpen, prefilledPatientName, prefilledPatientPhone, doctors, specialties]);

  // Handle global scheduling submit
  const handleGlobalScheduleAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPatientName.trim() || !modalPatientPhone.trim() || !modalDoctorId || !modalDayOfWeek || !modalTime) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    const doctor = doctors.find(d => d.id === modalDoctorId);
    if (!doctor) return;

    const computedDate = getNextDateForDayOfWeek(modalDayOfWeek);

    // Double check availability
    const isOccupied = appointments.some(appt => 
      appt.doctorId === doctor.id && 
      appt.date === computedDate && 
      appt.time === modalTime && 
      appt.status !== 'canceled'
    );

    if (isOccupied) {
      alert("Desculpe, este horário acabou de ser ocupado. Por favor, selecione outro horário disponível.");
      return;
    }

    const newAppointment: Appointment = {
      id: `appt-${Date.now()}`,
      patientName: modalPatientName.trim(),
      patientPhone: modalPatientPhone.trim(),
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date: computedDate,
      time: modalTime,
      status: 'confirmed', // Confirmed automatically
      reminderSent: true,
      reminderStatus: 'sent'
    };

    setAppointments(prev => [newAppointment, ...prev]);
    addSystemLog('success', `Consulta agendada via painel: ${newAppointment.patientName} com ${newAppointment.doctorName} na ${getDayLabel(modalDayOfWeek)} (${formatDateBR(computedDate)}) às ${modalTime}.`);
    
    // Reset modal state
    setQuickAddOpen(false);
  };
  
  // Simulated Alert modal banner state
  const [simulationAlert, setSimulationAlert] = useState<{
    show: boolean;
    patientName: string;
    messageText: string;
    chatId: string;
  } | null>(null);

  // Helper: Append operational logs
  const addSystemLog = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
    const newLog: SystemLogs = {
      id: `log-${Date.now()}`,
      type,
      message,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setSystemLogs(prev => [newLog, ...prev]);
  };

  // Helper: Toggle Whatsapp connection
  const handleToggleWhatsapp = () => {
    setWhatsappConnected(prev => {
      const next = !prev;
      if (next) {
        addSystemLog('success', 'Canal WhatsApp AtendIA reconectado com sucesso.');
      } else {
        addSystemLog('error', 'Conexão com WhatsApp encerrada. Robô pausado.');
      }
      return next;
    });
  };

  // Helper: Trigger quick scheduler popup from anywhere
  const handleOpenQuickAppointment = () => {
    setPrefilledPatientName('');
    setPrefilledPatientPhone('');
    setQuickAddOpen(true);
  };

  // Helper: Trigger quick scheduler pre-filled from chat details
  const handleOpenQuickAppointmentWithPatient = (name: string, phone: string) => {
    setPrefilledPatientName(name);
    setPrefilledPatientPhone(phone);
    setQuickAddOpen(true);
  };

  // Helper: Clear system log panel
  const handleClearLogs = () => {
    setSystemLogs([]);
  };

  // Core Interactive Simulation: Inbound Patient WhatsApp Message Simulator
  const handleSimulateIncomingChat = () => {
    const simulationScenarios = [
      {
        patientName: "Dr. Pedro de Alcântara",
        patientPhone: "+55 (11) 99182-4411",
        category: "Agendamento",
        doctorAssignedId: "doc-1", // Dr Claudio - Cardiologia
        messages: [
          { sender: "patient", text: "Olá! Gostaria de marcar retorno com Dr. Cláudio de Cardiologia para semana que vem." }
        ]
      },
      {
        patientName: "Gisele Bündchen de Souza",
        patientPhone: "+55 (11) 98555-8822",
        category: "Dúvida",
        doctorAssignedId: "doc-4", // Dra Sandra - Ginecologia
        messages: [
          { sender: "patient", text: "Olá! A Dra. Sandra atende gestantes no plano Allianz Saúde?" }
        ]
      },
      {
        patientName: "Thiago Neves Oliveira",
        patientPhone: "+55 (11) 96311-2345",
        category: "Urgência",
        doctorAssignedId: "doc-3", // Dr Roberto - Ortopedia
        messages: [
          { sender: "patient", text: "Sofri uma queda e machuquei o ombro. O Dr. Roberto tem algum horário de encaixe para hoje?" }
        ]
      }
    ];

    // Pick a random scenario
    const scenario = simulationScenarios[Math.floor(Math.random() * simulationScenarios.length)];
    const existingChatIdx = conversations.findIndex(c => c.patientPhone === scenario.patientPhone);

    let targetChatId = `conv-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (existingChatIdx > -1) {
      // Chat exists, add a message to it
      const existingChat = conversations[existingChatIdx];
      targetChatId = existingChat.id;
      
      const updatedMessages = [
        ...existingChat.messages,
        {
          id: `msg-sim-${Date.now()}`,
          sender: 'patient' as const,
          text: scenario.messages[0].text,
          timestamp
        }
      ];

      setConversations(prev => prev.map(c => c.id === targetChatId ? {
        ...c,
        unreadCount: c.unreadCount + 1,
        lastMessage: scenario.messages[0].text,
        lastMessageTime: timestamp,
        messages: updatedMessages,
        status: 'human_needed' // Automatically flag transbordo so user sees it in dashboard alert!
      } : c));

    } else {
      // Create a brand new conversation
      const colors = ['bg-indigo-500', 'bg-pink-500', 'bg-blue-500', 'bg-teal-500', 'bg-purple-500'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newConversation: Conversation = {
        id: targetChatId,
        patientName: scenario.patientName,
        patientPhone: scenario.patientPhone,
        status: 'human_needed', // needs transbordo
        lastMessage: scenario.messages[0].text,
        lastMessageTime: timestamp,
        unreadCount: 1,
        avatarColor: randomColor,
        category: scenario.category,
        assignedDoctorId: scenario.doctorAssignedId,
        messages: [
          {
            id: `msg-sim-init-${Date.now()}`,
            sender: 'patient',
            text: scenario.messages[0].text,
            timestamp
          }
        ]
      };

      setConversations(prev => [newConversation, ...prev]);
    }

    // Trigger toast simulation alert
    setSimulationAlert({
      show: true,
      patientName: scenario.patientName,
      messageText: scenario.messages[0].text,
      chatId: targetChatId
    });

    addSystemLog('warning', `Novo webhook do WhatsApp: Mensagem recebida de ${scenario.patientName}.`);

    // Dismiss toast automatically after 6 seconds
    setTimeout(() => {
      setSimulationAlert(prev => prev?.chatId === targetChatId ? null : prev);
    }, 6000);
  };

  // Helper: Open chat directly from simulated notification alert
  const handleOpenChatFromAlert = (id: string) => {
    setSelectedChatId(id);
    setActiveTab('chats');
    setSimulationAlert(null);
    // Mark read
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
  };

  // Count unread chats for the sidebar badge
  const unreadChatsCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F2F5] text-slate-700 antialiased font-sans">
      
      {/* Overlay - all screens */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 1. Dark Left Sidebar */}
      <div className={`fixed z-50 h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }} 
          unreadChats={unreadChatsCount}
          whatsappConnected={whatsappConnected}
          userProfile={userProfile}
          onEditProfile={() => setProfileModalOpen(true)}
          currentPlan={currentPlan}
          onLogout={() => {
            setIsLoggedIn(false);
            localStorage.removeItem('atendia_logged_in');
            localStorage.removeItem('atendia_email');
            localStorage.removeItem('atendia_password_set');
            setDoctors([]);
            setAppointments([]);
            setConversations([]);
            addSystemLog('info', 'Sessão encerrada com sucesso.');
          }}
        />
      </div>

      {/* 2. Main content block */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Fixed Topbar */}
        <Topbar 
          activeTab={activeTab}
          whatsappConnected={whatsappConnected}
          onToggleWhatsapp={handleToggleWhatsapp}
          onSimulateIncomingChat={handleSimulateIncomingChat}
          onOpenQuickAppointment={handleOpenQuickAppointment}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          systemLogsCount={systemLogs.length}
          systemLogs={systemLogs}
          onClearLogs={handleClearLogs}
        />

        {/* Dynamic Inner Tab View */}
        <main className="flex-1 overflow-y-auto bg-[#F0F2F5]">
          {activeTab === 'overview' && (
            <DashboardOverview 
              conversations={conversations}
              setConversations={setConversations}
              appointments={appointments}
              systemLogs={systemLogs}
              onAddSystemLog={addSystemLog}
              whatsappConnected={whatsappConnected}
              onToggleWhatsapp={handleToggleWhatsapp}
              setActiveTab={setActiveTab}
              setSelectedChatId={setSelectedChatId}
              onClearLogs={handleClearLogs}
              setQuickAddOpen={setQuickAddOpen}
              currentPlan={currentPlan}
            />
          )}

          {activeTab === 'chats' && (
            <ChatPanel 
              conversations={conversations}
              setConversations={setConversations}
              doctors={doctors}
              selectedChatId={selectedChatId}
              setSelectedChatId={setSelectedChatId}
              onAddSystemLog={addSystemLog}
              onOpenQuickAppointmentWithPatient={handleOpenQuickAppointmentWithPatient}
              clinicId={userProfile.email || localStorage.getItem('atendia_email') || ''}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarPanel 
              appointments={appointments}
              setAppointments={setAppointments}
              doctors={doctors}
              onAddSystemLog={addSystemLog}
              setQuickAddOpen={setQuickAddOpen}
              currentPlan={currentPlan}
            />
          )}

          {activeTab === 'doctors' && (
            <DoctorsPanel 
              doctors={doctors}
              setDoctors={setDoctors}
              onAddSystemLog={addSystemLog}
              specialties={specialties}
              setActiveTab={setActiveTab}
              currentPlan={currentPlan}
              clinicId={userProfile.email || localStorage.getItem('atendia_email') || ''}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsPanel 
              currentPlan={currentPlan} 
              conversations={conversations}
              appointments={appointments}
              doctors={doctors}
            />
          )}

          {activeTab === 'prontuario' && (
            <ProntuarioPanel 
              clinicId={localStorage.getItem('atendia_email')?.toLowerCase().replace(/[@.]/g, '_') || ''}
              conversations={conversations}
              doctors={doctors}
              currentPlan={currentPlan}
              onAddSystemLog={addSystemLog}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel 
              botSettings={botSettings}
              setBotSettings={setBotSettings}
              onAddSystemLog={addSystemLog}
              specialties={specialties}
              setSpecialties={setSpecialties}
              doctors={doctors}
              setActiveTab={setActiveTab}
              currentPlan={currentPlan}
              clinicId={userProfile.email || localStorage.getItem('atendia_email') || ''}
              onUpdateProfile={(clinicName, phone) => {
                const updated = { ...userProfile, clinicName, phone };
                setUserProfile(updated);
                localStorage.setItem('atendia_user_profile', JSON.stringify(updated));
              }}
            />
          )}
        </main>

        {/* Alerta de Atendimento Humano */}
        {isLoggedIn && (
          <HumanAlert
            conversations={conversations.filter(c => !dismissedAlerts.has(c.id))}
            onGoToChat={(id) => {
              setActiveTab('chats');
              setSelectedChatId(id);
              setDismissedAlerts(prev => new Set([...prev, id]));
            }}
            onDismiss={(id) => setDismissedAlerts(prev => new Set([...prev, id]))}
          />
        )}

        {/* Modal de Primeiro Acesso */}
        {showFirstAccess && (
          <FirstAccessModal
            email={userProfile.email || localStorage.getItem('atendia_email') || ''}
            idToken={firstAccessIdToken}
            onComplete={() => setShowFirstAccess(false)}
          />
        )}

        {/* Chat de Suporte */}
        {isLoggedIn && (
          <SupportChat
            email={userProfile.email || localStorage.getItem('atendia_email') || ''}
            clinicName={userProfile.clinicName || userProfile.name || ''}
            currentPlan={currentPlan}
          />
        )}

        {/* 3. Real-time Simulated Incoming message toast notifier */}
        {simulationAlert?.show && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#0F1623] text-white p-4 rounded-xl shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1A6FA8] animate-ping" />
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  WhatsApp Ativo
                </span>
              </div>
              <button 
                onClick={() => setSimulationAlert(null)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5">
              <h4 className="text-xs font-bold text-slate-150 font-sans">
                {simulationAlert.patientName}
              </h4>
              <p className="text-xs text-slate-400 italic mt-1 truncate font-sans">
                "{simulationAlert.messageText}"
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800/60 pt-3">
              <button
                onClick={() => setSimulationAlert(null)}
                className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Ignorar
              </button>
              <button
                id="toast-open-chat"
                onClick={() => handleOpenChatFromAlert(simulationAlert.chatId)}
                className="px-3 py-1 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-md text-[10px] font-bold transition-all cursor-pointer"
              >
                Ver Conversa
              </button>
            </div>
          </div>
        )}

        {/* 4. Global Quick Appointment Modal */}
        {quickAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay background */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setQuickAddOpen(false)}
            />
            
            {/* Modal box */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 font-sans flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-[#1A6FA8]" />
                  Marcar Nova Consulta Médica
                </h3>
                <button 
                  onClick={() => setQuickAddOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleGlobalScheduleAppointment} className="p-5 space-y-4">
                
                {/* Patient Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Nome Completo do Paciente *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="modal-patient-name"
                      type="text"
                      required
                      placeholder="Ex: Pedro Henrique de Souza"
                      value={modalPatientName}
                      onChange={(e) => setModalPatientName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white"
                    />
                  </div>
                </div>

                {/* Patient Phone / WhatsApp */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Telefone de Contato (WhatsApp) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="modal-patient-phone"
                      type="text"
                      required
                      placeholder="Ex: +55 (11) 99888-7766"
                      value={modalPatientPhone}
                      onChange={(e) => setModalPatientPhone(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white"
                    />
                  </div>
                </div>

                {/* Doctor Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Médico Especialista *
                  </label>
                  <div className="relative">
                    <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      id="modal-doctor-id"
                      required
                      value={modalDoctorId}
                      onChange={(e) => {
                        const docId = e.target.value;
                        setModalDoctorId(docId);
                        const selectedDoc = doctors.find(d => d.id === docId);
                        if (selectedDoc && selectedDoc.attendanceDays?.length > 0) {
                          setModalDayOfWeek(selectedDoc.attendanceDays[0]);
                        } else {
                          setModalDayOfWeek('');
                        }
                        setModalTime('');
                      }}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans"
                    >
                      <option value="">Selecione um profissional...</option>
                      {doctors
                        .filter(d => d.isActive && specialties.includes(d.specialty))
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                {/* Day of week & Time grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Day of the week selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                      Dia da Semana *
                    </label>
                    <select
                      id="modal-day-of-week"
                      required
                      disabled={!modalDoctorId}
                      value={modalDayOfWeek}
                      onChange={(e) => {
                        setModalDayOfWeek(e.target.value);
                        setModalTime('');
                      }}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {!modalDoctorId ? (
                        <option value="">Selecione o médico...</option>
                      ) : (
                        <>
                          <option value="">Selecione o dia...</option>
                          {(doctors.find(d => d.id === modalDoctorId)?.attendanceDays || []).map(day => (
                            <option key={day} value={day}>{getDayLabel(day)}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  {/* Time selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                      Horário *
                    </label>
                    <select
                      id="modal-appointment-time"
                      required
                      disabled={!modalDoctorId || !modalDayOfWeek}
                      value={modalTime}
                      onChange={(e) => setModalTime(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {!modalDoctorId || !modalDayOfWeek ? (
                        <option value="">Selecione o dia...</option>
                      ) : (
                        <>
                          <option value="">Selecione o horário...</option>
                          {(() => {
                            const selectedDoc = doctors.find(d => d.id === modalDoctorId);
                            if (!selectedDoc) return null;
                            const slots = getDoctorTimeSlots(selectedDoc);
                            const computedDate = getNextDateForDayOfWeek(modalDayOfWeek);

                            return slots.map(slotTime => {
                              const isOccupied = appointments.some(appt => {
                                const sameDate = appt.date === computedDate;
                                const sameTime = appt.time === slotTime;
                                const notCanceled = appt.status !== 'canceled';
                                const sameDoc = appt.doctorId === selectedDoc.id ||
                                  (appt.doctorName && selectedDoc.name &&
                                   appt.doctorName.toLowerCase().includes(selectedDoc.name.split(' ')[1]?.toLowerCase() || selectedDoc.name.toLowerCase()));
                                return sameDate && sameTime && notCanceled && sameDoc;
                              });

                              return (
                                <option 
                                  key={slotTime} 
                                  value={slotTime} 
                                  disabled={isOccupied}
                                  className={isOccupied ? 'text-slate-350 line-through bg-slate-50' : 'text-slate-850 font-semibold'}
                                >
                                  {slotTime} {isOccupied ? '(Ocupado)' : '(Livre)'}
                                </option>
                              );
                            });
                          })()}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Computed Date Subtitle Info */}
                {modalDoctorId && modalDayOfWeek && (
                  <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center gap-2 text-[10.5px] text-[#1A6FA8] font-sans">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Consulta agendada para: <strong className="font-bold">{getDayLabel(modalDayOfWeek)} ({formatDateBR(getNextDateForDayOfWeek(modalDayOfWeek))})</strong>
                    </span>
                  </div>
                )}

                {/* Submit / Cancel Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 -mx-5 -mb-5 p-4">
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    id="modal-submit-schedule"
                    type="submit"
                    className="px-4 py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                  >
                    Confirmar Agendamento
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* 5. User Profile Editor Modal */}
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          userProfile={userProfile}
          onSave={(updated) => {
            setUserProfile(updated);
            addSystemLog('success', `Perfil de usuário atualizado: ${updated.name} (${updated.role}).`);
            // Salva nome da clínica no Firestore pra o bot ler
            const email = userProfile.email || localStorage.getItem('atendia_email') || '';
            if (email && updated.clinicName) {
              const key = email.toLowerCase().replace(/[@.]/g, '_');
              fetch('/api/fb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'saveBotConfig',
                  payload: {
                    docId: `clinic_settings_${key}/bot`,
                    config: { clinicName: updated.clinicName }
                  }
                }),
              }).catch(() => {});
            }
          }}
        />

      </div>

    </div>
  );
}
