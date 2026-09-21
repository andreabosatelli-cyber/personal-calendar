import { useEffect, useState, type FormEvent } from 'react'
import { DateTime } from 'luxon'
import { supabase } from '../lib/supabase'
import type { Evento, Origine } from '../lib/types'
import {
  COLORI_ORIGINE,
  fusoRif,
  LOCALE,
  nomeOrigine,
  PASSO_MINUTI,
  daMinuti,
  eMultiGiorno,
  giorniEstremi,
  asseUnico,
  minutiDa,
  opzioneFuso,
  orarioEvento,
} from '../lib/tempo'
import { useChiudiFuori } from '../hooks/useChiudiFuori'
import { SelettoreOra } from './SelettoreOra'
import { approvaRichiesta, rifiutaRichiesta } from '../lib/condivisione'
import { prenotaSuCondiviso } from '../lib/condivisi'
import { coloreEvento } from '../lib/tempo'
import { useStato } from '../lib/stato'
import { IconaAereo, IconaChiudi, IconaLuogo, IconaOrologio, IconaRipeti, IconaVideo } from '../lib/icone'
import {
  aggiornaSerieDa,
  creaSerie,
  daPreset,
  descriviRicorrenza,
  eliminaSerieDa,
  leggiSerie,
  PRESET,
  presetDi,
  SENZA_FINE,
  staccaSerieDa,
  unitaLabel,
  type Preset,
  type Ricorrenza,
  type UnitaRicorrenza,
} from '../lib/ricorrenza'

interface Props {
  giornoISO: string
  evento: Evento | null // null = nuovo
  fuso: string
  onChiudi: () => void
  onSalvato: () => void
}

// Categorie creabili a mano. 'universita' è mostrata come "Study".
const TIPI: { id: Origine; label: string }[] = [
  { id: 'personale', label: 'Personal' },
  { id: 'lavoro', label: 'Work' },
  { id: 'universita', label: 'Study' },
  { id: 'viaggi', label: 'Travel' },
]

// Sola lettura = evento IMPORTATO (ha id_esterno) oppure evento di un
// calendario che qualcun altro mi ha condiviso: guardarlo si', toccarlo no.
// Sul calendario di un altro si prenota, non si edita.
const soloLettura = (ev: Evento | null) => ev !== null && (ev.id_esterno !== null || ev.condiviso != null)

// Ultimo slot della giornata (23:45): un evento non scavalla la mezzanotte da
// solo, per farlo si sposta la data di fine.
const ULTIMO_SLOT = 24 * 60 - PASSO_MINUTI

const giorniTra = (da: string, a: string) =>
  Math.round(DateTime.fromISO(a).diff(DateTime.fromISO(da), 'days').days)

const spostaData = (giornoISO: string, n: number) =>
  DateTime.fromISO(giornoISO).plus({ days: n }).toISODate()!

// Le scritture sono online-only (niente coda offline): meglio dirlo che
// mostrare all'utente un "Failed to fetch".
function messaggioErrore(err: unknown): string {
  const m = err instanceof Error ? err.message : 'Unexpected error'
  if (!navigator.onLine) return 'You are offline: events can only be saved with a connection.'
  if (/failed to fetch|networkerror/i.test(m)) return 'Server unreachable: please try again shortly.'
  return m
}

// Contenitore comune: modale centrata su desktop, sheet dal basso su mobile.
function Contenitore({ onChiudi, children }: { onChiudi: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center" onClick={onChiudi}>
      <div className="anim-fade absolute inset-0" style={{ background: 'rgb(20 18 40 / 0.42)' }} />
      <div
        className="anim-sheet-su relative max-h-[92vh] w-full max-w-[460px] overflow-y-auto scroll-fine rounded-t-[22px] px-[22px] pb-8 pt-4 lg:rounded-[20px] lg:pb-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--linea)',
          boxShadow: '0 24px 60px -18px rgb(20 18 40 / 0.35)',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full lg:hidden" style={{ background: 'var(--linea-2)' }} />
        {children}
      </div>
    </div>
  )
}

function Etichetta({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
      {children}
    </span>
  )
}

