import { Doctor, Conversation, Appointment, SystemLogs } from './types';

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Cláudio Lemos',
    specialty: 'Cardiologia',
    crm: 'CRM-SP 124587',
    rating: 4.9,
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=120',
    schedules: ['Seg, Qua (08:00 - 13:00)'],
    consultationFee: 350,
    activePatientsCount: 45,
    isActive: true,
    attendanceDays: ['Seg', 'Qua'],
    startTime: '08:00',
    endTime: '13:00',
    procedures: 'Ecocardiograma, Eletrocardiograma, Teste Ergométrico, Holter 24h, Monitorização Ambulatorial da Pressão Arterial (MAPA).',
    insurancePlans: 'Bradesco Saúde, SulAmérica, Amil, Unimed, Porto Seguro.',
    exams: 'Ecocardiografia transtorácica, Teste de esforço físico, Poligrafia neonatal.',
    discounts: '10% de desconto para consultas particulares agendadas via WhatsApp às quartas-feiras.',
    schedulingPolicy: 'Cancelamento gratuito com até 24 horas de antecedência. Tolerância de atraso de 15 minutos.',
    preparationInstructions: 'Para o teste ergométrico, vir com roupas leves e tênis confortável. Não usar cremes no tórax nas 12h anteriores.',
    additionalNotes: 'Focar em acalmar pacientes hipertensos. Sempre indicar que exames complementares podem ser feitos no mesmo dia.',
    botName: 'Cláudio Bot',
    botTone: 'Cordial'
  },
  {
    id: 'doc-2',
    name: 'Dra. Juliana Torres',
    specialty: 'Pediatria',
    crm: 'CRM-SP 185942',
    rating: 4.8,
    avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=120',
    schedules: ['Ter, Sex (09:00 - 16:00)'],
    consultationFee: 300,
    activePatientsCount: 62,
    isActive: true,
    attendanceDays: ['Ter', 'Sex'],
    startTime: '09:00',
    endTime: '16:00',
    procedures: 'Puericultura, Avaliação de Desenvolvimento Infantil, Orientação Amamentação, Vacinação Infantil.',
    insurancePlans: 'Unimed, Amil, SulAmérica, Bradesco, Golden Cross.',
    exams: 'Avaliação de refluxo gastroesofágico pediátrico, Testes rápidos de infecção.',
    discounts: 'Campanha de vacinação de gripe: desconto de 15% na consulta de retorno.',
    schedulingPolicy: 'Prioridade para bebês menores de 6 meses com febre alta. Entrar em contato direto por telefone em emergências.',
    preparationInstructions: 'Trazer a carteira de vacinação atualizada da criança e a certidão de nascimento.',
    additionalNotes: 'Usar tom extremamente doce e acolhedor. Usar termos como "pequeno(a)", se referir à mãe/pai com total respeito.',
    botName: 'Julinha',
    botTone: 'Descontraído'
  },
  {
    id: 'doc-3',
    name: 'Dr. Roberto Alencar',
    specialty: 'Ortopedia',
    crm: 'CRM-SP 156321',
    rating: 4.7,
    avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=120',
    schedules: ['Qua, Qui (08:00 - 12:00)'],
    consultationFee: 320,
    activePatientsCount: 38,
    isActive: true,
    attendanceDays: ['Qua', 'Qui'],
    startTime: '08:00',
    endTime: '12:00',
    procedures: 'Infiltração articular, Imobilização com gesso e tala, Tratamento de fraturas e luxações.',
    insurancePlans: 'Particular, Porto Seguro, Amil, Allianz, Bradesco Saúde.',
    exams: 'Radiografia digital, Ultrassonografia musculoesquelética no local.',
    discounts: 'Nenhum desconto ativo no momento para ortopedia.',
    schedulingPolicy: 'Retornos de pós-operatório têm agendamento prioritário.',
    preparationInstructions: 'Vir com roupas de fácil remoção dependendo do membro a ser avaliado (ex: bermuda para joelho).',
    additionalNotes: 'Explicar de forma bem prática e objetiva as opções de reabilitação.',
    botName: 'Beto Bot',
    botTone: 'Formal'
  },
  {
    id: 'doc-4',
    name: 'Dra. Sandra Medeiros',
    specialty: 'Ginecologia',
    crm: 'CRM-SP 142369',
    rating: 4.95,
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=120',
    schedules: ['Seg, Qui (13:00 - 19:00)'],
    consultationFee: 380,
    activePatientsCount: 57,
    isActive: true,
    attendanceDays: ['Seg', 'Qui'],
    startTime: '13:00',
    endTime: '19:00',
    procedures: 'Colocação de DIU (Mirena, Kyleena, Cobre), Cauterização de lesões, Planejamento Familiar, Pré-natal.',
    insurancePlans: 'Bradesco Saúde, SulAmérica, Omint, Care Plus, Sompo.',
    exams: 'Papanicolau, Colposcopia, Ultrassonografia transvaginal e obstétrica.',
    discounts: 'Pacote pré-natal completo com condições especiais de parcelamento.',
    schedulingPolicy: 'Gestantes em reta final têm canal telefônico direto 24h. Tolerância máxima de 10 minutos.',
    preparationInstructions: 'Para o exame de Papanicolau, não ter relações sexuais nas 48h anteriores e não usar cremes vaginais.',
    additionalNotes: 'Excelente acolhimento e escuta ativa. Responder dúvidas com empatia máxima.',
    botName: 'Sofia',
    botTone: 'Cordial'
  },
  {
    id: 'doc-5',
    name: 'Dr. Marcos Aoki',
    specialty: 'Clínica Geral',
    crm: 'CRM-SP 98745',
    rating: 4.6,
    avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=120',
    schedules: ['Ter, Sex (13:00 - 18:00)'],
    consultationFee: 250,
    activePatientsCount: 74,
    isActive: true,
    attendanceDays: ['Ter', 'Sex'],
    startTime: '13:00',
    endTime: '18:00',
    procedures: 'Check-up Geral, Avaliação Pré-operatória, Tratamento de doenças crônicas (Hipertensão, Diabetes).',
    insurancePlans: 'Todos os principais convênios e planos de saúde.',
    exams: 'Exames laboratoriais básicos (coleta no local), Check-up básico de sangue.',
    discounts: 'Desconto de 10% para idosos acima de 65 anos em consultas particulares.',
    schedulingPolicy: 'Encaixes no mesmo dia dependem de triagem de sintomas de urgência realizada pelo bot.',
    preparationInstructions: 'Para coleta de sangue de check-up geral, jejum de 8 a 12 horas.',
    additionalNotes: 'O bot deve fazer perguntas sobre sintomas principais (febre, dor, tosse) antes de finalizar a agenda.',
    botName: 'Marcos Bot',
    botTone: 'Cordial'
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    patientName: 'Mariana Silva Santos',
    patientPhone: '+55 (11) 98214-5544',
    status: 'human_needed',
    lastMessage: 'Gostaria de falar com um atendente humano para remarcar, por favor.',
    lastMessageTime: '19:35',
    unreadCount: 2,
    avatarColor: 'bg-emerald-500',
    category: 'Remarcação',
    assignedDoctorId: 'doc-2',
    messages: [
      { id: '1', sender: 'patient', text: 'Olá, gostaria de agendar uma consulta para meu filho com a Dra. Juliana.', timestamp: '19:28' },
      { id: '2', sender: 'bot', text: 'Olá! Sou o assistente virtual da BotClínica. Posso ajudar com isso. Dra. Juliana Torres (Pediatra) tem horários disponíveis nesta Terça-feira às 10:00 e 11:30. Algum destes atende você?', timestamp: '19:29' },
      { id: '3', sender: 'patient', text: 'Amanhã não consigo por causa do trabalho. Vocês têm vaga na sexta de manhã?', timestamp: '19:31' },
      { id: '4', sender: 'bot', text: 'Na sexta-feira, ela atende das 08:00 às 12:00. O horário das 09:15 está livre. Deseja confirmar para Sexta às 09:15?', timestamp: '19:32' },
      { id: '5', sender: 'patient', text: 'Sim, por favor!', timestamp: '19:33' },
      { id: '6', sender: 'bot', text: 'Perfeito. Para finalizar, poderia me confirmar se a consulta é particular ou por convênio?', timestamp: '19:34' },
      { id: '7', sender: 'patient', text: 'Gostaria de falar com um atendente humano para remarcar, por favor.', timestamp: '19:35' }
    ]
  },
  {
    id: 'conv-2',
    patientName: 'Carlos Eduardo Souza',
    patientPhone: '+55 (11) 97103-2288',
    status: 'bot',
    lastMessage: 'Confirmado para o Dr. Cláudio na quarta-feira.',
    lastMessageTime: '19:12',
    unreadCount: 0,
    avatarColor: 'bg-blue-500',
    category: 'Agendamento',
    assignedDoctorId: 'doc-1',
    messages: [
      { id: '1', sender: 'patient', text: 'Boa noite, preciso de consulta com cardiologista.', timestamp: '19:05' },
      { id: '2', sender: 'bot', text: 'Boa noite! Temos o Dr. Cláudio Lemos, especialista em Cardiologia. Ele atende na próxima Quarta-feira (01/07) no período da tarde. Tenho horários às 14:30 e às 16:00. Qual prefere?', timestamp: '19:07' },
      { id: '3', sender: 'patient', text: 'O das 16:00 é ótimo.', timestamp: '19:09' },
      { id: '4', sender: 'bot', text: 'Reservado! Para confirmar o agendamento de Carlos Eduardo Souza para o dia 01/07 às 16:00 com o Dr. Cláudio Lemos, por favor responda com SIM.', timestamp: '19:10' },
      { id: '5', sender: 'patient', text: 'SIM', timestamp: '19:12' },
      { id: '6', sender: 'bot', text: 'Confirmado para o Dr. Cláudio na quarta-feira. Geramos sua pré-ficha! O endereço é Av. Paulista, 1000 - Cj 52. Em breve você receberá as instruções de preparo.', timestamp: '19:12' }
    ]
  },
  {
    id: 'conv-3',
    patientName: 'Beatriz Vasconcelos',
    patientPhone: '+55 (21) 99823-1133',
    status: 'resolved',
    lastMessage: 'Obrigada pelas informações sobre o preparo do exame!',
    lastMessageTime: '18:40',
    unreadCount: 0,
    avatarColor: 'bg-indigo-500',
    category: 'Dúvida',
    messages: [
      { id: '1', sender: 'patient', text: 'Preciso de jejum para o exame de sangue que o Dr. Marcos passou?', timestamp: '18:30' },
      { id: '2', sender: 'bot', text: 'Olá Beatriz! Para o Hemograma Completo solicitado pelo Dr. Marcos Aoki, o jejum recomendado é de apenas 3 horas. Para exames de perfil lipídico completo, recomenda-se 12 horas. Evite bebidas alcoólicas nas 72h anteriores.', timestamp: '18:35' },
      { id: '3', sender: 'patient', text: 'Obrigada pelas informações sobre o preparo do exame!', timestamp: '18:40' }
    ]
  },
  {
    id: 'conv-4',
    patientName: 'Ricardo Mendes Camargo',
    patientPhone: '+55 (11) 98555-1234',
    status: 'human_active',
    lastMessage: 'Estou enviando a foto do encaminhamento médico.',
    lastMessageTime: '19:20',
    unreadCount: 0,
    avatarColor: 'bg-orange-500',
    category: 'Exames',
    assignedDoctorId: 'doc-3',
    messages: [
      { id: '1', sender: 'patient', text: 'Quero agendar retorno com o Dr. Roberto.', timestamp: '19:01' },
      { id: '2', sender: 'bot', text: 'Olá Ricardo! Dr. Roberto Alencar (Ortopedia) tem disponibilidade nesta Quinta-feira às 15:30. Para retornos dentro de 30 dias, precisamos validar o seu encaminhamento.', timestamp: '19:03' },
      { id: '3', sender: 'patient', text: 'Eu tenho a guia de retorno aqui, como faço?', timestamp: '19:10' },
      { id: '4', sender: 'human', text: 'Olá Ricardo, sou a Patrícia da recepção. Pode tirar uma foto nítida da sua guia de retorno e enviar por aqui que eu faço a liberação no sistema para você!', timestamp: '19:15' },
      { id: '5', sender: 'patient', text: 'Estou enviando a foto do encaminhamento médico.', timestamp: '19:20' }
    ]
  },
  {
    id: 'conv-5',
    patientName: 'Amanda Ferreira Lima',
    patientPhone: '+55 (11) 96321-4567',
    status: 'bot',
    lastMessage: 'Entendido. Gostaria de agendar para Dra. Sandra?',
    lastMessageTime: '17:15',
    unreadCount: 0,
    avatarColor: 'bg-pink-500',
    category: 'Agendamento',
    assignedDoctorId: 'doc-4',
    messages: [
      { id: '1', sender: 'patient', text: 'Olá, a Dra Sandra atende convênio Bradesco Saúde?', timestamp: '17:10' },
      { id: '2', sender: 'bot', text: 'Olá Amanda! Sim, a Dra. Sandra Medeiros (Ginecologia e Obstetrícia) atende o plano Bradesco Saúde (categorias Nacional e Premium).', timestamp: '17:12' },
      { id: '3', sender: 'patient', text: 'Ah, ótimo! Queria ver os dias dela.', timestamp: '17:14' },
      { id: '4', sender: 'bot', text: 'Ela atende às Segundas-feiras à tarde (13:00 - 19:00) e Quintas-feiras de manhã (08:00 - 14:00). Gostaria de agendar para Dra. Sandra?', timestamp: '17:15' }
    ]
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    patientName: 'Carlos Eduardo Souza',
    patientPhone: '+55 (11) 97103-2288',
    doctorId: 'doc-1',
    doctorName: 'Dr. Cláudio Lemos',
    specialty: 'Cardiologia',
    date: '2026-07-01', // Next Wednesday
    time: '16:00',
    status: 'confirmed',
    reminderSent: true,
    reminderStatus: 'confirmed_by_patient'
  },
  {
    id: 'appt-2',
    patientName: 'Ana Clara Albuquerque',
    patientPhone: '+55 (11) 99122-3344',
    doctorId: 'doc-2',
    doctorName: 'Dra. Juliana Torres',
    specialty: 'Pediatria',
    date: '2026-06-30', // Tuesday
    time: '10:00',
    status: 'confirmed',
    reminderSent: true,
    reminderStatus: 'read'
  },
  {
    id: 'appt-3',
    patientName: 'Luiz Fernando Ramos',
    patientPhone: '+55 (11) 98111-2233',
    doctorId: 'doc-3',
    doctorName: 'Dr. Roberto Alencar',
    specialty: 'Ortopedia',
    date: '2026-07-01',
    time: '09:30',
    status: 'pending',
    reminderSent: true,
    reminderStatus: 'sent'
  },
  {
    id: 'appt-4',
    patientName: 'Letícia Nogueira Cruz',
    patientPhone: '+55 (11) 98888-7766',
    doctorId: 'doc-4',
    doctorName: 'Dra. Sandra Medeiros',
    specialty: 'Ginecologia',
    date: '2026-06-29', // Monday
    time: '14:00',
    status: 'confirmed',
    reminderSent: true,
    reminderStatus: 'confirmed_by_patient'
  },
  {
    id: 'appt-5',
    patientName: 'Marcos Paulo Diniz',
    patientPhone: '+55 (11) 97555-4433',
    doctorId: 'doc-5',
    doctorName: 'Dr. Marcos Aoki',
    specialty: 'Clínica Médica',
    date: '2026-06-30',
    time: '15:00',
    status: 'canceled',
    reminderSent: true,
    reminderStatus: 'canceled_by_patient'
  }
];

