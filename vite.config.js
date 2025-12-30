import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@tauri-apps/api']
  },
  build: {
    rollupOptions: {
      external: (id) => {
        // Externalize Tauri API imports - they'll be available via window.__TAURI__ in desktop app
        return id.startsWith('@tauri-apps/')
      }
    }
  }
})
