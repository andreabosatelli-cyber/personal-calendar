# Status — SmartCal (aggiornato 2026-10-12)

## Stato attuale
- Live su https://personal-calendar-puce.vercel.app. Redesign SmartCal completo: Calendar, Scheduling,
  Analytics, Trips, Export, Settings.
- Multi-utente con onboarding, calendari condivisi fra account, promemoria push (funzionano su telefono vero),
  ricorrenza, specchio su Google Calendar (scope `calendar.app.created`, app Google pubblicata senza verifica).
- Migrazioni 0001–0014 tutte presenti in produzione, compresa la 0009 (verificato sullo schema il 2026-09-26).
- 2026-09-26: service_role rigenerata da Andrea; sito, lettura dati, login e Edge Function `promemoria` verificati dopo.
- Git: un solo commit di import dal PC (2026-09-21) + `.gitignore` graphify. Nessuna storia precedente.

## Ultima cosa fatta
- 2026-10-12: lezioni SIM allineate al planning GEM del 6/10. Nel DB: 9 cancellate, 5 orari corretti, 10 nuove (`gem0610:*`), con backup in `eventi_backup_20261012` (RLS on). Su Google: tolte 8 copie doppie non tracciate. Verifica: 82 lezioni su Google = xlsx, 0 doppioni. `google-sync` su 409 riprende l'evento esistente (`6b76bbb`) e il tipo VoceCoda include reconcile (`fe4fccd`): deno check ok, function deployata, prova su "Claude meetup" ok (stesso id, nessun doppione). Seed 0003 ora non fa nulla se esistono gia' eventi `universita`.
- 2026-10-02: target tattili a 44px su mobile: segmented Day/Week/Month (`.seg-item` min-height 44), barre "tutto il giorno" alte 44px su touch in Week/Day, in Month su telefono la barra è decorativa e il tocco apre il giorno. Verificato con verifica-ui (3 viste × 380px/desktop × chiaro/scuro: 0 target < 44, 0 contrasto, niente overflow) e tap reale su telefono emulato. Build ok, lint invariato (13 warning preesistenti). LIVE in produzione dal 2026-10-02 (commit `66d4621`, deploy `personal-calendar-9xteypmn5`): bundle servito controllato.
- 2026-09-27: redesign grafico in stile **trends**, mergiato in `main` e LIVE in produzione:
  token OKLCH, Geist, pillole nere, card senza bordi, barra di navigazione in basso su mobile.
  Verificato: build ok, lint invariato, contrasto AA dei token, 34 azioni Playwright ok prima e dopo.
  Poi: icone PWA rifatte (Marchio in cerchio nero), CLAUDE.md aggiornato allo stile trends.
  Anteprima Vercel: https://personal-calendar-jnghp7raa-an-s-projects1.vercel.app (usa il DB di produzione).
- 2026-09-26: CLAUDE.md, status.md e memory.md del progetto; verifica migrazioni e chiavi.
- 2026-09-19: scope Google ridotto a `calendar.app.created`, migration 0014, pagine `privacy.html` e `terms.html`.

## Prossima azione
1. Andrea: Settings → Connect Google Calendar (il click di consenso lo può fare solo lui).
2. Test end-to-end: creare un evento → `google-sync` → `eventi.google_id` valorizzato → evento visibile su Google.
   La sincronizzazione non è mai girata per davvero.

## Decisioni aperte
- ⚠️ Bug `google-sync`: `corpoGoogle` manda `description: undefined` se la descrizione è vuota, quindi svuotare un campo non arriva mai su Google (stesso rischio per `location`). Fix proposto: mandare stringa vuota. Non applicato.
- Recap email settimanale (sospeso): provider (Resend con dominio / Brevo), contenuto, orario di invio.
- Google Meet via `spaces.create`: verificare prima che l'account Google sia abilitato.
- Privacy e termini scritti da Claude, mai rivisti da un legale; DB a Singapore = trasferimento extra-UE da dichiarare.
- Conferma email disattivata (niente SMTP): se serve, SMTP custom e `mailer_autoconfirm: false`.
- Rimandati: avvisi di conflitto, selettore di posizione per giorno (`posizioni_giorno` inutilizzata).
- ❓ SAM 16/10 (fine 14:00) e 20/10 (fine 17:00): durate 4,5 h dal planning, ora di fine da confermare a lezione.
