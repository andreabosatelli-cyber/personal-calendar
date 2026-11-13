-- 0017 — Un solo giro di google-sync alla volta.
--
-- La funzione la chiamano il cron (ogni minuto) e il client dopo ogni salvataggio. Due giri insieme leggono la stessa
-- voce di coda, fanno due POST su Google e solo un google_id finisce sulla riga: l'altra copia resta su Google come
-- doppione, e alla cancellazione diventa orfana. Prova del 2026-11-13: 20 salvataggi ravvicinati = 29 doppioni.
--
-- Un advisory lock di Postgres non basta: dalla Edge Function ogni chiamata PostgREST puo' finire su una connessione
-- diversa del pool. Qui il lock e' una riga con scadenza: si prende con un UPDATE condizionato (atomico: due UPDATE
-- concorrenti sulla stessa riga si mettono in fila e il secondo trova la scadenza gia' nel futuro), si rilascia con la
-- chiave. Se la funzione muore senza rilasciare, la scadenza lo libera da sola.

create table if not exists public.google_sync_lock (
  id int primary key default 1 check (id = 1),
  chiave uuid,
  preso_il timestamptz,
  scade_il timestamptz not null default '-infinity'
);
insert into public.google_sync_lock (id) values (1) on conflict (id) do nothing;

-- Solo la service role (Edge Function): nessuna policy, nessun grant ai ruoli dell'API.
alter table public.google_sync_lock enable row level security;
revoke all on public.google_sync_lock from anon, authenticated;

-- Prende il lock per p_secondi. Restituisce la chiave, o null se un altro giro lo tiene.
create or replace function public.google_sync_prendi(p_secondi int default 150)
returns uuid
language sql
volatile
set search_path = public
as $$
  update public.google_sync_lock
     set chiave = gen_random_uuid(), preso_il = now(), scade_il = now() + make_interval(secs => p_secondi)
   where id = 1 and scade_il < now()
  returning chiave;
$$;

-- Rilascia il lock, solo se e' ancora quello preso con questa chiave.
create or replace function public.google_sync_lascia(p_chiave uuid)
returns void
language sql
volatile
set search_path = public
as $$
  update public.google_sync_lock set chiave = null, scade_il = '-infinity' where id = 1 and chiave = p_chiave;
$$;

revoke execute on function public.google_sync_prendi(int) from public, anon, authenticated;
revoke execute on function public.google_sync_lascia(uuid) from public, anon, authenticated;
grant execute on function public.google_sync_prendi(int) to service_role;
grant execute on function public.google_sync_lascia(uuid) to service_role;
