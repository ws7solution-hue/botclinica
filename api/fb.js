// Vercel serverless function — proxy Firebase REST
// Browser chama /api/fb, servidor chama Firebase (sem CORS)

const API_KEY = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const PROJECT_ID = "botclinica-60b6f";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ENDPOINTS = {
  signIn:       `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  signUp:       `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  lookup:       `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
  reset:        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
  refreshToken: `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
};

function firestoreUrl(uid) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clinicas/${uid}?key=${API_KEY}`;
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

module.exports = async (req, res) => {
  // CORS — permite só nosso domínio
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, payload } = req.body || {};

  try {
    // --- AUTH ACTIONS ---
    if (["signIn", "signUp", "lookup", "reset"].includes(action)) {
      const r = await fetch(ENDPOINTS[action], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // --- REFRESH TOKEN ---
    if (action === "refreshToken") {
      const r = await fetch(ENDPOINTS.refreshToken, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(payload.refresh_token)}`,
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // --- FIRESTORE SET CLINIC ---
    if (action === "setClinic") {
      const { uid, data: clinicData, token } = payload;
      const hdrs = { "Content-Type": "application/json" };
      if (token) hdrs["Authorization"] = `Bearer ${token}`;
      const r = await fetch(firestoreUrl(uid), {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ fields: toFsFields(clinicData) }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // --- GET PLANO ---
    if (action === "getPlano") {
      const { email } = payload;
      if (!email) return res.status(200).json({ plano: "starter" });
      const emailKey = email.replace(/[@.]/g, "_");
      const r = await fetch(`${FS}/acessos_autorizados/${emailKey}?key=${API_KEY}`);
      const d = await r.json();
      const plano = d.fields?.plano?.stringValue || "starter";
      return res.status(200).json({ plano });
    }

    // --- LIST CLIENTS ---
    if (action === "listClients") {
      const r = await fetch(`${FS}/acessos_autorizados?key=${API_KEY}`);
      const d = await r.json();
      const docs = d.documents || [];
      const clients = docs.map(doc => {
        const parts = doc.name.split("/");
        const emailKey = parts[parts.length - 1];
        const email = emailKey.replace(/_/g, ".").replace(/\.(\w+)$/, (m, tld) => "@" + tld.replace(/\./g, "."));
        // Reconstruct email properly
        const emailClean = emailKey.replace(/_at_/gi, "@").replace(/(.*?)_([^_]+)$/, "$1@$2").replace(/_/g, ".");
        return {
          email: doc.fields?.email?.stringValue || emailKey.replace(/_/g, "."),
          plano: doc.fields?.plano?.stringValue || "starter",
          createdAt: doc.fields?.createdAt?.stringValue || ""
        };
      });
      return res.status(200).json({ clients });
    }

    // --- SET ACCESS ---
    if (action === "setAccess") {
      const { email, plano } = payload;
      if (!email) return res.status(400).json({ error: "Email required" });
      const emailKey = email.replace(/[@.]/g, "_");
      const r = await fetch(`${FS}/acessos_autorizados/${emailKey}?key=${API_KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            email: { stringValue: email },
            plano: { stringValue: plano || "starter" },
            createdAt: { stringValue: new Date().toISOString() }
          }
        })
      });
      const d = await r.json();
      if (d.error) return res.status(200).json({ error: d.error.message });
      return res.status(200).json({ ok: true });
    }

    // --- REMOVE ACCESS ---
    if (action === "removeAccess") {
      const { email } = payload;
      if (!email) return res.status(400).json({ error: "Email required" });
      const emailKey = email.replace(/[@.]/g, "_");
      await fetch(`${FS}/acessos_autorizados/${emailKey}?key=${API_KEY}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
