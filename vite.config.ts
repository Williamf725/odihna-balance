import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite automatically exposes env vars starting with VITE_ to import.meta.env
  // No extra define needed.
});
