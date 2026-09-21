-- RPC di sostituzione atomica degli eventi di una sorgente importata.
-- Usata dalla Edge Function sync-calendari (full-replace, brief §5):
-- delete + insert in un'unica transazione (il corpo della funzione è atomico),
-- più lo stamp di preferenze.ultimo_sync per quella sorgente.
--
-- Viene chiamata SOLO a fetch+parse riusciti. Se il fetch fallisce, la Edge
-- Function non la invoca e i dati vecchi restano intatti.

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
     and origine = p_origine;

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
