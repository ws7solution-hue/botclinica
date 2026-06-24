// Vercel serverless function — proxy Firebase REST
// Browser chama /api/fb, servidor chama Firebase (sem CORS)

const API_KEY = "AIzaSyAwYQq-ddQT8fBFytQYF5bgY5geL3SM2Ew";
const PROJECT_ID = "botclinica-60b6f";

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

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
