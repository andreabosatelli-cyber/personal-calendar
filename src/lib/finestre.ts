import { DateTime } from 'luxon'
import { supabase } from './supabase'

// Finestre di viaggio (0015): i periodi di 3+ giorni senza lezioni, con le
// proposte di destinazione. I giorni sono SEMPRE in ora di Singapore, dove
// stanno le lezioni: una finestra e' "sab 7 → lun 9", non un intervallo UTC.

export const FUSO_LEZIONI = 'Asia/Singapore'
// Fin dove guarda la sezione: il contratto Cove finisce il 2/03, la timeline
// arriva al 3/03 compreso.
export const FINE_CALCOLO = '2027-03-02'
export const FINE_TIMELINE = '2027-03-03'
export const MIN_GIORNI = 3
export const SETTIMANE_BANNER = 8
export const GIORNI_BADGE = 7

export type StatoFinestra = 'idea' | 'da_prenotare' | 'prenotato' | 'saltato'
export type Budget = 'ok' | 'stretto' | 'fuori' | 'misto'
export type Meteo = 'ottimo' | 'buono' | 'incerto' | 'sconsigliato'

export interface Finestra {
  id: string
  utente_id: string
  codice: string
  titolo: string | null
  inizio: string // YYYY-MM-DD, incluso
  fine: string // YYYY-MM-DD, incluso
  giorni: number
  ultima_lezione_prima: string | null
  prima_lezione_dopo: string | null
  deadline_prenotazione: string | null
  stato: StatoFinestra
  note: string | null
  manuale: boolean
  salta_lezioni: string[]
}

export interface Proposta {
  id: string
  window_id: string
  destinazione: string
  minuti_volo: number | null
  trasporto: string | null
  stagione: string | null
  meteo: Meteo | null
  budget: Budget | null
  eventi: string | null
  note: string | null
  consigliata: boolean
  sconsigliata: boolean
  ordine: number
}

export interface EventoViaggio {
  id: string
  titolo: string
  inizio: string
  fine: string
  luogo: string | null
  tipo: 'evento' | 'presenza'
}

export interface FinestraLibera {
  inizio: string
  fine: string
  giorni: number
  ultima_lezione_prima: string | null
  prima_lezione_dopo: string | null
}

export interface Lezione {
  id: string
  titolo: string
  inizio_utc: string
  fine_utc: string
}

export const ETICHETTA_STATO: Record<StatoFinestra, string> = {
  idea: 'Idea',
  da_prenotare: 'To book',
  prenotato: 'Booked',
  saltato: 'Skipped',
}

export const ETICHETTA_BUDGET: Record<Budget, string> = {
  ok: 'Within budget',
  stretto: 'Tight budget',
  fuori: 'Over budget',
  misto: 'Budget varies',
}

