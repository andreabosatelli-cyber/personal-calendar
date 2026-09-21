import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import {
  ALTEZZA_ORA,
  coloreEvento,
  fusoRif,
  LOCALE,
  ORA_FINE,
  ORA_INIZIO,
  ORA_INIZIO_NOTTE,
  ufficioFine,
  ufficioInizio,
  altezzaGriglia,
  eSoggiorno,
  etichetteOra,
  oggiISO,
  offsetBreve,
  orarioEvento,
  serveFasciaNotturna,
  vaInFascia,
  yDaIstante,
  yDaOraRiferimento,
} from '../lib/tempo'
import { clamp, disponiEventi } from '../lib/packing'
import { useTrascinaEvento, type Trascinamento } from '../hooks/useTrascinaEvento'
import { trascinabile } from '../lib/spostamento'
import { IconaAereo } from '../lib/icone'

const RAIL = 66 // larghezza rail orari (locale + riferimento)
const RAIL_STRETTO = 52 // su telefono il rail ruba larghezza alle colonne
const ALTEZZA_FASCIA = 22 // altezza di una barra "tutto il giorno"
const ALTEZZA_FASCIA_DAY = 34 // in vista Day la barra diventa un banner leggibile
// Larghezza sotto la quale una colonna-giorno smette di essere leggibile: i
// titoli si riducono a "P..". Invece di comprimere si mostrano meno giorni e
// si scorre in orizzontale.
const MIN_COLONNA = 92
// Le etichette orarie sono centrate sulla loro linea: senza questo margine la
// prima resta tagliata a metà dal bordo superiore (si vedeva "06:00" mozzato).
const PAD_SOPRA = 16

// Barre "tutto il giorno". Un soggiorno (dal 15 al 17 a Minorca) diventa UNA
// barra continua sulle colonne che attraversa, non tre chip separate: si legge
// "dove sono in quei giorni", non "tre impegni". Vale anche per i multi-giorno
// con orari: un viaggio dal 5 al 10 non è un blocco alto sei giornate.
interface Fascia {
  ev: Evento
  da: number // indice della prima colonna coperta
  a: number // indice dell'ultima
  corsia: number
  tagliataPrima: boolean // continua oltre il bordo sinistro del periodo
  tagliataDopo: boolean // continua oltre il bordo destro
}

function disponiFasce(perGiorno: Record<string, Evento[]>, giorni: string[]): Fascia[] {
  const estremi = new Map<string, { ev: Evento; da: number; a: number }>()
  giorni.forEach((g, i) => {
    for (const ev of perGiorno[g] ?? []) {
      if (!vaInFascia(ev)) continue
      const gia = estremi.get(ev.id)
      if (gia) gia.a = i
      else estremi.set(ev.id, { ev, da: i, a: i })
    }
  })
  // Prima le barre che iniziano prima e, a parita', le piu' lunghe.
  const ordinate = [...estremi.values()].sort((x, y) => x.da - y.da || y.a - y.da - (x.a - x.da))
  const corsie: number[] = [] // ultima colonna occupata da ciascuna corsia
  return ordinate.map((f) => {
    let corsia = corsie.findIndex((ultima) => f.da > ultima)
    if (corsia === -1) {
      corsia = corsie.length
      corsie.push(-1)
    }
    corsie[corsia] = f.a
    // Una barra che tocca il bordo del periodo quasi sempre prosegue fuori: lo
    // si dice arrotondando solo il lato che finisce davvero qui.
    const primo = DateTime.fromISO(f.ev.inizio_utc, { zone: 'utc' })
    return {
      ...f,
      corsia,
      tagliataPrima: f.da === 0 && primo.toISODate()! < giorni[0],
      tagliataDopo: f.a === giorni.length - 1 && !eventoFinisceEntro(f.ev, giorni[giorni.length - 1]),
    }
  })
}

