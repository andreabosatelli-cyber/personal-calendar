import { supabase } from './supabase'

export interface BloccoOccupato {
  inizio_utc: string
  fine_utc: string
  tutto_il_giorno: boolean
}

// Owner: legge il proprio token di condivisione da preferenze.
export async function leggiToken(): Promise<string | null> {
  const { data } = await supabase.from('preferenze').select('token_condivisione').single()
  return (data?.token_condivisione as string | undefined) ?? null
}

export interface ProfiloCondiviso {
  nome: string
  fuso: string
  etichetta: string
}

// Pubblico: chi è il proprietario del calendario e su che fuso vive. Serve alla
// pagina di prenotazione per dire "le 15:00 per Sam a Lisbona" invece di un nome
// scritto nel codice. Non espone altro dell'account: né email né eventi.
export async function profiloCondiviso(token: string): Promise<ProfiloCondiviso | null> {
  const { data, error } = await supabase.rpc('condiviso_profilo', { p_token: token })
  if (error) return null
  return (data as ProfiloCondiviso[] | null)?.[0] ?? null
}

// Pubblico: orari occupati (senza dettagli) per un token, in un intervallo.
export async function impegniCondivisi(token: string, daUTC: string, aUTC: string): Promise<BloccoOccupato[]> {
  const { data, error } = await supabase.rpc('condiviso_impegni', { p_token: token, p_da: daUTC, p_a: aUTC })
  if (error) throw error
  return (data as BloccoOccupato[]) ?? []
}

// Pubblico: invia una richiesta di appuntamento (in attesa di approvazione).
export async function inviaRichiesta(token: string, nome: string, titolo: string, inizioUTC: string, fineUTC: string, link?: string): Promise<void> {
  const { error } = await supabase.rpc('condiviso_richiedi', {
    p_token: token,
    p_nome: nome,
    p_titolo: titolo,
    p_inizio: inizioUTC,
    p_fine: fineUTC,
    p_link: link?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

// Owner: approva / rifiuta una richiesta.
export async function approvaRichiesta(id: string): Promise<void> {
  const { error } = await supabase.from('eventi').update({ stato: 'confermato' }).eq('id', id)
  if (error) throw error
}
export async function rifiutaRichiesta(id: string): Promise<void> {
  const { error } = await supabase.from('eventi').delete().eq('id', id)
  if (error) throw error
}

// Il link pubblico vive sulla stessa origine dell'app: la pagina condivisa e'
// la stessa build, riconosciuta dal parametro ?condividi=.
export function linkCondivisione(token: string): string {
  return `${location.origin}/?condividi=${token}`
}
