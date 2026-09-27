import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { svuotaCache } from '../../lib/cacheEventi'
import { ORIGINI, useStato } from '../../lib/stato'
import { COLORI_CONDIVISI, COLORI_ORIGINE, LOCALE, nomeOrigine, opzioneFuso, siglaFuso } from '../../lib/tempo'
import { NOME_PERMESSO } from '../../lib/condivisi'
import { DateTime } from 'luxon'
import type { Origine } from '../../lib/types'
import type { Sezione } from '../../lib/rotte'
import { Marchio } from '../Marchio'
import { SEZIONI } from '../../lib/rotte'
import {
  IconaAggiorna,
  IconaChevron,
  IconaChiudi,
  IconaEsci,
  IconaImpostazioni,
  IconaLuna,
  IconaPiu,
  IconaSole,
  IconaSpunta,
  LogoGoogle,
  LogoOutlook,
} from '../../lib/icone'

// Da quale servizio arriva ciascun calendario: nella reference ogni riga di
// "My calendars" ha la pastiglia del provider accanto al nome.
const PROVIDER: Record<Origine, 'outlook' | 'google' | null> = {
  lavoro: 'outlook',
  universita: 'outlook',
  personale: 'google',
  viaggi: null,
}

interface Props {
  sezione: Sezione
  vai: (s: Sezione) => void
  onNuovoEvento: () => void
  onChiudi?: () => void // drawer su schermi stretti
  onNascondi?: () => void // collasso su desktop
}

