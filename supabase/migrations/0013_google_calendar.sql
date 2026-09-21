-- 0013_google_calendar.sql
-- Specchio degli eventi su Google Calendar, in una direzione sola: SmartCal
-- scrive, Google legge. Quello che si crea qui compare li' in pochi secondi;
-- quello che si crea su Google resta su Google (per ora).
--
-- COME: ogni scrittura su `eventi` lascia una riga in `coda_google`; la Edge
-- Function `google-sync` la svuota chiamando l'API di Google. La coda serve
-- perche' l'API sta dall'altra parte della rete: senza, un errore di Google
-- diventerebbe un errore di salvataggio, e un evento salvato male e' peggio di
-- un evento sincronizzato tardi.
--
-- COSA VIENE SINCRONIZZATO: tutto quello che si vede nel calendario, da oggi in
-- avanti — manuali e importati, tutte e quattro le categorie.
--
-- I due tipi pero' non possono viaggiare allo stesso modo. Un evento manuale ha
-- una riga stabile, quindi lo segue un trigger per riga. Un evento importato
-- no: la sync ICS cancella e riscrive TUTTO il feed a ogni giro
-- (0002_sostituisci_eventi.sql), quindi le sue righe nascono e muoiono in
-- continuazione anche quando su Outlook non e' cambiato niente. Seguirle per
-- riga vorrebbe dire cancellare e ricreare l'intera agenda di lavoro su Google
-- a ogni apertura dell'app.
--
-- Per gli importati si fa quindi una RICONCILIAZIONE: la coda riceve una sola
-- voce 'reconcile' per utente, e la Edge Function confronta quello che c'e' ora
-- con quello che risulta gia' mandato (`google_importati`, con l'impronta del
-- contenuto). Chi non e' cambiato non costa nessuna chiamata; chi e' sparito
-- dal feed viene tolto anche di la'. L'id su Google si ricava dall'id_esterno,
-- sempre lo stesso, cosi' il cancella-e-riscrivi locale non si vede.
--
-- IL REFRESH TOKEN e' la chiave dell'account Google: sta in `google_account`,
-- che NON ha nessuna policy. La RLS filtra righe e non colonne, quindi l'unico
-- modo di non esporlo e' non dare al client nessun accesso alla tabella e far
-- passare lo stato da una RPC che restituisce solo cio' che si puo' vedere.

-- ---------------------------------------------------------------------------
-- 1) Account Google collegato
-- ---------------------------------------------------------------------------
create table if not exists google_account (
  utente_id     uuid primary key references auth.users(id) on delete cascade,
  email_google  text,
  calendario_id text not null default 'primary',
  refresh_token text not null,
  abilitato     boolean not null default true,
  ultimo_sync   timestamptz,
  ultimo_errore text,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

alter table google_account enable row level security;
-- Nessuna policy, di proposito: qui dentro c'e' una credenziale.

drop trigger if exists google_account_tocca on google_account;
create trigger google_account_tocca
  before update on google_account
  for each row
  execute function tocca_aggiornato_il();

-- ---------------------------------------------------------------------------
-- 2) Stato temporaneo del giro OAuth
-- ---------------------------------------------------------------------------
-- Google torna indietro su una URL pubblica, senza il JWT dell'utente: per
-- sapere di chi e' il consenso che sta arrivando serve un biglietto emesso
-- prima, valido dieci minuti e spendibile una volta sola.
create table if not exists google_oauth_stato (
  nonce     text primary key,
  utente_id uuid not null references auth.users(id) on delete cascade,
  -- Da quale indirizzo e' partito il giro: e' li' che il browser va rimandato
  -- a cose fatte. Lo scrive l'utente autenticato per se stesso, e la Edge
  -- Function accetta solo https (o localhost, per lo sviluppo).
  ritorno   text,
  scadenza  timestamptz not null default now() + interval '10 minutes'
);

alter table google_oauth_stato enable row level security;
-- Nessuna policy: lo emette una RPC, lo consuma la Edge Function.

-- ---------------------------------------------------------------------------
-- 3) eventi: l'id che l'evento ha dall'altra parte
-- ---------------------------------------------------------------------------
alter table eventi add column if not exists google_id text;

create index if not exists eventi_google_idx on eventi (utente_id, google_id) where google_id is not null;

-- ---------------------------------------------------------------------------
-- 4) La coda
-- ---------------------------------------------------------------------------
create table if not exists coda_google (
  id        bigint generated always as identity primary key,
  utente_id uuid not null references auth.users(id) on delete cascade,
  -- null per le cancellazioni: la riga dell'evento a quel punto non c'e' piu',
  -- e l'unica cosa che resta da dire a Google e' quale id togliere.
  evento_id uuid,
  google_id text,
  azione    text not null check (azione in ('upsert', 'delete', 'reconcile')),
  tentativi smallint not null default 0,
  errore    text,
  creato_il timestamptz not null default now()
);

