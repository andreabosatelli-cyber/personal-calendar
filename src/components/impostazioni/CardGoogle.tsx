import { useCallback, useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import {
  attivaGoogle,
  backfillGoogle,
  collegaGoogle,
  scollegaGoogle,
  sincronizzaGoogle,
  statoGoogle,
  type StatoGoogle,
} from '../../lib/google'
import { TestataCard } from '../pannello/parti'
import { IconaAggiorna, IconaSpunta, LogoGoogle } from '../../lib/icone'
import { LOCALE } from '../../lib/tempo'
import { useStato } from '../../lib/stato'

// "Google Calendar": il collegamento va in una direzione sola, e la card lo
// dice apertamente invece di lasciarlo capire — chi legge "sync" si aspetta
// che funzioni anche al contrario.

function quando(iso: string | null): string {
  if (!iso) return 'never'
  const d = DateTime.fromISO(iso).setLocale(LOCALE)
  const minuti = Math.abs(d.diffNow('minutes').minutes)
  if (minuti < 1) return 'just now'
  if (minuti < 60) return `${Math.round(minuti)} min ago`
  return d.toFormat('d LLL, HH:mm')
}

export function CardGoogle() {
  const { fuso } = useStato()
  const [stato, setStato] = useState<StatoGoogle | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  // Quanti eventi ha messo in coda il travaso iniziale: si dice una volta, al
  // ritorno dal consenso, e poi non serve piu'.
  const [travasati, setTravasati] = useState<number | null>(null)

  const guarda = useCallback(async () => {
    setStato(await statoGoogle())
  }, [])

  useEffect(() => {
    guarda()
  }, [guarda])

  // Si torna qui dall'OAuth con ?google=ok: e' il momento di mandare a Google
  // quello che c'e' gia'. Il parametro si toglie subito dall'indirizzo, cosi'
  // un refresh non rifa' il travaso.
  useEffect(() => {
    if (!new URLSearchParams(location.search).get('google')) return
    history.replaceState(null, '', location.pathname + location.hash)
    setInCorso(true)
    backfillGoogle()
      .then(async (n) => {
        setTravasati(n)
        await sincronizzaGoogle()
      })
      .catch((e) => setErrore(e instanceof Error ? e.message : 'Backfill failed'))
      .finally(async () => {
        setInCorso(false)
        await guarda()
      })
  }, [guarda])

  async function azione(fn: () => Promise<unknown>) {
    setErrore(null)
    setInCorso(true)
    try {
      await fn()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setInCorso(false)
      await guarda()
    }
  }

  const collegato = stato?.collegato === true

  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Google Calendar">
        {collegato && (
          <span
            className="flex items-center gap-1.5 text-[12.5px] font-semibold"
            style={{ color: stato?.abilitato ? 'var(--ok, var(--primario))' : 'var(--testo-3)' }}
          >
            {stato?.abilitato ? <IconaSpunta size={14} /> : null}
            {stato?.abilitato ? 'On' : 'Paused'}
          </span>
        )}
      </TestataCard>

      <div className="px-[18px] pt-1 pb-[18px]">
        {!collegato ? (
          <>
            <button
              onClick={() => azione(collegaGoogle)}
              disabled={inCorso}
              className="btn-tenue premibile h-[46px] w-full"
            >
              <LogoGoogle size={18} />
              {inCorso ? 'Opening Google…' : 'Connect Google Calendar'}
            </button>
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--testo-3)' }}>
              Everything on your calendar from today onwards gets written to Google — the events you create here and
              the ones imported from your feeds. They land in a calendar of their own called SmartCal, which you can
              switch on and off in Google like any other. It only goes one way: what you add in Google stays in
              Google.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--controllo)' }}
              >
                <LogoGoogle size={20} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[14.5px] font-semibold">
                  {stato?.calendario_nome ?? 'SmartCal calendar'}
                </span>
                <span className="block truncate text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                  Last sync: {quando(stato?.ultimo_sync ?? null)}
                  {stato && stato.in_coda > 0 ? ` · ${stato.in_coda} waiting` : ''}
                </span>
              </span>
            </div>

            {travasati !== null && (
              <p className="mt-3 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                {travasati === 0
                  ? 'Nothing upcoming to copy over — new events will show up in Google as you create them.'
                  : `${travasati} upcoming event${travasati === 1 ? '' : 's'} queued for Google.`}
              </p>
            )}

            {stato?.ultimo_errore && (
              <p className="mt-3 text-[12.5px]" style={{ color: 'var(--errore)' }}>
                {stato.ultimo_errore}
                {!stato.abilitato && ' — reconnect to start again.'}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => azione(sincronizzaGoogle)}
                disabled={inCorso}
                className="btn-tenue premibile h-[42px] flex-1"
              >
                <IconaAggiorna size={16} />
                Sync now
              </button>
              <button
                onClick={() => azione(() => attivaGoogle(!stato?.abilitato))}
                disabled={inCorso}
                className="btn-neutro premibile h-[42px] flex-1 text-[13.5px]"
              >
                {stato?.abilitato ? 'Pause' : 'Resume'}
              </button>
            </div>

            <button
              onClick={() => {
                if (!confirm('Disconnect Google Calendar? Events already copied stay in Google.')) return
                azione(scollegaGoogle)
              }}
              disabled={inCorso}
              className="premibile mt-2 h-[40px] w-full rounded-[14px] text-[13.5px] font-semibold transition-colors hover:bg-[var(--hover)]"
              style={{ color: 'var(--errore)' }}
            >
              Disconnect
            </button>

            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--testo-3)' }}>
              SmartCal can only touch the calendar it created itself — your main Google calendar is out of its reach
              by permission, not by good manners. Times are sent with their own timezone ({fuso}), so an event you
              wrote in Rome stays at the hour you wrote it. Reminders stay on SmartCal: Google is told not to add its
              own, or every event would ring twice.
            </p>
          </>
        )}

        {errore && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}
      </div>
    </section>
  )
}
