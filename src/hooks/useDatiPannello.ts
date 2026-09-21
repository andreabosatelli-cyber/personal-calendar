import { useCallback, useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import { distribuzione, eventiTra, intervalloPeriodo, type Periodo } from '../lib/statistiche'
import { ricavaViaggi } from '../lib/viaggi'
import { useStato } from '../lib/stato'

// Dati della colonna destra (Time distribution, Trips) con UNA sola query sul
// periodo scelto.
export function useDatiPannello(periodo: Periodo, ancora: string, fuso: string, attivo = true) {
  const { utenteId } = useStato()
  const { da, a } = useMemo(() => intervalloPeriodo(periodo, ancora, fuso), [periodo, ancora, fuso])
  const [eventi, setEventi] = useState<Evento[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState(false)

  const ricarica = useCallback(async () => {
    if (!attivo) {
      setEventi([])
      setCaricamento(false)
      return
    }
    setCaricamento(true)
    const inizio = DateTime.fromISO(da, { zone: 'utc' }).toUTC().toISO()!
    const fine = DateTime.fromISO(a, { zone: 'utc' }).toUTC().toISO()!
    try {
      setEventi(await eventiTra(inizio, fine, utenteId))
      setErrore(false)
    } catch {
      // Offline: la colonna destra si limita a non mostrare numeri inventati.
      setEventi([])
      setErrore(true)
    }
    setCaricamento(false)
  }, [da, a, attivo, utenteId])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  return { eventi, da, a, caricamento, errore, ricarica }
}

// Eventi del solo periodo scelto (per donut e viaggi), filtrati dai calendari
// spuntati e dalla ricerca attiva.
export function useAggregati(eventi: Evento[], da: string, a: string, fuso: string, visibile: (ev: Evento) => boolean) {
  return useMemo(() => {
    const daMs = Date.parse(da)
    const aMs = Date.parse(a)
    const nel = eventi.filter(
      (ev) => visibile(ev) && Date.parse(ev.inizio_utc) <= aMs && Date.parse(ev.fine_utc) >= daMs,
    )
    return { nel, dist: distribuzione(nel), viaggi: ricavaViaggi(nel, fuso) }
  }, [eventi, da, a, fuso, visibile])
}
