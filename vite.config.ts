import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker: mette in cache il GUSCIO dell'app (HTML/JS/CSS/icona di
    // login) così si apre anche senza rete. I DATI non passano di qui: gli
    // eventi li conserva `lib/cacheEventi.ts`, dove possiamo mostrare "dati
    // del <quando>" e non finiamo per cachare risposte autenticate.
    VitePWA({
      registerType: 'autoUpdate', // dopo un deploy la nuova build si installa da sola
      injectRegister: 'auto',
      manifest: false, // il manifest è scritto a mano in public/manifest.webmanifest
      workbox: {
        // Le icone da 512 servono al sistema operativo al momento dell'installazione,
        // non all'app in esecuzione: fuori dal precache per non portarsi dietro 500 KB.
        globPatterns: ['**/*.{js,css,html}', 'favicon-32.png', 'icona-192.png', 'manifest.webmanifest'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Gli handler delle notifiche push (public/push-sw.js) entrano nel
        // service worker generato. Tenerli in un file a parte vuol dire che
        // rigenerare il worker non se li porta via.
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
})
