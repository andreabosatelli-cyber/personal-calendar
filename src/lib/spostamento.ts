import { DateTime } from 'luxon'
import { supabase } from './supabase'
import type { Evento } from './types'

// Spostare un evento trascinandolo: cambia QUANDO comincia, mai quanto dura.
// La durata si porta dietro i millisecondi esatti invece di essere ricalcolata
// da ore e minuti: un evento di 90 minuti resta di 90 minuti anche se lo si
// trascina oltre il cambio dell'ora legale, dove "le 10:00 piu' un'ora" e le
// "10:00 di domani" non sono piu' la stessa aritmetica.

// Un evento si puo' trascinare solo se e' roba nostra e modificabile: quelli
// importati dal feed sono di sola lettura, quelli di un calendario condiviso
// sono di qualcun altro, e una richiesta in attesa va prima approvata.
export function trascinabile(ev: Evento): boolean {
  return ev.id_esterno === null && !ev.condiviso && ev.stato !== 'in_attesa'
}

export interface Spostamento {
  inizio_utc: string
  fine_utc: string
}

// Nuovi istanti dopo uno spostamento di `minuti` e, se il giorno di arrivo e'
// diverso, di tanti giorni quanti ne separano le due date.
export function calcolaSpostamento(
  ev: Evento,
  minuti: number,
  giornoArrivo: string | null,
  giornoPartenza: string | null,
  fuso: string,
): Spostamento | null {
  const inizio = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso)
  const fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(fuso)
  const durataMs = fine.toMillis() - inizio.toMillis()

  let giorni = 0
  if (giornoArrivo && giornoPartenza && giornoArrivo !== giornoPartenza) {
    giorni = Math.round(
      DateTime.fromISO(giornoArrivo, { zone: fuso })
        .startOf('day')
        .diff(DateTime.fromISO(giornoPartenza, { zone: fuso }).startOf('day'), 'days').days,
    )
  }
  if (!giorni && !minuti) return null

  const nuovoInizio = inizio.plus({ days: giorni, minutes: minuti })
  return {
    inizio_utc: nuovoInizio.toUTC().toISO()!,
    fine_utc: nuovoInizio.plus({ milliseconds: durataMs }).toUTC().toISO()!,
  }
}

// Un evento tutto-il-giorno non ha un'ora da spostare: si muove di giornate
// intere, e i suoi istanti vivono in date UTC (vedi giorniEstremi in tempo.ts).
export function calcolaSpostamentoTuttoGiorno(
  ev: Evento,
  giornoArrivo: string | null,
  giornoPartenza: string | null,
): Spostamento | null {
  if (!giornoArrivo || !giornoPartenza || giornoArrivo === giornoPartenza) return null
  const giorni = Math.round(
    DateTime.fromISO(giornoArrivo, { zone: 'utc' }).diff(DateTime.fromISO(giornoPartenza, { zone: 'utc' }), 'days')
      .days,
  )
  if (!giorni) return null
  return {
    inizio_utc: DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).plus({ days: giorni }).toISO()!,
    fine_utc: DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).plus({ days: giorni }).toISO()!,
  }
}

export async function salvaSpostamento(id: string, s: Spostamento): Promise<void> {
  const { error } = await supabase.from('eventi').update(s).eq('id', id)
  if (error) throw error
}

// Trascinare un bordo cambia la durata, non la collocazione: l'altro estremo
// resta inchiodato dov'era. C'e' un pavimento di un quarto d'ora — sotto quello
// il blocco sparirebbe dalla griglia e non si potrebbe piu' riafferrare.
export const DURATA_MINIMA = 15

export function calcolaRidimensionamento(
  ev: Evento,
  minuti: number,
  bordo: 'inizio' | 'fine',
  fuso: string,
): Spostamento | null {
  const inizio = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso)
  const fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(fuso)

  if (bordo === 'fine') {
    const nuovaFine = fine.plus({ minutes: minuti })
    if (nuovaFine.diff(inizio, 'minutes').minutes < DURATA_MINIMA) return null
    return { inizio_utc: ev.inizio_utc, fine_utc: nuovaFine.toUTC().toISO()! }
  }

  const nuovoInizio = inizio.plus({ minutes: minuti })
  if (fine.diff(nuovoInizio, 'minutes').minutes < DURATA_MINIMA) return null
  return { inizio_utc: nuovoInizio.toUTC().toISO()!, fine_utc: ev.fine_utc }
}
