-- 0011_cron_promemoria.sql
-- Chi sveglia i promemoria: pg_cron chiama la Edge Function `promemoria` una
-- volta al minuto.
--
-- Perche' ogni minuto e non ogni cinque: l'anticipo lo sceglie l'utente (5, 10,
-- 15, 30, 60 minuti) e un giro piu' lento sposterebbe l'avviso di quanto dura
-- il giro. Un minuto e' anche la precisione che possiamo promettere.
--
-- Sull'autorizzazione: la chiamata porta la ANON key, non la service_role.
-- L'anon key e' gia' pubblica (viaggia dentro il bundle del browser), quindi
-- metterla qui non espone niente di nuovo, mentre la service_role scritta in
-- chiaro dentro un job sarebbe una credenziale di troppo depositata nel
-- database. La Edge Function i suoi poteri li prende dalla propria env, non da
-- questa chiamata.
--
-- ATTENZIONE: il job qui sotto contiene la anon key del progetto, che cambia da
-- progetto a progetto. Sostituire <ANON_KEY> prima di eseguirlo altrove.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Rischedulare e' idempotente: prima si toglie il job vecchio, se c'e'.
select cron.unschedule(jobid) from cron.job where jobname = 'promemoria-ogni-minuto';

select cron.schedule('promemoria-ogni-minuto', '* * * * *', $cron$
  select net.http_post(
    url := 'https://qwhsniusmhysehudxfqv.supabase.co/functions/v1/promemoria',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);

-- Come si controlla che stia girando:
--   select status, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
-- La seconda mostra la risposta della function: {"inviate":N,"eventi":M}.
