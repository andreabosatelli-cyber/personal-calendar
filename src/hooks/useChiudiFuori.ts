import { useEffect, useRef } from 'react'

// Chiude un pannello aperto quando si tocca fuori dal suo contenitore, o con
// Esc. Sta qui e non nel componente perché il pannello che apre e quello che
// deve restare "dentro" non sono sempre lo stesso elemento.
export function useChiudiFuori(onChiudi: () => void, attivo: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!attivo) return
    const giu = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onChiudi()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi()
    document.addEventListener('mousedown', giu)
    document.addEventListener('touchstart', giu)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', giu)
      document.removeEventListener('touchstart', giu)
      document.removeEventListener('keydown', esc)
    }
  }, [onChiudi, attivo])
  return ref
}
