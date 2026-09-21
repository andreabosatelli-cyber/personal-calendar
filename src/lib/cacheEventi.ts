import type { Evento } from './types'

// Copia locale degli eventi già scaricati: è ciò che rende leggibile il
// calendario senza rete. Non è un database offline — è lo specchio dell'ultima
// lettura riuscita, con il timestamp per poterlo dire in chiaro nella UI.
// Le SCRITTURE restano online-only: qui non c'è nessuna coda di invio.
const CHIAVE = 'pc_eventi_cache'
const MAX = 2000 // tetto di sicurezza: oltre, si potano gli eventi più vecchi

interface Contenuto {
  salvatoIl: string
  eventi: Evento[]
}

// Gli istanti arrivano in formati diversi (Postgres "…+00:00", luxon "….000Z"):
// vanno confrontati come millisecondi, mai come stringhe.
const ms = (iso: string) => Date.parse(iso)

// Stesso criterio della query: l'evento tocca la finestra [dal, al]?
const sovrappone = (ev: Evento, dal: number, al: number) =>
  ms(ev.inizio_utc) <= al && ms(ev.fine_utc) >= dal

function leggi(): Contenuto {
  try {
    const raw = localStorage.getItem(CHIAVE)
    if (!raw) return { salvatoIl: '', eventi: [] }
    const c = JSON.parse(raw) as Contenuto
    return Array.isArray(c?.eventi) ? c : { salvatoIl: '', eventi: [] }
  } catch {
    return { salvatoIl: '', eventi: [] }
  }
}

// Quando è stata scritta l'ultima copia (ISO), o null se non c'è.
export function salvatoIl(): string | null {
  return leggi().salvatoIl || null
}

// Sostituisce in cache tutti gli eventi della finestra [da, a] con quelli
// appena letti dal server: così spariscono anche quelli cancellati, mentre le
// altre settimane già viste restano disponibili offline.
export function aggiornaCache(freschi: Evento[], da: string, a: string): void {
  const dal = ms(da)
  const al = ms(a)
  const fuoriFinestra = leggi().eventi.filter((ev) => !sovrappone(ev, dal, al))
  let uniti = [...fuoriFinestra, ...freschi]
  if (uniti.length > MAX) {
    uniti = uniti.sort((x, y) => ms(y.inizio_utc) - ms(x.inizio_utc)).slice(0, MAX)
  }
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ salvatoIl: new Date().toISOString(), eventi: uniti }))
  } catch {
    /* quota piena o storage negato: la cache è un di più, non un requisito */
  }
}

// Gli eventi in cache che toccano la finestra richiesta (stesso criterio di
// sovrapposizione della query al server, così offline e online coincidono).
export function eventiDaCache(da: string, a: string): Evento[] {
  const dal = ms(da)
  const al = ms(a)
  return leggi()
    .eventi.filter((ev) => sovrappone(ev, dal, al))
    .sort((x, y) => ms(x.inizio_utc) - ms(y.inizio_utc))
}

// Al logout la copia locale se ne va con la sessione.
export function svuotaCache(): void {
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    /* niente da fare */
  }
}
