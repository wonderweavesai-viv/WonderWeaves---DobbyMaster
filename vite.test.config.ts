import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: 'test',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist-test',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: { input: path.resolve(__dirname, 'test/harness3d.html') },
  },
  css: { postcss: path.resolve(__dirname) },
});
