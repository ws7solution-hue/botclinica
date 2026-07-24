// ── BotClínica — Redefinição de senha com e-mail próprio (via Resend) ────────
// Antes disso, usávamos o e-mail automático do Firebase (accounts:sendOobCode),
// só que o template dele ficou travado no console (bug do lado do Firebase,
// sem solução via configuração). Agora fazemos em duas etapas:
//   1. Geramos o link de redefinição usando o Firebase ADMIN SDK — isso NÃO
//      dispara nenhum e-mail automático do Firebase, só devolve o link puro.
//   2. Mandamos nosso próprio e-mail, com nosso texto em português, usando o
//      Resend — nunca mais dependemos do template travado do Firebase.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // A chave vem com \n escapado como texto — precisa converter de volta
      // para quebra de linha real antes de usar.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'BotClínica <naoresponda@botclinica.com.br>';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  try {
    // 1. Gera o link de redefinição (sem mandar e-mail nenhum automaticamente)
    const actionCodeSettings = {
      url: 'https://botclinica.com.br/app', // pra onde volta depois de trocar a senha
      handleCodeInApp: false,
    };
    const link = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

    // 2. Manda nosso próprio e-mail, com nosso texto, via Resend
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Redefinição de senha - BotClínica',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #222;">
            <h2 style="color: #1A6FA8;">BotClínica</h2>
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta BotClínica associada a este e-mail (<strong>${email}</strong>).</p>
            <p>Para criar uma nova senha, clique no botão abaixo:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${link}" style="background-color: #1A6FA8; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Redefinir minha senha
              </a>
            </p>
            <p style="font-size: 12px; color: #888;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${link}</p>
            <p>Se você não solicitou essa alteração, pode ignorar este e-mail com segurança — sua senha atual continuará funcionando normalmente.</p>
            <p>Atenciosamente,<br/>Equipe BotClínica</p>
          </div>
        `,
      }),
    });

    const emailData = await emailResp.json();
    if (emailData.error || !emailResp.ok) {
      console.error('Erro ao enviar via Resend:', emailData);
      // Por segurança, não revelamos ao front se o e-mail existe ou não.
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Por segurança (não revelar se o e-mail existe na base), sempre
    // respondemos sucesso ao front, mas logamos o erro real aqui.
    console.error('Erro ao gerar link/enviar e-mail de redefinição:', err.message);
    return res.status(200).json({ ok: true });
  }
};
