import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/app/',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-fb-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/fb') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(body || '{}');
                  const { default: handler } = await import('./api/fb.js');
                  
                  const mockRes = {
                    status(code: number) {
                      res.statusCode = code;
                      return this;
                    },
                    json(data: any) {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                    }
                  };
                  
                  const mockReq = {
                    body: payload,
                    method: 'POST'
                  };
                  
                  await handler(mockReq, mockRes);
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // BUGFIX: o projeto nunca teve um HTML de entrada de verdade para o
      // Vite processar o app React — o index.html da raiz é a landing page
      // estática. Sem isso, "vite build" usava o HTML errado como entrada,
      // gerando um bundle minúsculo (só a landing) em vez do painel React
      // completo. Aqui apontamos explicitamente para src/index.html.
      rollupOptions: {
        input: path.resolve(__dirname, 'src/index.html'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
