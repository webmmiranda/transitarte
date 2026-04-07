import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Transitarte 26',
        short_name: 'Transitarte 26',
        description:
          'Agenda interactiva, búsqueda, filtros, mapas y acceso rápido para guardar eventos en tu calendario.',
        theme_color: '#340762',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: '/icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,txt,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'data',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/mapa/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'maps',
            },
          },
        ],
      },
    }),
  ],
})
