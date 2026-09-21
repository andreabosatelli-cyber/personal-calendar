import { DateTime } from 'luxon'
import type { Evento } from './types'
import { FUSO_PRINCIPALE, LOCALE, giorniEstremi, vaInFascia } from './tempo'

// ── Mappa del mondo ──────────────────────────────────────────────────────
// public/mappa-mondo.png è una silhouette equirettangolare. Questi estremi
// sono stati ricavati provando la proiezione contro la silhouette stessa:
// 21 città su 22 cadono sulla terraferma.
export const MAPPA = { latAlto: 70, latBasso: -51, lonSx: -180, lonDx: 180, w: 290, h: 133 }

export function proietta(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon - MAPPA.lonSx) / (MAPPA.lonDx - MAPPA.lonSx)) * 100,
    y: ((MAPPA.latAlto - lat) / (MAPPA.latAlto - MAPPA.latBasso)) * 100,
  }
}

// ── Gazetteer ────────────────────────────────────────────────────────────
// Niente geocoding online: un elenco compatto dei posti che compaiono davvero
// nei viaggi (Italia + sud-est asiatico) più le grandi città. Una destinazione
// non riconosciuta resta comunque nell'elenco, semplicemente senza puntino.
export interface Luogo {
  lat: number
  lon: number
  paese: string
}

export const LUOGHI: Record<string, Luogo> = {
  singapore: { lat: 1.35, lon: 103.82, paese: 'Singapore' },
  milan: { lat: 45.46, lon: 9.19, paese: 'Italy' },
  milano: { lat: 45.46, lon: 9.19, paese: 'Italy' },
  rome: { lat: 41.9, lon: 12.5, paese: 'Italy' },
  roma: { lat: 41.9, lon: 12.5, paese: 'Italy' },
  turin: { lat: 45.07, lon: 7.69, paese: 'Italy' },
  torino: { lat: 45.07, lon: 7.69, paese: 'Italy' },
  bergamo: { lat: 45.7, lon: 9.67, paese: 'Italy' },
  venice: { lat: 45.44, lon: 12.32, paese: 'Italy' },
  venezia: { lat: 45.44, lon: 12.32, paese: 'Italy' },
  florence: { lat: 43.77, lon: 11.26, paese: 'Italy' },
  firenze: { lat: 43.77, lon: 11.26, paese: 'Italy' },
  naples: { lat: 40.85, lon: 14.27, paese: 'Italy' },
  napoli: { lat: 40.85, lon: 14.27, paese: 'Italy' },
  bologna: { lat: 44.49, lon: 11.34, paese: 'Italy' },
  parabiago: { lat: 45.56, lon: 8.95, paese: 'Italy' },
  bali: { lat: -8.41, lon: 115.19, paese: 'Indonesia' },
  jakarta: { lat: -6.2, lon: 106.85, paese: 'Indonesia' },
  bangkok: { lat: 13.75, lon: 100.5, paese: 'Thailand' },
  phuket: { lat: 7.88, lon: 98.39, paese: 'Thailand' },
  'chiang mai': { lat: 18.79, lon: 98.98, paese: 'Thailand' },
  'kuala lumpur': { lat: 3.14, lon: 101.69, paese: 'Malaysia' },
  penang: { lat: 5.41, lon: 100.33, paese: 'Malaysia' },
  langkawi: { lat: 6.35, lon: 99.8, paese: 'Malaysia' },
  'ho chi minh': { lat: 10.82, lon: 106.63, paese: 'Vietnam' },
  hanoi: { lat: 21.03, lon: 105.85, paese: 'Vietnam' },
  'da nang': { lat: 16.05, lon: 108.2, paese: 'Vietnam' },
  'hong kong': { lat: 22.32, lon: 114.17, paese: 'Hong Kong' },
  tokyo: { lat: 35.68, lon: 139.69, paese: 'Japan' },
  osaka: { lat: 34.69, lon: 135.5, paese: 'Japan' },
  seoul: { lat: 37.57, lon: 126.98, paese: 'South Korea' },
  shanghai: { lat: 31.23, lon: 121.47, paese: 'China' },
  beijing: { lat: 39.9, lon: 116.41, paese: 'China' },
  dubai: { lat: 25.2, lon: 55.27, paese: 'UAE' },
  doha: { lat: 25.29, lon: 51.53, paese: 'Qatar' },
  istanbul: { lat: 41.01, lon: 28.98, paese: 'Türkiye' },
  london: { lat: 51.51, lon: -0.13, paese: 'United Kingdom' },
  londra: { lat: 51.51, lon: -0.13, paese: 'United Kingdom' },
  paris: { lat: 48.86, lon: 2.35, paese: 'France' },
  parigi: { lat: 48.86, lon: 2.35, paese: 'France' },
  amsterdam: { lat: 52.37, lon: 4.9, paese: 'Netherlands' },
  berlin: { lat: 52.52, lon: 13.4, paese: 'Germany' },
  madrid: { lat: 40.42, lon: -3.7, paese: 'Spain' },
  barcelona: { lat: 41.39, lon: 2.17, paese: 'Spain' },
  menorca: { lat: 39.95, lon: 4.11, paese: 'Spain' },
  minorca: { lat: 39.95, lon: 4.11, paese: 'Spain' },
  mallorca: { lat: 39.57, lon: 2.65, paese: 'Spain' },
  lisbon: { lat: 38.72, lon: -9.14, paese: 'Portugal' },
  zurich: { lat: 47.38, lon: 8.54, paese: 'Switzerland' },
  'new york': { lat: 40.71, lon: -74.01, paese: 'United States' },
  'san francisco': { lat: 37.77, lon: -122.42, paese: 'United States' },
  sydney: { lat: -33.87, lon: 151.21, paese: 'Australia' },
  melbourne: { lat: -37.81, lon: 144.96, paese: 'Australia' },
  maldives: { lat: 3.2, lon: 73.22, paese: 'Maldives' },
  maldive: { lat: 3.2, lon: 73.22, paese: 'Maldives' },
}

