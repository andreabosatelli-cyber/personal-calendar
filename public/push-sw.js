// Handler push del service worker.
//
// Viene importato dentro il service worker generato da vite-plugin-pwa
// (vite.config.ts, workbox.importScripts): quello si occupa della cache del
// guscio, questo dei promemoria. Tenerli separati vuol dire che una rigenerazione
// del service worker non si porta via questo codice.
//
// Gira anche ad app chiusa: e' l'unico pezzo dell'app che il sistema operativo
// sveglia per conto suo.

self.addEventListener('push', (event) => {
  let dati = {}
  try {
    dati = event.data ? event.data.json() : {}
  } catch {
    // Push senza payload leggibile: meglio un avviso generico che niente. Il
    // permesso e' stato dato con userVisibleOnly, quindi qualcosa DOBBIAMO
    // mostrare: se restiamo zitti il browser mostra un avviso di sistema suo,
    // molto piu' brutto di questo.
  }
  const titolo = dati.titolo || 'Upcoming event'
  event.waitUntil(
    self.registration.showNotification(titolo, {
      body: dati.corpo || '',
      tag: dati.tag || 'smartcal',
      renotify: false,
      icon: '/icona-192.png',
      badge: '/favicon-32.png',
      data: { url: dati.url || '/#/calendar' },
    }),
  )
})

// Toccare la notifica porta all'app: se c'e' gia' una finestra aperta si
// riusa quella invece di aprirne una seconda.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destinazione = (event.notification.data && event.notification.data.url) || '/#/calendar'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      for (const f of finestre) {
        if (f.url.includes(self.location.origin) && 'focus' in f) {
          // Un link a una riunione esterna si apre a parte, il resto dentro l'app.
          if (destinazione.startsWith('http') && !destinazione.startsWith(self.location.origin)) {
            return self.clients.openWindow(destinazione)
          }
          f.navigate(destinazione).catch(() => {})
          return f.focus()
        }
      }
      return self.clients.openWindow(destinazione)
    }),
  )
})
