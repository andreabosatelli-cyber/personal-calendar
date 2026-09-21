import { useState } from 'react'
import { DateTime } from 'luxon'
import { useStato, ORIGINI } from '../../lib/stato'
import { supabase } from '../../lib/supabase'
import { svuotaCache } from '../../lib/cacheEventi'
import { linkCondivisione } from '../../lib/condivisione'
import { CardCondivisioni } from './CardCondivisioni'
import { CardGoogle } from './CardGoogle'
import { CardPromemoria } from './CardPromemoria'
import { SelettoreFuso } from '../SelettoreFuso'
import {
  COLORI_ORIGINE,
  LOCALE,
  asseUnico,
  etichettaRif,
  etichettaUtc,
  fusoRif,
  nomeDiFabbrica,
  nomeOrigine,
  opzioneFuso,
  siglaFuso,
  ufficioFine,
  ufficioInizio,
} from '../../lib/tempo'
import type { Origine } from '../../lib/types'
import {
  IconaAggiorna,
  IconaCondividi,
  IconaEsci,
  IconaLuna,
  IconaSole,
  IconaSpunta,
} from '../../lib/icone'
import { TestataCard } from '../pannello/parti'

// Da dove arriva ogni calendario e se si può scrivere: è la distinzione che il
// prodotto deve rendere ovvia, quindi qui è scritta a parole. Vale per gli
// account con un feed collegato; per tutti gli altri ogni categoria si riempie
// a mano, ed è quello che dice la card.
const SORGENTE_FEED: Record<Origine, { da: string; scrivibile: boolean }> = {
  lavoro: { da: 'Outlook ICS feed, synced by the server', scrivibile: false },
  universita: { da: 'Imported from the university spreadsheet', scrivibile: false },
  personale: { da: 'Created here, by you', scrivibile: true },
  viaggi: { da: 'Created here, by you', scrivibile: true },
}

