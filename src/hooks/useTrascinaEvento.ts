import { useCallback, useEffect, useRef, useState } from 'react'
import type { Evento } from '../lib/types'
import { ALTEZZA_ORA, PASSO_MINUTI } from '../lib/tempo'

// Spostare un evento trascinandolo, col dito o col mouse.
//
// Le due cose non possono comportarsi allo stesso modo, e non e' una scelta di
// gusto: sul telefono il gesto "premi e muovi" e' gia' preso dallo scorrimento
// della griglia. Se l'evento partisse subito, scorrere il calendario passando
// un dito sopra un impegno lo sposterebbe — un disastro silenzioso, perche' te
// ne accorgi il giorno dopo. Quindi:
//
//   dito   -> pressione lunga (350 ms) e poi si muove. Se il dito scivola
//             prima che il tempo sia scaduto, era uno scorrimento: si lascia
//             perdere e la griglia scorre come sempre.
//   mouse  -> parte subito, dopo pochi pixel di movimento. Col mouse lo
//             scorrimento e' la rotella, non c'e' niente da contendere.
//
// Il giorno di destinazione non si calcola dalla geometria delle colonne: si
// chiede al browser cosa c'e' sotto il puntatore (`elementFromPoint`) e si
// legge il `data-giorno` piu' vicino. Cosi' la stessa logica vale per le
// colonne della settimana e per le celle del mese, senza sapere nulla del
// layout di nessuna delle due.

const ATTESA_DITO = 350 // ms di pressione prima che l'evento si stacchi
const SOGLIA_MOUSE = 4 // px di movimento prima di considerarlo un trascinamento
const TOLLERANZA_DITO = 10 // px di scivolamento tollerati durante la pressione

// Cosa si sta trascinando: tutto il blocco, o uno dei suoi due bordi.
// Il bordo cambia la DURATA, il blocco intero cambia QUANDO.
export type Bordo = 'sposta' | 'inizio' | 'fine'

export interface Trascinamento {
  id: string
  bordo: Bordo
  dx: number
  dy: number
  minuti: number // spostamento in minuti, gia' agganciato al quarto d'ora
  giorno: string | null // giorno sotto il puntatore, se ne trova uno
}

interface Opzioni {
  // 'ore' = griglia giorno/settimana: conta lo spostamento verticale in minuti.
  // 'giorni' = vista mese: si cambia solo giornata, l'ora resta quella.
  modo: 'ore' | 'giorni'
  onSposta: (ev: Evento, minuti: number, giorno: string | null) => void
  // Trascinamento di un bordo: cambia la durata, non la collocazione.
  onRidimensiona?: (ev: Evento, minuti: number, bordo: 'inizio' | 'fine') => void
  // Un trascinamento che non si e' mai attivato e' un click: apre l'evento.
  onClick: (ev: Evento) => void
}

