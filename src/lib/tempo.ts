import { DateTime } from 'luxon'
import type { Evento, Origine } from './types'

// Lingua dell'interfaccia: la reference SmartCal è in inglese. en-US e non
// en-GB perché abbrevia i mesi a tre lettere come nello screenshot ("9 Sep",
// non "9 Sept"); l'ordine giorno/mese lo decidono i formati qui sotto.
export const LOCALE = 'en-US'

// Fuso storico di riferimento dell'owner: resta come default del suo account e
// come scorciatoia nell'elenco, non è più il secondo fuso di tutti.
export const FUSO_ROMA = 'Europe/Rome'

// Fuso primario di DEFAULT (l'asse su cui si legge la giornata). È dinamico a
// runtime: cambia quando l'utente viaggia. Le funzioni accettano `fuso` come
// parametro; questa costante è solo il fallback iniziale.
export const FUSO_PRINCIPALE = 'Asia/Singapore'

// ---------------------------------------------------------------------------
// Configurazione dell'utente corrente
// ---------------------------------------------------------------------------
// L'app è nata su un'agenda sola: Roma era cablata come secondo fuso e 9-18
// come orario d'ufficio. Da quando chiunque può registrarsi quelle sono scelte
// personali e vivono in `preferenze`. Qui c'è il loro specchio a runtime, che
// ProviderStato aggiorna al login e a ogni salvataggio: le funzioni pure di
// questo modulo (geometria della griglia, formati) non possono leggere un
// contesto React.
//
// `riferimento` a null = calendario mono-fuso: niente rail affiancato, niente
// fascia d'ufficio straniera, niente riconciliazione fra due orari.
export interface ConfigUtente {
  riferimento: string | null
  etichettaRiferimento: string
  ufficioInizio: number
  ufficioFine: number
  nomiCategorie: Partial<Record<Origine, string>>
}

let CFG: ConfigUtente = {
  riferimento: null,
  etichettaRiferimento: '',
  ufficioInizio: 9,
  ufficioFine: 18,
  nomiCategorie: {},
}

export function applicaConfig(c: Partial<ConfigUtente>): void {
  CFG = { ...CFG, ...c }
}

// Il fuso affiancato all'asse principale, o null se l'utente non ne vuole uno.
export const fusoRif = (): string | null => CFG.riferimento

// Come si chiama quel fuso a schermo ("Italy", "New York"...). Mai una stringa
// fissa nei componenti: è il nome che l'utente ha scelto.
export const etichettaRif = (): string =>
  CFG.etichettaRiferimento || (CFG.riferimento ? nomeDaFuso(CFG.riferimento) : '')

// Orario d'ufficio (fascia di sfondo), in ore di parete del fuso di riferimento.
export const ufficioInizio = (): number => CFG.ufficioInizio
export const ufficioFine = (): number => CFG.ufficioFine

// Il secondo fuso va mostrato? No se non c'è, e no se coincide con l'asse
// corrente (l'utente è "a casa": il rail affiancato ripeterebbe la stessa ora).
export function asseUnico(fuso: string): boolean {
  return !CFG.riferimento || CFG.riferimento === fuso
}

// ---------------------------------------------------------------------------
// Località
// ---------------------------------------------------------------------------
// Scorciatoie in cima al selettore; sotto c'è comunque l'elenco IANA completo,
// perché ora l'utente può stare ovunque.
export interface OpzioneFuso {
  id: string
  etichetta: string
  bandiera: string
  sigla: string // codice breve mostrato nell'header, es. "SGT"
}
export const FUSI: OpzioneFuso[] = [
  { id: 'Asia/Singapore', etichetta: 'Singapore', bandiera: '🇸🇬', sigla: 'SGT' },
  { id: 'Asia/Kuala_Lumpur', etichetta: 'Malaysia', bandiera: '🇲🇾', sigla: 'MYT' },
  { id: 'Asia/Bangkok', etichetta: 'Thailand', bandiera: '🇹🇭', sigla: 'ICT' },
  { id: 'Asia/Jakarta', etichetta: 'Indonesia', bandiera: '🇮🇩', sigla: 'WIB' },
  { id: 'Asia/Ho_Chi_Minh', etichetta: 'Vietnam', bandiera: '🇻🇳', sigla: 'ICT' },
  { id: FUSO_ROMA, etichetta: 'Italy', bandiera: '🇮🇹', sigla: 'CET' },
  { id: 'Europe/London', etichetta: 'United Kingdom', bandiera: '🇬🇧', sigla: 'GMT' },
  { id: 'Europe/Paris', etichetta: 'France', bandiera: '🇫🇷', sigla: 'CET' },
  { id: 'America/New_York', etichetta: 'New York', bandiera: '🇺🇸', sigla: 'ET' },
  { id: 'America/Los_Angeles', etichetta: 'Los Angeles', bandiera: '🇺🇸', sigla: 'PT' },
  { id: 'Asia/Dubai', etichetta: 'Dubai', bandiera: '🇦🇪', sigla: 'GST' },
  { id: 'Asia/Tokyo', etichetta: 'Tokyo', bandiera: '🇯🇵', sigla: 'JST' },
  { id: 'Australia/Sydney', etichetta: 'Sydney', bandiera: '🇦🇺', sigla: 'AET' },
]

