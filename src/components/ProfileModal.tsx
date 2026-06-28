import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Briefcase, 
  Save, 
  Sparkles, 
  Check, 
  Building, 
  Stethoscope, 
  Upload, 
  Award, 
  FileText 
} from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

const PRESET_AVATARS = [
  {
    id: 'original',
    name: 'Dra. Patrícia (Padrão)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'doc-female-1',
    name: 'Médica (Opcional 1)',
    url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'doc-male-1',
    name: 'Médico (Opcional 2)',
    url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'doc-male-2',
    name: 'Médico (Opcional 3)',
    url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'admin-male-1',
    name: 'Administrador (Opcional 4)',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'admin-female-1',
    name: 'Recepcionista (Opcional 5)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150',
  },
];

export default function ProfileModal({ isOpen, onClose, userProfile, onSave }: ProfileModalProps) {
  // Account type tab state ('clinic' | 'individual')
  const [accountType, setAccountType] = useState<'clinic' | 'individual'>(userProfile.accountType || 'clinic');

  // Clinic fields
  const [clinicName, setClinicName] = useState(userProfile.clinicName || '');
  const [responsibleName, setResponsibleName] = useState(userProfile.name || '');
  const [responsibleRole, setResponsibleRole] = useState(userProfile.role || '');

  // Individual Doctor fields
  const [doctorName, setDoctorName] = useState(userProfile.doctorName || '');
  const [specialty, setSpecialty] = useState(userProfile.specialty || '');
  const [crm, setCrm] = useState(userProfile.crm || '');

  // Shared state
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl || '');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with prop on open
  useEffect(() => {
    if (isOpen) {
      setAccountType(userProfile.accountType || 'clinic');
      
      // Clinic states
      setClinicName(userProfile.clinicName || '');
      setResponsibleName(userProfile.name || '');
      setResponsibleRole(userProfile.role || '');

      // Doctor states
      setDoctorName(userProfile.doctorName || '');
      setSpecialty(userProfile.specialty || '');
      setCrm(userProfile.crm || '');

      setAvatarUrl(userProfile.avatarUrl || '');
      setError('');
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, envie apenas arquivos de imagem.');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setError('A imagem é muito grande. Escolha uma imagem de até 1.5MB para salvar no perfil.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setAvatarUrl(reader.result as string);
        setError('');
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!avatarUrl) {
      setError('Por favor, selecione ou envie uma foto de perfil.');
      return;
    }

    let payload: UserProfile;

    if (accountType === 'clinic') {
      if (!clinicName.trim()) {
        setError('Por favor, digite o nome da clínica.');
        return;
      }
      if (!responsibleName.trim()) {
        setError('Por favor, digite o nome do responsável.');
        return;
      }
      if (!responsibleRole.trim()) {
        setError('Por favor, digite o cargo do responsável.');
        return;
      }

      payload = {
        accountType: 'clinic',
        clinicName: clinicName.trim(),
        name: responsibleName.trim(),
        role: responsibleRole.trim(),
        avatarUrl: avatarUrl,
      };
    } else {
      if (!doctorName.trim()) {
        setError('Por favor, digite o nome do médico.');
        return;
      }
      if (!specialty.trim()) {
        setError('Por favor, digite a especialidade médica.');
        return;
      }
      if (!crm.trim()) {
        setError('Por favor, digite o CRM do médico.');
        return;
      }

      payload = {
        accountType: 'individual',
        doctorName: doctorName.trim(),
        name: doctorName.trim(), // fallback
        specialty: specialty.trim(),
        crm: crm.trim(),
        role: `${specialty.trim()} (CRM ${crm.trim()})`, // fallback
        avatarUrl: avatarUrl,
      };
    }

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay background */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal box */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 font-sans flex items-center gap-2">
            <User className="w-5 h-5 text-[#1A6FA8]" />
            Configurar Perfil de Usuário
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer focus:outline-hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Account Type Selector Tabs */}
        <div className="px-6 pt-5">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-2">
            Tipo de Cliente / Perfil
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/50">
            <button
              type="button"
              onClick={() => {
                setAccountType('clinic');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                accountType === 'clinic'
                  ? 'bg-white text-[#1A6FA8] shadow-xs'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              <Building className="w-4 h-4" />
              Clínica Médica
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType('individual');
                setError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                accountType === 'individual'
                  ? 'bg-white text-[#1A6FA8] shadow-xs'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Médico Individual
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-sans">
              {error}
            </div>
          )}

          {/* 2. Drag and Drop Profile Photo Upload Zone */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
              Foto de Perfil
            </label>
            
            <div className="flex flex-col sm:flex-row gap-5 items-center bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              {/* Avatar Live Preview */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden border-4 border-white shadow-md">
                  <img 
                    src={avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150';
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 bg-[#1A6FA8] text-white p-1 rounded-full text-[9px] font-bold shadow-xs">
                  <Sparkles className="w-3 h-3" />
                </span>
              </div>

              {/* Upload input and instructions */}
              <div className="flex-1 w-full space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                    isDragging 
                      ? 'border-[#1A6FA8] bg-blue-50/50' 
                      : 'border-slate-300 hover:border-[#1A6FA8] hover:bg-white bg-slate-100/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#1A6FA8] transition-colors" />
                  <span className="text-xs font-semibold text-slate-700 block font-sans">
                    Clique para fazer upload ou arraste a imagem
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    PNG, JPG, GIF até 1.5MB
                  </span>
                </div>
              </div>
            </div>

            {/* Presets alternative for quick setup */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                Ou selecione um avatar padrão:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_AVATARS.map((avatar) => {
                  const isSelected = avatarUrl === avatar.url;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setAvatarUrl(avatar.url)}
                      className={`w-9 h-9 rounded-full overflow-hidden border-2 relative focus:outline-hidden transition-all hover:scale-105 cursor-pointer ${
                        isSelected ? 'border-[#1A6FA8] ring-2 ring-blue-100 shadow-xs' : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={avatar.name}
                    >
                      <img 
                        src={avatar.url} 
                        alt={avatar.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Dynamic input fields according to selected account type */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            {accountType === 'clinic' ? (
              <>
                {/* Clinic Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Nome da Clínica *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Clínica Atendia de Pediatria"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Responsible Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Nome do Responsável / Administrador *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dra. Patrícia Lima"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Responsible Role */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Cargo ou Função *
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Diretora Clínica"
                      value={responsibleRole}
                      onChange={(e) => setResponsibleRole(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Doctor Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Nome do Médico *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dr. Ricardo Silveira"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Medical Specialty */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Especialidade Principal *
                  </label>
                  <div className="relative">
                    <Award className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Cardiologia"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* CRM */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                    Número do CRM e Estado *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: 12345/SP"
                      value={crm}
                      onChange={(e) => setCrm(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1A6FA8] focus:ring-1 focus:ring-[#1A6FA8] font-sans bg-white text-slate-800"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Actions footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 -mx-6 -mb-6 p-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors focus:outline-hidden"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1A6FA8] hover:bg-[#135480] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs focus:outline-hidden"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
