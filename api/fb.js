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

function toFsFields(obj) {
  const f = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    if (v === undefined || v === null) return;
    if (typeof v === "string")       f[k] = { stringValue: v };
    else if (typeof v === "boolean") f[k] = { booleanValue: v };
    else if (typeof v === "number")  f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (Array.isArray(v))       f[k] = { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) } };
  });
  return f;
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
      const { config } = payload;
      const r = await fetch(`${FS}/clinic_config/main?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { botConfig: { stringValue: JSON.stringify(config) } } })
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
      return res.status(200).json({ ok: true, email, plano, idToken: d.idToken });
    }

    // ── GET PLAN ──────────────────────────────────────────
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
      // Salvar arrays separadamente
      if (doctor.attendanceDays) {
        await fsReq(`${col}/${doctor.id}`, {
          method: "PATCH",
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

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    console.error("fb.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
