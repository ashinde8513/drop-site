import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'webapp',
  base: '/app/next/',
  plugins: [react()],
  build: {
    outDir: '../dist/app/next',
    emptyOutDir: false,
  },
});
