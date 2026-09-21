import { COLORI_ORIGINE } from '../../lib/tempo'
import { fmtOre, percentualiIntere, type Quota } from '../../lib/statistiche'
import type { Origine } from '../../lib/types'

interface Props {
  quote: Quota[]
  totaleOre: number
  dimensione?: number
  spessore?: number
  etichetta?: string
}

// Donut della reference: anello a segmenti pieni, totale al centro.
// Misure prese dallo screenshot: diametro esterno 118, anello 18.
export function Donut({ quote, totaleOre, dimensione = 118, spessore = 18, etichetta = 'Total' }: Props) {
  const r = (dimensione - spessore) / 2
  const C = 2 * Math.PI * r
  const con = quote.filter((q) => q.ore > 0)
  const pct = percentualiIntere(con)

  // Ogni segmento parte dove finisce il precedente: l'offset è la somma delle
  // lunghezze che lo precedono.
  const lunghezze = con.map((q) => (totaleOre > 0 ? (q.ore / totaleOre) * C : 0))
  const segmenti = con.map((q, i) => ({
    q,
    lunghezza: lunghezze[i],
    offset: lunghezze.slice(0, i).reduce((a, b) => a + b, 0),
    pct: pct[i],
  }))

  return (
    <div className="relative shrink-0" style={{ width: dimensione, height: dimensione }}>
      <svg width={dimensione} height={dimensione} viewBox={`0 0 ${dimensione} ${dimensione}`} aria-hidden="true">
        <g transform={`rotate(-90 ${dimensione / 2} ${dimensione / 2})`}>
          <circle
            cx={dimensione / 2}
            cy={dimensione / 2}
            r={r}
            fill="none"
            stroke="var(--controllo)"
            strokeWidth={spessore}
          />
          {segmenti.map(({ q, lunghezza, offset }) => (
            <circle
              key={q.origine}
              cx={dimensione / 2}
              cy={dimensione / 2}
              r={r}
              fill="none"
              stroke={COLORI_ORIGINE[q.origine].punto}
              strokeWidth={spessore}
              strokeDasharray={`${lunghezza} ${C - lunghezza}`}
              strokeDashoffset={-offset}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[24px] font-bold tabular-nums" style={{ letterSpacing: '-0.03em' }}>
          {fmtOre(totaleOre)}h
        </span>
        <span className="mt-1 text-[11.5px]" style={{ color: 'var(--testo-2)' }}>
          {etichetta}
        </span>
      </div>
    </div>
  )
}

// Legenda a fianco del donut: pallino, nome della categoria, percentuale.
export function LegendaDonut({
  quote,
  nomi,
  mostraOre,
}: {
  quote: Quota[]
  nomi: (o: Origine) => string
  mostraOre?: boolean
}) {
  const con = quote.filter((q) => q.ore > 0)
  const pct = percentualiIntere(con)
  if (!con.length) return null
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
      {con.map((q, i) => (
        <div key={q.origine} className="flex items-center gap-2.5 text-[13.5px]">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: COLORI_ORIGINE[q.origine].punto }}
          />
          <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--testo-2)' }}>
            {nomi(q.origine)}
          </span>
          {mostraOre && (
            <span className="tabular-nums" style={{ color: 'var(--testo-3)' }}>
              {fmtOre(q.ore)}h
            </span>
          )}
          <span className="shrink-0 font-semibold tabular-nums">{pct[i]}%</span>
        </div>
      ))}
    </div>
  )
}
