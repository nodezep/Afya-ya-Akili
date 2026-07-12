import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, forward /api/* to the Express server so the
    // frontend can call fetch('/api/chat') with no CORS setup.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
