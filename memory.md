# Memory — SmartCal

Decisioni stabili, una riga ciascuna, dalla più vecchia.

- 2026-08-20 — Feed ICS di Outlook in sola lettura, importato da Edge Function con full-replace atomico (`sostituisci_eventi_sorgente`).
- 2026-08-20 — Import npm nelle Edge Functions (`npm:ical.js`, `npm:@supabase/supabase-js`), non esm.sh: esm.sh faceva crashare la function.
- 2026-09-04 — Lezioni universitarie da Excel come seed SQL (`0003`), in ora di Singapore (`fuso_origine='Asia/Singapore'`), read-only.
- 2026-09-04 — Manuale ⇔ `id_esterno IS NULL`: la sync ICS cancella solo gli importati, mai gli eventi creati a mano.
- 2026-09-04 — Pagina pubblica di prenotazione tramite RPC `security definer` + token; il visitatore vede solo "occupato".
- 2026-09-04 — Export PDF con `window.print()` e CSS `@media print`, senza librerie.
- 2026-09-08 — Offline: guscio + lettura (cache in localStorage), NON scrittura offline (niente coda di invio).
- 2026-09-08 — Soggiorni = eventi `viaggi` tutto-il-giorno su più giorni; `fine_utc` è mezzanotte esclusiva.
- 2026-09-08 — Finestra griglia 06–24, scende a 00 solo se nel periodo visibile c'è un evento notturno.
- 2026-09-08 — I soggiorni non cambiano il fuso dell'asse: il rail orario è unico per tutte le colonne.
- 2026-09-09 — Redesign SmartCal: `smartcal.png` è specifica, non ispirazione. UI in inglese, tema chiaro di default.
- 2026-09-09 — Viste Day/Week/Month (tolta la vista 3 giorni, la reference non ce l'ha).
- 2026-09-09 — Analytics: ore ritagliate sul secchio, giornata contata dalle 04:00, delta senza verde/rosso.
- 2026-09-12 — Multi-utente: categorie fisse ma rinominabili, niente ICS per gli altri utenti, fusi configurabili per utente.
- 2026-09-12 — La Edge Function `sync-calendari` esce subito se `preferenze.sync_abilitato` è falso (default).
- 2026-09-12 — Conferma email disattivata (`mailer_autoconfirm: true`) perché il progetto non ha SMTP.
- 2026-09-14 — Calendari condivisi a tre livelli (`occupato` / `dettagli` / `prenota`); `prenota` crea solo richieste `in_attesa`.
- 2026-09-14 — Il cron dei promemoria chiama la function con la anon key, non la service_role.
- 2026-09-14 — Recap email sospeso su richiesta; se si riprende, i conti si fanno in SQL.
- 2026-09-18 — Ricorrenza come righe vere legate da `serie_id`, generate fino a 24 mesi, allungate ogni notte.
- 2026-09-18 — Google in una sola direzione: SmartCal scrive, Google legge.
- 2026-09-19 — Scope Google `calendar.app.created` (non sensibile): calendario "SmartCal" dedicato, app pubblicata senza verifica.
- 2026-09-26 — Migrazioni via Management API con ok esplicito di Andrea; mai `supabase db push`.
- 2026-09-26 — La service_role serve solo nelle Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`, iniettata da Supabase): mai in `.env.local` né su Vercel.
- 2026-09-27 — Redesign in stile trends (libreria ~/.claude/design), chiesto da Andrea: solo aspetto, token con i nomi storici; niente shadcn vero (le primitive CSS restano); barra in basso su mobile nel flusso, non fixed; delta di Analytics restano neutri.
- 2026-09-27 — Vercel Preview ha VITE_SUPABASE_URL/ANON_KEY (tipo Config: le VITE_ non possono essere Secret; stessi valori di Production). Le anteprime puntano al DB di produzione.
- 2026-10-02 — Target tattili ≥ 44px su touch (`pointer: coarse`): barre tutto-il-giorno a 44px in Week/Day; in Month su telefono la barra è solo un segno (come i pallini) e il tocco va alla cella del giorno. Desktop invariato.
- 2026-10-12 — Lezioni SIM = planning GEM del 6/10 (xlsx nella cartella Singapore). Correzioni come righe `gem0610:*` + modifiche a `ttv3:*`; il seed 0003 non va più rilanciato (ora è protetto). Su 409 `google-sync` riprende l'id esistente, non ne crea uno nuovo.
- 2026-10-26 — Lezioni SIM = planning GEM del 22/10 (sostituisce quello del 6/10). Correzioni come righe `gem2210:*` + modifiche a `ttv3:*`; gli importati arrivano su Google via riconciliazione (`google_importati`, id deterministici), quindi basta scrivere nel DB.
- 2026-10-26 — Finestre di viaggio = tabelle proprie (`travel_windows`/`travel_proposals`/`travel_events`), NON eventi: in calendario sono fasce di sfondo, cosi' non finiscono su Google ne' nell'export. Sostituiscono i 12 eventi a mano sul Google principale.
- 2026-10-26 — "Lezione" per le finestre = evento `universita` con orario: le scadenze di un giorno intero (CAV…) non contano. Giorni in ora di Singapore.
- 2026-10-26 — Il confronto col planning propone e basta (Apply/Ignore): non tocca mai stato e note. Le finestre manuali (BKK, LK, C3) si controllano solo per lezioni nuove dentro; `salta_lezioni` tiene i giorni saltati di proposito.
- 2026-10-26 — Policy finestre senza delete: una finestra non si cancella, si segna 'saltato'.
- 2026-10-26 — Token Management API di SmartCal nel Portachiavi come `supabase-management-smartcal` (`supabase-management` e' dell'account di mygoal).
