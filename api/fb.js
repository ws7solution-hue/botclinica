// Vercel serverless function — proxy Firebase REST
const crypto = require("crypto");
function hashPin(pin) {
  return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

const API_KEY    = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const PROJECT_ID = "botclinica-60b6f";
const FS  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

const ENDPOINTS = {
  signIn:       `${AUTH_URL}:signInWithPassword?key=${API_KEY}`,
  signUp:       `${AUTH_URL}:signUp?key=${API_KEY}`,
  lookup:       `${AUTH_URL}:lookup?key=${API_KEY}`,
  reset:        `${AUTH_URL}:sendOobCode?key=${API_KEY}`,
  refreshToken: `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
};

// ── BUGFIX CRÍTICO: PATCH no Firestore sem "updateMask" APAGA todos os campos
// do documento que não estiverem presentes naquela chamada específica (a REST
// API do Firestore trata PATCH sem updateMask como substituição total do
// documento, não como merge). Isso já havia sido notado manualmente em UM
// lugar do código (ver "saveDoctor" mais abaixo), mas não nos outros ~24
// pontos que fazem PATCH no Firestore neste arquivo — causando bugs como
// campos de conversa (status, patientPhone, etc.) sendo apagados sempre que
// outro trecho do código atualiza só parte dos campos.
//
// Em vez de editar cada uma das chamadas individualmente (alto risco de
// esquecer alguma), interceptamos aqui o fetch global: toda vez que for um
// PATCH para o Firestore com um corpo { fields: {...} }, adicionamos
// automaticamente um updateMask.fieldPaths para cada campo enviado, fazendo
// o Firestore atualizar (merge) só esses campos, preservando o resto do
// documento intacto.
const _originalFetch = global.fetch;
global.fetch = function patchedFetch(input, opts) {
  try {
    const urlStr = typeof input === 'string' ? input : (input && input.url);
    if (
      opts &&
      opts.method === 'PATCH' &&
      typeof urlStr === 'string' &&
      urlStr.startsWith(FS) &&
      !urlStr.includes('updateMask.fieldPaths') &&
      typeof opts.body === 'string'
    ) {
      const parsedBody = JSON.parse(opts.body);
      if (parsedBody && parsedBody.fields && typeof parsedBody.fields === 'object') {
        const fieldNames = Object.keys(parsedBody.fields);
        if (fieldNames.length > 0) {
          const maskParams = fieldNames
            .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
            .join('&');
          const separator = urlStr.includes('?') ? '&' : '?';
          const newUrl = `${urlStr}${separator}${maskParams}`;
          return _originalFetch(newUrl, opts);
        }
      }
    }
  } catch (e) {
    // Se algo der errado ao tentar montar o updateMask, segue com a
    // requisição original em vez de quebrar a chamada.
  }
  return _originalFetch(input, opts);
};

// Obtém token de serviço do admin (conta de email/senha embutida apenas para operações admin)
// Alternativa sem service account: usa o próprio token do usuário ou API key
async function fsReq(path, opts = {}, token = null) {
  const url = `${FS}/${path}?key=${API_KEY}`;
  const hdrs = { "Content-Type": "application/json" };
  if (token) hdrs["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers: { ...hdrs, ...(opts.headers || {}) } });
}

function toFsValue(v) {
  if (v === undefined || v === null) return { nullValue: null };
  if (typeof v === "string")  return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object")  return { mapValue: { fields: toFsFields(v) } };
  return { stringValue: String(v) };
}

function toFsFields(obj) {
  const f = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    if (v === undefined || v === null) return;
    f[k] = toFsValue(v);
  });
  return f;
}

function parseFirestoreValue(valObj) {
  if (!valObj) return null;
  if ("stringValue" in valObj)  return valObj.stringValue;
  if ("timestampValue" in valObj) return valObj.timestampValue; // ISO string, ex: "2026-07-22T00:00:00Z"
  if ("booleanValue" in valObj) return valObj.booleanValue;
  if ("doubleValue" in valObj)  return Number(valObj.doubleValue);
  if ("integerValue" in valObj) return Number(valObj.integerValue);
  if ("arrayValue" in valObj)   return (valObj.arrayValue.values || []).map(parseFirestoreValue);
  if ("mapValue" in valObj) {
    const out = {};
    const fields = valObj.mapValue.fields || {};
    Object.keys(fields).forEach(k => { out[k] = parseFirestoreValue(fields[k]); });
    return out;
  }
  return null;
}

function emailToKey(email) {
  return email.toLowerCase().replace(/[@.]/g, "_");
}

// Converte um documento bruto do Firestore (coleção "leads") pro formato
// já pronto pro frontend usar direto.
// Busca todas as comissões, já calculando o status "elegível" em tempo
// real (comparando com hoje) — reaproveitada tanto pela visão completa do
// CRM quanto pela visão filtrada de cada parceiro.
async function fetchAllCommissions() {
  const r = await fsReq("commissions");
  const d = await r.json();
  if (d.error) return [];
  const now = new Date();
  return (d.documents || []).map((doc) => {
    const f = doc.fields || {};
    let status = f.status?.stringValue || "aguardando_carencia";
    const eligibleDate = f.eligibleDate?.stringValue;
    if (status === "aguardando_carencia" && eligibleDate && new Date(eligibleDate) <= now) {
      status = "elegivel";
    }
    return {
      id: doc.name.split("/").pop(),
      clinicEmail: f.clinicEmail?.stringValue || "",
      clinicName: f.clinicName?.stringValue || "",
      partnerId: f.partnerId?.stringValue || "",
      plano: f.plano?.stringValue || "",
      valorPlano: parseFloat(f.valorPlano?.doubleValue || f.valorPlano?.integerValue || 0),
      commissionRate: parseFloat(f.commissionRate?.doubleValue || f.commissionRate?.integerValue || 0),
      valorComissao: parseFloat(f.valorComissao?.doubleValue || f.valorComissao?.integerValue || 0),
      paymentDate: f.paymentDate?.stringValue || "",
      eligibleDate: eligibleDate || "",
      status,
      paidAt: f.paidAt?.stringValue || "",
    };
  }).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

function parseLeadDoc(doc) {
  const f = doc.fields || {};
  return {
    id: doc.name.split("/").pop(),
    partnerId: f.partnerId?.stringValue || "",
    nome: f.nome?.stringValue || "",
    email: f.email?.stringValue || "",
    telefone: f.telefone?.stringValue || "",
    plano: f.plano?.stringValue || "",
    addon: f.addon?.booleanValue || false,
    status: f.status?.stringValue || "novo",
    reuniaoData: f.reuniaoData?.stringValue || "",
    notas: f.notas?.stringValue || "",
    vendaConfirmada: f.vendaConfirmada?.booleanValue || false,
    createdAt: f.createdAt?.stringValue || "",
    updatedAt: f.updatedAt?.stringValue || "",
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { action, payload } = req.body || {};

  try {
    // ── AUTH ──────────────────────────────────────────────
    if (["signIn","signUp","lookup","reset"].includes(action)) {
      const r = await fetch(ENDPOINTS[action], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.status(200).json(await r.json());
    }

    if (action === "refreshToken") {
      const r = await fetch(ENDPOINTS.refreshToken, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(payload.refresh_token)}`,
      });
      return res.status(200).json(await r.json());
    }

    // ── FIRESTORE: clínica ────────────────────────────────
    if (action === "setClinic") {
      const { uid, data: clinicData, token } = payload;
      const r = await fsReq(`clinicas/${uid}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(clinicData) }),
      }, token);
      return res.status(200).json(await r.json());
    }

    // ── PLANO: ler ────────────────────────────────────────
    if (action === "getPlano") {
      const { email, token } = payload;
      if (!email) return res.status(200).json({ plano: "starter" });
      const key = emailToKey(email);
      const r = await fsReq(`acessos_autorizados/${key}`, {}, token);
      const d = await r.json();
      if (d.error) {
        console.log("getPlano err:", d.error.code, d.error.message, "| key:", key);
        // Se erro 404 = documento não existe → starter
        if (d.error.code === 404 || d.error.status === "NOT_FOUND") {
          return res.status(200).json({ plano: "starter" });
        }
        // Se erro de permissão, tenta sem token (regras podem permitir leitura pública)
        const r2 = await fetch(`${FS}/acessos_autorizados/${key}?key=${API_KEY}`);
        const d2 = await r2.json();
        const plano2 = d2.fields?.plano?.stringValue || "starter";
        return res.status(200).json({ plano: plano2 });
      }
      const plano = d.fields?.plano?.stringValue || "starter";
      return res.status(200).json({ plano });
    }

    // ── ADMIN: listar clientes ────────────────────────────
    if (action === "listClients") {
      // Tenta com e sem token
      const { token } = payload || {};
      let r = await fsReq(`acessos_autorizados`, {}, token);
      let d = await r.json();
      if (d.error) {
        r = await fetch(`${FS}/acessos_autorizados?key=${API_KEY}`);
        d = await r.json();
      }
      const docs = d.documents || [];
      const clients = docs.map(doc => ({
        email: doc.fields?.email?.stringValue || doc.name.split("/").pop().replace(/_/g, "."),
        plano: doc.fields?.plano?.stringValue || "starter",
        createdAt: doc.fields?.createdAt?.stringValue || "",
        // BUGFIX (05/08): faltava mandar o status real — o CRM estava
        // "chumbando" ativo:true pra todo mundo que aparecia por aqui,
        // sem nunca checar o valor de verdade guardado no banco.
        ativo: doc.fields?.ativo?.booleanValue !== false,
        statusPagamento: doc.fields?.statusPagamento?.stringValue || "",
        proximaCobranca: doc.fields?.proximaCobranca?.stringValue || "",
      }));
      return res.status(200).json({ clients });
    }

    // ── ADMIN: liberar/atualizar acesso ──────────────────
    // ── Ativar/desativar add-ons pagos por clínica (via CRM interno) ─────
    // Diferente do checkout self-service (Stripe), isso é o "poder de
    // fogo manual" do Willian — liberar teste grátis por X dias, ou
    // ativar/desativar direto, sem depender de pagamento.
    if (action === "adminSetDocumentsAddon") {
      const { clinicId, active, expiresAt } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const key = emailToKey(clinicId);
      const path = `clinic_settings_${key}/bot`;
      const fields = {
        documentsAddonActive: { booleanValue: !!active },
        documentsAddonExpiresAt: { stringValue: expiresAt || "" },
      };
      const paths = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      const r = await fetch(`${FS}/${path}?key=${API_KEY}&${paths}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }
    // ── Salva o telefone de WhatsApp da clínica na coleção central ───────
    // (usada pelo cloudapi da VPS para casar automaticamente com os
    // números registrados na WABA compartilhada da Meta)
    if (action === "saveClinicPhone") {
      const { clinicId, phone } = payload;
      if (!clinicId || !phone) return res.status(400).json({ error: "clinicId e phone são obrigatórios" });
      const key = emailToKey(clinicId);
      const r = await fetch(`${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=phone&key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { phone: { stringValue: phone } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "setAccess") {
      const { email, plano, senha } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const key = emailToKey(email);
      const senhaFinal = senha || "BotClinica@2026";

      // 1. Criar usuário no Firebase Auth (ignora se já existe)
      const signUpR = await fetch(ENDPOINTS.signUp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), password: senhaFinal, returnSecureToken: false }),
      });
      const signUpD = await signUpR.json();
      if (signUpD.error && !signUpD.error.message.includes("EMAIL_EXISTS")) {
        console.log("Auth create err:", signUpD.error.message);
      }

      // 2. Salvar plano no Firestore
      const body = JSON.stringify({
        fields: {
          email:     { stringValue: email.toLowerCase() },
          plano:     { stringValue: plano || "starter" },
          senha:     { stringValue: senhaFinal },
          createdAt: { stringValue: new Date().toISOString() },
        }
      });
      let r = await fetch(`${FS}/acessos_autorizados/${key}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });
      let d = await r.json();
      if (d.error) {
        console.log("setAccess err:", d.error.message, "| key:", key, "| plano:", plano);
        return res.status(200).json({ error: d.error.message });
      }
      return res.status(200).json({ ok: true, email, plano, key, senha: senhaFinal });
    }

    // ── ADMIN: remover acesso ─────────────────────────────
    if (action === "removeAccess") {
      const { email } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const key = emailToKey(email);
      await fetch(`${FS}/acessos_autorizados/${key}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }


    // ── CRM: listar clientes ────────────────────────────────
    if (action === "crmListClientes") {
      let r = await fetch(`${FS}/crm_clientes?key=${API_KEY}`);
      let d = await r.json();
      const docs = d.documents || [];
      const clientesBase = docs.map(doc => {
        const f = doc.fields || {};
        const get = (k, type) => f[k]?.[type] || f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          nome: get("nome","stringValue"),
          email: get("email","stringValue"),
          plano: get("plano","stringValue") || "starter",
          inicio: get("inicio","stringValue"),
          telefone: get("telefone","stringValue"),
          cidade: get("cidade","stringValue"),
          obs: get("obs","stringValue"),
          createdAt: get("createdAt","stringValue"),
          updatedAt: get("updatedAt","stringValue"),
        };
      });

      // BUGFIX CRÍTICO (05/08): "status" e "vencimento" eram campos
      // digitados manualmente aqui no CRM, sem nenhuma ligação com a
      // assinatura de verdade no Stripe — dava pra "ativo" aparecer na
      // tela mesmo com pagamento cancelado há meses. Agora busca o status
      // REAL de cada cliente direto de acessos_autorizados (a mesma coleção
      // que o login confere, e que o webhook do Stripe atualiza sozinho).
      const clientes = await Promise.all(clientesBase.map(async (c) => {
        if (!c.email) return { ...c, status: "sem_conta", vencimento: "" };
        try {
          const accR = await fsReq(`acessos_autorizados/${emailToKey(c.email)}`);
          const accD = await accR.json();
          const af = accD.fields || {};
          const ativo = af.ativo?.booleanValue !== false;
          const statusPagamento = af.statusPagamento?.stringValue || (ativo ? "em_dia" : "cancelado");
          return {
            ...c,
            status: !ativo ? "cancelado" : statusPagamento === "atrasado" ? "atrasado" : "ativo",
            vencimento: af.proximaCobranca?.stringValue || c.vencimento || "",
          };
        } catch (e) {
          return { ...c, status: "desconhecido", vencimento: "" };
        }
      }));

      return res.status(200).json({ clientes });
    }

    // ── CRM: salvar cliente ──────────────────────────────────
    if (action === "crmSaveCliente") {
      const { cliente } = payload;
      if (!cliente?.id) return res.status(400).json({ error: "ID obrigatório" });
      const r = await fetch(`${FS}/crm_clientes/${cliente.id}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFsFields(cliente) })
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── CRM: deletar cliente ─────────────────────────────────
    // ── CRM: ativar/bloquear acesso manualmente (toggle do lápis) ────────
    if (action === "crmSetAtivo") {
      const { email, ativo } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const key = emailToKey(email);
      await fetch(`${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=ativo&updateMask.fieldPaths=statusPagamento&key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            ativo: { booleanValue: !!ativo },
            statusPagamento: { stringValue: ativo ? "em_dia" : "bloqueado_manualmente" },
          }
        }),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "crmDeleteCliente") {
      const { id, email } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      await fetch(`${FS}/crm_clientes/${id}?key=${API_KEY}`, { method: "DELETE" });

      // BUGFIX (05/08 — 3ª rodada): antes só desativava (ativo:false),
      // mantendo o registro — por isso o cliente "reaparecia" na lista, só
      // que com status Cancelado, em vez de sumir de vez como o usuário
      // esperava de um "Excluir" de verdade. Agora apaga o documento por
      // completo (o login já bloqueia sozinho quando o registro não existe).
      const emailFinal = email || id.replace(/_/g, ".");
      const accKey = emailToKey(emailFinal);
      await fetch(`${FS}/acessos_autorizados/${accKey}?key=${API_KEY}`, { method: "DELETE" }).catch(() => {});

      return res.status(200).json({ ok: true });
    }

    // ── CRM: get config ──────────────────────────────────────
    if (action === "crmGetConfig") {
      const r = await fetch(`${FS}/crm_config/main?key=${API_KEY}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({ config: null });
      const raw = d.fields?.config?.stringValue;
      try { return res.status(200).json({ config: JSON.parse(raw) }); }
      catch(e) { return res.status(200).json({ config: null }); }
    }

    // ── CRM: save config ─────────────────────────────────────
    if (action === "crmSaveConfig") {
      const { config } = payload;
      const r = await fetch(`${FS}/crm_config/main?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { config: { stringValue: JSON.stringify(config) } } })
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }


    // ── CONVERSAS: listar ────────────────────────────────────
    if (action === "listConversas") {
      const { clinicId } = payload || {};
      const key = clinicId ? emailToKey(clinicId) : null;
      const collection = key ? `conversas_${key}` : "conversas";
      const r = await fetch(`${FS}/${collection}?key=${API_KEY}`);
      const d = await r.json();
      const docs = d.documents || [];
      const convs = docs.map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          from: g("from"), name: g("name"),
          lastMsg: g("lastMsg"), lastTime: g("lastTime"),
          status: g("status") || "bot", unread: g("unread") || "0"
        };
      }).sort((a,b) => b.lastTime.localeCompare(a.lastTime));
      return res.status(200).json({ convs });
    }

    // ── CONVERSAS: mensagens de uma conversa ─────────────────
    if (action === "getMsgs") {
      const { convId, clinicId } = payload;
      const key = clinicId ? emailToKey(clinicId) : null;
      const collection = key ? `conversas_${key}` : "conversas";
      const r = await fetch(`${FS}/${collection}/${convId}/msgs?key=${API_KEY}`);
      const d = await r.json();
      const docs = d.documents || [];
      const msgs = docs.map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || "";
        return { id: doc.name.split("/").pop(), text: g("text"), from: g("from"), time: g("time") };
      }).sort((a,b) => a.time.localeCompare(b.time));
      return res.status(200).json({ msgs });
    }

    // ── CONVERSAS: marcar como lido ──────────────────────────
    if (action === "markRead") {
      const { convId, clinicId } = payload;
      const key = clinicId ? emailToKey(clinicId) : null;
      const collection = key ? `conversas_${key}` : "conversas";
      await fetch(`${FS}/${collection}/${convId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({fields:{unread:{stringValue:"0"}}})
      });
      return res.status(200).json({ ok: true });
    }

    // ── CONVERSAS: atualizar status (bot/human) ──────────────
    if (action === "setConvStatus") {
      const { convId, status, clinicId } = payload;
      const key = clinicId ? emailToKey(clinicId) : null;
      const collection = key ? `conversas_${key}` : "conversas";
      await fetch(`${FS}/${collection}/${convId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({fields:{status:{stringValue:status}}})
      });
      return res.status(200).json({ ok: true });
    }


    // ── BOT CONFIG: get ──────────────────────────────────────
    if (action === "getBotConfig") {
      const { docId } = payload || {};
      const path = docId || "clinic_config/main";
      const r = await fetch(`${FS}/${path}?key=${API_KEY}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json(null);
      // BUGFIX: o parse manual antigo só entendia string/boolean/integer/
      // double — um campo do tipo array (como rulesList) virava undefined
      // sempre, mesmo já salvo corretamente no Firestore. Agora usamos o
      // parseFirestoreValue genérico, que já suporta arrays e objetos.
      const result = {};
      Object.entries(d.fields || {}).forEach(([k, v]) => {
        result[k] = parseFirestoreValue(v);
      });
      return res.status(200).json(Object.keys(result).length > 0 ? result : null);
    }

    // ── BOT CONFIG: save ─────────────────────────────────────
    if (action === "saveBotConfig") {
      const { docId, config, clinicId } = payload;
      // Suporta tanto docId explícito quanto clinicId
      const path = docId || (clinicId ? `clinic_settings_${emailToKey(clinicId)}/bot` : "clinic_config/main");
      // BUGFIX: o mapeamento antigo só tratava string/boolean/number — um
      // campo do tipo array (como rulesList, as regras de palavra-chave)
      // era silenciosamente ignorado e nunca chegava a ser salvo no
      // Firestore. Agora usamos o helper genérico toFsFields, que já
      // suporta arrays e objetos aninhados corretamente.
      const fields = toFsFields(config || {});
      const url = `${FS}/${path}?key=${API_KEY}`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }


    // ── LOGIN (wrapper do signIn) ──────────────────────────
    if (action === "login") {
      const { email, password } = payload;
      const r = await fetch(ENDPOINTS.signIn, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      // Buscar plano do usuário
      const planR = await fsReq(`acessos_autorizados/${emailToKey(email)}`);
      const planD = await planR.json();

      // BUGFIX CRÍTICO (05/08): antes, mesmo uma conta cancelada/inadimplente
      // de vez (ativo:false, gravado pelo webhook do Stripe quando a
      // assinatura é cancelada ou some depois de falhar) continuava
      // conseguindo logar normalmente — nada bloqueava de verdade.
      //
      // 2ª rodada: agora que "Excluir" no CRM apaga o registro de vez (não
      // só desativa), precisamos diferenciar dois casos aqui:
      //  - Registro NUNCA existiu ou foi EXCLUÍDO de propósito → bloqueia
      //  - Registro existe mas é antigo/manual, sem o campo "ativo" ainda
      //    (de antes dessa funcionalidade existir) → permite, por
      //    compatibilidade com contas legadas
      const contaExiste = !!planD.fields;
      const ativo = !contaExiste ? false : planD.fields.ativo?.booleanValue !== false;
      if (!ativo) {
        return res.status(200).json({
          error: "Sua assinatura está cancelada ou inativa. Entre em contato com o suporte para reativar seu acesso.",
        });
      }

      const plano = planD.fields?.plano?.stringValue || "starter";
      const firstAccess = planD.fields?.firstAccess?.booleanValue !== false; // true se campo não existe ou for true
      return res.status(200).json({ ok: true, email, plano, idToken: d.idToken, firstAccess });
    }

    // ── CHECK FIRST ACCESS ────────────────────────────────
    if (action === "checkFirstAccess") {
      const { email } = payload;
      if (!email) return res.status(400).json({ error: "email obrigatório" });
      const key = emailToKey(email);
      const r = await fsReq(`acessos_autorizados/${key}`);
      const d = await r.json();
      const firstAccess = d.fields?.firstAccess?.booleanValue !== false;
      if (!firstAccess) return res.status(200).json({ firstAccess: false });

      // Busca senha temporária para fazer login e obter idToken real
      const senhaTemp = d.fields?.senhaTemp?.stringValue || d.fields?.senha?.stringValue || '';
      if (!senhaTemp) return res.status(200).json({ firstAccess: true, idToken: '' });

      const lr = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senhaTemp, returnSecureToken: true })
      });
      const ld = await lr.json();
      if (ld.error) return res.status(200).json({ firstAccess: true, idToken: '' });
      return res.status(200).json({ firstAccess: true, idToken: ld.idToken });
    }
    if (action === "getPlan") {
      const { email } = payload;
      const r = await fsReq(`acessos_autorizados/${emailToKey(email)}`);
      const d = await r.json();
      if (d.error) return res.status(200).json({ plano: "starter" });
      return res.status(200).json({ plano: d.fields?.plano?.stringValue || "starter" });
    }

    // ── MÉDICOS: listar ───────────────────────────────────
    if (action === "listDoctors") {
      const { clinicId } = payload;
      const col = clinicId ? `doctors_${emailToKey(clinicId)}` : "doctors";
      const r = await fsReq(col);
      const d = await r.json();
      const docs = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        const g = (k, type="stringValue") => f[k]?.[type] || f[k]?.stringValue || "";
        const arr = k => (f[k]?.arrayValue?.values || []).map(v => v.stringValue || "");
        return {
          id: doc.name.split("/").pop(),
          name: g("name"), specialty: g("specialty"), crm: g("crm"),
          rating: parseFloat(f.rating?.doubleValue || f.rating?.integerValue || "4.5"),
          avatarUrl: g("avatarUrl"),
          schedules: arr("schedules"),
          consultationFee: parseFloat(f.consultationFee?.doubleValue || f.consultationFee?.integerValue || "0"),
          activePatientsCount: parseInt(f.activePatientsCount?.integerValue || "0"),
          isActive: f.isActive?.booleanValue !== false,
          attendanceDays: arr("attendanceDays"),
          startTime: g("startTime"), endTime: g("endTime"),
          slotDuration: parseInt(f.slotDuration?.integerValue || f.slotDuration?.doubleValue || "30"),
          breakStart: g("breakStart"), breakEnd: g("breakEnd"),
          break2Start: g("break2Start"), break2End: g("break2End"),
          procedures: g("procedures"), insurancePlans: g("insurancePlans"),
          exams: g("exams"), discounts: g("discounts"),
          schedulingPolicy: g("schedulingPolicy"), preparationInstructions: g("preparationInstructions"),
          additionalNotes: g("additionalNotes"),
          botName: g("botName") || "Sofia", botTone: g("botTone") || "Cordial",
          repasseType: g("repasseType") || undefined,
          repasseValue: f.repasseValue ? parseFloat(f.repasseValue?.doubleValue || f.repasseValue?.integerValue || "0") : undefined,
        };
      });
      return res.status(200).json({ doctors: docs });
    }

    // ── MÉDICOS: salvar ───────────────────────────────────
    if (action === "saveDoctor") {
      const { doctor, clinicId } = payload;
      if (!doctor?.id) return res.status(400).json({ error: "ID obrigatório" });
      const col = clinicId ? `doctors_${emailToKey(clinicId)}` : "doctors";
      const r = await fsReq(`${col}/${doctor.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields({
          ...doctor,
          attendanceDays: undefined, schedules: undefined,
        }) }),
      });
      const d = await r.json();
      // Salvar arrays separadamente (com updateMask — sem isso, o PATCH sobrescreve
      // o documento inteiro e apaga nome/especialidade/CRM salvos na chamada acima)
      if (doctor.attendanceDays) {
        const url = `${FS}/${col}/${doctor.id}?key=${API_KEY}&updateMask.fieldPaths=attendanceDays&updateMask.fieldPaths=schedules`;
        await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: {
            attendanceDays: { arrayValue: { values: doctor.attendanceDays.map(v => ({ stringValue: v })) } },
            schedules: { arrayValue: { values: (doctor.schedules || []).map(v => ({ stringValue: v })) } },
          }}),
        });
      }
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── MÉDICOS: deletar ──────────────────────────────────
    if (action === "deleteDoctor") {
      const { id, clinicId } = payload;
      const col = clinicId ? `doctors_${emailToKey(clinicId)}` : "doctors";
      await fsReq(`${col}/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── AGENDAMENTOS: listar ──────────────────────────────
    if (action === "listAppointments") {
      const { clinicId } = payload;
      const col = clinicId ? `appointments_${emailToKey(clinicId)}` : "appointments";
      const r = await fsReq(col);
      const d = await r.json();
      const apts = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        // BUGFIX (22/07): antes só lia f[k]?.stringValue — quebrava silenciosamente
        // quando um campo vinha salvo como timestampValue (ex: consultas criadas
        // manualmente pelo app) ou integerValue (ex: telefone salvo como número
        // em vez de texto). Isso fazia a "date" chegar vazia no frontend mesmo
        // com a consulta existindo de verdade, e por isso não aparecia a bolinha
        // verde no calendário. Agora usa o parser genérico + normaliza a data.
        const g = k => {
          const v = parseFirestoreValue(f[k]);
          return v === null || v === undefined ? "" : String(v);
        };
        // Normaliza qualquer formato de data pra "AAAA-MM-DD" simples
        let dateStr = g("date");
        if (dateStr.includes("T")) dateStr = dateStr.split("T")[0];

        return {
          id: doc.name.split("/").pop(),
          patientName: g("patientName"), patientPhone: g("patientPhone"),
          doctorId: g("doctorId"), doctorName: g("doctorName"),
          specialty: g("specialty"), date: dateStr, time: g("time"),
          status: g("status") || "pending",
          reminderSent: f.reminderSent?.booleanValue || false,
          reminderStatus: g("reminderStatus") || "none",
          attendanceStatus: g("attendanceStatus") || "pending",
        };
      });
      return res.status(200).json({ appointments: apts });
    }

    // ── AGENDAMENTOS: salvar ──────────────────────────────
    if (action === "saveAppointment") {
      const { appointment, clinicId } = payload;
      if (!appointment?.id) return res.status(400).json({ error: "ID obrigatório" });
      const col = clinicId ? `appointments_${emailToKey(clinicId)}` : "appointments";
      const r = await fsReq(`${col}/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(appointment) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── AGENDAMENTOS: deletar ─────────────────────────────
    // ── CONVERSAS: deletar ────────────────────────────────
    if (action === "deleteConversation") {
      const { id, clinicId } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      const col = clinicId ? `conversations_${emailToKey(clinicId)}` : "conversations";
      const url = `${FS}/${col}/${id}?key=${API_KEY}`;
      await fetch(url, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── APPOINTMENTS: deletar permanentemente ─────────────
    if (action === "deleteAppointment") {
      const { id, clinicId } = payload;
      const col = clinicId ? `appointments_${emailToKey(clinicId)}` : "appointments";
      await fsReq(`${col}/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── CONFIGURAÇÕES DA CLÍNICA ──────────────────────────
    if (action === "getClinicSettings") {
      const { clinicId } = payload;
      const key = clinicId ? `clinic_settings_${emailToKey(clinicId)}` : "clinic_settings_main";
      const r = await fsReq(`clinic_config/${key}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({ settings: null });
      try {
        const raw = d.fields?.data?.stringValue || "{}";
        return res.status(200).json({ settings: JSON.parse(raw) });
      } catch(e) { return res.status(200).json({ settings: null }); }
    }

    if (action === "saveClinicSettings") {
      const { settings, clinicId } = payload;
      const key = clinicId ? `clinic_settings_${emailToKey(clinicId)}` : "clinic_settings_main";
      await fsReq(`clinic_config/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(settings) } } }),
      });
      return res.status(200).json({ ok: true });
    }

    // ── AGENDAMENTOS: cancelar (PATCH parcial, preserva demais campos) ──
    if (action === "cancelAppointment") {
      const { clinicId, appointmentId } = payload;
      if (!appointmentId) return res.status(400).json({ error: "appointmentId obrigatório" });
      const col = clinicId ? `appointments_${emailToKey(clinicId)}` : "appointments";
      const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=reminderStatus";
      const r = await fsReq(`${col}/${appointmentId}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields({ status: "canceled", reminderStatus: "canceled_by_patient" }) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      // TODO: notificar paciente via WhatsApp sobre o cancelamento (conectar com webhook/VPS aqui)
      return res.status(200).json({ success: true });
    }

    // ── AGENDAMENTOS: marcar lembrete como enviado (PATCH parcial) ──
    if (action === "markReminderSent") {
      const { clinicId, appointmentId } = payload;
      if (!appointmentId) return res.status(400).json({ error: "appointmentId obrigatório" });
      const col = clinicId ? `appointments_${emailToKey(clinicId)}` : "appointments";
      const mask = "updateMask.fieldPaths=reminderSent&updateMask.fieldPaths=reminderStatus";
      const r = await fsReq(`${col}/${appointmentId}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields({ reminderSent: true, reminderStatus: "sent" }) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      // TODO: disparar o envio real do lembrete via WhatsApp (conectar com webhook/VPS aqui)
      return res.status(200).json({ success: true });
    }

    // ── PRONTUÁRIO: listar entradas de um paciente ────────
    if (action === "listProntuario") {
      const { clinicId, patientId } = payload;
      if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
      const col = `prontuario_${emailToKey(clinicId || "")}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const docs = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || f[k]?.integerValue || f[k]?.doubleValue || "";
        return {
          id: doc.name.split("/").pop(),
          patientId: g("patientId"),
          date: g("date"), doctorName: g("doctorName"), specialty: g("specialty"),
          complaint: g("complaint"), conduct: g("conduct"),
          prescription: g("prescription"), attachments: g("attachments"),
          timestamp: parseFloat(f.timestamp?.doubleValue || f.timestamp?.integerValue || "0"),
        };
      }).filter(entry => entry.patientId === patientId)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return res.status(200).json(docs);
    }

    // ── PRONTUÁRIO: salvar nova entrada (sempre cria, nunca sobrescreve) ──
    if (action === "saveProntuarioEntry") {
      const { clinicId, patientId, entry } = payload;
      if (!patientId || !entry) return res.status(400).json({ error: "patientId e entry obrigatórios" });
      const timestamp = Date.now();
      const entryId = `${patientId}_${timestamp}`;
      const col = `prontuario_${emailToKey(clinicId || "")}`;
      const fullEntry = { ...entry, id: entryId, patientId, timestamp };
      const r = await fsReq(`${col}/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(fullEntry) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json(fullEntry);
    }

    // ── PRONTUÁRIO: ficha fixa do paciente (ler) ──────────
    if (action === "getPatientProfile") {
      const { clinicId, patientId } = payload;
      if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });
      const col = `pacientes_${emailToKey(clinicId || "")}`;
      const r = await fsReq(`${col}/${patientId}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json(null);
      const f = d.fields;
      const g = k => f[k]?.stringValue || "";
      return res.status(200).json({
        id: patientId, name: g("name"), phone: g("phone"), birthDate: g("birthDate"),
        gender: g("gender"), address: g("address"), allergies: g("allergies"),
        comorbidities: g("comorbidities"), continuousMeds: g("continuousMeds"),
        prevSurgeries: g("prevSurgeries"),
      });
    }

    // ── PRONTUÁRIO: ficha fixa do paciente (salvar/editar) ──
    if (action === "savePatientProfile") {
      const { clinicId, patientId, profile } = payload;
      if (!patientId || !profile) return res.status(400).json({ error: "patientId e profile obrigatórios" });
      const col = `pacientes_${emailToKey(clinicId || "")}`;
      const fullProfile = { ...profile, id: patientId, patientId };
      const r = await fsReq(`${col}/${patientId}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(fullProfile) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json(fullProfile);
    }

    // ── CONVERSAS POR CLÍNICA (multi-tenant — isolado, ainda sem o webhook
    // real escrevendo aqui até o Embedded Signup ser concluído) ──
    // ── Alertas proativos da clínica (gerados pelo job da VPS) ──────────
    if (action === "listClinicAlerts") {
      const { clinicId } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const col = `clinic_alerts_${emailToKey(clinicId)}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const alerts = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        return {
          id: doc.name.split("/").pop(),
          type: f.type?.stringValue || "",
          title: f.title?.stringValue || "",
          message: f.message?.stringValue || "",
          createdAt: f.createdAt?.stringValue || "",
          read: f.read?.booleanValue || false,
        };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.status(200).json(alerts);
    }

    if (action === "markAlertRead") {
      const { clinicId, alertId } = payload;
      if (!clinicId || !alertId) return res.status(400).json({ error: "clinicId e alertId obrigatórios" });
      const col = `clinic_alerts_${emailToKey(clinicId)}`;
      const url = `${FS}/${col}/${alertId}?key=${API_KEY}&updateMask.fieldPaths=read`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { read: { booleanValue: true } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // Apaga TODOS os alertas de uma clínica de uma vez (botão "Limpar alertas")
    if (action === "clearClinicAlerts") {
      const { clinicId } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const col = `clinic_alerts_${emailToKey(clinicId)}`;
      const r = await fsReq(col);
      const d = await r.json();
      const docs = d.documents || [];
      for (const doc of docs) {
        const alertId = doc.name.split("/").pop();
        await fetch(`${FS}/${col}/${alertId}?key=${API_KEY}`, { method: "DELETE" }).catch(() => {});
      }
      return res.status(200).json({ ok: true, deleted: docs.length });
    }

    // ── Documentos organizados por IA ────────────────────────────────
    if (action === "listClinicDocuments") {
      const { clinicId, patientId, category } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const col = `clinic_documents_${emailToKey(clinicId)}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      let docs = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        return {
          docId: f.docId?.stringValue || doc.name.split("/").pop(),
          category: f.category?.stringValue || "geral",
          patientId: f.patientId?.stringValue || "",
          patientName: f.patientName?.stringValue || "",
          docType: f.docType?.stringValue || "",
          filename: f.filename?.stringValue || "",
          summary: f.summary?.stringValue || "",
          extractedDate: f.extractedDate?.stringValue || "",
          alert: f.alert?.stringValue || "",
          fileUrl: f.fileUrl?.stringValue || "",
          uploadedAt: f.uploadedAt?.stringValue || "",
        };
      }).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      if (patientId) docs = docs.filter(doc => doc.patientId === patientId);
      if (category) docs = docs.filter(doc => doc.category === category);
      return res.status(200).json(docs);
    }

    // Renomear — só o campo "filename" (nome de exibição), nada mais.
    // Não precisa mexer no arquivo físico na VPS, já que ele é salvo com
    // um nome interno próprio (baseado no docId), não no nome original.
    if (action === "renameClinicDocument") {
      const { clinicId, docId, newFilename } = payload;
      if (!clinicId || !docId || !newFilename) {
        return res.status(400).json({ error: "clinicId, docId e newFilename são obrigatórios" });
      }
      const col = `clinic_documents_${emailToKey(clinicId)}`;
      const url = `${FS}/${col}/${docId}?key=${API_KEY}&updateMask.fieldPaths=filename`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { filename: { stringValue: newFilename } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // Excluir — apaga o registro no Firestore E o arquivo físico na VPS
    // (nessa ordem: se a exclusão do arquivo falhar por qualquer motivo,
    // pelo menos o documento já sumiu da lista pra clínica).
    if (action === "deleteClinicDocument") {
      const { clinicId, docId } = payload;
      if (!clinicId || !docId) return res.status(400).json({ error: "clinicId e docId são obrigatórios" });
      const key = emailToKey(clinicId);
      const col = `clinic_documents_${key}`;

      // Busca o documento primeiro, pra saber o nome do arquivo físico a apagar
      const getR = await fetch(`${FS}/${col}/${docId}?key=${API_KEY}`);
      const getD = await getR.json();
      const fileUrl = getD.fields?.fileUrl?.stringValue || "";

      const delR = await fetch(`${FS}/${col}/${docId}?key=${API_KEY}`, { method: "DELETE" });
      const delD = await delR.json().catch(() => ({}));
      if (delD.error) return res.status(200).json({ error: delD.error.message });

      // Extrai o nome do arquivo físico da fileUrl e apaga na VPS também
      // (não bloqueia a resposta se isso falhar — o registro já foi apagado)
      try {
        const match = fileUrl.match(/\/documents\/[^/]+\/([^?]+)/);
        if (match) {
          await fetch(`https://whatsapp.botclinica.com.br/documents/${key}/${match[1]}`, { method: "DELETE" });
        }
      } catch (e) { /* não bloqueia a resposta principal */ }

      // NOVO: apaga também qualquer lançamento financeiro criado
      // automaticamente a partir desse documento (identificados pelo
      // campo "sourceDocId") — senão a despesa continua na aba Financeiro
      // mesmo depois do documento de origem ter sido excluído.
      try {
        const finCol = `financeiro_entries_${key}`;
        const finR = await fetch(`${FS}/${finCol}?key=${API_KEY}`);
        const finD = await finR.json();
        const relatedEntries = (finD.documents || []).filter(
          (d) => d.fields?.sourceDocId?.stringValue === docId
        );
        for (const entryDoc of relatedEntries) {
          const entryId = entryDoc.name.split("/").pop();
          await fetch(`${FS}/${finCol}/${entryId}?key=${API_KEY}`, { method: "DELETE" });
        }
      } catch (e) { /* não bloqueia a resposta principal */ }

      return res.status(200).json({ ok: true });
    }

    if (action === "listConversations") {
      const { clinicId } = payload;
      const col = clinicId ? `conversations_${emailToKey(clinicId)}` : "conversations";
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const docs = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || "";
        const arr = k => (f[k]?.arrayValue?.values || []).map(v => parseFirestoreValue(v));
        return {
          id: doc.name.split("/").pop(),
          patientName: g("patientName"), patientPhone: g("patientPhone"),
          status: g("status") || "bot",
          lastMessage: g("lastMessage"), lastMessageTime: g("lastMessageTime"),
          // BUGFIX (22/07): faltava ler o updatedAt de volta — sem ele, o
          // frontend não tinha como saber qual conversa teve atividade mais
          // recente, e a lista aparecia na ordem "crua" do Firestore em vez
          // de mais recente primeiro.
          updatedAt: parseFirestoreValue(f.updatedAt) || "",
          unreadCount: parseInt(f.unreadCount?.integerValue || f.unreadCount?.doubleValue || "0"),
          avatarColor: g("avatarColor") || "bg-slate-500",
          category: g("category") || "WhatsApp",
          assignedDoctorId: g("assignedDoctorId") || undefined,
          receptionNote: g("receptionNote") || "",
          messages: arr("messages"),
        };
      });
      return res.status(200).json(docs);
    }

    if (action === "saveConversation") {
      const { clinicId, conversation } = payload;
      if (!conversation?.id) return res.status(400).json({ error: "ID obrigatório" });
      const col = clinicId ? `conversations_${emailToKey(clinicId)}` : "conversations";
      const r = await fsReq(`${col}/${conversation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(conversation) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json(conversation);
    }

    // ── Nota interna de recepção — update PARCIAL (só esse campo, sem
    // tocar no resto da conversa, diferente do saveConversation acima) ──
    if (action === "saveReceptionNote") {
      const { clinicId, conversationId, note } = payload;
      if (!conversationId) return res.status(400).json({ error: "conversationId obrigatório" });
      const col = clinicId ? `conversations_${emailToKey(clinicId)}` : "conversations";
      const url = `${FS}/${col}/${conversationId}?key=${API_KEY}&updateMask.fieldPaths=receptionNote`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { receptionNote: { stringValue: note || "" } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── TROCAR SENHA (Firebase Auth) ─────────────────────
    if (action === "changePassword") {
      const { idToken, newPassword } = payload;
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
      });
      return res.status(200).json(await r.json());
    }

    // ── PRIMEIRO ACESSO: marcar como concluído ───────────
    if (action === "setFirstAccessDone") {
      const { clinicId } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const key = emailToKey(clinicId);
      const url = `${FS}/acessos_autorizados/${key}?key=${API_KEY}&updateMask.fieldPaths=firstAccess`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { firstAccess: { booleanValue: false } } }),
      });
      const d = await r.json();
      console.log("setFirstAccessDone result:", JSON.stringify(d).slice(0, 200));
      if (d.error) console.error("setFirstAccessDone erro:", d.error.message);
      return res.status(200).json({ ok: !d.error });
    }

    // ── WHATSAPP: trocar code OAuth pelo token ────────
    if (action === "exchangeWACode") {
      const { code, redirectUri, clinicId } = payload;
      if (!code) return res.status(400).json({ error: "code obrigatório" });

      const APP_ID = "1350636587005556";
      const APP_SECRET = "20e8a34c67874880aa0b897148e8311c";

      // Troca code por token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
      );
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("exchangeWACode token error:", tokenData);
        return res.status(200).json({ error: "Falha ao obter token: " + (tokenData.error?.message || "erro desconhecido") });
      }

      const accessToken = tokenData.access_token;

      // Busca WABAs do usuário
      const wabaRes = await fetch(
        `https://graph.facebook.com/v20.0/me/businesses?fields=whatsapp_business_accounts&access_token=${accessToken}`
      );
      const wabaData = await wabaRes.json();
      const waba = wabaData.data?.[0]?.whatsapp_business_accounts?.data?.[0];
      if (!waba) return res.status(200).json({ error: "Nenhuma conta WhatsApp Business encontrada." });

      const wabaId = waba.id;

      // Busca número de telefone
      const phoneRes = await fetch(
        `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      const phoneInfo = phoneData.data?.[0];
      if (!phoneInfo) return res.status(200).json({ error: "Nenhum número de telefone encontrado." });

      // Salva credenciais no Firestore
      if (clinicId) {
        const key = emailToKey(clinicId);
        const col = `clinic_settings_${key}`;
        await fsReq(`${col}/whatsapp`, {
          method: "PATCH",
          body: JSON.stringify({ fields: toFsFields({
            phoneNumberId: phoneInfo.id,
            accessToken,
            wabaId,
            phoneNumber: phoneInfo.display_phone_number,
            connectedAt: new Date().toISOString(),
          })}),
        });

        // NOVO: também grava o phoneNumberId na coleção central
        // "acessos_autorizados" (listável de uma vez só). Diferente do
        // casamento por número de telefone usado para clínicas com número
        // adicionado manualmente na WABA compartilhada, aqui o Embedded
        // Signup já entrega o phoneNumberId exato — não precisa "adivinhar"
        // casando dígitos, então gravamos ele direto para o cloudapi da VPS
        // usar com prioridade (mais confiável, já que cada cliente do
        // Embedded Signup cria sua própria WABA separada da compartilhada).
        await fetch(`${FS}/acessos_autorizados/${key}?updateMask.fieldPaths=phoneNumberId&key=${API_KEY}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { phoneNumberId: { stringValue: phoneInfo.id } } }),
        }).catch(() => {});
      }

      return res.status(200).json({
        phoneNumber: phoneInfo.display_phone_number,
        phoneNumberId: phoneInfo.id,
        wabaId,
        connectedAt: new Date().toISOString(),
      });
    }
    if (action === "saveWhatsAppCredentials") {
      const { clinicId, phoneNumberId, accessToken, wabaId, phoneNumber, token } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const col = `clinic_settings_${emailToKey(clinicId)}`;
      const r = await fsReq(`${col}/whatsapp`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields({ phoneNumberId, accessToken, wabaId, phoneNumber, connectedAt: new Date().toISOString() }) }),
      }, token);
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ success: true });
    }

    // ── WHATSAPP CREDENTIALS: buscar por clínica ─────────
    if (action === "getWhatsAppCredentials") {
      const { clinicId } = payload;
      if (!clinicId) return res.status(400).json({ error: "clinicId obrigatório" });
      const col = `clinic_settings_${emailToKey(clinicId)}`;
      const r = await fsReq(`${col}/whatsapp`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json(null);
      const f = d.fields;
      return res.status(200).json({
        phoneNumberId: f.phoneNumberId?.stringValue || "",
        accessToken: f.accessToken?.stringValue || "",
        wabaId: f.wabaId?.stringValue || "",
        phoneNumber: f.phoneNumber?.stringValue || "",
        connectedAt: f.connectedAt?.stringValue || "",
      });
    }

    // ── CRM: listar clientes (colecao crm_clientes) ──────
    if (action === "crmListClientes") {
      const r = await fsReq("crm_clientes");
      const d = await r.json();
      if (d.error) return res.status(200).json({ clientes: [] });
      const clientes = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          nome: g("nome"), email: g("email"), plano: g("plano"),
          status: g("status"), inicio: g("inicio"), vencimento: g("vencimento"),
          telefone: g("telefone"), cidade: g("cidade"), obs: g("obs"),
          createdAt: g("createdAt"), updatedAt: g("updatedAt"),
        };
      });
      return res.status(200).json({ clientes });
    }

    // ── CRM: salvar cliente ───────────────────────────
    if (action === "crmSaveCliente") {
      const { cliente } = payload;
      if (!cliente?.id) return res.status(400).json({ error: "ID obrigatório" });
      const r = await fsReq(`crm_clientes/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields(cliente) }),
      });
      return res.status(200).json(await r.json());
    }

    // ── CRM: deletar cliente ──────────────────────────
    if (action === "crmDeleteCliente") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      const url = `${FS}/crm_clientes/${id}?key=${API_KEY}`;
      await fetch(url, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── CRM: config ───────────────────────────────────
    if (action === "crmGetConfig") {
      const r = await fsReq("crm_config/main");
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({ config: null });
      try {
        const cfg = JSON.parse(d.fields.json?.stringValue || "{}");
        return res.status(200).json({ config: cfg });
      } catch { return res.status(200).json({ config: null }); }
    }

    if (action === "crmSaveConfig") {
      const { config } = payload;
      const r = await fsReq("crm_config/main", {
        method: "PATCH",
        body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(config) } } }),
      });
      return res.status(200).json(await r.json());
    }

    // ── SUPORTE: listar tickets ───────────────────────
    if (action === "listSupportTickets") {
      const r = await fsReq("support_tickets");
      const d = await r.json();
      if (d.error) return res.status(200).json({ tickets: [] });
      const tickets = (d.documents || []).map(doc => {
        const f = doc.fields || {};
        const g = k => f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          email: g("email"), clinicName: g("clinicName"), plano: g("plano"),
          title: g("title"), status: g("status") || "aberto",
          createdAt: g("createdAt"), updatedAt: g("updatedAt"),
          messages: JSON.parse(f.messages?.stringValue || "[]"),
        };
      });
      return res.status(200).json({ tickets });
    }

    // ── SUPORTE: criar ticket ─────────────────────────
    if (action === "createSupportTicket") {
      const { email, clinicName, plano, title, message } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const id = emailToKey(email) + "_" + Date.now();
      const msgs = message ? JSON.stringify([{ role: "client", text: message, at: new Date().toISOString() }]) : "[]";
      const r = await fsReq(`support_tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: toFsFields({
          email, clinicName: clinicName || email.split("@")[0], plano: plano || "starter",
          title: title || message || "Novo chamado",
          status: "aberto", messages: msgs,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })}),
      });

      // Avisa via notificação push que um ticket novo chegou
      fetch("https://whatsapp.botclinica.com.br/notify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🎫 Novo chamado de suporte",
          body: `${clinicName || email} abriu um chamado: ${(title || message || "").slice(0, 80)}`,
          url: "https://botclinica.com.br/crm",
        }),
      }).catch(() => {});

      return res.status(200).json({ ok: true, id });
    }

    // ── SUPORTE: adicionar mensagem ───────────────────
    if (action === "addSupportMessage") {
      const { ticketId, message } = payload;
      if (!ticketId || !message) return res.status(400).json({ error: "ticketId e message obrigatórios" });
      // Busca msgs atuais
      const r = await fsReq(`support_tickets/${ticketId}`);
      const d = await r.json();
      const msgs = JSON.parse(d.fields?.messages?.stringValue || "[]");
      msgs.push(message);
      // URL com updateMask e key corretos (sem double ?)
      const url = `${FS}/support_tickets/${ticketId}?key=${API_KEY}&updateMask.fieldPaths=messages&updateMask.fieldPaths=updatedAt`;
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          messages: { stringValue: JSON.stringify(msgs) },
          updatedAt: { stringValue: new Date().toISOString() },
        }}),
      });

      // Se foi o cliente que respondeu (não o próprio Suporte), avisa
      if (message.role === "client") {
        fetch("https://whatsapp.botclinica.com.br/notify-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🎫 Nova mensagem no chamado",
            body: (message.text || "Cliente respondeu no chamado").slice(0, 100),
            url: "https://botclinica.com.br/crm",
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true });
    }

    // ── SUPORTE: atualizar status ─────────────────────
    if (action === "updateSupportTicket") {
      const { id, status } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      const url = `${FS}/support_tickets/${id}?key=${API_KEY}&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          status: { stringValue: status || "resolvido" },
          updatedAt: { stringValue: new Date().toISOString() },
        }}),
      });
      return res.status(200).json({ ok: true });
    }

    // ── SUPORTE: buscar ticket por email ──────────────
    if (action === "getSupportTickets") {
      const { email } = payload;
      if (!email) return res.status(400).json({ tickets: [] });
      const r = await fsReq("support_tickets");
      const d = await r.json();
      if (d.error) return res.status(200).json({ tickets: [] });
      const tickets = (d.documents || [])
        .map(doc => {
          const f = doc.fields || {};
          const g = k => f[k]?.stringValue || "";
          return { id: doc.name.split("/").pop(), email: g("email"), clinicName: g("clinicName"), plano: g("plano"), title: g("title"), status: g("status") || "aberto", createdAt: g("createdAt"), updatedAt: g("updatedAt"), messages: JSON.parse(f.messages?.stringValue || "[]") };
        })
        .filter(t => t.email === email);
      return res.status(200).json({ tickets });
    }

    // ── SUPORTE: excluir ticket ────────────────────────
    if (action === "deleteSupportTicket") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      await fsReq(`support_tickets/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── FINANCEIRO: PIN de acesso (separado da senha de login) ────────────
    if (action === "checkFinanceiroPin") {
      const { clinicId, pin } = payload;
      const col = `financeiro_${emailToKey(clinicId || "")}`;
      const r = await fsReq(`${col}/config`);
      const d = await r.json();
      if (d.error || !d.fields) {
        // Nunca configurado ainda — sinaliza pro frontend pedir criação de PIN
        return res.status(200).json({ hasPin: false, valid: false });
      }
      const storedHash = d.fields.pinHash?.stringValue || "";
      const valid = storedHash === hashPin(pin);
      return res.status(200).json({ hasPin: true, valid });
    }

    if (action === "setFinanceiroPin") {
      const { clinicId, pin } = payload;
      if (!pin || String(pin).length < 4) return res.status(400).json({ error: "PIN precisa ter ao menos 4 dígitos" });
      const col = `financeiro_${emailToKey(clinicId || "")}`;
      const r = await fetch(`${FS}/${col}/config?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { pinHash: { stringValue: hashPin(pin) } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── FINANCEIRO: lançamentos (receitas/despesas) ───────────────────────
    if (action === "listFinanceiroEntries") {
      const { clinicId } = payload;
      const col = `financeiro_entries_${emailToKey(clinicId || "")}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const entries = (d.documents || []).map(doc => {
        const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
        return { ...parsed, id: doc.name.split("/").pop() };
      });
      return res.status(200).json(entries);
    }

    if (action === "saveFinanceiroEntry") {
      const { clinicId, entry } = payload;
      if (!entry) return res.status(400).json({ error: "entry obrigatório" });
      const col = `financeiro_entries_${emailToKey(clinicId || "")}`;
      const entryId = entry.id || `fin_${Date.now()}`;
      const fullEntry = { ...entry, id: entryId };
      const r = await fetch(`${FS}/${col}/${entryId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFsFields(fullEntry) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json(fullEntry);
    }

    if (action === "deleteFinanceiroEntry") {
      const { clinicId, id } = payload;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      const col = `financeiro_entries_${emailToKey(clinicId || "")}`;
      await fsReq(`${col}/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (action === "getFinanceiroConfig") {
      const { clinicId } = payload;
      const col = `financeiro_${emailToKey(clinicId || "")}`;
      const r = await fsReq(`${col}/config`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({});
      const result = {};
      Object.entries(d.fields).forEach(([k, v]) => {
        if (k !== "pinHash") result[k] = parseFirestoreValue(v);
      });
      return res.status(200).json(result);
    }

    if (action === "setFinanceiroConfig") {
      const { clinicId, config } = payload;
      const col = `financeiro_${emailToKey(clinicId || "")}`;
      const r = await fetch(`${FS}/${col}/config?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFsFields(config || {}) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── PORTAL DO MÉDICO: PIN individual (separado do PIN do financeiro) ──
    if (action === "checkDoctorPin") {
      const { clinicId, doctorId, pin } = payload;
      const col = `doctors_${emailToKey(clinicId || "")}`;
      const r = await fsReq(`${col}/${doctorId}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({ hasPin: false, valid: false });
      const storedHash = d.fields.doctorPinHash?.stringValue || "";
      if (!storedHash) return res.status(200).json({ hasPin: false, valid: false });
      return res.status(200).json({ hasPin: true, valid: storedHash === hashPin(pin) });
    }

    if (action === "setDoctorPin") {
      const { clinicId, doctorId, pin } = payload;
      if (!pin || String(pin).length < 4) return res.status(400).json({ error: "PIN precisa ter ao menos 4 dígitos" });
      const col = `doctors_${emailToKey(clinicId || "")}`;
      const r = await fetch(`${FS}/${col}/${doctorId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { doctorPinHash: { stringValue: hashPin(pin) } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // Reset de PIN esquecido — só quem já está logado como dono da clínica
    // consegue chegar nessa tela (Médicos), então não precisa reconfirmar
    // senha aqui — o médico só vai poder criar um PIN novo no próximo login.
    if (action === "resetDoctorPin") {
      const { clinicId, doctorId } = payload;
      if (!doctorId) return res.status(400).json({ error: "doctorId obrigatório" });
      const col = `doctors_${emailToKey(clinicId || "")}`;
      const r = await fetch(`${FS}/${col}/${doctorId}?key=${API_KEY}&updateMask.fieldPaths=doctorPinHash`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { doctorPinHash: { stringValue: "" } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "listAdminConversations") {
      const { source } = payload; // 'suporte' ou 'vendas'
      const col = `admin_conversations_${source}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const items = (d.documents || []).map((doc) => {
        const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
        return { ...parsed, id: doc.name.split("/").pop() };
      });
      return res.status(200).json(items);
    }

    if (action === "updateAdminConversationStatus") {
      const { source, phone, status } = payload;
      const col = `admin_conversations_${source}`;
      const r = await fetch(`${FS}/${col}/${phone}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { status: { stringValue: status } } }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── CRM: excluir conversa (Suporte WhatsApp, Luna/Vendas ou Ticket) ──
    if (action === "deleteConversation") {
      const { tipo, id } = payload;
      if (!tipo || !id) return res.status(400).json({ error: "tipo e id são obrigatórios" });
      const colecoes = {
        suporte: "conversations_suporte",
        luna: "conversations_luna",
        ticket: "support_tickets",
      };
      const colecao = colecoes[tipo];
      if (!colecao) return res.status(400).json({ error: "tipo inválido" });
      await fetch(`${FS}/${colecao}/${id}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (action === "listWaSuporteConversations") {
      const r = await fsReq("conversations_suporte");
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const list = (d.documents || []).map(doc => {
        const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
        return { ...parsed, id: doc.name.split("/").pop() };
      });
      return res.status(200).json(list);
    }

    if (action === "listWaVendasConversations") {
      const r = await fsReq("conversations_luna");
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const list = (d.documents || []).map(doc => {
        const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
        return { ...parsed, id: doc.name.split("/").pop() };
      });
      return res.status(200).json(list);
    }

    if (action === "listScheduleBlocks") {
      const { clinicId } = payload;
      const col = `schedule_blocks_${emailToKey(clinicId || "")}`;
      const r = await fsReq(col);
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const list = (d.documents || []).map(doc => {
        const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
        return { ...parsed, id: doc.name.split("/").pop() };
      });
      return res.status(200).json(list);
    }

    if (action === "saveScheduleBlock") {
      const { clinicId, block } = payload;
      if (!block) return res.status(400).json({ error: "block obrigatório" });
      const col = `schedule_blocks_${emailToKey(clinicId || "")}`;
      const blockId = block.id || `block_${Date.now()}`;
      const fullBlock = { ...block, id: blockId };
      const r = await fetch(`${FS}/${col}/${blockId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFsFields(fullBlock) }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json(fullBlock);
    }

    if (action === "deleteScheduleBlock") {
      const { clinicId, id } = payload;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      const col = `schedule_blocks_${emailToKey(clinicId || "")}`;
      await fsReq(`${col}/${id}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── Programa de parceiros/indicação ("captadores") ───────────────────
    if (action === "listPartners") {
      const r = await fsReq("partners");
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const partners = (d.documents || []).map((doc) => {
        const f = doc.fields || {};
        return {
          id: doc.name.split("/").pop(),
          name: f.name?.stringValue || "",
          phone: f.phone?.stringValue || "",
          commissionRate: f.commissionRate ? parseFloat(f.commissionRate.doubleValue || f.commissionRate.integerValue || 50) : 50,
          createdAt: f.createdAt?.stringValue || "",
        };
      });
      return res.status(200).json(partners);
    }

    if (action === "savePartner") {
      const { id, name, phone, commissionRate, password } = payload;
      if (!id || !name) return res.status(400).json({ error: "id (código do link) e name são obrigatórios" });
      // O "id" é o próprio código usado no link (ex: joao → ?ref=joao) —
      // por isso precisa ser só letras/números/hífen, sem espaço ou acento,
      // já que vai direto numa URL.
      const cleanId = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!cleanId) return res.status(400).json({ error: "Código inválido — use só letras e números" });

      const existing = await fetch(`${FS}/partners/${cleanId}?key=${API_KEY}`);
      const existingD = await existing.json();

      const fields = {
        name: { stringValue: name },
        phone: { stringValue: phone || "" },
        commissionRate: { doubleValue: Number(commissionRate ?? 50) },
        // Só sobrescreve a senha se uma nova foi enviada — assim editar
        // nome/telefone não obriga redigitar a senha toda vez.
        password: { stringValue: password || existingD.fields?.password?.stringValue || "" },
        createdAt: { stringValue: existingD.fields?.createdAt?.stringValue || new Date().toISOString() },
      };
      const r = await fetch(`${FS}/partners/${cleanId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true, id: cleanId });
    }

    if (action === "deletePartner") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      await fetch(`${FS}/partners/${id}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // Lista as comissões — calcula "elegível" na hora (não fica um status
    // desatualizado esperando alguém rodar um job) comparando a data atual
    // com a data de elegibilidade salva.
    if (action === "listCommissions") {
      const commissions = await fetchAllCommissions();
      return res.status(200).json(commissions);
    }

    // Versão filtrada — usada na página /parceiro, pra cada parceiro só
    // ver as PRÓPRIAS comissões, nunca as dos outros (privacidade).
    if (action === "listPartnerCommissions") {
      const { partnerId } = payload;
      if (!partnerId) return res.status(400).json({ error: "partnerId obrigatório" });
      const all = await fetchAllCommissions();
      return res.status(200).json(all.filter((c) => c.partnerId === partnerId));
    }

    if (action === "markCommissionPaid") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      const r = await fetch(`${FS}/commissions/${id}?key=${API_KEY}&updateMask.fieldPaths=status&updateMask.fieldPaths=paidAt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "pago" },
            paidAt: { stringValue: new Date().toISOString() },
          },
        }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // ── Login do parceiro na página própria dele (/parceiro) ────────────
    if (action === "partnerLogin") {
      const { id, password } = payload;
      if (!id || !password) return res.status(400).json({ error: "Código e senha são obrigatórios" });
      const cleanId = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const r = await fetch(`${FS}/partners/${cleanId}?key=${API_KEY}`);
      const d = await r.json();
      if (!d.fields) return res.status(200).json({ error: "Parceiro não encontrado" });
      const storedPassword = d.fields.password?.stringValue || "";
      if (!storedPassword || storedPassword !== password) {
        return res.status(200).json({ error: "Senha incorreta" });
      }
      return res.status(200).json({
        ok: true,
        partner: {
          id: cleanId,
          name: d.fields.name?.stringValue || "",
          commissionRate: parseFloat(d.fields.commissionRate?.doubleValue || d.fields.commissionRate?.integerValue || 50),
        },
      });
    }

    // ── Leads cadastrados pelos parceiros ────────────────────────────────
    // status possíveis: novo | reuniao_marcada | negociando | vendido | perdido
    if (action === "savePartnerLead") {
      const { leadId, partnerId, nome, email, telefone, plano, addon, status, reuniaoData, notas } = payload;
      if (!partnerId || !nome) return res.status(400).json({ error: "partnerId e nome são obrigatórios" });
      const id = leadId || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const isNewLead = !leadId;

      const existing = leadId ? await (await fetch(`${FS}/leads/${id}?key=${API_KEY}`)).json() : {};

      const fields = {
        partnerId: { stringValue: partnerId },
        nome: { stringValue: nome },
        email: { stringValue: email || "" },
        telefone: { stringValue: telefone || "" },
        plano: { stringValue: plano || "" },
        addon: { booleanValue: !!addon },
        status: { stringValue: status || "novo" },
        reuniaoData: { stringValue: reuniaoData || "" },
        notas: { stringValue: notas || "" },
        vendaConfirmada: { booleanValue: existing.fields?.vendaConfirmada?.booleanValue || false },
        createdAt: { stringValue: existing.fields?.createdAt?.stringValue || new Date().toISOString() },
        updatedAt: { stringValue: new Date().toISOString() },
      };
      const r = await fetch(`${FS}/leads/${id}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });

      // Busca o nome do parceiro uma vez só, reaproveitado nas duas
      // notificações possíveis abaixo (lead novo e/ou marcado como vendido).
      let partnerName = partnerId;
      try {
        const partnerRes = await fetch(`${FS}/partners/${partnerId}?key=${API_KEY}`);
        const partnerData = await partnerRes.json();
        partnerName = partnerData.fields?.name?.stringValue || partnerId;
      } catch (e) { /* usa o id mesmo, sem travar o resto */ }

      // Avisa você por WhatsApp toda vez que um parceiro cadastra um lead
      // NOVO — mesmo padrão já usado pra "novo lead" da Luna.
      if (isNewLead) {
        try {
          await fetch("https://whatsapp.botclinica.com.br/notify-owner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "🆕 Novo lead — Parceiro",
              body: `${partnerName} cadastrou um lead novo: ${nome}${plano ? ` (interesse: ${plano})` : ""}.`,
              url: "https://botclinica.com.br/crm",
            }),
          });
        } catch (e) { /* não bloqueia o salvamento do lead se a notificação falhar */ }
      }

      // Avisa você por WhatsApp quando um parceiro marca "Vendido" — sem
      // isso, só descobre olhando o CRM manualmente de vez em quando.
      const previousStatus = existing.fields?.status?.stringValue;
      if (status === "vendido" && previousStatus !== "vendido") {
        try {
          await fetch("https://whatsapp.botclinica.com.br/notify-owner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "💰 Parceiro marcou uma venda",
              body: `${partnerName} marcou "${nome}" como vendido! Confirme no CRM (aba Parceiros) pra liberar a comissão.`,
              url: "https://botclinica.com.br/crm",
            }),
          });
        } catch (e) { /* não bloqueia o salvamento do lead se a notificação falhar */ }
      }

      return res.status(200).json({ ok: true, id });
    }

    // Lista só os leads DAQUELE parceiro (usado na página /parceiro dele)
    if (action === "listPartnerLeads") {
      const { partnerId } = payload;
      if (!partnerId) return res.status(400).json({ error: "partnerId obrigatório" });
      const r = await fsReq("leads");
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const leads = (d.documents || [])
        .map((doc) => parseLeadDoc(doc))
        .filter((l) => l.partnerId === partnerId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return res.status(200).json(leads);
    }

    // Lista TODOS os leads, de todos os parceiros (usado no CRM)
    if (action === "listAllLeads") {
      const r = await fsReq("leads");
      const d = await r.json();
      if (d.error) return res.status(200).json([]);
      const leads = (d.documents || [])
        .map((doc) => parseLeadDoc(doc))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return res.status(200).json(leads);
    }

    if (action === "deletePartnerLead") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "id obrigatório" });
      await fetch(`${FS}/leads/${id}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // Confirmação MANUAL de venda, feita por você no CRM (depois de checar
    // que o pagamento realmente caiu) — só isso gera a comissão de verdade.
    // O parceiro marcar "vendido" sozinho não cria comissão automaticamente,
    // exatamente pra evitar depender só da palavra dele.
    if (action === "confirmLeadSale") {
      const { leadId } = payload;
      if (!leadId) return res.status(400).json({ error: "leadId obrigatório" });

      const leadR = await fetch(`${FS}/leads/${leadId}?key=${API_KEY}`);
      const leadD = await leadR.json();
      if (!leadD.fields) return res.status(200).json({ error: "Lead não encontrado" });
      if (leadD.fields.vendaConfirmada?.booleanValue) {
        return res.status(200).json({ error: "Essa venda já foi confirmada antes" });
      }

      const partnerId = leadD.fields.partnerId?.stringValue || "";
      const plano = leadD.fields.plano?.stringValue || "starter";
      const nome = leadD.fields.nome?.stringValue || "";

      const partnerR = await fetch(`${FS}/partners/${partnerId}?key=${API_KEY}`);
      const partnerD = await partnerR.json();
      const commissionRate = parseFloat(partnerD.fields?.commissionRate?.doubleValue || partnerD.fields?.commissionRate?.integerValue || 50);

      const PLAN_PRICES_LOCAL = { starter: 397, profissional: 597, clinica: 997, premium: 1497 };
      const valorPlano = PLAN_PRICES_LOCAL[plano] || 0;
      const valorComissao = valorPlano * (commissionRate / 100);
      const now = new Date();
      const eligibleDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const commissionId = `comm_lead_${leadId}`;

      await fetch(`${FS}/commissions/${commissionId}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            clinicEmail: { stringValue: leadD.fields.email?.stringValue || "" },
            clinicName: { stringValue: nome },
            partnerId: { stringValue: partnerId },
            plano: { stringValue: plano },
            valorPlano: { doubleValue: valorPlano },
            commissionRate: { doubleValue: commissionRate },
            valorComissao: { doubleValue: valorComissao },
            paymentDate: { stringValue: now.toISOString() },
            eligibleDate: { stringValue: eligibleDate.toISOString() },
            status: { stringValue: "aguardando_carencia" },
            paidAt: { stringValue: "" },
            leadId: { stringValue: leadId },
          },
        }),
      });

      await fetch(`${FS}/leads/${leadId}?key=${API_KEY}&updateMask.fieldPaths=vendaConfirmada&updateMask.fieldPaths=status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            vendaConfirmada: { booleanValue: true },
            status: { stringValue: "vendido" },
          },
        }),
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    console.error("fb.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
