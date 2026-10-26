# Status — SmartCal (aggiornato 2026-10-26)

## Stato attuale
- Live su https://personal-calendar-puce.vercel.app, in produzione il commit `0de688d` (deploy `personal-calendar-7hkz11ec3`).
  Sezioni: Calendar, Scheduling, Analytics, Trips (con finestre di viaggio), Export, Settings.
- Multi-utente con onboarding, calendari condivisi fra account, promemoria push, ricorrenza, specchio su Google
  Calendar (scope `calendar.app.created`): `google-sync` gira davvero.
- Migrazioni 0001–0016 tutte presenti in produzione (0015-0016 applicate e verificate il 2026-10-26).
- Trips → finestre di viaggio: 11 finestre, 31 proposte, 6 eventi/periodi (seed dal file `11 Viaggi/Finestre_e_proposte.md`
  del 26/10). È la fonte live: il file resta come versione di partenza.
- Token Management API di SmartCal nel Portachiavi come `supabase-management-smartcal` (quello `supabase-management` è di mygoal).

## Ultima cosa fatta
- 2026-10-26: Trips → "lezioni che salti". Ogni finestra e ogni viaggio del calendario mostra le lezioni con orario
  che cadono nelle sue date ("You'll miss: Mon 16/11 SAM 12:30‑15:30, DAFM 15:30‑18:30 (6 h)"), la frequenza del mese
  contro il 90% e le ore per corso contro il 10%, sommando i viaggi Booked/To book e quelli in calendario; sotto il 90%
  "Below 90%", senza lezioni "No classes missed". Editor e trascinamento di un evento Travel sopra lezioni chiedono
  "Save anyway" (`src/lib/frequenza.ts`, `AvvisoLezioni.tsx`). Fix: un buco senza lezione prima o dopo (fine del
  planning) non è più proposto come finestra. Verificato: build, lint, test a mano con le date del DB, WebKit 380px e
  desktop chiaro/scuro. Il bug "una sola finestra A 22/10→2/03" su iPhone era l'account Ila (musacchio.ila@), non Safari.
- 2026-10-26: finestre di viaggio in Trips (`8aa9894`). Tabelle `travel_windows`/`travel_proposals`/`travel_events`
  con RLS select/insert/update (niente delete), RPC `finestre_libere` (invoker, solo authenticated). Banner "Book now",
  confronto col planning che propone e non applica, timeline fino al 3/03, card con stato e proposte, fasce di sfondo
  in Month/Week, badge scadenze (<7 giorni) su Trips. Verificato: build, lint, verifica-ui 380px/desktop chiaro/scuro
  (0 overflow, 0 target <44, 0 contrasto), RLS provata come anon e altro utente, vista vera in produzione dal Chrome
  di Andrea. Cancellati i 12 eventi 🧳/✈️/💛 dal Google principale (ID in `_MEMORIA/Calendario_inserito.md`).

## Prossima azione
- Prenotare BKK (deadline oggi) e decidere A, LK, C2 entro il 30/10: lo stato si cambia in Trips.
- Confermare a lezione l'ora di fine di SAM 16/10 e 20/10 (vedi ❓ sotto), poi correggere gli eventi.

## Decisioni aperte
- Account Ila: finestra sbagliata "A" 22/10→2/03 (132 giorni, Booked) creata con "Add" prima del fix. Niente delete
  da app/RLS: o "Skipped" dal suo telefono, o DELETE via SQL con backup e ok di Andrea. Da lei contano come lezioni
  anche "Burci" e "Sistemare appunti" (categoria università).
- Vista Month: i viaggi di più giorni non si trascinano (solo da Week o dall'editor). Riga volo nella card viaggio a 40px.
- ⚠️ Advisor Supabase: molte funzioni `SECURITY DEFINER` eseguibili da anon (es. `sostituisci_eventi_sorgente` con
  `p_utente`), 4 funzioni con search_path mutabile, protezione password compromesse spenta. Da rivedere in un task a parte.
- Titolo con caratteri rotti nel DB: "Esame â€" M&A / CV" (mojibake preesistente).
- Recap email settimanale (sospeso): provider (Resend con dominio / Brevo), contenuto, orario di invio.
- Google Meet via `spaces.create`: verificare prima che l'account Google sia abilitato.
- Privacy e termini scritti da Claude, mai rivisti da un legale; DB a Singapore = trasferimento extra-UE da dichiarare.
- Conferma email disattivata (niente SMTP): se serve, SMTP custom e `mailer_autoconfirm: false`.
- Rimandati: avvisi di conflitto, selettore di posizione per giorno (`posizioni_giorno` inutilizzata).
- ❓ SAM 16/10 (fine 14:00) e 20/10 (fine 17:00): durate 4,5 h dal planning, ora di fine da confermare a lezione.
