import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Kills the dev server shortly after the last browser tab closes. A short grace
// window is required so an HMR-triggered reload (which drops and re-opens the
// socket) does not take the server down.
function shutdownOnTabClose(graceMs = 2500): Plugin {
  let clients = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    name: 'shutdown-on-tab-close',
    configureServer(server) {
      server.ws.on('connection', (socket) => {
        clients++;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        socket.on('close', () => {
          clients--;
          if (clients > 0 || timer) return;
          timer = setTimeout(() => {
            timer = null;
            if (clients > 0) return;
            console.log('\n[dev] last tab closed - shutting down dev server');
            server.close().finally(() => {
              (globalThis as { process?: { exit(code: number): void } }).process?.exit(0);
            });
          }, graceMs);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shutdownOnTabClose()],
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