export const ETICHETTA_METEO: Record<Meteo, string> = {
  ottimo: 'Best season',
  buono: 'Good season',
  incerto: 'Mixed weather',
  sconsigliato: 'Bad season',
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const ms = (iso: string) => Date.parse(iso)

export const giornoDi = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' }).setZone(FUSO_LEZIONI).toISODate()!

export function sommaGiorni(giorno: string, n: number): string {
  return DateTime.fromISO(giorno).plus({ days: n }).toISODate()!
}

export function differenzaGiorni(da: string, a: string): number {
  return Math.round(DateTime.fromISO(a).diff(DateTime.fromISO(da), 'days').days)
}

// Tutti i giorni da `da` ad `a`, estremi compresi.
export function giorniFra(da: string, a: string): string[] {
  const out: string[] = []
  for (let g = da; g <= a; g = sommaGiorni(g, 1)) out.push(g)
  return out
}

// ---------------------------------------------------------------------------
// Scadenze: banner "Book now" e badge sulla voce Trips
// ---------------------------------------------------------------------------

const aperta = (f: Finestra) => f.stato === 'idea' || f.stato === 'da_prenotare'

// Giorni alla deadline: negativo = superata. null = nessuna deadline.
export function giorniAllaDeadline(f: Finestra, oggi: string): number | null {
  return f.deadline_prenotazione ? differenzaGiorni(oggi, f.deadline_prenotazione) : null
}

// Finestre da prenotare adesso: iniziano entro 8 settimane, oppure la data
// "prenotare entro" e' gia' passata. Solo quelle non ancora prenotate o saltate,
// e non ancora finite.
export function daPrenotareOra(finestre: Finestra[], oggi: string): Finestra[] {
  const limite = sommaGiorni(oggi, SETTIMANE_BANNER * 7)
  return finestre
    .filter((f) => aperta(f) && f.fine >= oggi)
    .filter((f) => f.inizio <= limite || (giorniAllaDeadline(f, oggi) ?? 1) < 0)
    .sort((a, b) => (a.deadline_prenotazione ?? a.inizio).localeCompare(b.deadline_prenotazione ?? b.inizio))
}

// Badge: deadline a meno di 7 giorni, o superata.
export function deadlineVicine(finestre: Finestra[], oggi: string): Finestra[] {
  return finestre.filter((f) => {
    const g = giorniAllaDeadline(f, oggi)
    return aperta(f) && f.fine >= oggi && g !== null && g < GIORNI_BADGE
  })
}

// "in 2 days", "today", "3 days overdue"
export function testoDeadline(f: Finestra, oggi: string): string | null {
  const g = giorniAllaDeadline(f, oggi)
  if (g === null) return null
  if (g === 0) return 'today'
  if (g === 1) return 'tomorrow'
  if (g > 1) return `in ${g} days`
  return g === -1 ? '1 day overdue' : `${-g} days overdue`
}

// ---------------------------------------------------------------------------
// Fasce di sfondo nel calendario: giorno → finestra
// ---------------------------------------------------------------------------

export function fascePerGiorno(finestre: Finestra[]): Record<string, Finestra> {
  const out: Record<string, Finestra> = {}
  for (const f of finestre) {
    if (f.stato === 'saltato') continue
    for (const g of giorniFra(f.inizio, f.fine)) out[g] = f
  }
  return out
}

// ---------------------------------------------------------------------------
// Confronto col planning: cosa e' cambiato fra le finestre salvate e quelle
// che risultano dalle lezioni di oggi. Non applica niente: propone.
// ---------------------------------------------------------------------------

export type Differenza =
  | { tipo: 'nuova'; chiave: string; libera: FinestraLibera }
  | { tipo: 'date'; chiave: string; finestra: Finestra; patch: PatchDate }
  | { tipo: 'lezioni'; chiave: string; finestra: Finestra; lezioni: Lezione[]; patch: PatchDate | null }

export type PatchDate = Pick<Finestra, 'inizio' | 'fine' | 'giorni' | 'ultima_lezione_prima' | 'prima_lezione_dopo'>

const stessoIstante = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && ms(a) === ms(b))

// Lezioni che cadono dentro una finestra e non erano previste: escluse quelle
// gia' note come confine (finiscono entro l'ultima lezione prima, o iniziano
// dalla prima lezione dopo) e quelle nei giorni che si e' deciso di saltare.
export function lezioniDentro(f: Finestra, lezioni: Lezione[]): Lezione[] {
  const da = DateTime.fromISO(f.inizio, { zone: FUSO_LEZIONI }).toMillis()
  const a = DateTime.fromISO(f.fine, { zone: FUSO_LEZIONI }).plus({ days: 1 }).toMillis()
  return lezioni.filter((l) => {
    const i = ms(l.inizio_utc)
    const fi = ms(l.fine_utc)
    if (!(i < a && fi > da)) return false
    if (f.ultima_lezione_prima && fi <= ms(f.ultima_lezione_prima)) return false
    if (f.prima_lezione_dopo && i >= ms(f.prima_lezione_dopo)) return false
    return !f.salta_lezioni.includes(giornoDi(l.inizio_utc))
  })
}

