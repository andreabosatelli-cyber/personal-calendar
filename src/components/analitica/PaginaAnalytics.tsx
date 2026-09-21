import { useEffect, useMemo, useState } from 'react'
import { useStato } from '../../lib/stato'
import { useDatiAnalytics } from '../../hooks/useDatiAnalytics'
import { distribuzione, etichettaPeriodo, fmtOre, spostaPeriodo, type Periodo } from '../../lib/statistiche'
import {
  bandaUfficio,
  caricoOrario,
  contatori,
  estremiPeriodo,
  fuoriOrario,
  perGiornoSettimana,
  piuCarica,
  serieGiornaliera,
  timeline,
  variazione,
  notaVariazione,
  PERIODO_PRECEDENTE,
} from '../../lib/analitica'
import { COLORI_ORIGINE, nomeBreve, asseUnico, oggiISO, etichettaRif } from '../../lib/tempo'
import type { Origine } from '../../lib/types'
import { IconaChevron } from '../../lib/icone'
import { Donut, LegendaDonut } from '../pannello/Donut'
import { RigaValore, TestataCard } from '../pannello/parti'
import { Barre, LegendaCategorie } from './Barre'
import { PiuCarica, StrisciaGiorno } from './StrisciaGiorno'
import { Tessera } from './Tessere'

const NOME_BREVE_PERIODO: Record<Periodo, string> = { week: 'Week', month: 'Month', year: 'Year' }
const PERIODI: Periodo[] = ['week', 'month', 'year']

