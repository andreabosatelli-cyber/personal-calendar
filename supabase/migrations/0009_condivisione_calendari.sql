-- 0009_condivisione_calendari.sql
-- Calendari condivisi fra account registrati, modello Outlook.
--
-- Il link pubblico di 0006 resta quello che e': un capability URL per chiunque,
-- che mostra solo blocchi occupati. Questa e' un'altra cosa: il proprietario
-- sceglie UNA PERSONA con un account sull'app e le da' accesso al proprio
-- calendario, con tre livelli di permesso:
--
--   occupato  -> vede solo quando sei occupato, mai i titoli
--   dettagli  -> vede gli eventi per intero, in sola lettura
--   prenota   -> vede tutto e puo' fissarti impegni, che nascono 'in_attesa'
--                e finiscono nella campanella delle richieste da approvare
--
-- La scrittura del delegato passa dalla stessa porta delle richieste pubbliche:
-- nessun evento entra nel calendario di qualcun altro gia' confermato.

-- ---------------------------------------------------------------------------
-- 1) Chi ha creato l'evento (serve a dire "fissato da Sara", e a lasciare al
--    delegato la possibilita' di ritirare una richiesta che ha mandato lui)
-- ---------------------------------------------------------------------------
alter table eventi add column if not exists creato_da uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2) Tabella condivisioni
-- ---------------------------------------------------------------------------
create table if not exists condivisioni (
  id                 uuid primary key default gen_random_uuid(),
  proprietario_id    uuid not null references auth.users(id) on delete cascade,
  -- L'email e' la chiave dell'invito: si puo' invitare qualcuno che non si e'
  -- ancora registrato, e destinatario_id si riempie al momento della sua
  -- registrazione (trigger su_nuovo_utente, piu' sotto).
  destinatario_email text not null,
  destinatario_id    uuid references auth.users(id) on delete cascade,
  permesso           text not null default 'dettagli',
  creato_il          timestamptz not null default now(),
  constraint condivisioni_permesso_chk check (permesso in ('occupato', 'dettagli', 'prenota')),
  constraint condivisioni_non_se_stessi check (destinatario_id is null or destinatario_id <> proprietario_id),
  unique (proprietario_id, destinatario_email)
);

create index if not exists condivisioni_destinatario_idx on condivisioni (destinatario_id);

alter table condivisioni enable row level security;

-- Il proprietario governa le proprie condivisioni; il destinatario puo' solo
-- vederle e togliersele di torno.
drop policy if exists condivisioni_select on condivisioni;
create policy condivisioni_select on condivisioni
  for select using (proprietario_id = auth.uid() or destinatario_id = auth.uid());

drop policy if exists condivisioni_update on condivisioni;
create policy condivisioni_update on condivisioni
  for update using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());

drop policy if exists condivisioni_delete on condivisioni;
create policy condivisioni_delete on condivisioni
  for delete using (proprietario_id = auth.uid() or destinatario_id = auth.uid());

-- Niente policy di INSERT: l'invito passa dalla RPC, che e' l'unica a poter
-- risolvere un'email in un account (auth.users non e' leggibile dal client).

