import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Evento } from '../lib/types'
import { eventiTra, intervalloPeriodo, spostaPeriodo, type Periodo } from '../lib/statistiche'
import { useStato } from '../lib/stato'

// Dati della pagina Analytics. Una query sola che copre periodo corrente E
// periodo precedente: i confronti ("vs last month") non devono costare un
// secondo giro di rete.
export function useDatiAnalytics(periodo: Periodo, ancora: string, fuso: string) {
  const { utenteId } = useStato()
  const finestra = useMemo(() => {
    const ora = intervalloPeriodo(periodo, ancora, fuso)
    const prima = intervalloPeriodo(periodo, spostaPeriodo(periodo, ancora, -1, fuso), fuso)
    return { ora, prima }
  }, [periodo, ancora, fuso])

  const [tutti, setTutti] = useState<Evento[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState(false)

  const ricarica = useCallback(async () => {
    setCaricamento(true)
    try {
      setTutti(await eventiTra(finestra.prima.da, finestra.ora.a, utenteId))
      setErrore(false)
    } catch {
      // Offline: meglio una pagina che lo dice che numeri inventati.
      setTutti([])
      setErrore(true)
    }
    setCaricamento(false)
  }, [finestra, utenteId])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  // Sovrapposizione, non contenimento: un impegno a cavallo del confine del
  // periodo appartiene a entrambi, e le ore le ritaglia chi le somma.
  const { eventi, precedenti } = useMemo(() => {
    const nel = (da: string, a: string) => {
      const daMs = Date.parse(da)
      const aMs = Date.parse(a)
      return tutti.filter((ev) => Date.parse(ev.inizio_utc) <= aMs && Date.parse(ev.fine_utc) >= daMs)
    }
    return { eventi: nel(finestra.ora.da, finestra.ora.a), precedenti: nel(finestra.prima.da, finestra.prima.a) }
  }, [tutti, finestra])

  return { eventi, precedenti, caricamento, errore, ricarica }
}
