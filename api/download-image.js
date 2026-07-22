// ── BotClínica — Proxy de download de imagem ─────────────────────────────────
// Baixa a imagem do lado do servidor (mesma origem do site) e força o
// download de verdade com Content-Disposition: attachment. Isso evita dois
// problemas do navegador: 1) CORS ao tentar ler bytes de outro domínio via
// fetch(), e 2) o atributo "download" do HTML ser ignorado em links de
// outro domínio (comportamento padrão de segurança dos navegadores).
module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://whatsapp.botclinica.com.br/media/')) {
    return res.status(400).json({ error: 'URL inválida' });
  }

  try {
    const mediaRes = await fetch(url);
    if (!mediaRes.ok) {
      return res.status(404).json({ error: 'Imagem não encontrada ou expirada' });
    }
    const contentType = mediaRes.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await mediaRes.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="imagem-paciente-${Date.now()}.jpg"`);
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
