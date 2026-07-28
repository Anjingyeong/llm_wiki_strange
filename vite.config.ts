import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      // Hybrid search + RAG ask need the Node server (npm start) during local demo.
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: true,
      },
    },
  },
});
