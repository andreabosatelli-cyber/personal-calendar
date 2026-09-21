import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { useStato } from '../lib/stato'
import { SelettoreFuso } from './SelettoreFuso'
import { fusoDelBrowser, opzioneFuso } from '../lib/tempo'

// Primo accesso di un account nuovo. Tre domande, nessuna delle quali si può
// indovinare dal codice: come si chiama chi scrive (lo legge chi riceve il link
// di prenotazione), su che fuso va disegnata la giornata, e se serve un secondo
// fuso a fianco — l'app è nata proprio per leggere due orari insieme, ma per
// chi non vive fra due paesi quella colonna è solo rumore.
//
// Tutto è modificabile dopo in Settings: qui si chiede il minimo per non
// consegnare un calendario disegnato sul fuso sbagliato.
export function Onboarding() {
  const { pref, aggiornaPref, email } = useStato()
  const [nome, setNome] = useState(pref.nome_visualizzato ?? suggerisciNome(email))
  const [fuso, setFuso] = useState(pref.fuso_base && pref.fuso_base !== 'UTC' ? pref.fuso_base : fusoDelBrowser())
  const [rif, setRif] = useState<string | null>(pref.fuso_riferimento)
  const [passo, setPasso] = useState<1 | 2>(1)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [toccato, setToccato] = useState(false)

  // L'email arriva da una chiamata asincrona, quindi al primo render non c'e'
  // ancora: il suggerimento si applica quando compare, e solo finche' l'utente
  // non ha scritto di suo.
  useEffect(() => {
    if (!toccato && email) setNome((n) => n || suggerisciNome(email))
  }, [email, toccato])

  async function completa() {
    setInCorso(true)
    setErrore(null)
    try {
      await aggiornaPref({
        nome_visualizzato: nome.trim() || null,
        fuso_base: fuso,
        etichetta_base: opzioneFuso(fuso).etichetta,
        fuso_riferimento: rif,
        etichetta_riferimento: rif ? opzioneFuso(rif).etichetta : null,
        onboarding_fatto: true,
      })
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Could not save your settings')
      setInCorso(false)
    }
  }

  const adesso = DateTime.now()

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8" style={{ background: 'var(--sidebar)' }}>
      <div className="card w-full max-w-[460px] overflow-hidden">
        <div className="flex items-center gap-3 px-6 pt-7">
          <img src="/icona-192.png" alt="" width={44} height={44} className="rounded-[13px]" />
          <div className="leading-tight">
            <h1 className="text-[21px] font-bold">Welcome to SmartCal</h1>
            <p className="text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
              Two questions and your calendar is yours.
            </p>
          </div>
        </div>

        {passo === 1 ? (
          <>
            <div className="px-6 pt-6">
              <label className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                Your name
              </label>
              <input
                value={nome}
                onChange={(e) => {
                  setToccato(true)
                  setNome(e.target.value)
                }}
                maxLength={60}
                placeholder="e.g. Sam"
                className="campo"
                autoFocus
              />
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                Shown to anyone you send your booking link to. Nothing else about you is public.
              </p>
            </div>

            <div className="px-6 pt-5">
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                Where you are
              </p>
              <p className="mb-1 mt-0.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                This is the clock your day is drawn on.
              </p>
            </div>
            <SelettoreFuso valore={fuso} onCambia={setFuso} massimo={5} />

            <div className="flex justify-end gap-2 px-6 pb-6 pt-1">
              <button onClick={() => setPasso(2)} className="btn-primario premibile h-[44px] px-5 !text-[15px]">
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6">
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
                A second timezone?
              </p>
              <p className="mb-1 mt-0.5 text-[12px]" style={{ color: 'var(--testo-3)' }}>
                If your work, family or studies live in another country, SmartCal keeps that clock next to yours —
                and shades its office hours on your own day. Otherwise skip it: one clock is cleaner.
              </p>
            </div>
            <SelettoreFuso
              valore={rif}
              onCambia={setRif}
              massimo={5}
              vuoto={{
                etichetta: 'No second timezone',
                sotto: `Just ${opzioneFuso(fuso).etichetta} · ${adesso.setZone(fuso).toFormat('HH:mm')}`,
                onScegli: () => setRif(null),
              }}
            />

            {errore && (
              <p className="px-6 pb-1 text-[13px]" style={{ color: 'var(--errore)' }}>
                {errore}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 px-6 pb-6 pt-1">
              <button
                onClick={() => setPasso(1)}
                className="h-[44px] px-1 text-[13.5px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--testo-2)' }}
              >
                Back
              </button>
              <button
                onClick={completa}
                disabled={inCorso}
                className="btn-primario premibile h-[44px] px-5 !text-[15px] disabled:opacity-60"
              >
                {inCorso ? '…' : 'Start using SmartCal'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// "sam.smith@…" → "Sam Smith": un default plausibile, comunque correggibile.
function suggerisciNome(email: string): string {
  if (!email) return ''
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
