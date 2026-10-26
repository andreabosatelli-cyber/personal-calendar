import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { useFinestre } from '../../lib/finestreStato'
import {
  ETICHETTA_BUDGET,
  ETICHETTA_METEO,
  ETICHETTA_STATO,
  FINE_TIMELINE,
  FUSO_LEZIONI,
  daPrenotareOra,
  giorniAllaDeadline,
  giorniFra,
  giornoDi,
  testoDeadline,
  type Budget,
  type Differenza,
  type Finestra,
  type Meteo,
  type Proposta,
  type StatoFinestra,
} from '../../lib/finestre'
import { LOCALE } from '../../lib/tempo'
import { IconaAereo, IconaChevron, IconaOrologio } from '../../lib/icone'
import { TestataCard } from '../pannello/parti'

// Finestre di viaggio: periodi di 3+ giorni senza lezioni, con le proposte di
// destinazione. Le date sono in ora di Singapore, dove stanno le lezioni.

const STATI: StatoFinestra[] = ['idea', 'da_prenotare', 'prenotato', 'saltato']

const fmtGiorno = (g: string, f = 'ccc, LLL d') => DateTime.fromISO(g).setLocale(LOCALE).toFormat(f)
const fmtIstante = (iso: string) =>
  DateTime.fromISO(iso, { zone: 'utc' }).setZone(FUSO_LEZIONI).setLocale(LOCALE).toFormat('ccc LLL d, h:mm a')

function intervallo(da: string, a: string): string {
  if (da === a) return fmtGiorno(da)
  return `${fmtGiorno(da)} – ${fmtGiorno(a)}`
}

