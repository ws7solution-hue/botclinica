import React, { useState, useEffect } from 'react';
import {
  Search, FileText, Upload, Loader2, AlertTriangle, Download, FlaskConical,
  ClipboardList, Pill, ShieldCheck, ArrowRightLeft, File, Wallet, FileStack, Users,
  Pencil, Trash2, Check, X
} from 'lucide-react';
import { Conversation, DocumentType, DocumentCategory, ClinicDocument } from '../types';
import { fbListClinicDocuments, fbRenameClinicDocument, fbDeleteClinicDocument } from '../firebase';
import AddonLockOverlay from './AddonLockOverlay';

interface DocumentsPanelProps {
  clinicId: string;
  conversations: Conversation[];
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  documentsAddonActive: boolean;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  exame: 'Exame / Resultado laboratorial',
  atestado: 'Atestado médico',
  receita: 'Receita médica',
  convenio: 'Documento de convênio (do paciente)',
  encaminhamento: 'Encaminhamento',
  outro: 'Outro',
};

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  exame: FlaskConical,
  atestado: ClipboardList,
  receita: Pill,
  convenio: ShieldCheck,
  encaminhamento: ArrowRightLeft,
  conta: Wallet,
  convenio_clinica: ShieldCheck,
  geral: FileStack,
  outro: File,
};

const CATEGORY_TABS: { id: DocumentCategory; label: string; icon: React.ElementType }[] = [
  { id: 'geral', label: 'Documentos Gerais', icon: FileStack },
  { id: 'contas', label: 'Contas', icon: Wallet },
  { id: 'convenios', label: 'Convênios', icon: ShieldCheck },
  { id: 'pacientes', label: 'Pacientes', icon: Users },
];

// Mesma normalização usada no Prontuário/Portal do Médico (remove o "9"
// extra do celular pra DDDs fora de SP/RJ/ES).
const normalizePatientId = (phone: string) => {
  let digits = (phone || '').replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const match = digits.match(/^55(\d{2})9(\d{8})$/);
  if (match) digits = `55${match[1]}${match[2]}`;
  return digits;
};

