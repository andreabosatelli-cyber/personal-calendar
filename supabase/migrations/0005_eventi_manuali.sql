-- 0005_eventi_manuali.sql
-- Permette all'utente di creare eventi manuali di QUALSIASI categoria
-- (personale, viaggi, lavoro, universita) senza che la sync/seed li cancelli.
--
-- Convenzione: id_esterno IS NULL  ⇔  evento MANUALE (creato dall'utente)
--              id_esterno NOT NULL ⇔  evento IMPORTATO (ICS lavoro / seed uni)
--
-- RLS: il client può CRUD solo gli eventi manuali (id_esterno null), di ogni
-- categoria. Gli importati restano di sola lettura lato client (li tocca solo
-- il service_role di sync/seed).

drop policy if exists eventi_insert_utente on eventi;
drop policy if exists eventi_update_utente on eventi;
drop policy if exists eventi_delete_utente on eventi;
drop policy if exists eventi_insert_personale on eventi;
drop policy if exists eventi_update_personale on eventi;
drop policy if exists eventi_delete_personale on eventi;

create policy eventi_insert_manuale on eventi
  for insert
  with check (utente_id = auth.uid() and id_esterno is null);

create policy eventi_update_manuale on eventi
  for update
  using (utente_id = auth.uid() and id_esterno is null)
  with check (utente_id = auth.uid() and id_esterno is null);

create policy eventi_delete_manuale on eventi
  for delete
  using (utente_id = auth.uid() and id_esterno is null);

-- La sync (full-replace di una sorgente importata) deve cancellare SOLO gli
-- eventi importati di quella sorgente, preservando quelli manuali della stessa
-- categoria. Aggiungiamo il filtro id_esterno IS NOT NULL alla DELETE.
create or replace function sostituisci_eventi_sorgente(
  p_utente  uuid,
  p_origine origine_evento,
  p_eventi  jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from eventi
   where utente_id = p_utente
     and origine = p_origine
     and id_esterno is not null;   -- preserva gli eventi manuali

  insert into eventi (
    utente_id, origine, titolo, descrizione, luogo,
    inizio_utc, fine_utc, fuso_origine, tutto_il_giorno, id_esterno
  )
  select
    p_utente,
    p_origine,
    coalesce(e->>'titolo', '(senza titolo)'),
    e->>'descrizione',
    e->>'luogo',
    (e->>'inizio_utc')::timestamptz,
    (e->>'fine_utc')::timestamptz,
    e->>'fuso_origine',
    coalesce((e->>'tutto_il_giorno')::boolean, false),
    e->>'id_esterno'
  from jsonb_array_elements(p_eventi) as e;

  get diagnostics n = row_count;

  update preferenze
     set ultimo_sync = ultimo_sync
       || jsonb_build_object(
            p_origine::text,
            jsonb_build_object('quando', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'conteggio', n)
          )
   where utente_id = p_utente;

  return n;
end;
$$;
