// v1.0b (08/05/2026) — Ajout config Vitest pour Lot 5 (engine tests)
// v1.0a (08/05/2026) — config Vite Lot 1, alias seulement (PWA reportee Lot 5)
// v1.0 (08/05/2026) — config Vite Lot 1, alias + PWA basique
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@render': path.resolve(__dirname, './src/render'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib')
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
})
