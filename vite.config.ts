import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This allows using process.env.API_KEY in the code while hosted on Vercel
    'process.env': process.env
  }
});