// Nome leggibile per un IANA qualunque:
// "America/Argentina/Buenos_Aires" -> "Buenos Aires".
export function nomeDaFuso(id: string): string {
  const ultimo = id.split('/').pop() ?? id
  return ultimo.replace(/_/g, ' ')
}

// Tutti i fusi conosciuti dal browser, per il selettore con ricerca. Se
// `supportedValuesOf` non c'è (browser vecchi) restano le scorciatoie.
export function tuttiIFusi(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  try {
    return intl.supportedValuesOf?.('timeZone') ?? FUSI.map((f) => f.id)
  } catch {
    return FUSI.map((f) => f.id)
  }
}

// Il fuso del browser: il punto di partenza sensato per chi si registra ora.
export function fusoDelBrowser(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

// Sigla del fuso. Per le località note è scritta a mano (l'Italia alterna
// CET/CEST con l'ora legale, quindi si calcola); per le altre si usa l'offset,
// che è sempre vero e mai ambiguo.
export function siglaFuso(fuso: string): string {
  if (fuso === FUSO_ROMA) return DateTime.now().setZone(FUSO_ROMA).isInDST ? 'CEST' : 'CET'
  const nota = FUSI.find((f) => f.id === fuso)
  return nota ? nota.sigla : DateTime.now().setZone(fuso).toFormat('ZZZZ')
}

// Un fuso fuori dalle scorciatoie resta selezionabile: gli si costruisce
// un'opzione al volo invece di ricadere su Singapore.
export function opzioneFuso(id: string): OpzioneFuso {
  const nota = FUSI.find((f) => f.id === id)
  if (nota) return nota
  return { id, etichetta: nomeDaFuso(id), bandiera: '🌍', sigla: siglaFuso(id) }
}

// Offset UTC corrente della località, es. "UTC+8" / "UTC+2" (l'Italia cambia
// con l'ora legale, quindi si calcola invece di scriverlo a mano).
export function etichettaUtc(fuso: string): string {
  return `UTC${DateTime.now().setZone(fuso).toFormat('Z')}`
}

// (Il vecchio `inItalia` viveva qui: ora è `asseUnico`, in cima al file,
// perché la domanda non è più "sono in Italia?" ma "l'asse coincide col fuso
// di riferimento che questo utente ha scelto?".)

// Finestra dell'asse principale. Di norma parte dalle 06:00 (le ore di notte
// sono vuote e ruberebbero solo scroll), ma diventa 00:00 quando nel periodo
// visibile c'e' davvero qualcosa di notte — succede per esempio guardando da
// Roma le lezioni di Singapore, che a Roma cadono alle 02:30.
export const ORA_INIZIO = 6
export const ORA_INIZIO_NOTTE = 0
export const ORA_FINE = 24
export const ALTEZZA_ORA = 48
export const ALTEZZA_GRIGLIA = (ORA_FINE - ORA_INIZIO) * ALTEZZA_ORA
export const altezzaGriglia = (oraInizio: number = ORA_INIZIO) => (ORA_FINE - oraInizio) * ALTEZZA_ORA

// Passo dei selettori orario nei form: un quarto d'ora. Gli appuntamenti
// cadono sul quarto, e sceglierli da una lista di slot è molto più veloce che
// comporre l'orario al minuto in un picker nativo.
export const PASSO_MINUTI = 15

// "HH:mm" ⇄ minuti dalla mezzanotte, e gli slot selezionabili di una giornata.
export const minutiDa = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export const daMinuti = (tot: number) =>
  `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`

export function slotDelGiorno(): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += PASSO_MINUTI) out.push(daMinuti(m))
  return out
}

