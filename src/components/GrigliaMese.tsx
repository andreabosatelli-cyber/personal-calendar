import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import { LOCALE, coloreEvento, eSoggiorno, oggiISO, orarioEvento, vaInFascia } from '../lib/tempo'
import { IconaAereo } from '../lib/icone'
import { useTrascinaEvento, type Trascinamento } from '../hooks/useTrascinaEvento'
import { trascinabile } from '../lib/spostamento'

interface Props {
  perGiorno: Record<string, Evento[]>
  giorni: string[]
  ancora: string // un giorno del mese "corrente" (per grigiare gli altri)
  fuso: string
  onApri: (ev: Evento) => void
  onApriGiorno: (giornoISO: string) => void
  // Nel mese si trascina di giornate intere: l'ora resta quella.
  onSposta?: (ev: Evento, minuti: number, giorno: string | null) => void
}

const GIORNI_SETT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const H_CHIP = 44 // altezza di un blocco evento (titolo + orario), come nella reference
const H_CHIP_COMPATTO = 20 // ripiego quando la riga è bassa: solo pallino + titolo
const GAP_CHIP = 5
const H_BARRA = 21 // barra continua di un soggiorno
const H_TESTATA_CELLA = 32 // spazio del numero del giorno

// Un evento che copre più giornate è UNA barra continua sulle colonne che
// attraversa, non una chip ripetuta in ogni cella: dice "dove sono in quei
// giorni". Stessa scelta già fatta nella vista settimana, e vale sia per i
// tutto-il-giorno sia per i multi-giorno con orari.
interface Barra {
  ev: Evento
  da: number // indice colonna 0-6 dentro la settimana
  a: number
  corsia: number
}

function disponiBarre(sett: string[], perGiorno: Record<string, Evento[]>): Barra[] {
  const estremi = new Map<string, { ev: Evento; da: number; a: number }>()
  sett.forEach((g, i) => {
    for (const ev of perGiorno[g] ?? []) {
      if (!vaInFascia(ev)) continue
      const gia = estremi.get(ev.id)
      if (gia) gia.a = i
      else estremi.set(ev.id, { ev, da: i, a: i })
    }
  })
  const ordinate = [...estremi.values()].sort((x, y) => x.da - y.da || y.a - y.da - (x.a - x.da))
  const corsie: number[] = [] // ultima colonna occupata da ciascuna corsia
  return ordinate.map((b) => {
    let corsia = corsie.findIndex((ultima) => b.da > ultima)
    if (corsia === -1) {
      corsia = corsie.length
      corsie.push(-1)
    }
    corsie[corsia] = b.a
    return { ...b, corsia }
  })
}

