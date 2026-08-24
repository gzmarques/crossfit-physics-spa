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
          {
            src: '/dynawod-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/dynawod-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})