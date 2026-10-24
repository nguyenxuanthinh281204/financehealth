import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinanceHealth',
        short_name: 'FinanceHealth',
        description: 'Quản lý chi tiêu, cân nặng, thực đơn và khoảnh khắc mỗi ngày',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f4ef',
        theme_color: '#1d6b52',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Không cache API và file media qua service worker
        navigateFallbackDenylist: [/^\/api/, /^\/files/],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/files': 'http://localhost:8080',
    },
  },
})
