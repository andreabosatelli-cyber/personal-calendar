import { DateTime } from 'luxon'
import type { Evento, Origine } from './types'
import { LOCALE, etichettaRif, fusoRif, ufficioFine, ufficioInizio, vaInFascia } from './tempo'
import { ORIGINI } from './stato'
import type { Periodo } from './statistiche'

// Analytics — tutte le funzioni qui sono pure e lavorano sugli eventi già
// caricati: la pagina fa una query sola (hook useDatiAnalytics). Le ore sono
// sempre RITAGLIATE sul secchio di cui si parla, così una call che scavalca la
// mezzanotte non finisce tutta nel giorno in cui è iniziata.

const ORA_MS = 3_600_000

// La query per sovrapposizione può restituire lo stesso evento due volte, e le
// richieste non ancora approvate non sono impegni: non contano da nessuna parte.
function contabili(eventi: Evento[]): Evento[] {
  const visti = new Set<string>()
  return eventi.filter((ev) => {
    if (visti.has(ev.id) || ev.stato === 'in_attesa') return false
    visti.add(ev.id)
    return true
  })
}

const oreVuote = (): Record<Origine, number> => ({ lavoro: 0, universita: 0, personale: 0, viaggi: 0 })

export interface Barra {
  chiave: string
  etichetta: string // asse x, corta
  etichettaLunga: string // tooltip
  ore: Record<Origine, number>
  totale: number
  corrente: boolean // il secchio in cui cade oggi
}

// Estremi del periodo come DateTime nel fuso corrente (intervalloPeriodo in
// statistiche.ts torna stringhe UTC, qui servono per iterare le giornate).
export function estremiPeriodo(p: Periodo, ancora: string, fuso: string): { da: DateTime; a: DateTime } {
  const d = DateTime.fromISO(ancora, { zone: fuso }).setLocale(LOCALE)
  const u = p === 'week' ? 'week' : p === 'month' ? 'month' : 'year'
  return { da: d.startOf(u), a: d.endOf(u) }
}

// Una barra per ogni giornata del periodo, con le ore spezzate per categoria.
export function serieGiornaliera(eventi: Evento[], da: DateTime, a: DateTime, oggi: string): Barra[] {
  // Pre-parsing in millisecondi: su un anno intero questo ciclo gira 365 volte
  // per evento, e costruire due DateTime ogni volta costerebbe caro.
  const grezzi = contabili(eventi)
    .filter((ev) => !vaInFascia(ev))
    .map((ev) => ({ origine: ev.origine, da: Date.parse(ev.inizio_utc), a: Date.parse(ev.fine_utc) }))

  const barre: Barra[] = []
  let cur = da.startOf('day')
  let guardia = 0
  while (cur < a && guardia++ < 400) {
    const prossimo = cur.plus({ days: 1 })
    const daMs = cur.toMillis()
    const aMs = prossimo.toMillis()
    const ore = oreVuote()
    let totale = 0
    for (const g of grezzi) {
      if (g.a <= daMs || g.da >= aMs) continue
      const h = (Math.min(g.a, aMs) - Math.max(g.da, daMs)) / ORA_MS
      if (h > 0) {
        ore[g.origine] += h
        totale += h
      }
    }
    const iso = cur.toISODate()!
    barre.push({
      chiave: iso,
      etichetta: cur.toFormat('d'),
      etichettaLunga: cur.toFormat('ccc d LLL'),
      ore,
      totale,
      corrente: iso === oggi,
    })
    cur = prossimo
  }
  return barre
}

// Serie del grafico "Hours over time": giorni per settimana e mese, mesi per
// l'anno (365 colonne non si leggerebbero).
export function timeline(giorni: Barra[], periodo: Periodo, oggi: string): Barra[] {
  if (periodo === 'week') {
    return giorni.map((b) => ({
      ...b,
      etichetta: DateTime.fromISO(b.chiave).setLocale(LOCALE).toFormat('ccc'),
    }))
  }
  if (periodo === 'month') return giorni

  const mesi = new Map<string, Barra>()
  for (const g of giorni) {
    const k = g.chiave.slice(0, 7)
    let b = mesi.get(k)
    if (!b) {
      const d = DateTime.fromISO(`${k}-01`).setLocale(LOCALE)
      b = {
        chiave: k,
        etichetta: d.toFormat('LLL'),
        etichettaLunga: d.toFormat('LLLL yyyy'),
        ore: oreVuote(),
        totale: 0,
        corrente: k === oggi.slice(0, 7),
      }
      mesi.set(k, b)
    }
    for (const o of ORIGINI) b.ore[o] += g.ore[o]
    b.totale += g.totale
  }
  return [...mesi.values()]
}

