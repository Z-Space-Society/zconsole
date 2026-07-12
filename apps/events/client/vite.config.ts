import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/events/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/events', // assets served at /events/assets/... by Cloudflare
  },
  server: {
    port: 5174,
    strictPort: true, // Fail if port is busy instead of incrementing
    proxy: {
      '/events/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for /events/api/ws
      },
    },
  },
})
