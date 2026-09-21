import { intervalloViaggio, type Viaggio } from '../../lib/viaggi'
import { IconaAereo, IconaChevron } from '../../lib/icone'
import { MappaViaggi } from './MappaViaggi'
import { SelettorePeriodo, TestataCard, Vuoto } from './parti'
import type { Periodo } from '../../lib/statistiche'

interface Props {
  viaggi: Viaggio[]
  fuso: string
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  onApri: (v: Viaggio) => void
}

// "Trips": mappa piccola con le rotte, poi le tappe con le date.
export function CardViaggi({ viaggi, fuso, periodo, onPeriodo, onApri }: Props) {
  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Trips">
        <SelettorePeriodo valore={periodo} onCambia={onPeriodo} />
      </TestataCard>

      <div className="px-[18px] pb-1">
        <MappaViaggi viaggi={viaggi} fuso={fuso} />
      </div>

      {viaggi.length === 0 ? (
        <Vuoto testo="No trips in this period." />
      ) : (
        <div className="px-2 pb-2.5 pt-1">
          {viaggi.slice(0, 4).map((v) => (
            <button
              key={v.id}
              onClick={() => onApri(v)}
              className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-[9px] text-left transition-colors hover:bg-[var(--hover)]"
            >
              <span className="shrink-0" style={{ color: 'var(--cat-viaggi)' }}>
                <IconaAereo size={19} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{v.destinazione}</span>
              <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                {intervalloViaggio(v)}
              </span>
              <IconaChevron size={16} verso="dx" className="shrink-0" style={{ color: 'var(--testo-3)' }} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