alter table coda_google enable row level security;
-- Nessuna policy: la riempie un trigger, la svuota la Edge Function.

-- Un evento ha al massimo un upsert in attesa: modificarlo cinque volte di
-- fila non deve diventare cinque chiamate a Google, ma una sola con l'ultimo
-- contenuto (che la Edge Function rilegge dalla tabella al momento dell'invio).
create unique index if not exists coda_google_un_upsert
  on coda_google (evento_id) where azione = 'upsert';

create index if not exists coda_google_da_fare on coda_google (creato_il) where tentativi < 5;

-- Stessa cosa per la riconciliazione: una per utente, non una per riga toccata
-- dal feed. Un full-replace di trecento eventi lascia in coda una voce sola.
create unique index if not exists coda_google_un_reconcile
  on coda_google (utente_id) where azione = 'reconcile';

-- ---------------------------------------------------------------------------
-- 4b) Cosa e' gia' stato mandato, per gli eventi importati
-- ---------------------------------------------------------------------------
-- Gli importati non hanno una riga stabile su cui appoggiare `google_id`: la
-- sync ICS la distrugge a ogni giro. La memoria di cosa sta su Google vive
-- quindi qui, indicizzata sull'unica cosa che sopravvive — l'id_esterno.
--
-- `impronta` e' il contenuto che abbiamo mandato l'ultima volta: se non e'
-- cambiato, non c'e' niente da richiedere a Google. E' quello che rende la
-- riconciliazione a costo zero quando su Outlook non e' cambiato nulla.
create table if not exists google_importati (
  utente_id  uuid not null references auth.users(id) on delete cascade,
  id_esterno text not null,
  google_id  text not null,
  impronta   text not null,
  visto_il   timestamptz not null default now(),
  primary key (utente_id, id_esterno)
);

alter table google_importati enable row level security;
-- Nessuna policy: la scrive e la legge solo la Edge Function.

-- ---------------------------------------------------------------------------
-- 5) Il trigger che riempie la coda
-- ---------------------------------------------------------------------------
create or replace function accoda_google()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga   eventi;
  v_attivo boolean;
begin
  if tg_op = 'DELETE' then v_riga := old; else v_riga := new; end if;

  select abilitato into v_attivo from google_account where utente_id = v_riga.utente_id;
  if v_attivo is not true then
    return v_riga;
  end if;

  -- Importato: non si insegue la singola riga (nasce e muore a ogni sync ICS),
  -- si chiede una riconciliazione e se ne riparla una volta sola.
  if v_riga.id_esterno is not null then
    insert into coda_google (utente_id, evento_id, google_id, azione)
    values (v_riga.utente_id, null, null, 'reconcile')
    on conflict (utente_id) where azione = 'reconcile'
    do nothing;
    return v_riga;
  end if;

  if tg_op = 'DELETE' then
    if old.google_id is not null then
      insert into coda_google (utente_id, evento_id, google_id, azione)
      values (old.utente_id, null, old.google_id, 'delete');
    end if;
    return old;
  end if;

  -- La Edge Function scrive `google_id` sulla riga appena sincronizzata, e i
  -- promemoria scrivono `promemoria_inviato_il`: senza questo confronto ogni
  -- scrittura di servizio rimetterebbe l'evento in coda, all'infinito.
  if tg_op = 'UPDATE' and (
       new.titolo, new.descrizione, new.luogo, new.inizio_utc, new.fine_utc,
       new.fuso_origine, new.tutto_il_giorno, new.link_video, new.stato
     ) is not distinct from (
       old.titolo, old.descrizione, old.luogo, old.inizio_utc, old.fine_utc,
       old.fuso_origine, old.tutto_il_giorno, old.link_video, old.stato
     ) then
    return new;
  end if;

  -- Una richiesta in attesa non e' ancora un impegno: su Google ci va quando
  -- viene approvata (e allora `stato` cambia, e si ripassa di qui).
  if new.stato <> 'confermato' then
    return new;
  end if;

  -- Da oggi in avanti. Un evento gia' finito entra in coda solo se su Google
  -- c'e' gia': in quel caso e' una modifica da riportare, non un arretrato.
  if new.fine_utc < now() and new.google_id is null then
    return new;
  end if;

  insert into coda_google (utente_id, evento_id, google_id, azione)
  values (new.utente_id, new.id, new.google_id, 'upsert')
  on conflict (evento_id) where azione = 'upsert'
  do update set creato_il = now(), tentativi = 0, errore = null;

  return new;
end;
$$;

drop trigger if exists eventi_accoda_google on eventi;
create trigger eventi_accoda_google
  after insert or update or delete on eventi
  for each row
  execute function accoda_google();

