# Status — SmartCal (aggiornato 2026-09-27)

## Stato attuale
- Live su https://personal-calendar-puce.vercel.app. Redesign SmartCal completo: Calendar, Scheduling,
  Analytics, Trips, Export, Settings.
- Multi-utente con onboarding, calendari condivisi fra account, promemoria push (funzionano su telefono vero),
  ricorrenza, specchio su Google Calendar (scope `calendar.app.created`, app Google pubblicata senza verifica).
- Migrazioni 0001–0014 tutte presenti in produzione, compresa la 0009 (verificato sullo schema il 2026-09-26).
- 2026-09-26: service_role rigenerata da Andrea; sito, lettura dati, login e Edge Function `promemoria` verificati dopo.
- Git: un solo commit di import dal PC (2026-09-21) + `.gitignore` graphify. Nessuna storia precedente.

## Ultima cosa fatta
- 2026-09-27: redesign grafico in stile **trends** sul branch `redesign-trends` (NON mergiato, NON deployato):
  token OKLCH, Geist, pillole nere, card senza bordi, barra di navigazione in basso su mobile.
  Verificato: build ok, lint invariato, contrasto AA dei token, 34 azioni Playwright ok prima e dopo.
  Poi: icone PWA rifatte (Marchio in cerchio nero), CLAUDE.md aggiornato allo stile trends.
  Anteprima Vercel: https://personal-calendar-jnghp7raa-an-s-projects1.vercel.app (usa il DB di produzione).
- 2026-09-26: CLAUDE.md, status.md e memory.md del progetto; verifica migrazioni e chiavi.
- 2026-09-19: scope Google ridotto a `calendar.app.created`, migration 0014, pagine `privacy.html` e `terms.html`.

## Prossima azione
0. Andrea: rivedere il redesign (screenshot in /tmp/smartcal-confronto) e decidere merge + deploy.
1. Andrea: Settings → Connect Google Calendar (il click di consenso lo può fare solo lui).
2. Test end-to-end: creare un evento → `google-sync` → `eventi.google_id` valorizzato → evento visibile su Google.
   La sincronizzazione non è mai girata per davvero.

## Decisioni aperte
- Recap email settimanale (sospeso): provider (Resend con dominio / Brevo), contenuto, orario di invio.
- Google Meet via `spaces.create`: verificare prima che l'account Google sia abilitato.
- Privacy e termini scritti da Claude, mai rivisti da un legale; DB a Singapore = trasferimento extra-UE da dichiarare.
- Conferma email disattivata (niente SMTP): se serve, SMTP custom e `mailer_autoconfirm: false`.
- Rimandati: avvisi di conflitto, selettore di posizione per giorno (`posizioni_giorno` inutilizzata).
- ❓ Lezione del 14 ottobre (Sustainable Asset Mgmt) ricostruita 15:30–18:30: orario da confermare.
