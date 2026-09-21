import { useLayoutEffect, useRef, useState } from 'react'
import { formattaDurata, minutiDa, slotDelGiorno } from '../lib/tempo'
import { IconaChevron, IconaSpunta } from '../lib/icone'

// Selettore orario a slot. Il picker nativo di iOS fa scegliere il minuto uno
// per uno: per un calendario è inutilizzabile, gli appuntamenti cadono sul
// quarto d'ora. Qui si sceglie da una lista di slot e basta.

const SLOT_H = 44 // tap target pieno, non una riga di testo

interface Props {
  etichetta: string
  valore: string // "HH:mm"
  onCambia: (v: string) => void
  aperto: boolean
  onApri: () => void
  // Minuti di offset da sommare a ogni slot per calcolarne la durata: serve al
  // campo End per scrivere "10:30 · 1h 30m" accanto a ogni scelta.
  durataDa?: number | null
  // Primo slot ammesso, escluso (il campo End non propone orari che finiscono
  // prima dell'inizio quando le due date coincidono).
  dopo?: string | null
}

export function SelettoreOra({ etichetta, valore, onCambia, aperto, onApri, durataDa, dopo }: Props) {
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
        {etichetta}
      </span>
      <button
        type="button"
        onClick={onApri}
        aria-expanded={aperto}
        aria-label={`${etichetta}: ${valore}`}
        className="campo premibile flex min-h-[46px] items-center justify-between gap-2 text-left tabular-nums"
        style={aperto ? { background: 'var(--card)', borderColor: 'var(--primario)' } : undefined}
      >
        <span className="truncate text-[15px] font-semibold">{valore}</span>
        <IconaChevron size={15} verso={aperto ? 'su' : 'giu'} className="shrink-0 text-[var(--testo-3)]" />
      </button>
      {aperto && <Lista valore={valore} onCambia={onCambia} durataDa={durataDa} dopo={dopo} />}
    </div>
  )
}

function Lista({
  valore,
  onCambia,
  durataDa,
  dopo,
}: {
  valore: string
  onCambia: (v: string) => void
  durataDa?: number | null
  dopo?: string | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [slot] = useState(() => {
    const base = slotDelGiorno()
    // Un evento già salvato può avere un orario fuori griglia (le 09:20 di un
    // feed ICS): lo si tiene selezionabile invece di spostarlo di nascosto.
    return base.includes(valore) ? base : [...base, valore].sort()
  })

  const ammessi = dopo ? slot.filter((s) => minutiDa(s) > minutiDa(dopo)) : slot

  // La lista si apre già ferma sullo slot scelto: scorrere fino alle 14:00
  // partendo da mezzanotte sarebbe la stessa fatica del picker nativo.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const i = ammessi.indexOf(valore)
    const idx = i >= 0 ? i : 0
    el.scrollTop = Math.max(0, idx * SLOT_H - el.clientHeight / 2 + SLOT_H / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ammessi.length) {
    return (
      <p className="mt-2 text-[12.5px]" style={{ color: 'var(--testo-3)' }}>
        No slot left in the day — move the end to the next day.
      </p>
    )
  }

  return (
    <div
      ref={box}
      role="listbox"
      className="scroll-fine mt-2 overflow-y-auto overscroll-contain rounded-[12px]"
      style={{ maxHeight: SLOT_H * 5, background: 'var(--controllo)' }}
    >
      {ammessi.map((s) => {
        const sel = s === valore
        const durata = durataDa != null ? formattaDurata(minutiDa(s) - durataDa) : ''
        return (
          <button
            key={s}
            type="button"
            role="option"
            aria-selected={sel}
            onClick={() => onCambia(s)}
            className="flex w-full items-center gap-2 px-3.5 text-left text-[14.5px] tabular-nums transition-colors hover:bg-[var(--hover)]"
            style={{
              height: SLOT_H,
              color: sel ? 'var(--primario)' : 'var(--testo)',
              fontWeight: sel ? 650 : 500,
              background: sel ? 'var(--tenue)' : undefined,
            }}
          >
            <span>{s}</span>
            {durata && (
              <span className="text-[13px]" style={{ color: 'var(--testo-2)' }}>
                · {durata}
              </span>
            )}
            {sel && (
              <span className="ml-auto" style={{ color: 'var(--primario)' }}>
                <IconaSpunta size={13} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
