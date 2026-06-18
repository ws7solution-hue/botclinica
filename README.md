# BotClínica — AtendIA

Plataforma de atendimento inteligente para clínicas via WhatsApp.

## Arquivos

- `index.html` — A plataforma completa (frontend)
- `api/chat.js` — Proxy seguro para a API do Claude (backend)
- `vercel.json` — Configuração de deploy

## Deploy na Vercel

1. Faça upload desses arquivos no GitHub
2. Conecte o repositório na Vercel (vercel.com)
3. Adicione a variável de ambiente:
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: sua chave de console.anthropic.com
4. Deploy!

## Variáveis de ambiente necessárias

```
ANTHROPIC_API_KEY=sk-ant-...
```