function eventoFinisceEntro(ev: Evento, ultimoGiornoISO: string): boolean {
  const fine = DateTime.fromISO(ev.fine_utc, { zone: 'utc' })
  const ultimo = (+fine === +fine.startOf('day') ? fine.minus({ minutes: 1 }) : fine).toISODate()!
  return ultimo <= ultimoGiornoISO
}

interface Props {
  perGiorno: Record<string, Evento[]>
  giorni: string[]
  giornoAttivo: string
  fuso: string
  fusoRiferimento?: string // seconda colonna del rail (default: le preferenze)
  bandaUfficio?: boolean // fascia ufficio Italia (default true)
  neutro?: boolean // vista pubblica: blocchi "Busy" senza dettagli
  onApri: (ev: Evento) => void
  onSelezionaGiorno: (giornoISO: string) => void
  // Trascinamento: assente nella vista pubblica, dove non si tocca niente.
  onSposta?: (ev: Evento, minuti: number, giorno: string | null) => void
  onRidimensiona?: (ev: Evento, minuti: number, bordo: 'inizio' | 'fine') => void
}

// Orologio che scatta ogni minuto: alimenta la linea "adesso".
function useAdesso() {
  const [now, setNow] = useState(() => DateTime.now())
  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// Larghezza disponibile del contenitore, misurata invece che indovinata con i
// breakpoint: la stessa griglia vive nella pagina, nella vista pubblica e
// dentro colonne di larghezza diversa.
function useLarghezza(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const misura = () => setW(el.clientWidth)
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

export function GrigliaSettimana({
  perGiorno,
  giorni,
  giornoAttivo,
  fuso,
  fusoRiferimento = fusoRif() ?? fuso,
  bandaUfficio = true,
  neutro,
  onApri,
  onSelezionaGiorno,
  onSposta,
  onRidimensiona,
}: Props) {
  const { trascina, handlers } = useTrascinaEvento({
    modo: 'ore',
    onClick: onApri,
    onSposta: (ev, minuti, giorno) => onSposta?.(ev, minuti, giorno),
    onRidimensiona: (ev, minuti, bordo) => onRidimensiona?.(ev, minuti, bordo),
  })
  const now = useAdesso()
  const oggi = oggiISO(fuso)
  const mostraRif = fuso !== fusoRiferimento
  const unaColonna = giorni.length === 1

  // La finestra scende a mezzanotte solo se nel periodo visibile c'e' davvero
  // qualcosa di notte (tipico: le lezioni di un altro fuso). Altrimenti
  // resta alle 06:00 e non ci si porta dietro sei ore vuote di scroll.
  const oraInizio = useMemo(
    () => (serveFasciaNotturna(perGiorno, giorni, fuso) ? ORA_INIZIO_NOTTE : ORA_INIZIO),
    [perGiorno, giorni, fuso],
  )
  const altezza = altezzaGriglia(oraInizio)
  const ore = useMemo(() => {
    const arr: number[] = []
    for (let h = oraInizio; h <= ORA_FINE; h++) arr.push(h)
    return arr
  }, [oraInizio])

  const fasce = useMemo(() => disponiFasce(perGiorno, giorni), [perGiorno, giorni])
  const corsie = fasce.length ? Math.max(...fasce.map((f) => f.corsia)) + 1 : 0
  const hFascia = unaColonna ? ALTEZZA_FASCIA_DAY : ALTEZZA_FASCIA
  const nowY = yDaIstante(now.toUTC().toISO()!, oggi, fuso, oraInizio)
  const oggiInSettimana = giorni.includes(oggi)
  const mostraNow = oggiInSettimana && nowY >= 0 && nowY <= altezza

  // Quante colonne ci stanno davvero. Sette colonne su un telefono sono strisce
  // da 45px: si mostrano i giorni che entrano a larghezza leggibile e si scorre
  // in orizzontale con lo snap, invece di comprimerli tutti.
  const scrollRef = useRef<HTMLDivElement>(null)
  const larghezza = useLarghezza(scrollRef)
  const rail = larghezza && larghezza < 560 ? RAIL_STRETTO : RAIL
  const { colonne, larghColonna, scorre } = useMemo(() => {
    const utile = Math.max(0, larghezza - rail)
    if (!utile) return { colonne: giorni.length, larghColonna: 0, scorre: false }
    const piene = utile / giorni.length
    if (piene >= MIN_COLONNA) return { colonne: giorni.length, larghColonna: piene, scorre: false }
    const n = Math.max(1, Math.min(giorni.length, Math.floor(utile / MIN_COLONNA)))
    return { colonne: n, larghColonna: utile / n, scorre: n < giorni.length }
  }, [larghezza, rail, giorni.length])

  // Larghezze esplicite solo quando si scorre: a piena larghezza lavora il
  // flex, così non si rincorrono gli arrotondamenti di clientWidth contro la
  // comparsa della scrollbar.
  const stileArea = scorre ? { width: larghColonna * giorni.length } : { flex: 1, minWidth: 0 }
  const stileColonna = scorre ? { width: larghColonna } : { flex: 1, minWidth: 0 }
  const larghGiorni = larghColonna * giorni.length
  const larghTotale = scorre ? rail + larghGiorni : undefined

  // Prima fascia con qualcosa dentro: è lì che si apre la giornata, non a
  // mezzanotte e nemmeno all'ora corrente se il primo impegno è più su. Quando
  // oggi è nel periodo non si scende comunque sotto "adesso", altrimenti al
  // mattino si perderebbe di vista la linea dell'ora.
  const primoY = useMemo(() => {
    let min = Infinity
    for (const g of giorni) {
      for (const ev of perGiorno[g] ?? []) {
        if (vaInFascia(ev)) continue
        const y = yDaIstante(ev.inizio_utc, g, fuso, oraInizio)
        if (y >= 0 && y < min) min = y
      }
    }
    return min === Infinity ? null : min
  }, [perGiorno, giorni, fuso, oraInizio])

  const chiaveGiorni = giorni[0]
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !larghColonna) return
    const base = primoY ?? (mostraNow ? nowY : (9 - oraInizio) * ALTEZZA_ORA)
    const target = mostraNow ? Math.min(base, nowY) : base
    // Ci si ferma su una linea oraria intera, un'ora sopra il bersaglio: a
    // offset liberi la prima etichetta finisce tagliata a metà dal bordo
    // (le etichette sono centrate sulla loro linea).
    const linea = Math.floor(target / ALTEZZA_ORA) * ALTEZZA_ORA + PAD_SOPRA
    el.scrollTop = Math.max(0, linea - ALTEZZA_ORA - 14)
    if (scorre) {
      const i = Math.max(0, giorni.indexOf(giorniIndexAttivo(giorni, giornoAttivo, oggi)))
      // Centra per quanto possibile il giorno attivo nella finestra visibile.
      const offset = Math.max(0, i - Math.floor((colonne - 1) / 2))
      el.scrollLeft = Math.min(offset * larghColonna, larghGiorni - colonne * larghColonna)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveGiorni, oraInizio, larghColonna, scorre, giornoAttivo, primoY])

  return (
    // Un solo contenitore che scorre su entrambi gli assi: così l'intestazione
    // dei giorni resta appesa in alto mentre si scorrono le ore, e il rail
    // degli orari resta appeso a sinistra mentre si scorrono i giorni. Prima il
    // rail scorreva via insieme alle colonne e si perdevano gli orari.
    <div
      ref={scrollRef}
      className="h-full min-h-0 overflow-auto scroll-fine overscroll-contain"
      style={
        scorre
          ? { scrollSnapType: 'x mandatory', scrollPaddingLeft: rail }
          : undefined
      }
    >
      <div className="relative" style={{ width: larghTotale, minWidth: '100%' }}>
        {/* Testata appiccicata in alto: giorni + fascia tutto-il-giorno */}
        <div className="sticky top-0 z-30" style={{ background: 'var(--card)' }}>
          <div className="flex" style={{ borderBottom: '1px solid var(--linea)' }}>
            <CellaRail larghezza={rail} className="flex-col items-end justify-end pb-2 pr-2.5 text-right leading-none">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                {offsetBreve(fuso)}
              </span>
              {mostraRif && (
                <span className="mt-0.5 text-[9.5px]" style={{ color: 'var(--testo-3)' }}>
                  {offsetBreve(fusoRiferimento)}
                </span>
              )}
            </CellaRail>
            {/* In vista Day il titolo della card dice già "Saturday 19
                September": ripeterlo qui sarebbe la stessa scritta due volte. */}
            {!unaColonna && (
              <div className="flex" style={stileArea}>
                {giorni.map((g) => {
                  const d = DateTime.fromISO(g, { zone: fuso }).setLocale(LOCALE)
                  const isOggi = g === oggi
                  const isAttivo = g === giornoAttivo
                  return (
                    <button
                      key={g}
                      onClick={() => onSelezionaGiorno(g)}
                      className="flex flex-col items-center justify-center gap-1 py-[11px] transition-colors hover:bg-[var(--hover)]"
                      style={{
                        ...stileColonna,
                        borderLeft: '1px solid var(--linea)',
                        scrollSnapAlign: scorre ? 'start' : undefined,
                        background: isAttivo && !isOggi ? 'var(--attivo)' : undefined,
                      }}
                      aria-current={isAttivo ? 'date' : undefined}
                    >
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                        {d.toFormat('ccc')}
                      </span>
                      <span
                        className="flex h-[27px] min-w-[27px] items-center justify-center rounded-full px-1 text-[14px] font-semibold tabular-nums"
                        style={
                          isOggi
                            ? {
                                background: 'linear-gradient(180deg, var(--primario-3), var(--primario))',
                                color: 'var(--su-primario)',
                                boxShadow: 'var(--ombra-viola)',
                              }
                            : isAttivo
                              ? { color: 'var(--primario)', boxShadow: 'inset 0 0 0 1.5px var(--primario)' }
                              : { color: 'var(--testo)' }
                        }
                      >
                        {d.day}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Riga tutto-il-giorno: barre continue sui giorni coperti. Resta in
              testa anche scorrendo le ore — è "dove sono", non un impegno che
              scivola via. */}
          {fasce.length > 0 && (
            <div className="flex" style={{ borderBottom: '1px solid var(--linea)' }}>
              <CellaRail larghezza={rail} className="items-center justify-end pr-2.5 text-[10.5px] font-medium">
                <span style={{ color: 'var(--testo-3)' }}>all day</span>
              </CellaRail>
              <div
                className="relative"
                style={{ ...stileArea, height: corsie * (hFascia + 3) + 6 }}
              >
                {!unaColonna &&
                  giorni.map((g, i) => (
                    <div
                      key={g}
                      className="pointer-events-none absolute bottom-0 top-0"
                      style={{ left: `${(i * 100) / giorni.length}%`, borderLeft: '1px solid var(--linea)' }}
                    />
                  ))}
                {fasce.map((f) => (
                  <BarraFascia
                    key={f.ev.id}
                    f={f}
                    totale={giorni.length}
                    altezza={hFascia}
                    espansa={unaColonna}
                    neutro={neutro}
                    fuso={fuso}
                    onApri={onApri}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Corpo: griglia oraria */}
        <div className="relative flex" style={{ height: altezza + PAD_SOPRA + 24 }}>
          {/* Rail orari: fuso corrente (grande) + riferimento (piccolo).
              Appeso a sinistra, così scorrendo i giorni non si perde l'ora. */}
          <div
            className="sticky left-0 z-20 shrink-0"
            style={{ width: rail, background: 'var(--card)' }}
          >
            {ore.map((h) => {
              const y = (h - oraInizio) * ALTEZZA_ORA + PAD_SOPRA
              const et = etichetteOra(giorni[0], h, fuso, fusoRiferimento)
              return (
                <div
                  key={h}
                  className="absolute right-2.5 flex -translate-y-1/2 flex-col items-end leading-none"
                  style={{ top: y }}
                >
                  <span className="text-[11.5px] font-medium tabular-nums" style={{ color: 'var(--testo-2)' }}>
                    {et.locale}
                  </span>
                  {mostraRif && (
                    <span className="mt-[3px] text-[10px] tabular-nums" style={{ color: 'var(--testo-3)' }}>
                      {et.riferimento}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Area giorni */}
          <div
            className="relative flex"
            style={{ ...stileArea, paddingTop: PAD_SOPRA }}
          >
            {/* Linee orarie continue dietro le colonne */}
            {ore.map((h) => {
              const y = (h - oraInizio) * ALTEZZA_ORA + PAD_SOPRA
              return (
                <div
                  key={h}
                  className="pointer-events-none absolute left-0 right-0"
                  style={{ top: y, borderTop: '1px solid var(--linea)' }}
                />
              )
            })}

            {/* Colonne giorno */}
            {giorni.map((g) => (
              <ColonnaGiorno
                key={g}
                giornoISO={g}
                eventi={perGiorno[g] ?? []}
                fuso={fuso}
                oraInizio={oraInizio}
                altezza={altezza}
                stile={stileColonna}
                snap={scorre}
                neutro={neutro}
                bandaUfficio={bandaUfficio}
                attivo={g === giornoAttivo && !unaColonna}
                nowY={g === oggi && mostraNow ? nowY : null}
                onApri={onApri}
                trascina={trascina}
                handlers={onSposta ? handlers : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Cella del rail: appesa a sinistra e opaca, altrimenti le colonne le
// scorrerebbero sotto in trasparenza.
function CellaRail({
  larghezza,
  className,
  children,
}: {
  larghezza: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`sticky left-0 z-10 flex shrink-0 ${className ?? ''}`}
      style={{ width: larghezza, background: 'var(--card)' }}
    >
      {children}
    </div>
  )
}

// Barra continua di un evento che copre più giornate. In vista Day diventa un
// banner a piena larghezza con l'intervallo di date: lì "dal 15 al 17" è
// l'informazione, perché le colonne accanto non ci sono a raccontarla.
function BarraFascia({
  f,
  totale,
  altezza,
  espansa,
  neutro,
  fuso,
  onApri,
}: {
  f: Fascia
  totale: number
  altezza: number
  espansa: boolean
  neutro?: boolean
  fuso: string
  onApri: (ev: Evento) => void
}) {
  const c = coloreEvento(f.ev)
  const stile = neutro
    ? { background: 'var(--controllo)', color: 'var(--testo-2)' }
    : { background: c.sfondo, color: c.testo }
  const orari = f.ev.tutto_il_giorno ? null : orarioEvento(f.ev, fuso)
  return (
    <button
      onClick={() => onApri(f.ev)}
      className="premibile absolute flex items-center gap-1.5 px-2 text-left text-[11.5px] font-semibold"
      style={{
        left: `calc(${(f.da * 100) / totale}% + 3px)`,
        width: `calc(${((f.a - f.da + 1) * 100) / totale}% - 6px)`,
        top: 3 + f.corsia * (altezza + 3),
        height: altezza,
        // Il lato aperto resta squadrato: dice che la barra prosegue fuori dal
        // periodo invece di finire qui.
        borderRadius: `${f.tagliataPrima ? 2 : 7}px ${f.tagliataDopo ? 2 : 7}px ${f.tagliataDopo ? 2 : 7}px ${f.tagliataPrima ? 2 : 7}px`,
        ...stile,
      }}
    >
      {!neutro && eSoggiorno(f.ev) && <IconaAereo size={11} strokeWidth={2.2} className="shrink-0" />}
      <span className="truncate">{neutro ? 'Busy' : f.ev.titolo}</span>
      {espansa && orari && !neutro && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] font-medium tabular-nums opacity-75">
          {orari.principale.replace('–', ' – ')}
        </span>
      )}
    </button>
  )
}

interface ColonnaProps {
  giornoISO: string
  eventi: Evento[]
  fuso: string
  oraInizio: number
  altezza: number
  stile: React.CSSProperties
  snap: boolean
  neutro?: boolean
  bandaUfficio?: boolean
  attivo: boolean
  nowY: number | null
  onApri: (ev: Evento) => void
  trascina: Trascinamento | null
  handlers?: (ev: Evento, bordo?: 'sposta' | 'inizio' | 'fine') => Record<string, unknown>
}

function ColonnaGiorno({
  giornoISO,
  eventi,
  fuso,
  oraInizio,
  altezza,
  stile,
  snap,
  neutro,
  bandaUfficio,
  attivo,
  nowY,
  onApri,
  trascina,
  handlers,
}: ColonnaProps) {
  const posizionati = useMemo(
    () => disponiEventi(eventi, giornoISO, fuso, oraInizio, altezza),
    [eventi, giornoISO, fuso, oraInizio, altezza],
  )
  const bandaTop = clamp(yDaOraRiferimento(giornoISO, ufficioInizio(), fuso, oraInizio), altezza)
  const bandaBottom = clamp(yDaOraRiferimento(giornoISO, ufficioFine(), fuso, oraInizio), altezza)

  return (
    <div
      className="relative"
      // Il trascinamento legge di qui il giorno di arrivo: chiede al browser
      // cosa c'e' sotto il dito e risale al primo contenitore che lo dichiara.
      data-giorno={giornoISO}
      style={{
        ...stile,
        borderLeft: '1px solid var(--linea)',
        scrollSnapAlign: snap ? 'start' : undefined,
        // Il giorno selezionato resta riconoscibile anche quando la finestra
        // ne mostra solo tre su sette.
        background: attivo ? 'var(--colonna-attiva)' : undefined,
      }}
    >
      {/* Fascia orario d'ufficio italiano */}
      {bandaUfficio && bandaBottom > bandaTop && (
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{ top: bandaTop, height: bandaBottom - bandaTop, background: 'var(--banda-ufficio)' }}
        />
      )}

      {/* Eventi */}
      {posizionati.map(({ ev, top, height, col, cols }) => {
        const orari = orarioEvento(ev, fuso)
        const gap = 3
        const larghDisp = `calc((100% - ${(cols - 1) * gap}px - 6px) / ${cols})`
        const inAttesa = ev.stato === 'in_attesa'
        const c = coloreEvento(ev)
        const stile = neutro
          ? { background: 'var(--controllo)', color: 'var(--testo-2)' }
          : inAttesa
            ? { background: 'var(--card)', color: c.testo, boxShadow: `inset 0 0 0 1.5px ${c.punto}` }
            : { background: c.sfondo, color: c.testo }
        const muovibile = !!handlers && !neutro && trascinabile(ev)
        const inMovimento = trascina?.id === ev.id
        // Il ridimensionamento scatta di quarti d'ora: l'anteprima segue quelli.
        const dySnap = inMovimento ? ((trascina!.minuti / 60) * ALTEZZA_ORA) : 0
        // Sotto una certa altezza le due maniglie si mangerebbero tutto il
        // blocco e non resterebbe niente da afferrare per spostarlo.
        const conManiglie = muovibile && height >= 34 && !ev.tutto_il_giorno
        return (
          <button
            key={ev.id}
            data-evento={ev.id}
            // Col trascinamento attivo il click nasce dal gesto, non da onClick:
            // altrimenti un rilascio dopo lo spostamento aprirebbe anche l'evento.
            onClick={muovibile ? undefined : () => onApri(ev)}
            {...(muovibile ? handlers!(ev) : {})}
            className={`premibile absolute overflow-hidden rounded-[8px] px-2 py-[5px] text-left leading-tight hover:z-10 ${
              muovibile ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{
              top: top + 1,
              height: height - 2,
              left: `calc(3px + ${col} * (${larghDisp} + ${gap}px))`,
              width: larghDisp,
              // Mentre si trascina il blocco segue la mano e si stacca dalla
              // griglia con un'ombra: senza, non si capisce se ha preso.
              // Spostando segue il puntatore libero; ridimensionando cresce a
              // scatti di un quarto d'ora, perche' li' conta il numero.
              ...(inMovimento
                ? {
                    ...(trascina!.bordo === 'sposta'
                      ? { transform: `translate(${trascina!.dx}px, ${trascina!.dy}px)` }
                      : trascina!.bordo === 'fine'
                        ? { height: Math.max(18, height - 2 + dySnap) }
                        : { top: top + 1 + dySnap, height: Math.max(18, height - 2 - dySnap) }),
                    zIndex: 40,
                    opacity: 0.92,
                    boxShadow: '0 10px 24px -6px rgb(20 18 40 / 0.45)',
                    touchAction: 'none',
                  }
                : null),
              ...stile,
            }}
          >
            <span className="flex items-center gap-1.5">
              {!neutro && (
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.punto }} />
              )}
              <span className="truncate text-[12px] font-semibold leading-[15px]">
                {neutro ? 'Busy' : ev.titolo}
              </span>
            </span>
            {conManiglie && (
              <>
                <span
                  {...handlers!(ev, 'inizio')}
                  className="maniglia absolute inset-x-0 top-0 h-[9px] cursor-ns-resize"
                  aria-hidden
                />
                <span
                  {...handlers!(ev, 'fine')}
                  className="maniglia absolute inset-x-0 bottom-0 h-[9px] cursor-ns-resize"
                  aria-hidden
                />
              </>
            )}
            {height > 36 && (
              <span className="mt-[1px] block truncate text-[11px] leading-[14px] tabular-nums opacity-80" style={{ paddingLeft: neutro ? 0 : 13 }}>
                {/* Durante lo spostamento conta dove si sta andando, non da
                    dove si viene: l'orario mostrato e' quello di arrivo. */}
                {inMovimento && trascina!.minuti !== 0
                  ? orarioEvento(
                      {
                        ...ev,
                        inizio_utc:
                          trascina!.bordo === 'fine'
                            ? ev.inizio_utc
                            : DateTime.fromISO(ev.inizio_utc).plus({ minutes: trascina!.minuti }).toISO()!,
                        fine_utc:
                          trascina!.bordo === 'inizio'
                            ? ev.fine_utc
                            : DateTime.fromISO(ev.fine_utc).plus({ minutes: trascina!.minuti }).toISO()!,
                      },
                      fuso,
                    ).principale.replace('–', ' – ')
                  : orari.principale.replace('–', ' – ')}
              </span>
            )}
          </button>
        )
      })}

      {/* Linea "adesso" (solo colonna di oggi) */}
      {nowY !== null && (
        <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: nowY }}>
          <div className="absolute -left-[4px] -top-[4px] h-[8px] w-[8px] rounded-full" style={{ background: 'var(--adesso)' }} />
          <div className="absolute left-0 right-0" style={{ borderTop: '1.5px solid var(--adesso)' }} />
        </div>
      )}
    </div>
  )
}

// Il giorno su cui aprire lo scroll orizzontale: quello selezionato se è nel
// periodo, altrimenti oggi, altrimenti il primo.
function giorniIndexAttivo(giorni: string[], attivo: string, oggi: string): string {
  if (giorni.includes(attivo)) return attivo
  if (giorni.includes(oggi)) return oggi
  return giorni[0]
}
