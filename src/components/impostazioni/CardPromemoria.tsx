import { useEffect, useState } from 'react'
import { useStato } from '../../lib/stato'
import {
  ANTICIPI,
  attivaPush,
  diagnosi,
  disattivaPush,
  installataSuHome,
  nomeAnticipo,
  permessoNotifiche,
  pushSupportato,
  statoIscrizione,
  suIOS,
  type Diagnosi,
  type StatoIscrizione,
} from '../../lib/push'
import { TestataCard } from '../pannello/parti'
import { IconaCampana, IconaSpunta } from '../../lib/icone'

// "Reminders": due cose distinte, e vale la pena tenerle separate a schermo.
//  - QUANTO anticipo: sta nel profilo, vale ovunque tu apra l'app;
//  - SE questo dispositivo riceve le notifiche: sta nel browser, e va detto
//    di si' una volta per telefono e una per computer.
export function CardPromemoria() {
  const { pref, aggiornaPref, utenteId } = useStato()
  const [stato, setStato] = useState<StatoIscrizione | null>(null) // null = sto ancora guardando
  const [diag, setDiag] = useState<Diagnosi | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const attivo = stato === 'attiva'

  const supportato = pushSupportato()
  const iosDaInstallare = suIOS() && !installataSuHome()
  const permesso = permessoNotifiche()

  async function guarda() {
    setStato(await statoIscrizione().catch(() => 'assente' as StatoIscrizione))
    setDiag(await diagnosi().catch(() => null))
  }

  useEffect(() => {
    guarda()
  }, [])

  async function accendi() {
    setErrore(null)
    setInCorso(true)
    const esito = await attivaPush(utenteId)
    setInCorso(false)
    await guarda()
    if (!esito.ok) {
      setErrore(esito.motivo ?? 'Could not turn on notifications.')
      return
    }
    // Accendere le notifiche senza scegliere un anticipo non avviserebbe di
    // nulla: se non c'e', si parte da dieci minuti.
    if (pref.promemoria_minuti === null) await aggiornaPref({ promemoria_minuti: 10 })
  }

  async function spegni() {
    setInCorso(true)
    await disattivaPush()
    setInCorso(false)
    await guarda()
  }

  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Reminders" />
      <div className="px-[18px] pb-[18px] pt-1">
        {/* Anticipo */}
        <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
          Notify me
        </p>
        <div className="seg">
          <button
            onClick={() => aggiornaPref({ promemoria_minuti: null })}
            className={`seg-item premibile flex-1 !px-2 ${pref.promemoria_minuti === null ? 'attivo' : ''}`}
          >
            Off
          </button>
          {ANTICIPI.map((m) => (
            <button
              key={m}
              onClick={() => aggiornaPref({ promemoria_minuti: m })}
              className={`seg-item premibile flex-1 !px-2 ${pref.promemoria_minuti === m ? 'attivo' : ''}`}
            >
              {m < 60 ? m : '1h'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--testo-3)' }}>
          {pref.promemoria_minuti === null
            ? 'No reminders are sent.'
            : `${nomeAnticipo(pref.promemoria_minuti)} — all-day events are not announced.`}
        </p>

        {/* Questo dispositivo */}
        <div className="mt-4 h-px" style={{ background: 'var(--linea)' }} />
        <p className="mb-1.5 mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
          This device
        </p>

        {!supportato ? (
          <p className="text-[13px]" style={{ color: 'var(--testo-2)' }}>
            This browser cannot receive notifications.
          </p>
        ) : iosDaInstallare ? (
          // Su iPhone il permesso non si puo' nemmeno chiedere da Safari: dirlo
          // prima evita di far concludere che l'app e' rotta.
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--testo-2)' }}>
            On iPhone and iPad, notifications only work once SmartCal is on the Home Screen. Tap Share → Add to Home
            Screen, open it from there, then come back here.
          </p>
        ) : (
          <>
            {/* Il browser ha la sottoscrizione ma il server no: la push
                partirebbe da un server che non sa che questo telefono esiste.
                Va detto, perche' da fuori sembra tutto a posto. */}
            {stato === 'solo-browser' && (
              <p className="mb-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--cat-viaggi-fg)' }}>
                This device is registered in the browser but never reached the server, so nothing would be sent. Press
                below to repair it.
              </p>
            )}
            <button
              onClick={attivo ? spegni : accendi}
              disabled={inCorso || stato === null}
              className={`${attivo ? 'btn-neutro' : 'btn-tenue'} premibile h-[46px] w-full disabled:opacity-60`}
            >
              {attivo ? <IconaSpunta size={17} /> : <IconaCampana size={17} />}
              {inCorso
                ? 'One moment…'
                : stato === null
                  ? 'Checking…'
                  : attivo
                    ? 'Notifications on — turn off'
                    : stato === 'solo-browser'
                      ? 'Repair notifications on this device'
                      : 'Turn on notifications here'}
            </button>
            {permesso === 'denied' && !attivo && (
              <p className="mt-2 text-[12.5px]" style={{ color: 'var(--testo-3)' }}>
                Notifications are blocked for this site in your browser settings; the button cannot ask again until you
                allow them there.
              </p>
            )}
          </>
        )}

        {errore && (
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}

        {/* Quando non e' attivo, dire DOVE si ferma invece di lasciare
            indovinare: sono quattro fatti, stanno in una riga. */}
        {diag && !attivo && (
          <p className="mt-2.5 text-[11.5px] leading-relaxed tabular-nums" style={{ color: 'var(--testo-3)' }}>
            Permission: {diag.permesso ?? 'n/a'} · Service worker: {diag.serviceWorker} · Subscribed:{' '}
            {diag.iscritto ? 'yes' : 'no'}
            {diag.ios && ` · Home Screen: ${diag.installata ? 'yes' : 'no'}`}
          </p>
        )}

        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--testo-3)' }}>
          Each device is switched on separately — your phone and your laptop are two answers to the same question.
          Reminders arrive with the app closed, within about a minute of the chosen time.
        </p>
      </div>
    </section>
  )
}
