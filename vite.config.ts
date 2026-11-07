import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev-only: Shift+L in the app POSTs here to stop the dev server.
function killSwitch(): Plugin {
  return {
    name: 'dev-kill-switch',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shutdown', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.statusCode = 204;
        res.end();
        console.log('\n[dev] kill switch - shutting down dev server');
        server.close().finally(() => {
          (globalThis as { process?: { exit(code: number): void } }).process?.exit(0);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), killSwitch()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