export function SheetEvento({ giornoISO, evento, fuso, onChiudi, onSalvato }: Props) {
  const { condivisi, nome: mioNome } = useStato()
  const readonly = soloLettura(evento)
  // Su quali calendari altrui posso prenotare. Vale solo per un evento nuovo:
  // un evento esistente sta gia' dove sta.
  const prenotabili = evento ? [] : condivisi.filter((c) => c.permesso === 'prenota')
  // 'io' = il mio calendario; altrimenti l'id del proprietario.
  const [destinazione, setDestinazione] = useState<string>('io')
  const suCondiviso = destinazione !== 'io'
  const destinatario = prenotabili.find((c) => c.proprietario_id === destinazione)
  const opzLoc = opzioneFuso(fuso)
  // L'asse coincide col fuso di riferimento (o non ce n'e' uno): niente doppio
  // fuso da riconciliare.
  const aCasa = asseUnico(fuso)
  const zonaRif = fusoRif() ?? fuso
  const opzRif = opzioneFuso(zonaRif)

  const zonaIniziale: 'locale' | 'rif' = evento && evento.fuso_origine === zonaRif && !aCasa ? 'rif' : 'locale'
  const zoneIniz = zonaIniziale === 'rif' ? zonaRif : fuso
  const iniz = evento ? DateTime.fromISO(evento.inizio_utc, { zone: 'utc' }).setZone(zoneIniz) : null
  const finiz = evento ? DateTime.fromISO(evento.fine_utc, { zone: 'utc' }).setZone(zoneIniz) : null

  // Le due date esistono sempre, non solo per i tutto-il-giorno: di default
  // coincidono, quindi un evento in giornata non chiede nessuna interazione in
  // più di prima.
  const estremi = evento ? giorniEstremi(evento) : null
  const [origine, setOrigine] = useState<Origine>(evento?.origine ?? 'personale')
  const [zonaInput, setZonaInput] = useState<'locale' | 'rif'>(zonaIniziale)
  const [titolo, setTitolo] = useState(evento?.titolo ?? '')
  const [giorno, setGiorno] = useState(estremi ? estremi.primo : giornoISO)
  const [giornoFine, setGiornoFine] = useState(estremi ? estremi.ultimo : giornoISO)
  const [oraInizio, setOraInizio] = useState(iniz ? iniz.toFormat('HH:mm') : '09:00')
  const [oraFine, setOraFine] = useState(finiz ? finiz.toFormat('HH:mm') : '10:00')
  // Quale delle due liste di slot è aperta (una per volta: sono alte).
  const [oraAperta, setOraAperta] = useState<'inizio' | 'fine' | null>(null)

  const stessaData = giorno === giornoFine
  const multiGiorno = giornoFine > giorno
  const dateInvertite = giornoFine < giorno

  function cambiaInizio(v: string) {
    const durata = Math.max(PASSO_MINUTI, minutiDa(oraFine) - minutiDa(oraInizio))
    setOraInizio(v)
    // End segue Start mantenendo la durata impostata, e resta comunque
    // modificabile a mano. Se le due date sono diverse la fine sta su un'altra
    // giornata e non deve muoversi.
    if (stessaData) setOraFine(daMinuti(Math.min(minutiDa(v) + durata, ULTIMO_SLOT)))
    setOraAperta(null)
  }

  function cambiaFine(v: string) {
    setOraFine(v)
    setOraAperta(null)
  }

  // Spostando l'inizio oltre la fine, la fine lo segue conservando la durata in
  // giorni: un viaggio di sei giorni spostato in avanti resta di sei giorni.
  function cambiaGiorno(v: string) {
    if (!v) return
    const durataGiorni = Math.max(0, giorniTra(giorno, giornoFine))
    setGiorno(v)
    if (v > giornoFine) setGiornoFine(spostaData(v, durataGiorni))
  }
  const [tuttoGiorno, setTuttoGiorno] = useState(evento?.tutto_il_giorno ?? false)
  const [luogo, setLuogo] = useState(evento?.luogo ?? '')
  const [linkVideo, setLinkVideo] = useState(evento?.link_video ?? '')
  const [note, setNote] = useState(evento?.descrizione ?? '')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  // Ripetizione. Un evento nuovo parte da "non si ripete"; aprendo
  // un'occorrenza la regola arriva dal database e il controllo si ritrova dove
  // era stato lasciato.
  const ricorrente = evento?.serie_id != null
  const [preset, setPreset] = useState<Preset>('mai')
  const [ric, setRic] = useState<Ricorrenza>(SENZA_FINE)
  // Su quali occorrenze agiscono Save e Delete. Il passato non si riscrive mai:
  // 'serie' vale da questa occorrenza in avanti.
  const [ambito, setAmbito] = useState<'questo' | 'serie'>('questo')

  useEffect(() => {
    if (!evento?.serie_id) return
    let vivo = true
    leggiSerie(evento.serie_id).then((s) => {
      if (!vivo || !s) return
      setRic(s)
      setPreset(presetDi(s))
    })
    return () => {
      vivo = false
    }
  }, [evento?.serie_id])

  // Cambiando scelta rapida si tiene la fine gia' impostata: passare da
  // settimanale a mensile non deve far dimenticare "fino al 31 dicembre".
  function cambiaPreset(p: Preset) {
    setPreset(p)
    if (p !== 'mai') setRic((prec) => daPreset(p, prec))
  }

  // Le due fini hanno bisogno di un valore sensato appena le si sceglie,
  // altrimenti il salvataggio si ferma su un campo vuoto.
  function cambiaFineTipo(t: Ricorrenza['fineTipo']) {
    setRic((prec) => ({
      ...prec,
      fineTipo: t,
      fineData: t === 'data' ? (prec.fineData ?? spostaData(giorno, 90)) : null,
      fineConteggio: t === 'conteggio' ? (prec.fineConteggio ?? 10) : null,
    }))
  }

  const zoneParse = zonaInput === 'rif' ? zonaRif : fuso
  const rifOrari = useChiudiFuori(() => setOraAperta(null), oraAperta !== null)

  // Anteprima riconciliazione live nei due fusi (DST gestito da luxon).
  let anteprima: { loc: string; rom: string; giornoDiverso: boolean } | null = null
  if (!tuttoGiorno) {
    const i = DateTime.fromISO(`${giorno}T${oraInizio}`, { zone: zoneParse })
    const f = DateTime.fromISO(`${giornoFine}T${oraFine}`, { zone: zoneParse })
    if (i.isValid && f.isValid && f > i) {
      const fmt = (z: string) => `${i.setZone(z).toFormat('HH:mm')} – ${f.setZone(z).toFormat('HH:mm')}`
      anteprima = {
        loc: fmt(fuso),
        rom: fmt(zonaRif),
        giornoDiverso: i.setZone(fuso).toISODate() !== i.setZone(zonaRif).toISODate(),
      }
    }
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setInCorso(true)
    try {
      let inizio_utc: string
      let fine_utc: string
      if (giornoFine < giorno) throw new Error('The end date cannot be before the start date.')
      if (tuttoGiorno) {
        inizio_utc = `${giorno}T00:00:00.000Z`
        fine_utc = DateTime.fromISO(giornoFine, { zone: 'utc' }).plus({ days: 1 }).toISO()!
      } else {
        const i = DateTime.fromISO(`${giorno}T${oraInizio}`, { zone: zoneParse })
        const f = DateTime.fromISO(`${giornoFine}T${oraFine}`, { zone: zoneParse })
        if (f <= i) throw new Error('The end must be after the start.')
        inizio_utc = i.toUTC().toISO()!
        fine_utc = f.toUTC().toISO()!
      }

      const campi = {
        origine,
        titolo: titolo.trim() || '(untitled)',
        descrizione: note.trim() || null,
        luogo: luogo.trim() || null,
        link_video: linkVideo.trim() || null,
        inizio_utc,
        fine_utc,
        fuso_origine: tuttoGiorno ? fuso : zoneParse,
        tutto_il_giorno: tuttoGiorno,
      }

      if (preset !== 'mai') {
        if (ric.fineTipo === 'data' && (!ric.fineData || ric.fineData < giorno))
          throw new Error('The repeat end date must be on or after the start date.')
        if (ric.fineTipo === 'conteggio' && (!ric.fineConteggio || ric.fineConteggio < 2))
          throw new Error('A repeating event needs at least 2 occurrences.')
      }

      let idEvento = evento?.id ?? null

      if (suCondiviso && destinatario) {
        // Sul calendario di un altro non si scrive un evento: si manda una
        // richiesta, che resta in attesa finche' il proprietario non decide.
        await prenotaSuCondiviso(
          destinatario.proprietario_id,
          {
            titolo: campi.titolo,
            descrizione: campi.descrizione,
            luogo: campi.luogo,
            link_video: campi.link_video,
            inizio_utc: campi.inizio_utc,
            fine_utc: campi.fine_utc,
            fuso_origine: campi.fuso_origine,
          },
          mioNome,
        )
      } else if (evento) {
        const { error } = await supabase.from('eventi').update(campi).eq('id', evento.id)
        if (error) throw error
      } else {
        const { data: u } = await supabase.auth.getUser()
        const { data: creato, error } = await supabase
          .from('eventi')
          .insert({ ...campi, utente_id: u.user!.id })
          .select('id')
          .single()
        if (error) throw error
        idEvento = (creato as { id: string }).id
      }

      // La ripetizione si applica quando la riga esiste gia': e' quella a fare
      // da capostipite, e il database genera le altre a partire da lei.
      if (!suCondiviso && idEvento) {
        if (!evento) {
          if (preset !== 'mai') await creaSerie(idEvento, ric)
        } else if (ricorrente && ambito === 'serie') {
          if (preset === 'mai') await staccaSerieDa(idEvento)
          else await aggiornaSerieDa(idEvento, ric)
        } else if (!ricorrente && preset !== 'mai') {
          await creaSerie(idEvento, ric)
        }
      }

      onSalvato()
      onChiudi()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  async function cancella() {
    if (!evento) return
    const tuttaLaSerie = ricorrente && ambito === 'serie'
    if (!confirm(tuttaLaSerie ? 'Delete this and all following occurrences?' : 'Delete this event?')) return
    setInCorso(true)
    try {
      if (tuttaLaSerie) {
        await eliminaSerieDa(evento.id)
      } else {
        const { error } = await supabase.from('eventi').delete().eq('id', evento.id)
        if (error) throw error
      }
      onSalvato()
      onChiudi()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  // Un evento che arriva da un calendario altrui non si edita e non si
  // approva: al massimo, se la richiesta l'ho mandata io e nessuno l'ha ancora
  // vista, si ritira.
  if (evento?.condiviso) {
    const miaRichiesta = evento.stato === 'in_attesa'
    return (
      <Contenitore onChiudi={onChiudi}>
        <ReadOnly
          evento={evento}
          fuso={fuso}
          onChiudi={onChiudi}
          onRitira={
            miaRichiesta
              ? async () => {
                  if (!confirm('Withdraw this request?')) return
                  const { error } = await supabase.from('eventi').delete().eq('id', evento.id)
                  if (error) {
                    setErrore(messaggioErrore(error))
                    return
                  }
                  onSalvato()
                  onChiudi()
                }
              : undefined
          }
        />
        {errore && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}
      </Contenitore>
    )
  }

  if (evento?.stato === 'in_attesa') {
    return (
      <Contenitore onChiudi={onChiudi}>
        <Richiesta
          evento={evento}
          fuso={fuso}
          onFatto={() => {
            onSalvato()
            onChiudi()
          }}
          onChiudi={onChiudi}
        />
      </Contenitore>
    )
  }
  if (readonly) {
    return (
      <Contenitore onChiudi={onChiudi}>
        <ReadOnly evento={evento!} fuso={fuso} onChiudi={onChiudi} />
      </Contenitore>
    )
  }

  return (
    <Contenitore onChiudi={onChiudi}>
      <form onSubmit={salva}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-[22px] font-bold">
            {evento ? 'Edit event' : suCondiviso ? `Book with ${destinatario?.nome ?? ''}` : 'New event'}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            className="premibile -mr-1 -mt-0.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]"
            style={{ color: 'var(--testo-3)' }}
            aria-label="Close"
          >
            <IconaChiudi size={17} />
          </button>
        </div>

        {/* Su quale calendario finisce. Compare solo se qualcuno mi ha dato il
            permesso di prenotare: altrimenti c'è una destinazione sola e il
            controllo sarebbe rumore. */}
        {prenotabili.length > 0 && (
          <div className="mb-4">
            <Etichetta>Add to</Etichetta>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDestinazione('io')}
                className="premibile rounded-[11px] px-3 py-2 text-[13px] font-semibold transition-colors"
                style={
                  !suCondiviso
                    ? { background: 'var(--tenue)', color: 'var(--primario)', boxShadow: 'inset 0 0 0 1.5px var(--primario)' }
                    : { background: 'var(--controllo)', color: 'var(--testo-2)' }
                }
              >
                My calendar
              </button>
              {prenotabili.map((c) => {
                const sel = destinazione === c.proprietario_id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDestinazione(c.proprietario_id)}
                    className="premibile rounded-[11px] px-3 py-2 text-[13px] font-semibold transition-colors"
                    style={
                      sel
                        ? { background: 'var(--tenue)', color: 'var(--primario)', boxShadow: 'inset 0 0 0 1.5px var(--primario)' }
                        : { background: 'var(--controllo)', color: 'var(--testo-2)' }
                    }
                  >
                    {c.nome}
                  </button>
                )
              })}
            </div>
            {suCondiviso && (
              <p className="mt-2 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                {destinatario?.nome} gets a request to approve — it is not on their calendar until they do.
              </p>
            )}
          </div>
        )}

        {/* Categoria: la sceglie chi possiede il calendario. Una richiesta
            entra sempre come impegno personale, e sara' lui a ricollocarla. */}
        <div className={`mb-4 grid grid-cols-4 gap-1.5 ${suCondiviso ? 'hidden' : ''}`}>
          {TIPI.map((tp) => {
            const sel = origine === tp.id
            const c = COLORI_ORIGINE[tp.id]
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => setOrigine(tp.id)}
                className="premibile flex flex-col items-center gap-1.5 rounded-[12px] py-2.5 text-[12.5px] font-semibold transition-colors"
                style={
                  sel
                    ? { background: c.sfondo, color: c.testo, boxShadow: `inset 0 0 0 1.5px ${c.punto}` }
                    : { background: 'var(--controllo)', color: 'var(--testo-2)' }
                }
              >
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: c.punto }} />
                {tp.label}
              </button>
            )
          })}
        </div>

        <input
          autoFocus
          placeholder={origine === 'viaggi' ? 'Where are you? e.g. Menorca' : 'Event title'}
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          className="campo mb-3 !text-[17px] !font-semibold"
        />
        {/* Due date sempre presenti. Uguali di default: l'evento in giornata
            resta il caso di un tocco solo, ma "in viaggio dal 5 al 10" adesso
            si può scrivere senza passare da "all day". */}
        <div className="mb-2 flex gap-3">
          <label className="min-w-0 flex-1">
            <Etichetta>Start date</Etichetta>
            <input
              type="date"
              value={giorno}
              onChange={(e) => cambiaGiorno(e.target.value)}
              className="campo min-h-[46px] tabular-nums"
            />
          </label>
          <label className="min-w-0 flex-1">
            <Etichetta>End date</Etichetta>
            <input
              type="date"
              min={giorno}
              value={giornoFine}
              onChange={(e) => setGiornoFine(e.target.value)}
              className="campo min-h-[46px] tabular-nums"
              style={dateInvertite ? { borderColor: 'var(--errore)' } : undefined}
              aria-invalid={dateInvertite}
            />
          </label>
        </div>

        {dateInvertite ? (
          <p className="mb-3 text-[12.5px]" style={{ color: 'var(--errore)' }}>
            The end date cannot be before the start date.
          </p>
        ) : multiGiorno ? (
          <p className="mb-3 text-[12px]" style={{ color: 'var(--testo-3)' }}>
            {giorniTra(giorno, giornoFine) + 1} days — shown as a continuous band above the hours.
          </p>
        ) : (
          <div className="mb-3" />
        )}

        <label
          className="mb-3 flex min-h-[46px] cursor-pointer items-center justify-between rounded-[11px] px-3.5"
          style={{ background: 'var(--controllo)' }}
        >
          <span className="text-[14.5px] font-medium">All day</span>
          <input
            type="checkbox"
            checked={tuttoGiorno}
            onChange={(e) => {
              setTuttoGiorno(e.target.checked)
              setOraAperta(null)
            }}
            className="h-[19px] w-[19px] accent-[var(--primario)]"
          />
        </label>

        {!tuttoGiorno && (
          <>
            {/* Fuso in cui inserisci l'orario: preimpostato sulla località
                selezionata. Se l'asse coincide col fuso di riferimento i due
                lati direbbero la stessa ora, quindi il selettore lascia il
                posto a un'etichetta. */}
            {aCasa ? (
              <p className="mb-2 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                Times in {opzLoc.bandiera} {opzLoc.etichetta}
              </p>
            ) : (
              <div className="mb-2.5">
                <Etichetta>Enter times in</Etichetta>
                <div className="seg">
                  <button
                    type="button"
                    onClick={() => setZonaInput('locale')}
                    className={`seg-item premibile flex-1 !text-[13px] ${zonaInput === 'locale' ? 'attivo' : ''}`}
                  >
                    {opzLoc.bandiera} {opzLoc.etichetta}
                  </button>
                  <button
                    type="button"
                    onClick={() => setZonaInput('rif')}
                    className={`seg-item premibile flex-1 !text-[13px] ${zonaInput === 'rif' ? 'attivo' : ''}`}
                  >
                    {opzRif.bandiera} {opzRif.etichetta}
                  </button>
                </div>
              </div>
            )}

            <div ref={rifOrari} className="mb-3 flex items-start gap-3">
              <SelettoreOra
                etichetta="Start"
                valore={oraInizio}
                onCambia={cambiaInizio}
                aperto={oraAperta === 'inizio'}
                onApri={() => setOraAperta((v) => (v === 'inizio' ? null : 'inizio'))}
              />
              <SelettoreOra
                etichetta="End"
                valore={oraFine}
                onCambia={cambiaFine}
                aperto={oraAperta === 'fine'}
                onApri={() => setOraAperta((v) => (v === 'fine' ? null : 'fine'))}
                durataDa={stessaData ? minutiDa(oraInizio) : null}
                dopo={stessaData ? oraInizio : null}
              />
            </div>

            {/* Riconciliazione live (inutile se l'asse è già Roma) */}
            {anteprima && !aCasa && (
              <div
                className="mb-3 rounded-[12px] px-3.5 py-2.5 text-[13px]"
                style={{ background: 'var(--tenue)' }}
              >
                <div className="flex justify-between tabular-nums">
                  <span style={{ color: 'var(--testo-2)' }}>
                    {opzLoc.bandiera} {opzLoc.etichetta}
                  </span>
                  <span className="font-semibold">{anteprima.loc}</span>
                </div>
                <div className="mt-1 flex justify-between tabular-nums">
                  <span style={{ color: 'var(--testo-2)' }}>
                    {opzRif.bandiera} {opzRif.etichetta}
                  </span>
                  <span className="font-semibold">{anteprima.rom}</span>
                </div>
                {anteprima.giornoDiverso && (
                  <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--testo-2)' }}>
                    Falls on a different day in the two timezones
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Ripetizione. Non compare quando si prenota sul calendario di un
            altro: li' si manda una richiesta, e una richiesta e' una volta
            sola. */}
        {!suCondiviso && (
          <div className="mb-3">
            {/* Su un'occorrenza la prima domanda non e' "come si ripete" ma
                "a chi si applica quello che sto per fare". */}
            {ricorrente && (
              <>
                <Etichetta>Apply to</Etichetta>
                <div className="seg mb-2.5">
                  <button
                    type="button"
                    onClick={() => setAmbito('questo')}
                    className={`seg-item premibile flex-1 !text-[13px] ${ambito === 'questo' ? 'attivo' : ''}`}
                  >
                    This event
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmbito('serie')}
                    className={`seg-item premibile flex-1 !text-[13px] ${ambito === 'serie' ? 'attivo' : ''}`}
                  >
                    This and following
                  </button>
                </div>
              </>
            )}

            {ricorrente && ambito === 'questo' ? (
              <p className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                <IconaRipeti size={14} />
                {descriviRicorrenza(ric)} — switch to “This and following” to change it
              </p>
            ) : (
              <>
                <Etichetta>Repeat</Etichetta>
                <select
                  value={preset}
                  onChange={(e) => cambiaPreset(e.target.value as Preset)}
                  className="campo min-h-[46px]"
                >
                  {PRESET.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                {preset === 'personalizzata' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="shrink-0 text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
                      Every
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={ric.intervallo}
                      onChange={(e) =>
                        setRic({ ...ric, intervallo: Math.min(365, Math.max(1, Number(e.target.value) || 1)) })
                      }
                      className="campo min-h-[42px] w-[78px] tabular-nums"
                    />
                    <select
                      value={ric.unita}
                      onChange={(e) => setRic({ ...ric, unita: e.target.value as UnitaRicorrenza })}
                      className="campo min-h-[42px] flex-1"
                    >
                      {(['giorni', 'settimane', 'mesi'] as UnitaRicorrenza[]).map((u) => (
                        <option key={u} value={u}>
                          {unitaLabel(u, ric.intervallo)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {preset !== 'mai' && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={ric.fineTipo}
                        onChange={(e) => cambiaFineTipo(e.target.value as Ricorrenza['fineTipo'])}
                        className="campo min-h-[42px] flex-1"
                      >
                        <option value="mai">Never ends</option>
                        <option value="data">Ends on</option>
                        <option value="conteggio">Ends after</option>
                      </select>
                      {ric.fineTipo === 'data' && (
                        <input
                          type="date"
                          min={giorno}
                          value={ric.fineData ?? ''}
                          onChange={(e) => setRic({ ...ric, fineData: e.target.value || null })}
                          className="campo min-h-[42px] flex-1 tabular-nums"
                        />
                      )}
                      {ric.fineTipo === 'conteggio' && (
                        <>
                          <input
                            type="number"
                            min={2}
                            max={500}
                            value={ric.fineConteggio ?? 10}
                            onChange={(e) =>
                              setRic({
                                ...ric,
                                fineConteggio: Math.min(500, Math.max(2, Number(e.target.value) || 2)),
                              })
                            }
                            className="campo min-h-[42px] w-[78px] tabular-nums"
                          />
                          <span className="shrink-0 text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
                            times
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                      {descriviRicorrenza(ric)}
                      {ric.fineTipo === 'mai' && ' — generated two years ahead, then extended automatically'}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <input
          placeholder="Location"
          value={luogo}
          onChange={(e) => setLuogo(e.target.value)}
          className="campo mb-3"
        />
        <input
          type="url"
          inputMode="url"
          placeholder="Video call link (Meet, Teams…)"
          value={linkVideo}
          onChange={(e) => setLinkVideo(e.target.value)}
          className="campo mb-3"
        />
        <textarea
          placeholder="Notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="campo mb-4 resize-none"
        />

        {errore && (
          <p className="mb-3 text-[13px]" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}

        <button
          type="submit"
          disabled={inCorso || dateInvertite}
          className="btn-primario premibile h-[48px] w-full !text-[16px]"
        >
          {inCorso ? 'Saving…' : 'Save event'}
        </button>
        {evento && (
          <button
            type="button"
            onClick={cancella}
            disabled={inCorso}
            className="premibile mt-2 h-[44px] w-full rounded-[14px] text-[14.5px] font-semibold transition-colors hover:bg-[var(--hover)]"
            style={{ color: 'var(--errore)' }}
          >
            {ricorrente && ambito === 'serie' ? 'Delete this and following' : 'Delete event'}
          </button>
        )}
      </form>
    </Contenitore>
  )
}

// "All day" per una giornata sola, "15 – 17 September" per un soggiorno.
function giorniCoperti(ev: Evento): string {
  const { primo, ultimo } = giorniEstremi(ev)
  if (ultimo === primo) return 'All day'
  const a = DateTime.fromISO(primo).setLocale(LOCALE)
  const b = DateTime.fromISO(ultimo).setLocale(LOCALE)
  return a.month === b.month
    ? `${a.toFormat('d')} – ${b.toFormat('d LLLL')}`
    : `${a.toFormat('d LLL')} – ${b.toFormat('d LLL')}`
}

// Intervallo di date di un evento multi-giorno con orari: "15 Sep – 17 Sep".
function intervalloDate(ev: Evento): string {
  const { primo, ultimo } = giorniEstremi(ev)
  const a = DateTime.fromISO(primo).setLocale(LOCALE)
  const b = DateTime.fromISO(ultimo).setLocale(LOCALE)
  return `${a.toFormat('d LLL')} – ${b.toFormat('d LLL')}`
}

function BottoneVideo({ url }: { url: string }) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-tenue premibile mb-2 h-[46px] w-full"
    >
      <IconaVideo size={18} />
      Join video call
    </a>
  )
}

// Riga di dettaglio con icona, usata nelle viste in sola lettura.
function Riga({ icona, children }: { icona: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-start gap-2.5 text-[14.5px]">
      <span className="mt-[2px] shrink-0" style={{ color: 'var(--testo-3)' }}>
        {icona}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

function Intestazione({
  origine,
  suffisso,
  titolo,
  onChiudi,
  etichetta,
  colore,
}: {
  origine: Origine
  suffisso: string
  titolo: string
  onChiudi: () => void
  // Un evento condiviso si presenta con la persona da cui arriva, non con la
  // categoria che gli ha dato lei: e' l'informazione che serve a chi guarda.
  etichetta?: string
  colore?: string
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
          <span
            className="inline-block h-[9px] w-[9px] rounded-full"
            style={{ background: colore ?? COLORI_ORIGINE[origine].punto }}
          />
          {etichetta ?? nomeOrigine(origine)} · {suffisso}
        </p>
        <button
          onClick={onChiudi}
          className="premibile -mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]"
          style={{ color: 'var(--testo-3)' }}
          aria-label="Close"
        >
          <IconaChiudi size={17} />
        </button>
      </div>
      <h2 className="mb-4 mt-1.5 text-[22px] font-bold">{titolo}</h2>
    </>
  )
}

function Richiesta({
  evento,
  fuso,
  onFatto,
  onChiudi,
}: {
  evento: Evento
  fuso: string
  onFatto: () => void
  onChiudi: () => void
}) {
  const orari = orarioEvento(evento, fuso)
  const opz = opzioneFuso(fuso)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function azione(fn: (id: string) => Promise<void>) {
    setInCorso(true)
    setErrore(null)
    try {
      await fn(evento.id)
      onFatto()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Error')
      setInCorso(false)
    }
  }

  return (
    <div>
      <Intestazione origine={evento.origine} suffisso="pending request" titolo={evento.titolo} onChiudi={onChiudi} />
      {evento.richiedente && (
        <Riga icona={<IconaLuogo size={17} />}>
          from <b>{evento.richiedente}</b>
        </Riga>
      )}
      <Riga icona={<IconaOrologio size={17} />}>
        <span className="tabular-nums">
          {opz.bandiera} {orari.principale.replace('–', ' – ')}
          {!asseUnico(fuso) && (
            <span style={{ color: 'var(--testo-2)' }}>
              {' '}
              · {opzioneFuso(fusoRif() ?? fuso).bandiera} {orari.riferimento.replace('–', ' – ')}
            </span>
          )}
        </span>
      </Riga>
      <div className="mt-4">{evento.link_video && <BottoneVideo url={evento.link_video} />}</div>
      {errore && (
        <p className="mb-3 text-[13px]" style={{ color: 'var(--errore)' }}>
          {errore}
        </p>
      )}
      <button
        onClick={() => azione(approvaRichiesta)}
        disabled={inCorso}
        className="btn-primario premibile h-[48px] w-full !text-[16px]"
      >
        Accept
      </button>
      <button
        onClick={() => azione(rifiutaRichiesta)}
        disabled={inCorso}
        className="premibile mt-2 h-[44px] w-full rounded-[14px] text-[14.5px] font-semibold transition-colors hover:bg-[var(--hover)]"
        style={{ color: 'var(--errore)' }}
      >
        Decline
      </button>
    </div>
  )
}

function ReadOnly({
  evento,
  fuso,
  onChiudi,
  onRitira,
}: {
  evento: Evento
  fuso: string
  onChiudi: () => void
  // C'è solo per una richiesta che ho mandato io e che nessuno ha ancora
  // approvato: finché è in attesa posso ritirarla.
  onRitira?: () => void
}) {
  const orari = orarioEvento(evento, fuso)
  const opz = opzioneFuso(fuso)
  const cond = evento.condiviso
  const suffisso = cond?.soloOccupato
    ? 'busy — details hidden'
    : evento.stato === 'in_attesa'
      ? 'waiting for approval'
      : 'read only'
  return (
    <div>
      <Intestazione
        origine={evento.origine}
        suffisso={suffisso}
        titolo={evento.titolo}
        onChiudi={onChiudi}
        etichetta={cond ? `${cond.nome}'s calendar` : undefined}
        colore={cond ? coloreEvento(evento).punto : undefined}
      />
      <Riga icona={evento.origine === 'viaggi' ? <IconaAereo size={17} /> : <IconaOrologio size={17} />}>
        {evento.tutto_il_giorno ? (
          giorniCoperti(evento)
        ) : (
          <span className="tabular-nums">
            {eMultiGiorno(evento) && (
              <span className="mr-1.5 font-semibold">{intervalloDate(evento)} ·</span>
            )}
            {opz.bandiera} {orari.principale.replace('–', ' – ')}
            {!asseUnico(fuso) && (
              <span style={{ color: 'var(--testo-2)' }}>
              {' '}
              · {opzioneFuso(fusoRif() ?? fuso).bandiera} {orari.riferimento.replace('–', ' – ')}
            </span>
            )}
          </span>
        )}
      </Riga>
      {evento.luogo && <Riga icona={<IconaLuogo size={17} />}>{evento.luogo}</Riga>}
      {evento.descrizione && (
        <p className="mb-2 whitespace-pre-wrap pl-[27px] text-[14px]" style={{ color: 'var(--testo-2)' }}>
          {evento.descrizione}
        </p>
      )}
      <div className="mt-4">{evento.link_video && <BottoneVideo url={evento.link_video} />}</div>
      {onRitira && (
        <button
          type="button"
          onClick={onRitira}
          className="btn-tenue premibile mt-2 h-[46px] w-full"
          style={{ color: 'var(--errore)' }}
        >
          Withdraw request
        </button>
      )}
    </div>
  )
}
