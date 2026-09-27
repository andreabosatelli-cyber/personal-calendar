import { SEZIONI, TITOLO_SEZIONE, type Sezione } from '../../lib/rotte'
import { IconaAltro } from '../../lib/icone'

interface Props {
  sezione: Sezione
  vai: (s: Sezione) => void
  onAltro: () => void // apre il drawer con tutto il resto (Export, Settings, calendari)
}

// Le quattro sezioni che si aprono di piu' da telefono. Export e Settings
// restano nel menu: "More" apre lo stesso drawer dell'hamburger.
const IN_BARRA: Sezione[] = ['calendar', 'scheduling', 'analytics', 'trips']

// Barra di navigazione in basso dello stile trends, solo sotto i 1024px:
// pillola nera, voce attiva in pillola bianca con l'etichetta, le altre solo
// icona. E' un elemento del flusso in fondo alla colonna (non fixed), quindi
// non copre mai il contenuto; il margine basso rispetta la safe-area.
export function BarraNav({ sezione, vai, onAltro }: Props) {
  const voci = SEZIONI.filter((s) => IN_BARRA.includes(s.id))
  const altroAttivo = !IN_BARRA.includes(sezione)

  return (
    <nav
      aria-label="Sections"
      className="shrink-0 px-3 pt-2 lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)', background: 'var(--pagina)' }}
    >
      <div
        className="mx-auto flex h-[60px] max-w-[440px] items-center justify-between gap-1 rounded-full px-1.5"
        style={{ background: 'var(--nav-bg)', color: 'var(--nav-fg)' }}
      >
        {voci.map(({ id, etichetta, Icona }) => {
          const attiva = sezione === id
          return (
            <button
              key={id}
              onClick={() => vai(id)}
              aria-current={attiva ? 'page' : undefined}
              aria-label={etichetta}
              className="premibile flex h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors"
              style={attiva ? { background: 'var(--nav-attivo-bg)', color: 'var(--nav-attivo-fg)' } : { opacity: 0.8 }}
            >
              <Icona size={20} />
              {attiva && <span>{etichetta}</span>}
            </button>
          )
        })}
        <button
          onClick={onAltro}
          aria-label="More"
          className="premibile flex h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors"
          style={altroAttivo ? { background: 'var(--nav-attivo-bg)', color: 'var(--nav-attivo-fg)' } : { opacity: 0.8 }}
        >
          <IconaAltro size={20} />
          {altroAttivo && <span>{TITOLO_SEZIONE[sezione]}</span>}
        </button>
      </div>
    </nav>
  )
}