// Parole che in un titolo precedono la destinazione ma non ne fanno parte.
const RUMORE = /\b(trip|travel|flight|volo|viaggio|to|in|a|verso|from|da|hotel|holiday|vacanza|business)\b/gi

// Riconosce il luogo dentro un titolo libero ("Trip to Bali" → Bali).
export function riconosciLuogo(titolo: string): { chiave: string; nome: string; luogo: Luogo } | null {
  const t = titolo.toLowerCase()
  // Prima le chiavi più lunghe, così "kuala lumpur" batte "kuala".
  const chiavi = Object.keys(LUOGHI).sort((a, b) => b.length - a.length)
  for (const k of chiavi) {
    if (t.includes(k)) {
      return { chiave: k, nome: k.replace(/\b\w/g, (c) => c.toUpperCase()), luogo: LUOGHI[k] }
    }
  }
  return null
}

// Etichetta della destinazione: "Milan, Italy" se riconosciuta, altrimenti il
// titolo ripulito dalle parole di servizio.
export function etichettaDestinazione(titolo: string): string {
  const r = riconosciLuogo(titolo)
  if (r) return `${r.nome}, ${r.luogo.paese}`
  const pulito = titolo.replace(RUMORE, ' ').replace(/\s+/g, ' ').trim()
  return pulito || titolo
}

// Dove si trova l'utente adesso, in base alla località scelta: è il punto da
// cui partono gli archi sulla mappa.
export const LUOGO_FUSO: Record<string, Luogo> = {
  'Asia/Singapore': LUOGHI.singapore,
  'Asia/Kuala_Lumpur': LUOGHI['kuala lumpur'],
  'Asia/Bangkok': LUOGHI.bangkok,
  'Asia/Jakarta': LUOGHI.jakarta,
  'Asia/Ho_Chi_Minh': LUOGHI['ho chi minh'],
  'Europe/Rome': LUOGHI.rome,
}

// ── Viaggi ricavati dagli eventi reali ───────────────────────────────────
export interface Viaggio {
  id: string
  titolo: string
  destinazione: string
  luogo: Luogo | null
  da: string // ISO date
  a: string // ISO date (ultimo giorno incluso)
  giorni: number
  eventi: Evento[] // voli, hotel e altri impegni dentro il soggiorno
}

// I soggiorni sono le tappe: i viaggi che coprono giornate intere, sia quelli
// tutto-il-giorno sia quelli con orari che vanno dal 5 al 10. Gli altri eventi
// della categoria viaggi — i voli — si agganciano alla tappa che li contiene.
export function ricavaViaggi(eventi: Evento[], fuso: string = FUSO_PRINCIPALE): Viaggio[] {
  const viaggi = eventi.filter((e) => e.origine === 'viaggi')
  const soggiorni = viaggi.filter(vaInFascia)
  const puntuali = viaggi.filter((e) => !vaInFascia(e))

  const out: Viaggio[] = soggiorni.map((ev) => {
    const { primo: da, ultimo: fine } = giorniEstremi(ev)
    return {
      id: ev.id,
      titolo: ev.titolo,
      destinazione: etichettaDestinazione(ev.titolo),
      luogo: riconosciLuogo(ev.titolo)?.luogo ?? null,
      da,
      a: fine,
      giorni: Math.round(DateTime.fromISO(fine).diff(DateTime.fromISO(da), 'days').days) + 1,
      eventi: [],
    }
  })

  // Il giorno di un volo e' quello LOCALE, non quello UTC: un decollo alle
  // 07:20 da Singapore cade alle 23:20 UTC del giorno prima, e agganciato alla
  // data UTC finiva fuori dal soggiorno diventando un viaggio a se'.
  const orfani: Evento[] = []
  for (const ev of puntuali) {
    const g = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso).toISODate()!
    const tappa = out.find((v) => g >= v.da && g <= v.a)
    if (tappa) tappa.eventi.push(ev)
    else orfani.push(ev)
  }
  // Un volo senza soggiorno attorno resta comunque un viaggio di un giorno.
  for (const ev of orfani) {
    const g = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso).toISODate()!
    out.push({
      id: ev.id,
      titolo: ev.titolo,
      destinazione: etichettaDestinazione(ev.titolo),
      luogo: riconosciLuogo(ev.titolo)?.luogo ?? null,
      da: g,
      a: g,
      giorni: 1,
      eventi: [ev],
    })
  }

  return out.sort((a, b) => a.da.localeCompare(b.da))
}

// "28 Sep – 2 Oct", o "20 Sep" se dura un giorno solo.
export function intervalloViaggio(v: Viaggio): string {
  const a = DateTime.fromISO(v.da).setLocale(LOCALE)
  const b = DateTime.fromISO(v.a).setLocale(LOCALE)
  if (v.da === v.a) return a.toFormat('d LLL')
  if (a.month === b.month) return `${a.toFormat('d')} – ${b.toFormat('d LLL')}`
  return `${a.toFormat('d LLL')} – ${b.toFormat('d LLL')}`
}