export function GrigliaMese({ perGiorno, giorni, ancora, fuso, onApri, onApriGiorno, onSposta }: Props) {
  const { trascina, handlers } = useTrascinaEvento({
    modo: 'giorni',
    onClick: onApri,
    onSposta: (ev, minuti, giorno) => onSposta?.(ev, minuti, giorno),
  })
  const oggi = oggiISO(fuso)
  const meseCorrente = DateTime.fromISO(ancora, { zone: fuso }).month
  const settimane = useMemo(() => {
    const out: string[][] = []
    for (let i = 0; i < giorni.length; i += 7) out.push(giorni.slice(i, i + 7))
    return out
  }, [giorni])

  const barrePerSettimana = useMemo(
    () => settimane.map((sett) => disponiBarre(sett, perGiorno)),
    [settimane, perGiorno],
  )

  // Quanti blocchi entrano in una cella senza far crescere la griglia: si misura
  // l'altezza reale invece di fissare un numero, così a schermo alto si vede di
  // più e a schermo basso non si sfonda il layout.
  const corpoRef = useRef<HTMLDivElement>(null)
  const [hRiga, setHRiga] = useState(148)
  // Su telefono una cella e' larga ~50px: una chip di testo diventa "T ...".
  // Sotto la soglia si mostrano i pallini delle categorie, come fa il
  // calendario di sistema; il giorno resta toccabile per aprire il dettaglio.
  const [stretto, setStretto] = useState(false)
  useEffect(() => {
    const el = corpoRef.current
    if (!el || !settimane.length) return
    const calcola = () => {
      setHRiga(el.clientHeight / settimane.length)
      setStretto(el.clientWidth < 560)
    }
    calcola()
    const ro = new ResizeObserver(calcola)
    ro.observe(el)
    return () => ro.disconnect()
  }, [settimane.length])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Intestazione giorni della settimana */}
      <div className="grid shrink-0 grid-cols-7" style={{ borderBottom: '1px solid var(--linea)' }}>
        {GIORNI_SETT.map((g, i) => (
          <div
            key={g}
            className="py-[13px] text-center text-[13px] font-semibold"
            style={{ color: 'var(--testo-2)', borderLeft: i ? '1px solid var(--linea)' : 'none' }}
          >
            {stretto ? g[0] : g}
          </div>
        ))}
      </div>

      {/* Griglia delle settimane */}
      <div
        ref={corpoRef}
        className="grid min-h-0 flex-1"
        style={{ gridTemplateRows: `repeat(${settimane.length}, minmax(0, 1fr))` }}
      >
        {settimane.map((sett, r) => {
          const barre = barrePerSettimana[r]
          const corsie = barre.length ? Math.max(...barre.map((b) => b.corsia)) + 1 : 0
          const hBarre = corsie * (H_BARRA + 3)
          // Se la riga è troppo bassa per i blocchi pieni si passa a quelli
          // compatti invece di mostrare solo "+N more": una cella che nasconde
          // tutti i suoi eventi non serve a niente.
          const utile = hRiga - H_TESTATA_CELLA - hBarre - 6
          let maxChip = Math.min(6, Math.floor((utile + GAP_CHIP) / (H_CHIP + GAP_CHIP)))
          const compatto = maxChip < 1
          if (compatto) maxChip = Math.max(0, Math.min(8, Math.floor((utile + GAP_CHIP) / (H_CHIP_COMPATTO + GAP_CHIP))))
          return (
            <div key={r} className="relative min-h-0" style={{ borderTop: r ? '1px solid var(--linea)' : 'none' }}>
              <div className="grid h-full grid-cols-7">
                {sett.map((g, c) => {
                  const d = DateTime.fromISO(g, { zone: fuso }).setLocale(LOCALE)
                  const fuoriMese = d.month !== meseCorrente
                  const isOggi = g === oggi
                  const eventi = [...(perGiorno[g] ?? [])]
                    .filter((e) => !vaInFascia(e))
                    .sort((a, b) => a.inizio_utc.localeCompare(b.inizio_utc))
                  const visibili = eventi.slice(0, maxChip)
                  const resto = eventi.length - visibili.length
                  return (
                    <div
                      key={g}
                      data-giorno={g}
                      onClick={() => onApriGiorno(g)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onApriGiorno(g)}
                      className="flex min-h-0 cursor-pointer flex-col overflow-hidden px-[7px] pb-1.5 pt-[7px] transition-colors hover:bg-[var(--hover)]"
                      style={{ borderLeft: c ? '1px solid var(--linea)' : 'none' }}
                    >
                      <span className="mb-1 flex h-[26px] shrink-0 items-center">
                        <span
                          className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[13.5px] font-semibold tabular-nums"
                          style={
                            isOggi
                              ? {
                                  background: 'linear-gradient(180deg, var(--primario-3), var(--primario))',
                                  color: 'var(--su-primario)',
                                  boxShadow: 'var(--ombra-viola)',
                                }
                              : { color: fuoriMese ? 'var(--testo-3)' : 'var(--testo)' }
                          }
                        >
                          {d.day}
                        </span>
                      </span>

                      {/* spazio riservato alle barre dei soggiorni */}
                      {hBarre > 0 && <span className="shrink-0" style={{ height: hBarre }} />}

                      {stretto ? (
                        <Pallini eventi={eventi} fuoriMese={fuoriMese} />
                      ) : (
                        <span className="flex min-h-0 flex-col" style={{ gap: GAP_CHIP, opacity: fuoriMese ? 0.55 : 1 }}>
                          {visibili.map((ev) => (
                            <ChipEvento
                              key={ev.id}
                              ev={ev}
                              fuso={fuso}
                              compatto={compatto}
                              onApri={onApri}
                              trascina={trascina}
                              handlers={onSposta ? handlers : undefined}
                            />
                          ))}
                          {resto > 0 && (
                            <span className="px-1 text-[11.5px] font-medium" style={{ color: 'var(--testo-2)' }}>
                              +{resto} more
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Barre continue dei soggiorni, sopra le celle della settimana */}
              {barre.map((b) => {
                const c = coloreEvento(b.ev)
                return (
                  <button
                    key={b.ev.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onApri(b.ev)
                    }}
                    className="premibile absolute flex items-center gap-1.5 truncate rounded-[7px] px-2 text-left text-[11.5px] font-semibold"
                    style={{
                      left: `calc(${(b.da * 100) / 7}% + 5px)`,
                      width: `calc(${((b.a - b.da + 1) * 100) / 7}% - 10px)`,
                      top: H_TESTATA_CELLA + 3 + b.corsia * (H_BARRA + 3),
                      height: H_BARRA,
                      background: c.sfondo,
                      color: c.testo,
                    }}
                  >
                    {eSoggiorno(b.ev) && <IconaAereo size={11} strokeWidth={2.2} className="shrink-0" />}
                    <span className="truncate">{b.ev.titolo}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Vista compatta della cella: un pallino per evento (max 5, poi il conteggio),
// nell'ordine in cui cadono nella giornata.
function Pallini({ eventi, fuoriMese }: { eventi: Evento[]; fuoriMese: boolean }) {
  if (!eventi.length) return null
  // Una riga sola: in una cella da ~50px una seconda riga verrebbe tagliata.
  const mostrati = eventi.length > 4 ? eventi.slice(0, 3) : eventi
  return (
    <span className="flex items-center gap-[4px] overflow-hidden px-[2px]" style={{ opacity: fuoriMese ? 0.5 : 1 }}>
      {mostrati.map((ev) => (
        <span
          key={ev.id}
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{
            background: ev.stato === 'in_attesa' ? 'transparent' : coloreEvento(ev).punto,
            boxShadow: ev.stato === 'in_attesa' ? `inset 0 0 0 1.5px ${coloreEvento(ev).punto}` : 'none',
          }}
        />
      ))}
      {eventi.length > mostrati.length && (
        <span className="text-[10.5px] font-semibold leading-none tabular-nums" style={{ color: 'var(--testo-3)' }}>
          +{eventi.length - mostrati.length}
        </span>
      )}
    </span>
  )
}

// Blocco evento della vista mese: pallino + titolo, orario sotto. In versione
// compatta (righe basse) resta una riga sola.
function ChipEvento({
  ev,
  fuso,
  compatto,
  onApri,
  trascina,
  handlers,
}: {
  ev: Evento
  fuso: string
  compatto: boolean
  onApri: (ev: Evento) => void
  trascina?: Trascinamento | null
  handlers?: (ev: Evento) => Record<string, unknown>
}) {
  const c = coloreEvento(ev)
  const inAttesa = ev.stato === 'in_attesa'
  const muovibile = !!handlers && trascinabile(ev)
  const inMovimento = trascina?.id === ev.id
  return (
    <button
      data-evento={ev.id}
      onClick={
        muovibile
          ? (e) => e.stopPropagation()
          : (e) => {
              e.stopPropagation()
              onApri(ev)
            }
      }
      {...(muovibile ? handlers!(ev) : {})}
      className={`premibile w-full shrink-0 overflow-hidden rounded-[8px] px-2 text-left ${compatto ? 'flex items-center' : 'py-[5px]'} ${
        muovibile ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{
        height: compatto ? H_CHIP_COMPATTO : H_CHIP,
        background: inAttesa ? 'var(--card)' : c.sfondo,
        color: c.testo,
        boxShadow: inAttesa ? `inset 0 0 0 1.5px ${c.punto}` : 'none',
        ...(inMovimento
          ? {
              transform: `translate(${trascina!.dx}px, ${trascina!.dy}px)`,
              position: 'relative' as const,
              zIndex: 40,
              opacity: 0.92,
              boxShadow: '0 10px 24px -6px rgb(20 18 40 / 0.45)',
              touchAction: 'none',
            }
          : null),
      }}
      title={`${ev.titolo} · ${orarioEvento(ev, fuso).principale}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.punto }} />
        <span className="truncate text-[12px] font-semibold leading-[15px]">{ev.titolo}</span>
      </span>
      {!compatto && (
        <span className="mt-[1px] block truncate pl-[13px] text-[11px] leading-[14px] tabular-nums opacity-80">
          {orarioEvento(ev, fuso).principale.replace('–', ' – ')}
        </span>
      )}
    </button>
  )
}
