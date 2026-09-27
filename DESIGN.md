# DESIGN.md — SmartCal

## Fonte di verità

Da settembre 2026 (branch `redesign-trends`) SmartCal usa lo stile **trends** della libreria di Andrea:
`~/.claude/design/styles/trends.md`, reference `~/.claude/design/references/performance-trends.png`.
Il vecchio design viola (reference `smartcal.png`) è superato.

Regola: sul piano visivo vince trends; sul piano funzionale vince il codice. Il redesign ha cambiato
solo l'aspetto: nessun hook, query o flusso è cambiato.

## Carattere

- Superfici grigio chiarissimo su bianco caldo, **card senza bordi né ombre**, angoli molto morbidi.
- Azioni e stato attivo come **pillole nere**. Voce attiva di un segmented control in pillola bianca su track grigio.
- Numeri grandi e leggeri (Geist 500, tracking stretto). Mai grassetti pesanti: pesi 400/500, 600 solo nei badge.
- Colore solo con un ruolo: categorie evento, errori, notifiche. Niente viola, niente gradienti decorativi.

## Token

Tutti in `src/index.css`, in OKLCH, con i nomi storici dell'app (i componenti li usano già).
Fra parentesi il ruolo shadcn corrispondente.

| Token | Chiaro | Ruolo |
| --- | --- | --- |
| `--pagina` | `oklch(0.995 0.001 90)` | sfondo (background), anche sheet e popover |
| `--card` | `oklch(0.962 0.002 90)` | card (card) |
| `--controllo` / `--tenue` | `oklch(0.93 0.003 90)` | campi, track, bottoni grigi (secondary) |
| `--attivo` | `oklch(0.99 0 0)` | pillola attiva bianca (accent) |
| `--testo` | `oklch(0.19 0.003 90)` | testo (foreground) |
| `--testo-2` / `--testo-3` | `0.47` / `0.5` | secondario, meta (muted-foreground) |
| `--primario` | `oklch(0.19 0.003 90)` | pillole nere (primary) |
| `--errore` | `oklch(0.53 0.19 27)` | destructive |

Il tema scuro ha gli stessi ruoli con le luminosità invertite: le pillole diventano chiare.
Token nuovi: `--velo` (sfondo dietro sheet e drawer), `--ombra-galleggia` (solo elementi che
galleggiano), `--up`/`--down` (badge variazione), `--notifica`, `--avatar-*`, `--nav-*` (barra in basso).

### Categorie evento

Restano quattro tinte distinte, perché servono a riconoscere l'evento, rese pastello in OKLCH.
Work blu 250°, Study viola 300°, Personal ambra 75°, Travel rosa 22°. Ogni categoria ha `punto`
(pallino), `bg` (blocco) e `fg` (testo sul blocco). I calendari condivisi seguono la stessa regola.

### Contrasto

Verificato con uno script sui token: tutti i testi sono almeno AA (4.5:1) su `--pagina`, `--card`
e `--controllo`, e `fg` su `bg` di ogni categoria, in entrambi i temi. Niente opacità sui testi
dei blocchi evento.

## Tipografia

Geist (Google Fonts) con fallback di sistema, `tabular-nums` sempre attivo.
Scala:
- titoli di pagina 22px (mobile), 26–28px (desktop)
- titoli card 20px (17px nella colonna destra da 335px)
- KPI 40px (mobile), 48px (desktop), classe `.numero-kpi`
- corpo 14–15px, meta 12.5–13.5px
- nessuna etichetta in maiuscolo spaziato

## Layout

- Desktop: sidebar 268px sullo stesso bianco della pagina, senza bordo. Header 92px. Colonna destra 335px.
- Card con padding 20px (mobile) e 24px (desktop), gap 16px, raggio 24px.
- **Mobile (< 1024px)**:
  - una colonna
  - header con bottoni tondi grigi da 44px (menu, cerca, notifiche, località) e il "+" nero
  - barra di navigazione in basso (`shell/BarraNav.tsx`): pillola nera con Calendar, Scheduling, Analytics, Trips e More
  - More apre lo stesso drawer dell'hamburger, dove restano Export, Settings, calendari e account
  - la barra è un elemento del flusso, non `fixed`: il contenuto finisce sempre sopra di lei; il margine in basso usa `env(safe-area-inset-bottom)`
- Target tattili di almeno 44px su tutti i controlli.

## Componenti

Le primitive stanno in `@layer components` dentro `index.css`, e devono restare nel layer, altrimenti
battono le utility Tailwind:
- `.card`, `.seg` / `.seg-item`, `.nav-voce`
- `.btn-primario` (pillola nera), `.btn-tenue` (pillola grigia), `.btn-neutro` (tondo o pillola grigia)
- `.campo`, `.spunta` (tonda), `.numero-kpi`, `.scroll-fine`, `.premibile`

Il focus è visibile con un outline di 2px `--primario`. Il marchio in-app è `Marchio.tsx` (cerchio nero
con calendario). Le icone PWA in `public/` sono ancora quelle viola.

Calendario:
- oggi in cerchio nero
- giorni del mese in cerchi `--pagina` sulla card grigia
- giorno selezionato in pillola bianca

## Motion

Transizioni brevi, ease-out, niente bounce. Si animano solo transform e opacity.
`prefers-reduced-motion` rispettato.

## Bans

- Viola, gradienti, glassmorphism, ombre sulle card, bordi laterali colorati come accento.
- Maiuscolo spaziato nelle etichette, grassetti pesanti.
- Verde/rosso sui delta di Analytics: più ore non è né bene né male (decisione 2026-09-09). I token
  `--up`/`--down` esistono per usi futuri ma non si usano lì.
