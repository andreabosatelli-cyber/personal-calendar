import { DateTime } from 'luxon'
import { useStato } from '../../lib/stato'
import { approvaRichiesta, rifiutaRichiesta } from '../../lib/condivisione'
import { LOCALE, asseUnico, etichettaRif, fusoRif } from '../../lib/tempo'
import { IconaCampana } from '../../lib/icone'

// Tendina della campanella: le richieste di appuntamento arrivate dal link
// pubblico, da approvare o rifiutare. Prima stava nella sidebar; qui sta dove
// la reference mette le notifiche.
export function PannelloRichieste({ onChiudi }: { onChiudi: () => void }) {
  const { richieste, caricaRichieste, fuso } = useStato()
  const mostraRif = !asseUnico(fuso)

  async function decidi(id: string, ok: boolean) {
    if (ok) await approvaRichiesta(id)
    else await rifiutaRichiesta(id)
    await caricaRichieste()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onChiudi} />
      <div
        className="anim-fade absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px]"
        style={{ background: 'var(--pagina)', boxShadow: 'var(--ombra-galleggia)' }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-[20px] font-medium tracking-[-0.02em]">Requests</h3>
          {richieste.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
              style={{ background: 'var(--primario)', color: 'var(--su-primario)' }}
            >
              {richieste.length}
            </span>
          )}
        </div>

        {richieste.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span style={{ color: 'var(--testo-3)' }}>
              <IconaCampana size={26} />
            </span>
            <p className="text-[13.5px]" style={{ color: 'var(--testo-2)' }}>
              No pending requests.
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto scroll-fine p-3 pt-1">
            {richieste.map((r) => {
              const i = DateTime.fromISO(r.inizio_utc, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE)
              const f = DateTime.fromISO(r.fine_utc, { zone: 'utc' }).setZone(fuso)
              const rif = DateTime.fromISO(r.inizio_utc, { zone: 'utc' }).setZone(fusoRif() ?? '')
              return (
                <div key={r.id} className="mb-2 rounded-[20px] p-4 last:mb-0" style={{ background: 'var(--card)' }}>
                  <p className="truncate text-[15.5px] font-medium leading-tight">{r.titolo}</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
                    {r.richiedente}
                  </p>
                  <p className="mt-1 text-[12.5px] tabular-nums" style={{ color: 'var(--testo-2)' }}>
                    {i.toFormat('ccc d LLL')} · {i.toFormat('HH:mm')}–{f.toFormat('HH:mm')}
                    {mostraRif && <span style={{ color: 'var(--testo-3)' }}> · {rif.toFormat('HH:mm')} in {etichettaRif()}</span>}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => decidi(r.id, true)}
                      className="btn-primario premibile h-11 flex-1 text-[14px]"
                      style={{ boxShadow: 'none' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => decidi(r.id, false)}
                      className="btn-neutro premibile h-11 flex-1 text-[14px]"
                      style={{ color: 'var(--errore)' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
