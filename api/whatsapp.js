export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const EVOLUTION_URL = 'https://evolution-api-production-16f18.up.railway.app';
  const EVOLUTION_KEY = 'botclinica2025';
  const INSTANCE = 'botclinica';

  try {
    const { number, text } = req.body;
    if (!number || !text) return res.status(400).json({ error: 'number e text obrigatórios' });

    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_KEY,
      },
      body: JSON.stringify({ number, text }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar mensagem WhatsApp' });
  }
}
