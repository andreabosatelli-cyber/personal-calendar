import { useEffect, useState } from 'react'
import { useStato } from '../../lib/stato'
import {
  accessiConcessi,
  cambiaPermesso,
  invitaAlCalendario,
  revocaAccesso,
  NOME_PERMESSO,
  PERMESSI,
  type AccessoConcesso,
  type Permesso,
} from '../../lib/condivisi'
import { COLORI_CONDIVISI } from '../../lib/tempo'
import { TestataCard } from '../pannello/parti'
import { IconaChiudi, IconaPiu } from '../../lib/icone'

// "Shared calendars" nelle impostazioni: a chi ho dato accesso al mio
// calendario, e quali calendari altri hanno dato a me. Il link pubblico resta
// la card qui sopra: e' un'altra cosa, aperta a chiunque riceva l'indirizzo.
export function CardCondivisioni() {
  const { utenteId, condivisi, ricaricaCondivisi } = useStato()
  const [concessi, setConcessi] = useState<AccessoConcesso[]>([])
  const [email, setEmail] = useState('')
  const [permesso, setPermesso] = useState<Permesso>('dettagli')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function ricarica() {
    try {
      setConcessi(await accessiConcessi(utenteId))
    } catch {
      /* offline: la lista resta com'era, non si inventa nulla */
    }
  }

  useEffect(() => {
    ricarica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utenteId])

  async function invita(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)
    setInCorso(true)
    try {
      await invitaAlCalendario(email, permesso)
      setEmail('')
      await ricarica()
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Could not share the calendar.')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <section className="card overflow-hidden">
      <TestataCard titolo="Shared calendars" />
      <div className="px-[18px] pb-[18px] pt-1">
        <form onSubmit={invita} className="mb-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="campo"
            required
          />
          {/* I tre livelli con la loro spiegazione sotto: "Can book" da' a
              qualcuno il diritto di scriverti in agenda, non e' una scelta da
              fare leggendo solo due parole. */}
          <div className="seg mt-2">
            {PERMESSI.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPermesso(p.id)}
                className={`seg-item premibile flex-1 !px-2 ${permesso === p.id ? 'attivo' : ''}`}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--testo-3)' }}>
            {PERMESSI.find((p) => p.id === permesso)!.spiegazione}
          </p>
          <button type="submit" disabled={inCorso} className="btn-tenue premibile mt-3 h-[42px] w-full disabled:opacity-60">
            <IconaPiu size={17} />
            {inCorso ? 'Sharing…' : 'Share my calendar'}
          </button>
          {errore && (
            <p className="mt-2 text-[12.5px]" style={{ color: 'var(--errore)' }}>
              {errore}
            </p>
          )}
        </form>

        {concessi.length > 0 && (
          <div className="mt-4">
            <p className="etichetta-sezione mb-1.5">People with access</p>
            {concessi.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid var(--linea)' }}>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13.5px] font-medium">{c.destinatario_email}</span>
                  <span className="block text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
                    {/* Un invito a chi non ha ancora un account resta valido:
                        si attacca da solo appena quella email si registra. */}
                    {c.destinatario_id ? NOME_PERMESSO[c.permesso] : 'Waiting for them to sign up'}
                  </span>
                </span>
                <select
                  value={c.permesso}
                  onChange={async (e) => {
                    await cambiaPermesso(c.id, e.target.value as Permesso)
                    ricarica()
                  }}
                  className="campo !h-[34px] !w-auto !py-0 !text-[12.5px]"
                  aria-label={`Permission for ${c.destinatario_email}`}
                >
                  {PERMESSI.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.etichetta}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (!confirm(`Stop sharing with ${c.destinatario_email}?`)) return
                    await revocaAccesso(c.id)
                    ricarica()
                  }}
                  className="btn-neutro premibile h-[34px] w-[34px] shrink-0"
                  style={{ color: 'var(--errore)' }}
                  aria-label={`Revoke access for ${c.destinatario_email}`}
                  title="Revoke"
                >
                  <IconaChiudi size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {condivisi.length > 0 && (
          <div className="mt-5">
            <p className="etichetta-sezione mb-1.5">Shared with me</p>
            {condivisi.map((c, i) => {
              const col = COLORI_CONDIVISI[i % COLORI_CONDIVISI.length]
              return (
                <div key={c.id} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid var(--linea)' }}>
                  <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: col.punto }} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13.5px] font-medium">{c.nome}</span>
                    <span className="block truncate text-[11.5px]" style={{ color: 'var(--testo-3)' }}>
                      {c.email} · {NOME_PERMESSO[c.permesso]}
                    </span>
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${c.nome}'s calendar from your sidebar?`)) return
                      await revocaAccesso(c.id)
                      await ricaricaCondivisi()
                    }}
                    className="btn-neutro premibile h-[34px] w-[34px] shrink-0"
                    aria-label={`Remove ${c.nome}'s calendar`}
                    title="Remove"
                  >
                    <IconaChiudi size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--testo-3)' }}>
          Shared calendars show up under "Shared with me" in the sidebar, on top of your own. Nobody can edit your
          events: with "Can book" they send requests that wait for your approval.
        </p>
      </div>
    </section>
  )
}
