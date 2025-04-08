import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:5634',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:5634',
        changeOrigin: true,
      },
      '/chatbot': {
        target: 'http://localhost:5634',
        changeOrigin: true,
      }
    }
  }
}); 