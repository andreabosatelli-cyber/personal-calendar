# SmartCal (personal-calendar)

Calendario multi-utente a doppio fuso orario (nato per Singapore ↔ Roma): asse locale, secondo fuso a fianco,
link pubblico di prenotazione, calendari condivisi, Analytics, Trips, Export PDF, specchio su Google Calendar.

## Stack
- React 19.2 + TypeScript 6 + Vite 8, Tailwind CSS 4, PWA (vite-plugin-pwa, manifest scritto a mano in `public/`)
- Supabase (Postgres + Auth + Edge Functions + pg_cron), progetto ref `qwhsniusmhysehudxfqv` (regione Singapore)
- Luxon per i fusi, ical.js nelle Edge Functions. Nessuna libreria UI né di icone (SVG in `src/lib/icone.tsx`)

## Comandi
- `npm run dev` · `npm run build` (= `tsc -b && vite build`) · `npm run lint` (oxlint) · `npm run preview`
- Nessuna suite di test: niente TDD qui.
- Edge Functions: `npx supabase functions deploy <nome> --project-ref qwhsniusmhysehudxfqv`
  con `SUPABASE_ACCESS_TOKEN` nell'ambiente (lo fornisce Andrea, mai scriverlo nei file).
  `google-oauth` va deployata con `--no-verify-jwt`.

## Struttura
- `src/lib/` logica pura: `tempo.ts` (fusi, con specchio a runtime delle preferenze), `settimana.ts`, `packing.ts`,
  `analitica.ts`, `statistiche.ts`, `viaggi.ts`, `ricorrenza.ts`, `stato.tsx` (contesto), `types.ts` (tipi DB a mano)
- `src/components/` per sezione: `shell/`, `pannello/`, `analitica/`, `viaggi/`, `scheduling/`, `impostazioni/`
- `supabase/migrations/` numerate `0001`→`0014`; `supabase/functions/`: `sync-calendari`, `promemoria`, `google-oauth`, `google-sync`
- `DESIGN.md` = fonte di verità del design (reference `smartcal.png`), `PRODUCT.md` = contesto per impeccable
- Routing a hash (`#/calendar`, …) in `src/lib/rotte.ts`

## Regole specifiche
- **UI in inglese** (pagina pubblica compresa), locale `en-US`: eccezione alla regola globale sull'italiano.
- Design = fedeltà alla reference, non reinterpretazione. Colori campionati dai pixel, non a occhio.
- Classi CSS custom SEMPRE dentro `@layer components`: fuori dal layer battono le utility Tailwind (`lg:hidden` smette di funzionare).
- Ogni query su `eventi` ancorata a `utente_id`: da 0009 la RLS lascia passare anche gli eventi condivisi da altri.
- Query per intervallo = sovrapposizione (`.lte('inizio_utc', a).gte('fine_utc', da)`), non per inizio.
- Istanti confrontati sempre in millisecondi (`Date.parse`), mai come stringhe (Postgres `+00:00` vs luxon `Z`).
- Eventi manuali ⇔ `id_esterno IS NULL`; importati (ICS lavoro, seed università) sono read-only lato client.
- Categorie fisse (`origine`: personale/lavoro/universita/viaggi), rinominabili per utente. Trips dipende da `viaggi`.
- Pagina pubblica e livello `occupato`: mai titoli né dettagli, solo "Busy". Passano da RPC, non dalla tabella.
- Il feed ICS è solo dell'account owner (`preferenze.sync_abilitato`); gli URL ICS vivono nei secret delle function.
- Scritture: lo stato locale si aggiorna DOPO l'await, mai in modo ottimistico prima.
- `src/lib/analitica.ts` NON va importata nelle Edge Functions (dipende da React): lì i conti si fanno in SQL.
- Ricorrenza: occorrenze come righe vere legate da `serie_id`; il passato di una serie non si riscrive mai.
- Chiavi localStorage con prefisso `pc_` (`pc_tema`, `pc_barra`, `pc_pannello`, `pc_eventi_cache`, …).

## Verifica
1. `npm run build` (include `tsc -b`) e `npm run lint` puliti (i warning preesistenti vanno lasciati).
2. UI: Playwright a 380px e desktop, tema chiaro e scuro. Senza credenziali: harness temporaneo con alias Vite
   su `lib/supabase` → client finto in memoria (regex `/^(\.\.?\/)+(lib\/)?supabase$/`), da cancellare dopo.
3. Dopo il deploy: `curl` dell'alias di produzione e controllo che il bundle servito contenga la modifica.

## Deploy
- Frontend: `vercel --prod` dalla cartella → https://personal-calendar-puce.vercel.app (progetto Vercel `personal-calendar`).
- `vercel.json` tiene `Cache-Control: max-age=0` su `/sw.js` e `/manifest.webmanifest`: non toglierlo.
- Migrazioni: Management API con il mio ok esplicito (mai `supabase db push`: lo storico remoto è vuoto).
