import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/auth': {
        target: 'http://172.16.16.26:5634',
        changeOrigin: true,
        secure: false
      },
      '/users': {
        target: 'http://172.16.16.26:5634',
        changeOrigin: true,
        secure: false
      }
    },
  },
}); 