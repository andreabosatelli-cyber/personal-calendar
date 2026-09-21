import { nomeBreve } from '../../lib/tempo'
import type { Distribuzione, Periodo } from '../../lib/statistiche'
import { Donut, LegendaDonut } from './Donut'
import { SelettorePeriodo, TestataCard, Vuoto } from './parti'
import { IconaChevron } from '../../lib/icone'

interface Props {
  dist: Distribuzione
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  // Collasso della colonna destra: sta qui, in cima alla prima card, come il
  // gemello che nasconde la sidebar sta in cima alla sidebar.
  onNascondi?: () => void
}

// "Time distribution": donut compatto a sinistra, legenda con le percentuali
// a destra. Le ore vengono dagli eventi reali del periodo scelto.
export function CardDistribuzione({ dist, periodo, onPeriodo, onNascondi }: Props) {
  const haOre = dist.totaleOre > 0
  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Time distribution">
        <SelettorePeriodo valore={periodo} onCambia={onPeriodo} />
        {onNascondi && (
          <button
            onClick={onNascondi}
            className="btn-neutro premibile h-[30px] w-[30px] shrink-0"
            aria-label="Hide side panel"
            title="Hide side panel"
          >
            <IconaChevron size={15} verso="dx" />
          </button>
        )}
      </TestataCard>
      {haOre ? (
        <div className="flex items-center gap-4 px-[18px] pb-[18px] pt-1">
          <Donut quote={dist.quote} totaleOre={dist.totaleOre} />
          <LegendaDonut quote={dist.quote} nomi={nomeBreve} />
        </div>
      ) : (
        <Vuoto testo="No scheduled hours in this period." />
      )}
    </section>
  )
}