-- ---------------------------------------------------------------------------
-- 6) Le RPC che vede il client
-- ---------------------------------------------------------------------------
-- Lo stato del collegamento, senza il refresh token.
create or replace function google_stato()
returns table (
  collegato     boolean,
  email_google  text,
  calendario_id text,
  abilitato     boolean,
  ultimo_sync   timestamptz,
  ultimo_errore text,
  in_coda       integer
)
language sql
security definer
set search_path = public
as $$
  select
    true,
    g.email_google,
    g.calendario_id,
    g.abilitato,
    g.ultimo_sync,
    g.ultimo_errore,
    (select count(*)::int from coda_google c where c.utente_id = g.utente_id and c.tentativi < 5)
  from google_account g
  where g.utente_id = auth.uid();
$$;

grant execute on function google_stato() to authenticated;

-- Il biglietto per il giro OAuth: lo emette l'utente autenticato, lo spende la
-- Edge Function quando Google rimanda indietro il browser.
create or replace function google_oauth_avvia(p_ritorno text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_nonce text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from google_oauth_stato where scadenza < now() or utente_id = auth.uid();
  v_nonce := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into google_oauth_stato (nonce, utente_id, ritorno) values (v_nonce, auth.uid(), p_ritorno);
  return v_nonce;
end;
$$;

grant execute on function google_oauth_avvia(text) to authenticated;

-- Scollegare non tocca gli eventi su Google: quello che c'e' li' resta li'.
-- Si dimentica solo la credenziale e il legame, cosi' un ricollegamento
-- ricomincia pulito invece di inseguire id che non si possono piu' toccare.
create or replace function google_scollega()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from coda_google      where utente_id = auth.uid();
  delete from google_importati where utente_id = auth.uid();
  delete from google_account   where utente_id = auth.uid();
  update eventi set google_id = null where utente_id = auth.uid() and google_id is not null;
end;
$$;

grant execute on function google_scollega() to authenticated;

create or replace function google_attiva(p_abilitato boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update google_account set abilitato = p_abilitato where utente_id = auth.uid();
$$;

grant execute on function google_attiva(boolean) to authenticated;

-- Il travaso iniziale: tutto quello che c'e' da oggi in avanti entra in coda.
create or replace function google_backfill()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  insert into coda_google (utente_id, evento_id, google_id, azione)
  select e.utente_id, e.id, e.google_id, 'upsert'
    from eventi e
   where e.utente_id = auth.uid()
     and e.id_esterno is null
     and e.stato = 'confermato'
     and e.fine_utc >= now()
  on conflict (evento_id) where azione = 'upsert'
  do update set creato_il = now(), tentativi = 0, errore = null;

  get diagnostics v_n = row_count;

  -- Gli importati entrano in blocco, con una voce sola: li conta la
  -- riconciliazione quando gira.
  if exists (
    select 1 from eventi
     where utente_id = auth.uid() and id_esterno is not null and fine_utc >= now()
  ) then
    insert into coda_google (utente_id, evento_id, google_id, azione)
    values (auth.uid(), null, null, 'reconcile')
    on conflict (utente_id) where azione = 'reconcile'
    do nothing;
  end if;

  return v_n;
end;
$$;

grant execute on function google_backfill() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Il giro periodico
-- ---------------------------------------------------------------------------
-- La coda la svuota anche il client, subito dopo un salvataggio: e' quello che
-- rende la cosa istantanea. Il cron e' la rete di sicurezza per quando il
-- client non c'e' (scheda chiusa, errore di rete, retry).
--
-- La anon key non si riscrive a mano: la si prende dal job dei promemoria, che
-- ce l'ha gia' (0011). Vale lo stesso ragionamento di allora — e' una chiave
-- gia' pubblica, viaggia dentro il bundle del browser — con in piu' il fatto
-- che cosi' non c'e' un secondo posto dove tenerla allineata.

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $blocco$
declare
  v_key text;
  v_url text;
begin
  select substring(command from 'Bearer ([A-Za-z0-9._%-]+)')
    into v_key
    from cron.job
   where jobname = 'promemoria-ogni-minuto';

  if v_key is null then
    raise exception 'Non trovo la anon key: esegui prima 0011_cron_promemoria.sql, oppure scrivi qui il job a mano';
  end if;

  select substring(command from 'url := ''(https://[^/]+)/functions')
    into v_url
    from cron.job
   where jobname = 'promemoria-ogni-minuto';

  perform cron.unschedule(jobid) from cron.job where jobname = 'google-sync-ogni-minuto';

  perform cron.schedule('google-sync-ogni-minuto', '* * * * *', format(
    $cron$select net.http_post(
      url := %L,
      headers := %L::jsonb,
      timeout_milliseconds := 30000
    );$cron$,
    v_url || '/functions/v1/google-sync',
    json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
  ));
end;
$blocco$;

-- Come si controlla:
--   select * from coda_google order by id desc limit 20;
--   select email_google, ultimo_sync, ultimo_errore from google_account;
--   select status_code, content from net._http_response order by created desc limit 5;
