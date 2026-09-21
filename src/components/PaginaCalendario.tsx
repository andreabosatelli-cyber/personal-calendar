import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import { useStato } from '../lib/stato'
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
  const { fuso, vista, cambiaVista, giorno, setGiorno, visibile, ricariche, segnalaRicarica } = useStato()
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
    setErroreSpostamento(null)
    try {
      await salvaSpostamento(ev.id, s)
      ricarica()
      segnalaRicarica()
    } catch (e) {
      // La griglia non si e' mai mossa dai dati veri, quindi non c'e' niente da
      // rimettere a posto: basta dire che non e' andata.
      setErroreSpostamento(
        e instanceof Error && !navigator.onLine ? 'You are offline: the event was not moved.' : 'Could not move the event.',
      )
    }
  }

  // Trascinamento di un bordo: cambia la durata, l'altro estremo resta dov'era.
  async function ridimensiona(ev: Evento, minuti: number, bordo: 'inizio' | 'fine') {
    const s = calcolaRidimensionamento(ev, minuti, bordo, fuso)
    // null = si e' provato a scendere sotto il quarto d'ora: si lascia com'era.
    if (!s) return
    setErroreSpostamento(null)
    try {
      await salvaSpostamento(ev.id, s)
      ricarica()
      segnalaRicarica()
    } catch (e) {
      setErroreSpostamento(
        e instanceof Error && !navigator.onLine
          ? 'You are offline: the event was not resized.'
          : 'Could not resize the event.',
      )
    }
  }

  return (
    // Niente scroll di pagina: il calendario occupa l'altezza utile e sono le
    // ore a scorrere, dentro la griglia. Prima la card aveva min-height 560px
    // dentro un contenitore che scorreva, e su telefono restava una finestrella
    // da sette ore con mezzo schermo sprecato sotto.
    <div className="flex h-full min-h-0 flex-col gap-[21px] overflow-hidden px-3 pb-3 pt-[5px] lg:pb-[22px] lg:pl-5 lg:pr-4 xl:flex-row">
      {/* Calendario */}
      <section className="card @container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5 @[720px]:gap-3 @[720px]:px-[18px] @[720px]:py-[15px]">
          <div className="flex shrink-0 items-center gap-1.5 @[720px]:gap-2">
            <button
              onClick={() => setGiorno(spostaVista(vista, giorno, -1, fuso))}
              className="btn-neutro premibile h-9 w-9 @[720px]:h-10 @[720px]:w-10"
              aria-label="Previous"
            >
              <IconaChevron size={18} verso="sx" />
            </button>
            <button
              onClick={() => setGiorno(spostaVista(vista, giorno, 1, fuso))}
              className="btn-neutro premibile h-9 w-9 @[720px]:h-10 @[720px]:w-10"
              aria-label="Next"
            >
              <IconaChevron size={18} verso="dx" />
            </button>
          </div>

          {/* Il titolo lungo non entra in 390px: "Saturday 19 September 2026"
              finiva in "Saturday 19 September…". Su schermo stretto si accorcia
              invece di troncarsi. */}
          <h2 className="min-w-0 flex-1 truncate pl-0.5 text-[19px] font-bold @[720px]:pl-1 @[720px]:text-[26px]">
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
              className="btn-neutro premibile h-[42px] shrink-0 px-4 disabled:opacity-45 @[720px]:px-[18px]"
            >
              Today
            </button>
            {/* Con la colonna destra chiusa il pulsante che la richiama vive
                qui: è l'unico posto che resta a vista. */}
            {largo && pannelloChiuso && (
              <button
                onClick={() => cambiaPannello(false)}
                className="btn-neutro premibile h-[42px] w-[42px] shrink-0"
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
          <button onClick={() => vai('export')} className="btn-tenue premibile h-[50px] w-full shrink-0">
            <IconaScarica size={19} />
            Export month as PDF
          </button>
        </aside>
      )}
    </div>
  )
}
