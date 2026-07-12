import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
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

