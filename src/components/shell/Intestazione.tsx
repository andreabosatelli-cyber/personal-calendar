import { useEffect, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { useStato } from '../../lib/stato'
import { FUSI, LOCALE, asseUnico, etichettaRif, fusoRif, opzioneFuso, siglaFuso } from '../../lib/tempo'
import {
  IconaCampana,
  IconaCerca,
  IconaChevron,
  IconaChiudi,
  IconaGlobo,
  IconaLuna,
  IconaPiu,
  IconaSole,
  IconaSpunta,
} from '../../lib/icone'
import { PannelloRichieste } from './PannelloRichieste'

interface Props {
  onApriMenu: () => void
  // Con la sidebar nascosta il pulsante che la richiama serve anche su desktop,
  // altrimenti non ci sarebbe modo di riaprirla.
  mostraMenu?: boolean
  onNuovoEvento: () => void
}

// Header minimale della reference: ricerca a sinistra, campanella e località
// con data/ora locale a destra. Spacing generoso, nessun elemento superfluo.
export function Intestazione({ onApriMenu, mostraMenu, onNuovoEvento }: Props) {
  const { fuso, cambiaFuso, ricerca, setRicerca, richieste, tema, toggleTema } = useStato()
  const [adesso, setAdesso] = useState(() => DateTime.now())
  const [notificheAperte, setNotificheAperte] = useState(false)
  const [luogoAperto, setLuogoAperto] = useState(false)
  // Su telefono la ricerca vive come icona e si apre a piena riga: un campo da
  // 82px mostrava solo la lente e non si poteva leggere quello che si scriveva.
  const [cercaAperta, setCercaAperta] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cercaAperta) inputRef.current?.focus()
  }, [cercaAperta])

  function chiudiCerca() {
    setRicerca('')
    setCercaAperta(false)
    inputRef.current?.blur()
  }

  useEffect(() => {
    const id = setInterval(() => setAdesso(DateTime.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // ⌘K / Ctrl-K porta il fuoco sulla ricerca; Esc la svuota.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCercaAperta(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setRicerca('')
        setCercaAperta(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setRicerca])

  // Con la ricerca aperta su telefono il resto dell'header si fa da parte: a
  // 390px non stanno insieme un campo leggibile e cinque controlli.
  const daParte = cercaAperta ? 'hidden lg:flex' : 'flex'

  const locale = adesso.setZone(fuso).setLocale(LOCALE)
  const opz = opzioneFuso(fuso)
  // L'orologio affiancato esiste solo se l'utente ha scelto un secondo fuso e
  // non ci si trova gia' dentro.
  const altrove = asseUnico(fuso) ? null : etichettaRif()
  const oraAltrove = altrove
    ? adesso.setZone(fusoRif()!).setLocale(LOCALE).toFormat('HH:mm')
    : ''

  return (
    <header className="flex h-[76px] shrink-0 items-center gap-2 px-4 lg:h-[92px] lg:gap-3 lg:px-[35px]">
      {/* Apertura sidebar su schermi stretti */}
      <button
        onClick={onApriMenu}
        className={`btn-neutro premibile h-11 w-11 shrink-0 ${daParte} ${mostraMenu ? '' : 'lg:hidden'}`}
        aria-label={mostraMenu ? 'Show sidebar' : 'Open menu'}
        title={mostraMenu ? 'Show sidebar' : undefined}
      >
        <span className="flex flex-col gap-[3.5px]">
          <span className="block h-[1.7px] w-[15px] rounded-full bg-current" />
          <span className="block h-[1.7px] w-[15px] rounded-full bg-current" />
          <span className="block h-[1.7px] w-[15px] rounded-full bg-current" />
        </span>
      </button>

      {/* Azione primaria su schermi stretti: senza, l'unico modo di creare un
          evento era aprire il drawer. Solo l'icona — l'etichetta non entra a
          390px — nella stessa posizione che "New event" occupa nella sidebar,
          cioe' subito dopo il marchio. */}
      <button
        onClick={onNuovoEvento}
        className={`btn-primario premibile h-11 w-11 shrink-0 lg:hidden ${daParte}`}
        aria-label="New event"
      >
        <IconaPiu size={20} />
      </button>

      {/* Con la sidebar chiusa l'azione primaria non avrebbe piu' casa: la
          ospita l'header anche da desktop, li' con l'etichetta per esteso. */}
      {mostraMenu && (
        <button
          onClick={onNuovoEvento}
          className="btn-primario premibile hidden h-11 shrink-0 px-4 text-[14px] lg:flex"
        >
          <IconaPiu size={18} />
          New event
        </button>
      )}

      {/* Ricerca: da desktop e un campo, qui sotto; su telefono e la lente
          che sta nel gruppo di icone a destra, insieme alle altre. */}
      <label
        className={`relative h-11 min-w-0 flex-1 items-center lg:flex lg:h-[46px] lg:max-w-[500px] lg:flex-none lg:basis-[500px] ${
          cercaAperta ? 'flex' : 'hidden'
        }`}
      >
        <span className="pointer-events-none absolute left-4" style={{ color: 'var(--testo-2)' }}>
          <IconaCerca size={18} />
        </span>
        <input
          ref={inputRef}
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Search events, people..."
          className="h-full w-full rounded-full pl-11 pr-11 text-[15px] outline-none transition-colors placeholder:text-[var(--testo-3)] focus:border-[var(--primario)]"
          style={{ background: 'var(--controllo)', border: '1.5px solid transparent', color: 'var(--testo)' }}
        />
        {(ricerca || cercaAperta) && (
          <button
            type="button"
            onClick={chiudiCerca}
            className={`premibile absolute right-1 flex h-10 w-10 items-center justify-center rounded-full ${
              ricerca ? '' : 'lg:hidden'
            }`}
            style={{ color: 'var(--testo-3)' }}
            aria-label={ricerca ? 'Clear search' : 'Close search'}
          >
            <IconaChiudi size={16} />
          </button>
        )}
      </label>

      <div className={`flex-1 ${cercaAperta ? 'hidden lg:block' : ''}`} />

      {/* Tema: la reference non ha un interruttore, ma da desktop serve a
          portata di mano. Su schermi stretti la larghezza va al "+", e la
          stessa scelta resta nel menu dell'account e in Settings. */}
      <button
        onClick={toggleTema}
        className="btn-neutro premibile hidden h-11 w-11 shrink-0 lg:flex"
        aria-label={tema === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={tema === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {tema === 'dark' ? <IconaSole size={20} /> : <IconaLuna size={20} />}
      </button>

      <button
        onClick={() => setCercaAperta(true)}
        className={`btn-neutro premibile h-11 w-11 shrink-0 lg:hidden ${cercaAperta ? '!hidden' : ''}`}
        aria-label="Search"
        aria-expanded={cercaAperta}
      >
        <IconaCerca size={20} />
      </button>

      {/* Notifiche */}
      <div className={`relative shrink-0 ${cercaAperta ? 'hidden lg:block' : ''}`}>
        <button
          onClick={() => setNotificheAperte((v) => !v)}
          className="btn-neutro premibile relative h-11 w-11"
          aria-label={`Notifications${richieste.length ? ` (${richieste.length})` : ''}`}
        >
          <IconaCampana size={21} />
          {richieste.length > 0 && (
            <span
              className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-medium"
              style={{ background: 'var(--notifica)', color: 'var(--su-notifica)', border: '2px solid var(--pagina)' }}
            >
              {richieste.length}
            </span>
          )}
        </button>
        {notificheAperte && <PannelloRichieste onChiudi={() => setNotificheAperte(false)} />}
      </div>


      {/* Località e ora locale */}
      <div className={`relative shrink-0 ${cercaAperta ? 'hidden lg:block' : ''}`}>
        <button
          onClick={() => setLuogoAperto((v) => !v)}
          className="premibile flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-[var(--hover)]"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--controllo)', color: 'var(--testo)' }}
          >
            <IconaGlobo size={20} />
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[14.5px] font-medium">
              {opz.etichetta} ({siglaFuso(fuso)})
            </span>
            <span className="block text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
              {locale.toFormat('ccc, d LLL HH:mm')}
            </span>
          </span>
          <IconaChevron size={17} verso={luogoAperto ? 'su' : 'giu'} className="shrink-0 text-[var(--testo-3)]" />
        </button>

        {luogoAperto && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLuogoAperto(false)} />
            <div
              className="anim-fade absolute right-0 top-[calc(100%+8px)] z-50 w-[268px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] p-1.5"
              style={{ background: 'var(--pagina)', boxShadow: 'var(--ombra-galleggia)' }}
            >
              <p className="px-3 pb-1 pt-1.5 text-[13px]" style={{ color: 'var(--testo-2)' }}>
                Where you are
              </p>
              {FUSI.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    cambiaFuso(f.id)
                    setLuogoAperto(false)
                  }}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 py-2 text-left transition-colors hover:bg-[var(--hover)]"
                  style={f.id === fuso ? { background: 'var(--card)' } : undefined}
                >
                  <span className="text-[15px]">{f.bandiera}</span>
                  <span className="flex-1 text-[14px] font-medium">{f.etichetta}</span>
                  {f.id === fuso ? (
                    <IconaSpunta size={15} className="text-[var(--testo)]" />
                  ) : (
                    <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                      {adesso.setZone(f.id).toFormat('HH:mm')}
                    </span>
                  )}
                </button>
              ))}
              <div className="my-1.5 h-px" style={{ background: 'var(--linea)' }} />
              <p className="px-2.5 pb-1.5 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                Right now in {altrove}: <span className="font-medium tabular-nums" style={{ color: 'var(--testo)' }}>{oraAltrove}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
