interface Props {
  etichetta: string
  valore: string
  unita?: string
  colore?: string
  nota?: string
}

// Tessera di riepilogo: etichetta piccola, numero grande, confronto in basso.
// Un numero solo per tessera — la reference non ammette cruscotti densi.
export function Tessera({ etichetta, valore, unita, colore, nota }: Props) {
  return (
    <div className="card flex min-w-0 flex-col justify-between p-[15px]">
      <span className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
        {colore && <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: colore }} />}
        <span className="min-w-0 truncate">{etichetta}</span>
      </span>
      <span className="mt-[10px] flex items-baseline gap-[3px] leading-none">
        <span className="text-[26px] font-bold tabular-nums" style={{ letterSpacing: '-0.03em' }}>
          {valore}
        </span>
        {unita && (
          <span className="text-[14px] font-semibold" style={{ color: 'var(--testo-2)' }}>
            {unita}
          </span>
        )}
      </span>
      <span className="mt-[7px] truncate text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
        {nota ?? ' '}
      </span>
    </div>
  )
}
