-- 0004_viaggi.sql
-- Nuova categoria evento 'viaggi', creabile/modificabile dal client come 'personale'.
-- Le policy usano origine::text per NON referenziare il nuovo valore enum come
-- literal nella stessa transazione (evita "unsafe use of new enum value").

-- 1) aggiunge il valore all'enum
alter type origine_evento add value if not exists 'viaggi';

-- 2) sostituisce le policy "solo personale" con "personale + viaggi"
drop policy if exists eventi_insert_personale on eventi;
drop policy if exists eventi_update_personale on eventi;
drop policy if exists eventi_delete_personale on eventi;

create policy eventi_insert_utente on eventi
  for insert
  with check (utente_id = auth.uid() and origine::text in ('personale', 'viaggi'));

create policy eventi_update_utente on eventi
  for update
  using (utente_id = auth.uid() and origine::text in ('personale', 'viaggi'))
  with check (utente_id = auth.uid() and origine::text in ('personale', 'viaggi'));

create policy eventi_delete_utente on eventi
  for delete
  using (utente_id = auth.uid() and origine::text in ('personale', 'viaggi'));