// Ore per giorno della settimana: dice qual è la giornata più carica.
export function perGiornoSettimana(giorni: Barra[]): Barra[] {
  const out: Barra[] = [1, 2, 3, 4, 5, 6, 7].map((w) => {
    const d = DateTime.fromObject({ weekday: w as 1 }).setLocale(LOCALE)
    return {
      chiave: String(w),
      etichetta: d.toFormat('ccc'),
      etichettaLunga: d.toFormat('cccc'),
      ore: oreVuote(),
      totale: 0,
      corrente: false,
    }
  })
  for (const g of giorni) {
    const b = out[DateTime.fromISO(g.chiave).weekday - 1]
    for (const o of ORIGINI) b.ore[o] += g.ore[o]
    b.totale += g.totale
  }
  return out
}

export function piuCarica(barre: Barra[]): Barra | null {
  const con = barre.filter((b) => b.totale > 0)
  if (!con.length) return null
  return con.reduce((x, y) => (y.totale > x.totale ? y : x))
}

// ── La giornata locale ───────────────────────────────────────────────────

// Ore occupate per ora del giorno nel fuso corrente. È la base della striscia
// 24h: mostra *quando* cadono gli impegni, non solo quanti sono.
export function caricoOrario(eventi: Evento[], fuso: string): number[] {
  const out: number[] = new Array(24).fill(0)
  for (const ev of contabili(eventi)) {
    if (vaInFascia(ev)) continue
    const fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(fuso)
    let cur = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso)
    let guardia = 0
    while (cur < fine && guardia++ < 24 * 14) {
      const bordo = cur.plus({ hours: 1 }).startOf('hour')
      const prossimo = bordo < fine ? bordo : fine
      out[cur.hour] += prossimo.diff(cur, 'hours').hours
      cur = prossimo
    }
  }
  return out
}

// Fascia in cui una giornata è "normale" sull'asse locale. Fuori di qui un
// impegno è una concessione al fuso italiano, ed è esattamente quello che
// questa pagina deve rendere visibile.
export const GIORNATA_INIZIO = 8
export const GIORNATA_FINE = 20
const NOTTE_DA = 22
const NOTTE_A = 7
// Ora in cui una giornata "gira": prima di questa si è ancora nella sera prima.
const ALBA = 4
const minutiDaAlba = (d: DateTime) => (d.hour * 60 + d.minute - ALBA * 60 + 1440) % 1440

export interface FuoriOrario {
  ore: number
  pct: number
  notte: number
  prima: Momento | null
  ultima: Momento | null
}
export interface Momento {
  locale: string
  riferimento: string
  giorno: string
}

export function fuoriOrario(eventi: Evento[], fuso: string): FuoriOrario {
  const carico = caricoOrario(eventi, fuso)
  const totale = carico.reduce((a, b) => a + b, 0)
  let ore = 0
  let notte = 0
  for (let h = 0; h < 24; h++) {
    if (h < GIORNATA_INIZIO || h >= GIORNATA_FINE) ore += carico[h]
    if (h >= NOTTE_DA || h < NOTTE_A) notte += carico[h]
  }

  // Primo inizio e ultima fine come ore di parete locali, non come istanti: la
  // domanda è "quanto presto mi tocca alzarmi", non "in che data". La giornata
  // però si conta dalle 04:00: una lezione delle 18:00 del fuso di riferimento
  // può cominciare a mezzanotte sull'asse locale, ed è la coda della sera prima.
  const momento = (d: DateTime): Momento => ({
    locale: d.toFormat('HH:mm'),
    riferimento: d.setZone(fusoRif() ?? fuso).toFormat('HH:mm'),
    giorno: d.setLocale(LOCALE).toFormat('ccc d LLL'),
  })
  let prima: Momento | null = null
  let ultima: Momento | null = null
  let minuMin = Infinity
  let minuMax = -Infinity
  for (const ev of contabili(eventi)) {
    if (vaInFascia(ev)) continue
    const i = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso)
    const f = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(fuso)
    const mi = minutiDaAlba(i)
    const mf = minutiDaAlba(f)
    if (mi < minuMin) {
      minuMin = mi
      prima = momento(i)
    }
    if (mf > minuMax) {
      minuMax = mf
      ultima = momento(f)
    }
  }

  return { ore, pct: totale > 0 ? (ore / totale) * 100 : 0, notte, prima, ultima }
}

