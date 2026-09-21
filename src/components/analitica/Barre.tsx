import { COLORI_ORIGINE, nomeBreve } from '../../lib/tempo'
import { ORIGINI } from '../../lib/stato'
import { fmtOre } from '../../lib/statistiche'
import type { Barra } from '../../lib/analitica'

interface Props {
  dati: Barra[]
  altezza?: number
  // Ogni quante colonne scrivere l'etichetta sotto: con 31 giorni scriverle
  // tutte le renderebbe illeggibili.
  passoEtichette?: number
}

// Tetto dell'asse: il primo valore "tondo" sopra il massimo, così la griglia
// non riporta mai numeri come 7.3h.
function tetto(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  for (const p of [1, 2, 2.5, 5, 10]) if (v <= p * exp) return p * exp
  return 10 * exp
}

// Istogramma impilato per categoria: una colonna per giorno (o per mese
// nell'anno). Niente libreria: sono div e percentuali, e resta coerente col
// resto del design system.
export function Barre({ dati, altezza = 168, passoEtichette = 1 }: Props) {
  const max = tetto(Math.max(...dati.map((b) => b.totale), 0))
  const spazio = dati.length <= 12 ? 8 : dati.length <= 20 ? 5 : 3

  return (
    <div className="w-full">
      <div className="relative" style={{ height: altezza }}>
        {[0, 0.5, 1].map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute right-0 left-[34px]"
            style={{ bottom: `${t * 100}%`, borderTop: '1px solid var(--linea)' }}
          />
        ))}
        {[0, 0.5, 1].map((t) => (
          <span
            key={t}
            className="absolute left-0 w-[26px] text-right text-[10.5px] tabular-nums"
            style={{ bottom: `${t * 100}%`, transform: 'translateY(50%)', color: 'var(--testo-3)' }}
          >
            {fmtOre(max * t)}
          </span>
        ))}

        <div className="absolute inset-y-0 right-0 left-[34px] flex items-end" style={{ gap: spazio }}>
          {dati.map((b) => (
            <Colonna key={b.chiave} barra={b} max={max} />
          ))}
        </div>
      </div>

      {/* Etichette posizionate sul centro della colonna invece che dentro di
          essa: con 31 giorni su un telefono la colonna è più stretta del
          numero, e un'etichetta tagliata a metà ("1" al posto di "16") sarebbe
          peggio di nessuna etichetta. */}
      <div className="relative mt-[7px] h-[15px] pl-[34px]">
        <div className="relative h-full">
          {dati.map((b, i) =>
            i % passoEtichette === 0 || b.corrente ? (
              <span
                key={b.chiave}
                className="absolute top-0 whitespace-nowrap text-[11px] tabular-nums"
                style={{
                  left: `${((i + 0.5) / dati.length) * 100}%`,
                  transform: 'translateX(-50%)',
                  color: b.corrente ? 'var(--primario)' : 'var(--testo-3)',
                  fontWeight: b.corrente ? 650 : 400,
                }}
              >
                {b.etichetta}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  )
}

function Colonna({ barra, max }: { barra: Barra; max: number }) {
  const dettaglio = ORIGINI.filter((o) => barra.ore[o] > 0.01)
    .map((o) => `${nomeBreve(o)} ${fmtOre(barra.ore[o])}h`)
    .join(' · ')
  const titolo = barra.totale > 0 ? `${barra.etichettaLunga} — ${fmtOre(barra.totale)}h (${dettaglio})` : `${barra.etichettaLunga} — free`

  if (barra.totale <= 0) {
    return (
      <span
        title={titolo}
        className="min-w-0 flex-1 self-end rounded-[2px]"
        style={{ height: 3, background: 'var(--linea-2)' }}
      />
    )
  }

  return (
    <span
      title={titolo}
      className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-t-[5px] transition-opacity hover:opacity-80"
      style={{ height: `${Math.min(100, (barra.totale / max) * 100)}%` }}
    >
      {ORIGINI.filter((o) => barra.ore[o] > 0).map((o) => (
        <span
          key={o}
          className="block w-full"
          style={{ height: `${(barra.ore[o] / barra.totale) * 100}%`, background: COLORI_ORIGINE[o].punto }}
        />
      ))}
    </span>
  )
}

// Legenda orizzontale sotto un grafico: solo le categorie davvero presenti.
export function LegendaCategorie({ dati }: { dati: Barra[] }) {
  const presenti = ORIGINI.filter((o) => dati.some((b) => b.ore[o] > 0))
  if (!presenti.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {presenti.map((o) => (
        <span key={o} className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
          <span className="h-[8px] w-[8px] rounded-full" style={{ background: COLORI_ORIGINE[o].punto }} />
          {nomeBreve(o)}
        </span>
      ))}
    </div>
  )
}
