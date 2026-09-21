import { useEffect, useRef, useState } from 'react'
import { BarraLaterale } from './BarraLaterale'
import { Intestazione } from './Intestazione'
import type { Sezione } from '../../lib/rotte'

interface Props {
  sezione: Sezione
  vai: (s: Sezione) => void
  onNuovoEvento: () => void
  children: React.ReactNode
}

// La sidebar nascosta si ricorda: chi lavora a schermo pieno non vuole
// richiuderla a ogni apertura.
const CHIAVE_BARRA = 'pc_barra'

// Guscio a tre zone della reference: sidebar lavanda fissa a sinistra, header
// minimale in alto, contenuto sotto. Su schermi stretti la sidebar diventa un
// drawer richiamato dall'hamburger nell'header; su desktop la si puo' nascondere
// e richiamare con lo stesso pulsante.
export function Guscio({ sezione, vai, onNuovoEvento, children }: Props) {
  const [drawer, setDrawer] = useState(false)
  const [nascosta, setNascosta] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_BARRA) === '1'
    } catch {
      return false
    }
  })

  function cambiaBarra(v: boolean) {
    setNascosta(v)
    try {
      localStorage.setItem(CHIAVE_BARRA, v ? '1' : '0')
    } catch {
      /* modalita' privata: pazienza, resta solo per questa sessione */
    }
  }

  // Lo stesso pulsante fa due cose diverse: su desktop rimette la sidebar al suo
  // posto, su schermi stretti apre il drawer.
  function apriBarra() {
    if (window.matchMedia('(min-width: 1024px)').matches) cambiaBarra(false)
    else setDrawer(true)
  }

  // Cambiando sezione il drawer si chiude, e Esc lo chiude sempre.
  useEffect(() => {
    setDrawer(false)
  }, [sezione])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--pagina)' }}>
      {/* Sidebar fissa (desktop) */}
      {!nascosta && (
        <aside
          className="hidden w-[268px] shrink-0 lg:block"
          style={{ borderRight: '1px solid var(--linea)' }}
        >
          <BarraLaterale
            sezione={sezione}
            vai={vai}
            onNuovoEvento={onNuovoEvento}
            onNascondi={() => cambiaBarra(true)}
          />
        </aside>
      )}

      {/* Sidebar come drawer (tablet/mobile) */}
      {drawer && (
        <Drawer onChiudi={() => setDrawer(false)}>
          <BarraLaterale sezione={sezione} vai={vai} onNuovoEvento={onNuovoEvento} onChiudi={() => setDrawer(false)} />
        </Drawer>
      )}

      {/* Colonna principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Intestazione onApriMenu={apriBarra} mostraMenu={nascosta} onNuovoEvento={onNuovoEvento} />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

// Distanza oltre la quale lo swipe chiude invece di rimbalzare indietro.
const SOGLIA_SWIPE = 60

// Drawer a overlay: entra da sinistra, si chiude toccando il backdrop, con Esc
// o trascinandolo via col dito. Durante il trascinamento segue la mano e il
// backdrop sbiadisce, così si capisce che il gesto sta funzionando prima di
// averlo completato.
function Drawer({ onChiudi, children }: { onChiudi: () => void; children: React.ReactNode }) {
  const pannello = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const partenza = useRef<{ x: number; y: number } | null>(null)
  const orizzontale = useRef(false)
  const dx = useRef(0)

  function disegna(v: number) {
    const el = pannello.current
    if (!el) return
    el.style.transform = v ? `translateX(${v}px)` : ''
    if (backdrop.current) backdrop.current.style.opacity = String(1 - Math.min(1, -v / (el.offsetWidth || 1)))
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    partenza.current = { x: t.clientX, y: t.clientY }
    orizzontale.current = false
    dx.current = 0
    if (pannello.current) pannello.current.style.transition = 'none'
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!partenza.current) return
    const t = e.touches[0]
    const sx = t.clientX - partenza.current.x
    const sy = t.clientY - partenza.current.y
    // Finché il gesto non è chiaramente orizzontale si lascia scorrere la
    // sidebar in verticale: è lunga e si scrolla.
    if (!orizzontale.current) {
      if (Math.abs(sx) < 10 && Math.abs(sy) < 10) return
      if (Math.abs(sy) > Math.abs(sx)) {
        partenza.current = null
        return
      }
      orizzontale.current = true
    }
    dx.current = Math.min(0, sx) // si trascina solo verso sinistra
    disegna(dx.current)
  }

  function onTouchEnd() {
    const el = pannello.current
    if (el) el.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)'
    if (orizzontale.current && dx.current < -SOGLIA_SWIPE) onChiudi()
    else disegna(0)
    partenza.current = null
    orizzontale.current = false
  }

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div
        ref={backdrop}
        className="anim-fade absolute inset-0"
        style={{ background: 'rgb(20 18 40 / 0.42)' }}
        onClick={onChiudi}
      />
      <div
        ref={pannello}
        className="anim-drawer-sx absolute bottom-0 left-0 top-0 w-[290px] max-w-[85vw] overflow-hidden"
        style={{ boxShadow: '0 0 60px rgb(20 18 40 / 0.25)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
