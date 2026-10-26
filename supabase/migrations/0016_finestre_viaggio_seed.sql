-- 0016_finestre_viaggio_seed.sql
-- Finestre, proposte ed eventi dal file "11 Viaggi/Finestre_e_proposte.md"
-- (versione del 26/10/2026, planning GEM del 22/10). Solo per l'account owner.
-- Idempotente: rilanciarla non duplica niente e non tocca stato e note gia'
-- cambiati dall'app.
--
-- Stati del file → stato:
--   "deciso, da prenotare", "da prenotare entro"  → da_prenotare
--   "idea", "da decidere", "weekend con la ragazza" → idea
-- Ore di volo: solo dove il file le indica (minuti, voli diretti da Changi).

do $$
declare
  u uuid;
  w uuid;
  sgt constant text := 'Asia/Singapore';
begin
  select id into u from auth.users where email = 'andrea.bosatelli@gmail.com';
  if u is null then
    raise notice 'Utente owner non trovato: seed saltato';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Finestre
  -- -------------------------------------------------------------------------
  insert into travel_windows
    (utente_id, codice, titolo, inizio, fine, giorni, ultima_lezione_prima, prima_lezione_dopo,
     deadline_prenotazione, stato, note, manuale, salta_lezioni)
  values
    (u, 'A', 'Deepavali', '2026-11-07', '2026-11-09', 3,
     timestamp '2026-11-06 15:30' at time zone sgt, timestamp '2026-11-10 08:30' at time zone sgt,
     '2026-10-28', 'idea', 'Deepavali l''8 (festivo a Singapore).', false, '{}'),
    (u, 'BKK', 'Bangkok', '2026-11-13', '2026-11-18', 5,
     timestamp '2026-11-13 15:30' at time zone sgt, timestamp '2026-11-19 12:30' at time zone sgt,
     '2026-10-26', 'da_prenotare',
     'Deciso. Partenza ven 13/11 sera. Si salta solo lun 16/11 (SAM + DAFM, 6 h): novembre al 90,6%, zero margine. Prenotare subito.',
     true, '{2026-11-16}'),
    (u, 'LK', 'Loy Krathong', '2026-11-24', '2026-11-25', 2,
     timestamp '2026-11-23 18:30' at time zone sgt, timestamp '2026-11-26 12:30' at time zone sgt,
     '2026-10-30', 'idea', '2 giorni + le sere. Loy Krathong / Yi Peng il 25/11.', true, '{}'),
    (u, 'B', null, '2026-11-27', '2026-11-29', 3,
     timestamp '2026-11-26 15:30' at time zone sgt, timestamp '2026-11-30 08:30' at time zone sgt,
     '2026-11-06', 'idea', null, false, '{}'),
    (u, 'C1', 'Da solo', '2026-12-08', '2026-12-20', 13,
     timestamp '2026-12-07 18:30' at time zone sgt, null,
     '2026-11-02', 'idea', 'Da decidere (da solo). In alternativa: restare a Singapore e risparmiare per C2.', false, '{}'),
    (u, 'C2', 'Con la ragazza', '2026-12-21', '2027-01-03', 14,
     null, timestamp '2027-01-04 15:30' at time zone sgt,
     '2026-10-30', 'da_prenotare',
     'Da prenotare per primo: Natale e Capodanno sono altissima stagione, i voli salgono già da novembre. Lei è a Singapore 21/12-10/01.',
     false, '{}'),
    (u, 'C3', 'Weekend con la ragazza', '2027-01-09', '2027-01-10', 2,
     timestamp '2027-01-08 15:30' at time zone sgt, timestamp '2027-01-11 15:30' at time zone sgt,
     '2026-11-30', 'idea', 'Dal 4 all''8/01 ci sono lezioni (AFSA 4-8/01, DAFM 5/01): quei giorni si sta a Singapore.', true, '{}'),
    (u, 'D', null, '2027-01-13', '2027-01-17', 5,
     timestamp '2027-01-12 15:30' at time zone sgt, timestamp '2027-01-18 12:30' at time zone sgt,
     '2026-12-01', 'idea', null, false, '{}'),
    (u, 'E', null, '2027-01-19', '2027-01-24', 6,
     timestamp '2027-01-18 18:30' at time zone sgt, timestamp '2027-01-25 12:30' at time zone sgt,
     '2026-12-07', 'idea', null, false, '{}'),
    (u, 'F', 'Capodanno cinese', '2027-02-04', '2027-02-08', 5,
     timestamp '2027-02-03 18:30' at time zone sgt, timestamp '2027-02-09 08:30' at time zone sgt,
     '2026-11-15', 'idea', 'Prezzi alti: prenotare entro metà novembre.', false, '{}'),
    (u, 'G', 'Fine corso', '2027-02-23', '2027-03-02', 8,
     timestamp '2027-02-22 15:30' at time zone sgt, null,
     '2026-12-15', 'idea',
     '8+ giorni, anche dopo la fine del corso. Il contratto Cove finisce il 2/03: il viaggio può fare da ponte verso il rientro in Italia.',
     false, '{}')
  on conflict (utente_id, codice) do nothing;

  -- -------------------------------------------------------------------------
  -- Proposte: inserite solo se la finestra non ne ha ancora
  -- -------------------------------------------------------------------------
  create temp table _p (
    codice text, ordine int, destinazione text, minuti_volo int, trasporto text, stagione text,
    meteo text, budget text, eventi text, note text, consigliata boolean, sconsigliata boolean
  ) on commit drop;

  insert into _p values
    ('A', 1, 'Penang', 80, null, null, null, 'ok', null, 'Street food, George Town.', false, false),
    ('A', 2, 'Ho Chi Minh', 120, null, 'Inizio della stagione secca al sud', 'buono', 'ok', null, null, false, false),
    ('A', 3, 'Costa est della Malesia (Tioman, Perhentian)', null, null, 'Monsone da novembre, isole chiuse', 'sconsigliato', null, null, null, false, true),

    ('LK', 1, 'Chiang Mai', 180, 'Diretto o via Bangkok', 'Nord secco e fresco', 'ottimo', 'stretto', 'Loy Krathong / Yi Peng il 25/11',
     'Alloggi cari in quei giorni. Arriva subito dopo Bangkok: valutare se vale un secondo viaggio.', false, false),

    ('B', 1, 'Kuala Lumpur', 60, null, null, null, 'ok', null, null, false, false),
    ('B', 2, 'Malacca', null, 'Bus 4h', null, null, 'ok', null, null, false, false),
    ('B', 3, 'Bintan / Batam', null, 'Traghetto 1h', 'Inizia la stagione delle piogge', 'incerto', 'ok', null, 'Weekend di mare economico.', false, false),

    ('C1', 1, 'Vietnam da nord a sud', 200, null, 'Al nord fresco e secco, Hoi An a fine stagione delle piogge', 'buono', 'ok', null,
     'Hanoi, Ninh Binh, Ha Long, poi Hoi An e Saigon. Volo per Hanoi.', false, false),
    ('C1', 2, 'Laos + nord della Thailandia', null, null, 'Stagione secca, fresco', 'ottimo', 'ok', null, 'Luang Prabang, Chiang Mai, Chiang Rai.', false, false),
    ('C1', 3, 'Giappone prima di Natale', 420, null, null, null, 'stretto', null, 'Tokyo, Kyoto, Osaka. Al limite dei 100 €/giorno, solo con ostelli.', false, false),
    ('C1', 4, 'Restare a Singapore', null, null, null, null, 'ok', null, 'Lavorare e risparmiare per C2.', false, false),

    ('C2', 1, 'Sri Lanka', 220, null, 'Costa sud-ovest in piena stagione secca da dicembre', 'ottimo', 'ok', 'Capodanno al mare',
     'Ottimo rapporto qualità-prezzo. Giro: Colombo → Galle → Mirissa (balene) → Ella (treno) → Kandy → Sigiriya.', true, false),
    ('C2', 2, 'Vietnam + Cambogia', null, null, 'Sud secco; Angkor fresco e secco a dicembre', 'ottimo', 'ok', null,
     'Saigon e il Mekong, Phu Quoc (mare), Siem Reap per Angkor.', false, false),
    ('C2', 3, 'Thailandia, mare delle Andamane', null, null, 'Secco e soleggiato', 'ottimo', 'stretto', null,
     'Krabi, Koh Lanta, Koh Lipe. Sotto Natale i prezzi salgono, e Bangkok è già vista a novembre.', false, false),
    ('C2', 4, 'Filippine (Palawan)', null, null, 'A dicembre ancora qualche rischio tifoni', 'incerto', 'misto', null,
     'El Nido, Coron. Bellissimo, ma gli spostamenti sono lenti.', false, false),
    ('C2', 5, 'Bali e Indonesia', null, null, 'Stagione delle piogge', 'sconsigliato', null, null, null, false, true),
    ('C2', 6, 'Giappone a Capodanno', null, null, null, null, 'fuori', null, 'Per due persone a Capodanno, fuori budget.', false, true),

    ('C3', 1, 'Bintan', null, 'Traghetto', null, null, 'ok', null, null, false, false),
    ('C3', 2, 'Kuala Lumpur', 60, null, null, null, 'ok', null, null, false, false),

    ('D', 1, 'Krabi, Koh Lanta o Phuket', 100, null, 'Stagione perfetta', 'ottimo', 'misto', null, 'Volo 1h40-1h50.', false, false),
    ('D', 2, 'Siem Reap', 120, null, 'Angkor con il fresco', 'ottimo', 'ok', null, null, false, false),

    ('E', 1, 'Vietnam del sud', null, null, null, null, 'ok', null, 'Saigon e Phu Quoc.', false, false),
    ('E', 2, 'Luang Prabang', null, 'Con scalo', null, null, 'ok', null, null, false, false),
    ('E', 3, 'Filippine: Siargao o Cebu (Bohol)', null, null, 'Secco', 'buono', 'ok', null, null, false, false),

    ('F', 1, 'Sapporo Snow Festival', null, '8-10 h con scalo', null, null, 'fuori', 'Sapporo Snow Festival 4-11/02',
     'Hotel carissimi durante il festival: ha senso solo prenotando adesso.', false, false),
    ('F', 2, 'Penang o Taipei', null, null, null, null, 'stretto', 'Capodanno cinese 6-7/02',
     'Festa vera. Voli e hotel cari, da prenotare entro metà novembre.', false, false),
    ('F', 3, 'Vietnam', null, null, null, 'sconsigliato', null, 'Tet', 'Col Tet è tutto chiuso o pieno.', false, true),
    ('F', 4, 'Phuket o Krabi', null, null, null, null, 'stretto', null, 'Alternativa tranquilla.', false, false),

    ('G', 1, 'Filippine (Palawan, Siargao)', null, null, 'Piena stagione secca', 'ottimo', 'ok', null, null, false, false),
    ('G', 2, 'Vietnam centrale (Hoi An, Da Nang)', null, null, 'Inizia la stagione buona', 'buono', 'ok', null, null, false, false),
    ('G', 3, 'Sri Lanka', 220, null, null, null, 'ok', null, 'Se non ci sei stato a Natale.', false, false);

  insert into travel_proposals
    (utente_id, window_id, destinazione, minuti_volo, trasporto, stagione, meteo, budget, eventi, note, consigliata, sconsigliata, ordine)
  select u, tw.id, p.destinazione, p.minuti_volo, p.trasporto, p.stagione, p.meteo, p.budget, p.eventi, p.note,
         p.consigliata, p.sconsigliata, p.ordine
  from _p p
  join travel_windows tw on tw.utente_id = u and tw.codice = p.codice
  where not exists (select 1 from travel_proposals x where x.window_id = tw.id);

  -- -------------------------------------------------------------------------
  -- Eventi speciali e periodo "La ragazza a Singapore"
  -- -------------------------------------------------------------------------
  insert into travel_events (utente_id, titolo, inizio, fine, luogo, tipo)
  select u, v.titolo, v.inizio::date, v.fine::date, v.luogo, v.tipo
  from (values
    ('Deepavali', '2026-11-08', '2026-11-08', 'Little India (festivo a Singapore)', 'evento'),
    ('Loy Krathong / Yi Peng', '2026-11-25', '2026-11-25', 'Thailandia, soprattutto Chiang Mai', 'evento'),
    ('Capodanno', '2026-12-31', '2026-12-31', 'Marina Bay; spiagge in Thailandia o Sri Lanka', 'evento'),
    ('Sapporo Snow Festival', '2027-02-04', '2027-02-11', 'Hokkaido', 'evento'),
    ('Capodanno cinese', '2027-02-06', '2027-02-07', 'Chinatown, Penang, Taipei, Hong Kong (Tet in Vietnam)', 'evento'),
    ('La ragazza a Singapore', '2026-12-21', '2027-01-10', null, 'presenza')
  ) as v(titolo, inizio, fine, luogo, tipo)
  where not exists (
    select 1 from travel_events x where x.utente_id = u and x.titolo = v.titolo and x.inizio = v.inizio::date
  );
end $$;
