-- 0012_ricorrenza.sql
-- Eventi ricorrenti: "ogni giorno", "ogni settimana", "ogni due settimane",
-- "ogni 10 giorni", "ogni mese"… con fine facoltativa (mai / a una data / dopo
-- N volte).
--
-- SCELTA DI FONDO: le occorrenze sono righe VERE nella tabella `eventi`,
-- generate fino a un orizzonte (24 mesi) ed estese ogni notte da pg_cron.
-- L'alternativa (salvare solo la regola ed espanderla a runtime) avrebbe
-- obbligato a rimettere mano a ogni punto che legge eventi — griglie,
-- analytics, viaggi, promemoria, pagina pubblica, calendari condivisi — mentre
-- cosi' tutto continua a vedere quello che ha sempre visto: eventi.
-- Il prezzo e' che "per sempre" in pratica sono 24 mesi alla volta.
--
-- MODELLO DI MODIFICA: da una occorrenza si agisce su "questa" (una update
-- normale sulla riga) oppure su "questa e le successive" (la serie viene
-- tagliata qui e ricreata da qui in poi). Il passato non si riscrive mai: le
-- occorrenze gia' avvenute restano come sono, che sono la storia di quello che
-- e' successo, non un pezzo di regola.

-- ---------------------------------------------------------------------------
-- Tabella: serie_ricorrenti  (la regola; le occorrenze stanno in `eventi`)
-- ---------------------------------------------------------------------------
create table if not exists serie_ricorrenti (
  id             uuid primary key default gen_random_uuid(),
  utente_id      uuid not null references auth.users(id) on delete cascade,
  -- "ogni <intervallo> <unita>": (1, giorni) = ogni giorno, (2, settimane) =
  -- ogni due settimane, (10, giorni) = ogni dieci giorni.
  unita          text not null check (unita in ('giorni', 'settimane', 'mesi')),
  intervallo     smallint not null check (intervallo between 1 and 365),
  fine_tipo      text not null check (fine_tipo in ('mai', 'data', 'conteggio')),
  fine_data      date,
  fine_conteggio smallint check (fine_conteggio between 2 and 500),
  -- Quante occorrenze sono state generate finora (il capostipite conta come 1)
  -- e fin dove: insieme rendono la generazione ripetibile senza duplicare.
  occorrenze_generate integer not null default 1,
  generato_fino_a     timestamptz,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  constraint serie_fine_coerente check (
    (fine_tipo = 'mai'       and fine_data is null and fine_conteggio is null) or
    (fine_tipo = 'data'      and fine_data is not null and fine_conteggio is null) or
    (fine_tipo = 'conteggio' and fine_conteggio is not null and fine_data is null)
  )
);

create index if not exists serie_utente_idx on serie_ricorrenti (utente_id);

drop trigger if exists serie_tocca_aggiornato_il on serie_ricorrenti;
create trigger serie_tocca_aggiornato_il
  before update on serie_ricorrenti
  for each row
  execute function tocca_aggiornato_il();

-- ---------------------------------------------------------------------------
-- eventi: a quale serie appartiene questa occorrenza
-- ---------------------------------------------------------------------------
-- on delete cascade: cancellare la regola cancella le sue occorrenze. Per
-- questo `elimina_serie_da` non cancella mai la riga della serie finche'
-- restano occorrenze passate da conservare.
alter table eventi add column if not exists serie_id uuid references serie_ricorrenti(id) on delete cascade;

create index if not exists eventi_serie_idx on eventi (serie_id, inizio_utc) where serie_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: la regola e' dell'utente, come tutto il resto
-- ---------------------------------------------------------------------------
alter table serie_ricorrenti enable row level security;

