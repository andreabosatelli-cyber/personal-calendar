import { supabase } from './supabase'

// Il collegamento a Google Calendar, visto dal client. Qui dentro non passa mai
// una credenziale: il refresh token vive solo nella tabella `google_account`,
// che non ha policy, e tutto quello che si puo' sapere arriva dalla RPC
// `google_stato` (0013_google_calendar.sql).

export interface StatoGoogle {
  collegato: boolean
  email_google: string | null
  // Il calendario dedicato che SmartCal si crea su Google. null finche' la
  // prima sincronizzazione non l'ha creato.
  calendario_id: string | null
  calendario_nome: string | null
  abilitato: boolean
  ultimo_sync: string | null
  ultimo_errore: string | null
  in_coda: number
}

const SCOLLEGATO: StatoGoogle = {
  collegato: false,
  email_google: null,
  calendario_id: null,
  calendario_nome: null,
  abilitato: false,
  ultimo_sync: null,
  ultimo_errore: null,
  in_coda: 0,
}

export async function statoGoogle(): Promise<StatoGoogle> {
  const { data, error } = await supabase.rpc('google_stato')
  if (error || !data || (data as StatoGoogle[]).length === 0) return SCOLLEGATO
  return (data as StatoGoogle[])[0]
}

// L'URL della Edge Function: si ricava da quella del progetto, cosi' non c'e'
// un secondo indirizzo da tenere allineato nelle variabili d'ambiente.
function urlFunzione(nome: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  return `${base}/functions/v1/${nome}`
}

// Manda l'utente da Google. Il biglietto lo emette il database per l'utente
// autenticato; la Edge Function lo spende quando il browser torna indietro.
export async function collegaGoogle(): Promise<void> {
  const { data, error } = await supabase.rpc('google_oauth_avvia', { p_ritorno: location.origin })
  if (error) throw error
  location.href = `${urlFunzione('google-oauth')}?avvia=${encodeURIComponent(data as string)}`
}

export async function scollegaGoogle(): Promise<void> {
  const { error } = await supabase.rpc('google_scollega')
  if (error) throw error
}

export async function attivaGoogle(abilitato: boolean): Promise<void> {
  const { error } = await supabase.rpc('google_attiva', { p_abilitato: abilitato })
  if (error) throw error
}

// Il travaso iniziale: mette in coda tutto quello che c'e' da oggi in avanti.
export async function backfillGoogle(): Promise<number> {
  const { data, error } = await supabase.rpc('google_backfill')
  if (error) throw error
  return (data as number) ?? 0
}

// Svuota la coda adesso. Il cron lo farebbe comunque entro un minuto: questa
// chiamata e' quello che rende la cosa istantanea dopo un salvataggio, ed e'
// per questo che chi la usa non aspetta il risultato.
export async function sincronizzaGoogle(): Promise<void> {
  await supabase.functions.invoke('google-sync', { method: 'POST' })
}
