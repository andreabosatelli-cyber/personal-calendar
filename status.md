# Status — SmartCal (aggiornato 2026-09-26)

## Stato attuale
- Live su https://personal-calendar-puce.vercel.app. Redesign SmartCal completo: Calendar, Scheduling,
  Analytics, Trips, Export, Settings.
- Multi-utente con onboarding, calendari condivisi fra account, promemoria push (funzionano su telefono vero),
  ricorrenza, specchio su Google Calendar (scope `calendar.app.created`, app Google pubblicata senza verifica).
- Migrazioni 0001–0014 tutte presenti in produzione, compresa la 0009 (verificato sullo schema il 2026-09-26).
- 2026-09-26: service_role rigenerata da Andrea; sito, lettura dati, login e Edge Function `promemoria` verificati dopo.
- Git: un solo commit di import dal PC (2026-09-21) + `.gitignore` graphify. Nessuna storia precedente.

## Ultima cosa fatta
- 2026-09-26: CLAUDE.md, status.md e memory.md del progetto; verifica migrazioni e chiavi.
- 2026-09-19: scope Google ridotto a `calendar.app.created`, migration 0014, pagine `privacy.html` e `terms.html`.

## Prossima azione
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