drop policy if exists serie_all on serie_ricorrenti;
create policy serie_all on serie_ricorrenti
  for all using (utente_id = auth.uid())
          with check (utente_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Orizzonte di generazione
-- ---------------------------------------------------------------------------
create or replace function orizzonte_serie()
returns timestamptz
language sql
stable
as $$ select now() + interval '24 months' $$;

-- ---------------------------------------------------------------------------
-- genera_occorrenze — il motore: crea le occorrenze mancanti fino a p_fino
-- ---------------------------------------------------------------------------
-- Ogni occorrenza si calcola dal capostipite (mai dalla precedente): cosi' non
-- si accumula deriva e rigenerare da capo da' lo stesso risultato.
--
-- FUSI E ORA LEGALE: l'orario si ripete in ORA LOCALE, non a distanza fissa di
-- ore. "Ogni giorno alle 9:00 a Roma" resta alle 9:00 anche dopo il cambio
-- d'ora, e infatti il passo si somma al timestamp locale (`at time zone`), non
-- all'istante UTC. Gli eventi tutto-il-giorno per convenzione sono mezzanotte
-- UTC (vedi SheetEvento) e li si somma in UTC: passare dal fuso locale li
-- esporrebbe all'ora ambigua della notte del cambio.
--
-- security definer: la chiama anche pg_cron, dove auth.uid() non esiste. Gli
-- ingressi pubblici qui sotto controllano che chi chiama sia il proprietario.
create or replace function genera_occorrenze(p_serie uuid, p_fino timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s        serie_ricorrenti;
  m        eventi;
  tz       text;
  i_loc    timestamp;
  f_loc    timestamp;
  passo    interval;
  nuovo_i  timestamptz;
  nuovo_f  timestamptz;
  limite   timestamptz;
  ultimo_i timestamptz;
  n        integer;
  creati   integer := 0;
  giri     integer := 0;
begin
  select * into s from serie_ricorrenti where id = p_serie;
  if not found then return 0; end if;

  -- Il capostipite e' la prima occorrenza rimasta: da li' si copia tutto.
  select * into m from eventi where serie_id = p_serie order by inizio_utc limit 1;
  if not found then return 0; end if;

  tz     := m.fuso_origine;
  i_loc  := m.inizio_utc at time zone tz;
  f_loc  := m.fine_utc   at time zone tz;
  limite := coalesce(p_fino, orizzonte_serie());

  -- Una fine a data e' inclusiva del giorno indicato, quindi il limite e' la
  -- sua mezzanotte di chiusura nel fuso dell'evento.
  if s.fine_tipo = 'data' then
    limite := least(limite, ((s.fine_data + 1)::timestamp) at time zone tz);
  end if;

  n := greatest(s.occorrenze_generate, 1);

  loop
    giri := giri + 1;
    exit when giri > 1000; -- rete di sicurezza: nessuna chiamata genera di piu'
    exit when s.fine_tipo = 'conteggio' and n >= s.fine_conteggio;

    passo := case s.unita
               when 'giorni'    then make_interval(days   => s.intervallo * n)
               when 'settimane' then make_interval(weeks  => s.intervallo * n)
               else                  make_interval(months => s.intervallo * n)
             end;

    if m.tutto_il_giorno then
      nuovo_i := ((m.inizio_utc at time zone 'UTC') + passo) at time zone 'UTC';
      nuovo_f := ((m.fine_utc   at time zone 'UTC') + passo) at time zone 'UTC';
    else
      nuovo_i := (i_loc + passo) at time zone tz;
      nuovo_f := (f_loc + passo) at time zone tz;
    end if;

    exit when nuovo_i > limite;

    insert into eventi (
      utente_id, origine, titolo, descrizione, luogo,
      inizio_utc, fine_utc, fuso_origine, tutto_il_giorno,
      stato, link_video, creato_da, serie_id
    ) values (
      m.utente_id, m.origine, m.titolo, m.descrizione, m.luogo,
      nuovo_i, nuovo_f, m.fuso_origine, m.tutto_il_giorno,
      m.stato, m.link_video, m.creato_da, p_serie
    );

    ultimo_i := nuovo_i;
    creati   := creati + 1;
    n        := n + 1;
  end loop;

  -- A guidare la ripresa e' l'indice (`occorrenze_generate`), non la data:
  -- `generato_fino_a` dice soltanto fin dove si e' arrivati davvero.
  update serie_ricorrenti
     set occorrenze_generate = n,
         generato_fino_a     = coalesce(ultimo_i, generato_fino_a)
   where id = p_serie;

  return creati;
end;
$$;

-- ---------------------------------------------------------------------------
-- crea_serie — l'evento appena inserito diventa il capostipite di una serie
-- ---------------------------------------------------------------------------
create or replace function crea_serie(
  p_evento         uuid,
  p_unita          text,
  p_intervallo     integer,
  p_fine_tipo      text default 'mai',
  p_fine_data      date default null,
  p_fine_conteggio integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente uuid;
  v_serie  uuid;
begin
  -- Le stesse condizioni della policy di insert: evento mio, manuale, e non
  -- gia' dentro un'altra serie.
  select utente_id into v_utente
    from eventi
   where id = p_evento and utente_id = auth.uid() and id_esterno is null and serie_id is null;
  if not found then
    raise exception 'Evento non ricorribile o non tuo';
  end if;

  insert into serie_ricorrenti (utente_id, unita, intervallo, fine_tipo, fine_data, fine_conteggio)
  values (v_utente, p_unita, p_intervallo, p_fine_tipo, p_fine_data, p_fine_conteggio)
  returning id into v_serie;

  update eventi set serie_id = v_serie where id = p_evento;

  perform genera_occorrenze(v_serie);
  return v_serie;
end;
$$;

grant execute on function crea_serie(uuid, text, integer, text, date, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- aggiorna_serie_da — "questa e le successive"
-- ---------------------------------------------------------------------------
-- Il client ha gia' scritto i campi nuovi sull'occorrenza da cui si e' partiti.
-- Qui si taglia: le successive spariscono, la serie vecchia si chiude il giorno
-- prima (se le resta del passato) e da questa occorrenza nasce la serie nuova.
create or replace function aggiorna_serie_da(
  p_evento         uuid,
  p_unita          text,
  p_intervallo     integer,
  p_fine_tipo      text default 'mai',
  p_fine_data      date default null,
  p_fine_conteggio integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ev        eventi;
  v_vecchia uuid;
  v_serie   uuid;
  v_restano integer;
begin
  select * into ev
    from eventi
   where id = p_evento and utente_id = auth.uid() and id_esterno is null;
  if not found then
    raise exception 'Evento non tuo o non modificabile';
  end if;

  v_vecchia := ev.serie_id;

  if v_vecchia is not null then
    delete from eventi
     where serie_id = v_vecchia and inizio_utc > ev.inizio_utc and id <> p_evento;
  end if;

  insert into serie_ricorrenti (utente_id, unita, intervallo, fine_tipo, fine_data, fine_conteggio)
  values (ev.utente_id, p_unita, p_intervallo, p_fine_tipo, p_fine_data, p_fine_conteggio)
  returning id into v_serie;

  update eventi set serie_id = v_serie where id = p_evento;

  if v_vecchia is not null then
    select count(*) into v_restano from eventi where serie_id = v_vecchia;
    if v_restano = 0 then
      delete from serie_ricorrenti where id = v_vecchia;
    else
      -- Chiude la regola vecchia il giorno prima: le occorrenze passate
      -- restano, ma non ne nascono altre.
      update serie_ricorrenti
         set fine_tipo      = 'data',
             fine_data      = ((ev.inizio_utc at time zone ev.fuso_origine)::date - 1),
             fine_conteggio = null
       where id = v_vecchia;
    end if;
  end if;

  perform genera_occorrenze(v_serie);
  return v_serie;
end;
$$;

grant execute on function aggiorna_serie_da(uuid, text, integer, text, date, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- elimina_serie_da — "questa e le successive", ma cancellando
-- ---------------------------------------------------------------------------
create or replace function elimina_serie_da(p_evento uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ev        eventi;
  v_serie   uuid;
  v_tolte   integer;
  v_restano integer;
begin
  select * into ev
    from eventi
   where id = p_evento and utente_id = auth.uid() and id_esterno is null;
  if not found then
    raise exception 'Evento non tuo o non cancellabile';
  end if;

  v_serie := ev.serie_id;
  if v_serie is null then
    delete from eventi where id = p_evento;
    return 1;
  end if;

  delete from eventi where serie_id = v_serie and inizio_utc >= ev.inizio_utc;
  get diagnostics v_tolte = row_count;

  select count(*) into v_restano from eventi where serie_id = v_serie;
  if v_restano = 0 then
    delete from serie_ricorrenti where id = v_serie;
  else
    update serie_ricorrenti
       set fine_tipo      = 'data',
           fine_data      = ((ev.inizio_utc at time zone ev.fuso_origine)::date - 1),
           fine_conteggio = null
     where id = v_serie;
  end if;

  return v_tolte;
end;
$$;

grant execute on function elimina_serie_da(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- stacca_serie_da — "da qui in poi non si ripete piu'"
-- ---------------------------------------------------------------------------
-- Togliere la ripetizione non e' cancellare: questa occorrenza resta, e resta
-- il passato. Spariscono solo le volte che dovevano ancora venire.
create or replace function stacca_serie_da(p_evento uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ev        eventi;
  v_serie   uuid;
  v_tolte   integer := 0;
  v_restano integer;
begin
  select * into ev
    from eventi
   where id = p_evento and utente_id = auth.uid() and id_esterno is null;
  if not found then
    raise exception 'Evento non tuo o non modificabile';
  end if;

  v_serie := ev.serie_id;
  if v_serie is null then return 0; end if;

  delete from eventi
   where serie_id = v_serie and inizio_utc > ev.inizio_utc and id <> p_evento;
  get diagnostics v_tolte = row_count;

  update eventi set serie_id = null where id = p_evento;

  select count(*) into v_restano from eventi where serie_id = v_serie;
  if v_restano = 0 then
    delete from serie_ricorrenti where id = v_serie;
  else
    update serie_ricorrenti
       set fine_tipo      = 'data',
           fine_data      = ((ev.inizio_utc at time zone ev.fuso_origine)::date - 1),
           fine_conteggio = null
     where id = v_serie;
  end if;

  return v_tolte;
end;
$$;

grant execute on function stacca_serie_da(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- estendi_serie — la manutenzione notturna
-- ---------------------------------------------------------------------------
-- Una serie senza fine e' generata 24 mesi alla volta: ogni notte si allunga
-- di quello che nel frattempo e' entrato nell'orizzonte. Le serie chiuse (per
-- data o per conteggio) escono da sole, perche' `genera_occorrenze` non ha piu'
-- niente da creare.
create or replace function estendi_serie()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  totale integer := 0;
begin
  for r in
    select id from serie_ricorrenti
     where fine_tipo <> 'data' or fine_data >= current_date
  loop
    totale := totale + genera_occorrenze(r.id);
  end loop;
  return totale;
end;
$$;

create extension if not exists pg_cron;

-- Alle 3:17 UTC: un'ora in cui nessuno guarda il calendario, e sfalsata dal
-- minuto tondo per non accodarsi agli altri job.
select cron.unschedule(jobid) from cron.job where jobname = 'estendi-serie-ogni-notte';

select cron.schedule('estendi-serie-ogni-notte', '17 3 * * *', $cron$ select estendi_serie(); $cron$);

-- Come si controlla:
--   select * from serie_ricorrenti;
--   select count(*), serie_id from eventi where serie_id is not null group by serie_id;
