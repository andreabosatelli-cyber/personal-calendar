-- 0007_link_video.sql
-- Campo "Link videochiamata" (Google Meet / Teams / Zoom / qualsiasi URL) sugli eventi,
-- e aggiornamento della RPC pubblica di richiesta per accettarlo.

alter table eventi add column if not exists link_video text;

-- Ricrea condiviso_richiedi con il parametro opzionale p_link.
drop function if exists condiviso_richiedi(uuid, text, text, timestamptz, timestamptz);

create or replace function condiviso_richiedi(
  p_token uuid, p_nome text, p_titolo text, p_inizio timestamptz, p_fine timestamptz, p_link text default null
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
  if char_length(p_nome) > 120 or char_length(p_titolo) > 160 or char_length(coalesce(p_link, '')) > 500 then
    raise exception 'Testo troppo lungo';
  end if;
  insert into eventi (
    utente_id, origine, titolo, descrizione, inizio_utc, fine_utc,
    fuso_origine, tutto_il_giorno, stato, richiedente, link_video
  ) values (
    uid, 'personale', btrim(p_titolo), 'Richiesta da ' || btrim(p_nome),
    p_inizio, p_fine, 'Asia/Singapore', false, 'in_attesa', btrim(p_nome),
    nullif(btrim(coalesce(p_link, '')), '')
  );
end;
$$;

grant execute on function condiviso_richiedi(uuid, text, text, timestamptz, timestamptz, text) to anon;
