// v1.0c (09/05/2026) — Lot 7 : ajout VitePWA (manifest + workbox + runtimeCaching)
// v1.0b (08/05/2026) — Ajout config Vitest pour Lot 5 (engine tests)
// v1.0a (08/05/2026) — config Vite Lot 1, alias seulement (PWA reportee Lot 5)
// v1.0 (08/05/2026) — config Vite Lot 1, alias + PWA basique
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.svg', 'scenes/*.png'],
            manifest: {
                name: 'TACTICA',
                short_name: 'TACTICA',
                description: 'Wargame hex tactique — batailles de France, Moyen Age à la Première Guerre mondiale.',
                lang: 'fr',
                dir: 'ltr',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                display_override: ['window-controls-overlay', 'standalone'],
                orientation: 'any',
                start_url: '/lobby',
                scope: '/',
                categories: ['games', 'strategy'],
                prefer_related_applications: false,
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/, /\.supabase\.co/],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'google-fonts-stylesheets' }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] }
                        }
                    },
                    {
                        urlPattern: /\.supabase\.co\//,
                        handler: 'NetworkOnly'
                    }
                ]
            },
            devOptions: {
                enabled: false
            }
        })
    ],
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
});
