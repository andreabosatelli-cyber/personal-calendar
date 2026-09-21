import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type { Evento, Origine, Preferenze } from './types'
import { oggiISO, opzioneFuso } from './tempo'
import { applicaPreferenze, caricaPreferenze, salvaPreferenze } from './preferenze'
import type { Vista } from './settimana'
import { leggiToken } from './condivisione'
import { calendariCondivisiConMe, type CalendarioCondiviso } from './condivisi'
import { eseguiSync, leggiUltimoSync } from './sync'

// Stato condiviso fra il guscio (sidebar, header) e le pagine: il fuso della
// località, i calendari spuntati in "My calendars", la vista del calendario e
// le richieste di appuntamento (che alimentano la campanella nell'header).

const CHIAVE_FUSO = 'pc_fuso'
const CHIAVE_VISTA = 'pc_vista'
const CHIAVE_CALENDARI = 'pc_calendari'
const CHIAVE_TEMA = 'pc_tema'
const CHIAVE_CONDIVISI = 'pc_condivisi'

export const ORIGINI: Origine[] = ['lavoro', 'universita', 'personale', 'viaggi']

function leggiCalendari(): Origine[] {
  try {
    const raw = localStorage.getItem(CHIAVE_CALENDARI)
    if (!raw) return ORIGINI
    const arr = JSON.parse(raw) as Origine[]
    return Array.isArray(arr) ? arr.filter((o) => ORIGINI.includes(o)) : ORIGINI
  } catch {
    return ORIGINI
  }
}