export default function DocumentsPanel({ clinicId, conversations, onAddSystemLog, documentsAddonActive }: DocumentsPanelProps) {
  const [category, setCategory] = useState<DocumentCategory>('geral');
  const [docType, setDocType] = useState<DocumentType>('exame');
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<ClinicDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  const patientsList = conversations.map(c => ({ name: c.patientName, phone: c.patientPhone || c.id }));
  const uniquePatients = patientsList.filter((v, i, a) => a.findIndex(t => t.phone === v.phone) === i);
  const [selectedPatientPhone, setSelectedPatientPhone] = useState<string>(
    uniquePatients.length > 0 ? uniquePatients[0].phone : ''
  );
  const activePatient = uniquePatients.find(p => p.phone === selectedPatientPhone) || uniquePatients[0];
  const activePatientId = activePatient ? normalizePatientId(activePatient.phone) : '';
  const filteredPatients = uniquePatients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm)
  );

  const filteredDocuments = documents.filter(doc => {
    if (!docSearchTerm.trim()) return true;
    const term = docSearchTerm.toLowerCase();
    return (
      (doc.filename || '').toLowerCase().includes(term) ||
      (doc.summary || '').toLowerCase().includes(term) ||
      (doc.patientName || '').toLowerCase().includes(term)
    );
  });

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const docs = category === 'pacientes'
        ? await fbListClinicDocuments(clinicId, activePatientId, category)
        : await fbListClinicDocuments(clinicId, undefined, category);
      setDocuments(docs);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (!documentsAddonActive) return;
    setDocSearchTerm('');
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, activePatientId, clinicId, documentsAddonActive]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (category === 'pacientes' && !activePatient) {
      onAddSystemLog('warning', 'Selecione um paciente antes de enviar o documento.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      onAddSystemLog('warning', 'Formato não suportado. Use imagem (JPG/PNG) ou PDF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onAddSystemLog('warning', 'Arquivo muito grande (máximo 8MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const fileBase64 = dataUrl.split(',')[1];
      setUploading(true);
      try {
        const r = await fetch('https://whatsapp.botclinica.com.br/analyze-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicId,
            category,
            patientId: category === 'pacientes' ? activePatientId : undefined,
            patientName: category === 'pacientes' ? activePatient?.name : undefined,
            docType: category === 'pacientes' ? docType : undefined,
            fileBase64,
            mimeType: file.type,
            filename: file.name,
          }),
        });
        const data = await r.json();
        if (data.error) {
          onAddSystemLog('error', `Falha ao analisar documento: ${data.error}`);
        } else {
          onAddSystemLog(
            'success',
            data.financeEntryCreated
              ? 'Documento analisado e salvo! Uma despesa foi lançada automaticamente no Financeiro.'
              : 'Documento analisado e salvo com sucesso.'
          );
          await loadDocuments();
        }
      } catch (err) {
        onAddSystemLog('error', 'Falha de conexão ao enviar o documento.');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const startEditingFilename = (doc: ClinicDocument) => {
    setEditingDocId(doc.docId);
    setEditingFilename(doc.filename || '');
  };

  const cancelEditingFilename = () => {
    setEditingDocId(null);
    setEditingFilename('');
  };

  const saveRenamedFilename = async (docId: string) => {
    if (!editingFilename.trim()) {
      onAddSystemLog('warning', 'O nome do arquivo não pode ficar vazio.');
      return;
    }
    setSavingRename(true);
    try {
      await fbRenameClinicDocument(clinicId, docId, editingFilename.trim());
      setDocuments(prev => prev.map(d => d.docId === docId ? { ...d, filename: editingFilename.trim() } : d));
      onAddSystemLog('success', 'Nome do arquivo atualizado.');
      cancelEditingFilename();
    } catch (err) {
      onAddSystemLog('error', 'Falha ao renomear o arquivo.');
    } finally {
      setSavingRename(false);
    }
  };

  const handleDeleteDocument = async (doc: ClinicDocument) => {
    if (!window.confirm(`Excluir "${doc.filename || 'este documento'}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await fbDeleteClinicDocument(clinicId, doc.docId);
      setDocuments(prev => prev.filter(d => d.docId !== doc.docId));
      onAddSystemLog('success', 'Documento excluído.');
    } catch (err) {
      onAddSystemLog('error', 'Falha ao excluir o documento.');
    }
  };

  const categoryTitles: Record<DocumentCategory, string> = {
    geral: 'Documentos Gerais da Clínica',
    contas: 'Contas — financeiro e contábil',
    convenios: 'Convênios — contratos com operadoras',
    pacientes: 'Documentos de Pacientes',
  };

  return (
    <div className="relative h-full">
      {!documentsAddonActive && (
        <AddonLockOverlay
          featureName="Documentos por IA"
          price="R$ 197/mês"
          description="Envie exames, atestados, contas e contratos de convênio — a IA lê, organiza e resume tudo automaticamente, separado por categoria e por paciente."
        />
      )}

      <div className={`h-full flex flex-col ${!documentsAddonActive ? 'pointer-events-none blur-[2px] select-none' : ''}`}>
        {/* Abas de categoria */}
        <div className="border-b border-slate-200 bg-white px-4 pt-3 flex gap-1 shrink-0">
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-sans rounded-t-lg border-b-2 transition-colors ${
                  category === tab.id
                    ? 'border-[#1A6FA8] text-[#1A6FA8] bg-blue-50/50'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista de pacientes — só aparece na categoria "Pacientes" */}
          {category === 'pacientes' && (
            <div className="w-[240px] border-r border-slate-200 bg-white flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar paciente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-sans focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredPatients.length === 0 && (
                  <p className="text-xs text-slate-400 font-sans p-3 text-center">Nenhum paciente ainda.</p>
                )}
                {filteredPatients.map(p => (
                  <button
                    key={p.phone}
                    onClick={() => setSelectedPatientPhone(p.phone)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-50 font-sans text-xs ${
                      p.phone === selectedPatientPhone ? 'bg-blue-50 text-[#1A6FA8] font-bold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.phone}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conteúdo principal */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-bold text-slate-800 font-sans mb-1">
              {category === 'pacientes' && activePatient ? `Documentos de ${activePatient.name}` : categoryTitles[category]}
            </h3>
            <p className="text-xs text-slate-400 font-sans mb-5">
              Escolha o tipo (se aplicável) e envie um arquivo — a IA lê e organiza automaticamente.
            </p>

            {/* Upload */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              {category === 'pacientes' && (
                <>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-sans block mb-1.5">Tipo de documento</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-sans mb-3 focus:outline-hidden"
                  >
                    {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map(t => (
                      <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </>
              )}

              <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 cursor-pointer font-sans text-xs ${
                uploading || (category === 'pacientes' && !activePatient)
                  ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'border-slate-300 text-slate-500 hover:border-[#1A6FA8] hover:text-[#1A6FA8]'
              }`}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando documento com IA...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Clique para enviar imagem ou PDF
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  disabled={uploading || (category === 'pacientes' && !activePatient)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Lista de documentos já salvos */}
            {loadingDocs && <p className="text-xs text-slate-400 font-sans">Carregando documentos...</p>}

            {!loadingDocs && documents.length > 0 && (
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome do arquivo ou conteúdo..."
                  value={docSearchTerm}
                  onChange={(e) => setDocSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-sans focus:outline-hidden"
                />
              </div>
            )}

            {!loadingDocs && documents.length === 0 && (
              <p className="text-xs text-slate-400 font-sans text-center py-8">Nenhum documento salvo ainda nesta categoria.</p>
            )}

            {!loadingDocs && documents.length > 0 && filteredDocuments.length === 0 && (
              <p className="text-xs text-slate-400 font-sans text-center py-8">Nenhum documento encontrado pra essa busca.</p>
            )}

            <div className="space-y-3">
              {filteredDocuments.map(doc => {
                const Icon = DOC_TYPE_ICONS[doc.docType] || File;
                return (
                  <div key={doc.docId} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5 text-[#1A6FA8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 font-sans">
                            {DOC_TYPE_LABELS[doc.docType as DocumentType] || doc.docType}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('pt-BR') : ''}
                            </span>
                            {editingDocId !== doc.docId && (
                              <>
                                <button
                                  onClick={() => startEditingFilename(doc)}
                                  className="p-1 text-slate-400 hover:text-[#1A6FA8] hover:bg-blue-50 rounded-md transition-colors"
                                  title="Renomear arquivo"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Excluir documento"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingDocId === doc.docId ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editingFilename}
                              onChange={(e) => setEditingFilename(e.target.value)}
                              autoFocus
                              className="flex-1 text-[11px] px-2 py-1 border border-[#1A6FA8] rounded-md font-sans focus:outline-hidden"
                            />
                            <button
                              onClick={() => saveRenamedFilename(doc.docId)}
                              disabled={savingRename}
                              className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors disabled:opacity-50"
                              title="Salvar"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEditingFilename}
                              disabled={savingRename}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md transition-colors"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          doc.filename && (
                            <p className="text-[10px] text-slate-400 font-sans truncate">{doc.filename}</p>
                          )
                        )}

                        <p className="text-xs text-slate-600 font-sans mt-1">{doc.summary}</p>
                        {doc.extractedDate && (
                          <p className="text-[10px] text-slate-400 font-sans mt-1">Data no documento: {doc.extractedDate}</p>
                        )}
                        {doc.alert && (
                          <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-amber-800 font-sans">{doc.alert}</span>
                          </div>
                        )}
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#1A6FA8] font-bold font-sans mt-2 hover:underline"
                        >
                          <Download className="w-3 h-3" /> Ver arquivo original
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
