import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useStato } from './stato'
import { oggiISO } from './tempo'
import {
  FUSO_LEZIONI,
  aggiornaFinestra,
  caricaFinestre,
  confronta,
  creaFinestra,
  deadlineVicine,
  fascePerGiorno,
  prossimoCodice,
  type DatiFinestre,
  type Differenza,
  type Finestra,
  type StatoFinestra,
} from './finestre'

// Le finestre servono a tre posti insieme: la sezione Trips, le fasce di
// sfondo del calendario e il badge sulla voce Trips. Una lettura sola, qui.

const CHIAVE_CACHE = 'pc_finestre_cache'
const CHIAVE_IGNORATE = 'pc_finestre_ignorate'

const VUOTI: DatiFinestre = { finestre: [], proposte: [], eventi: [], libere: [], lezioni: [] }

function leggiCache(): DatiFinestre {
  try {
    const raw = localStorage.getItem(CHIAVE_CACHE)
    const d = raw ? (JSON.parse(raw) as DatiFinestre) : null
    return d && Array.isArray(d.finestre) ? { ...VUOTI, ...d } : VUOTI
  } catch {
    return VUOTI
  }
}

function salvaCache(d: DatiFinestre) {
  try {
    localStorage.setItem(CHIAVE_CACHE, JSON.stringify(d))
  } catch {
    // quota piena o storage bloccato: la cache e' un di piu'
  }
}

function leggiIgnorate(): string[] {
  try {
    const raw = localStorage.getItem(CHIAVE_IGNORATE)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

interface StatoFinestre extends DatiFinestre {
  caricamento: boolean
  errore: string | null
  oggi: string // in ora di Singapore, come le finestre
  differenze: Differenza[]
  inScadenza: Finestra[]
  fasce: Record<string, Finestra>
  cambiaStato: (f: Finestra, stato: StatoFinestra) => Promise<void>
  applica: (d: Differenza) => Promise<void>
  ignora: (d: Differenza) => void
  ricarica: () => Promise<void>
}

const Ctx = createContext<StatoFinestre | null>(null)

export function ProviderFinestre({ children }: { children: React.ReactNode }) {
  const { utenteId, ricariche } = useStato()
  const [dati, setDati] = useState<DatiFinestre>(leggiCache)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [ignorate, setIgnorate] = useState<string[]>(leggiIgnorate)
  const oggi = oggiISO(FUSO_LEZIONI)

  // Dopo una scrittura: rilegge tutto (le finestre nuove hanno id del server).
  const ricarica = useCallback(async () => {
    const d = await caricaFinestre(utenteId, oggi)
    setDati(d)
    setErrore(null)
    salvaCache(d)
  }, [utenteId, oggi])

  // Lettura all'avvio e a ogni salvataggio segnalato dal resto dell'app (un
  // evento universita' spostato cambia le finestre). `caricamento` parte vero
  // e scende alla prima risposta: le riletture aggiornano in silenzio.
  useEffect(() => {
    let vivo = true
    caricaFinestre(utenteId, oggi)
      .then(
        (d) => {
          if (!vivo) return
          setDati(d)
          setErrore(null)
          salvaCache(d)
        },
        (e: unknown) => {
          if (vivo) setErrore(e instanceof Error ? e.message : 'Could not load travel windows')
        },
      )
      .finally(() => {
        if (vivo) setCaricamento(false)
      })
    return () => {
      vivo = false
    }
  }, [utenteId, oggi, ricariche])

  // Scritture: prima il server, poi lo stato locale (mai in modo ottimistico).
  const cambiaStato = useCallback(
    async (f: Finestra, stato: StatoFinestra) => {
      await aggiornaFinestra(f.id, utenteId, { stato })
      setDati((d) => ({ ...d, finestre: d.finestre.map((x) => (x.id === f.id ? { ...x, stato } : x)) }))
    },
    [utenteId],
  )

  const applica = useCallback(
    async (d: Differenza) => {
      if (d.tipo === 'nuova') await creaFinestra(utenteId, prossimoCodice(dati.finestre), d.libera)
      else if (d.patch) await aggiornaFinestra(d.finestra.id, utenteId, d.patch)
      await ricarica()
    },
    [utenteId, dati.finestre, ricarica],
  )

  const ignora = useCallback((d: Differenza) => {
    setIgnorate((prec) => {
      const next = [...prec, d.chiave]
      try {
        localStorage.setItem(CHIAVE_IGNORATE, JSON.stringify(next))
      } catch {
        // senza storage l'ignora vale solo per questa sessione
      }
      return next
    })
  }, [])

  const valore = useMemo<StatoFinestre>(() => {
    // Il confronto ha senso solo con dati freschi: sulla copia offline
    // proporrebbe modifiche a partire da un planning vecchio.
    const differenze = errore
      ? []
      : confronta(dati.finestre, dati.libere, dati.lezioni, oggi).filter((d) => !ignorate.includes(d.chiave))
    return {
      ...dati,
      caricamento,
      errore,
      oggi,
      differenze,
      inScadenza: deadlineVicine(dati.finestre, oggi),
      fasce: fascePerGiorno(dati.finestre),
      cambiaStato,
      applica,
      ignora,
      ricarica,
    }
  }, [dati, caricamento, errore, oggi, ignorate, cambiaStato, applica, ignora, ricarica])

  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>
}

export function useFinestre(): StatoFinestre {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFinestre fuori da ProviderFinestre')
  return v
}
