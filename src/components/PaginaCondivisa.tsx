import { useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import type { Evento } from '../lib/types'
import { GrigliaSettimana } from './GrigliaSettimana'
import { type Vista, giorniVista, spostaVista, titoloVista } from '../lib/settimana'
import { PASSO_MINUTI, eventoNelGiorno, offsetBreve, oggiISO } from '../lib/tempo'
import {
  impegniCondivisi,
  inviaRichiesta,
  profiloCondiviso,
  type BloccoOccupato,
  type ProfiloCondiviso,
} from '../lib/condivisione'
import { IconaChevron, IconaPiu } from '../lib/icone'

// Fuso rilevato dal browser del visitatore.
function fusoVisitatore(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Pagina pubblica: l'unica schermata che vede chi non ha un account.
// Mostra SOLO blocchi occupati (mai titoli, luoghi o invitati) e ogni orario e'
// leggibile due volte — nel fuso del visitatore e in quello del proprietario.
// Chi sia il proprietario lo dice il token (condiviso_profilo): prima nome e
// fuso erano scritti qui, da quando il calendario era di una persona sola.
// Lingua e design sono quelli del resto dell'app: e' la stessa applicazione.
export function PaginaCondivisa({ token }: { token: string }) {
  const tzLocale = useMemo(fusoVisitatore, [])
  const [profilo, setProfilo] = useState<ProfiloCondiviso | null>(null)

  useEffect(() => {
    profiloCondiviso(token).then(setProfilo)
  }, [token])

  // Finche' il profilo non e' arrivato si usa il fuso del visitatore: i blocchi
  // occupati sono istanti assoluti e restano giusti comunque, e la pagina non
  // sfarfalla fra due nomi.
  const owner: ProfiloCondiviso = profilo ?? { nome: 'This calendar', fuso: tzLocale, etichetta: '' }
  const [fuso, setFuso] = useState(tzLocale) // asse primario = fuso del visitatore
  const [giorno, setGiorno] = useState(() => oggiISO(fuso))
  const [busy, setBusy] = useState<BloccoOccupato[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [modale, setModale] = useState(false)

  // Su telefono una giornata sola (7 colonne sono illeggibili); desktop = settimana.
  const [colonne] = useState<Vista>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'giorno' : 'settimana',
  )
  const fusoRif = fuso === owner.fuso ? tzLocale : owner.fuso
  const giorni = useMemo(() => giorniVista(colonne, giorno, fuso), [colonne, giorno, fuso])

  useEffect(() => {
    let vivo = true
    const daU = DateTime.fromISO(giorni[0], { zone: fuso }).startOf('day').minus({ hours: 36 }).toUTC().toISO()!
    const aU = DateTime.fromISO(giorni[giorni.length - 1], { zone: fuso })
      .endOf('day')
      .plus({ hours: 36 })
      .toUTC()
      .toISO()!
    impegniCondivisi(token, daU, aU)
      .then((b) => vivo && setBusy(b))
      .catch((e) => vivo && setErrore(e instanceof Error ? e.message : 'Error'))
    return () => {
      vivo = false
    }
  }, [token, giorni, fuso])

  const perGiorno = useMemo(() => {
    const evs: Evento[] = busy.map((b, i) => ({
      id: `b${i}`,
      utente_id: '',
      origine: 'personale',
      titolo: 'Busy',
      descrizione: null,
      luogo: null,
      inizio_utc: b.inizio_utc,
      fine_utc: b.fine_utc,
      fuso_origine: owner.fuso,
      tutto_il_giorno: b.tutto_il_giorno,
      id_esterno: null,
      stato: 'confermato',
      richiedente: null,
      link_video: null,
      creato_da: null,
      serie_id: null,
      creato_il: '',
      aggiornato_il: '',
    }))
    const m: Record<string, Evento[]> = {}
    for (const g of giorni) m[g] = evs.filter((ev) => eventoNelGiorno(ev, g, fuso))
    return m
  }, [busy, giorni, fuso])

  const stessoFuso = tzLocale === owner.fuso

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden" style={{ background: 'var(--pagina)' }}>
      <header
        className="flex flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center lg:gap-3 lg:px-6"
        style={{ borderBottom: '1px solid var(--linea)', background: 'var(--card)' }}
      >
        <div className="min-w-0 lg:flex-1">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--primario)' }}
          >
            {owner.nome}&apos;s availability
          </p>
          <h1 className="text-[22px] font-bold capitalize leading-tight">{titoloVista(colonne, giorno, fuso)}</h1>
          {!stessoFuso && (
            <p className="text-[12px]" style={{ color: 'var(--testo-2)' }}>
              Your time ({offsetBreve(tzLocale)}) · {owner.nome}{owner.etichetta ? ` in ${owner.etichetta}` : ''} (
              {offsetBreve(owner.fuso)})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!stessoFuso && (
            <div className="seg min-w-0 flex-1 lg:w-[230px] lg:flex-none">
              <button
                onClick={() => setFuso(tzLocale)}
                className={`seg-item premibile flex-1 text-[13px] ${fuso === tzLocale ? 'attivo' : ''}`}
              >
                Your time
              </button>
              <button
                onClick={() => setFuso(owner.fuso)}
                className={`seg-item premibile flex-1 text-[13px] ${fuso === owner.fuso ? 'attivo' : ''}`}
              >
                {owner.nome}&apos;s
              </button>
            </div>
          )}
          <button
            onClick={() => setGiorno(spostaVista(colonne, giorno, -1, fuso))}
            className="btn-neutro premibile h-10 w-10 shrink-0"
            aria-label="Previous"
          >
            <IconaChevron size={18} verso="sx" />
          </button>
          <button
            onClick={() => setGiorno(spostaVista(colonne, giorno, 1, fuso))}
            className="btn-neutro premibile h-10 w-10 shrink-0"
            aria-label="Next"
          >
            <IconaChevron size={18} verso="dx" />
          </button>
          <button onClick={() => setGiorno(oggiISO(fuso))} className="btn-neutro premibile h-10 shrink-0 px-3.5">
            Today
          </button>
        </div>
      </header>

      {errore && (
        <p className="px-4 py-2 text-[13px]" style={{ color: 'var(--testo-2)' }}>
          {/non valido|invalid/i.test(errore)
            ? 'This link is not valid any more.'
            : "Can't load the availability right now."}
        </p>
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <GrigliaSettimana
          perGiorno={perGiorno}
          giorni={giorni}
          giornoAttivo={giorno}
          fuso={fuso}
          fusoRiferimento={fusoRif}
          bandaUfficio={false}
          neutro
          onApri={() => setModale(true)}
          onSelezionaGiorno={setGiorno}
        />
        <button
          onClick={() => setModale(true)}
          className="btn-primario premibile absolute bottom-0 left-1/2 z-30 mb-5 -translate-x-1/2 rounded-full px-5 py-3"
          style={{ marginBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
          <IconaPiu size={18} />
          Request a slot
        </button>
      </main>

      {modale && (
        <ModaleRichiesta
          token={token}
          tzLocale={tzLocale}
          owner={owner}
          giornoISO={giorno}
          onChiudi={() => setModale(false)}
        />
      )}
    </div>
  )
}

function ModaleRichiesta({
  token,
  tzLocale,
  owner,
  giornoISO,
  onChiudi,
}: {
  token: string
  tzLocale: string
  owner: ProfiloCondiviso
  giornoISO: string
  onChiudi: () => void
}) {
  const stessoFuso = tzLocale === owner.fuso
  const [zona, setZona] = useState(tzLocale)
  const [nome, setNome] = useState('')
  const [titolo, setTitolo] = useState('')
  const [giorno, setGiorno] = useState(giornoISO)
  const [oraInizio, setOraInizio] = useState('10:00')
  const [oraFine, setOraFine] = useState('11:00')
  const [link, setLink] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [fatto, setFatto] = useState(false)

  const i = DateTime.fromISO(`${giorno}T${oraInizio}`, { zone: zona })
  const f = DateTime.fromISO(`${giorno}T${oraFine}`, { zone: zona })
  const valido = i.isValid && f.isValid && f > i
  const perOwner = valido ? `${i.setZone(owner.fuso).toFormat('HH:mm')}–${f.setZone(owner.fuso).toFormat('HH:mm')}` : ''
  const perTe = valido ? `${i.setZone(tzLocale).toFormat('HH:mm')}–${f.setZone(tzLocale).toFormat('HH:mm')}` : ''

  async function invia() {
    setErrore(null)
    if (!nome.trim() || !titolo.trim()) {
      setErrore('Add your name and what the meeting is about.')
      return
    }
    if (!valido) {
      setErrore('Check the times: the end must come after the start.')
      return
    }
    setInCorso(true)
    try {
      await inviaRichiesta(token, nome.trim(), titolo.trim(), i.toUTC().toISO()!, f.toUTC().toISO()!, link)
      setFatto(true)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Could not send the request')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" onClick={onChiudi}>
      <div className="anim-fade absolute inset-0" style={{ background: 'rgb(20 18 40 / 0.42)' }} />
      <div
        className="anim-sheet-su relative max-h-[92vh] w-full max-w-md overflow-y-auto scroll-fine rounded-t-[20px] px-5 pb-8 pt-3 lg:rounded-[18px] lg:pb-6"
        style={{
          background: 'var(--card)',
          boxShadow: 'var(--ombra-card)',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full lg:hidden" style={{ background: 'var(--linea-2)' }} />
        {fatto ? (
          <div className="py-6 text-center">
            <h2 className="mb-2 text-[20px] font-bold">Request sent</h2>
            <p className="mb-6 text-[15px]" style={{ color: 'var(--testo-2)' }}>
              It is waiting for {owner.nome} to approve it. Nothing is booked until then.
            </p>
            <button onClick={onChiudi} className="btn-primario premibile h-[46px] w-full">
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-[22px] font-bold">Request a slot</h2>
            <input
              autoFocus
              placeholder="Your name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="campo mb-3 text-[16px]"
            />
            <input
              placeholder="What is it about?"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              className="campo mb-3 text-[16px]"
            />

            <div className="mb-3 flex items-center gap-3">
              <label className="text-[14px]" style={{ color: 'var(--testo-2)' }}>
                Day
              </label>
              <input
                type="date"
                value={giorno}
                onChange={(e) => setGiorno(e.target.value)}
                className="campo flex-1 text-[16px]"
              />
            </div>

            {!stessoFuso && (
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 text-[13px]" style={{ color: 'var(--testo-2)' }}>
                  Times in
                </span>
                <div className="seg flex-1">
                  <button
                    type="button"
                    onClick={() => setZona(tzLocale)}
                    className={`seg-item premibile flex-1 text-[13px] ${zona === tzLocale ? 'attivo' : ''}`}
                  >
                    Your time
                  </button>
                  <button
                    type="button"
                    onClick={() => setZona(owner.fuso)}
                    className={`seg-item premibile flex-1 text-[13px] ${zona === owner.fuso ? 'attivo' : ''}`}
                  >
                    {owner.nome}&apos;s
                  </button>
                </div>
              </div>
            )}

            <div className="mb-3 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[13px]" style={{ color: 'var(--testo-2)' }}>
                  Start
                </label>
                <input
                  type="time"
                  step={PASSO_MINUTI * 60}
                  value={oraInizio}
                  onChange={(e) => setOraInizio(e.target.value)}
                  className="campo text-[16px]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[13px]" style={{ color: 'var(--testo-2)' }}>
                  End
                </label>
                <input
                  type="time"
                  step={PASSO_MINUTI * 60}
                  value={oraFine}
                  onChange={(e) => setOraFine(e.target.value)}
                  className="campo text-[16px]"
                />
              </div>
            </div>

            {/* Ogni slot detto due volte: e' il punto dell'app. */}
            {valido && !stessoFuso && (
              <div
                className="mb-3 rounded-[12px] px-3.5 py-3"
                style={{ background: 'var(--tenue)', color: 'var(--primario)' }}
              >
                <p className="text-[14px] font-semibold tabular-nums">
                  {perOwner} for {owner.nome}
                  {owner.etichetta ? ` in ${owner.etichetta}` : ''}
                </p>
                <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                  {perTe} in your timezone ({offsetBreve(tzLocale)})
                </p>
              </div>
            )}

            <input
              type="url"
              inputMode="url"
              placeholder="Video call link (optional)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="campo mb-3 text-[15px]"
            />

            {errore && (
              <p className="mb-3 text-[13px]" style={{ color: 'var(--adesso)' }}>
                {errore}
              </p>
            )}

            <button onClick={invia} disabled={inCorso} className="btn-primario premibile h-[46px] w-full">
              {inCorso ? 'Sending…' : 'Send request'}
            </button>
            <button onClick={onChiudi} className="mt-1 h-[44px] w-full text-[15px]" style={{ color: 'var(--testo-2)' }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
