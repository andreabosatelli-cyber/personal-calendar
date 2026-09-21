import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Stato di autenticazione dell'unico utente reale.
// Un solo utente: niente ruoli, niente multi-tenant (brief §3).

// La sessione che supabase-js tiene in localStorage (stessa `storageKey` del
// client). Serve solo come rete di sicurezza offline: l'access token dura
// un'ora e alla scadenza il client prova a rinnovarlo via rete — senza
// connessione il rinnovo fallisce e senza questo fallback finiremmo sulla
// schermata di login pur essendo loggati.
function sessioneSalvata(): Session | null {
  try {
    const raw = localStorage.getItem('personal-calendar-auth')
    if (!raw) return null
    const s = JSON.parse(raw) as Session | { currentSession?: Session }
    const sessione = 'access_token' in s ? s : s.currentSession
    return sessione?.access_token ? (sessione as Session) : null
  } catch {
    return null
  }
}

export function useSessione() {
  const [sessione, setSessione] = useState<Session | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSessione(data.session ?? (navigator.onLine ? null : sessioneSalvata()))
        setCaricamento(false)
      })
      .catch(() => {
        // Errore di rete al bootstrap: si riparte dalla sessione salvata.
        setSessione(sessioneSalvata())
        setCaricamento(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuova) => {
      setSessione(nuova)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return { sessione, caricamento }
}
