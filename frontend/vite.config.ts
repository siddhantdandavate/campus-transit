import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
              const serverRes = res as import('http').ServerResponse;
              if (!serverRes.headersSent) {
                serverRes.writeHead(503, { 'Content-Type': 'application/json' });
                serverRes.end(
                  JSON.stringify({
                    detail: 'FastAPI backend is unreachable at http://127.0.0.1:8000. Start the backend with: python main.py or uvicorn main:app --port 8000',
                    code: 'ECONNREFUSED_BACKEND_OFFLINE',
                  })
                );
              }
            }
          });
        },
      },
    },
  },
})