// Quali calendari condivisi sono spuntati, per id del proprietario. Di default
// nessuno: chi mi condivide il suo calendario me lo mette a disposizione, non
// me lo impone sopra al mio.
function leggiCondivisiAttivi(): string[] {
  try {
    const raw = localStorage.getItem(CHIAVE_CONDIVISI)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Le viste sono cambiate (via '3 giorni' rimossa): un valore vecchio in
// localStorage non deve rompere il calendario.
function leggiVista(): Vista {
  const v = localStorage.getItem(CHIAVE_VISTA)
  return v === 'giorno' || v === 'settimana' || v === 'mese' ? v : 'mese'
}

interface Stato {
  pref: Preferenze
  aggiornaPref: (patch: Partial<Preferenze>) => Promise<void>
  fuso: string
  cambiaFuso: (id: string) => void
  vista: Vista
  cambiaVista: (v: Vista) => void
  giorno: string
  setGiorno: (g: string) => void
  calendari: Origine[]
  toggleCalendario: (o: Origine) => void
  visibile: (ev: Evento) => boolean
  tema: 'light' | 'dark'
  toggleTema: () => void
  ricerca: string
  setRicerca: (s: string) => void
  richieste: Evento[]
  caricaRichieste: () => Promise<void>
  token: string | null
  // Calendari che altri hanno condiviso con me, e quali sto guardando ora.
  condivisi: CalendarioCondiviso[]
  condivisiAttivi: string[]
  toggleCondiviso: (proprietarioId: string) => void
  ricaricaCondivisi: () => Promise<void>
  utenteId: string
  sincronizza: () => Promise<void>
  inSync: boolean
  ultimoSync: { quando?: string; errore?: string; conteggio?: number } | null
  segnalaRicarica: () => void
  ricariche: number
  email: string
  nome: string
  iniziali: string
}

const Ctx = createContext<Stato | null>(null)

// Le preferenze decidono come si legge tutto il resto (su che fuso e' disegnata
// la griglia, come si chiamano le categorie): finche' non sono arrivate non c'e'
// niente di sensato da disegnare, quindi il guscio aspetta qui.
export function ProviderStato({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<Preferenze | null>(null)
  const [fallito, setFallito] = useState(false)

  useEffect(() => {
    caricaPreferenze().then((p) => {
      if (p) {
        applicaPreferenze(p)
        setPref(p)
      } else {
        setFallito(true)
      }
    })
  }, [])

  if (!pref) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        {fallito ? (
          <>
            <p className="text-[14px]" style={{ color: 'var(--errore)' }}>
              Could not load your settings.
            </p>
            <button onClick={() => location.reload()} className="btn-neutro premibile h-[38px] px-4 text-[13.5px]">
              Try again
            </button>
          </>
        ) : (
          <span className="anim-pulsa text-[14px]" style={{ color: 'var(--testo-2)' }}>
            Loading…
          </span>
        )}
      </div>
    )
  }
  return (
    <ProviderCaricato pref={pref} setPref={setPref}>
      {children}
    </ProviderCaricato>
  )
}

function ProviderCaricato({
  pref,
  setPref,
  children,
}: {
  pref: Preferenze
  setPref: (p: Preferenze) => void
  children: React.ReactNode
}) {
  // Il fuso scelto su questo dispositivo ha la precedenza (si viaggia con il
  // telefono, non con il database), ma la riga preferenze e' la verita' di
  // partenza per chi entra da un browser nuovo.
  const [fuso, setFuso] = useState<string>(() => localStorage.getItem(CHIAVE_FUSO) || pref.fuso_base)
  const [vista, setVista] = useState<Vista>(leggiVista)
  const [giorno, setGiorno] = useState(() => oggiISO(fuso))
  const [calendari, setCalendari] = useState<Origine[]>(leggiCalendari)
  const [ricerca, setRicerca] = useState('')
  const [richieste, setRichieste] = useState<Evento[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [condivisi, setCondivisi] = useState<CalendarioCondiviso[]>([])
  const [condivisiAttivi, setCondivisiAttivi] = useState<string[]>(leggiCondivisiAttivi)
  const [email, setEmail] = useState('')
  const [inSync, setInSync] = useState(false)
  const [ultimoSync, setUltimoSync] = useState<{ quando?: string; errore?: string; conteggio?: number } | null>(null)
  // Contatore che le pagine osservano per rileggere i dati dopo un salvataggio
  // o una sincronizzazione, senza doversi passare callback fra loro.
  const [ricariche, setRicariche] = useState(0)
  const [tema, setTema] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light',
  )

  const caricaRichieste = useCallback(async () => {
    // Il filtro su utente_id non e' ridondante: da quando esistono i calendari
    // condivisi la RLS lascia passare anche gli eventi altrui, e in campanella
    // devono finire solo le richieste che tocca a ME approvare.
    const { data } = await supabase
      .from('eventi')
      .select('*')
      .eq('utente_id', pref.utente_id)
      .eq('stato', 'in_attesa')
      .order('inizio_utc', { ascending: true })
    setRichieste((data as Evento[]) ?? [])
  }, [pref.utente_id])

  const segnalaRicarica = useCallback(() => setRicariche((n) => n + 1), [])

  const ricaricaCondivisi = useCallback(async () => {
    const lista = await calendariCondivisiConMe()
    setCondivisi(lista)
    // Una condivisione revocata non deve restare spuntata a vuoto.
    setCondivisiAttivi((prec) => {
      const vivi = prec.filter((id) => lista.some((c) => c.proprietario_id === id))
      if (vivi.length !== prec.length) localStorage.setItem(CHIAVE_CONDIVISI, JSON.stringify(vivi))
      return vivi.length === prec.length ? prec : vivi
    })
  }, [])

  const toggleCondiviso = useCallback((proprietarioId: string) => {
    setCondivisiAttivi((prec) => {
      const next = prec.includes(proprietarioId)
        ? prec.filter((x) => x !== proprietarioId)
        : [...prec, proprietarioId]
      localStorage.setItem(CHIAVE_CONDIVISI, JSON.stringify(next))
      return next
    })
  }, [])

  // La sincronizzazione dei feed ICS non ha un posto suo nella reference:
  // vive nel menu dell'account, insieme allo stato dell'ultimo aggiornamento.
  // Gira solo per gli account a cui il feed appartiene davvero: per tutti gli
  // altri la Edge Function non farebbe nulla, e chiamarla a ogni avvio sarebbe
  // solo una richiesta sprecata.
  const sincronizza = useCallback(async () => {
    if (!pref.sync_abilitato) return
    setInSync(true)
    await eseguiSync()
    setUltimoSync(await leggiUltimoSync())
    setInSync(false)
    setRicariche((n) => n + 1)
  }, [pref.sync_abilitato])

  // Prima si scrive, poi si aggiorna lo stato: al contrario un salvataggio
  // fallito lascerebbe la UI convinta del nuovo valore (era cosi' che
  // l'onboarding "passava" anche quando la scrittura veniva rifiutata).
  // Lo specchio a runtime di tempo.ts si aggiorna insieme allo stato, cosi' il
  // render che segue usa gia' i valori nuovi.
  const aggiornaPref = useCallback(
    async (patch: Partial<Preferenze>) => {
      await salvaPreferenze(pref.utente_id, patch)
      const nuove = { ...pref, ...patch }
      applicaPreferenze(nuove)
      setPref(nuove)
      setRicariche((n) => n + 1)
    },
    [pref, setPref],
  )

  useEffect(() => {
    caricaRichieste()
    ricaricaCondivisi()
    leggiToken().then(setToken)
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
    if (pref.sync_abilitato) {
      leggiUltimoSync().then(setUltimoSync)
      sincronizza()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Badge nel titolo della scheda quando ci sono richieste da approvare.
  useEffect(() => {
    document.title = richieste.length ? `(${richieste.length}) SmartCal` : 'SmartCal'
  }, [richieste.length])

  // Finche' su questo dispositivo non si e' scelto un fuso a mano, l'asse segue
  // il profilo. Serve all'onboarding: quando lo salva, `fuso` e' gia' stato
  // inizializzato col valore di prima (UTC per un account appena creato) e
  // senza questo il calendario resterebbe disegnato sul fuso sbagliato fino al
  // prossimo caricamento della pagina.
  useEffect(() => {
    if (!localStorage.getItem(CHIAVE_FUSO)) setFuso(pref.fuso_base)
  }, [pref.fuso_base])

  const cambiaFuso = useCallback(
    (id: string) => {
      setFuso(id)
      localStorage.setItem(CHIAVE_FUSO, id)
      const o = opzioneFuso(id)
      aggiornaPref({ fuso_base: id, etichetta_base: o.etichetta }).catch((e) =>
        console.error('Non sono riuscito a salvare la localita\':', e),
      )
    },
    [aggiornaPref],
  )

  const cambiaVista = useCallback((v: Vista) => {
    setVista(v)
    localStorage.setItem(CHIAVE_VISTA, v)
  }, [])

  const toggleCalendario = useCallback((o: Origine) => {
    setCalendari((prec) => {
      const next = prec.includes(o) ? prec.filter((x) => x !== o) : [...prec, o]
      localStorage.setItem(CHIAVE_CALENDARI, JSON.stringify(next))
      return next
    })
  }, [])

  const toggleTema = useCallback(() => {
    setTema((prec) => {
      const next = prec === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      localStorage.setItem(CHIAVE_TEMA, next)
      return next
    })
  }, [])

  // Un evento è visibile se il suo calendario è spuntato e, quando c'è una
  // ricerca attiva, se il testo compare in titolo/luogo/descrizione.
  const visibile = useCallback(
    (ev: Evento) => {
      // Le spunte di "My calendars" governano le MIE categorie. Un evento
      // condiviso ha una spunta sua, nel gruppo di sotto, e non deve sparire
      // perche' ho tolto "Personal" dal mio calendario.
      if (!ev.condiviso && !calendari.includes(ev.origine)) return false
      const q = ricerca.trim().toLowerCase()
      if (!q) return true
      return [ev.titolo, ev.luogo, ev.descrizione, ev.richiedente]
        .filter(Boolean)
        .some((t) => (t as string).toLowerCase().includes(q))
    },
    [calendari, ricerca],
  )

  const nome = useMemo(() => {
    const scelto = pref.nome_visualizzato?.trim()
    if (scelto) return scelto
    if (!email) return 'Account'
    const base = email.split('@')[0].replace(/[._-]+/g, ' ')
    return base.replace(/\b\w/g, (c) => c.toUpperCase())
  }, [email, pref.nome_visualizzato])

  const iniziali = useMemo(
    () =>
      nome
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || 'A',
    [nome],
  )

  const valore = useMemo<Stato>(
    () => ({
      pref,
      aggiornaPref,
      fuso,
      cambiaFuso,
      vista,
      cambiaVista,
      giorno,
      setGiorno,
      calendari,
      toggleCalendario,
      visibile,
      tema,
      toggleTema,
      ricerca,
      setRicerca,
      richieste,
      caricaRichieste,
      token,
      condivisi,
      condivisiAttivi,
      toggleCondiviso,
      ricaricaCondivisi,
      utenteId: pref.utente_id,
      sincronizza,
      inSync,
      ultimoSync,
      segnalaRicarica,
      ricariche,
      email,
      nome,
      iniziali,
    }),
    [
      pref, aggiornaPref, fuso, cambiaFuso, vista, cambiaVista, giorno, calendari,
      toggleCalendario, visibile, tema, toggleTema, ricerca, richieste, caricaRichieste,
      token, condivisi, condivisiAttivi, toggleCondiviso, ricaricaCondivisi,
      sincronizza, inSync, ultimoSync, segnalaRicarica, ricariche, email, nome, iniziali,
    ],
  )

  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>
}

export function useStato(): Stato {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStato fuori da ProviderStato')
  return v
}
