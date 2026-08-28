import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'DynaWOD - Motor Biomecânico',
        short_name: 'DynaWOD',
        description: 'Plataforma de cálculo de potência e gasto metabólico real.',
        theme_color: '#1e1e1e',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          { src: '/dynawod-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/dynawod-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa bibliotecas pesadas em seus próprios arquivos
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('html2canvas')) return 'vendor-html2canvas';
            if (id.includes('@supabase')) return 'vendor-supabase';
            return 'vendor'; // Todo o resto do node_modules vai para cá
          }
        }
      }
    }
  }
})