export function PaginaImpostazioni() {
  const {
    pref,
    aggiornaPref,
    fuso,
    cambiaFuso,
    tema,
    toggleTema,
    sincronizza,
    inSync,
    ultimoSync,
    token,
    email,
    nome,
    iniziali,
  } = useStato()
  const [copiato, setCopiato] = useState(false)
  const adesso = DateTime.now()
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
          {/* Località: cambia l'asse principale di tutta l'app */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Where you are">
              <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                {siglaFuso(fuso)} · {etichettaUtc(fuso)}
              </span>
            </TestataCard>
            <p className="px-[18px] pb-1 text-[13px]" style={{ color: 'var(--testo-2)' }}>
              This is the clock the calendar is drawn on. Change it when you travel.
            </p>
            <SelettoreFuso valore={fuso} onCambia={cambiaFuso} />
            {!asseUnico(fuso) && (
              <p className="px-[18px] pb-4 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-3)' }}>
                Right now in {etichettaRif()}:{' '}
                {adesso.setZone(fusoRif()!).setLocale(LOCALE).toFormat('ccc d LLL, HH:mm')}
              </p>
            )}
          </section>

          {/* Secondo fuso: è il tratto distintivo dell'app, ma non tutti ne
              hanno bisogno, quindi si sceglie (o si toglie) da qui. */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Second timezone">
              {pref.fuso_riferimento && (
                <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                  {siglaFuso(pref.fuso_riferimento)} · {etichettaUtc(pref.fuso_riferimento)}
                </span>
              )}
            </TestataCard>
            <p className="px-[18px] pb-1 text-[13px]" style={{ color: 'var(--testo-2)' }}>
              Kept next to your own hours, everywhere in the app. Leave it off for a single-clock calendar.
            </p>
            <SelettoreFuso
              valore={pref.fuso_riferimento}
              onCambia={(id) => aggiornaPref({ fuso_riferimento: id, etichetta_riferimento: opzioneFuso(id).etichetta })}
              vuoto={{
                etichetta: 'No second timezone',
                sotto: 'One clock only',
                onScegli: () => aggiornaPref({ fuso_riferimento: null, etichetta_riferimento: null }),
              }}
              massimo={6}
            />
            <div className="px-[18px] pb-[18px]">
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                Office hours
              </p>
              <p className="mb-2 mt-0.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                {pref.fuso_riferimento
                  ? `Shaded on your day, projected from ${etichettaRif()}.`
                  : 'Shaded on your day as a background band.'}
              </p>
              <div className="flex items-center gap-2">
                <SelettoreOre
                  valore={ufficioInizio()}
                  max={ufficioFine() - 1}
                  onCambia={(h) => aggiornaPref({ ufficio_inizio: h })}
                />
                <span className="text-[13px]" style={{ color: 'var(--testo-3)' }}>
                  to
                </span>
                <SelettoreOre
                  valore={ufficioFine()}
                  min={ufficioInizio() + 1}
                  max={24}
                  onCambia={(h) => aggiornaPref({ ufficio_fine: h })}
                />
              </div>
            </div>
          </section>

          {/* Calendari collegati */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Calendars">
              {pref.sync_abilitato && (
                <button
                  onClick={sincronizza}
                  disabled={inSync}
                  className="btn-neutro premibile flex h-[32px] shrink-0 items-center gap-1.5 px-2.5 text-[12.5px] disabled:opacity-60"
                >
                  <IconaAggiorna size={15} className={inSync ? 'anim-pulsa' : undefined} />
                  {inSync ? 'Syncing…' : 'Sync now'}
                </button>
              )}
            </TestataCard>
            <p className="px-[18px] pb-1 text-[13px]" style={{ color: 'var(--testo-2)' }}>
              Four calendars, and they are yours to name: Work and Study, or Gym and Side project.
            </p>
            <div className="flex flex-col px-[18px] pt-1 pb-[18px]">
              {ORIGINI.map((o) => (
                <RigaCategoria
                  key={o}
                  origine={o}
                  nome={nomeOrigine(o)}
                  sotto={pref.sync_abilitato ? SORGENTE_FEED[o].da : 'Created here, by you'}
                  bloccata={pref.sync_abilitato && !SORGENTE_FEED[o].scrivibile}
                  onRinomina={(nuovo) =>
                    aggiornaPref({ nomi_categorie: { ...pref.nomi_categorie, [o]: nuovo || undefined } })
                  }
                />
              ))}
              <p className="pt-3 text-[12.5px]" style={{ color: 'var(--testo-3)' }}>
                {!pref.sync_abilitato
                  ? 'No external feed is connected to this account: every event is one you create here.'
                  : ultimoSync?.errore
                    ? 'Last sync failed — the feed did not answer.'
                    : ultimoSync?.quando
                      ? `Last synced ${DateTime.fromISO(ultimoSync.quando, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE).toFormat('d LLL, HH:mm')}${ultimoSync.conteggio ? ` · ${ultimoSync.conteggio} events` : ''}`
                      : 'Never synced on this device.'}
              </p>
            </div>
          </section>

          {/* Specchio su Google Calendar */}
          <CardGoogle />
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[420px]">
          {/* Aspetto */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Appearance" />
            <div className="px-[18px] pt-1 pb-[18px]">
              <div className="seg w-full">
                <button
                  onClick={() => tema === 'dark' && toggleTema()}
                  className={`seg-item premibile flex flex-1 items-center justify-center gap-2 ${tema === 'light' ? 'attivo' : ''}`}
                >
                  <IconaSole size={16} />
                  Light
                </button>
                <button
                  onClick={() => tema === 'light' && toggleTema()}
                  className={`seg-item premibile flex flex-1 items-center justify-center gap-2 ${tema === 'dark' ? 'attivo' : ''}`}
                >
                  <IconaLuna size={16} />
                  Dark
                </button>
              </div>
              <p className="mt-3 text-[12.5px]" style={{ color: 'var(--testo-3)' }}>
                Light is the default and does not follow the system.
              </p>
            </div>
          </section>

          {/* Condivisione */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Sharing & privacy" />
            <div className="px-[18px] pt-1 pb-[18px]">
              {link ? (
                <>
                  <p className="mb-2.5 truncate text-[13px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                    {link}
                  </p>
                  <button onClick={copia} className="btn-tenue premibile h-[42px] w-full">
                    {copiato ? <IconaSpunta size={17} /> : <IconaCondividi size={17} />}
                    {copiato ? 'Copied' : 'Copy booking link'}
                  </button>
                </>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--testo-2)' }}>
                  Sharing is not set up yet.
                </p>
              )}
              <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--testo-3)' }}>
                Visitors see busy blocks only — never titles, places or guests. Requests wait for your approval before
                they touch the calendar.
              </p>
            </div>
          </section>

          {/* Promemoria push */}
          <CardPromemoria />

          {/* Calendari condivisi con persone precise */}
          <CardCondivisioni />

          {/* Account */}
          <section className="card overflow-hidden">
            <TestataCard titolo="Account" />
            <div className="px-[18px] pt-1 pb-[18px]">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                  style={{ background: '#ddcafe', color: '#5a1dfa' }}
                >
                  {iniziali}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14.5px] font-semibold">{nome}</span>
                  <span className="block truncate text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                    {email || 'Signed in'}
                  </span>
                </span>
              </div>
              <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                Display name
              </label>
              <input
                defaultValue={pref.nome_visualizzato ?? ''}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v !== (pref.nome_visualizzato ?? '')) aggiornaPref({ nome_visualizzato: v || null })
                }}
                maxLength={60}
                placeholder={nome}
                className="campo"
              />
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                What people see on your booking link.
              </p>
              <button
                onClick={() => {
                  svuotaCache()
                  supabase.auth.signOut()
                }}
                className="btn-neutro premibile mt-3.5 h-[42px] w-full gap-2"
                style={{ color: 'var(--errore)' }}
              >
                <IconaEsci size={17} />
                Sign out
              </button>
              <p className="mt-3 text-[12.5px]" style={{ color: 'var(--testo-3)' }}>
                Location, view and theme are remembered on this device; the location is also saved to your profile as{' '}
                {opzioneFuso(fuso).etichetta}.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

