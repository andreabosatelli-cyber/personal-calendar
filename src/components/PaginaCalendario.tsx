import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import { useStato } from '../lib/stato'
import { useFinestre } from '../lib/finestreStato'
import { useEventiRange } from '../hooks/useEventiRange'
import { useAggregati, useDatiPannello } from '../hooks/useDatiPannello'
import { GrigliaMese } from './GrigliaMese'
import { GrigliaSettimana } from './GrigliaSettimana'
import { CardDistribuzione } from './pannello/CardDistribuzione'
import { CardViaggi } from './pannello/CardViaggi'
import { NOME_VISTA, VISTE, giorniVista, spostaVista, titoloVista, titoloVistaBreve } from '../lib/settimana'
import type { Periodo } from '../lib/statistiche'
import { LOCALE, oggiISO } from '../lib/tempo'
import { IconaChevron, IconaScarica } from '../lib/icone'
import {
  calcolaRidimensionamento,
  calcolaSpostamento,
  calcolaSpostamentoTuttoGiorno,
  salvaSpostamento,
} from '../lib/spostamento'
import type { Sezione } from '../lib/rotte'
import { intervalloEvento, type Impatto } from '../lib/frequenza'
import type { Spostamento } from '../lib/spostamento'
import { AvvisoLezioni } from './viaggi/AvvisoLezioni'

interface Props {
  onApriEvento: (ev: Evento | null) => void
  vai: (s: Sezione) => void
}

// La colonna destra compare solo quando c'è spazio per metterla ACCANTO al
// calendario. Sotto quella soglia il calendario si prende lo schermo e i suoi
// contenuti restano raggiungibili dal menu: Analytics, Trips ed Export sono
// schermate intere, non solo card di riepilogo.
const SOGLIA_PANNELLO = '(min-width: 1280px)'

// Come per la sidebar: chi lavora col calendario a tutta pagina non vuole
// richiudere la colonna destra a ogni apertura.
const CHIAVE_PANNELLO = 'pc_pannello'

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

