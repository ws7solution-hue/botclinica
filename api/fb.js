// Vercel serverless function — proxy Firebase REST

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
      }));
      return res.status(200).json({ clients });
    }

    // ── ADMIN: liberar/atualizar acesso ──────────────────
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
      const clientes = docs.map(doc => {
        const f = doc.fields || {};
        const get = (k, type) => f[k]?.[type] || f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          nome: get("nome","stringValue"),
          email: get("email","stringValue"),
          plano: get("plano","stringValue") || "starter",
          status: get("status","stringValue") || "ativo",
          inicio: get("inicio","stringValue"),
          vencimento: get("vencimento","stringValue"),
          telefone: get("telefone","stringValue"),
          cidade: get("cidade","stringValue"),
          obs: get("obs","stringValue"),
          createdAt: get("createdAt","stringValue"),
          updatedAt: get("updatedAt","stringValue"),
        };
      });
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
    if (action === "crmDeleteCliente") {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });
      await fetch(`${FS}/crm_clientes/${id}?key=${API_KEY}`, { method: "DELETE" });
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
      const r = await fetch(`${FS}/clinic_config/main?key=${API_KEY}`);
      const d = await r.json();
      if (d.error || !d.fields) return res.status(200).json({ config: null });
      const raw = d.fields?.botConfig?.stringValue;
      try { return res.status(200).json({ config: JSON.parse(raw) }); }
      catch(e) { return res.status(200).json({ config: null }); }
    }

    // ── BOT CONFIG: save ─────────────────────────────────────
    if (action === "saveBotConfig") {
      const { docId, config, clinicId } = payload;
      // Suporta tanto docId explícito quanto clinicId
      const path = docId || (clinicId ? `clinic_settings_${emailToKey(clinicId)}/bot` : "clinic_config/main");
      const fields = {};
      Object.entries(config || {}).forEach(([k, v]) => {
        if (typeof v === 'string') fields[k] = { stringValue: v };
        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
        else if (typeof v === 'number') fields[k] = { doubleValue: v };
      });
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
        const g = k => f[k]?.stringValue || "";
        return {
          id: doc.name.split("/").pop(),
          patientName: g("patientName"), patientPhone: g("patientPhone"),
          doctorId: g("doctorId"), doctorName: g("doctorName"),
          specialty: g("specialty"), date: g("date"), time: g("time"),
          status: g("status") || "pending",
          reminderSent: f.reminderSent?.booleanValue || false,
          reminderStatus: g("reminderStatus") || "none",
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
        const g = k => f[k]?.stringValue || "";
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
          unreadCount: parseInt(f.unreadCount?.integerValue || f.unreadCount?.doubleValue || "0"),
          avatarColor: g("avatarColor") || "bg-slate-500",
          category: g("category") || "WhatsApp",
          assignedDoctorId: g("assignedDoctorId") || undefined,
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

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    console.error("fb.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
