import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works inside Electron (file://) and Capacitor (Android).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000, host: '0.0.0.0' },
  define: { 'process.env.API_KEY': JSON.stringify('') },
  build: { target: 'es2020', outDir: 'dist', chunkSizeWarningLimit: 2500 },
});
