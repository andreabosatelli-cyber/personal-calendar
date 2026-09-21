import {
  IconaAnalytics,
  IconaAereo,
  IconaCalendario,
  IconaDocumento,
  IconaScheduling,
} from './icone'

// Sezioni dell'app, nell'ordine del menu della reference SmartCal.
// La navigazione passa dall'hash (#/analytics): niente router da installare,
// e il link pubblico ?condividi=… continua a funzionare com'era.
export type Sezione = 'calendar' | 'scheduling' | 'analytics' | 'trips' | 'export' | 'settings'

export const SEZIONI: { id: Sezione; etichetta: string; Icona: typeof IconaCalendario }[] = [
  { id: 'calendar', etichetta: 'Calendar', Icona: IconaCalendario },
  { id: 'scheduling', etichetta: 'Scheduling', Icona: IconaScheduling },
  { id: 'analytics', etichetta: 'Analytics', Icona: IconaAnalytics },
  { id: 'trips', etichetta: 'Trips', Icona: IconaAereo },
  { id: 'export', etichetta: 'Export', Icona: IconaDocumento },
]

const VALIDE: Sezione[] = ['calendar', 'scheduling', 'analytics', 'trips', 'export', 'settings']

export function sezioneDaHash(hash: string = location.hash): Sezione {
  const s = hash.replace(/^#\/?/, '') as Sezione
  return VALIDE.includes(s) ? s : 'calendar'
}

export function vaiA(s: Sezione) {
  location.hash = `#/${s}`
}

export const TITOLO_SEZIONE: Record<Sezione, string> = {
  calendar: 'Calendar',
  scheduling: 'Scheduling',
  analytics: 'Analytics',
  trips: 'Trips',
  export: 'Export',
  settings: 'Settings',
}
