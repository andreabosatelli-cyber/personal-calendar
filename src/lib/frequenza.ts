import { DateTime } from 'luxon'
import { FUSO_LEZIONI, type Finestra, type Lezione } from './finestre'

// Frequenza ICA: almeno il 90% delle ore di lezione, mese per mese, e per ogni
// corso al massimo il 10% di ore perse. Qui si calcola cosa costa un viaggio:
// quali lezioni con orario cadono dentro le sue date e come scendono le
// percentuali, sommando gli altri viaggi gia' decisi (Booked / To book e i
// viaggi in calendario). Le "Idea" non contano finche' restano idee.

export const SOGLIA_MESE = 0.9
export const SOGLIA_CORSO = 0.1

// Istanti in millisecondi, fine esclusa.
export interface Intervallo {
  da: number
  a: number
}

// Quello che serve di un evento viaggi per sapere quando si e' via.
export type PeriodoEvento = { id: string; inizio_utc: string; fine_utc: string; tutto_il_giorno: boolean }

const ms = (iso: string) => Date.parse(iso)
const inizioGiorno = (g: string) => DateTime.fromISO(g, { zone: FUSO_LEZIONI }).toMillis()
const ore = (l: Lezione) => (ms(l.fine_utc) - ms(l.inizio_utc)) / 3_600_000

// Una finestra copre i suoi giorni in ora di Singapore, ma non le lezioni che
// la delimitano: BKK parte ven 13/11 dopo l'ultima lezione delle 15:30, quindi
// quelle del mattino del 13 non si perdono.
export function intervalloFinestra(f: Finestra): Intervallo {
  let da = inizioGiorno(f.inizio)
  let a = DateTime.fromISO(f.fine, { zone: FUSO_LEZIONI }).plus({ days: 1 }).toMillis()
  if (f.ultima_lezione_prima) da = Math.max(da, ms(f.ultima_lezione_prima))
  if (f.prima_lezione_dopo) a = Math.min(a, ms(f.prima_lezione_dopo))
  return { da, a }
}

// Un evento con orario vale per i suoi istanti; uno tutto-il-giorno per le sue
// giornate (date UTC, vedi giorniEstremi in tempo.ts) lette in ora di Singapore.
export function intervalloEvento(ev: PeriodoEvento): Intervallo {
  if (!ev.tutto_il_giorno) return { da: ms(ev.inizio_utc), a: ms(ev.fine_utc) }
  const primo = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).toISODate()!
  const dopo = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).toISODate()!
  return { da: inizioGiorno(primo), a: Math.max(inizioGiorno(dopo), inizioGiorno(primo) + 86_400_000) }
}

export function lezioniIn(intervalli: Intervallo[], lezioni: Lezione[]): Lezione[] {
  return lezioni.filter((l) => {
    const i = ms(l.inizio_utc)
    const f = ms(l.fine_utc)
    return intervalli.some((iv) => i < iv.a && f > iv.da)
  })
}

// ---------------------------------------------------------------------------
// Impatto di un viaggio
// ---------------------------------------------------------------------------

export interface ImpattoMese {
  mese: string // YYYY-MM
  perse: number // ore perse nel mese, con gli altri viaggi decisi
  totali: number
  presenza: number // 0..1
  sotto: boolean
}

export interface ImpattoCorso {
  corso: string
  sigla: string
  perse: number
  totali: number
  quota: number // ore perse / ore del corso, 0..1
  sopra: boolean
}

export interface Impatto {
  lezioni: Lezione[] // perse da QUESTO viaggio
  ore: number
  mesi: ImpattoMese[] // solo i mesi toccati da questo viaggio
  corsi: ImpattoCorso[] // solo i corsi toccati da questo viaggio
  sotto90: boolean
  altriViaggi: boolean // le percentuali includono ore perse da altri viaggi
}

