-- 0010_promemoria.sql
-- Promemoria prima degli eventi, via Web Push.
--
-- Perche' passa dal server e non dal telefono: una notifica programmata dal
-- client muore appena si chiude la scheda (l'API dei Notification Triggers non
-- e' mai arrivata). L'unica strada che funziona ad app chiusa e' una push vera,
-- mandata da fuori e ricevuta dal service worker.
--
-- Il giro completo: pg_cron chiama ogni minuto la Edge Function `promemoria`,
-- che chiede a `promemoria_da_inviare()` cosa e' maturato, manda le push e
-- segna gli eventi come avvisati.

-- ---------------------------------------------------------------------------
-- 1) Quanto anticipo vuole l'utente. NULL = nessun promemoria, ed e' il valore
--    di partenza per tutti: la notifica e' una cosa che si chiede, non che si
--    subisce al primo accesso.
-- ---------------------------------------------------------------------------
alter table preferenze add column if not exists promemoria_minuti smallint;

do $$ begin
  alter table preferenze add constraint preferenze_promemoria_chk
    check (promemoria_minuti is null or promemoria_minuti between 1 and 1440);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) Quando e' partito l'avviso per quell'evento: evita di mandarlo due volte
--    se il cron gira di nuovo prima che l'evento inizi.
-- ---------------------------------------------------------------------------
alter table eventi add column if not exists promemoria_inviato_il timestamptz;

-- Spostare un evento rimette in gioco il promemoria: se l'appuntamento delle
-- 10:00 diventa delle 16:00, l'avviso gia' mandato non vale piu'.
create or replace function azzera_promemoria()
returns trigger
language plpgsql
as $$
begin
  if new.inizio_utc is distinct from old.inizio_utc then
    new.promemoria_inviato_il := null;
  end if;
  return new;
end;
$$;

drop trigger if exists eventi_azzera_promemoria on eventi;
create trigger eventi_azzera_promemoria
  before update on eventi
  for each row
  execute function azzera_promemoria();

-- Indice parziale: il cron cerca sempre e solo gli eventi futuri non ancora
-- avvisati, che sono una manciata su tutta la tabella.
create index if not exists eventi_promemoria_idx
  on eventi (inizio_utc)
  where stato = 'confermato' and promemoria_inviato_il is null;

-- ---------------------------------------------------------------------------
-- 3) I dispositivi a cui mandare la push. Una riga per browser/telefono: lo
--    stesso account che apre l'app dal portatile e dal telefono ne ha due, e
--    l'avviso deve arrivare a entrambi.
-- ---------------------------------------------------------------------------
create table if not exists push_sottoscrizioni (
  id         uuid primary key default gen_random_uuid(),
  utente_id  uuid not null references auth.users(id) on delete cascade,
  -- L'endpoint e' l'indirizzo che il push service (Google, Apple, Mozilla) ha
  -- dato a QUEL browser: e' lui l'identita' del dispositivo, non l'utente.
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  agente     text,
  creato_il  timestamptz not null default now(),
  ultimo_uso timestamptz
);

create index if not exists push_sottoscrizioni_utente_idx on push_sottoscrizioni (utente_id);

alter table push_sottoscrizioni enable row level security;

drop policy if exists push_sottoscrizioni_all on push_sottoscrizioni;
create policy push_sottoscrizioni_all on push_sottoscrizioni
  for all using (utente_id = auth.uid()) with check (utente_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Cosa e' maturato adesso. Una riga per (evento, dispositivo): la Edge
--    Function cicla e manda, senza dover rifare la logica in TypeScript.
--
--    Fuori restano di proposito:
--      - gli eventi tutto-il-giorno (avvisare "fra 10 minuti" un evento che
--        dura una giornata intera non vuol dire niente),
--      - le richieste non ancora approvate,
--      - gli eventi gia' iniziati: se il cron e' stato fermo, l'avviso in
--        ritardo e' peggio di nessun avviso.
-- ---------------------------------------------------------------------------
create or replace function promemoria_da_inviare()
returns table (
  evento_id  uuid,
  titolo     text,
  luogo      text,
  inizio_utc timestamptz,
  fuso       text,
  link_video text,
  endpoint   text,
  p256dh     text,
  auth       text
)
language sql
stable
as $$
  select e.id, e.titolo, e.luogo, e.inizio_utc, p.fuso_base, e.link_video,
         s.endpoint, s.p256dh, s.auth
  from eventi e
  join preferenze p          on p.utente_id = e.utente_id
  join push_sottoscrizioni s on s.utente_id = e.utente_id
  where p.promemoria_minuti is not null
    and e.stato = 'confermato'
    and e.tutto_il_giorno = false
    and e.promemoria_inviato_il is null
    and e.inizio_utc >= now()
    and e.inizio_utc <= now() + (p.promemoria_minuti || ' minutes')::interval
  order by e.inizio_utc;
$$;

-- Solo il service role: la chiama la Edge Function, mai il browser.
revoke all on function promemoria_da_inviare() from public, anon, authenticated;
grant execute on function promemoria_da_inviare() to service_role;
