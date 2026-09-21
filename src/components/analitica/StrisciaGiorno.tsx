import { fmtOre } from '../../lib/statistiche'
import { GIORNATA_FINE, GIORNATA_INIZIO, type Barra } from '../../lib/analitica'

interface Props {
  carico: number[] // 24 valori, ore occupate per ora locale
  banda: { da: number; a: number; gira: boolean; testo: string } | null
}

// Quando cade davvero la giornata, sull'asse locale. È la schermata che dice
// la cosa che il prodotto esiste per dire: gli impegni ancorati a Roma non
// stanno dentro la giornata di Singapore, e qui si vede di quanto.
export function StrisciaGiorno({ carico, banda }: Props) {
  const max = Math.max(...carico, 0.0001)
  const ore = Array.from({ length: 24 }, (_, h) => h)

  return (
    <div className="w-full">
      <div className="flex gap-[2px]">
        {ore.map((h) => {
          const t = carico[h] / max
          return (
            <span
              key={h}
              title={`${String(h).padStart(2, '0')}:00 — ${carico[h] > 0.01 ? `${fmtOre(carico[h])}h busy` : 'free'}`}
              className="relative h-[44px] min-w-0 flex-1 overflow-hidden rounded-[5px]"
              style={{ background: 'var(--controllo)' }}
            >
              {carico[h] > 0 && (
                <span
                  className="absolute inset-0"
                  style={{ background: 'var(--primario)', opacity: 0.16 + t * 0.84 }}
                />
              )}
            </span>
          )
        })}
      </div>

      <div className="mt-[6px] flex gap-[2px]">
        {ore.map((h) => (
          <span
            key={h}
            className="min-w-0 flex-1 text-center text-[10.5px] tabular-nums"
            style={{ color: 'var(--testo-3)' }}
          >
            {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-[5px]">
        <Rotaia da={GIORNATA_INIZIO} a={GIORNATA_FINE} colore="var(--linea-2)" />
        {banda && <Rotaia da={banda.da} a={banda.a} gira={banda.gira} colore="var(--cat-lavoro)" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
        <span className="flex items-center gap-2">
          <span className="h-[4px] w-[16px] rounded-full" style={{ background: 'var(--linea-2)' }} />
          Your day {String(GIORNATA_INIZIO).padStart(2, '0')}:00–{GIORNATA_FINE}:00
        </span>
        {banda && (
          <span className="flex items-center gap-2">
            <span className="h-[4px] w-[16px] rounded-full" style={{ background: 'var(--cat-lavoro)' }} />
            {banda.testo}
          </span>
        )}
      </div>
    </div>
  )
}

// Una fascia oraria disegnata sotto la striscia. `gira` = la fascia scavalca la
// mezzanotte (l'ufficio di Roma visto da Singapore finisce il giorno dopo).
function Rotaia({ da, a, gira, colore }: { da: number; a: number; gira?: boolean; colore: string }) {
  const seg = gira
    ? [
        [da, 24],
        [0, a],
      ]
    : [[da, a]]
  return (
    <div className="relative h-[4px] w-full">
      {seg.map(([x, y], i) => (
        <span
          key={i}
          className="absolute top-0 h-[4px] rounded-full"
          style={{ left: `${(x / 24) * 100}%`, width: `${((y - x) / 24) * 100}%`, background: colore }}
        />
      ))}
    </div>
  )
}

// Riga di riepilogo sotto la striscia: la giornata più carica del periodo.
export function PiuCarica({ barra, etichetta }: { barra: Barra | null; etichetta: string }) {
  if (!barra) return null
  return (
    <p className="text-[13px]" style={{ color: 'var(--testo-2)' }}>
      {etichetta} <strong className="font-semibold" style={{ color: 'var(--testo)' }}>{barra.etichettaLunga}</strong> ·{' '}
      <span className="tabular-nums">{fmtOre(barra.totale)}h</span>
    </p>
  )
}
