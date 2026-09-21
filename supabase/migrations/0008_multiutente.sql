-- 0008_multiutente.sql
-- Da calendario personale ad app multi-utente: chiunque riceva il link puo'
-- registrarsi e usare SmartCal come calendario proprio.
--
-- Cosa cambia, in ordine di importanza:
--  1) SYNC. La Edge Function importava il feed ICS del secret globale
--     nell'account di CHIUNQUE la invocasse. Ora e' un privilegio esplicito:
--     preferenze.sync_abilitato, falso per default, vero solo per l'owner.
--  2) FUSI. Roma non e' piu' il secondo fuso di tutti: ogni utente sceglie il
--     proprio fuso di riferimento (o nessuno, e il calendario resta mono-fuso)
--     e il proprio orario d'ufficio.
--  3) IDENTITA'. Nome visualizzato ed etichette delle categorie sono per
--     utente: la pagina pubblica non dice piu' "Andrea" a tutti.
--
-- Le quattro categorie restano quelle dell'enum (lavoro/universita/personale/
-- viaggi): cambia solo come si chiamano a schermo.

-- ---------------------------------------------------------------------------
-- 1) Nuove colonne di preferenze
-- ---------------------------------------------------------------------------
alter table preferenze add column if not exists fuso_riferimento     text;
alter table preferenze add column if not exists etichetta_riferimento text;
alter table preferenze add column if not exists nome_visualizzato    text;
alter table preferenze add column if not exists nomi_categorie       jsonb   not null default '{}'::jsonb;
alter table preferenze add column if not exists ufficio_inizio       smallint not null default 9;
alter table preferenze add column if not exists ufficio_fine         smallint not null default 18;
alter table preferenze add column if not exists sync_abilitato       boolean not null default false;
alter table preferenze add column if not exists onboarding_fatto     boolean not null default false;

do $$ begin
  alter table preferenze add constraint preferenze_ufficio_chk
    check (ufficio_inizio between 0 and 23 and ufficio_fine between 1 and 24 and ufficio_fine > ufficio_inizio);
exception when duplicate_object then null; end $$;

-- Il fuso di default non e' piu' Singapore: un nuovo utente parte da UTC e
-- l'onboarding lo sovrascrive col fuso del browser al primo accesso.
alter table preferenze alter column fuso_base      set default 'UTC';
alter table preferenze alter column etichetta_base set default 'UTC';

-- ---------------------------------------------------------------------------
-- 2) Backfill: gli account gia' esistenti sono quelli di prima e non devono
--    accorgersi di nulla (Singapore + Roma, sync attiva, niente onboarding).
-- ---------------------------------------------------------------------------
update preferenze
   set fuso_riferimento      = coalesce(fuso_riferimento, 'Europe/Rome'),
       etichetta_riferimento = coalesce(etichetta_riferimento, 'Italy'),
       sync_abilitato        = true,
       onboarding_fatto      = true;

-- ---------------------------------------------------------------------------
-- 3) Pagina pubblica: profilo dell'owner dal token (nome + fuso), cosi' la
--    schermata di prenotazione smette di avere "Andrea" e Singapore cablati.
-- ---------------------------------------------------------------------------
create or replace function condiviso_profilo(p_token uuid)
returns table (nome text, fuso text, etichetta text)
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(p.nome_visualizzato), ''), 'This calendar'),
         p.fuso_base,
         p.etichetta_base
  from preferenze p
  where p.token_condivisione = p_token;
$$;

grant execute on function condiviso_profilo(uuid) to anon;

-- ---------------------------------------------------------------------------
-- 4) La richiesta pubblica ancorava l'evento a 'Asia/Singapore': va ancorato
--    al fuso di chi possiede il calendario.
-- ---------------------------------------------------------------------------
create or replace function condiviso_richiedi(
  p_token uuid, p_nome text, p_titolo text, p_inizio timestamptz, p_fine timestamptz, p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid; fuso text;
begin
  select utente_id, fuso_base into uid, fuso from preferenze where token_condivisione = p_token;
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
    p_inizio, p_fine, coalesce(fuso, 'UTC'), false, 'in_attesa', btrim(p_nome),
    nullif(btrim(coalesce(p_link, '')), '')
  );
end;
$$;

grant execute on function condiviso_richiedi(uuid, text, text, timestamptz, timestamptz, text) to anon;
