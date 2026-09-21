-- 0014_google_calendario_app.sql
-- Da "scrivo sul tuo calendario principale" a "mi tengo un calendario mio".
--
-- PERCHE': l'ambito `calendar.events` — quello che permette di toccare tutti i
-- calendari dell'account, compreso il principale — Google lo classifica come
-- SENSIBILE. Un'app che lo chiede, per uscire dallo stato "Test" e funzionare
-- per sempre, deve passare dalla verifica di Google. Restando in Test, invece,
-- il consenso scade ogni 7 giorni: inaccettabile per una cosa che deve stare
-- in piedi da sola.
--
-- `calendar.app.created` e' NON sensibile (verificato nella console Google):
-- permette di creare calendari secondari e di gestire gli eventi SOLO dentro
-- quelli. Niente verifica, niente schermata "app non verificata", consenso che
-- non scade. E come effetto secondario e' anche piu' pulito: gli eventi di
-- SmartCal finiscono in un calendario "SmartCal" a parte, che su Google si
-- accende, si spegne e si colora per conto suo, e che non puo' in nessun caso
-- toccare gli eventi creati a mano li' dentro.
--
-- Il calendario lo crea la Edge Function al primo giro e se ne ricorda qui.

alter table google_account alter column calendario_id drop not null;
alter table google_account alter column calendario_id drop default;

-- Come si chiama di la': serve a dirlo in Settings, ora che non chiediamo piu'
-- l'email dell'account Google (un permesso in meno da domandare).
alter table google_account add column if not exists calendario_nome text;

-- Nessuno ha ancora collegato niente, ma se qualcuno l'avesse fatto durante la
-- finestra in cui il default era 'primary', quel valore ora non vale piu':
-- azzerarlo fa ricreare il calendario dedicato al primo giro.
update google_account set calendario_id = null where calendario_id = 'primary';

-- ---------------------------------------------------------------------------
-- google_stato: il nome del calendario al posto dell'email
-- ---------------------------------------------------------------------------
drop function if exists google_stato();

create or replace function google_stato()
returns table (
  collegato        boolean,
  email_google     text,
  calendario_id    text,
  calendario_nome  text,
  abilitato        boolean,
  ultimo_sync      timestamptz,
  ultimo_errore    text,
  in_coda          integer
)
language sql
security definer
set search_path = public
as $$
  select
    true,
    g.email_google,
    g.calendario_id,
    g.calendario_nome,
    g.abilitato,
    g.ultimo_sync,
    g.ultimo_errore,
    (select count(*)::int from coda_google c where c.utente_id = g.utente_id and c.tentativi < 5)
  from google_account g
  where g.utente_id = auth.uid();
$$;

grant execute on function google_stato() to authenticated;
