import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { supabase } from '../lib/supabase'
import { useStato } from '../lib/stato'
import type { Evento, Origine } from '../lib/types'
import {
  LOCALE,
  asseUnico,
  durataOre,
  etichettaRif,
  fusoRif,
  nomeOrigine,
  nomePlurale,
  opzioneFuso,
  vaInFascia,
} from '../lib/tempo'

interface Props {
  fuso: string
  dataInizio: string
  dataFine: string
  onChiudi: () => void
}

const ORIGINI: Origine[] = ['universita', 'lavoro', 'viaggi', 'personale']
// Colori fissi "da stampa" (chiari su bianco), indipendenti dal tema.
// Stessa lettura della palette dell'app (blu/viola/ambra/rosa), scurita quel
// tanto che basta per restare leggibile stampata su bianco.
const COL_STAMPA: Record<Origine, string> = {
  lavoro: '#2f5bd0',
  universita: '#6d28d9',
  personale: '#b7791f',
  viaggi: '#be123c',
}
const fmtOre = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))

export function EsportaPdf({ fuso, dataInizio, dataFine, onChiudi }: Props) {
  const { utenteId } = useStato()
  const [da, setDa] = useState(dataInizio)
  const [a, setA] = useState(dataFine)
  const [eventi, setEventi] = useState<Evento[] | null>(null)
  const [caric, setCaric] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const opz = opzioneFuso(fuso)

  async function genera() {
    setCaric(true)
    setErrore(null)
    const daStart = DateTime.fromISO(da, { zone: fuso }).startOf('day').toUTC().toISO()!
    const aEnd = DateTime.fromISO(a, { zone: fuso }).endOf('day').toUTC().toISO()!
    // Il riepilogo e' il mio, non quello dei calendari che sto guardando in
    // sovrapposizione: la query resta ancorata al mio account.
    const { data, error } = await supabase
      .from('eventi')
      .select('*')
      .eq('utente_id', utenteId)
      .lte('inizio_utc', aEnd)
      .gte('fine_utc', daStart)
      .order('inizio_utc', { ascending: true })
    setCaric(false)
    if (error) {
      setErrore(error.message)
      setEventi(null)
      return
    }
    setEventi(data as Evento[])
  }

  useEffect(() => {
    genera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Raggruppa per giornata (nel fuso corrente), assegnando l'evento al giorno d'inizio.
  const perGiorno = useMemo(() => {
    const m = new Map<string, Evento[]>()
    for (const ev of eventi ?? []) {
      const g = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso).toISODate()!
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(ev)
    }
    for (const [, evs] of m) evs.sort((x, y) => x.inizio_utc.localeCompare(y.inizio_utc))
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]))
  }, [eventi, fuso])

  const totali = useMemo(() => {
    const t: Record<string, { n: number; ore: number }> = {}
    for (const ev of eventi ?? []) {
      t[ev.origine] = t[ev.origine] || { n: 0, ore: 0 }
      t[ev.origine].n++
      if (!vaInFascia(ev)) t[ev.origine].ore += durataOre(ev)
    }
    return t
  }, [eventi])
  const totOre = Object.values(totali).reduce((s, x) => s + x.ore, 0)

  const fmt = (iso: string, zona: string) => DateTime.fromISO(iso, { zone: 'utc' }).setZone(zona).toFormat('HH:mm')
  const oggiStr = DateTime.now().setZone(fuso).setLocale(LOCALE).toFormat('d LLLL yyyy, HH:mm')
  const rangeStr = `${DateTime.fromISO(da, { zone: fuso }).setLocale(LOCALE).toFormat('d LLL yyyy')} – ${DateTime.fromISO(a, { zone: fuso }).setLocale(LOCALE).toFormat('d LLL yyyy')}`

  return (
    <div className="pdf-modal anim-fade fixed inset-0 z-[60] flex flex-col" style={{ background: 'rgb(20 18 40 / 0.45)' }}>
      <div className="pdf-panel anim-sheet-scala relative mx-auto my-3 flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px]" style={{ background: 'var(--card)', boxShadow: 'var(--ombra-card)' }}>
        {/* Controlli (non stampati) */}
        <div className="no-stampa flex flex-wrap items-end gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--linea)' }}>
          <div>
            <label className="mb-1 block text-[12px]" style={{ color: 'var(--testo-2)' }}>From</label>
            <input type="date" value={da} onChange={(e) => setDa(e.target.value)} className="campo text-[15px]" />
          </div>
          <div>
            <label className="mb-1 block text-[12px]" style={{ color: 'var(--testo-2)' }}>To</label>
            <input type="date" value={a} onChange={(e) => setA(e.target.value)} className="campo text-[15px]" />
          </div>
          <button onClick={genera} disabled={caric} className="btn-tenue premibile h-10 px-3.5 disabled:opacity-50">
            {caric ? 'Loading…' : 'Refresh'}
          </button>
          <div className="flex-1" />
          <button onClick={() => window.print()} disabled={!eventi} className="btn-primario premibile h-10 px-4 disabled:opacity-50">
            Save as PDF
          </button>
          <button onClick={onChiudi} className="btn-neutro premibile h-10 px-3.5">
            Close
          </button>
        </div>

        {/* Documento (stampabile) */}
        <div className="pdf-scroll overflow-y-auto p-5" style={{ background: '#f3f4f6' }}>
          <div className="stampabile mx-auto bg-white p-8 text-[13px] leading-normal" style={{ color: '#111827', maxWidth: 720, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
            <div className="mb-1 flex items-baseline justify-between">
              <h1 className="text-[22px] font-bold">Calendar summary</h1>
              <span className="text-[12px]" style={{ color: '#6b7280' }}>{opz.bandiera} {opz.etichetta}</span>
            </div>
            <p className="text-[12px]" style={{ color: '#6b7280' }}>{rangeStr} · generated {oggiStr}</p>

            {/* Totali */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-y py-2.5" style={{ borderColor: '#e5e7eb' }}>
              {ORIGINI.filter((o) => totali[o]).map((o) => (
                <span key={o} className="flex items-center gap-1.5 text-[12px]">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COL_STAMPA[o] }} />
                  <b>{totali[o].n}</b> {nomePlurale(o)}{totali[o].ore > 0 ? ` · ${fmtOre(totali[o].ore)}h` : ''}
                </span>
              ))}
              {totOre > 0 && <span className="text-[12px]" style={{ color: '#6b7280' }}>Total hours: <b style={{ color: '#111827' }}>{fmtOre(totOre)}h</b></span>}
            </div>

            {/* Giorni */}
            {eventi && perGiorno.length === 0 && <p className="mt-6 text-[13px]" style={{ color: '#6b7280' }}>No events in the selected range.</p>}
            {errore && <p className="mt-4 text-[13px]" style={{ color: '#b91c1c' }}>Error: {errore}</p>}

            {perGiorno.map(([g, evs]) => (
              <div key={g} className="blocco-giorno mt-4">
                <h2 className="mb-1.5 border-b pb-1 text-[13px] font-bold capitalize" style={{ borderColor: '#e5e7eb' }}>
                  {DateTime.fromISO(g, { zone: fuso }).setLocale(LOCALE).toFormat('cccc d LLLL yyyy')}
                </h2>
                {evs.map((ev) => (
                  <div key={ev.id} className="flex items-baseline gap-2 py-0.5">
                    <span className="w-24 shrink-0 tabular-nums" style={{ color: '#374151' }}>
                      {ev.tutto_il_giorno ? 'all day' : `${fmt(ev.inizio_utc, fuso)}–${fmt(ev.fine_utc, fuso)}`}
                    </span>
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: COL_STAMPA[ev.origine], marginTop: 5 }} />
                    <span className="flex-1">
                      <b>{ev.titolo}</b>
                      <span style={{ color: '#6b7280' }}> · {nomeOrigine(ev.origine)}</span>
                      {ev.luogo && <span style={{ color: '#6b7280' }}> · {ev.luogo}</span>}
                      {!ev.tutto_il_giorno && !asseUnico(fuso) && (
                        <span style={{ color: '#9ca3af' }}> · {fmt(ev.inizio_utc, fusoRif()!)}–{fmt(ev.fine_utc, fusoRif()!)} in {etichettaRif()}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