export function PaginaCalendario({ onApriEvento, vai }: Props) {
  const { fuso, vista, cambiaVista, giorno, setGiorno, visibile, ricariche, segnalaRicarica, calendari } = useStato()
  const { fasce: tutteLeFasce, impattoDi } = useFinestre()
  // Un viaggio trascinato sopra delle lezioni non si salva subito: prima si
  // mostra cosa si perde e si chiede conferma.
  const [daConfermare, setDaConfermare] = useState<{
    ev: Evento
    s: Spostamento
    costo: Impatto
    verbo: 'moved' | 'resized'
  } | null>(null)
  // Le fasce seguono la spunta del calendario Travel: spento quello, spente anche loro.
  const fasce = calendari.includes('viaggi') ? tutteLeFasce : undefined
  const [periodo, setPeriodo] = useState<Periodo>('month')
  const largo = useMediaQuery(SOGLIA_PANNELLO)
  const [erroreSpostamento, setErroreSpostamento] = useState<string | null>(null)
  const [pannelloChiuso, setPannelloChiuso] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_PANNELLO) === '1'
    } catch {
      return false
    }
  })
  // C'è spazio E l'utente non l'ha chiusa: solo allora le card si calcolano.
  const conPannello = largo && !pannelloChiuso

  function cambiaPannello(chiuso: boolean) {
    setPannelloChiuso(chiuso)
    try {
      localStorage.setItem(CHIAVE_PANNELLO, chiuso ? '1' : '0')
    } catch {
      /* modalità privata: resta solo per questa sessione */
    }
  }

  const giorni = useMemo(() => giorniVista(vista, giorno, fuso), [vista, giorno, fuso])
  const { perGiorno, ricarica, offline, datiDel } = useEventiRange(giorni, fuso)
  const pannello = useDatiPannello(periodo, giorno, fuso, conPannello)
  const { dist, viaggi } = useAggregati(pannello.eventi, pannello.da, pannello.a, fuso, visibile)

  // I calendari spuntati e la ricerca filtrano la griglia senza rifare la query.
  const perGiornoFiltrato = useMemo(() => {
    const out: Record<string, Evento[]> = {}
    for (const [g, evs] of Object.entries(perGiorno)) out[g] = evs.filter(visibile)
    return out
  }, [perGiorno, visibile])

  // Un salvataggio o una sincronizzazione altrove fanno rileggere i dati.
  useEffect(() => {
    if (!ricariche) return
    ricarica()
    pannello.ricarica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricariche])

  const oggi = oggiISO(fuso)
  const suOggi = giorni.includes(oggi)

  // Trascinamento: si scrive e si rilegge. Niente aggiornamento ottimistico —
  // sarebbe una seconda copia della verita' da tenere allineata, e la rilettura
  // costa una frazione di secondo su una griglia gia' in cache.
  async function sposta(ev: Evento, minuti: number, giornoArrivo: string | null) {
    const giornoPartenza =
      Object.entries(perGiorno).find(([, evs]) => evs.some((x) => x.id === ev.id))?.[0] ?? null
    const s = ev.tutto_il_giorno
      ? calcolaSpostamentoTuttoGiorno(ev, giornoArrivo, giornoPartenza)
      : calcolaSpostamento(ev, minuti, giornoArrivo, giornoPartenza, fuso)
    if (!s) return
    if (chiediConferma(ev, s, 'moved')) return
    await scriviSpostamento(ev, s, 'moved')
  }

  // Solo i viaggi: se il nuovo periodo copre lezioni, si ferma e chiede.
  function chiediConferma(ev: Evento, s: Spostamento, verbo: 'moved' | 'resized'): boolean {
    if (ev.origine !== 'viaggi') return false
    const costo = impattoDi([intervalloEvento({ ...ev, ...s })], { evento: ev.id })
    if (!costo.lezioni.length) return false
    setDaConfermare({ ev, s, costo, verbo })
    return true
  }

  async function scriviSpostamento(ev: Evento, s: Spostamento, verbo: 'moved' | 'resized') {
    setErroreSpostamento(null)
    try {
      await salvaSpostamento(ev.id, s)
      ricarica()
      segnalaRicarica()
    } catch (e) {
      // La griglia non si e' mai mossa dai dati veri, quindi non c'e' niente da
      // rimettere a posto: basta dire che non e' andata.
      setErroreSpostamento(
        e instanceof Error && !navigator.onLine
          ? `You are offline: the event was not ${verbo}.`
          : `Could not ${verbo === 'moved' ? 'move' : 'resize'} the event.`,
      )
    }
  }

  // Trascinamento di un bordo: cambia la durata, l'altro estremo resta dov'era.
  async function ridimensiona(ev: Evento, minuti: number, bordo: 'inizio' | 'fine') {
    const s = calcolaRidimensionamento(ev, minuti, bordo, fuso)
    // null = si e' provato a scendere sotto il quarto d'ora: si lascia com'era.
    if (!s) return
    if (chiediConferma(ev, s, 'resized')) return
    await scriviSpostamento(ev, s, 'resized')
  }

  return (
    // Niente scroll di pagina: il calendario occupa l'altezza utile e sono le
    // ore a scorrere, dentro la griglia. Prima la card aveva min-height 560px
    // dentro un contenitore che scorreva, e su telefono restava una finestrella
    // da sette ore con mezzo schermo sprecato sotto.
    <div className="flex h-full min-h-0 flex-col gap-[21px] overflow-hidden px-3 pb-3 pt-[5px] lg:pb-[22px] lg:pl-5 lg:pr-4 xl:flex-row">
      {/* Calendario */}
      <section className="card @container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 @[720px]:gap-3 @[720px]:px-5 @[720px]:py-5">
          <div className="flex shrink-0 items-center gap-1.5 @[720px]:gap-2">
            <button
              onClick={() => setGiorno(spostaVista(vista, giorno, -1, fuso))}
              className="btn-neutro premibile h-11 w-11"
              aria-label="Previous"
            >
              <IconaChevron size={18} verso="sx" />
            </button>
            <button
              onClick={() => setGiorno(spostaVista(vista, giorno, 1, fuso))}
              className="btn-neutro premibile h-11 w-11"
              aria-label="Next"
            >
              <IconaChevron size={18} verso="dx" />
            </button>
          </div>

          {/* Il titolo lungo non entra in 390px: "Saturday 19 September 2026"
              finiva in "Saturday 19 September…". Su schermo stretto si accorcia
              invece di troncarsi. */}
          <h2 className="min-w-0 flex-1 truncate pl-1 text-[22px] font-medium tracking-[-0.03em] @[720px]:pl-2 @[720px]:text-[26px] @[900px]:text-[28px]">
            <span className="@[720px]:hidden">{titoloVistaBreve(vista, giorno, fuso)}</span>
            <span className="hidden @[720px]:inline">{titoloVista(vista, giorno, fuso)}</span>
          </h2>

          <div className="flex w-full shrink-0 items-center justify-between gap-2 @[720px]:w-auto @[720px]:justify-end @[720px]:gap-2.5">
            <div className="seg">
              {VISTE.map((v) => (
                <button
                  key={v}
                  onClick={() => cambiaVista(v)}
                  className={`seg-item premibile !px-[0.9rem] @[720px]:!px-[1.05rem] ${v === vista ? 'attivo' : ''}`}
                >
                  {NOME_VISTA[v]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setGiorno(oggi)}
              disabled={suOggi}
              className="btn-neutro premibile h-11 shrink-0 px-4 disabled:opacity-45 @[720px]:px-5"
            >
              Today
            </button>
            {/* Con la colonna destra chiusa il pulsante che la richiama vive
                qui: è l'unico posto che resta a vista. */}
            {largo && pannelloChiuso && (
              <button
                onClick={() => cambiaPannello(false)}
                className="btn-neutro premibile h-11 w-11 shrink-0"
                aria-label="Show side panel"
                title="Show side panel"
              >
                <IconaChevron size={18} verso="sx" />
              </button>
            )}
          </div>
        </div>

        {erroreSpostamento && (
          <p className="shrink-0 px-3 pb-2 text-center text-[12px]" style={{ color: 'var(--errore)' }}>
            {erroreSpostamento}
          </p>
        )}

        {offline && (
          <p
            className="shrink-0 px-3 pb-2 text-center text-[12px]"
            style={{ color: 'var(--cat-viaggi-fg)' }}
          >
            {datiDel
              ? `Offline — showing data from ${DateTime.fromISO(datiDel, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE).toFormat('d LLL, HH:mm')}`
              : 'Offline — no local copy available'}
          </p>
        )}

        <div className="min-h-0 flex-1" style={{ borderTop: '1px solid var(--linea)' }}>
          {vista === 'mese' ? (
            <GrigliaMese
              perGiorno={perGiornoFiltrato}
              giorni={giorni}
              ancora={giorno}
              fuso={fuso}
              onApri={onApriEvento}
              onApriGiorno={(g) => {
                setGiorno(g)
                cambiaVista('giorno')
              }}
              onSposta={sposta}
              fasce={fasce}
            />
          ) : (
            <GrigliaSettimana
              perGiorno={perGiornoFiltrato}
              giorni={giorni}
              giornoAttivo={giorno}
              fuso={fuso}
              onApri={onApriEvento}
              onSelezionaGiorno={setGiorno}
              onSposta={sposta}
              onRidimensiona={ridimensiona}
              finestre={fasce}
            />
          )}
        </div>
      </section>

      {/* Colonna destra */}
      {conPannello && (
        <aside className="flex w-[335px] shrink-0 flex-col gap-4 overflow-y-auto scroll-fine [&>*]:shrink-0">
          <CardDistribuzione
            dist={dist}
            periodo={periodo}
            onPeriodo={setPeriodo}
            onNascondi={() => cambiaPannello(true)}
          />
          <CardViaggi
            viaggi={viaggi}
            fuso={fuso}
            periodo={periodo}
            onPeriodo={setPeriodo}
            onApri={() => vai('trips')}
          />
          <button onClick={() => vai('export')} className="btn-primario premibile h-[52px] w-full shrink-0">
            <IconaScarica size={19} />
            Export month as PDF
          </button>
        </aside>
      )}

      {daConfermare && (
        <ConfermaViaggio
          titolo={daConfermare.ev.titolo}
          verbo={daConfermare.verbo}
          costo={daConfermare.costo}
          onAnnulla={() => setDaConfermare(null)}
          onConferma={() => {
            const { ev, s, verbo } = daConfermare
            setDaConfermare(null)
            void scriviSpostamento(ev, s, verbo)
          }}
        />
      )}
    </div>
  )
}

// Conferma prima di salvare un viaggio trascinato sopra delle lezioni.
function ConfermaViaggio({
  titolo,
  verbo,
  costo,
  onAnnulla,
  onConferma,
}: {
  titolo: string
  verbo: 'moved' | 'resized'
  costo: Impatto
  onAnnulla: () => void
  onConferma: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center" onClick={onAnnulla}>
      <div className="anim-fade absolute inset-0" style={{ background: 'var(--velo)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trip overlaps classes"
        className="anim-sheet-su relative flex w-full max-w-[480px] flex-col gap-3 rounded-t-[28px] px-5 pt-5 lg:rounded-[28px] lg:px-7 lg:py-6"
        style={{
          background: 'var(--pagina)',
          boxShadow: 'var(--ombra-galleggia)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[19px] font-medium leading-tight tracking-[-0.02em]">
          {titolo} {verbo === 'moved' ? 'now overlaps' : 'would overlap'} classes
        </h3>
        <AvvisoLezioni impatto={costo} />
        <div className="flex gap-2">
          <button onClick={onAnnulla} className="btn-neutro premibile h-12 flex-1 text-[14.5px]">
            Cancel
          </button>
          <button onClick={onConferma} className="btn-primario premibile h-12 flex-1 !text-[14.5px]">
            Save anyway
          </button>
        </div>
      </div>
    </div>
  )
}
