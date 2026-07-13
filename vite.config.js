import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
        },
      },
    },
  },
  server: {
    // In development, forward /api/* to the Express server so the
    // frontend can call fetch('/api/chat') with no CORS setup.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
