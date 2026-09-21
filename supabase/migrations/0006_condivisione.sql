-- 0006_condivisione.sql
-- Condivisione del calendario tramite link (capability URL con token) + richieste
-- di appuntamento da approvare.
--
-- Modello: ogni utente ha un token_condivisione (uuid, non indovinabile). Chi apre
-- il link vede solo gli ORARI occupati (nessun titolo/dettaglio) e può inserire una
-- richiesta (stato 'in_attesa') che il proprietario approva o rifiuta.
-- L'accesso pubblico passa SOLO da due funzioni security-definer validate dal token
-- (l'anon non ha accesso diretto alle tabelle).

-- 1) token per utente
alter table preferenze add column if not exists token_condivisione uuid;
update preferenze set token_condivisione = gen_random_uuid() where token_condivisione is null;
alter table preferenze alter column token_condivisione set default gen_random_uuid();
alter table preferenze alter column token_condivisione set not null;

-- 2) stato + richiedente sugli eventi
alter table eventi add column if not exists stato text not null default 'confermato';
alter table eventi add column if not exists richiedente text;
do $$ begin
  alter table eventi add constraint eventi_stato_chk check (stato in ('confermato', 'in_attesa'));
exception when duplicate_object then null; end $$;

-- 3) RPC pubblica: orari occupati (solo istanti, stato confermato) per un token
create or replace function condiviso_impegni(p_token uuid, p_da timestamptz, p_a timestamptz)
returns table (inizio_utc timestamptz, fine_utc timestamptz, tutto_il_giorno boolean)
language sql
security definer
set search_path = public
as $$
  select e.inizio_utc, e.fine_utc, e.tutto_il_giorno
  from eventi e
  join preferenze p on p.utente_id = e.utente_id
  where p.token_condivisione = p_token
    and e.stato = 'confermato'
    and e.inizio_utc <= p_a
    and e.fine_utc >= p_da
  order by e.inizio_utc;
$$;

-- 4) RPC pubblica: crea una richiesta di appuntamento (in attesa di approvazione)
create or replace function condiviso_richiedi(
  p_token uuid, p_nome text, p_titolo text, p_inizio timestamptz, p_fine timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  select utente_id into uid from preferenze where token_condivisione = p_token;
  if uid is null then raise exception 'Link non valido'; end if;
  if coalesce(btrim(p_nome), '') = '' or coalesce(btrim(p_titolo), '') = '' then
    raise exception 'Nome e titolo dell''appuntamento sono obbligatori';
  end if;
  if p_fine <= p_inizio then raise exception 'Orario di fine non valido'; end if;
  if char_length(p_nome) > 120 or char_length(p_titolo) > 160 then
    raise exception 'Testo troppo lungo';
  end if;
  insert into eventi (
    utente_id, origine, titolo, descrizione, inizio_utc, fine_utc,
    fuso_origine, tutto_il_giorno, stato, richiedente
  ) values (
    uid, 'personale', btrim(p_titolo), 'Richiesta da ' || btrim(p_nome),
    p_inizio, p_fine, 'Asia/Singapore', false, 'in_attesa', btrim(p_nome)
  );
end;
$$;

-- 5) accesso pubblico SOLO alle due funzioni (validate dal token)
grant execute on function condiviso_impegni(uuid, timestamptz, timestamptz) to anon;
grant execute on function condiviso_richiedi(uuid, text, text, timestamptz, timestamptz) to anon;