function patchDa(f: Finestra, inizio: FinestraLibera, fine: FinestraLibera): PatchDate {
  const p = {
    inizio: inizio.inizio,
    fine: fine.fine,
    ultima_lezione_prima: inizio.ultima_lezione_prima,
    prima_lezione_dopo: fine.prima_lezione_dopo,
  }
  // Se la finestra salvata non ha un confine (C1 finisce dove inizia C2),
  // quel lato resta com'era.
  if (!f.ultima_lezione_prima) {
    p.inizio = f.inizio
    p.ultima_lezione_prima = null
  }
  if (!f.prima_lezione_dopo) {
    p.fine = f.fine
    p.prima_lezione_dopo = null
  }
  return { ...p, giorni: differenzaGiorni(p.inizio, p.fine) + 1 }
}

// `libere` = buchi di almeno 1 giorno (la RPC con minimo 1): servono anche
// quelli corti per capire dove sono finite le finestre manuali.
export function confronta(
  finestre: Finestra[],
  libere: FinestraLibera[],
  lezioni: Lezione[],
  oggi: string,
): Differenza[] {
  // Senza lezioni non c'e' un planning da confrontare: un account che non
  // frequenta corsi avrebbe un'unica "finestra" lunga quanto tutto il periodo.
  if (!lezioni.length) return []
  const out: Differenza[] = []
  // Si confrontano solo finestre non ancora iniziate: quelle in corso o
  // passate non si ripianificano.
  const future = finestre.filter((f) => f.inizio > oggi && f.stato !== 'saltato')

  for (const f of future) {
    const dentro = lezioniDentro(f, lezioni)
    const contiene = (g: string) => libere.find((l) => l.inizio <= g && l.fine >= g)

    if (dentro.length) {
      // Proposta: restringere la finestra al buco libero piu' lungo che resta.
      let patch: PatchDate | null = null
      if (!f.manuale) {
        const migliore = libere
          .filter((l) => l.fine >= f.inizio && l.inizio <= f.fine)
          .sort((x, y) => y.giorni - x.giorni)[0]
        if (migliore) {
          const inizio = migliore.inizio < f.inizio && !f.ultima_lezione_prima ? f.inizio : migliore.inizio
          const fine = migliore.fine > f.fine && !f.prima_lezione_dopo ? f.fine : migliore.fine
          patch = {
            inizio,
            fine,
            giorni: differenzaGiorni(inizio, fine) + 1,
            ultima_lezione_prima: inizio === migliore.inizio ? migliore.ultima_lezione_prima : null,
            prima_lezione_dopo: fine === migliore.fine ? migliore.prima_lezione_dopo : null,
          }
        }
      }
      out.push({
        tipo: 'lezioni',
        chiave: `lezioni:${f.id}:${dentro.map((l) => l.id).join(',')}`,
        finestra: f,
        lezioni: dentro,
        patch,
      })
      continue
    }

    if (f.manuale) continue

    // Confini: la finestra deve iniziare e finire dove il planning apre e
    // chiude il buco. Se una lezione si e' spostata, i confini si muovono.
    const bInizio = contiene(f.inizio)
    const bFine = contiene(f.fine)
    if (!bInizio || !bFine) continue
    const patch = patchDa(f, bInizio, bFine)
    const cambiata =
      patch.inizio !== f.inizio ||
      patch.fine !== f.fine ||
      !stessoIstante(patch.ultima_lezione_prima, f.ultima_lezione_prima) ||
      !stessoIstante(patch.prima_lezione_dopo, f.prima_lezione_dopo)
    if (cambiata) {
      out.push({
        tipo: 'date',
        chiave: `date:${f.id}:${patch.inizio}:${patch.fine}:${patch.ultima_lezione_prima}:${patch.prima_lezione_dopo}`,
        finestra: f,
        patch,
      })
    }
  }

  // Buchi da 3+ giorni che nessuna finestra salvata copre (nemmeno una saltata:
  // una finestra scartata non deve tornare a ogni apertura).
  for (const l of libere) {
    if (l.giorni < MIN_GIORNI || l.fine < oggi) continue
    const coperto = finestre.some((f) => f.inizio <= l.fine && f.fine >= l.inizio)
    if (!coperto) out.push({ tipo: 'nuova', chiave: `nuova:${l.inizio}:${l.fine}`, libera: l })
  }

  return out
}

