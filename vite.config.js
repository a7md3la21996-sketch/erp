import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'gzip', threshold: 10240 }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 10240 }),
    // PWA/Service Worker REMOVED — was causing stale cache issues
    // Users had to clear cache after every deploy
    // Vercel CDN handles caching efficiently without SW
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-i18n': ['react-i18next', 'i18next'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
