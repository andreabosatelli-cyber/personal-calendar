// Packing a colonne per eventi che si sovrappongono DAVVERO nel tempo.
// Estratto da GrigliaGiorno per essere condiviso con la vista settimanale.
import type { Evento } from './types'
import { ALTEZZA_GRIGLIA, FUSO_PRINCIPALE, ORA_INIZIO, vaInFascia, yDaIstante } from './tempo'

export const ALTEZZA_MIN = 24
export const clamp = (v: number, altezza: number = ALTEZZA_GRIGLIA) => Math.max(0, Math.min(altezza, v))

export interface Posizionato {
  ev: Evento
  top: number
  height: number
  fineReale: number
  col: number
  cols: number
}

export function disponiEventi(
  eventi: Evento[],
  giornoISO: string,
  fuso: string = FUSO_PRINCIPALE,
  oraInizio: number = ORA_INIZIO,
  altezza: number = ALTEZZA_GRIGLIA,
): Posizionato[] {
  const timed = eventi
    .filter((e) => !vaInFascia(e))
    .map((ev) => {
      const top = clamp(yDaIstante(ev.inizio_utc, giornoISO, fuso, oraInizio), altezza)
      const bottom = clamp(yDaIstante(ev.fine_utc, giornoISO, fuso, oraInizio), altezza)
      return { ev, top, fineReale: Math.max(bottom, top), height: Math.max(ALTEZZA_MIN, bottom - top) }
    })
    .sort((a, b) => a.top - b.top || a.fineReale - b.fineReale)

  const risultato: Posizionato[] = []
  let cluster: typeof timed = []
  let clusterFine = -1

  const chiudiCluster = () => {
    const colonne: number[] = []
    const assegnati = cluster.map((it) => {
      let col = colonne.findIndex((fine) => it.top >= fine)
      if (col === -1) {
        col = colonne.length
        colonne.push(0)
      }
      colonne[col] = it.fineReale
      return { ...it, col }
    })
    const cols = colonne.length
    for (const a of assegnati) risultato.push({ ...a, cols })
    cluster = []
    clusterFine = -1
  }

  for (const it of timed) {
    if (cluster.length && it.top >= clusterFine) chiudiCluster()
    cluster.push(it)
    clusterFine = Math.max(clusterFine, it.fineReale)
  }
  if (cluster.length) chiudiCluster()

  return risultato
}
