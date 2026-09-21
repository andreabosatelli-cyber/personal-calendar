-- personal-calendar — schema iniziale
-- Punto 1 del brief: schema, RLS, autenticazione.
--
-- Principi:
--  * Un solo utente reale, ma tutto è comunque legato a auth.users e protetto da RLS.
--  * Gli eventi importati (lavoro/universita) li scrive SOLO la Edge Function con
--    la service_role key, che bypassa RLS. Il client non può crearli né modificarli:
--    le policy consentono al client scritture solo su origine = 'personale'.
--  * Ogni istante è ancorato: inizio_utc/fine_utc (quando) + fuso_origine (dove).

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type origine_evento as enum ('lavoro', 'universita', 'personale');

-- ---------------------------------------------------------------------------
-- Tabella: eventi
-- ---------------------------------------------------------------------------
create table eventi (
  id              uuid primary key default gen_random_uuid(),
  utente_id       uuid not null references auth.users(id) on delete cascade,
  origine         origine_evento not null,
  titolo          text not null,
  descrizione     text,
  luogo           text,
  inizio_utc      timestamptz not null,
  fine_utc        timestamptz not null,
  fuso_origine    text not null,
  tutto_il_giorno boolean not null default false,
  id_esterno      text,
  creato_il       timestamptz not null default now(),
  aggiornato_il   timestamptz not null default now(),
  constraint eventi_fine_dopo_inizio check (fine_utc >= inizio_utc)
);

create index eventi_utente_inizio_idx on eventi (utente_id, inizio_utc);

-- Il full-replace della sync cancella per (utente_id, origine): questo indice
-- parziale rende veloce sia la delete sia il dedup lato import.
create index eventi_utente_origine_idx on eventi (utente_id, origine);

-- ---------------------------------------------------------------------------
-- Tabella: posizioni_giorno  (dove sono, giorno per giorno — asse di rendering)
-- ---------------------------------------------------------------------------
create table posizioni_giorno (
  utente_id uuid not null references auth.users(id) on delete cascade,
  giorno    date not null,
  fuso      text not null,
  etichetta text not null,
  primary key (utente_id, giorno)
);

-- ---------------------------------------------------------------------------
-- Tabella: preferenze  (fuso base + stato ultimo sync per sorgente)
-- ---------------------------------------------------------------------------
create table preferenze (
  utente_id      uuid primary key references auth.users(id) on delete cascade,
  fuso_base      text not null default 'Asia/Singapore',
  etichetta_base text not null default 'Singapore',
  ultimo_sync    jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Trigger: aggiornato_il su eventi
-- ---------------------------------------------------------------------------
create or replace function tocca_aggiornato_il()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

create trigger eventi_tocca_aggiornato_il
  before update on eventi
  for each row
  execute function tocca_aggiornato_il();

-- ---------------------------------------------------------------------------
-- Auth: crea la riga preferenze di default alla registrazione dell'utente
-- ---------------------------------------------------------------------------
create or replace function gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.preferenze (utente_id)
  values (new.id)
  on conflict (utente_id) do nothing;
  return new;
end;
$$;

create trigger su_nuovo_utente
  after insert on auth.users
  for each row
  execute function gestisci_nuovo_utente();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table eventi            enable row level security;
alter table posizioni_giorno  enable row level security;
alter table preferenze        enable row level security;

-- eventi: lettura di tutte le origini; scrittura dal client SOLO su 'personale'.
-- La Edge Function usa service_role e bypassa queste policy per lavoro/universita.
create policy eventi_select on eventi
  for select using (utente_id = auth.uid());

create policy eventi_insert_personale on eventi
  for insert with check (utente_id = auth.uid() and origine = 'personale');

create policy eventi_update_personale on eventi
  for update using (utente_id = auth.uid() and origine = 'personale')
             with check (utente_id = auth.uid() and origine = 'personale');

create policy eventi_delete_personale on eventi
  for delete using (utente_id = auth.uid() and origine = 'personale');

-- posizioni_giorno: CRUD completo sui propri record.
create policy posizioni_all on posizioni_giorno
  for all using (utente_id = auth.uid())
          with check (utente_id = auth.uid());

-- preferenze: CRUD completo sui propri record.
create policy preferenze_all on preferenze
  for all using (utente_id = auth.uid())
          with check (utente_id = auth.uid());
