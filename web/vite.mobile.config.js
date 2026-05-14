import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from './vite.config.js'

// Mobile build config — injecte VITE_PLATFORM=mobile
// Active AppMobile.jsx au lieu de AppDesktop.jsx
export default defineConfig({
  ...baseConfig,
  plugins: [react()],
  define: {
    ...baseConfig.define,
    'import.meta.env.VITE_PLATFORM': JSON.stringify('mobile'),
  },
  server: {
    ...baseConfig.server,
    port: 8323, // port différent du desktop
  },
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      output: {
        ...baseConfig.build?.rollupOptions?.output,
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'music-vendor': ['tone', '@tonejs/midi'],
          'tauri-vendor': ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs'],
        },
      },
    },
  },
})
