import { useState } from 'react'
import { NOME_PERIODO, type Periodo } from '../../lib/statistiche'
import { IconaChevron, IconaSpunta } from '../../lib/icone'

// Testata di una card del pannello destro: titolo a sinistra, azione o
// selettore a destra ("Time distribution ... This month ▾").
export function TestataCard({ titolo, children }: { titolo: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-[17px]">
      <h3 className="text-[16px] font-bold">{titolo}</h3>
      {children}
    </div>
  )
}

const PERIODI: Periodo[] = ['week', 'month', 'year']

// Pillola "This month ▾" della reference.
export function SelettorePeriodo({ valore, onCambia }: { valore: Periodo; onCambia: (p: Periodo) => void }) {
  const [aperto, setAperto] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAperto((v) => !v)}
        className="btn-neutro premibile flex h-[30px] items-center gap-1.5 px-2.5 text-[12.5px]"
      >
        {NOME_PERIODO[valore]}
        <IconaChevron size={14} verso={aperto ? 'su' : 'giu'} />
      </button>
      {aperto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAperto(false)} />
          <div
            className="anim-fade absolute right-0 top-[calc(100%+5px)] z-50 w-[160px] overflow-hidden rounded-[12px] p-1.5"
            style={{ background: 'var(--card)', border: '1px solid var(--linea)', boxShadow: 'var(--ombra-card)' }}
          >
            {PERIODI.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onCambia(p)
                  setAperto(false)
                }}
                className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-[var(--hover)]"
                style={p === valore ? { background: 'var(--tenue)', color: 'var(--primario)', fontWeight: 600 } : undefined}
              >
                <span className="flex-1">{NOME_PERIODO[p]}</span>
                {p === valore && <IconaSpunta size={13} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Stato vuoto compatto, dentro una card.
export function Vuoto({ testo }: { testo: string }) {
  return (
    <p className="px-[18px] pb-5 pt-1 text-[13px]" style={{ color: 'var(--testo-3)' }}>
      {testo}
    </p>
  )
}

// Riga etichetta/valore: il valore sempre a destra e in cifre tabulari, cosi'
// la colonna dei numeri resta allineata. Usata da Analytics, Trips e Settings.
export function RigaValore({
  etichetta,
  valore,
  sotto,
  colore,
  azione,
}: {
  etichetta: string
  valore?: string
  sotto?: string
  colore?: string
  azione?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 py-[9px]" style={{ borderTop: '1px solid var(--linea)' }}>
      {colore && (
        <span className="h-[8px] w-[8px] shrink-0 translate-y-[-1px] rounded-full" style={{ background: colore }} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
          {etichetta}
        </span>
        {sotto && (
          <span className="mt-[2px] block text-[11.5px] tabular-nums" style={{ color: 'var(--testo-3)' }}>
            {sotto}
          </span>
        )}
      </span>
      {valore && <span className="shrink-0 text-[15px] font-semibold tabular-nums">{valore}</span>}
      {azione}
    </div>
  )
}
