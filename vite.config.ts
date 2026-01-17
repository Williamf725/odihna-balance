import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // This is the key fix: It replaces 'import.meta.env.VITE_API_KEY' in your code
      // with the actual string value during the build process.
      // The browser will execute: return "AIzaSy..."; instead of trying to read an object.
      'import.meta.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
    }
  };
});
