import { supabase } from './supabase'
import type { Evento } from './types'

// Calendari condivisi fra account (0009_condivisione_calendari.sql), da non
// confondere con il link pubblico di condivisione.ts: quello e' un token per
// chiunque lo riceva e mostra solo blocchi occupati, questo e' un permesso dato
// a una persona precisa, che entra con il suo account.

export type Permesso = 'occupato' | 'dettagli' | 'prenota'

export const PERMESSI: { id: Permesso; etichetta: string; spiegazione: string }[] = [
  { id: 'occupato', etichetta: 'Busy only', spiegazione: 'Sees when you are busy, never the titles.' },
  { id: 'dettagli', etichetta: 'Full details', spiegazione: 'Sees your events in full, read-only.' },
  { id: 'prenota', etichetta: 'Can book', spiegazione: 'Sees everything and can send you booking requests.' },
]

export const NOME_PERMESSO: Record<Permesso, string> = {
  occupato: 'Busy only',
  dettagli: 'Full details',
  prenota: 'Can book',
}

// Lato destinatario: un calendario che qualcun altro mi ha condiviso.
export interface CalendarioCondiviso {
  id: string
  proprietario_id: string
  nome: string
  email: string
  fuso: string
  permesso: Permesso
}

// Lato proprietario: un accesso che ho dato io.
export interface AccessoConcesso {
  id: string
  destinatario_email: string
  destinatario_id: string | null // null = invitato ma non ancora registrato
  permesso: Permesso
  creato_il: string
}

export async function calendariCondivisiConMe(): Promise<CalendarioCondiviso[]> {
  const { data, error } = await supabase.rpc('condivisi_con_me')
  if (error) return []
  return (data as CalendarioCondiviso[]) ?? []
}

// Il filtro su proprietario_id non e' ridondante: la policy di select mostra
// anche le condivisioni RICEVUTE, che qui non c'entrano nulla.
export async function accessiConcessi(utenteId: string): Promise<AccessoConcesso[]> {
  const { data, error } = await supabase
    .from('condivisioni')
    .select('id, destinatario_email, destinatario_id, permesso, creato_il')
    .eq('proprietario_id', utenteId)
    .order('creato_il', { ascending: true })
  if (error) throw error
  return (data as AccessoConcesso[]) ?? []
}

export async function cambiaPermesso(id: string, permesso: Permesso): Promise<void> {
  const { error } = await supabase.from('condivisioni').update({ permesso }).eq('id', id)
  if (error) throw error
}

// Invitare di nuovo la stessa email cambia il permesso: la RPC fa upsert.
export async function invitaAlCalendario(email: string, permesso: Permesso): Promise<void> {
  const { error } = await supabase.rpc('condivisione_invita', { p_email: email, p_permesso: permesso })
  if (error) throw new Error(error.message)
}

export async function revocaAccesso(id: string): Promise<void> {
  const { error } = await supabase.from('condivisioni').delete().eq('id', id)
  if (error) throw error
}

// Livello 'occupato': la tabella non e' leggibile, si passa dalla RPC che
// restituisce i soli istanti. Il risultato viene vestito da Evento perche' la
// griglia sa disegnare solo quelli — con un titolo neutro, che e' esattamente
// quanto questo livello concede di sapere.
export async function impegniOccupati(
  proprietarioId: string,
  daUTC: string,
  aUTC: string,
  fuso: string,
): Promise<Evento[]> {
  const { data, error } = await supabase.rpc('condiviso_impegni_utente', {
    p_proprietario: proprietarioId,
    p_da: daUTC,
    p_a: aUTC,
  })
  if (error) return []
  const righe = (data as { id: string; inizio_utc: string; fine_utc: string; tutto_il_giorno: boolean }[]) ?? []
  return righe.map((r) => ({
    id: r.id,
    utente_id: proprietarioId,
    origine: 'personale',
    titolo: 'Busy',
    descrizione: null,
    luogo: null,
    inizio_utc: r.inizio_utc,
    fine_utc: r.fine_utc,
    fuso_origine: fuso,
    tutto_il_giorno: r.tutto_il_giorno,
    id_esterno: null,
    stato: 'confermato',
    richiedente: null,
    link_video: null,
    creato_da: null,
    serie_id: null,
    creato_il: r.inizio_utc,
    aggiornato_il: r.inizio_utc,
  }))
}

// Richiesta di appuntamento su un calendario condiviso con permesso 'prenota'.
// Nasce 'in_attesa': finisce nella campanella del proprietario, che approva o
// rifiuta come per le richieste che arrivano dal link pubblico.
export async function prenotaSuCondiviso(
  proprietarioId: string,
  campi: {
    titolo: string
    descrizione: string | null
    luogo: string | null
    inizio_utc: string
    fine_utc: string
    fuso_origine: string
    link_video: string | null
  },
  nomeRichiedente: string,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('eventi').insert({
    ...campi,
    utente_id: proprietarioId,
    creato_da: u.user!.id,
    origine: 'personale',
    tutto_il_giorno: false,
    stato: 'in_attesa',
    richiedente: nomeRichiedente,
  })
  if (error) throw error
}
