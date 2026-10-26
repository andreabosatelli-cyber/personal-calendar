import { SOGLIA_CORSO, SOGLIA_MESE, fmtOre, fmtPct, nomeMese, testoLezioni, type Impatto } from '../../lib/frequenza'

// Cosa costa un viaggio in lezioni: elenco delle lezioni perse, frequenza del
// mese contro il 90% e ore perse per corso contro il 10%. Senza lezioni perse,
// un'etichetta verde "No classes missed".

const soglia = (x: number) => `${Math.round(x * 100)}%`
const limite = (x: number, s: number) => Math.abs(x - s) < 1e-9

export function AvvisoLezioni({ impatto }: { impatto: Impatto }) {
  if (!impatto.lezioni.length) return <EtichettaPulita />

  return (
    <div
      className="flex flex-col gap-1.5 rounded-[18px] px-3.5 py-3"
      style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' }}
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">
          ⚠️ You'll miss: {testoLezioni(impatto.lezioni)} ({fmtOre(impatto.ore)})
        </p>
        {impatto.sotto90 && (
          <span
            className="shrink-0 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
            style={{ background: 'var(--badge-bg)', color: 'var(--badge-fg)' }}
          >
            Below 90%
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-0.5 text-[12.5px] leading-snug tabular-nums">
        {impatto.mesi.map((m) => (
          <li key={m.mese} className={m.sotto ? 'font-semibold' : undefined}>
            {nomeMese(m.mese)}: {fmtOre(m.perse)} missed of {fmtOre(m.totali)} → {fmtPct(m.presenza)} attendance
            {m.sotto ? ` (below ${soglia(SOGLIA_MESE)})` : limite(m.presenza, SOGLIA_MESE) ? ' (at the limit)' : ` (min ${soglia(SOGLIA_MESE)})`}
          </li>
        ))}
        {impatto.corsi.map((c) => (
          <li key={c.corso} className={c.sopra ? 'font-semibold' : undefined} title={c.corso}>
            {c.sigla}: {fmtOre(c.perse)} of {fmtOre(c.totali)} → {fmtPct(c.quota)} missed
            {c.sopra ? ` (over ${soglia(SOGLIA_CORSO)})` : limite(c.quota, SOGLIA_CORSO) ? ' (at the limit)' : ` (max ${soglia(SOGLIA_CORSO)})`}
          </li>
        ))}
      </ul>

      {impatto.altriViaggi && (
        <p className="text-[12px] opacity-80">Includes classes missed on your other booked trips.</p>
      )}
    </div>
  )
}

export function EtichettaPulita() {
  return (
    <span
      className="self-start rounded-[8px] px-2 py-1 text-[12px] font-medium"
      style={{ background: 'var(--cond-1-bg)', color: 'var(--cond-1-fg)' }}
    >
      No classes missed
    </span>
  )
}
