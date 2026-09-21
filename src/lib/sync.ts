import { supabase } from './supabase'

export interface EsitoSync {
  ok: boolean
  sorgenti: Record<string, { conteggio?: number; errore?: string; quando: string }>
}

// Invoca la Edge Function sync-calendari (full-replace della sorgente 'lavoro').
// Il JWT dell'utente viene aggiunto in automatico da functions.invoke.
export async function eseguiSync(): Promise<EsitoSync> {
  const { data, error } = await supabase.functions.invoke('sync-calendari', { method: 'POST' })
  if (error) {
    return { ok: false, sorgenti: { lavoro: { errore: error.message, quando: new Date().toISOString() } } }
  }
  return data as EsitoSync
}

// Legge lo stato dell'ultimo sync per la sorgente 'lavoro' da preferenze.
export async function leggiUltimoSync(): Promise<{ quando?: string; errore?: string; conteggio?: number } | null> {
  const { data } = await supabase.from('preferenze').select('ultimo_sync').single()
  const s = (data?.ultimo_sync as Record<string, { quando?: string; errore?: string; conteggio?: number }>) ?? {}
  return s.lavoro ?? null
}
