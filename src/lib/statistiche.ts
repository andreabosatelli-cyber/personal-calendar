import { DateTime } from 'luxon'
import { supabase } from './supabase'
import type { Evento, Origine } from './types'
import { LOCALE, durataOre, vaInFascia } from './tempo'
import { ORIGINI } from './stato'

// Query per SOVRAPPOSIZIONE, non per contenimento: un soggiorno iniziato prima
// della finestra deve comunque comparire. Stesso criterio del calendario.
//
// L'utente e' un parametro obbligatorio, non un dettaglio: da quando esistono i
// calendari condivisi la RLS lascia passare anche gli eventi di chi mi ha dato
// accesso, e Analytics, Trips ed Export parlano delle MIE ore. Senza questo
// filtro i numeri conterebbero le giornate di qualcun altro.
export async function eventiTra(daUTC: string, aUTC: string, utenteId: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventi')
    .select('*')
    .eq('utente_id', utenteId)
    .lte('inizio_utc', aUTC)
    .gte('fine_utc', daUTC)
    .order('inizio_utc', { ascending: true })
  if (error) throw error
  return (data as Evento[]) ?? []
}

export interface Quota {
  origine: Origine
  n: number
  ore: number
  pct: number
}

export interface Distribuzione {
  totaleOre: number
  totaleEventi: number
  quote: Quota[]
}

// Ore e conteggi per categoria. Le richieste ancora da approvare non contano
// (non sono impegni), e gli eventi tutto-il-giorno contano come evento ma non
// come ore: un soggiorno di 5 giorni non è "120 ore di viaggio" — vale sia per
// i tutto-il-giorno sia per i multi-giorno con orari.
export function distribuzione(eventi: Evento[]): Distribuzione {
  const visti = new Set<string>()
  const m = new Map<Origine, { n: number; ore: number }>()
  for (const ev of eventi) {
    if (visti.has(ev.id) || ev.stato === 'in_attesa') continue
    visti.add(ev.id)
    const cur = m.get(ev.origine) ?? { n: 0, ore: 0 }
    cur.n++
    if (!vaInFascia(ev)) cur.ore += durataOre(ev)
    m.set(ev.origine, cur)
  }
  const totaleOre = [...m.values()].reduce((a, b) => a + b.ore, 0)
  const totaleEventi = [...m.values()].reduce((a, b) => a + b.n, 0)
  const quote = ORIGINI.filter((o) => m.has(o)).map((o) => {
    const v = m.get(o)!
    return { origine: o, n: v.n, ore: v.ore, pct: totaleOre > 0 ? (v.ore / totaleOre) * 100 : 0 }
  })
  return { totaleOre, totaleEventi, quote }
}

// Ore arrotondate come le mostra la reference: "26h", "7.5h".
export const fmtOre = (h: number) => (Math.abs(h - Math.round(h)) < 0.05 ? String(Math.round(h)) : h.toFixed(1))

// Percentuali intere che sommano esattamente a 100 (metodo del resto più
// grande): senza questo la legenda mostra 42+28+20+11 = 101.
export function percentualiIntere(quote: Quota[]): number[] {
  const grezze = quote.map((q) => q.pct)
  const basse = grezze.map(Math.floor)
  let resto = Math.round(grezze.reduce((a, b) => a + b, 0)) - basse.reduce((a, b) => a + b, 0)
  const ordine = grezze
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const out = [...basse]
  for (const { i } of ordine) {
    if (resto <= 0) break
    out[i]++
    resto--
  }
  return out
}

// ── Periodi ──────────────────────────────────────────────────────────────
export type Periodo = 'week' | 'month' | 'year'

export const NOME_PERIODO: Record<Periodo, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

export function intervalloPeriodo(p: Periodo, ancora: string, fuso: string): { da: string; a: string } {
  const d = DateTime.fromISO(ancora, { zone: fuso })
  const unita = p === 'week' ? 'week' : p === 'month' ? 'month' : 'year'
  return {
    da: d.startOf(unita).toUTC().toISO()!,
    a: d.endOf(unita).toUTC().toISO()!,
  }
}

export function etichettaPeriodo(p: Periodo, ancora: string, fuso: string): string {
  const d = DateTime.fromISO(ancora, { zone: fuso }).setLocale(LOCALE)
  if (p === 'week') {
    const a = d.startOf('week')
    const b = d.endOf('week')
    return `${a.toFormat('d LLL')} – ${b.toFormat('d LLL yyyy')}`
  }
  if (p === 'month') return d.toFormat('LLLL yyyy')
  return d.toFormat('yyyy')
}

// Sposta l'ancora di un periodo intero (usato dalle frecce di Analytics e per
// pescare il periodo precedente da confrontare).
export function spostaPeriodo(p: Periodo, ancora: string, delta: number, fuso: string): string {
  const d = DateTime.fromISO(ancora, { zone: fuso })
  const u = p === 'week' ? 'weeks' : p === 'month' ? 'months' : 'years'
  return d.plus({ [u]: delta }).toISODate()!
}
