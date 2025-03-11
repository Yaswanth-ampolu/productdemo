import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ini from 'ini';
import fs from 'fs';
import path from 'path';

// Read config.ini
const configPath = process.env.CONFIG_PATH || '../config.ini';
const config = ini.parse(fs.readFileSync(path.resolve(__dirname, configPath), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: parseInt(config.frontend.port),
    proxy: {
      '/auth': {
        target: `${config.server.protocol}://${config.server.domain}:${config.server.port}`,
        changeOrigin: true,
        secure: config.security.strict_transport_security === 'true'
      },
      '/users': {
        target: `${config.server.protocol}://${config.server.domain}:${config.server.port}`,
        changeOrigin: true,
        secure: config.security.strict_transport_security === 'true'
      }
    },
  },
  build: {
    outDir: config.server.static_root_path,
    emptyOutDir: true
  },
  define: {
    __APP_CONFIG__: JSON.stringify({
      appName: config.frontend.app_name,
      appTitle: config.frontend.app_title,
      mode: config.frontend.app_mode
    })
  }
}); 