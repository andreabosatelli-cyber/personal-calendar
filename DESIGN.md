# DESIGN.md — SmartCal

## Fonte di verità

Il design **non** si inventa: la reference è lo screenshot `smartcal.png`
(fornito dall'utente, copia in `Downloads/`). I valori qui sotto sono
**campionati dai pixel** di quella schermata, non scelti a occhio.

Regola: se il codice e la reference sono in conflitto sul piano visivo, vince
la reference; se sono in conflitto sul piano funzionale, vince il codice.
Le schermate che nella reference non si vedono (Analytics, Trips, Scheduling,
Export, form evento, login) usano **lo stesso linguaggio**, non un altro.

## Register & theme

Register: **product**. Prodotto SaaS premium, leggero, molto whitespace —
famiglia Linear / Notion Calendar / Cron, ma la reference resta il riferimento
principale.

Tema primario **light**. Il tema scuro resta come controparte degli stessi
ruoli (era già nell'app), ma il default è chiaro e non segue più il sistema.

## Palette (campionata dalla reference)

| Ruolo | Valore | Dove |
| --- | --- | --- |
| Sfondo pagina | `#fbfcfe` | area contenuto |
| Sidebar | `#f4f3fe` | colonna sinistra, lavanda |
| Card | `#ffffff` | calendario, card del pannello |
| Controllo | `#f1f2f9` | search bar, campi, track |
| Voce attiva | `#e9e2fd` | menu selezionato |
| Viola tenue | `#f3f1fe` | bottoni secondari (Export) |
| Primario | `#6728fc` | New event, pill attiva, badge oggi |
| Primario scuro | `#5a1dfa` | stato premuto, fondo del gradiente |
| Testo | `#16162e` | dark navy |
| Testo 2 / 3 | `#6a7191` / `#9aa1b9` | secondario, terziario |
| Linea | `#eef0f7` | hairline card e griglia |

### Categorie evento

Colore funzionale, mai decorativo. `punto` è il pallino pieno, `bg` il blocco.

| Categoria | punto | sfondo | testo |
| --- | --- | --- | --- |
| Work (lavoro) | `#3488fd` | `#e4f0fd` | `#1a5cb0` |
| University / Study | `#9551fc` | `#eae5fd` | `#5c2bbd` |
| Personal | `#feb315` | `#fdf3e0` | `#8f6206` |
| Travel (viaggi) | `#fe6d7a` | `#fcedf3` | `#bd3a54` |

Tinte pastello, mai sature. Tutti i valori vivono in `src/index.css` come
variabili CSS; i componenti non scrivono colori a mano.

## Typography

`Inter` (Google Fonts) con fallback di sistema. `tabular-nums` sempre attivo:
la pagina è piena di orari. Tracking leggermente negativo (-0.01em, -0.026em
sui titoli). Scala: titolo calendario 26px/700, titolo card 16px/700, corpo
14.5px, blocchi evento 12px/600 + 11px per l'orario.

## Layout (misure della reference a 1536px)

- Sidebar fissa **268px**, sfondo lavanda, hairline a destra.
- Header **92px**, ricerca 500×42 a sinistra, campanella + località a destra.
- Contenuto: padding sinistro 20, gap 21, padding destro 16.
- Card calendario: flessibile; colonna destra **335px**.
- Card: radius **18px**, `1px` di bordo `--linea`, ombra quasi impercettibile.
- Controlli: radius 11–14px. Blocchi evento: radius 8px.

Sotto i 1024px la sidebar diventa un drawer; la testata del calendario manda i
controlli a capo via container query (`@[720px]`).

## Componenti

Le primitive stanno in `@layer components` dentro `index.css` — devono restare
nel layer, altrimenti battono le utility Tailwind:
`.card`, `.seg` / `.seg-item`, `.nav-voce`, `.btn-primario`, `.btn-tenue`,
`.btn-neutro`, `.campo`, `.spunta`, `.scroll-fine`, `.premibile`.

## Motion

Transizioni brevi, ease-out esponenziale, niente bounce. Mai animare proprietà
di layout: solo transform/opacity. `prefers-reduced-motion` rispettato.

## Bans

- Gradienti aggressivi, glassmorphism, neon, dark UI come default.
- Card enormi o dashboard dense.
- Colori saturi sugli eventi.
- Reinterpretare la reference: quando c'è un dubbio estetico vince la
  soluzione più simile allo screenshot.