// "1h" · "1h 30m" · "45m". Sotto l'ora niente "0h".
export function formattaDurata(minuti: number): string {
  if (minuti <= 0) return ''
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

// L'orario d'ufficio (fascia di sfondo) è in `preferenze`: vedi
// ufficioInizio() / ufficioFine() in cima al file.

export function oggiISO(fuso: string = FUSO_PRINCIPALE): string {
  return DateTime.now().setZone(fuso).toISODate()!
}

export function spostaGiorno(giornoISO: string, delta: number, fuso: string = FUSO_PRINCIPALE): string {
  return DateTime.fromISO(giornoISO, { zone: fuso }).plus({ days: delta }).toISODate()!
}

// Intestazione del giorno (large title).
export function titoloGiorno(giornoISO: string, fuso: string = FUSO_PRINCIPALE): { grande: string; piccolo: string } {
  const d = DateTime.fromISO(giornoISO, { zone: fuso }).setLocale(LOCALE)
  return { grande: d.toFormat('cccc d LLLL'), piccolo: d.toFormat('yyyy') }
}

// y (px) sull'asse principale per un dato istante, relativo all'inizio finestra.
export function yDaIstante(
  istanteUTC: string,
  giornoISO: string,
  fuso: string = FUSO_PRINCIPALE,
  oraInizio: number = ORA_INIZIO,
): number {
  const loc = DateTime.fromISO(istanteUTC, { zone: 'utc' }).setZone(fuso)
  const base = DateTime.fromISO(giornoISO, { zone: fuso }).set({ hour: oraInizio })
  const minuti = loc.diff(base, 'minutes').minutes
  return (minuti / 60) * ALTEZZA_ORA
}

// y per un'ora di parete del fuso di riferimento nel giorno visualizzato (per
// la fascia d'ufficio). Senza fuso di riferimento l'ora è già quella dell'asse.
export function yDaOraRiferimento(
  giornoISO: string,
  oraRif: number,
  fuso: string = FUSO_PRINCIPALE,
  oraInizio: number = ORA_INIZIO,
): number {
  const istante = DateTime.fromISO(giornoISO, { zone: fusoRif() ?? fuso }).set({ hour: oraRif, minute: 0 })
  return yDaIstante(istante.toUTC().toISO()!, giornoISO, fuso, oraInizio)
}

// Serve aprire la finestra fino a mezzanotte? Vero se almeno un impegno del
// periodo visibile occupa la fascia [00:00, 06:00) della sua giornata.
export function serveFasciaNotturna(
  perGiorno: Record<string, Evento[]>,
  giorni: string[],
  fuso: string = FUSO_PRINCIPALE,
): boolean {
  for (const g of giorni) {
    for (const ev of perGiorno[g] ?? []) {
      if (vaInFascia(ev)) continue
      const top = yDaIstante(ev.inizio_utc, g, fuso)
      const bottom = yDaIstante(ev.fine_utc, g, fuso)
      // Inizia prima delle 06:00 e finisce dopo la mezzanotte di quel giorno.
      if (top < 0 && bottom > -ORA_INIZIO * ALTEZZA_ORA) return true
    }
  }
  return false
}

// Etichetta oraria: ora primaria (fuso corrente) e la corrispondente ora nel
// fuso di riferimento dell'utente. Sulla pagina condivisa il riferimento è
// quello del proprietario del calendario, quindi resta un parametro.
export function etichetteOra(
  giornoISO: string,
  ora: number,
  fuso: string = FUSO_PRINCIPALE,
  zonaRif: string = fusoRif() ?? fuso,
): { locale: string; riferimento: string } {
  const loc = DateTime.fromISO(giornoISO, { zone: fuso }).set({ hour: ora % 24, minute: 0 })
  const rif = loc.setZone(zonaRif)
  return { locale: loc.toFormat('HH:mm'), riferimento: rif.toFormat('HH:mm') }
}

// Offset breve di un fuso, es. "GMT+8" (per etichettare fusi arbitrari).
export function offsetBreve(fuso: string): string {
  return DateTime.now().setZone(fuso).toFormat('ZZZZ')
}

// Fuso in cui leggere le DATE di un evento. Non e' quello di visualizzazione:
// e' quello in cui l'orario e' ancorato, cioe' quello in cui l'utente ha
// scritto i campi Start date / End date. Gli eventi tutto-il-giorno sono
// ancorati a UTC per costruzione (mezzanotte UTC del primo giorno).
function zonaAncoraggio(ev: Evento): string {
  return ev.tutto_il_giorno ? 'utc' : ev.fuso_origine || FUSO_PRINCIPALE
}

// Primo e ultimo giorno INCLUSI coperti da un evento, nel suo fuso di
// ancoraggio. Per i tutto-il-giorno `fine_utc` e' la mezzanotte ESCLUSIVA del
// giorno dopo l'ultimo; per gli altri una fine a mezzanotte esatta appartiene
// alla sera prima (22:00–00:00 e' una serata, non due giorni).
export function giorniEstremi(ev: Evento): { primo: string; ultimo: string } {
  const z = zonaAncoraggio(ev)
  const inizio = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(z)
  let fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(z)
  if (+fine === +fine.startOf('day')) fine = fine.minus({ minutes: 1 })
  const primo = inizio.toISODate()!
  const ultimo = fine.toISODate()!
  return { primo, ultimo: ultimo < primo ? primo : ultimo }
}

// L'evento copre piu' di una giornata? (Nel form: End date > Start date.)
// Si legge nel fuso di ancoraggio e non in quello di visualizzazione: una
// lezione di Singapore delle 06:30 guardata da Roma cade a cavallo della
// mezzanotte, ma resta un evento di un giorno solo.
export function eMultiGiorno(ev: Evento): boolean {
  const { primo, ultimo } = giorniEstremi(ev)
  return ultimo > primo
}

// Va nella fascia in cima come barra continua invece che nella griglia oraria.
// Tutto-il-giorno e multi-giorno si rendono allo stesso modo: dicono "dove
// sono / cosa dura in questi giorni", non "a che ora".
export function vaInFascia(ev: Evento): boolean {
  return ev.tutto_il_giorno || eMultiGiorno(ev)
}

// Un evento appartiene alla giornata visualizzata (nel fuso corrente)?
export function eventoNelGiorno(ev: Evento, giornoISO: string, fuso: string = FUSO_PRINCIPALE): boolean {
  if (ev.tutto_il_giorno) {
    const { primo, ultimo } = giorniEstremi(ev)
    return giornoISO >= primo && giornoISO <= ultimo
  }
  const inizio = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso)
  const fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' }).setZone(fuso)
  const giornoInizio = DateTime.fromISO(giornoISO, { zone: fuso }).startOf('day')
  const giornoFine = giornoInizio.plus({ days: 1 })
  return inizio < giornoFine && fine > giornoInizio
}