// L'orario d'ufficio proiettato sull'asse locale, in ore decimali. Quando c'è
// un fuso di riferimento la finestra puo' cadere altrove nella giornata e
// scavalcare la mezzanotte (da Singapore, le 09–18 di Roma sono pomeriggio-
// sera): chi disegna la striscia deve saperlo, quindi torna anche `gira`.
export function bandaUfficio(ancora: string, fuso: string): { da: number; a: number; gira: boolean; testo: string } {
  const rif = fusoRif() ?? fuso
  const base = DateTime.fromISO(ancora, { zone: rif })
  const i = base.set({ hour: ufficioInizio(), minute: 0 })
  const f = base.set({ hour: ufficioFine(), minute: 0 })
  const iLoc = i.setZone(fuso)
  const fLoc = f.setZone(fuso)
  const da = iLoc.hour + iLoc.minute / 60
  const a = fLoc.hour + fLoc.minute / 60
  return {
    da,
    a,
    gira: a <= da,
    // Senza un secondo fuso la proiezione è l'identita': dire "le 09 sono le 09
    // qui" è rumore, quindi la frase resta l'orario e basta.
    testo:
      rif === fuso
        ? `Office hours ${i.toFormat('HH:mm')}–${f.toFormat('HH:mm')}`
        : `${etichettaRif()} ${i.toFormat('HH:mm')}–${f.toFormat('HH:mm')} is ${iLoc.toFormat('HH:mm')}–${fLoc.toFormat('HH:mm')} here`,
  }
}

// ── Conteggi ─────────────────────────────────────────────────────────────

export interface Contatori {
  riunioni: number
  lezioni: number
  personali: number
  giorniViaggio: number
}

// Giorni toccati da un evento di categoria viaggi. Gli eventi tutto-il-giorno
// vivono in date UTC (fine_utc è la mezzanotte ESCLUSIVA del giorno dopo),
// quelli con un orario si contano nella giornata locale in cui cadono.
function giorniDiViaggio(eventi: Evento[], fuso: string): Set<string> {
  const out = new Set<string>()
  for (const ev of eventi) {
    if (ev.origine !== 'viaggi') continue
    const zona = ev.tutto_il_giorno ? 'utc' : fuso
    const i = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(zona)
    const f = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(zona)
    let cur = i.startOf('day')
    out.add(cur.toISODate()!)
    let guardia = 0
    while (cur.plus({ days: 1 }) < f && guardia++ < 400) {
      cur = cur.plus({ days: 1 })
      out.add(cur.toISODate()!)
    }
  }
  return out
}

export function contatori(eventi: Evento[], da: DateTime, a: DateTime, fuso: string): Contatori {
  const evs = contabili(eventi)
  const conta = (o: Origine) => evs.filter((ev) => ev.origine === o && !vaInFascia(ev)).length
  const daISO = da.toISODate()!
  const aISO = a.toISODate()!
  const viaggio = [...giorniDiViaggio(evs, fuso)].filter((g) => g >= daISO && g <= aISO)
  return {
    riunioni: conta('lavoro'),
    lezioni: conta('universita'),
    personali: conta('personale'),
    giorniViaggio: viaggio.length,
  }
}

// Variazione rispetto allo stesso periodo precedente. `null` quando prima non
// c'era niente: "+100%" su una base di zero non direbbe nulla.
export function variazione(ora: number, prima: number): number | null {
  if (prima <= 0) return null
  return ((ora - prima) / prima) * 100
}

export const PERIODO_PRECEDENTE: Record<Periodo, string> = {
  week: 'vs last week',
  month: 'vs last month',
  year: 'vs last year',
}

// Confronto col periodo precedente in parole. Niente verde/rosso: essere piu'
// occupati non e' ne' un successo ne' un problema, e' solo un fatto.
export function notaVariazione(v: number | null, coda: string): string {
  // Con zero come base la percentuale non direbbe niente: si dice il fatto.
  if (v === null) return `nothing ${coda.replace(/^vs /, '')}`
  const n = Math.round(v)
  if (n === 0) return `same as ${coda.replace(/^vs /, '')}`
  return `${n > 0 ? '↑' : '↓'} ${Math.abs(n)}% ${coda}`
}