// Analytics — Fase 2 del redesign. Legge gli stessi eventi del calendario e
// non chiede nessun dato nuovo. Il taglio non è "quanto sono produttivo" ma
// "come si distribuisce la mia giornata fra i due orologi".
export function PaginaAnalytics() {
  const { fuso, giorno, visibile, ricariche } = useStato()
  const [periodo, setPeriodo] = useState<Periodo>('month')
  const [ancora, setAncora] = useState(giorno)

  const { eventi, precedenti, caricamento, errore, ricarica } = useDatiAnalytics(periodo, ancora, fuso)

  useEffect(() => {
    if (ricariche) ricarica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricariche])

  const oggi = oggiISO(fuso)

  const d = useMemo(() => {
    const evs = eventi.filter(visibile)
    const prec = precedenti.filter(visibile)
    const { da, a } = estremiPeriodo(periodo, ancora, fuso)
    const prima = estremiPeriodo(periodo, spostaPeriodo(periodo, ancora, -1, fuso), fuso)
    const giorni = serieGiornaliera(evs, da, a, oggi)
    return {
      da,
      a,
      dist: distribuzione(evs),
      distPrec: distribuzione(prec),
      serie: timeline(giorni, periodo, oggi),
      settimana: perGiornoSettimana(giorni),
      carico: caricoOrario(evs, fuso),
      fuori: fuoriOrario(evs, fuso),
      conta: contatori(evs, da, a, fuso),
      contaPrec: contatori(prec, prima.da, prima.a, fuso),
    }
  }, [eventi, precedenti, visibile, periodo, ancora, fuso, oggi])

  const ore = (o: Origine) => d.dist.quote.find((q) => q.origine === o)?.ore ?? 0
  const orePrec = (o: Origine) => d.distPrec.quote.find((q) => q.origine === o)?.ore ?? 0
  const coda = PERIODO_PRECEDENTE[periodo]
  const banda = asseUnico(fuso) ? null : bandaUfficio(ancora, fuso)
  const nelPeriodo = oggi >= d.da.toISODate()! && oggi <= d.a.toISODate()!

  if (caricamento && !eventi.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="anim-pulsa text-[14px]" style={{ color: 'var(--testo-2)' }}>
          Loading…
        </span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-[22px] pt-[5px] scroll-fine lg:pl-5 lg:pr-4">
      <div className="flex flex-col gap-[21px] xl:flex-row">
        {/* Colonna principale */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="card flex flex-wrap items-center gap-3 px-[18px] py-[15px]">
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setAncora(spostaPeriodo(periodo, ancora, -1, fuso))}
                className="btn-neutro premibile h-10 w-10"
                aria-label="Previous period"
              >
                <IconaChevron size={18} verso="sx" />
              </button>
              <button
                onClick={() => setAncora(spostaPeriodo(periodo, ancora, 1, fuso))}
                className="btn-neutro premibile h-10 w-10"
                aria-label="Next period"
              >
                <IconaChevron size={18} verso="dx" />
              </button>
            </div>

            <h2 className="min-w-0 flex-1 truncate pl-1 text-[22px] font-bold">
              {etichettaPeriodo(periodo, ancora, fuso)}
            </h2>

            <div className="flex w-full shrink-0 items-center justify-end gap-2.5 sm:w-auto">
              <div className="seg">
                {PERIODI.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`seg-item premibile ${p === periodo ? 'attivo' : ''}`}
                  >
                    {NOME_BREVE_PERIODO[p]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAncora(oggi)}
                disabled={nelPeriodo}
                className="btn-neutro premibile h-[42px] px-[18px] disabled:opacity-45"
              >
                Today
              </button>
            </div>
          </section>

          {errore && (
            <p
              className="rounded-[12px] px-3 py-2.5 text-center text-[12.5px]"
              style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' }}
            >
              Offline — analytics needs the server to add up your events.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <Tessera
              etichetta="Scheduled"
              valore={fmtOre(d.dist.totaleOre)}
              unita="h"
              nota={notaVariazione(variazione(d.dist.totaleOre, d.distPrec.totaleOre), coda)}
            />
            <Tessera
              etichetta={nomeBreve('lavoro')}
              valore={fmtOre(ore('lavoro'))}
              unita="h"
              colore={COLORI_ORIGINE.lavoro.punto}
              nota={notaVariazione(variazione(ore('lavoro'), orePrec('lavoro')), coda)}
            />
            <Tessera
              etichetta={nomeBreve('universita')}
              valore={fmtOre(ore('universita'))}
              unita="h"
              colore={COLORI_ORIGINE.universita.punto}
              nota={notaVariazione(variazione(ore('universita'), orePrec('universita')), coda)}
            />
            <Tessera
              etichetta={nomeBreve('personale')}
              valore={fmtOre(ore('personale'))}
              unita="h"
              colore={COLORI_ORIGINE.personale.punto}
              nota={notaVariazione(variazione(ore('personale'), orePrec('personale')), coda)}
            />
            <Tessera
              etichetta="Travel days"
              valore={String(d.conta.giorniViaggio)}
              colore={COLORI_ORIGINE.viaggi.punto}
              nota={notaVariazione(variazione(d.conta.giorniViaggio, d.contaPrec.giorniViaggio), coda)}
            />
          </div>

          <section className="card overflow-hidden">
            <TestataCard titolo="Hours over time">
              <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                {fmtOre(d.dist.totaleOre)}h · {d.dist.totaleEventi} events
              </span>
            </TestataCard>
            <div className="px-[18px] pt-1 pb-[18px]">
              <Barre dati={d.serie} passoEtichette={periodo === 'month' ? 5 : 1} />
              <LegendaCategorie dati={d.serie} />
            </div>
          </section>

          <section className="card overflow-hidden">
            <TestataCard titolo="When your day happens">
              <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                {fmtOre(d.fuori.ore)}h outside
              </span>
            </TestataCard>
            <div className="px-[18px] pt-1 pb-[18px]">
              <StrisciaGiorno carico={d.carico} banda={banda} />
            </div>
          </section>

          {periodo !== 'week' && (
            <section className="card overflow-hidden">
              <TestataCard titolo="By weekday" />
              <div className="px-[18px] pt-1 pb-[18px]">
                <Barre dati={d.settimana} altezza={132} />
                <div className="mt-3.5">
                  <PiuCarica barra={piuCarica(d.settimana)} etichetta="Busiest weekday:" />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Colonna destra */}
        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[335px]">
          <section className="card overflow-hidden">
            <TestataCard titolo="Time distribution" />
            {d.dist.totaleOre > 0 ? (
              <div className="flex items-center gap-4 px-[18px] pt-1 pb-[18px]">
                <Donut quote={d.dist.quote} totaleOre={d.dist.totaleOre} />
                <LegendaDonut quote={d.dist.quote} nomi={nomeBreve} mostraOre />
              </div>
            ) : (
              <p className="px-[18px] pt-1 pb-5 text-[13px]" style={{ color: 'var(--testo-3)' }}>
                No scheduled hours in this period.
              </p>
            )}
          </section>

          <section className="card overflow-hidden">
            <TestataCard titolo="Across two clocks" />
            <div className="flex flex-col px-[18px] pt-1 pb-[18px]">
              <RigaValore
                etichetta="Outside your day"
                valore={`${fmtOre(d.fuori.ore)}h`}
                sotto={`${Math.round(d.fuori.pct)}% of scheduled hours`}
              />
              <RigaValore etichetta="Between 22:00 and 07:00" valore={`${fmtOre(d.fuori.notte)}h`} />
              <RigaValore
                etichetta="Earliest start"
                valore={d.fuori.prima?.locale ?? '—'}
                sotto={
                  d.fuori.prima && !asseUnico(fuso)
                    ? `${d.fuori.prima.riferimento} in ${etichettaRif()} · ${d.fuori.prima.giorno}`
                    : d.fuori.prima?.giorno
                }
              />
              <RigaValore
                etichetta="Latest end"
                valore={d.fuori.ultima?.locale ?? '—'}
                sotto={
                  d.fuori.ultima && !asseUnico(fuso)
                    ? `${d.fuori.ultima.riferimento} in ${etichettaRif()} · ${d.fuori.ultima.giorno}`
                    : d.fuori.ultima?.giorno
                }
              />
            </div>
          </section>

          <section className="card overflow-hidden">
            <TestataCard titolo="Activity" />
            <div className="flex flex-col px-[18px] pt-1 pb-[18px]">
              <RigaValore etichetta="Work meetings" valore={String(d.conta.riunioni)} colore={COLORI_ORIGINE.lavoro.punto} />
              <RigaValore etichetta="Classes" valore={String(d.conta.lezioni)} colore={COLORI_ORIGINE.universita.punto} />
              <RigaValore
                etichetta="Personal events"
                valore={String(d.conta.personali)}
                colore={COLORI_ORIGINE.personale.punto}
              />
              <RigaValore
                etichetta="Travel days"
                valore={String(d.conta.giorniViaggio)}
                colore={COLORI_ORIGINE.viaggi.punto}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
