import { IconaCalendario } from '../lib/icone'

// Il marchio dentro l'app: cerchio nero con il calendario, come le pillole
// dello stile trends. Le icone PWA in public/ sono lo stesso disegno.
export function Marchio({ size = 46 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: 'var(--primario)', color: 'var(--su-primario)' }}
      aria-hidden="true"
    >
      <IconaCalendario size={Math.round(size * 0.48)} />
    </span>
  )
}
