import { useCallback, useEffect, useState } from 'react'
import { useSessione } from './lib/useSessione'
import { ProviderStato, useStato } from './lib/stato'
import { Login } from './components/Login'
import { Onboarding } from './components/Onboarding'
import { PaginaCondivisa } from './components/PaginaCondivisa'
import { PaginaCalendario } from './components/PaginaCalendario'
import { PaginaAnalytics } from './components/analitica/PaginaAnalytics'
import { PaginaViaggi } from './components/viaggi/PaginaViaggi'
import { PaginaScheduling } from './components/scheduling/PaginaScheduling'
import { PaginaImpostazioni } from './components/impostazioni/PaginaImpostazioni'
import { SheetEvento } from './components/SheetEvento'
import { sincronizzaGoogle } from './lib/google'
import { EsportaPdf } from './components/EsportaPdf'
import { Guscio } from './components/shell/Guscio'
import { sezioneDaHash, vaiA, type Sezione } from './lib/rotte'
import { giorniVista } from './lib/settimana'
import type { Evento } from './lib/types'

export default function App() {
  // Pagina pubblica di condivisione: nessun login richiesto.
  const token = new URLSearchParams(location.search).get('condividi')
  if (token) return <PaginaCondivisa token={token} />
  return <AppPrivata />
}

function AppPrivata() {
  const { sessione, caricamento } = useSessione()

  if (caricamento) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="anim-pulsa text-[14px]" style={{ color: 'var(--testo-2)' }}>
          Loading…
        </span>
      </div>
    )
  }
  if (!sessione) return <Login />
  return (
    <ProviderStato>
      <PrimoAccessoOApp />
    </ProviderStato>
  )
}

// Un account appena registrato non ha ancora detto dove sta: il calendario
// sarebbe disegnato su un fuso a caso. Prima le due domande, poi l'app.
function PrimoAccessoOApp() {
  const { pref } = useStato()
  return pref.onboarding_fatto ? <AppLoggata /> : <Onboarding />
}

function AppLoggata() {
  const { fuso, vista, giorno, caricaRichieste, segnalaRicarica } = useStato()
  const [sezione, setSezione] = useState<Sezione>(() => sezioneDaHash())
  const [sheet, setSheet] = useState<{ aperto: boolean; evento: Evento | null }>({ aperto: false, evento: null })

  // Navigazione via hash: il back del browser funziona come ci si aspetta.
  useEffect(() => {
    const onHash = () => setSezione(sezioneDaHash())
    window.addEventListener('hashchange', onHash)
    if (!location.hash) history.replaceState(null, '', '#/calendar')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const vai = useCallback((s: Sezione) => {
    vaiA(s)
    setSezione(s)
  }, [])

  const apriEvento = useCallback((ev: Evento | null) => setSheet({ aperto: true, evento: ev }), [])

  const dopoSalvataggio = useCallback(async () => {
    segnalaRicarica()
    await caricaRichieste()
    // Lo specchio su Google: la coda l'ha gia' riempita il database, qui si
    // chiede solo di svuotarla adesso invece di aspettare il giro del minuto.
    // Non si aspetta la risposta e non si mostra nessun errore: se Google non
    // risponde ci ritorna il cron, e il salvataggio e' andato comunque a buon
    // fine.
    sincronizzaGoogle().catch(() => {})
  }, [caricaRichieste, segnalaRicarica])

  const giorniVisibili = giorniVista(vista, giorno, fuso)

  return (
    <>
      <Guscio sezione={sezione} vai={vai} onNuovoEvento={() => apriEvento(null)}>
        {sezione === 'calendar' || sezione === 'export' ? (
          <PaginaCalendario onApriEvento={apriEvento} vai={vai} />
        ) : sezione === 'analytics' ? (
          <PaginaAnalytics />
        ) : sezione === 'trips' ? (
          <PaginaViaggi onApriEvento={apriEvento} />
        ) : sezione === 'scheduling' ? (
          <PaginaScheduling />
        ) : (
          <PaginaImpostazioni />
        )}
      </Guscio>

      {sezione === 'export' && (
        <EsportaPdf
          fuso={fuso}
          dataInizio={giorniVisibili[0]}
          dataFine={giorniVisibili[giorniVisibili.length - 1]}
          onChiudi={() => vai('calendar')}
        />
      )}

      {sheet.aperto && (
        <SheetEvento
          giornoISO={giorno}
          evento={sheet.evento}
          fuso={fuso}
          onChiudi={() => setSheet({ aperto: false, evento: null })}
          onSalvato={dopoSalvataggio}
        />
      )}
    </>
  )
}
