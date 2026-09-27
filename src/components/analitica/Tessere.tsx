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
    <div className="card flex min-w-0 flex-col justify-between p-5 lg:p-6">
      <span className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.02em]" style={{ color: 'var(--testo)' }}>
        {colore && <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: colore }} />}
        <span className="min-w-0 truncate">{etichetta}</span>
      </span>
      <span className="mt-4 flex items-baseline gap-1 leading-none">
        <span className="numero-kpi text-[40px] lg:text-[48px]">
          {valore}
        </span>
        {unita && (
          <span className="text-[18px] font-medium" style={{ color: 'var(--testo-2)' }}>
            {unita}
          </span>
        )}
      </span>
      <span className="mt-3 truncate text-[13px]" style={{ color: 'var(--testo-2)' }}>
        {nota ?? ' '}
      </span>
    </div>
  )
}
