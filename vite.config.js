import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'mask-icon.svg'],
      manifest: {
        name: 'Copier - Fast Snippet Copy',
        short_name: 'Copier',
        description: 'An application for copying saved snippets very quickly with a single click, designed for mobile-first usage.',
        theme_color: '#3b82f6',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'mask-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'mask-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
});
