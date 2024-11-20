import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist', // Ensures the output directory is 'dist'
  },
  server: mode === 'development' ? {
    proxy: {
      '/api': {
        target: 'https://eventhub-backend-14dq.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  } : undefined,
}));

