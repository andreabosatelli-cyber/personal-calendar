-- 0015_finestre_viaggio.sql
-- Finestre di viaggio: i periodi di 3+ giorni senza lezioni, con le proposte
-- di destinazione e gli eventi speciali del semestre. Prima vivevano in un
-- file markdown e in 12 eventi a mano sul Google principale; ora li mostra
-- la sezione Trips.
--
-- Solo aggiunte: nessuna tabella esistente viene toccata.
-- Policy: select / insert / update sul proprio utente_id. Niente delete di
-- proposito: una finestra non si cancella, si segna 'saltato'.

-- ---------------------------------------------------------------------------
-- 1) travel_windows
-- ---------------------------------------------------------------------------
create table if not exists travel_windows (
  id                     uuid primary key default gen_random_uuid(),
  utente_id              uuid not null references auth.users(id) on delete cascade,
  codice                 text not null,                 -- A, BKK, C2…
  titolo                 text,                          -- "Bangkok", "Con la ragazza"
  inizio                 date not null,                 -- primo giorno libero (SGT), incluso
  fine                   date not null,                 -- ultimo giorno libero (SGT), incluso
  giorni                 smallint not null,
  ultima_lezione_prima   timestamptz,
  prima_lezione_dopo     timestamptz,
  deadline_prenotazione  date,
  stato                  text not null default 'idea',
  note                   text,
  -- true = non viene dal calcolo (BKK salta una lezione, LK e C3 sono di 2
  -- giorni): il confronto col planning controlla solo le lezioni nuove dentro.
  manuale                boolean not null default false,
  -- Giorni con lezione che si e' deciso di saltare (BKK: lun 16/11).
  salta_lezioni          date[] not null default '{}',
  creato_il              timestamptz not null default now(),
  aggiornato_il          timestamptz not null default now(),
  constraint travel_windows_stato_chk check (stato in ('idea', 'da_prenotare', 'prenotato', 'saltato')),
  constraint travel_windows_date_chk check (fine >= inizio),
  constraint travel_windows_codice_uq unique (utente_id, codice)
);

create index if not exists travel_windows_utente_idx on travel_windows (utente_id, inizio);

-- ---------------------------------------------------------------------------
-- 2) travel_proposals
-- ---------------------------------------------------------------------------
create table if not exists travel_proposals (
  id            uuid primary key default gen_random_uuid(),
  utente_id     uuid not null references auth.users(id) on delete cascade,
  window_id     uuid not null references travel_windows(id) on delete cascade,
  destinazione  text not null,
  minuti_volo   smallint,                     -- volo diretto da Changi; null = non indicato o via terra/mare
  trasporto     text,                         -- quando non e' un volo: "traghetto 1h"
  stagione      text,                         -- descrizione libera
  meteo         text,                         -- badge: ottimo / buono / incerto / sconsigliato
  budget        text,                         -- ok / stretto / fuori / misto (vs 100 €/g a persona, voli esclusi)
  eventi        text,
  note          text,
  consigliata   boolean not null default false,
  sconsigliata  boolean not null default false,
  ordine        smallint not null default 0,
  constraint travel_proposals_budget_chk check (budget is null or budget in ('ok', 'stretto', 'fuori', 'misto')),
  constraint travel_proposals_meteo_chk check (meteo is null or meteo in ('ottimo', 'buono', 'incerto', 'sconsigliato'))
);

create index if not exists travel_proposals_window_idx on travel_proposals (window_id, ordine);
create index if not exists travel_proposals_utente_idx on travel_proposals (utente_id);

-- ---------------------------------------------------------------------------
-- 3) travel_events: eventi speciali e periodi di presenza (la ragazza qui)
-- ---------------------------------------------------------------------------
create table if not exists travel_events (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references auth.users(id) on delete cascade,
  titolo     text not null,
  inizio     date not null,
  fine       date not null,
  luogo      text,
  tipo       text not null default 'evento',
  constraint travel_events_tipo_chk check (tipo in ('evento', 'presenza')),
  constraint travel_events_date_chk check (fine >= inizio)
);

create index if not exists travel_events_utente_idx on travel_events (utente_id, inizio);

-- ---------------------------------------------------------------------------
-- 4) RLS: ognuno vede e modifica solo le sue righe
-- ---------------------------------------------------------------------------
alter table travel_windows enable row level security;
alter table travel_proposals enable row level security;
alter table travel_events enable row level security;