export const INITIAL_SYSTEM_LOGS: SystemLogs[] = [
  {
    id: 'log-1',
    type: 'success',
    message: 'WhatsApp Webhook conectado com sucesso ao número oficial +55 11 98765-4321.',
    timestamp: '19:40'
  },
  {
    id: 'log-2',
    type: 'info',
    message: 'Lembrete automático enviado para Mariana Silva Santos (+55 11 98214-5544).',
    timestamp: '19:30'
  },
  {
    id: 'log-3',
    type: 'warning',
    message: 'Paciente Ricardo Mendes solicitou intervenção humana. Redirecionando para recepção.',
    timestamp: '19:15'
  },
  {
    id: 'log-4',
    type: 'info',
    message: 'Agendamento de Carlos Eduardo Souza confirmado automaticamente pelo chatbot.',
    timestamp: '19:12'
  },
  {
    id: 'log-5',
    type: 'success',
    message: 'Base de dados de convênios atualizada (8 operadoras ativas).',
    timestamp: '18:00'
  }
];

export const INITIAL_BOT_SETTINGS = {
  clinicName: 'Clínica BotClínica Viva+',
  phone: '+55 (11) 98765-4321',
  welcomeMessage: 'Olá! Seja muito bem-vindo à Clínica BotClínica Viva+ 🏥. Eu sou a AtendIA, sua assistente virtual de agendamentos. Como posso te ajudar hoje?',
  allowDirectDoctorScheduling: true,
  enableAutoReminders: true,
  daysBeforeAppointmentForReminder: 1,
  aiTone: 'Acolhedor, prestativo e profissional',
  rulesList: [
    { trigger: 'consulta / agendamento', action: 'Buscar médicos e horários livres' },
    { trigger: 'convênio / plano', action: 'Listar operadoras de saúde credenciadas' },
    { trigger: 'preparo / jejum', action: 'Consultar tabela de exames laboratoriais' },
    { trigger: 'local / endereço', action: 'Enviar link do Google Maps e estacionamento' }
  ]
};
