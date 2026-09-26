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
