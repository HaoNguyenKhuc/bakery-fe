import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    proxy: {
      // Strip /api/v1 prefix before forwarding to backend
      // e.g. /api/v1/health → http://localhost:8080/health
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // Không rewrite: giữ nguyên /api/v1/... để backend nhận đúng path
      },
    },
  },
})