function durataVolo(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const nomeFinestra = (f: Finestra) => f.titolo ?? `Window ${f.codice}`

function vaiAllaCard(id: string) {
  document.getElementById(`finestra-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---------------------------------------------------------------------------

export function FinestreViaggio() {
  const { finestre, proposte, eventi, lezioni, caricamento, errore, oggi, differenze } = useFinestre()

  const correnti = finestre.filter((f) => f.fine >= oggi)
  const subito = daPrenotareOra(finestre, oggi)

  // Account senza corsi ne' finestre (gli altri utenti): la sezione non c'e'.
  if (!caricamento && !errore && !finestre.length && !lezioni.length) return null

  if (caricamento && !finestre.length) {
    return (
      <section className="card px-5 py-6 lg:px-6">
        <span className="anim-pulsa text-[14px]" style={{ color: 'var(--testo-2)' }}>
          Loading travel windows…
        </span>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {errore && (
        <p
          className="rounded-[22px] px-3 py-2.5 text-center text-[12.5px]"
          style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' }}
        >
          {finestre.length ? 'Offline — showing the last saved travel windows.' : 'Could not load travel windows.'}
        </p>
      )}

      {subito.length > 0 && <BannerDaPrenotare finestre={subito} oggi={oggi} />}

      {differenze.length > 0 && <PannelloDifferenze differenze={differenze} />}

      <Timeline finestre={finestre} eventi={eventi} lezioniGiorni={lezioni.map((l) => giornoDi(l.inizio_utc))} oggi={oggi} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
          <h3 className="text-[20px] font-medium leading-tight tracking-[-0.02em]">Travel windows</h3>
          <p className="text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
            Budget €100/day per person, flights excluded · times in Singapore
          </p>
        </div>
        {correnti.length === 0 ? (
          <p className="card px-5 py-5 text-[13px]" style={{ color: 'var(--testo-3)' }}>
            No upcoming travel windows.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {correnti.map((f) => (
              <CardFinestra key={f.id} f={f} proposte={proposte.filter((p) => p.window_id === f.id)} oggi={oggi} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner "Book now"
// ---------------------------------------------------------------------------

function BannerDaPrenotare({ finestre, oggi }: { finestre: Finestra[]; oggi: string }) {
  return (
    <section className="rounded-[24px] px-4 py-4 lg:px-5" style={{ background: 'var(--cat-viaggi-bg)' }}>
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h3 className="text-[18px] font-medium tracking-[-0.02em]" style={{ color: 'var(--cat-viaggi-fg)' }}>
          Book now
        </h3>
        <span className="hidden text-[12.5px] sm:inline" style={{ color: 'var(--cat-viaggi-fg)' }}>
          starting within 8 weeks or past the deadline
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1 xl:grid-cols-2 xl:gap-x-4">
        {finestre.map((f) => {
          const g = giorniAllaDeadline(f, oggi)
          const scaduta = g !== null && g < 0
          return (
            <li key={f.id}>
              <button
                onClick={() => vaiAllaCard(f.id)}
                className="premibile flex min-h-[44px] w-full items-center gap-3 rounded-[16px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--card)]"
              >
                <ChipCodice codice={f.codice} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{nomeFinestra(f)}</span>
                  <span className="block truncate text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                    {intervallo(f.inizio, f.fine)}
                  </span>
                </span>
                {f.deadline_prenotazione && (
                  <span
                    className="shrink-0 rounded-[8px] px-2 py-1 text-[12px] font-medium tabular-nums"
                    style={
                      scaduta
                        ? { background: 'var(--badge-bg)', color: 'var(--badge-fg)' }
                        : { background: 'var(--card)', color: 'var(--cat-viaggi-fg)' }
                    }
                  >
                    {scaduta ? testoDeadline(f, oggi) : g === 0 ? 'book today' : `by ${fmtGiorno(f.deadline_prenotazione, 'LLL d')}`}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Differenze col planning: proposte, mai applicate da sole
// ---------------------------------------------------------------------------

function PannelloDifferenze({ differenze }: { differenze: Differenza[] }) {
  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Class schedule changed">
        <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
          {differenze.length}
        </span>
      </TestataCard>
      <p className="px-5 pb-3 text-[13px] lg:px-6" style={{ color: 'var(--testo-2)' }}>
        The windows below no longer match the classes. Nothing changes until you apply it; status and notes are kept.
      </p>
      <ul className="flex flex-col gap-2 px-4 pb-4 lg:px-5 lg:pb-5">
        {differenze.map((d) => (
          <RigaDifferenza key={d.chiave} d={d} />
        ))}
      </ul>
    </section>
  )
}

function RigaDifferenza({ d }: { d: Differenza }) {
  const { applica, ignora } = useFinestre()
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  let titolo: string
  let dettaglio: string
  let azione: string | null
  if (d.tipo === 'nuova') {
    titolo = `New free window · ${d.libera.giorni} days`
    dettaglio = intervallo(d.libera.inizio, d.libera.fine)
    azione = 'Add'
  } else if (d.tipo === 'date') {
    titolo = `${d.finestra.codice} · dates changed`
    dettaglio = `${intervallo(d.finestra.inizio, d.finestra.fine)} → ${intervallo(d.patch.inizio, d.patch.fine)}`
    azione = 'Apply'
  } else {
    const n = d.lezioni.length
    titolo = `${d.finestra.codice} · ${n} ${n === 1 ? 'class' : 'classes'} inside`
    dettaglio = d.lezioni.map((l) => `${fmtIstante(l.inizio_utc)} ${l.titolo}`).join(' · ')
    if (d.patch) dettaglio += ` — shrink to ${intervallo(d.patch.inizio, d.patch.fine)}`
    azione = d.patch ? 'Shrink' : null
  }

  async function esegui() {
    setInCorso(true)
    setErrore(null)
    try {
      await applica(d)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Could not save')
      setInCorso(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-[18px] p-3 sm:flex-row sm:items-center" style={{ background: 'var(--controllo)' }}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{titolo}</p>
        <p className="mt-0.5 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
          {dettaglio}
        </p>
        {errore && (
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => ignora(d)} disabled={inCorso} className="btn-neutro premibile h-11 px-4 text-[13.5px] disabled:opacity-45">
          Ignore
        </button>
        {azione && (
          <button onClick={esegui} disabled={inCorso} className="btn-primario premibile h-11 px-4 text-[13.5px] disabled:opacity-45">
            {inCorso ? 'Saving…' : azione}
          </button>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Timeline: da oggi al 3/03, una riga per settimana
// ---------------------------------------------------------------------------

function Timeline({
  finestre,
  eventi,
  lezioniGiorni,
  oggi,
}: {
  finestre: Finestra[]
  eventi: { id: string; titolo: string; inizio: string; fine: string; tipo: 'evento' | 'presenza' }[]
  lezioniGiorni: string[]
  oggi: string
}) {
  const d = useMemo(() => {
    const inizio = DateTime.fromISO(oggi).startOf('week').toISODate()!
    const fine = DateTime.fromISO(FINE_TIMELINE).endOf('week').toISODate()!
    const giorni = giorniFra(inizio, fine)
    const settimane: string[][] = []
    for (let i = 0; i < giorni.length; i += 7) settimane.push(giorni.slice(i, i + 7))

    const perFinestra: Record<string, Finestra> = {}
    for (const f of finestre) {
      if (f.stato === 'saltato') continue
      for (const g of giorniFra(f.inizio, f.fine)) perFinestra[g] = f
    }
    const presenza = new Set<string>()
    const speciali: Record<string, string[]> = {}
    for (const e of eventi) {
      for (const g of giorniFra(e.inizio, e.fine)) {
        if (e.tipo === 'presenza') presenza.add(g)
        else (speciali[g] ??= []).push(e.titolo)
      }
    }
    return { settimane, perFinestra, presenza, speciali, lezioni: new Set(lezioniGiorni) }
  }, [finestre, eventi, lezioniGiorni, oggi])

  const presenze = eventi.filter((e) => e.tipo === 'presenza')
  const speciali = eventi.filter((e) => e.tipo === 'evento' && e.fine >= oggi)

  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Until Mar 3">
        <span className="shrink-0 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
          {d.settimane.length} weeks
        </span>
      </TestataCard>

      <div className="px-3 pb-3 lg:px-5">
        {/* Testata giorni */}
        <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] pb-1 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <span />
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((g, i) => (
            <span key={i} className="text-center text-[11px] font-medium" style={{ color: 'var(--testo-3)' }}>
              {g}
            </span>
          ))}
        </div>

        <div role="img" aria-label="Weekly timeline of travel windows, classes and special events until March 3, 2027">
          {d.settimane.map((sett, r) => {
            const lun = DateTime.fromISO(sett[0]).setLocale(LOCALE)
            // Il mese si scrive quando cambia il mese del lunedi' (e sulla prima riga).
            const nuovoMese = r === 0 || sett[0].slice(0, 7) !== d.settimane[r - 1][0].slice(0, 7)
            return (
              <div
                key={sett[0]}
                className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] pb-1.5 sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]"
                style={{ borderTop: nuovoMese && r > 0 ? '1px solid var(--linea)' : undefined }}
              >
                <span className="flex flex-col justify-center pr-1 text-[11px] leading-tight tabular-nums" style={{ color: 'var(--testo-3)' }}>
                  {nuovoMese && (
                    <span className="font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--testo-2)' }}>
                      {lun.toFormat('LLL')}
                    </span>
                  )}
                  <span className="hidden sm:inline">{lun.toFormat('LLL d')}</span>
                </span>
                {sett.map((g, c) => (
                  <CellaTimeline
                    key={g}
                    g={g}
                    oggi={oggi}
                    finestra={d.perFinestra[g]}
                    prima={c > 0 ? d.perFinestra[sett[c - 1]] : undefined}
                    dopo={c < 6 ? d.perFinestra[sett[c + 1]] : undefined}
                    presenza={d.presenza.has(g)}
                    lezione={d.lezioni.has(g)}
                    speciali={d.speciali[g]}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[12px]" style={{ color: 'var(--testo-2)' }}>
          <Legenda colore="var(--cat-viaggi-bg)" bordo="var(--cat-viaggi)">Window</Legenda>
          <Legenda colore="var(--badge-bg)">Booked</Legenda>
          <Legenda colore="var(--lezione)">Classes</Legenda>
          {presenze.map((p) => (
            <Legenda key={p.id} colore="var(--fascia-presenza)">
              {p.titolo} {fmtGiorno(p.inizio, 'LLL d')}–{fmtGiorno(p.fine, 'LLL d')}
            </Legenda>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rotate-45" style={{ background: 'var(--cat-viaggi-fg)' }} />
            Special event
          </span>
        </div>

        {speciali.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 px-1">
            {speciali.map((e) => (
              <li key={e.id} className="etichetta-viaggio" style={{ background: 'var(--controllo)' }}>
                <span className="tabular-nums" style={{ color: 'var(--testo-3)' }}>
                  {e.inizio === e.fine
                    ? fmtGiorno(e.inizio, 'LLL d')
                    : `${fmtGiorno(e.inizio, 'LLL d')}–${fmtGiorno(e.fine, e.inizio.slice(5, 7) === e.fine.slice(5, 7) ? 'd' : 'LLL d')}`}
                </span>
                <span style={{ color: 'var(--testo)' }}>{e.titolo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Legenda({ colore, bordo, children }: { colore: string; bordo?: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-[10px] w-[16px] rounded-[4px]"
        style={{ background: colore, boxShadow: bordo ? `inset 0 0 0 1px ${bordo}` : undefined }}
      />
      {children}
    </span>
  )
}

function CellaTimeline({
  g,
  oggi,
  finestra,
  prima,
  dopo,
  presenza,
  lezione,
  speciali,
}: {
  g: string
  oggi: string
  finestra?: Finestra
  prima?: Finestra
  dopo?: Finestra
  presenza: boolean
  lezione: boolean
  speciali?: string[]
}) {
  const fuori = g < oggi || g > FINE_TIMELINE
  const isOggi = g === oggi
  const inizia = finestra && prima?.id !== finestra.id
  const finisce = finestra && dopo?.id !== finestra.id
  const prenotata = finestra?.stato === 'prenotato'
  const giorno = Number(g.slice(8))

  return (
    <div
      className="relative flex h-[46px] flex-col justify-between py-[3px]"
      style={{ background: presenza ? 'var(--fascia-presenza)' : undefined, opacity: fuori ? 0.35 : 1 }}
      title={[finestra && `${finestra.codice}${finestra.titolo ? ` · ${finestra.titolo}` : ''}`, lezione && 'Classes', ...(speciali ?? [])]
        .filter(Boolean)
        .join(' · ') || undefined}
    >
      <span className="flex items-center justify-between px-1">
        <span
          className="text-[11px] tabular-nums leading-none"
          style={
            isOggi
              ? { color: 'var(--su-primario)', background: 'var(--primario)', borderRadius: 999, padding: '2px 4px', fontWeight: 600 }
              : { color: 'var(--testo-3)' }
          }
        >
          {giorno}
        </span>
        {speciali && <span className="h-[6px] w-[6px] shrink-0 rotate-45" style={{ background: 'var(--cat-viaggi-fg)' }} />}
      </span>

      {/* Barra della finestra: continua sulle celle, arrotondata ai capi */}
      <span
        className="flex h-[16px] items-center overflow-hidden text-[10.5px] font-semibold leading-none"
        style={
          finestra
            ? {
                background: prenotata ? 'var(--badge-bg)' : 'var(--cat-viaggi-bg)',
                color: prenotata ? 'var(--badge-fg)' : 'var(--cat-viaggi-fg)',
                boxShadow: prenotata ? undefined : 'inset 0 1px 0 var(--cat-viaggi), inset 0 -1px 0 var(--cat-viaggi)',
                borderTopLeftRadius: inizia ? 6 : 0,
                borderBottomLeftRadius: inizia ? 6 : 0,
                borderTopRightRadius: finisce ? 6 : 0,
                borderBottomRightRadius: finisce ? 6 : 0,
                marginLeft: inizia ? 2 : 0,
                marginRight: finisce ? 2 : 0,
                paddingLeft: inizia ? 4 : 0,
                borderLeft: inizia && !prenotata ? '1px solid var(--cat-viaggi)' : undefined,
                borderRight: finisce && !prenotata ? '1px solid var(--cat-viaggi)' : undefined,
              }
            : undefined
        }
      >
        {inizia && finestra.codice}
      </span>

      {/* Lezioni: striscia grigia in fondo */}
      <span className="mx-[3px] h-[4px] rounded-full" style={{ background: lezione ? 'var(--lezione)' : 'transparent' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card di una finestra
// ---------------------------------------------------------------------------

function ChipCodice({ codice }: { codice: string }) {
  return (
    <span
      className="flex h-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-[12px] px-1.5 text-[13px] font-semibold"
      style={{ background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' }}
    >
      {codice}
    </span>
  )
}

function CardFinestra({ f, proposte, oggi }: { f: Finestra; proposte: Proposta[]; oggi: string }) {
  const { cambiaStato } = useFinestre()
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const aperta = f.stato === 'idea' || f.stato === 'da_prenotare'
  const g = giorniAllaDeadline(f, oggi)
  const inCorso = f.inizio <= oggi
  const consigliate = proposte.filter((p) => !p.sconsigliata).sort((a, b) => Number(b.consigliata) - Number(a.consigliata) || a.ordine - b.ordine)
  const evitare = proposte.filter((p) => p.sconsigliata)

  async function cambia(s: StatoFinestra) {
    setSalvando(true)
    setErrore(null)
    try {
      await cambiaStato(f, s)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSalvando(false)
    }
  }

  const coloreDeadline =
    g === null || !aperta
      ? 'var(--testo-2)'
      : g < 0
        ? 'var(--errore)'
        : g < 7
          ? 'var(--cat-viaggi-fg)'
          : 'var(--testo-2)'

  return (
    <article
      id={`finestra-${f.id}`}
      className="card flex scroll-mt-4 flex-col gap-3 px-4 py-4 lg:px-5 lg:py-5"
      style={{ opacity: f.stato === 'saltato' ? 0.6 : 1 }}
    >
      <header className="flex items-start gap-3">
        <ChipCodice codice={f.codice} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[17px] font-medium leading-tight tracking-[-0.01em]">{nomeFinestra(f)}</h4>
          <p className="mt-[3px] text-[13px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
            {intervallo(f.inizio, f.fine)} · {f.giorni} {f.giorni === 1 ? 'day' : 'days'}
          </p>
        </div>
        <SelettoreStato valore={f.stato} disabilitato={salvando} onCambia={cambia} />
      </header>

      {(f.ultima_lezione_prima || f.prima_lezione_dopo) && (
        <p className="text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
          {f.ultima_lezione_prima && <>Last class {fmtIstante(f.ultima_lezione_prima)}</>}
          {f.ultima_lezione_prima && f.prima_lezione_dopo && ' · '}
          {f.prima_lezione_dopo && <>{f.ultima_lezione_prima ? 'next' : 'Next class'} {fmtIstante(f.prima_lezione_dopo)}</>}
          {f.salta_lezioni.length > 0 && <> · skips classes on {f.salta_lezioni.map((s) => fmtGiorno(s, 'ccc LLL d')).join(', ')}</>}
        </p>
      )}

      {f.deadline_prenotazione && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums" style={{ color: coloreDeadline }}>
          <IconaOrologio size={15} />
          {aperta
            ? `Book by ${fmtGiorno(f.deadline_prenotazione, 'LLL d')} · ${testoDeadline(f, oggi)}`
            : f.stato === 'prenotato'
              ? 'Booked'
              : 'Skipped'}
          {inCorso && aperta && ' · in progress'}
        </p>
      )}

      {errore && (
        <p className="text-[12.5px]" style={{ color: 'var(--errore)' }}>
          {errore}
        </p>
      )}

      {f.note && (
        <p className="text-[13px] leading-snug" style={{ color: 'var(--testo-2)' }}>
          {f.note}
        </p>
      )}

      {consigliate.length > 0 && (
        <ul className="flex flex-col gap-2">
          {consigliate.map((p) => (
            <RigaProposta key={p.id} p={p} />
          ))}
        </ul>
      )}

      {evitare.length > 0 && (
        <div className="px-1">
          <p className="etichetta-sezione mb-1">Avoid</p>
          <ul className="flex flex-col gap-1">
            {evitare.map((p) => (
              <li key={p.id} className="text-[12.5px] leading-snug" style={{ color: 'var(--testo-2)' }}>
                <span className="font-medium" style={{ color: 'var(--testo)' }}>
                  {p.destinazione}
                </span>
                {[p.stagione, p.note].filter(Boolean).length > 0 && ` — ${[p.stagione, p.note].filter(Boolean).join('. ')}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function SelettoreStato({
  valore,
  disabilitato,
  onCambia,
}: {
  valore: StatoFinestra
  disabilitato: boolean
  onCambia: (s: StatoFinestra) => void
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">Status</span>
      <select
        value={valore}
        disabled={disabilitato}
        onChange={(e) => onCambia(e.target.value as StatoFinestra)}
        className="btn-neutro premibile h-11 cursor-pointer appearance-none pl-3.5 pr-8 text-[13.5px] disabled:opacity-45"
        style={valore === 'prenotato' ? { background: 'var(--badge-bg)', color: 'var(--badge-fg)' } : undefined}
      >
        {STATI.map((s) => (
          <option key={s} value={s}>
            {ETICHETTA_STATO[s]}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: valore === 'prenotato' ? 'var(--badge-fg)' : 'var(--testo-2)' }}
      >
        <IconaChevron size={14} />
      </span>
    </label>
  )
}

const COLORE_BUDGET: Record<Budget, { background: string; color: string }> = {
  ok: { background: 'var(--cond-1-bg)', color: 'var(--cond-1-fg)' },
  stretto: { background: 'var(--cat-personale-bg)', color: 'var(--cat-personale-fg)' },
  fuori: { background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' },
  misto: { background: 'var(--card)', color: 'var(--testo-2)' },
}

const COLORE_METEO: Record<Meteo, { background: string; color: string }> = {
  ottimo: { background: 'var(--card)', color: 'var(--testo-2)' },
  buono: { background: 'var(--card)', color: 'var(--testo-2)' },
  incerto: { background: 'var(--cat-personale-bg)', color: 'var(--cat-personale-fg)' },
  sconsigliato: { background: 'var(--cat-viaggi-bg)', color: 'var(--cat-viaggi-fg)' },
}

function RigaProposta({ p }: { p: Proposta }) {
  return (
    <li
      className="rounded-[18px] p-3"
      style={{
        background: 'var(--controllo)',
        boxShadow: p.consigliata ? 'inset 0 0 0 1.5px var(--cat-viaggi)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[14.5px] font-medium leading-tight">{p.destinazione}</p>
        {p.consigliata && (
          <span
            className="shrink-0 rounded-[8px] px-2 py-[3px] text-[11.5px] font-semibold"
            style={{ background: 'var(--badge-bg)', color: 'var(--badge-fg)' }}
          >
            Recommended
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {p.minuti_volo !== null && (
          <span className="etichetta-viaggio tabular-nums">
            <IconaAereo size={13} />
            {durataVolo(p.minuti_volo)}
          </span>
        )}
        {p.trasporto && <span className="etichetta-viaggio">{p.trasporto}</span>}
        {p.meteo && (
          <span className="etichetta-viaggio" style={COLORE_METEO[p.meteo]}>
            {ETICHETTA_METEO[p.meteo]}
          </span>
        )}
        {p.budget && (
          <span className="etichetta-viaggio" style={COLORE_BUDGET[p.budget]}>
            {ETICHETTA_BUDGET[p.budget]}
          </span>
        )}
      </div>
      {(p.stagione || p.eventi || p.note) && (
        <p className="mt-2 text-[12.5px] leading-snug" style={{ color: 'var(--testo-2)' }}>
          {[p.stagione, p.eventi, p.note].filter(Boolean).join(' · ')}
        </p>
      )}
    </li>
  )
}
