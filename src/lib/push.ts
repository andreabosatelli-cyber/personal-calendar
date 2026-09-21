import { supabase } from './supabase'

// Promemoria prima degli eventi, via Web Push (0010_promemoria.sql).
//
// La sottoscrizione e' PER DISPOSITIVO, non per account: l'endpoint che il push
// service restituisce identifica quel browser su quel telefono. Lo stesso
// account che apre l'app dal portatile e dal telefono ha due righe, e riceve
// l'avviso su entrambi.

// Chiave pubblica VAPID. Sta nel codice di proposito: e' l'unica meta' della
// coppia che il browser deve conoscere, e finisce comunque dentro il bundle.
// La privata vive solo nei secret della Edge Function.
const VAPID_PUBBLICA = 'BC08AN3pRM0WpSa7IYhPFfEiTlFat0Vt5G1PU3_Kj_WapttHuT-GkSwZjMsmn8CKA74HghkzOlICDl8Ph3MOBZo'

export const ANTICIPI = [5, 10, 15, 30, 60] as const

export function nomeAnticipo(min: number | null): string {
  if (min === null) return 'Off'
  if (min < 60) return `${min} min before`
  return min === 60 ? '1 hour before' : `${min / 60} hours before`
}

export function pushSupportato(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// iPhone e iPad: le notifiche web arrivano SOLO se l'app e' stata aggiunta alla
// schermata Home. Aperta come scheda in Safari il permesso non si puo' nemmeno
// chiedere. Non e' un limite nostro, e non c'e' codice che lo aggiri: l'unica
// cosa utile e' dirlo prima che l'utente provi e concluda che l'app e' rotta.
export function suIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS recente si presenta come Mac: lo tradisce il touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function installataSuHome(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Su iOS fuori dalla Home non ha senso nemmeno mostrare il pulsante.
export function pushDisponibileQui(): boolean {
  if (!pushSupportato()) return false
  if (suIOS() && !installataSuHome()) return false
  return true
}

export function permessoNotifiche(): NotificationPermission | null {
  return 'Notification' in window ? Notification.permission : null
}

function daBase64Url(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registrazione(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // `ready` aspetta che il service worker sia attivo: appena dopo il primo
  // caricamento puo' essere ancora in installazione, e sottoscriversi a un
  // worker non attivo fallisce.
  //
  // Con la corsa contro il timeout perche' `ready` NON rifiuta mai: se il
  // worker non si registra (installazione fallita, storage bloccato, dati del
  // sito ripuliti a meta') resta appesa per sempre, e il pulsante resterebbe su
  // "One moment..." senza dire niente a nessuno. Meglio un errore chiaro.
  const scadenza = new Promise<null>((risolvi) => setTimeout(() => risolvi(null), 10_000))
  return await Promise.race([navigator.serviceWorker.ready, scadenza])
}

// Stato dei pezzi che servono, per dire DOVE si rompe invece di un generico
// "non funziona". Lo legge la card in Settings.
export interface Diagnosi {
  supportato: boolean
  ios: boolean
  installata: boolean
  permesso: NotificationPermission | null
  serviceWorker: 'attivo' | 'in installazione' | 'assente'
  iscritto: boolean
}

export async function diagnosi(): Promise<Diagnosi> {
  let reg: ServiceWorkerRegistration | null = null
  let sub: PushSubscription | null = null
  if ('serviceWorker' in navigator) {
    reg = (await navigator.serviceWorker.getRegistration().catch(() => null)) ?? null
    if (reg) sub = await reg.pushManager.getSubscription().catch(() => null)
  }
  return {
    supportato: pushSupportato(),
    ios: suIOS(),
    installata: installataSuHome(),
    permesso: permessoNotifiche(),
    serviceWorker: reg ? (reg.active ? 'attivo' : 'in installazione') : 'assente',
    iscritto: !!sub,
  }
}

// Questo dispositivo e' gia' registrato?
export async function sottoscrizioneCorrente(): Promise<PushSubscription | null> {
  const reg = await registrazione()
  if (!reg) return null
  return await reg.pushManager.getSubscription()
}

// Stato reale di QUESTO dispositivo. Non basta chiedere al browser se ha una
// sottoscrizione: una push parte dal server, e se la riga non e' mai arrivata
// nel database il server non sa che questo telefono esiste. Le due meta'
// possono scollarsi (scrittura fallita, riga cancellata altrove), e allora la
// card direbbe "attive" mentre non arriva niente — che e' il modo peggiore di
// sbagliare, perche' nessuno va a cercare un guasto dove c'e' scritto tutto ok.
export type StatoIscrizione = 'attiva' | 'solo-browser' | 'assente'

export async function statoIscrizione(): Promise<StatoIscrizione> {
  const sub = await sottoscrizioneCorrente()
  if (!sub) return 'assente'
  const { data, error } = await supabase
    .from('push_sottoscrizioni')
    .select('id')
    .eq('endpoint', sub.endpoint)
    .maybeSingle()
  if (error) return 'solo-browser'
  return data ? 'attiva' : 'solo-browser'
}

// Chiede il permesso e registra il dispositivo. Torna il motivo del rifiuto,
// quando c'e', perche' "non funziona" da solo non aiuta nessuno.
export async function attivaPush(utenteId: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSupportato()) return { ok: false, motivo: 'This browser does not support notifications.' }
  if (suIOS() && !installataSuHome()) {
    return {
      ok: false,
      motivo: 'On iPhone and iPad, add SmartCal to the Home Screen first (Share → Add to Home Screen).',
    }
  }

  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') {
    return {
      ok: false,
      motivo:
        permesso === 'denied'
          ? 'Notifications are blocked for this site. Allow them in the browser settings, then try again.'
          : 'Permission was not granted.',
    }
  }

  const reg = await registrazione()
  if (!reg) {
    return {
      ok: false,
      motivo: 'The service worker did not start, so there is nothing to deliver the notification. Reload the page and try again.',
    }
  }

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Obbligatorio sui browser moderni: ogni push deve produrre una notifica
      // visibile. Niente push silenziose, ed e' giusto cosi'.
      userVisibleOnly: true,
      applicationServerKey: daBase64Url(VAPID_PUBBLICA) as BufferSource,
    }))

  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
    return { ok: false, motivo: 'The browser returned an incomplete subscription.' }
  }

  // Su endpoint, non su id: se lo stesso browser si registra di nuovo la riga
  // e' la stessa e va aggiornata, non duplicata.
  const { error } = await supabase.from('push_sottoscrizioni').upsert(
    {
      utente_id: utenteId,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      agente: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, motivo: error.message }
  return { ok: true }
}

// Toglie il dispositivo: prima dal browser, poi dal database. L'ordine conta —
// se cancellassimo solo la riga, il push service continuerebbe a considerare
// valida la sottoscrizione.
export async function disattivaPush(): Promise<void> {
  const sub = await sottoscrizioneCorrente()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_sottoscrizioni').delete().eq('endpoint', endpoint)
}