// Orario formattato di un evento: asse corrente + fuso di riferimento. Senza
// riferimento i due valori coincidono e chi chiama mostra solo il primo.
export function orarioEvento(
  ev: Evento,
  fuso: string = FUSO_PRINCIPALE,
): { principale: string; riferimento: string } {
  const i = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' })
  const f = DateTime.fromISO(ev.fine_utc, { zone: 'utc' })
  const fmt = (d: DateTime, zona: string) => d.setZone(zona).toFormat('HH:mm')
  const rif = fusoRif() ?? fuso
  return {
    principale: `${fmt(i, fuso)}–${fmt(f, fuso)}`,
    riferimento: `${fmt(i, rif)}–${fmt(f, rif)}`,
  }
}

// Durata in ore di un evento (per il riepilogo settimanale).
export function durataOre(ev: Evento): number {
  const i = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' })
  const f = DateTime.fromISO(ev.fine_utc, { zone: 'utc' })
  return Math.max(0, f.diff(i, 'hours').hours)
}

// Colori per categoria — palette SmartCal (vedi index.css).
// `punto` è il pallino/accento pieno, `sfondo`+`testo` il blocco evento.
export const COLORI_ORIGINE: Record<Evento['origine'], { punto: string; sfondo: string; testo: string; bordo: string }> = {
  lavoro: { punto: 'var(--cat-lavoro)', sfondo: 'var(--cat-lavoro-bg)', testo: 'var(--cat-lavoro-fg)', bordo: 'var(--cat-lavoro)' },
  universita: { punto: 'var(--cat-universita)', sfondo: 'var(--cat-universita-bg)', testo: 'var(--cat-universita-fg)', bordo: 'var(--cat-universita)' },
  personale: { punto: 'var(--cat-personale)', sfondo: 'var(--cat-personale-bg)', testo: 'var(--cat-personale-fg)', bordo: 'var(--cat-personale)' },
  viaggi: { punto: 'var(--cat-viaggi)', sfondo: 'var(--cat-viaggi-bg)', testo: 'var(--cat-viaggi-fg)', bordo: 'var(--cat-viaggi)' },
}

