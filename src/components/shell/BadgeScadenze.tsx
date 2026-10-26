// Numero di finestre di viaggio con la data "prenotare entro" a meno di 7
// giorni o gia' superata. Nella sidebar sta in fondo alla riga; nella barra in
// basso (solo icone) si appoggia sopra l'icona, e lo dice gia' l'aria-label
// del pulsante.
export function BadgeScadenze({ n, sopra }: { n: number; sopra?: boolean }) {
  if (sopra) {
    return (
      <span aria-hidden="true" className="badge-scadenze badge-scadenze-sopra tabular-nums">
        {n}
      </span>
    )
  }
  return (
    <span className="badge-scadenze ml-auto tabular-nums">
      {n}
      <span className="sr-only"> booking deadlines</span>
    </span>
  )
}
