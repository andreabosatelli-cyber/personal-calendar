import { LUOGO_FUSO, MAPPA, proietta, type Viaggio } from '../../lib/viaggi'

interface Props {
  viaggi: Viaggio[]
  fuso: string
  altezza?: number
}

// Mappamondo della reference: silhouette chiarissima (public/mappa-mondo.png,
// estratta dallo screenshot e usata come mask, così si tinge col tema) più gli
// archi che partono dalla località corrente verso le destinazioni.
export function MappaViaggi({ viaggi, fuso, altezza }: Props) {
  const casa = LUOGO_FUSO[fuso] ?? null
  const p0 = casa ? proietta(casa.lat, casa.lon) : null
  const mete = viaggi
    .filter((v) => v.luogo)
    .map((v) => ({ v, p: proietta(v.luogo!.lat, v.luogo!.lon) }))
    // Una sola meta per destinazione: due viaggi a Milano non fanno due archi.
    .filter((m, i, arr) => arr.findIndex((x) => x.p.x === m.p.x && x.p.y === m.p.y) === i)

  return (
    <div
      className="relative w-full"
      style={altezza ? { height: altezza } : { aspectRatio: `${MAPPA.w} / ${MAPPA.h}` }}
    >
      {/* Terraferma: l'immagine fa da maschera, il colore viene dal tema */}
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--linea-2)',
          WebkitMaskImage: 'url(/mappa-mondo.png)',
          maskImage: 'url(/mappa-mondo.png)',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      />

      <svg
        viewBox={`0 0 ${MAPPA.w} ${MAPPA.h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {p0 &&
          mete.map(({ v, p }) => {
            const ax = (p0.x / 100) * MAPPA.w
            const ay = (p0.y / 100) * MAPPA.h
            const bx = (p.x / 100) * MAPPA.w
            const by = (p.y / 100) * MAPPA.h
            // Arco: controllo sopra il punto medio, curvatura proporzionale
            // alla distanza (rotte lunghe = arco più alto).
            const d = Math.hypot(bx - ax, by - ay)
            const cx = (ax + bx) / 2
            const cy = Math.min(ay, by) - d * 0.26
            return (
              <path
                key={v.id}
                d={`M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`}
                fill="none"
                stroke="var(--primario)"
                strokeWidth={1.3}
                strokeLinecap="round"
                opacity={0.55}
              />
            )
          })}

        {p0 && <Marker x={(p0.x / 100) * MAPPA.w} y={(p0.y / 100) * MAPPA.h} casa />}
        {mete.map(({ v, p }) => (
          <Marker key={v.id} x={(p.x / 100) * MAPPA.w} y={(p.y / 100) * MAPPA.h} />
        ))}
      </svg>
    </div>
  )
}

function Marker({ x, y, casa }: { x: number; y: number; casa?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={casa ? 5 : 4} fill="var(--card)" />
      <circle cx={x} cy={y} r={casa ? 3.4 : 2.7} fill="var(--primario)" />
    </g>
  )
}
