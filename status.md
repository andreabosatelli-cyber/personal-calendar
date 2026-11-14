# Status — SmartCal (aggiornato 2026-11-14)

## Stato attuale
- Live su https://personal-calendar-puce.vercel.app, in produzione il commit `0de688d` (deploy `personal-calendar-7hkz11ec3`).
  Sezioni: Calendar, Scheduling, Analytics, Trips (con finestre di viaggio), Export, Settings.
- Multi-utente con onboarding, calendari condivisi fra account, promemoria push, ricorrenza, specchio su Google
  Calendar (scope `calendar.app.created`): `google-sync` gira davvero.
- Migrazioni 0001–0017 tutte presenti in produzione (0017 `google_sync_lock` applicata e verificata il 2026-11-13).
- Trips → finestre di viaggio: 11 finestre, 31 proposte, 6 eventi/periodi (seed dal file `11 Viaggi/Finestre_e_proposte.md`
  del 26/10). È la fonte live: il file resta come versione di partenza.
- Token Management API di SmartCal nel Portachiavi come `supabase-management-smartcal` (quello `supabase-management` è di mygoal).

## Ultima cosa fatta
- 2026-11-14: life-os ha ora anche Google (collega/pausa), link pubblico, Analytics ed Export PDF (stesse funzioni, confronto
  20/20 in produzione): per Andrea SmartCal non serve più aprirlo, ma resta online (database, Edge Functions, cron e i link
  di prenotazione già dati). Codice e database di SmartCal non toccati (solo righe di prova, cancellate).
- 2026-11-14: **google-sync, copia orfana** (commit e7c6281, deployata con `--use-api --yes`): se l'evento viene cancellato
  mentre la copia nasce su Google, l'update di google_id non trova righe → DELETE subito della copia (voce di delete in coda
  se Google non risponde). Risposta con `orfani: n`. Prova da life-os: 30 eventi, 19 casi colpiti, 0 copie rimaste;
  carico 20 eventi 0 doppioni. Cancellati i 2 dubbi su Google (backup in life-os/backup). Trigger e migrazioni non toccati.
- 2026-11-14: nota — `sync-calendari` NON ha un cron: parte all'avvio dell'app (stato.tsx). Ora lo avvia anche il
  calendario di life-os all'apertura.
- 2026-11-13: **google-sync con lock** (0017 + Edge Function deployata con `supabase functions deploy --use-api`, commit
  2df8af2): riga unica `google_sync_lock` presa con update condizionato (scadenza 150 s), attesa fino a 25 s, altrimenti
  `{occupato:true}`; `finally` la rilascia. Prova di carico da life-os (20 salvataggi ravvicinati): 29 doppioni prima, 0 dopo.
  34 orfani certi cancellati dal calendario Google "SmartCal" (backup in life-os/backup). Restano 2 dubbi: "Meeting ricorrente
  Reteero" 16/12 e "(untitled)" 15/11, elencati nello status di life-os. Limite residuo risolto il 14/11 (vedi sopra).
- 2026-11-13: life-os ha ora anche richieste, prenota su condiviso, Trips, push e impostazioni (stesse scritture, 16/16).
  In SmartCal restano solo: Google connect/pausa, link pubblico, ICS, Analytics, Export PDF. Codice frontend non toccato.
- 2026-11-13 (da life-os, solo dati, nessun deploy): caratteri rotti "SIM Â· Singapore" (70 luoghi) e "Esame â€" M&A / CV"
  riparati sulle righe `ttv3:*` di Andrea (backup in life-os/backup/20261113-mojibake-*.json). Causa: il seed 0003 era stato
  applicato con la codifica sbagliata il 2026-09-04 (il file è UTF-8 corretto); l'import ICS legge UTF-8 e non c'entra.
  Copie Google future riallineate; quelle passate restano col testo vecchio.
- 2026-11-13: life-os ora crea/modifica/trascina/cancella eventi con le stesse scritture di SmartCal (confronto 9/9).
- 2026-11-11: lezioni SIM allineate al planning GEM del 29/10 (solo dati, nessun deploy). ARM: 30/11 cancellata, 2/12 a
  12:30-15:30, 8/12 nuova (`gem2910:1`), docente Lawrence Lee nelle descrizioni; Ethics & ESG 3/12 = "In-class Test".
  Backup `eventi_backup_20261111` (6 righe). Finestra C1 portata a 9-20/12 (12 giorni), backup
  `travel_windows_backup_20261111`. Verificato: 63 lezioni dal 3/11 = xlsx nel DB e sulla copia Google, 0 doppioni.
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
- Nessuna fissata. Stato dei viaggi (BKK, A, LK, C2…) sempre in Trips.

## Decisioni aperte
- Account Ila: finestra sbagliata "A" 22/10→2/03 (132 giorni, Booked) creata con "Add" prima del fix. Niente delete
  da app/RLS: o "Skipped" dal suo telefono, o DELETE via SQL con backup e ok di Andrea. Da lei contano come lezioni
  anche "Burci" e "Sistemare appunti" (categoria università).
- Vista Month: i viaggi di più giorni non si trascinano (solo da Week o dall'editor). Riga volo nella card viaggio a 40px.
- ⚠️ Advisor Supabase: molte funzioni `SECURITY DEFINER` eseguibili da anon (es. `sostituisci_eventi_sorgente` con
  `p_utente`), 4 funzioni con search_path mutabile, protezione password compromesse spenta. Da rivedere in un task a parte.
- Recap email settimanale (sospeso): provider (Resend con dominio / Brevo), contenuto, orario di invio.
- Google Meet via `spaces.create`: verificare prima che l'account Google sia abilitato.
- Privacy e termini scritti da Claude, mai rivisti da un legale; DB a Singapore = trasferimento extra-UE da dichiarare.
- Conferma email disattivata (niente SMTP): se serve, SMTP custom e `mailer_autoconfirm: false`.
- Rimandati: avvisi di conflitto, selettore di posizione per giorno (`posizioni_giorno` inutilizzata).