-- ---------------------------------------------------------------------------
-- 3) Che permesso ho io sul calendario di X.
--    security definer: la chiamano le policy di `eventi`, e deve poter leggere
--    condivisioni senza ricadere nelle policy di chi sta interrogando.
-- ---------------------------------------------------------------------------
create or replace function permesso_su(p_proprietario uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.permesso
  from condivisioni c
  where c.proprietario_id = p_proprietario
    and c.destinatario_id = auth.uid()
  limit 1;
$$;

grant execute on function permesso_su(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS su eventi: lettura per i delegati, scrittura solo come richiesta
-- ---------------------------------------------------------------------------
-- La lettura diretta della tabella e' per chi ha 'dettagli' o 'prenota'.
-- Il livello 'occupato' NON passa di qui: la RLS filtra righe, non colonne, e
-- lasciarlo entrare vorrebbe dire dargli anche i titoli. Per lui c'e' la RPC
-- del punto 6, che restituisce solo gli istanti.
drop policy if exists eventi_select on eventi;
create policy eventi_select on eventi
  for select using (
    utente_id = auth.uid()
    or permesso_su(utente_id) in ('dettagli', 'prenota')
  );

-- Il delegato con 'prenota' inserisce solo richieste da approvare, firmate col
-- proprio id: mai un evento gia' confermato, mai per conto di un terzo.
drop policy if exists eventi_insert_delegato on eventi;
create policy eventi_insert_delegato on eventi
  for insert with check (
    utente_id <> auth.uid()
    and permesso_su(utente_id) = 'prenota'
    and origine = 'personale'
    and stato = 'in_attesa'
    and creato_da = auth.uid()
  );

-- Ritirare la propria richiesta finche' e' in attesa: e' roba sua, e il
-- proprietario non ha ancora deciso nulla.
drop policy if exists eventi_delete_delegato on eventi;
create policy eventi_delete_delegato on eventi
  for delete using (
    utente_id <> auth.uid()
    and creato_da = auth.uid()
    and stato = 'in_attesa'
    and permesso_su(utente_id) = 'prenota'
  );

-- ---------------------------------------------------------------------------
-- 5) Invito: email -> account. Idempotente, cosi' reinvitare qualcuno cambia
--    il permesso invece di fallire sul vincolo di unicita'.
-- ---------------------------------------------------------------------------
create or replace function condivisione_invita(p_email text, p_permesso text default 'dettagli')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare em text; uid uuid; mia_email text;
begin
  em := lower(btrim(coalesce(p_email, '')));
  if em = '' then raise exception 'Enter an email address'; end if;
  if p_permesso not in ('occupato', 'dettagli', 'prenota') then
    raise exception 'Unknown permission level';
  end if;

  select lower(u.email) into mia_email from auth.users u where u.id = auth.uid();
  if em = mia_email then raise exception 'That is your own account'; end if;

  select u.id into uid from auth.users u where lower(u.email) = em;

  insert into condivisioni (proprietario_id, destinatario_email, destinatario_id, permesso)
  values (auth.uid(), em, uid, p_permesso)
  on conflict (proprietario_id, destinatario_email) do update
    set permesso        = excluded.permesso,
        destinatario_id = coalesce(condivisioni.destinatario_id, excluded.destinatario_id);
end;
$$;

grant execute on function condivisione_invita(text, text) to authenticated;

-- Un invito mandato a chi non si era ancora registrato si attacca al suo
-- account appena nasce.
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

  update public.condivisioni
     set destinatario_id = new.id
   where destinatario_id is null
     and destinatario_email = lower(new.email)
     and proprietario_id <> new.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Cosa vede il destinatario
-- ---------------------------------------------------------------------------
-- I calendari condivisi con me, col nome e il fuso del proprietario: senza
-- questa il client avrebbe solo un uuid da mettere nella sidebar.
create or replace function condivisi_con_me()
returns table (
  id uuid,
  proprietario_id uuid,
  nome text,
  email text,
  fuso text,
  permesso text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.proprietario_id,
         coalesce(nullif(btrim(p.nome_visualizzato), ''), split_part(u.email, '@', 1)),
         u.email,
         coalesce(p.fuso_base, 'UTC'),
         c.permesso
  from condivisioni c
  join auth.users u on u.id = c.proprietario_id
  left join preferenze p on p.utente_id = c.proprietario_id
  where c.destinatario_id = auth.uid()
  order by 3;
$$;

grant execute on function condivisi_con_me() to authenticated;

-- Livello 'occupato': solo gli istanti, nessun titolo, nessun luogo. Stessa
-- forma dei blocchi della pagina pubblica, ma legata all'account invece che al
-- token, e con l'id vero cosi' il client ha una chiave di lista.
create or replace function condiviso_impegni_utente(p_proprietario uuid, p_da timestamptz, p_a timestamptz)
returns table (id uuid, inizio_utc timestamptz, fine_utc timestamptz, tutto_il_giorno boolean)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.inizio_utc, e.fine_utc, e.tutto_il_giorno
  from eventi e
  where e.utente_id = p_proprietario
    and permesso_su(p_proprietario) is not null
    and e.stato = 'confermato'
    and e.inizio_utc <= p_a
    and e.fine_utc >= p_da
  order by e.inizio_utc;
$$;

grant execute on function condiviso_impegni_utente(uuid, timestamptz, timestamptz) to authenticated;
