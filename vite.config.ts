import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev: the API server (npm run dev:server) owns /api, so the browser stays same-origin
  server: { proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
  // MapLibre spawns workers from its own URLs; pre-bundling breaks them in dev
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
