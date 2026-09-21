# personal-calendar

Calendario a doppio fuso orario, multi-utente. Chiunque riceva il link può
registrarsi e usarlo come calendario proprio: sceglie dove sta, se vuole un
secondo fuso a fianco, e come chiamare le sue quattro categorie.

Per l'account owner resta il caso originale (Singapore ↔ Roma): il feed ICS di
Outlook entra in **sola lettura** ed è un privilegio dell'account, non un
comportamento di tutti (`preferenze.sync_abilitato`). Per ogni altro utente non
esiste nessun feed: ogni evento è uno che crea lui.

Stack: React 19 + TypeScript + Vite · Tailwind CSS · Supabase (Postgres + Auth +
Edge Functions) · Luxon (fusi orari) · ical.js (parsing ICS) · PWA.

## Setup

1. **Progetto Supabase** — crearne uno su [supabase.com](https://supabase.com),
   regione consigliata `Southeast Asia (Singapore)`.
2. **Schema** — nel SQL Editor della dashboard, incollare ed eseguire le
   migrazioni in ordine, da `supabase/migrations/0001_schema.sql` in poi.
   `0010_promemoria.sql` e `0011_cron_promemoria.sql` aggiungono i promemoria
   push (la seconda contiene la anon key del progetto: va sostituita).
   `0012_ricorrenza.sql` aggiunge gli eventi ricorrenti e il job notturno che
   allunga le serie senza fine. `0013_google_calendar.sql` aggiunge lo specchio
   su Google Calendar (contiene anch'essa la anon key, da sostituire).
   `0008_multiutente.sql` è quella che rende l'app multi-utente: senza, i nuovi
   account non hanno le colonne che l'app si aspetta. `0009_condivisione_calendari.sql`
   aggiunge i calendari condivisi fra account: senza, la sidebar non mostra
   nessun "Shared with me" e le impostazioni non riescono a invitare nessuno.
3. **Registrazioni** — in Authentication → Sign In / Providers, Email deve avere
   "Allow new users to sign up" attivo, altrimenti il link non serve a nulla.
4. **Variabili** — `cp .env.example .env.local` e compilare con Project URL e
   **anon key** (Project Settings → API). La `service_role` key NON va qui.
5. **Avvio** — `npm install` poi `npm run dev`.

## Sicurezza

- Gli URL ICS sono credenziali: vivono solo nei Secrets della Edge Function
  (`ICS_LAVORO`, `ICS_UNIVERSITA`), mai nel client. Il feed è di una persona
  sola, quindi la Edge Function importa **solo** per gli account con
  `preferenze.sync_abilitato = true`: per tutti gli altri non fa nulla.
- La pagina pubblica legge nome e fuso del proprietario dal token
  (`condiviso_profilo`), non espone email né titoli degli eventi.
- I calendari condivisi fra account sono un'altra cosa dal link pubblico: sono
  un permesso dato a una persona precisa, che entra col suo account. Tre livelli
  (`occupato`, `dettagli`, `prenota`); `occupato` non passa dalla tabella ma da
  una RPC che restituisce solo gli istanti, perché la RLS filtra righe e non
  colonne. Nessun livello permette di modificare gli eventi altrui: chi ha
  `prenota` inserisce solo richieste `in_attesa`, firmate con `creato_da`.
- RLS attiva su tutte le tabelle. Il client può scrivere solo eventi
  `origine = 'personale'`; gli eventi importati li scrive la Edge Function con la
  `service_role` key.

## Promemoria

Notifica push prima dell'evento, con l'anticipo scelto in Settings (5–60 minuti,
o niente). Il giro: `pg_cron` chiama ogni minuto la Edge Function `promemoria`,
che legge da `promemoria_da_inviare()` cosa è maturato, manda le push firmate
VAPID e segna gli eventi come avvisati. Gli eventi tutto-il-giorno non vengono
annunciati, e uno già iniziato non fa più scattare nulla.

Non si può fare dal client: una notifica programmata dal browser muore con la
scheda (i Notification Triggers non sono mai arrivati), quindi la push deve
partire da fuori. Il service worker la riceve **ad app chiusa** — è
`public/push-sw.js`, importato dentro il worker generato da vite-plugin-pwa.

- **Secrets della Edge Function**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`. La privata firma le push: chi ce l'ha può mandare notifiche a
  nome dell'app, quindi vive solo lì. La pubblica sta in chiaro in
  `src/lib/push.ts` perché finisce comunque nel bundle.
- **Su iPhone e iPad** le notifiche web arrivano solo se l'app è stata aggiunta
  alla schermata Home (iOS 16.4+): da Safari come scheda normale il permesso non
  si può nemmeno chiedere. La card in Settings lo dice invece di mostrare un
  pulsante che non funzionerebbe.
- Ogni dispositivo si abilita da sé: `push_sottoscrizioni` ha una riga per
  browser, non per account. Le sottoscrizioni che il push service dichiara morte
  (404/410) le cancella la Edge Function.

## Google Calendar

Quello che si scrive qui finisce sul proprio Google Calendar in pochi secondi.
**In una direzione sola**: SmartCal e' la verita', Google e' lo specchio. Un
evento creato su Google resta su Google — tornare indietro vorrebbe dire
webhook, deduplica e conflitti di modifica, ed e' un'altra cosa da quella che
serviva qui.

Il giro: ogni scrittura su `eventi` lascia una riga in `coda_google` (trigger
`accoda_google`); la Edge Function `google-sync` la svuota chiamando l'API di
Google. La coda esiste perche' Google sta dall'altra parte della rete: senza,
un suo errore diventerebbe un errore di salvataggio, e un evento salvato male e'
peggio di un evento sincronizzato tardi. A svuotarla sono in due — il client
subito dopo un salvataggio (ed e' quello che la rende istantanea) e `pg_cron`
ogni minuto (ed e' quello che la rende affidabile a scheda chiusa).

Cosa passa: **tutto quello che si vede nel calendario**, da oggi in avanti,
manuali e importati. I due tipi pero' non viaggiano allo stesso modo, e la
differenza non e' un dettaglio implementativo.

Un evento manuale ha una riga stabile, quindi lo segue il trigger per riga. Un
evento importato no: la sync ICS cancella e riscrive tutto il feed a ogni giro
(`0002_sostituisci_eventi.sql`), quindi le sue righe nascono e muoiono anche
quando su Outlook non e' cambiato niente. Per gli importati si fa percio' una
**riconciliazione**: la coda riceve una voce sola per utente, e `google-sync`
confronta quello che c'e' adesso con quello che risulta gia' mandato
(`google_importati`, che tiene l'impronta del contenuto). Chi non e' cambiato
non costa nessuna chiamata, chi e' sparito dal feed viene tolto anche di la'.
L'id su Google si ricava dall'`id_esterno` con uno SHA-256, sempre lo stesso:
e' cosi' che un evento distrutto e ricreato di qua resta lo stesso evento di
la'. Una riconciliazione lunga si ferma a 150 chiamate e riprende al giro dopo,
da un punto che nel frattempo si e' accorciato.

Sull'ora: gli orari partono col loro fuso (`timeZone` = `fuso_origine`), quindi
un evento scritto pensando a Roma resta all'ora a cui e' stato scritto. I
tutto-il-giorno viaggiano come date pure, e la nostra fine — mezzanotte del
giorno dopo — e' gia' la fine esclusiva che Google si aspetta. I promemoria
restano di SmartCal: a Google si dice esplicitamente di non aggiungere i suoi,
altrimenti ogni evento suonerebbe due volte.

Sulle credenziali: il **refresh token** e' la chiave dell'account Google e vive
in `google_account`, una tabella **senza nessuna policy**. La RLS filtra righe e
non colonne, quindi l'unico modo di non esporlo e' non dare al client alcun
accesso alla tabella: lo stato che si vede in Settings arriva dalla RPC
`google_stato`, che restituisce tutto tranne quello.

Setup, una volta sola:

1. Google Cloud Console: progetto nuovo, **Google Calendar API** abilitata,
   OAuth consent screen *External* con la propria email fra i test user, e un
   OAuth client ID di tipo *Web application*.
2. Redirect URI da registrare, identico:
   `https://<progetto>.supabase.co/functions/v1/google-oauth`
3. Secrets della Edge Function: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI` (lo stesso indirizzo del punto 2).
4. `supabase functions deploy google-oauth --no-verify-jwt` — il ritorno dal
   consenso lo fa il browser per conto di Google e non porta nessun
   `Authorization`; a tenere in piedi la sicurezza e' il nonce monouso emesso da
   `google_oauth_avvia`. `google-sync` invece si pubblica normalmente.

## Ricorrenza

Un evento puo' ripetersi ogni giorno, ogni settimana, ogni due settimane, ogni
mese o con un passo qualsiasi ("ogni 10 giorni"), e finire mai, a una data, o
dopo N volte.

Le occorrenze sono **righe vere** in `eventi`, legate dalla colonna `serie_id`,
generate dal database fino a 24 mesi avanti; `pg_cron` allunga ogni notte le
serie senza fine (`estendi_serie()`). L'alternativa — salvare solo la regola ed
espanderla a runtime — avrebbe voluto dire rimettere mano a ogni punto che legge
eventi: griglie, analytics, viaggi, promemoria, pagina pubblica, calendari
condivisi. Cosi' invece nessuno di quelli sa che la ricorrenza esiste, e
continua a vedere quello che ha sempre visto.

L'orario si ripete in **ora locale**, non a distanza fissa: "ogni giorno alle
9:00 a Roma" resta alle 9:00 anche dopo il cambio d'ora, perche' il passo si
somma al timestamp nel fuso dell'evento. Gli eventi tutto-il-giorno, che per
convenzione sono mezzanotte UTC, si spostano in UTC: passare dal fuso locale li
esporrebbe all'ora ambigua della notte del cambio.

Da un'occorrenza si agisce su **questa** o su **questa e le successive**. Il
passato non si riscrive: modificare la serie taglia qui, chiude la regola
vecchia il giorno prima e ne fa nascere una nuova da questa occorrenza in
avanti. Le volte gia' avvenute restano come sono, che sono la storia di quello
che e' successo e non un pezzo di regola.

## Stato

Redesign **SmartCal** completo: tutte le sezioni del menu sono schermate vere.
L'app è multi-utente: primo accesso con onboarding (nome, dove sei, secondo fuso
opzionale), e da Settings si cambiano località, secondo fuso, orario d'ufficio e
i nomi delle quattro categorie.

- **Calendar** — giorno / settimana / mese, asse locale con l'ora di Roma a
  fianco, fascia d'ufficio italiana, soggiorni come barre continue. Su telefono
  il mese mostra i pallini delle categorie e la settimana scorre in orizzontale.
  Un evento puo' essere ricorrente (vedi sopra).
- **Scheduling** — link pubblico di prenotazione (solo blocchi occupati, mai i
  titoli) e richieste da approvare.
- **Analytics** — ore per categoria e nel tempo, striscia 24h con l'orario
  d'ufficio di Roma proiettato sull'asse locale, giornata più carica.
- **Trips** — viaggi ricavati dagli eventi `viaggi` (soggiorni + voli), mappa,
  giorni via, destinazioni.
- **Export** — riepilogo stampabile in PDF dell'intervallo scelto.
- **Settings** — località, calendari collegati e sync, Google Calendar, tema,
  condivisione, promemoria, calendari condivisi, account.
- **Calendari condivisi** — da Settings si dà accesso al proprio calendario a
  un'altra persona, per email, scegliendo cosa vede. Chi lo riceve lo spunta
  in "Shared with me" nella sidebar e se lo trova sovrapposto al proprio, col
  colore di quella persona; con il livello "Can book" può fissare impegni, che
  arrivano al proprietario come richieste da approvare. Analytics, Trips ed
  Export restano sul proprio calendario: i calendari altrui si guardano, non
  entrano nelle proprie statistiche.

Interfaccia in inglese, pagina pubblica compresa. Rimandati per scelta:
avvisi di conflitto e il selettore di posizione per singolo giorno
(`posizioni_giorno` resta inutilizzata).
