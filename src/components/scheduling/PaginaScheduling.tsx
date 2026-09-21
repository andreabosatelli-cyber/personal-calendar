import { useState } from 'react'
import { DateTime } from 'luxon'
import { useStato } from '../../lib/stato'
import { approvaRichiesta, linkCondivisione, rifiutaRichiesta } from '../../lib/condivisione'
import { LOCALE, asseUnico, etichettaRif, fusoRif, siglaFuso } from '../../lib/tempo'
import { IconaCampana, IconaCondividi, IconaSpunta, IconaVideo } from '../../lib/icone'
import { TestataCard } from '../pannello/parti'

// Scheduling — il lato "gli altri prenotano da me": un link pubblico che mostra
// solo gli orari occupati (mai i titoli) e le richieste da approvare.
export function PaginaScheduling() {
  const { token, richieste, caricaRichieste, fuso } = useStato()
  const [copiato, setCopiato] = useState(false)
  const link = token ? linkCondivisione(token) : null

  async function copia() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 1800)
    } catch {
      setCopiato(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-[22px] pt-[5px] scroll-fine lg:pl-5 lg:pr-4">
      <div className="flex flex-col gap-[21px] xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="card overflow-hidden">
            <TestataCard titolo="Your booking link" />
            <div className="px-[18px] pt-1 pb-[18px]">
              {link ? (
                <>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="campo min-w-0 flex-1 text-[13.5px]"
                      aria-label="Public booking link"
                    />
                    <div className="flex shrink-0 gap-2.5">
                      <button onClick={copia} className="btn-primario premibile h-[42px] flex-1 px-4 sm:flex-none">
                        {copiato ? <IconaSpunta size={17} /> : <IconaCondividi size={17} />}
                        {copiato ? 'Copied' : 'Copy link'}
                      </button>
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-neutro premibile flex h-[42px] flex-1 items-center justify-center px-4 sm:flex-none"
                      >
                        Preview
                      </a>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--testo-2)' }}>
                    Anyone with this link sees only <strong style={{ color: 'var(--testo)' }}>busy blocks</strong> — no
                    titles, no places, no guests — and can ask for a slot. Nothing lands on the calendar until you
                    accept it.
                  </p>
                </>
              ) : (
                <p className="text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
                  No sharing link yet. It lives in <code>preferenze.token_condivisione</code>: run the
                  <code> 0006_condivisione.sql</code> migration and reload.
                </p>
              )}
            </div>
          </section>

          <section className="card overflow-hidden">
            <TestataCard titolo="How a booking works" />
            <div className="flex flex-col gap-3.5 px-[18px] pt-2 pb-[18px]">
              {[
                'They open the link and see your week as free / busy only.',
                'They pick a slot in their own timezone — the page shows it twice, their time and yours.',
                'The request arrives in the bell up here, and in the Requests list.',
                'You accept: it becomes a normal event. You decline: it disappears.',
              ].map((t, i) => (
                <p key={t} className="flex items-start gap-3 text-[13.5px]">
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: 'var(--tenue)', color: 'var(--primario)' }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: 'var(--testo-2)' }}>{t}</span>
                </p>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[420px]">
          <section className="card overflow-hidden">
            <TestataCard titolo="Requests">
              {richieste.length > 0 && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                  style={{ background: 'var(--tenue)', color: 'var(--primario)' }}
                >
                  {richieste.length}
                </span>
              )}
            </TestataCard>
            {richieste.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-[18px] py-9 text-center">
                <span style={{ color: 'var(--testo-3)' }}>
                  <IconaCampana size={26} />
                </span>
                <p className="text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
                  No pending requests.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-[18px] pt-1 pb-[18px]">
                {richieste.map((r) => (
                  <Richiesta
                    key={r.id}
                    id={r.id}
                    titolo={r.titolo}
                    richiedente={r.richiedente}
                    inizio={r.inizio_utc}
                    fine={r.fine_utc}
                    link={r.link_video}
                    fuso={fuso}
                    onDeciso={caricaRichieste}
                  />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Richiesta({
  id,
  titolo,
  richiedente,
  inizio,
  fine,
  link,
  fuso,
  onDeciso,
}: {
  id: string
  titolo: string
  richiedente: string | null
  inizio: string
  fine: string
  link: string | null
  fuso: string
  onDeciso: () => Promise<void>
}) {
  const [inCorso, setInCorso] = useState(false)
  const i = DateTime.fromISO(inizio, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE)
  const f = DateTime.fromISO(fine, { zone: 'utc' }).setZone(fuso)
  const rif = DateTime.fromISO(inizio, { zone: 'utc' }).setZone(fusoRif() ?? '')
  const rifFine = DateTime.fromISO(fine, { zone: 'utc' }).setZone(fusoRif() ?? '')

  async function decidi(ok: boolean) {
    setInCorso(true)
    if (ok) await approvaRichiesta(id)
    else await rifiutaRichiesta(id)
    await onDeciso()
    setInCorso(false)
  }

  return (
    <article className="rounded-[14px] p-3" style={{ background: 'var(--controllo)' }}>
      <p className="truncate text-[14.5px] font-semibold leading-tight">{titolo}</p>
      {richiedente && (
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
          {richiedente}
        </p>
      )}
      <p className="mt-2 text-[13px] font-medium tabular-nums">
        {i.toFormat('ccc d LLL')} · {i.toFormat('HH:mm')}–{f.toFormat('HH:mm')}{' '}
        <span style={{ color: 'var(--testo-3)' }}>{siglaFuso(fuso)}</span>
      </p>
      {!asseUnico(fuso) && (
        <p className="mt-[2px] text-[12px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
          {rif.toFormat('HH:mm')}–{rifFine.toFormat('HH:mm')} in {etichettaRif()}
        </p>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-2 text-[12.5px] font-medium"
          style={{ color: 'var(--primario)' }}
        >
          <IconaVideo size={15} />
          <span className="truncate">{link.replace(/^https?:\/\//, '')}</span>
        </a>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decidi(true)}
          disabled={inCorso}
          className="btn-primario premibile h-9 flex-1 text-[13.5px] disabled:opacity-60"
          style={{ boxShadow: 'none' }}
        >
          Accept
        </button>
        <button
          onClick={() => decidi(false)}
          disabled={inCorso}
          className="btn-neutro premibile h-9 flex-1 text-[13.5px] disabled:opacity-60"
          style={{ color: 'var(--errore)' }}
        >
          Decline
        </button>
      </div>
    </article>
  )
}
