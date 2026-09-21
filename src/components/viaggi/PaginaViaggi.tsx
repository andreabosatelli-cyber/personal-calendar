import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { useStato } from '../../lib/stato'
import { useDatiAnalytics } from '../../hooks/useDatiAnalytics'
import { spostaPeriodo } from '../../lib/statistiche'
import { intervalloViaggio, ricavaViaggi, type Viaggio } from '../../lib/viaggi'
import { COLORI_ORIGINE, LOCALE, opzioneFuso, oggiISO, orarioEvento } from '../../lib/tempo'
import type { Evento } from '../../lib/types'
import { IconaAereo, IconaChevron, IconaLuogo } from '../../lib/icone'
import { MappaViaggi } from '../pannello/MappaViaggi'
import { TestataCard } from '../pannello/parti'
import { Tessera } from '../analitica/Tessere'

interface Props {
  onApriEvento: (ev: Evento) => void
}

// Trips — i viaggi non si inseriscono: si ricavano dagli eventi di categoria
// "viaggi" gia' presenti in calendario (soggiorni tutto-il-giorno + voli).
// Qui si guarda un anno alla volta: e' la finestra in cui un viaggio ha senso.
export function PaginaViaggi({ onApriEvento }: Props) {
  const { fuso, ricariche } = useStato()
  const [ancora, setAncora] = useState(() => oggiISO(fuso))
  const { eventi, precedenti, caricamento, errore, ricarica } = useDatiAnalytics('year', ancora, fuso)

  useEffect(() => {
    if (ricariche) ricarica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricariche])

  const oggi = oggiISO(fuso)
  const anno = DateTime.fromISO(ancora, { zone: fuso }).year

  // I calendari spuntati non filtrano qui: questa pagina E' la categoria viaggi,
  // nasconderla dalla sidebar non deve svuotarla.
  const d = useMemo(() => {
    const viaggi = ricavaViaggi(eventi, fuso)
    const luoghi = viaggi.filter((v) => v.luogo)
    return {
      viaggi,
      precedenti: ricavaViaggi(precedenti, fuso).length,
      giorni: viaggi.reduce((n, v) => n + v.giorni, 0),
      citta: new Set(viaggi.map((v) => v.destinazione)).size,
      paesi: new Set(luoghi.map((v) => v.luogo!.paese)).size,
      // Cos'altro c'era in agenda mentre si era via: il lavoro non si ferma
      // perche' si cambia fuso, ed e' la domanda vera quando si pianifica.
      altriEventi: (v: Viaggio) =>
        eventi.filter(
          (e) =>
            e.origine !== 'viaggi' &&
            e.stato === 'confermato' &&
            DateTime.fromISO(e.inizio_utc, { zone: 'utc' }).setZone(fuso).toISODate()! >= v.da &&
            DateTime.fromISO(e.inizio_utc, { zone: 'utc' }).setZone(fuso).toISODate()! <= v.a,
        ).length,
    }
  }, [eventi, precedenti, fuso])

  const futuri = d.viaggi.filter((v) => v.a >= oggi)
  const passati = d.viaggi.filter((v) => v.a < oggi).reverse()

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
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="card flex flex-wrap items-center gap-3 px-[18px] py-[15px]">
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setAncora(spostaPeriodo('year', ancora, -1, fuso))}
                className="btn-neutro premibile h-10 w-10"
                aria-label="Previous year"
              >
                <IconaChevron size={18} verso="sx" />
              </button>
              <button
                onClick={() => setAncora(spostaPeriodo('year', ancora, 1, fuso))}
                className="btn-neutro premibile h-10 w-10"
                aria-label="Next year"
              >
                <IconaChevron size={18} verso="dx" />
              </button>
            </div>
            <h2 className="min-w-0 flex-1 truncate pl-1 text-[22px] font-bold">{anno}</h2>
            <button
              onClick={() => setAncora(oggi)}
              disabled={anno === DateTime.fromISO(oggi).year}
              className="btn-neutro premibile h-[42px] shrink-0 px-[18px] disabled:opacity-45"
            >
              This year
            </button>
          </section>

          {errore && (
            <p
              className="rounded-[12px] px-3 py-2.5 text-center text-[12.5px]"
              style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' }}
            >
              Offline — trips are built from the events on the server.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tessera
              etichetta="Trips"
              valore={String(d.viaggi.length)}
              colore={COLORI_ORIGINE.viaggi.punto}
              nota={`${d.precedenti} in ${anno - 1}`}
            />
            <Tessera etichetta="Days away" valore={String(d.giorni)} nota={`out of ${DateTime.fromObject({ year: anno }).daysInYear}`} />
            <Tessera etichetta="Destinations" valore={String(d.citta)} />
            <Tessera etichetta="Countries" valore={String(d.paesi)} />
          </div>

          <section className="card overflow-hidden">
            <TestataCard titolo="Where you went">
              <span className="shrink-0 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                from {opzioneFuso(fuso).etichetta}
              </span>
            </TestataCard>
            <div className="px-[18px] pt-1 pb-[18px]">
              <MappaViaggi viaggi={d.viaggi} fuso={fuso} />
              {d.viaggi.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...new Set(d.viaggi.map((v) => v.destinazione))].map((c) => (
                    <span
                      key={c}
                      className="rounded-[9px] px-2.5 py-1 text-[12.5px] font-medium"
                      style={{ background: 'var(--controllo)', color: 'var(--testo-2)' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[420px]">
          <Elenco
            titolo="Upcoming"
            viaggi={futuri}
            vuoto={`Nothing booked for the rest of ${anno}.`}
            fuso={fuso}
            oggi={oggi}
            altri={d.altriEventi}
            onApriEvento={onApriEvento}
          />
          <Elenco
            titolo={anno === DateTime.fromISO(oggi).year ? 'Earlier this year' : 'Trips'}
            viaggi={passati}
            vuoto={`No trips before today in ${anno}.`}
            fuso={fuso}
            oggi={oggi}
            altri={d.altriEventi}
            onApriEvento={onApriEvento}
          />
        </aside>
      </div>
    </div>
  )
}

function Elenco({
  titolo,
  viaggi,
  vuoto,
  fuso,
  oggi,
  altri,
  onApriEvento,
}: {
  titolo: string
  viaggi: Viaggio[]
  vuoto: string
  fuso: string
  oggi: string
  altri: (v: Viaggio) => number
  onApriEvento: (ev: Evento) => void
}) {
  return (
    <section className="card overflow-hidden">
      <TestataCard titolo={titolo}>
        <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
          {viaggi.length}
        </span>
      </TestataCard>
      {viaggi.length === 0 ? (
        <p className="px-[18px] pt-1 pb-5 text-[13px]" style={{ color: 'var(--testo-3)' }}>
          {vuoto}
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-[18px] pt-1 pb-[18px]">
          {viaggi.map((v) => (
            <SchedaViaggio key={v.id} v={v} fuso={fuso} oggi={oggi} altri={altri(v)} onApriEvento={onApriEvento} />
          ))}
        </div>
      )}
    </section>
  )
}

// Quanto manca (o quanto e' passato) in parole: "in 12 days", "ongoing".
function quando(v: Viaggio, oggi: string): string {
  if (oggi >= v.da && oggi <= v.a) return 'Ongoing'
  const giorni = Math.round(DateTime.fromISO(v.da).diff(DateTime.fromISO(oggi), 'days').days)
  if (giorni === 1) return 'Tomorrow'
  if (giorni > 1) return `In ${giorni} days`
  const passati = Math.round(DateTime.fromISO(oggi).diff(DateTime.fromISO(v.a), 'days').days)
  return passati <= 1 ? 'Just back' : `${passati} days ago`
}

function SchedaViaggio({
  v,
  fuso,
  oggi,
  altri,
  onApriEvento,
}: {
  v: Viaggio
  fuso: string
  oggi: string
  altri: number
  onApriEvento: (ev: Evento) => void
}) {
  const inCorso = oggi >= v.da && oggi <= v.a
  return (
    <article
      className="rounded-[14px] p-3"
      style={{ background: 'var(--controllo)', border: inCorso ? '1.5px solid var(--cat-viaggi)' : '1px solid transparent' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-[1px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi)' }}
        >
          <IconaAereo size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{v.destinazione}</p>
          <p className="mt-[3px] text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
            {intervalloViaggio(v)} · {v.giorni} {v.giorni === 1 ? 'day' : 'days'}
          </p>
        </div>
        <span
          className="shrink-0 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
          style={{
            background: inCorso ? 'var(--cat-viaggi)' : 'var(--card)',
            color: inCorso ? '#fff' : 'var(--testo-2)',
          }}
        >
          {quando(v, oggi)}
        </span>
      </div>

      {v.eventi.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {v.eventi.map((ev) => {
            const i = DateTime.fromISO(ev.inizio_utc, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE)
            return (
              <button
                key={ev.id}
                onClick={() => onApriEvento(ev)}
                className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--card)]"
              >
                <span className="shrink-0" style={{ color: 'var(--testo-3)' }}>
                  <IconaLuogo size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{ev.titolo}</span>
                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                  {i.toFormat('d LLL')} · {orarioEvento(ev, fuso).principale.replace('–', ' – ')}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {altri > 0 && (
        <p className="mt-2 pl-2 text-[12px]" style={{ color: 'var(--testo-3)' }}>
          {altri} other {altri === 1 ? 'event' : 'events'} on the calendar during this trip
        </p>
      )}
    </article>
  )
}
