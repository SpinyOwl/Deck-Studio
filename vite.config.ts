// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: make asset paths relative so they work with file:// URLs
  base: './',
});