const meseDi = (l: Lezione) => DateTime.fromISO(l.inizio_utc, { zone: 'utc' }).setZone(FUSO_LEZIONI).toFormat('yyyy-MM')

const somma = (ls: Lezione[]) => ls.reduce((n, l) => n + ore(l), 0)

// `proprie` = lezioni di questo viaggio, `decise` = quelle gia' perse dagli
// altri viaggi decisi, `tutte` = tutte le lezioni (danno i totali).
export function impatto(proprie: Lezione[], decise: Lezione[], tutte: Lezione[]): Impatto {
  const ids = new Set(proprie.map((l) => l.id))
  const unione = [...proprie, ...decise.filter((l) => !ids.has(l.id))]
  const uniche = new Map(unione.map((l) => [l.id, l]))
  const perse = [...uniche.values()]

  const mesi = [...new Set(proprie.map(meseDi))].sort().map((mese) => {
    const totali = somma(tutte.filter((l) => meseDi(l) === mese))
    const p = somma(perse.filter((l) => meseDi(l) === mese))
    const presenza = totali ? (totali - p) / totali : 1
    return { mese, perse: p, totali, presenza, sotto: presenza < SOGLIA_MESE - 1e-9 }
  })

  const corsi = [...new Set(proprie.map((l) => l.titolo))].map((corso) => {
    const totali = somma(tutte.filter((l) => l.titolo === corso))
    const p = somma(perse.filter((l) => l.titolo === corso))
    const quota = totali ? p / totali : 0
    return { corso, sigla: sigla(corso), perse: p, totali, quota, sopra: quota > SOGLIA_CORSO + 1e-9 }
  })

  const ordinate = [...proprie].sort((a, b) => ms(a.inizio_utc) - ms(b.inizio_utc))
  return {
    lezioni: ordinate,
    ore: somma(proprie),
    mesi,
    corsi,
    sotto90: mesi.some((m) => m.sotto),
    altriViaggi: perse.length > proprie.length,
  }
}

// ---------------------------------------------------------------------------
// Testi
// ---------------------------------------------------------------------------

// "Sustainable Asset Management" → "SAM", "Data Analytics & Financial
// Modelling" → "DAFM". I titoli corti restano interi ("Ethics & ESG").
export function sigla(titolo: string): string {
  if (titolo.length <= 15) return titolo
  const parole = titolo.split(/[\s,/–—-]+/).filter((p) => p && p !== '&')
  return parole.map((p) => (/^[A-Z0-9&]{2,}$/.test(p) ? p : p[0].toUpperCase())).join('')
}

export const fmtOre = (h: number) => `${Math.round(h * 100) / 100}\u00a0h`
export const fmtPct = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`

const inSgt = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' }).setZone(FUSO_LEZIONI)

// "Mon 16/11 SAM 12:30-15:30, DAFM 15:30-18:30 · Tue 17/11 …"
export function testoLezioni(lezioni: Lezione[]): string {
  const perGiorno = new Map<string, Lezione[]>()
  for (const l of lezioni) {
    const g = inSgt(l.inizio_utc).toISODate()!
    perGiorno.set(g, [...(perGiorno.get(g) ?? []), l])
  }
  return [...perGiorno.entries()]
    .map(([g, ls]) => {
      const giorno = DateTime.fromISO(g).setLocale('en-US').toFormat('ccc d/MM')
      // Trattino e spazi indivisibili: "12:30-15:30" non si spezza a capo.
      const voci = ls.map(
        (l) => `${sigla(l.titolo)}\u00a0${inSgt(l.inizio_utc).toFormat('HH:mm')}\u2011${inSgt(l.fine_utc).toFormat('HH:mm')}`,
      )
      return `${giorno} ${voci.join(', ')}`
    })
    .join(' · ')
}

export const nomeMese = (mese: string) => DateTime.fromFormat(mese, 'yyyy-MM').setLocale('en-US').toFormat('LLLL')