drop policy if exists travel_windows_select on travel_windows;
drop policy if exists travel_windows_insert on travel_windows;
drop policy if exists travel_windows_update on travel_windows;
create policy travel_windows_select on travel_windows for select using (utente_id = auth.uid());
create policy travel_windows_insert on travel_windows for insert with check (utente_id = auth.uid());
create policy travel_windows_update on travel_windows for update
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());

drop policy if exists travel_proposals_select on travel_proposals;
drop policy if exists travel_proposals_insert on travel_proposals;
drop policy if exists travel_proposals_update on travel_proposals;
create policy travel_proposals_select on travel_proposals for select using (utente_id = auth.uid());
-- La proposta deve stare su una finestra dello stesso utente.
create policy travel_proposals_insert on travel_proposals for insert with check (
  utente_id = auth.uid()
  and exists (select 1 from travel_windows w where w.id = window_id and w.utente_id = auth.uid())
);
create policy travel_proposals_update on travel_proposals for update
  using (utente_id = auth.uid())
  with check (
    utente_id = auth.uid()
    and exists (select 1 from travel_windows w where w.id = window_id and w.utente_id = auth.uid())
  );

drop policy if exists travel_events_select on travel_events;
drop policy if exists travel_events_insert on travel_events;
drop policy if exists travel_events_update on travel_events;
create policy travel_events_select on travel_events for select using (utente_id = auth.uid());
create policy travel_events_insert on travel_events for insert with check (utente_id = auth.uid());
create policy travel_events_update on travel_events for update
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());

-- aggiornato_il si muove da solo
create or replace function travel_windows_tocca()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

drop trigger if exists travel_windows_tocca on travel_windows;
create trigger travel_windows_tocca before update on travel_windows
  for each row execute function travel_windows_tocca();

-- ---------------------------------------------------------------------------
-- 5) finestre_libere: i buchi di p_minimo+ giorni interi senza lezioni.
--    Giorni contati in ora di Singapore. "Lezione" = evento universita con
--    orario: le scadenze di un giorno intero (CAV…) non tengono in aula.
--    security invoker: passa dalla RLS, quindi vede solo le lezioni di chi
--    chiama (ancorate anche a utente_id, come ogni query su eventi).
-- ---------------------------------------------------------------------------
create or replace function finestre_libere(p_da date, p_a date, p_minimo int default 3)
returns table (
  inizio                date,
  fine                  date,
  giorni                int,
  ultima_lezione_prima  timestamptz,
  prima_lezione_dopo    timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with lezioni as (
    select e.inizio_utc, e.fine_utc
    from eventi e
    where e.utente_id = auth.uid()
      and e.origine = 'universita'
      and not e.tutto_il_giorno
      and e.stato = 'confermato'
      and e.fine_utc >= (p_da::timestamp at time zone 'Asia/Singapore') - interval '60 days'
      and e.inizio_utc < ((p_a + 1)::timestamp at time zone 'Asia/Singapore')
  ),
  -- Fine piu' tarda vista finora: due lezioni sovrapposte non aprono un buco.
  ordinate as (
    select inizio_utc,
           max(fine_utc) over (order by inizio_utc rows between unbounded preceding and current row) as fine_max
    from lezioni
  ),
  buchi as (
    -- Fra una lezione e la successiva (o la fine del periodo).
    select o.fine_max as prima,
           lead(o.inizio_utc) over (order by o.inizio_utc) as dopo
    from ordinate o
    union all
    -- Testa: dall'inizio del periodo alla prima lezione, solo se prima di
    -- p_da non c'e' nessuna lezione (altrimenti il buco lo copre gia' la riga sopra).
    select null, (select min(inizio_utc) from lezioni)
    where not exists (
      select 1 from lezioni where inizio_utc < (p_da::timestamp at time zone 'Asia/Singapore')
    )
  ),
  giorni as (
    select b.prima,
           b.dopo,
           greatest(p_da, coalesce((b.prima at time zone 'Asia/Singapore')::date + 1, p_da)) as g_inizio,
           least(p_a, coalesce((b.dopo at time zone 'Asia/Singapore')::date - 1, p_a)) as g_fine
    from buchi b
    where b.prima is null or b.dopo is null or b.dopo > b.prima
  )
  select distinct g.g_inizio, g.g_fine, (g.g_fine - g.g_inizio + 1)::int, g.prima, g.dopo
  from giorni g
  where g.g_fine - g.g_inizio + 1 >= p_minimo
  order by 1;
$$;

revoke all on function finestre_libere(date, date, int) from public, anon;
grant execute on function finestre_libere(date, date, int) to authenticated;
