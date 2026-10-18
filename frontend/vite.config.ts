import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()], server:{proxy:{'/api':'http://127.0.0.1:8000'}}, build:{target:'es2022',assetsInlineLimit:0,rollupOptions:{output:{manualChunks(id){if(/\/locales\/.*\.json$/.test(id))return 'locales';}}}}});