// Prossimo codice libero dopo quelli in uso: A…G ci sono, quindi H, I, …
export function prossimoCodice(finestre: Finestra[]): string {
  const usati = new Set(finestre.map((f) => f.codice))
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i)
    if (!usati.has(c)) return c
  }
  let n = 1
  while (usati.has(`W${n}`)) n++
  return `W${n}`
}

// ---------------------------------------------------------------------------
// Dati
// ---------------------------------------------------------------------------

export interface DatiFinestre {
  finestre: Finestra[]
  proposte: Proposta[]
  eventi: EventoViaggio[]
  libere: FinestraLibera[]
  lezioni: Lezione[]
}

export async function caricaFinestre(utenteId: string, oggi: string): Promise<DatiFinestre> {
  // Le lezioni si leggono da qualche giorno prima: una lezione di ieri decide
  // dove inizia il buco di oggi.
  const da = sommaGiorni(oggi, -14)
  const daMs = DateTime.fromISO(da, { zone: FUSO_LEZIONI }).toUTC().toISO()!
  const aMs = DateTime.fromISO(FINE_TIMELINE, { zone: FUSO_LEZIONI }).plus({ days: 1 }).toUTC().toISO()!

  const [w, p, e, l, r] = await Promise.all([
    supabase.from('travel_windows').select('*').eq('utente_id', utenteId).order('inizio'),
    supabase.from('travel_proposals').select('*').eq('utente_id', utenteId).order('ordine'),
    supabase.from('travel_events').select('*').eq('utente_id', utenteId).order('inizio'),
    supabase
      .from('eventi')
      .select('id, titolo, inizio_utc, fine_utc')
      .eq('utente_id', utenteId)
      .eq('origine', 'universita')
      .eq('tutto_il_giorno', false)
      .eq('stato', 'confermato')
      .lte('inizio_utc', aMs)
      .gte('fine_utc', daMs)
      .order('inizio_utc'),
    supabase.rpc('finestre_libere', { p_da: da, p_a: FINE_CALCOLO, p_minimo: 1 }),
  ])
  const errore = w.error ?? p.error ?? e.error ?? l.error ?? r.error
  if (errore) throw errore

  return {
    finestre: (w.data as Finestra[]) ?? [],
    proposte: (p.data as Proposta[]) ?? [],
    eventi: (e.data as EventoViaggio[]) ?? [],
    lezioni: (l.data as Lezione[]) ?? [],
    libere: (r.data as FinestraLibera[]) ?? [],
  }
}

export async function aggiornaFinestra(
  id: string,
  utenteId: string,
  patch: Partial<Pick<Finestra, 'stato' | 'note'>> | PatchDate,
): Promise<void> {
  const { error } = await supabase.from('travel_windows').update(patch).eq('id', id).eq('utente_id', utenteId)
  if (error) throw error
}

export async function creaFinestra(utenteId: string, codice: string, l: FinestraLibera): Promise<void> {
  const { error } = await supabase.from('travel_windows').insert({
    utente_id: utenteId,
    codice,
    inizio: l.inizio,
    fine: l.fine,
    giorni: l.giorni,
    ultima_lezione_prima: l.ultima_lezione_prima,
    prima_lezione_dopo: l.prima_lezione_dopo,
    stato: 'idea',
  })
  if (error) throw error
}
