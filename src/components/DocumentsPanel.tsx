import React, { useState, useEffect } from 'react';
import {
  Search, FileText, Upload, Loader2, AlertTriangle, Download, FlaskConical,
  ClipboardList, Pill, ShieldCheck, ArrowRightLeft, File, Wallet, FileStack, Users,
  Pencil, Trash2, Check, X, Sparkles
} from 'lucide-react';
import { Conversation, DocumentType, DocumentCategory, ClinicDocument, Doctor } from '../types';
import { fbListClinicDocuments, fbRenameClinicDocument, fbDeleteClinicDocument } from '../firebase';
import AddonLockOverlay from './AddonLockOverlay';

interface DocumentsPanelProps {
  clinicId: string;
  conversations: Conversation[];
  onAddSystemLog: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  documentsAddonActive: boolean;
  clinicName: string;
  clinicAddress: string;
  doctors: Doctor[];
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

// ── Geração de documentos padronizados ──────────────────────────────────────
// Cada tipo define os campos que precisa pedir ANTES de gerar — assim o
// formulário muda de acordo com o documento escolhido, em vez de pedir tudo
// de uma vez.
type CampoGerador = { id: string; label: string; tipo: 'texto' | 'textarea' | 'numero' | 'data' | 'medico'; placeholder?: string; opcional?: boolean };

interface TipoDocumentoGerador {
  id: string;
  nome: string;
  icon: React.ElementType;
  campos: CampoGerador[];
}

const TIPOS_DOCUMENTO_GERADOR: TipoDocumentoGerador[] = [
  {
    id: 'atestado',
    nome: 'Atestado Médico',
    icon: ClipboardList,
    campos: [
      { id: 'nomePaciente', label: 'Nome do paciente', tipo: 'texto' },
      { id: 'cpfPaciente', label: 'CPF do paciente', tipo: 'texto', opcional: true },
      { id: 'medicoId', label: 'Médico responsável', tipo: 'medico' },
      { id: 'diasAfastamento', label: 'Dias de afastamento', tipo: 'numero' },
      { id: 'cid', label: 'CID (opcional)', tipo: 'texto', opcional: true },
    ],
  },
  {
    id: 'declaracao',
    nome: 'Declaração de Comparecimento',
    icon: FileText,
    campos: [
      { id: 'nomePaciente', label: 'Nome do paciente', tipo: 'texto' },
      { id: 'dataComparecimento', label: 'Data do comparecimento', tipo: 'data' },
      { id: 'horaEntrada', label: 'Horário de entrada', tipo: 'texto', placeholder: 'Ex: 14:00' },
      { id: 'horaSaida', label: 'Horário de saída', tipo: 'texto', placeholder: 'Ex: 15:00', opcional: true },
      { id: 'medicoId', label: 'Médico responsável', tipo: 'medico' },
    ],
  },
  {
    id: 'encaminhamento',
    nome: 'Carta de Encaminhamento',
    icon: ArrowRightLeft,
    campos: [
      { id: 'nomePaciente', label: 'Nome do paciente', tipo: 'texto' },
      { id: 'medicoId', label: 'Médico solicitante', tipo: 'medico' },
      { id: 'destinoEspecialidade', label: 'Encaminhado para (especialidade/médico)', tipo: 'texto' },
      { id: 'motivo', label: 'Motivo do encaminhamento', tipo: 'textarea' },
    ],
  },
  {
    id: 'receita',
    nome: 'Receita Médica Simples',
    icon: Pill,
    campos: [
      { id: 'nomePaciente', label: 'Nome do paciente', tipo: 'texto' },
      { id: 'medicoId', label: 'Médico responsável', tipo: 'medico' },
      { id: 'medicamentos', label: 'Medicamentos e posologia', tipo: 'textarea', placeholder: 'Ex: Amoxicilina 500mg — 1 cápsula a cada 8h por 7 dias' },
    ],
  },
];

// Mesma normalização usada no Prontuário/Portal do Médico (remove o "9"
// extra do celular pra DDDs fora de SP/RJ/ES).
const normalizePatientId = (phone: string) => {
  let digits = (phone || '').replace(/[@.]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const match = digits.match(/^55(\d{2})9(\d{8})$/);
  if (match) digits = `55${match[1]}${match[2]}`;
  return digits;
};

export default function DocumentsPanel({ clinicId, conversations, onAddSystemLog, documentsAddonActive, clinicName, clinicAddress, doctors }: DocumentsPanelProps) {
  const [category, setCategory] = useState<DocumentCategory>('geral');
  const [geradorModalOpen, setGeradorModalOpen] = useState(false);
  const [tipoGeradorSelecionado, setTipoGeradorSelecionado] = useState<string>('atestado');
  const [dadosFormularioGerador, setDadosFormularioGerador] = useState<Record<string, string>>({});
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

  const abrirGeradorDocumento = (tipoId: string) => {
    setTipoGeradorSelecionado(tipoId);
    setDadosFormularioGerador({});
    setGeradorModalOpen(true);
  };

  const gerarDocumentoFinal = () => {
    const tipo = TIPOS_DOCUMENTO_GERADOR.find(t => t.id === tipoGeradorSelecionado);
    if (!tipo) return;

    // Confere se os campos obrigatórios foram preenchidos antes de gerar
    const faltando = tipo.campos.filter(c => !c.opcional && !dadosFormularioGerador[c.id]?.trim());
    if (faltando.length > 0) {
      onAddSystemLog('warning', `Preencha: ${faltando.map(c => c.label).join(', ')}`);
      return;
    }

    const medico = doctors.find(dr => dr.id === dadosFormularioGerador['medicoId']);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const d = dadosFormularioGerador;

    let corpoDocumento = '';
    let tituloDocumento: string = tipo.nome;

    if (tipo.id === 'atestado') {
      corpoDocumento = `
        <p>Atesto, para os devidos fins, que o(a) paciente <strong>${d.nomePaciente}</strong>${d.cpfPaciente ? `, CPF ${d.cpfPaciente},` : ''} esteve sob meus cuidados médicos, necessitando de <strong>${d.diasAfastamento} dia(s)</strong> de afastamento de suas atividades a partir desta data.</p>
        ${d.cid ? `<p>CID: ${d.cid}</p>` : ''}
      `;
    } else if (tipo.id === 'declaracao') {
      corpoDocumento = `
        <p>Declaro, para os devidos fins, que o(a) paciente <strong>${d.nomePaciente}</strong> esteve presente nesta clínica no dia <strong>${new Date(d.dataComparecimento + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>, das ${d.horaEntrada}${d.horaSaida ? ` às ${d.horaSaida}` : ''}, para fins de acompanhamento médico.</p>
      `;
    } else if (tipo.id === 'encaminhamento') {
      tituloDocumento = 'Carta de Encaminhamento';
      corpoDocumento = `
        <p>Encaminho o(a) paciente <strong>${d.nomePaciente}</strong> para avaliação com <strong>${d.destinoEspecialidade}</strong>.</p>
        <p><strong>Motivo do encaminhamento:</strong><br/>${(d.motivo || '').replace(/\n/g, '<br/>')}</p>
      `;
    } else if (tipo.id === 'receita') {
      corpoDocumento = `
        <p><strong>Paciente:</strong> ${d.nomePaciente}</p>
        <div style="margin-top:16px;white-space:pre-line;line-height:1.8">${d.medicamentos}</div>
      `;
    }

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>${tituloDocumento} — ${d.nomePaciente || ''}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;max-width:680px;margin:50px auto;padding:0 24px;line-height:1.7}
        .header{text-align:center;border-bottom:3px solid #1A6FA8;padding-bottom:16px;margin-bottom:30px}
        .header h1{font-size:19px;color:#0D2A3D;text-transform:uppercase;letter-spacing:.5px}
        .header p{color:#64748b;font-size:12px;margin-top:6px}
        .titulo-doc{text-align:center;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:24px;color:#1A6FA8}
        .corpo{font-size:14px;text-align:justify}
        .assinatura{margin-top:70px;text-align:center;font-size:13px;color:#334155}
        .assinatura .linha{border-top:1px solid #94a3b8;width:280px;margin:0 auto 8px}
        .data{margin-top:40px;text-align:right;font-size:13px;color:#64748b}
        .actions{margin-top:40px;text-align:center}
        button{padding:10px 22px;border-radius:8px;border:none;font-weight:700;cursor:pointer;font-size:13px;background:#1A6FA8;color:#fff}
        @media print{.actions{display:none}}
      </style></head><body>
        <div class="header">
          <h1>${clinicName || 'Clínica'}</h1>
          ${clinicAddress ? `<p>${clinicAddress}</p>` : ''}
        </div>
        <div class="titulo-doc">${tituloDocumento}</div>
        <div class="corpo">${corpoDocumento}</div>
        <div class="data">${clinicName ? clinicName + ', ' : ''}${dataHoje}</div>
        <div class="assinatura">
          <div class="linha"></div>
          ${medico ? `${medico.name}${medico.crm ? ' — CRM ' + medico.crm : ''}` : ''}
        </div>
        <div class="actions">
          <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
        </div>
      </body></html>
    `);
    win.document.close();
    setGeradorModalOpen(false);
    onAddSystemLog('success', `${tituloDocumento} gerado com sucesso.`);
  };
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
            data.financeEntriesCreated > 0
              ? `Documento analisado e salvo! ${data.financeEntriesCreated} despesa(s) lançada(s) automaticamente no Financeiro.`
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
          price="R$ 97/mês"
          description="Envie exames, atestados, contas e contratos de convênio — a IA lê, organiza e resume tudo automaticamente, separado por categoria e por paciente."
          clinicId={clinicId}
          onAddonAtivado={() => {
            onAddSystemLog('success', 'Add-on de Documentos por IA ativado! Recarregando...');
            setTimeout(() => window.location.reload(), 1200);
          }}
        />
      )}

      <div className={`h-full flex flex-col ${!documentsAddonActive ? 'pointer-events-none blur-[2px] select-none' : ''}`}>
        {/* Botão de gerar documento padronizado */}
        <div className="px-4 pt-3 bg-white border-b border-slate-200 shrink-0 flex justify-end">
          <button
            onClick={() => abrirGeradorDocumento('atestado')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A6FA8] to-[#135480] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold mb-2.5 hover:brightness-110 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gerar Documento
          </button>
        </div>
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

      {/* Modal — Gerar Documento Padronizado */}
      {geradorModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#1A6FA8]" />
              <h2 className="text-lg font-bold text-slate-800">Gerar Documento</h2>
            </div>

            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Tipo de documento</label>
            <select
              value={tipoGeradorSelecionado}
              onChange={(e) => { setTipoGeradorSelecionado(e.target.value); setDadosFormularioGerador({}); }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            >
              {TIPOS_DOCUMENTO_GERADOR.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>

            <div className="space-y-3">
              {TIPOS_DOCUMENTO_GERADOR.find(t => t.id === tipoGeradorSelecionado)?.campos.map(campo => (
                <div key={campo.id}>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    {campo.label}{!campo.opcional && <span className="text-red-500"> *</span>}
                  </label>
                  {campo.tipo === 'medico' ? (
                    <select
                      value={dadosFormularioGerador[campo.id] || ''}
                      onChange={(e) => setDadosFormularioGerador(prev => ({ ...prev, [campo.id]: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione o médico...</option>
                      {doctors.map(dr => (
                        <option key={dr.id} value={dr.id}>{dr.name} — {dr.specialty}</option>
                      ))}
                    </select>
                  ) : campo.tipo === 'textarea' ? (
                    <textarea
                      value={dadosFormularioGerador[campo.id] || ''}
                      onChange={(e) => setDadosFormularioGerador(prev => ({ ...prev, [campo.id]: e.target.value }))}
                      placeholder={campo.placeholder}
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'}
                      value={dadosFormularioGerador[campo.id] || ''}
                      onChange={(e) => setDadosFormularioGerador(prev => ({ ...prev, [campo.id]: e.target.value }))}
                      placeholder={campo.placeholder}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              O documento já sai com o nome da {clinicName || 'clínica'} automaticamente — não precisa digitar de novo.
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setGeradorModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={gerarDocumentoFinal} className="px-4 py-2 text-sm font-bold text-white bg-[#1A6FA8] hover:bg-[#135480] rounded-lg">
                Gerar Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
