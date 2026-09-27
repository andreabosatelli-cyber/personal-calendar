import { useState } from 'react'
import { NOME_PERIODO, type Periodo } from '../../lib/statistiche'
import { IconaChevron, IconaSpunta } from '../../lib/icone'

// Testata di una card del pannello destro: titolo a sinistra, azione o
// selettore a destra ("Time distribution ... This month ▾").
// `stretta`: per le card della colonna destra (335px), dove titolo, selettore
// e pulsante devono stare su una riga sola.
export function TestataCard({ titolo, stretta, children }: { titolo: string; stretta?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between px-5 pb-3 pt-5 ${stretta ? 'gap-2' : 'gap-3 lg:px-6 lg:pt-6'}`}>
      <h3 className={`font-medium leading-tight tracking-[-0.02em] ${stretta ? 'whitespace-nowrap text-[17px]' : 'text-[20px]'}`}>{titolo}</h3>
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
        className="btn-neutro premibile flex h-11 items-center gap-1.5 px-3.5 text-[13.5px]"
      >
        {NOME_PERIODO[valore]}
        <IconaChevron size={14} verso={aperto ? 'su' : 'giu'} />
      </button>
      {aperto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAperto(false)} />
          <div
            className="anim-fade absolute right-0 top-[calc(100%+5px)] z-50 w-[160px] overflow-hidden rounded-[22px] p-1.5"
            style={{ background: 'var(--pagina)', boxShadow: 'var(--ombra-galleggia)' }}
          >
            {PERIODI.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onCambia(p)
                  setAperto(false)
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-full px-3 py-1.5 text-left text-[14px] transition-colors hover:bg-[var(--hover)]"
                style={p === valore ? { background: 'var(--card)', color: 'var(--testo)', fontWeight: 500 } : undefined}
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
    <p className="px-5 pb-6 pt-1 text-[14px] lg:px-6" style={{ color: 'var(--testo-2)' }}>
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
    <div className="flex items-baseline gap-3 py-3" style={{ borderTop: '1px solid var(--linea)' }}>
      {colore && (
        <span className="h-[8px] w-[8px] shrink-0 translate-y-[-1px] rounded-full" style={{ background: colore }} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px]" style={{ color: 'var(--testo-2)' }}>
          {etichetta}
        </span>
        {sotto && (
          <span className="mt-[3px] block text-[12.5px] tabular-nums" style={{ color: 'var(--testo-3)' }}>
            {sotto}
          </span>
        )}
      </span>
      {valore && <span className="shrink-0 text-[20px] font-medium tabular-nums tracking-[-0.02em]">{valore}</span>}
      {azione}
    </div>
  )
}