// Un'ora tonda, per gli estremi dell'orario d'ufficio.
function SelettoreOre({
  valore,
  onCambia,
  min = 0,
  max = 23,
}: {
  valore: number
  onCambia: (h: number) => void
  min?: number
  max?: number
}) {
  const ore: number[] = []
  for (let h = min; h <= max; h++) ore.push(h)
  return (
    <select
      value={valore}
      onChange={(e) => onCambia(Number(e.target.value))}
      className="campo h-[38px] w-[92px] tabular-nums"
    >
      {ore.map((h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  )
}

// Riga di una categoria: il nome si modifica sul posto. Il colore e il ruolo
// (quale alimenta Trips) restano quelli: qui si cambia solo come si chiama.
function RigaCategoria({
  origine,
  nome,
  sotto,
  bloccata,
  onRinomina,
}: {
  origine: Origine
  nome: string
  sotto: string
  bloccata: boolean
  onRinomina: (nuovo: string) => void
}) {
  const [modifica, setModifica] = useState(false)
  return (
    <div className="flex items-center gap-3 py-[9px]" style={{ borderTop: '1px solid var(--linea)' }}>
      <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: COLORI_ORIGINE[origine].punto }} />
      <span className="min-w-0 flex-1">
        {modifica ? (
          <input
            autoFocus
            defaultValue={nome}
            maxLength={24}
            placeholder={nomeDiFabbrica(origine)}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v !== nome) onRinomina(v)
              setModifica(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setModifica(false)
            }}
            className="campo h-[34px] !text-[13.5px]"
          />
        ) : (
          <>
            <span className="block truncate text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
              {nome}
            </span>
            <span className="mt-[2px] block truncate text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
              {sotto}
            </span>
          </>
        )}
      </span>
      {!modifica && (
        <>
          {bloccata && (
            <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
              Read-only
            </span>
          )}
          <button
            onClick={() => setModifica(true)}
            className="shrink-0 text-[12.5px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--primario)' }}
          >
            Rename
          </button>
        </>
      )}
    </div>
  )
}
