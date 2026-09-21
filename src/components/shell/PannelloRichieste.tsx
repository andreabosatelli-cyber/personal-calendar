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
        className="anim-fade absolute right-0 top-[calc(100%+8px)] z-50 w-[330px] overflow-hidden rounded-[16px]"
        style={{ background: 'var(--card)', border: '1px solid var(--linea)', boxShadow: 'var(--ombra-card)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--linea)' }}>
          <h3 className="text-[15px] font-semibold">Requests</h3>
          {richieste.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11.5px] font-bold"
              style={{ background: 'var(--tenue)', color: 'var(--primario)' }}
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
          <div className="max-h-[380px] overflow-y-auto scroll-fine p-2">
            {richieste.map((r) => {
              const i = DateTime.fromISO(r.inizio_utc, { zone: 'utc' }).setZone(fuso).setLocale(LOCALE)
              const f = DateTime.fromISO(r.fine_utc, { zone: 'utc' }).setZone(fuso)
              const rif = DateTime.fromISO(r.inizio_utc, { zone: 'utc' }).setZone(fusoRif() ?? '')
              return (
                <div key={r.id} className="rounded-[12px] p-2.5 transition-colors hover:bg-[var(--hover)]">
                  <p className="truncate text-[14px] font-semibold leading-tight">{r.titolo}</p>
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
                      className="btn-primario premibile h-8 flex-1 text-[13px]"
                      style={{ boxShadow: 'none' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => decidi(r.id, false)}
                      className="btn-neutro premibile h-8 flex-1 text-[13px]"
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
