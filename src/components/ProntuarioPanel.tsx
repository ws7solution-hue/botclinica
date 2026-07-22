import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  FileText, 
  Plus, 
  Calendar, 
  Stethoscope, 
  Heart, 
  PlusCircle, 
  History,
  CheckCircle,
  Clock,
  Sparkles,
  Paperclip,
  Activity,
  Save,
  PenTool,
  AlertCircle
} from 'lucide-react';
import { Conversation, Doctor, AtendiaPlan, PatientProfile, ProntuarioEntry } from '../types';
import LockOverlay from './LockOverlay';
import { 
  fbListProntuario, 
  fbSaveProntuarioEntry, 
  fbGetPatientProfile, 
  fbSavePatientProfile 
} from '../firebase';

interface ProntuarioPanelProps {
  clinicId: string;
  conversations: Conversation[];
  doctors: Doctor[];
  currentPlan: AtendiaPlan;
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  setActiveTab?: (tab: any) => void;
}

export default function ProntuarioPanel({ 
  clinicId,
  conversations, 
  doctors, 
  currentPlan,
  onAddSystemLog,
  setActiveTab
}: ProntuarioPanelProps) {
  
  // Extract unique patients from conversations
  const patientsList = conversations.map(c => ({
    name: c.patientName,
    // BUGFIX (22/07): algumas conversas chegam com patientPhone vazio (bug
    // no N8N que ainda não preenche esse campo em certos casos). Usamos o
    // "id" da conversa como alternativa, já que ele é o telefone de verdade
    // (é o mesmo valor usado como ID do documento no Firestore).
    phone: c.patientPhone || c.id,
    avatarColor: c.avatarColor || 'bg-slate-500'
  }));

  // Create a unique list of patients by filtering duplicates based on phone
  const uniquePatients = patientsList.filter((v, i, a) => a.findIndex(t => t.phone === v.phone) === i);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientPhone, setSelectedPatientPhone] = useState<string>(
    uniquePatients.length > 0 ? uniquePatients[0].phone : ''
  );

  // Normalization for Firestore keys
  const getNormalizedPatientId = (phone: string) => {
    return phone.replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  };

  const activePatient = uniquePatients.find(p => p.phone === selectedPatientPhone) || uniquePatients[0];
  const patientId = activePatient ? getNormalizedPatientId(activePatient.phone) : '';

  // Real Database state
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [entries, setEntries] = useState<ProntuarioEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states for new evolution record (immutable)
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [formDoctorId, setFormDoctorId] = useState('');
  const [formComplaint, setFormComplaint] = useState('');
  const [formConduct, setFormConduct] = useState('');
  const [formPrescription, setFormPrescription] = useState('');
  const [formAttachments, setFormAttachments] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Form states for profile/history editing (mutable)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editComorbidities, setEditComorbidities] = useState('');
  const [editContinuousMeds, setEditContinuousMeds] = useState('');
  const [editPrevSurgeries, setEditPrevSurgeries] = useState('');

  // Synchronize component state with profile data whenever profile loads/changes
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditBirthDate(profile.birthDate || '');
      setEditGender(profile.gender || '');
      setEditAddress(profile.address || '');
      setEditAllergies(profile.allergies || '');
      setEditComorbidities(profile.comorbidities || '');
      setEditContinuousMeds(profile.continuousMeds || '');
      setEditPrevSurgeries(profile.prevSurgeries || '');
    }
  }, [profile]);

  // Fetch Patient Profile and Prontuário history when patient/clinic changes
  useEffect(() => {
    if (!patientId || !clinicId) return;

    let isMounted = true;
    setLoading(true);

    const loadPatientData = async () => {
      try {
        const patientProf = await fbGetPatientProfile(clinicId, patientId);
        const prontuarioEntries = await fbListProntuario(clinicId, patientId);

        if (isMounted) {
          if (patientProf) {
            setProfile(patientProf);
          } else {
            // Setup default profile if none exists in Firestore yet
            setProfile({
              name: activePatient.name,
              phone: activePatient.phone,
              birthDate: '',
              gender: '',
              address: '',
              allergies: 'Nenhuma conhecida',
              comorbidities: '',
              continuousMeds: '',
              prevSurgeries: ''
            });
          }
          setEntries(prontuarioEntries || []);
        }
      } catch (err: any) {
        console.error("Error fetching patient medical details:", err);
        // Fallback gracefully on network error or initial setup
        if (isMounted) {
          setProfile({
            name: activePatient.name,
            phone: activePatient.phone,
            birthDate: '',
            gender: '',
            address: '',
            allergies: 'Nenhuma conhecida',
            comorbidities: '',
            continuousMeds: '',
            prevSurgeries: ''
          });
          setEntries([]);
        }
        onAddSystemLog('error', 'Erro ao obter dados clínicos do Firestore. Carregando dados locais de segurança.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPatientData();

    return () => {
      isMounted = false;
    };
  }, [patientId, clinicId, selectedPatientPhone]);

  const filteredPatients = uniquePatients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm)
  );

  // Save changes to general Patient Profile & Clinical History
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !patientId || !clinicId) return;

    setSavingProfile(true);
    const updatedProfile: PatientProfile = {
      name: editName.trim() || activePatient.name,
      phone: activePatient.phone,
      birthDate: editBirthDate.trim(),
      gender: editGender,
      address: editAddress.trim(),
      allergies: editAllergies.trim(),
      comorbidities: editComorbidities.trim(),
      continuousMeds: editContinuousMeds.trim(),
      prevSurgeries: editPrevSurgeries.trim()
    };

    try {
      await fbSavePatientProfile(clinicId, patientId, updatedProfile);
      setProfile(updatedProfile);
      setIsEditingProfile(false);
      onAddSystemLog('success', `Ficha cadastral e histórico de ${updatedProfile.name} atualizados no Firestore.`);
    } catch (err: any) {
      console.error("Error saving patient profile:", err);
      onAddSystemLog('error', `Falha ao salvar ficha de cadastro: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // Add a new evolution entry (immutable)
  const handleAddEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !patientId || !clinicId || !formDoctorId || !formComplaint.trim() || !formConduct.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    const doctor = doctors.find(d => d.id === formDoctorId);
    if (!doctor) return;

    setSavingEntry(true);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    
    const newEntry: Omit<ProntuarioEntry, 'id' | 'patientId' | 'timestamp'> = {
      date: todayStr,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      complaint: formComplaint.trim(),
      conduct: formConduct.trim(),
      prescription: formPrescription.trim() || undefined,
      attachments: formAttachments.trim() || undefined
    };

    try {
      const saved = await fbSaveProntuarioEntry(clinicId, patientId, newEntry);
      
      // Update local timeline state (newest first)
      setEntries(prev => [saved, ...prev]);
      
      onAddSystemLog('success', `Evolução clínica registrada para ${activePatient.name} por ${doctor.name}.`);
      
      // Reset form fields
      setIsAddingRecord(false);
      setFormDoctorId('');
      setFormComplaint('');
      setFormConduct('');
      setFormPrescription('');
      setFormAttachments('');
    } catch (err: any) {
      console.error("Error creating prontuario entry:", err);
      onAddSystemLog('error', `Falha ao salvar nova evolução: ${err.message}`);
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 relative min-h-[calc(100vh-60px)]">
      {/* Premium Lock protection overlay */}
      {currentPlan !== 'premium' && (
        <LockOverlay requiredPlan="premium" featureName="Prontuário Eletrônico" onUpgradeClick={setActiveTab ? () => setActiveTab('settings') : undefined} />
      )}

      {/* Main header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50/10 text-blue-500 rounded-lg">
              <FileText className="w-5 h-5 text-[#1A6FA8]" />
            </span>
            <h2 className="text-lg font-black text-slate-800 font-sans tracking-tight">
              Prontuário Eletrônico Online
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Gestão integrada da ficha demográfica e linha do tempo de evolução clínica do paciente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold border border-emerald-100 flex items-center gap-1.5 font-sans">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            Em conformidade com a LGPD
          </span>
        </div>
      </div>

      {uniquePatients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3">
          <User className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-sm font-bold font-sans">Nenhum paciente cadastrado</h3>
          <p className="text-xs font-sans max-w-sm mx-auto">
            Todos os pacientes de conversas ativas ou agendamentos são exibidos aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Patient list side column (1/3) */}
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[75vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
                Buscar Paciente
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nome ou WhatsApp..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8]"
                />
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 max-h-[60vh]">
              {filteredPatients.map((patient) => {
                const isSelected = patient.phone === selectedPatientPhone;
                return (
                  <button
                    key={patient.phone}
                    onClick={() => {
                      setSelectedPatientPhone(patient.phone);
                      setIsAddingRecord(false);
                      setIsEditingProfile(false);
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex items-center gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/50 border-r-4 border-[#1A6FA8]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${patient.avatarColor}`}>
                      {patient.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate font-sans">
                        {patient.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {patient.phone}
                      </p>
                    </div>
                  </button>
                );
              })}
              {filteredPatients.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum paciente localizado.
                </div>
              )}
            </div>
          </div>

          {/* Patient details & timeline column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-4 border-[#1A6FA8] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-sans">Carregando prontuário eletrônico do paciente...</p>
              </div>
            ) : (
              activePatient && profile && (
                <>
                  {/* General Profile & Clinical History Card */}
                  <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1A6FA8] to-[#12537E] flex items-center justify-center text-white font-bold text-base">
                          {profile.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 font-sans">
                            {profile.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            {profile.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsEditingProfile(!isEditingProfile);
                            setIsAddingRecord(false);
                          }}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isEditingProfile ? 'Cancelar Edição' : 'Editar Ficha'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsAddingRecord(!isAddingRecord);
                            setIsEditingProfile(false);
                          }}
                          className="px-3 py-1.5 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Nova Evolução
                        </button>
                      </div>
                    </div>

                    {isEditingProfile ? (
                      /* Active Profile Form */
                      <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                        <h4 className="text-xs font-bold text-[#1A6FA8] uppercase tracking-wider font-sans mb-3 flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          Atualizar Ficha Cadastral e Histórico
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Nome Completo</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] bg-white text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Nascimento</label>
                            <input
                              type="date"
                              value={editBirthDate}
                              onChange={(e) => setEditBirthDate(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] bg-white text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Sexo</label>
                            <select
                              value={editGender}
                              onChange={(e) => setEditGender(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] bg-white text-slate-800"
                            >
                              <option value="">Selecione...</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Outro">Outro / Prefer não informar</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Endereço Residencial</label>
                          <input
                            type="text"
                            placeholder="Rua, número, complemento, bairro, cidade - UF"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] bg-white text-slate-800"
                          />
                        </div>

                        <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1 font-sans">Alergias Clínicas / Medicamentosas</label>
                            <textarea
                              rows={2}
                              placeholder="Ex: Alergia a Dipirona e Ibuprofeno"
                              value={editAllergies}
                              onChange={(e) => setEditAllergies(e.target.value)}
                              className="w-full text-xs p-2 border border-rose-200 focus:border-rose-500 rounded-lg focus:outline-hidden bg-white text-slate-850"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Comorbidades / Condições de Base</label>
                            <textarea
                              rows={2}
                              placeholder="Ex: Hipertensão Arterial Sistêmica, Diabetes Tipo II"
                              value={editComorbidities}
                              onChange={(e) => setEditComorbidities(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden bg-white text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Medicações em Uso Contínuo</label>
                            <textarea
                              rows={2}
                              placeholder="Ex: Losartana 50mg, Metformina 850mg"
                              value={editContinuousMeds}
                              onChange={(e) => setEditContinuousMeds(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden bg-white text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Cirurgias Prévias / Internações</label>
                            <textarea
                              rows={2}
                              placeholder="Ex: Apendicectomia em 2018"
                              value={editPrevSurgeries}
                              onChange={(e) => setEditPrevSurgeries(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden bg-white text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:bg-slate-300"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{savingProfile ? 'Salvando...' : 'Salvar Dados'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Display Profile details */
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1 space-y-3 pr-4 sm:border-r border-slate-150">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">Data de Nascimento</span>
                            <span className="text-xs font-bold text-slate-700 block mt-0.5">
                              {profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('pt-BR') : 'Não informada'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">Sexo / Gênero</span>
                            <span className="text-xs font-bold text-slate-700 block mt-0.5">{profile.gender || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">Endereço</span>
                            <span className="text-xs font-bold text-slate-700 block mt-0.5 truncate" title={profile.address}>
                              {profile.address || 'Não cadastrado'}
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-2.5 bg-rose-50/20 border border-rose-100/60 rounded-lg">
                            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wide block flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Alergias
                            </span>
                            <span className="text-xs font-semibold text-rose-900 block mt-1">
                              {profile.allergies || 'Nenhuma informada'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Condições / Comorbidades</span>
                            <span className="text-xs font-semibold text-slate-700 block mt-1">
                              {profile.comorbidities || 'Sem histórico ativo'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Medicações de Uso Contínuo</span>
                            <span className="text-xs font-semibold text-slate-700 block mt-1">
                              {profile.continuousMeds || 'Nenhuma medicação listada'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Cirurgias e Internações Prévias</span>
                            <span className="text-xs font-semibold text-slate-700 block mt-1">
                              {profile.prevSurgeries || 'Nenhum registro prévio'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* New Evolution Record Form */}
                  {isAddingRecord && (
                    <form 
                      onSubmit={handleAddEntrySubmit}
                      className="bg-slate-50 border border-blue-100 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-200"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-bold text-[#1A6FA8] uppercase font-sans tracking-wide flex items-center gap-1.5">
                          <PlusCircle className="w-4 h-4" />
                          Adicionar Entrada ao Prontuário Médico
                        </h4>
                        <button 
                          type="button"
                          onClick={() => setIsAddingRecord(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-hidden"
                        >
                          Descartar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-sans">
                            Médico Especialista Responsável *
                          </label>
                          <select
                            required
                            value={formDoctorId}
                            onChange={(e) => setFormDoctorId(e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8]"
                          >
                            <option value="">Selecione o médico...</option>
                            {doctors.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-sans">
                          Queixa Principal / Motivo da Consulta *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Cefaleia holocraniana de forte intensidade há 3 dias, associada a náuseas."
                          value={formComplaint}
                          onChange={(e) => setFormComplaint(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-sans">
                          Conduta Clínica / Avaliação & Observações *
                        </label>
                        <textarea
                          required
                          rows={4}
                          placeholder="Exame físico detalhado, hipótese diagnóstica, conduta terapêutica estabelecida..."
                          value={formConduct}
                          onChange={(e) => setFormConduct(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-sans">
                            Prescrição Médica (Opcional)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Ex: Paracetamol 750mg de 6/6 horas em caso de dor intensa por até 5 dias."
                            value={formPrescription}
                            onChange={(e) => setFormPrescription(e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-sans">
                            Anexos de Exames / Documentos (Opcional)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Link ou notas sobre exames (Ex: https://botclinica.com.br/laudos/exame-123.pdf)"
                            value={formAttachments}
                            onChange={(e) => setFormAttachments(e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] font-sans text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingRecord(false)}
                          className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          Descartar
                        </button>
                        <button
                          type="submit"
                          disabled={savingEntry}
                          className="px-4 py-1.5 bg-[#1A6FA8] hover:bg-[#135480] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs disabled:bg-slate-300"
                        >
                          {savingEntry ? 'Registrando...' : 'Registrar Evolução'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Clinical Evolution History/Timeline */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-400" />
                      Histórico de Atendimento e Evoluções ({entries.length})
                    </h4>

                    {entries.length > 0 ? (
                      <div className="relative pl-6 border-l border-slate-200 space-y-6">
                        {entries.map((record) => (
                          <div key={record.id} className="relative group">
                            {/* Timestamp icon indicator */}
                            <div className="absolute -left-[31px] top-1 w-4.5 h-4.5 bg-white border-2 border-[#1A6FA8] rounded-full flex items-center justify-center shadow-xs">
                              <Clock className="w-2.5 h-2.5 text-[#1A6FA8]" />
                            </div>

                            {/* Record timeline card */}
                            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-[#1A6FA8]/40 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <Stethoscope className="w-4 h-4 text-[#1A6FA8]/80" />
                                  <span className="text-xs font-bold text-slate-800 font-sans">
                                    {record.doctorName}
                                  </span>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-sans font-medium">
                                    {record.specialty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{record.date}</span>
                                </div>
                              </div>

                              <div className="pt-3 space-y-3.5 text-xs text-slate-600 font-sans leading-relaxed">
                                <div>
                                  <strong className="text-slate-800 block text-[9px] uppercase font-mono mb-1 text-slate-400">
                                    Queixa / Motivo da Consulta:
                                  </strong>
                                  <p className="text-slate-700 bg-slate-50/50 p-2 rounded-lg border border-slate-100 italic">
                                    "{record.complaint}"
                                  </p>
                                </div>

                                <div>
                                  <strong className="text-slate-800 block text-[9px] uppercase font-mono mb-1 text-slate-400">
                                    Conduta Clínica & Avaliação:
                                  </strong>
                                  <p className="text-slate-700 whitespace-pre-line">{record.conduct}</p>
                                </div>

                                {(record.prescription || record.attachments) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-3 border-t border-slate-50">
                                    {record.prescription && (
                                      <div className="p-2.5 bg-blue-50/30 border border-blue-100/40 rounded-lg">
                                        <strong className="text-blue-800 block text-[9px] uppercase font-mono mb-1 flex items-center gap-1">
                                          💊 Receita / Posologia:
                                        </strong>
                                        <p className="text-[11px] text-slate-700 whitespace-pre-line font-serif italic">
                                          {record.prescription}
                                        </p>
                                      </div>
                                    )}
                                    {record.attachments && (
                                      <div className="p-2.5 bg-emerald-50/20 border border-emerald-100/40 rounded-lg">
                                        <strong className="text-emerald-800 block text-[9px] uppercase font-mono mb-1 flex items-center gap-1">
                                          <Paperclip className="w-3.5 h-3.5" /> Anexos / Exames:
                                        </strong>
                                        {record.attachments.startsWith('http') ? (
                                          <a 
                                            href={record.attachments} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-[11px] text-[#1A6FA8] font-bold hover:underline break-all block"
                                          >
                                            Visualizar Documento Anexo
                                          </a>
                                        ) : (
                                          <p className="text-[11px] text-slate-700 whitespace-pre-line">
                                            {record.attachments}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-400 space-y-2">
                        <FileText className="w-8 h-8 mx-auto text-slate-300 animate-pulse" />
                        <p className="text-xs font-sans">Nenhuma evolução clínica cadastrada para este paciente.</p>
                        <button 
                          type="button" 
                          onClick={() => setIsAddingRecord(true)}
                          className="text-xs font-bold text-[#1A6FA8] hover:underline"
                        >
                          Criar primeira evolução do prontuário
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>

        </div>
      )}
    </div>
  );
}
