import { DateTime } from 'luxon'
import { FUSO_PRINCIPALE, LOCALE } from './tempo'

export { LOCALE }

// Settimana ISO (lunedì → domenica) sull'asse primario (fuso corrente).
// luxon.startOf('week') è lunedì per default (ISO 8601).

export function inizioSettimana(giornoISO: string, fuso: string = FUSO_PRINCIPALE): string {
  return DateTime.fromISO(giornoISO, { zone: fuso }).startOf('week').toISODate()!
}

export function giorniSettimana(giornoISO: string, fuso: string = FUSO_PRINCIPALE): string[] {
  const start = DateTime.fromISO(giornoISO, { zone: fuso }).startOf('week')
  return Array.from({ length: 7 }, (_, i) => start.plus({ days: i }).toISODate()!)
}

export function spostaSettimana(giornoISO: string, delta: number, fuso: string = FUSO_PRINCIPALE): string {
  return DateTime.fromISO(giornoISO, { zone: fuso }).plus({ weeks: delta }).toISODate()!
}

// Etichetta compatta dell'intervallo settimana, es. "1 – 7 Sep" oppure
// "29 Sep – 5 Oct" quando cambia mese.
export function etichettaSettimana(giornoISO: string, fuso: string = FUSO_PRINCIPALE): string {
  const g = giorniSettimana(giornoISO, fuso)
  return intervalloBreve(g[0], g[6], fuso)
}

export function intervalloBreve(daISO: string, aISO: string, fuso: string = FUSO_PRINCIPALE): string {
  const a = DateTime.fromISO(daISO, { zone: fuso }).setLocale(LOCALE)
  const b = DateTime.fromISO(aISO, { zone: fuso }).setLocale(LOCALE)
  if (a.hasSame(b, 'day')) return a.toFormat('cccc d LLLL yyyy')
  if (a.month === b.month) return `${a.day} – ${b.day} ${b.toFormat('LLLL yyyy')}`
  if (a.year === b.year) return `${a.toFormat('d LLL')} – ${b.toFormat('d LLL yyyy')}`
  return `${a.toFormat('d LLL yyyy')} – ${b.toFormat('d LLL yyyy')}`
}

// ---- Viste ----
// Day / Week / Month, esattamente le tre del segmented control della reference.
export type Vista = 'giorno' | 'settimana' | 'mese'

export const VISTE: Vista[] = ['giorno', 'settimana', 'mese']

export const NOME_VISTA: Record<Vista, string> = {
  giorno: 'Day',
  settimana: 'Week',
  mese: 'Month',
}

// I giorni ISO visibili per una vista, a partire dall'ancora.
export function giorniVista(vista: Vista, ancora: string, fuso: string = FUSO_PRINCIPALE): string[] {
  const a = DateTime.fromISO(ancora, { zone: fuso })
  if (vista === 'giorno') return [a.toISODate()!]
  if (vista === 'settimana') return giorniSettimana(ancora, fuso)
  // mese: dal lunedì della settimana del 1° alla domenica della settimana dell'ultimo.
  const start = a.startOf('month').startOf('week')
  const end = a.endOf('month').endOf('week').startOf('day')
  const n = Math.round(end.diff(start, 'days').days) + 1
  return Array.from({ length: n }, (_, i) => start.plus({ days: i }).toISODate()!)
}

// Sposta l'ancora avanti/indietro dell'unità della vista.
export function spostaVista(vista: Vista, ancora: string, delta: number, fuso: string = FUSO_PRINCIPALE): string {
  const a = DateTime.fromISO(ancora, { zone: fuso })
  if (vista === 'giorno') return a.plus({ days: delta }).toISODate()!
  if (vista === 'settimana') return a.plus({ weeks: delta }).toISODate()!
  return a.plus({ months: delta }).toISODate()!
}

// Titolo dell'intervallo visibile — nella reference è "September 2026".
export function titoloVista(vista: Vista, ancora: string, fuso: string = FUSO_PRINCIPALE): string {
  const a = DateTime.fromISO(ancora, { zone: fuso }).setLocale(LOCALE)
  if (vista === 'mese') return a.toFormat('LLLL yyyy')
  if (vista === 'giorno') return a.toFormat('cccc d LLLL yyyy')
  const g = giorniVista(vista, ancora, fuso)
  return intervalloBreve(g[0], g[g.length - 1], fuso)
}

// Stessa informazione del titolo, in un terzo dei caratteri: su 390px
// "Saturday 19 September 2026" non entra e si tronca a metà parola.
// "Sat 19 Sep" · "14 – 20 Sep" · "Sep 2026".
export function titoloVistaBreve(vista: Vista, ancora: string, fuso: string = FUSO_PRINCIPALE): string {
  const a = DateTime.fromISO(ancora, { zone: fuso }).setLocale(LOCALE)
  if (vista === 'mese') return a.toFormat('LLL yyyy')
  if (vista === 'giorno') return a.toFormat('ccc d LLL')
  const g = giorniVista(vista, ancora, fuso)
  const b = DateTime.fromISO(g[g.length - 1], { zone: fuso }).setLocale(LOCALE)
  const i = DateTime.fromISO(g[0], { zone: fuso }).setLocale(LOCALE)
  if (i.month === b.month) return `${i.day} – ${b.toFormat('d LLL')}`
  return `${i.toFormat('d LLL')} – ${b.toFormat('d LLL')}`
}
