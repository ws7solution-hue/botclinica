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
    if (typeof v === "string")       f[k] = { stringValue: v };
    else if (typeof v === "boolean") f[k] = { booleanValue: v };
    else if (typeof v === "number")  f[k] = { integerValue: String(v) };
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
      const { email, plano } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const key = emailToKey(email);
      const body = JSON.stringify({
        fields: {
          email:     { stringValue: email.toLowerCase() },
          plano:     { stringValue: plano || "starter" },
          createdAt: { stringValue: new Date().toISOString() },
        }
      });
      // Tenta PATCH (com e sem token)
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
      return res.status(200).json({ ok: true, email, plano, key });
    }

    // ── ADMIN: remover acesso ─────────────────────────────
    if (action === "removeAccess") {
      const { email } = payload;
      if (!email) return res.status(400).json({ error: "Email obrigatório" });
      const key = emailToKey(email);
      await fetch(`${FS}/acessos_autorizados/${key}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    console.error("fb.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
