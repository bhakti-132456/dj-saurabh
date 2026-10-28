import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        // Current live site stays at /, the redesign is served at /new/
        main: resolve(__dirname, 'index.html'),
        new: resolve(__dirname, 'new/index.html'),
      },
    },
  },
})
