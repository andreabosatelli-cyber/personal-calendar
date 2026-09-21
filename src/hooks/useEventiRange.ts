import { useCallback, useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { supabase } from '../lib/supabase'
import type { Evento } from '../lib/types'
import { eventoNelGiorno } from '../lib/tempo'
import { aggiornaCache, eventiDaCache, salvatoIl } from '../lib/cacheEventi'
import { useStato } from '../lib/stato'
import { impegniOccupati } from '../lib/condivisi'

// Carica gli eventi che toccano l'intervallo di giorni visibile (1, 3, 7, mese…)
// e li raggruppa per giornata nel fuso corrente. Ai miei si sovrappongono i
// calendari condivisi che ho spuntato nella sidebar: arrivano marcati, cosi'
// la griglia li disegna col colore della persona e in sola lettura.
export function useEventiRange(giorni: string[], fuso: string) {
  const { utenteId, condivisi, condivisiAttivi } = useStato()
  const chiave = giorni.join(',')
  const chiaveCondivisi = condivisiAttivi.join(',')
  const [perGiorno, setPerGiorno] = useState<Record<string, Evento[]>>({})
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [datiDel, setDatiDel] = useState<string | null>(null)

  const ricarica = useCallback(async () => {
    setCaricamento(true)
    setErrore(null)
    const primo = DateTime.fromISO(giorni[0], { zone: fuso }).startOf('day')
    const ultimo = DateTime.fromISO(giorni[giorni.length - 1], { zone: fuso }).endOf('day')
    const da = primo.minus({ hours: 36 }).toUTC().toISO()!
    const a = ultimo.plus({ hours: 36 }).toUTC().toISO()!
    // Sovrapposizione, non contenimento: un soggiorno dal 15 al 17 deve uscire
    // anche se guardo il 16 (il suo inizio_utc e' fuori finestra).
    const { data, error } = await supabase
      .from('eventi')
      .select('*')
      .eq('utente_id', utenteId)
      .lte('inizio_utc', a)
      .gte('fine_utc', da)
      .order('inizio_utc', { ascending: true })
    const raggruppa = (evs: Evento[]) => {
      const mappa: Record<string, Evento[]> = {}
      for (const g of giorni) mappa[g] = evs.filter((ev) => eventoNelGiorno(ev, g, fuso))
      return mappa
    }

    if (error) {
      // Server irraggiungibile (tipicamente: niente rete). Invece di svuotare
      // la vista si mostra l'ultima copia locale, dicendo di quando è. I
      // calendari altrui non entrano nella copia locale: non sono miei da
      // tenere sul disco, e senza rete non c'è modo di sapere se sono cambiati.
      setPerGiorno(raggruppa(eventiDaCache(da, a)))
      setOffline(true)
      setDatiDel(salvatoIl())
      setErrore(error.message)
      setCaricamento(false)
      return
    }

    const miei = data as Evento[]
    aggiornaCache(miei, da, a)
    setPerGiorno(raggruppa([...miei, ...(await eventiCondivisi(da, a))]))
    setOffline(false)
    setDatiDel(null)
    setCaricamento(false)

    // Gli eventi dei calendari spuntati, marcati con la persona da cui
    // arrivano. Chi ha dato solo 'occupato' non passa dalla tabella: la RLS
    // non lo lascia entrare, e la sua RPC restituisce blocchi senza titolo.
    async function eventiCondivisi(daUTC: string, aUTC: string): Promise<Evento[]> {
      const attivi = condivisi
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => condivisiAttivi.includes(c.proprietario_id))
      if (!attivi.length) return []

      const conDettagli = attivi.filter(({ c }) => c.permesso !== 'occupato')
      const soloOccupato = attivi.filter(({ c }) => c.permesso === 'occupato')
      const fuori: Evento[] = []

      if (conDettagli.length) {
        const { data: altrui } = await supabase
          .from('eventi')
          .select('*')
          .in(
            'utente_id',
            conDettagli.map(({ c }) => c.proprietario_id),
          )
          // Gli eventi confermati di chi mi ha dato accesso, piu' le richieste
          // che ho mandato io e che aspettano ancora una risposta: senza,
          // prenotare sembrerebbe non aver fatto niente.
          .or(`stato.eq.confermato,and(stato.eq.in_attesa,creato_da.eq.${utenteId})`)
          .lte('inizio_utc', aUTC)
          .gte('fine_utc', daUTC)
          .order('inizio_utc', { ascending: true })
        for (const ev of (altrui as Evento[]) ?? []) {
          const trovato = conDettagli.find(({ c }) => c.proprietario_id === ev.utente_id)
          if (!trovato) continue
          fuori.push({
            ...ev,
            condiviso: { proprietarioId: ev.utente_id, nome: trovato.c.nome, indice: trovato.i, soloOccupato: false },
          })
        }
      }

      // Una chiamata a persona: sono RPC distinte e non si accorpano.
      const blocchi = await Promise.all(
        soloOccupato.map(({ c, i }) =>
          impegniOccupati(c.proprietario_id, daUTC, aUTC, c.fuso).then((evs) =>
            evs.map((ev) => ({
              ...ev,
              condiviso: { proprietarioId: c.proprietario_id, nome: c.nome, indice: i, soloOccupato: true },
            })),
          ),
        ),
      )
      for (const gruppo of blocchi) fuori.push(...gruppo)
      return fuori
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, fuso, utenteId, chiaveCondivisi, condivisi])

  useEffect(() => {
    ricarica()
  }, [ricarica])

  const giorniMemo = useMemo(() => giorni, [chiave]) // stabile finché la chiave non cambia
  return { perGiorno, giorni: giorniMemo, caricamento, errore, offline, datiDel, ricarica }
}