export function BarraLaterale({ sezione, vai, onNuovoEvento, onChiudi, onNascondi }: Props) {
  const {
    pref,
    fuso,
    calendari,
    toggleCalendario,
    condivisi,
    condivisiAttivi,
    toggleCondiviso,
    tema,
    toggleTema,
    nome,
    iniziali,
    sincronizza,
    inSync,
    ultimoSync,
  } = useStato()
  const [menuAperto, setMenuAperto] = useState(false)
  const opz = opzioneFuso(fuso)

  function naviga(s: Sezione) {
    vai(s)
    onChiudi?.()
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-fine" style={{ background: 'var(--sidebar)' }}>
      {/* Marchio */}
      <div className="flex shrink-0 items-center gap-3 px-[24px] pt-[22px] lg:pt-[34px]">
        <Marchio />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-[24px] font-medium leading-[1.15] tracking-[-0.03em]" style={{ color: 'var(--testo)' }}>
            SmartCal
          </h1>
          <p className="mt-[3px] text-[12.5px] leading-none" style={{ color: 'var(--testo-2)' }}>
            Your time, unified.
          </p>
        </div>
        {(onNascondi || onChiudi) && (
          <button
            onClick={() => (onNascondi ?? onChiudi)!()}
            className="btn-neutro premibile h-11 w-11 shrink-0"
            aria-label={onNascondi ? 'Hide sidebar' : 'Close menu'}
            title={onNascondi ? 'Hide sidebar' : undefined}
          >
            {onNascondi ? <IconaChevron size={17} verso="sx" /> : <IconaChiudi size={16} />}
          </button>
        )}
      </div>

      {/* Azione primaria */}
      <div className="shrink-0 px-[25px] pt-[24px] lg:pt-[39px]">
        <button onClick={onNuovoEvento} className="btn-primario premibile h-[50px] w-full">
          <IconaPiu size={19} />
          New event
        </button>
      </div>

      {/* Navigazione */}
      <nav className="flex shrink-0 flex-col gap-[5px] px-[18px] pt-[20px] lg:pt-[26px]">
        {SEZIONI.map(({ id, etichetta, Icona }) => (
          <button
            key={id}
            onClick={() => naviga(id)}
            className={`nav-voce premibile ${sezione === id ? 'attiva' : ''}`}
            aria-current={sezione === id ? 'page' : undefined}
          >
            <Icona size={20} />
            {etichetta}
          </button>
        ))}
      </nav>

      <div className="mb-[20px] mt-[22px] h-px shrink-0 lg:mb-[26px] lg:mt-[32px]" />

      {/* Calendari collegati */}
      <div className="shrink-0 px-[18px]">
        <p className="etichetta-sezione mb-2 pl-1">My calendars</p>
        {/* Righe alte 48px: sotto i 44 il dito manca la riga e spegne il
            calendario sbagliato. */}
        <div className="flex flex-col gap-0.5">
          {ORIGINI.map((o) => {
            const on = calendari.includes(o)
            const c = COLORI_ORIGINE[o]
            // Le pastiglie del provider hanno senso solo se un feed c'e'
            // davvero: senza sync, il calendario e' roba scritta a mano.
            const provider = pref.sync_abilitato ? PROVIDER[o] : null
            return (
              <button
                key={o}
                onClick={() => toggleCalendario(o)}
                className="premibile flex min-h-[48px] items-center gap-3 rounded-full px-2 text-left transition-colors hover:bg-[var(--hover)]"
                aria-pressed={on}
              >
                <span
                  className={`spunta ${on ? 'on' : ''}`}
                  style={on ? { background: c.punto } : undefined}
                >
                  {on && <IconaSpunta size={13} />}
                </span>
                <span
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--card)' }}
                >
                  {provider === 'outlook' ? (
                    <LogoOutlook size={16} />
                  ) : provider === 'google' ? (
                    <LogoGoogle size={15} />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.punto }} />
                  )}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[14.5px] font-medium"
                  style={{ color: on ? 'var(--testo)' : 'var(--testo-3)' }}
                >
                  {nomeOrigine(o)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Calendari che altri hanno condiviso con me. Il gruppo esiste solo se
          c'è qualcosa dentro: a chi non ha condivisioni non serve sapere che
          la funzione esiste finché non la usa qualcuno. */}
      {condivisi.length > 0 && (
        <div className="mt-[22px] shrink-0 px-[18px]">
          <p className="etichetta-sezione mb-2 pl-1">Shared with me</p>
          <div className="flex flex-col gap-0.5">
            {condivisi.map((c, i) => {
              const on = condivisiAttivi.includes(c.proprietario_id)
              const col = COLORI_CONDIVISI[i % COLORI_CONDIVISI.length]
              const sigla =
                c.nome
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase() || '?'
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCondiviso(c.proprietario_id)}
                  className="premibile flex min-h-[48px] items-center gap-3 rounded-full px-2 text-left transition-colors hover:bg-[var(--hover)]"
                  aria-pressed={on}
                  title={`${c.email} — ${NOME_PERMESSO[c.permesso]}`}
                >
                  <span className={`spunta ${on ? 'on' : ''}`} style={on ? { background: col.punto } : undefined}>
                    {on && <IconaSpunta size={13} />}
                  </span>
                  <span
                    className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                    style={{ background: col.sfondo, color: col.testo }}
                  >
                    {sigla}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span
                      className="block truncate text-[14.5px] font-medium"
                      style={{ color: on ? 'var(--testo)' : 'var(--testo-3)' }}
                    >
                      {c.nome}
                    </span>
                    <span className="block truncate text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
                      {NOME_PERMESSO[c.permesso]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Account + località */}
      <div className="mt-auto shrink-0 px-[18px] pb-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
        <div className="relative">
          <button
            onClick={() => setMenuAperto((v) => !v)}
            className="premibile flex min-h-[52px] w-full items-center gap-3 rounded-full px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
          >
            <span
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-medium"
              style={{ background: 'var(--avatar-bg)', color: 'var(--avatar-fg)' }}
            >
              {iniziali}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14px] font-medium">{nome}</span>
              <span className="block truncate text-[12px]" style={{ color: 'var(--testo-2)' }}>
                {opz.etichetta} ({siglaFuso(fuso)})
              </span>
            </span>
            <IconaChevron size={17} verso={menuAperto ? 'su' : 'giu'} className="shrink-0 text-[var(--testo-3)]" />
          </button>

          {menuAperto && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuAperto(false)} />
              <div
                className="anim-fade absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 overflow-hidden rounded-[20px] p-1.5"
                style={{ background: 'var(--pagina)', boxShadow: 'var(--ombra-galleggia)' }}
              >
                {/* Niente feed collegato, niente da sincronizzare: il
                    pulsante chiamerebbe una funzione che non fa nulla. */}
                {pref.sync_abilitato && (
                  <>
                    <button
                      onClick={sincronizza}
                      disabled={inSync}
                      className="flex w-full items-center gap-2.5 rounded-full px-3 min-h-[44px] text-left text-[14px] font-medium transition-colors hover:bg-[var(--hover)] disabled:opacity-60"
                    >
                      <IconaAggiorna size={17} className={inSync ? 'anim-pulsa' : undefined} />
                      <span className="flex-1">{inSync ? 'Syncing…' : 'Sync calendars'}</span>
                    </button>
                    <p className="px-2.5 pb-1.5 text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
                      {ultimoSync?.errore
                        ? 'Last sync failed'
                        : ultimoSync?.quando
                          ? `Synced ${DateTime.fromISO(ultimoSync.quando, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE).toFormat('d LLL, HH:mm')}`
                          : 'Never synced'}
                    </p>
                  </>
                )}
                <button
                  onClick={toggleTema}
                  className="flex w-full items-center gap-2.5 rounded-full px-3 min-h-[44px] text-left text-[14px] font-medium transition-colors hover:bg-[var(--hover)]"
                >
                  {tema === 'dark' ? <IconaSole size={17} /> : <IconaLuna size={17} />}
                  {tema === 'dark' ? 'Light theme' : 'Dark theme'}
                </button>
                <button
                  onClick={() => {
                    svuotaCache()
                    supabase.auth.signOut()
                  }}
                  className="flex w-full items-center gap-2.5 rounded-full px-3 min-h-[44px] text-left text-[14px] font-medium transition-colors hover:bg-[var(--hover)]"
                >
                  <IconaEsci size={17} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => naviga('settings')}
          className={`nav-voce premibile mt-0.5 ${sezione === 'settings' ? 'attiva' : ''}`}
        >
          <IconaImpostazioni size={20} />
          Settings
        </button>
      </div>
    </div>
  )
}
