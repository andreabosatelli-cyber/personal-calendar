// Set di icone SVG stroke, stile della reference SmartCal: tratto 1.7,
// terminazioni tonde, nessun riempimento, colore ereditato da currentColor.
// Niente libreria esterna: sono una dozzina di path, non vale una dipendenza.

interface P {
  size?: number
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

function Svg({ size = 20, className, strokeWidth = 1.7, style, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconaCalendario(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="3.5" />
      <path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4" />
      <path d="M7.6 13.6h3.2v3.2H7.6z" fill="currentColor" stroke="none" opacity="0.9" />
    </Svg>
  )
}

export function IconaScheduling(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 12h17.6M12 3.2c2.3 2.4 3.5 5.5 3.5 8.8s-1.2 6.4-3.5 8.8c-2.3-2.4-3.5-5.5-3.5-8.8S9.7 5.6 12 3.2Z" />
    </Svg>
  )
}

export function IconaAnalytics(p: P) {
  return (
    <Svg {...p}>
      <path d="M4.5 20V13M9.5 20V7.5M14.5 20v-9M19.5 20V4.5" />
    </Svg>
  )
}

export function IconaAereo(p: P) {
  return (
    <Svg {...p}>
      <path d="M17.8 3.3a2 2 0 0 1 2.9 2.9l-3.6 3.6 1.3 8.4-2 2-3.1-6.9-3.3 3.3.3 2.8-1.5 1.5-1.7-3.3-3.3-1.7 1.5-1.5 2.8.3 3.3-3.3-6.9-3.1 2-2 8.4 1.3 3.6-3.6Z" />
    </Svg>
  )
}

export function IconaDocumento(p: P) {
  return (
    <Svg {...p}>
      <path d="M14 3.2H7.5A2.5 2.5 0 0 0 5 5.7v12.6a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5V8.2L14 3.2Z" />
      <path d="M13.8 3.4v4.3a1 1 0 0 0 1 1h4.1" />
    </Svg>
  )
}

export function IconaPiu(p: P) {
  return (
    <Svg strokeWidth={2.2} {...p}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  )
}

export function IconaCerca(p: P) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m16 16 4.2 4.2" />
    </Svg>
  )
}

export function IconaCampana(p: P) {
  return (
    <Svg {...p}>
      <path d="M18 8.6a6 6 0 1 0-12 0c0 5.3-1.6 6.9-1.6 6.9h15.2S18 13.9 18 8.6Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </Svg>
  )
}

export function IconaGlobo(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.2 12h17.6" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8.8" />
    </Svg>
  )
}

export function IconaChevron({ verso = 'giu', ...p }: P & { verso?: 'su' | 'giu' | 'sx' | 'dx' }) {
  const d = {
    giu: 'm6.5 9.5 5.5 5.5 5.5-5.5',
    su: 'm6.5 14.5 5.5-5.5 5.5 5.5',
    sx: 'm14.5 6.5-5.5 5.5 5.5 5.5',
    dx: 'm9.5 6.5 5.5 5.5-5.5 5.5',
  }[verso]
  return (
    <Svg strokeWidth={2} {...p}>
      <path d={d} />
    </Svg>
  )
}

export function IconaVideo(p: P) {
  return (
    <Svg {...p}>
      <rect x="2.6" y="6.2" width="12.8" height="11.6" rx="3" />
      <path d="m15.4 13.2 5 3.1a.6.6 0 0 0 .9-.5V8.2a.6.6 0 0 0-.9-.5l-5 3.1Z" />
    </Svg>
  )
}

export function IconaLuogo(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 21.2s7-5.5 7-11.1a7 7 0 1 0-14 0c0 5.6 7 11.1 7 11.1Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  )
}

export function IconaImpostazioni(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.6 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.7-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.1-2.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
    </Svg>
  )
}

export function IconaScarica(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3.8v11M7.6 10.4 12 14.8l4.4-4.4" />
      <path d="M4.5 17.2v1.6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.6" />
    </Svg>
  )
}

export function IconaSpunta(p: P) {
  return (
    <Svg strokeWidth={2.6} {...p}>
      <path d="m5 12.5 4.6 4.6L19 7.7" />
    </Svg>
  )
}

export function IconaChiudi(p: P) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  )
}

export function IconaAggiorna(p: P) {
  return (
    <Svg {...p}>
      <path d="M20 11.5A8 8 0 1 0 18.4 17" />
      <path d="M20.4 4.6v5h-5" />
    </Svg>
  )
}

export function IconaCondividi(p: P) {
  return (
    <Svg {...p}>
      <path d="M10 13.2a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.6-5.6l-1.4 1.4" />
      <path d="M14 10.8a4 4 0 0 0-6-.5l-2.5 2.5a4 4 0 0 0 5.6 5.6l1.4-1.4" />
    </Svg>
  )
}

export function IconaOrologio(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8V12l3.4 2" />
    </Svg>
  )
}

export function IconaRipeti(p: P) {
  return (
    <Svg {...p}>
      <path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.4l2.2 2.1" />
      <path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.4l-2.2-2.1" />
      <path d="M19.8 4.6v4.4h-4.4M4.2 19.4V15h4.4" />
    </Svg>
  )
}

export function IconaSole(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
    </Svg>
  )
}

export function IconaLuna(p: P) {
  return (
    <Svg {...p}>
      <path d="M20.5 14.4A8.8 8.8 0 0 1 9.6 3.5a8.8 8.8 0 1 0 10.9 10.9Z" />
    </Svg>
  )
}

export function IconaEsci(p: P) {
  return (
    <Svg {...p}>
      <path d="M9.5 20.2H6.4a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2h3.1" />
      <path d="M15.4 16.2 19.6 12l-4.2-4.2M19.2 12H9.2" />
    </Svg>
  )
}

// Pastiglie provider dei calendari collegati (Outlook / Google), come nella
// reference: quadratino bianco con il glifo del servizio.
export function LogoOutlook({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="4" width="13" height="16" rx="2.6" fill="#0F6CBD" />
      <path
        d="M7.5 8.4c-1.9 0-3.1 1.4-3.1 3.6s1.2 3.6 3.1 3.6 3.1-1.4 3.1-3.6-1.2-3.6-3.1-3.6Zm0 5.8c-.9 0-1.4-.8-1.4-2.2s.5-2.2 1.4-2.2 1.4.8 1.4 2.2-.5 2.2-1.4 2.2Z"
        fill="#fff"
      />
      <path d="M14 7.6h8.2c.4 0 .8.4.8.8v7.2c0 .4-.4.8-.8.8H14V7.6Z" fill="#28A8EA" />
      <path d="M23 8.6v.5l-4.5 3-4.5-3v-.5l4.5 3 4.5-3Z" fill="#fff" opacity=".85" />
    </svg>
  )
}

export function LogoGoogle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9Z" fill="#EA4335" />
    </svg>
  )
}