export function useTrascinaEvento({ modo, onSposta, onRidimensiona, onClick }: Opzioni) {
  const [trascina, setTrascina] = useState<Trascinamento | null>(null)
  // Lo spostamento vive nel ref, non solo nello stato di React.
  //
  // Non e' una doppia contabilita' per pigrizia: `pointerup` legge quanto ci si
  // e' spostati, e se lo leggesse dallo stato leggerebbe il valore dell'ultimo
  // render. In un trascinamento veloce — ed e' la norma, non l'eccezione — il
  // dito si alza prima che React abbia ridisegnato, lo stato e' ancora quello
  // di partenza e lo spostamento verrebbe scartato come se non fosse successo
  // niente. Lo stato serve a disegnare, il ref a decidere.
  const stato = useRef<{
    ev: Evento
    x0: number
    y0: number
    attivo: boolean
    timer: number | null
    dito: boolean
    minuti: number
    giorno: string | null
    bordo: Bordo
  } | null>(null)

  const pulisci = useCallback(() => {
    const s = stato.current
    if (s?.timer) clearTimeout(s.timer)
    stato.current = null
    setTrascina(null)
    document.body.style.removeProperty('user-select')
  }, [])

  // Mentre si trascina col dito bisogna impedire alla pagina di scorrere. Un
  // listener React non basta: quelli di touchmove sono passivi e non possono
  // annullare lo scorrimento, quindi ne serve uno vero, dichiarato non passivo.
  useEffect(() => {
    if (!trascina) return
    const blocca = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', blocca, { passive: false })
    return () => document.removeEventListener('touchmove', blocca)
  }, [trascina])

  const giornoSotto = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)
    const cella = el?.closest('[data-giorno]') as HTMLElement | null
    return cella?.dataset.giorno ?? null
  }

  const aggiorna = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const s = stato.current
      if (!s?.attivo) return
      const dx = e.clientX - s.x0
      const dy = e.clientY - s.y0
      // Un bordo si muove solo in verticale, e sempre a passi di un quarto
      // d'ora: la durata e' un numero, non una posizione sullo schermo.
      const minuti =
        modo === 'ore' || s.bordo !== 'sposta'
          ? Math.round((dy / ALTEZZA_ORA) * 60 / PASSO_MINUTI) * PASSO_MINUTI
          : 0
      const giorno = s.bordo === 'sposta' ? giornoSotto(e.clientX, e.clientY) : s.giorno
      s.minuti = minuti
      s.giorno = giorno
      setTrascina({ id: s.ev.id, bordo: s.bordo, dx: s.bordo === 'sposta' ? dx : 0, dy, minuti, giorno })
    },
    [modo],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent, ev: Evento, bordo: Bordo = 'sposta') => {
      // Solo il tasto sinistro: col destro si apre il menu del browser.
      if (e.button !== 0) return
      // Afferrare un bordo non deve anche trascinare il blocco che lo contiene.
      if (bordo !== 'sposta') e.stopPropagation()
      const dito = e.pointerType !== 'mouse'
      // La cattura puo' essere rifiutata (puntatore non piu' attivo): non e'
      // un motivo per far fallire tutto il gesto.
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      } catch {
        /* si prosegue senza cattura */
      }
      stato.current = { ev, x0: e.clientX, y0: e.clientY, attivo: false, timer: null, dito, minuti: 0, giorno: null, bordo }

      if (dito) {
        const x = e.clientX
        const y = e.clientY
        stato.current.timer = window.setTimeout(() => {
          const s = stato.current
          if (!s) return
          s.attivo = true
          s.timer = null
          s.giorno = giornoSotto(x, y)
          document.body.style.userSelect = 'none'
          // Un colpetto di vibrazione: e' il segnale che l'evento si e'
          // staccato dalla griglia, altrimenti non si capisce se ha preso.
          navigator.vibrate?.(12)
          setTrascina({ id: s.ev.id, bordo: s.bordo, dx: 0, dy: 0, minuti: 0, giorno: giornoSotto(x, y) })
        }, ATTESA_DITO)
      }
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = stato.current
      if (!s) return
      const dist = Math.hypot(e.clientX - s.x0, e.clientY - s.y0)

      if (!s.attivo) {
        if (s.dito) {
          // Il dito si e' mosso prima della pressione lunga: era uno scorrimento.
          if (dist > TOLLERANZA_DITO) pulisci()
          return
        }
        if (dist < SOGLIA_MOUSE) return
        s.attivo = true
        document.body.style.userSelect = 'none'
      }
      aggiorna(e)
    },
    [aggiorna, pulisci],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = stato.current
      if (!s) return
      const { ev, attivo } = s

      if (!attivo) {
        // Mai partito: era un click, e un click apre l'evento.
        pulisci()
        onClick(ev)
        return
      }

      // Dal ref, non dallo stato: vedi il commento sulla sua dichiarazione.
      const bordo = s.bordo
      const giorno = bordo === 'sposta' ? (giornoSotto(e.clientX, e.clientY) ?? s.giorno) : null
      const minuti = s.minuti
      pulisci()

      if (bordo !== 'sposta') {
        if (minuti !== 0) onRidimensiona?.(ev, minuti, bordo)
        return
      }
      // Rilasciato dove stava: non c'e' niente da salvare.
      const stessoGiorno = !giorno || giorno === giornoDellEvento(ev)
      if (minuti === 0 && stessoGiorno) return
      onSposta(ev, minuti, giorno)
    },
    [onClick, onRidimensiona, onSposta, pulisci],
  )

  return {
    trascina,
    handlers: (ev: Evento, bordo: Bordo = 'sposta') => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, ev, bordo),
      onPointerMove,
      onPointerUp,
      onPointerCancel: pulisci,
    }),
  }
}

// Il giorno da cui l'evento parte, per capire se e' stato davvero spostato
// altrove. Lo mette la griglia sul contenitore, quindi qui basta l'id.
function giornoDellEvento(ev: Evento): string | null {
  const el = document.querySelector(`[data-evento="${ev.id}"]`)
  const cella = el?.closest('[data-giorno]') as HTMLElement | null
  return cella?.dataset.giorno ?? null
}