// Palette dei calendari condivisi: un colore per persona, assegnato
// dall'ordine della lista (indice) e stabile finche' la lista non cambia.
// Sono fuori dalla scala delle categorie di proposito: di un evento di
// qualcun altro conta prima di CHI e', non che categoria gli ha dato lui.
export const COLORI_CONDIVISI: { punto: string; sfondo: string; testo: string; bordo: string }[] = [1, 2, 3, 4].map(
  (n) => ({
    punto: `var(--cond-${n})`,
    sfondo: `var(--cond-${n}-bg)`,
    testo: `var(--cond-${n}-fg)`,
    bordo: `var(--cond-${n})`,
  }),
)

// Colore con cui disegnare un evento: la sua categoria se e' mio, il colore
// della persona se arriva da un calendario condiviso.
export function coloreEvento(ev: Evento) {
  if (!ev.condiviso) return COLORI_ORIGINE[ev.origine]
  return COLORI_CONDIVISI[ev.condiviso.indice % COLORI_CONDIVISI.length]
}

// Un viaggio tutto-il-giorno non e' un impegno: e' "dove sono" in quei giorni.
// Si rende come una fascia continua col nome del posto, non come un blocco.
export const eSoggiorno = (ev: Evento) => ev.origine === 'viaggi' && vaInFascia(ev)
export const etichettaEvento = (ev: Evento) => ev.titolo

// Le quattro categorie restano quelle: cambia come si chiamano a schermo.
// Chi si registra ora non fa l'università per forza, e può rinominare lo slot
// in "Gym" dalle impostazioni; questi sono i nomi di partenza.
const NOMI_BASE: Record<Origine, string> = {
  lavoro: 'Work',
  universita: 'University',
  personale: 'Personal',
  viaggi: 'Travel',
}
// Nome corto per grafici e legende: nella reference la legenda del donut dice
// "Study" dove la sidebar dice "University".
const BREVI_BASE: Record<Origine, string> = {
  lavoro: 'Work',
  universita: 'Study',
  personale: 'Personal',
  viaggi: 'Travel',
}
// Etichetta usata nei riepiloghi a conteggio ("5 classes").
const PLURALI_BASE: Record<Origine, string> = {
  lavoro: 'work events',
  universita: 'classes',
  personale: 'personal',
  viaggi: 'trips',
}

// Nome scelto dall'utente, altrimenti quello di partenza.
export function nomeOrigine(o: Origine): string {
  return CFG.nomiCategorie[o]?.trim() || NOMI_BASE[o]
}

// Un nome personalizzato vale per tutte e tre le forme: "Gym" in sidebar non
// può diventare "classes" nel riepilogo. Le varianti brevi e plurali restano
// solo per gli slot lasciati col nome di fabbrica.
export function nomeBreve(o: Origine): string {
  return CFG.nomiCategorie[o]?.trim() || BREVI_BASE[o]
}
export function nomePlurale(o: Origine): string {
  return CFG.nomiCategorie[o]?.trim()?.toLowerCase() || PLURALI_BASE[o]
}

// Nomi di fabbrica, per i placeholder del form di rinomina.
export const nomeDiFabbrica = (o: Origine): string => NOMI_BASE[o]
