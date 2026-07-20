import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
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
      },
      {
        // BUGFIX (19/07): como o HTML de entrada é src/index.html, o Vite
        // gera a saída em app/src/index.html (espelhando a pasta de origem),
        // mas o vercel.json e o "base: '/app/'" esperam app/index.html na
        // raiz. Este plugin move o arquivo pro lugar certo após cada build.
        // Os caminhos de asset no HTML são absolutos (/app/assets/...), então
        // mover o arquivo de lugar não quebra nenhuma referência.
        name: 'move-index-html-to-app-root',
        closeBundle() {
          const from = path.resolve(__dirname, 'app/src/index.html');
          const to = path.resolve(__dirname, 'app/index.html');
          if (fs.existsSync(from)) {
            fs.renameSync(from, to);
            const srcDir = path.resolve(__dirname, 'app/src');
            if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).length === 0) {
              fs.rmdirSync(srcDir);
            }
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // BUGFIX (19/07): o outDir nunca foi definido, então "vite build"
      // sempre gerava em dist/ (padrão do Vite) — mas o vercel.json e o
      // "base: '/app/'" acima esperam os arquivos dentro de app/. Isso fazia
      // com que o deploy nunca refletisse mudanças novas no código-fonte,
      // já que app/ ficava com builds antigos, nunca sobrescritos.
      outDir: path.resolve(__dirname, 'app'),
      emptyOutDir: true,
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
