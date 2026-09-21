import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { FUSI, opzioneFuso, tuttiIFusi } from '../lib/tempo'
import { IconaSpunta } from '../lib/icone'

interface Props {
  valore: string | null
  onCambia: (fuso: string) => void
  // Voce "nessuno" in cima: serve al fuso di riferimento, che è opzionale.
  vuoto?: { etichetta: string; sotto?: string; onScegli: () => void }
  // Quante righe mostrare prima di chiedere di cercare.
  massimo?: number
}

// Selettore di località. Le scorciatoie stanno in cima perché nel 90% dei casi
// bastano quelle; sotto c'è l'elenco IANA completo del browser, filtrabile,
// perché da quando chiunque può registrarsi l'utente può stare ovunque.
export function SelettoreFuso({ valore, onCambia, vuoto, massimo = 8 }: Props) {
  const [cerca, setCerca] = useState('')
  const adesso = DateTime.now()

  const elenco = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    if (!q) {
      // Senza ricerca: le scorciatoie, con il fuso scelto sempre in cima.
      // L'elenco e' troncato, e una selezione che cade sotto il taglio si
      // legge come "non ho ancora scelto niente".
      const ids = FUSI.map((f) => f.id)
      return valore ? [valore, ...ids.filter((id) => id !== valore)] : ids
    }
    return tuttiIFusi()
      .filter((id) => id.toLowerCase().replace(/_/g, ' ').includes(q))
      .slice(0, 40)
  }, [cerca, valore])

  const visibili = cerca.trim() ? elenco : elenco.slice(0, massimo)

  return (
    <div className="flex flex-col gap-1 px-2 pb-[14px]">
      <input
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
        placeholder="Search a city or region…"
        className="campo mx-1 mb-1.5"
        aria-label="Search timezone"
      />

      {vuoto && !cerca.trim() && (
        <button
          onClick={vuoto.onScegli}
          className="premibile flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
          style={valore === null ? { background: 'var(--tenue)' } : undefined}
          aria-pressed={valore === null}
        >
          <span className="text-[17px]">—</span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[14.5px] font-semibold"
              style={valore === null ? { color: 'var(--primario)' } : undefined}
            >
              {vuoto.etichetta}
            </span>
            {vuoto.sotto && (
              <span className="block text-[12px]" style={{ color: 'var(--testo-3)' }}>
                {vuoto.sotto}
              </span>
            )}
          </span>
          {valore === null && (
            <span className="shrink-0" style={{ color: 'var(--primario)' }}>
              <IconaSpunta size={15} />
            </span>
          )}
        </button>
      )}

      {visibili.map((id) => {
        const o = opzioneFuso(id)
        const attivo = id === valore
        return (
          <button
            key={id}
            onClick={() => onCambia(id)}
            className="premibile flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover)]"
            style={attivo ? { background: 'var(--tenue)' } : undefined}
            aria-pressed={attivo}
          >
            <span className="text-[17px]">{o.bandiera}</span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[14.5px] font-semibold"
                style={attivo ? { color: 'var(--primario)' } : undefined}
              >
                {o.etichetta}
              </span>
              <span className="block truncate text-[12px] tabular-nums" style={{ color: 'var(--testo-3)' }}>
                {id.replace(/_/g, ' ')}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-medium tabular-nums" style={{ color: 'var(--testo-2)' }}>
              {adesso.setZone(id).toFormat('HH:mm')}
            </span>
            {attivo && (
              <span className="shrink-0" style={{ color: 'var(--primario)' }}>
                <IconaSpunta size={15} />
              </span>
            )}
          </button>
        )
      })}

      {!cerca.trim() && elenco.length > massimo && (
        <p className="px-3 pt-1.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
          Anywhere else? Search above — every timezone is available.
        </p>
      )}
      {cerca.trim() && !visibili.length && (
        <p className="px-3 py-2 text-[13px]" style={{ color: 'var(--testo-3)' }}>
          No timezone matches “{cerca}”.
        </p>
      )}
    </div>
  )
}
