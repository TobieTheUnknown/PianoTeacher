import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    strictPort: true,
  },

  // Use TAURI_PLATFORM env variable to detect Tauri context
  envPrefix: ['VITE_', 'TAURI_PLATFORM', 'TAURI_ARCH', 'TAURI_FAMILY', 'TAURI_PLATFORM_VERSION', 'TAURI_PLATFORM_TYPE', 'TAURI_DEBUG'],

  // Build optimizations
  build: {
    // Target modern browsers for better optimization
    target: 'es2020',

    // Minification with esbuild (faster and included by default)
    minify: 'esbuild',

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Rollup options for code splitting
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom'],

          // Music/Audio vendor chunk (usually largest)
          'music-vendor': ['tone', '@tonejs/midi'],

          // Tauri vendor chunk (if in Tauri context)
          'tauri-vendor': ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs']
        },

        // Optimize chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    // Source maps for debugging (disable in production if not needed)
    sourcemap: false,

    // CSS code splitting
    cssCodeSplit: true,

    // Asset inline threshold (assets smaller than this will be inlined as base64)
    assetsInlineLimit: 4096
  },

  // Optimization options
  optimizeDeps: {
    // Pre-bundle these dependencies
    include: ['react', 'react-dom', 'tone', '@tonejs/midi'],

    // Force optimization even if in node_modules
    force: false
  },

  // CSS configuration
  css: {
    // CSS modules configuration
    modules: {
      localsConvention: 'camelCase',
      scopeBehaviour: 'local'
    },

    // PostCSS can be configured here if needed
    postcss: {}
  }
})
