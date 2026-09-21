-- 0003_universita_seed.sql
-- Calendario Università — MSc Finance & Investment Banking (GEM/SIM), sede SINGAPORE, A.A. 2026-2027.
-- Fonte: "23_07__2026_MSc_FIB_Singapore_2026_2027 TT v3.xlsx" (timetable provvisorio).
-- Orari in ora LOCALE di Singapore (UTC+8, no DST) → literal con offset +08.
-- Sorgente 'universita' = sola lettura lato client (RLS). Full-replace idempotente.
-- CORREZIONE APPLICATA: nel foglio il blocco gen–feb era datato 2026 (giorno/mese giusti,
--   ma 2026 dà i weekday sballati) → corretto all'anno 2027 del semestre 2026-2027.
-- 81 eventi generati il 2026-09-04.
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'andrea.bosatelli@gmail.com';
  if uid is null then raise exception 'utente andrea.bosatelli@gmail.com non trovato in auth.users'; end if;
  delete from eventi where utente_id = uid and origine = 'universita';   -- re-seed = sostituzione completa del calendario uni
  insert into eventi (utente_id, origine, titolo, descrizione, luogo, inizio_utc, fine_utc, fuso_origine, tutto_il_giorno, id_esterno) values
    (uid, 'universita', 'SIM Induction', 'SIM Induction 8h30-12h45', 'SIM · Singapore', '2026-10-12 08:30:00+08', '2026-10-12 11:30:00+08', 'Asia/Singapore', false, 'ttv3:0'),
    (uid, 'universita', 'SIM Induction', 'SIM Induction 8h30-12h45', 'SIM · Singapore', '2026-10-12 12:30:00+08', '2026-10-12 15:30:00+08', 'Asia/Singapore', false, 'ttv3:1'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT P. Dupuy 3H', 'SIM · Singapore', '2026-10-14 15:30:00+08', '2026-10-14 18:30:00+08', 'Asia/Singapore', false, 'ttv3:2') /*ANOMALIA sorgente: orario ricostruito, DA VERIFICARE*/,
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT P. Dupuy 4,5H', 'SIM · Singapore', '2026-10-16 08:30:00+08', '2026-10-16 11:30:00+08', 'Asia/Singapore', false, 'ttv3:3'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT P. Dupuy 4,5H', 'SIM · Singapore', '2026-10-16 12:30:00+08', '2026-10-16 15:30:00+08', 'Asia/Singapore', false, 'ttv3:4'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT P. Dupuy 4,5H', 'SIM · Singapore', '2026-10-20 12:30:00+08', '2026-10-20 18:30:00+08', 'Asia/Singapore', false, 'ttv3:5'),
    (uid, 'universita', 'Induction Meeting', 'INDUCTION MEETING Safwan MCHAWRAB (TDB)', 'SIM · Singapore', '2026-10-21 15:30:00+08', '2026-10-21 18:30:00+08', 'Asia/Singapore', false, 'ttv3:6'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-22 08:30:00+08', '2026-10-22 11:30:00+08', 'Asia/Singapore', false, 'ttv3:7'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-22 12:30:00+08', '2026-10-22 18:30:00+08', 'Asia/Singapore', false, 'ttv3:8'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-23 08:30:00+08', '2026-10-23 11:30:00+08', 'Asia/Singapore', false, 'ttv3:9'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-23 12:30:00+08', '2026-10-23 18:30:00+08', 'Asia/Singapore', false, 'ttv3:10'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-26 08:30:00+08', '2026-10-26 11:30:00+08', 'Asia/Singapore', false, 'ttv3:11'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-26 12:30:00+08', '2026-10-26 15:30:00+08', 'Asia/Singapore', false, 'ttv3:12'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-27 08:30:00+08', '2026-10-27 11:30:00+08', 'Asia/Singapore', false, 'ttv3:13'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-27 12:30:00+08', '2026-10-27 15:30:00+08', 'Asia/Singapore', false, 'ttv3:14'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-28 08:30:00+08', '2026-10-28 11:30:00+08', 'Asia/Singapore', false, 'ttv3:15'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-28 12:30:00+08', '2026-10-28 15:30:00+08', 'Asia/Singapore', false, 'ttv3:16'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-29 08:30:00+08', '2026-10-29 11:30:00+08', 'Asia/Singapore', false, 'ttv3:17'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-29 12:30:00+08', '2026-10-29 15:30:00+08', 'Asia/Singapore', false, 'ttv3:18'),
    (uid, 'universita', 'M&A / Company Valuation', 'M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-10-30 08:30:00+08', '2026-10-30 11:30:00+08', 'Asia/Singapore', false, 'ttv3:19'),
    (uid, 'universita', 'Esame — M&A / CV', 'EXAMEN - M&A / CV Safwan MCHAWRAB (3H)', 'SIM · Singapore', '2026-11-02 08:30:00+08', '2026-11-02 11:30:00+08', 'Asia/Singapore', false, 'ttv3:20'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-03 08:30:00+08', '2026-11-03 11:30:00+08', 'Asia/Singapore', false, 'ttv3:21'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-04 08:30:00+08', '2026-11-04 11:30:00+08', 'Asia/Singapore', false, 'ttv3:22'),
    (uid, 'universita', 'Ethics & ESG', 'Fundamentals of Ethics and ESG Lawrence Lee (3H)', 'SIM · Singapore', '2026-11-05 12:30:00+08', '2026-11-05 15:30:00+08', 'Asia/Singapore', false, 'ttv3:23'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-06 08:30:00+08', '2026-11-06 11:30:00+08', 'Asia/Singapore', false, 'ttv3:24'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-10 08:30:00+08', '2026-11-10 11:30:00+08', 'Asia/Singapore', false, 'ttv3:25'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT Kian Ong 3H', 'SIM · Singapore', '2026-11-10 12:30:00+08', '2026-11-10 15:30:00+08', 'Asia/Singapore', false, 'ttv3:26'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-11-10 15:30:00+08', '2026-11-10 18:30:00+08', 'Asia/Singapore', false, 'ttv3:27'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-11 08:30:00+08', '2026-11-11 11:30:00+08', 'Asia/Singapore', false, 'ttv3:28'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT Kian Ong 3H', 'SIM · Singapore', '2026-11-11 12:30:00+08', '2026-11-11 15:30:00+08', 'Asia/Singapore', false, 'ttv3:29'),
    (uid, 'universita', 'Ethics & ESG', 'Fundamentals of Ethics and ESG Lawrence Lee (3H)', 'SIM · Singapore', '2026-11-12 12:30:00+08', '2026-11-12 15:30:00+08', 'Asia/Singapore', false, 'ttv3:30'),
    (uid, 'universita', 'Induction Seminar', 'INDUCTION SEMINAR Manek MUKESH (3H)', 'SIM · Singapore', '2026-11-13 08:30:00+08', '2026-11-13 11:30:00+08', 'Asia/Singapore', false, 'ttv3:31'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-11-16 15:30:00+08', '2026-11-16 18:30:00+08', 'Asia/Singapore', false, 'ttv3:32'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT Kian Ong 3H', 'SIM · Singapore', '2026-11-17 12:30:00+08', '2026-11-17 15:30:00+08', 'Asia/Singapore', false, 'ttv3:33'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT Kian Ong 3H', 'SIM · Singapore', '2026-11-18 12:30:00+08', '2026-11-18 15:30:00+08', 'Asia/Singapore', false, 'ttv3:34'),
    (uid, 'universita', 'Ethics & ESG', 'Fundamentals of Ethics and ESG Lawrence Lee (3H)', 'SIM · Singapore', '2026-11-19 12:30:00+08', '2026-11-19 15:30:00+08', 'Asia/Singapore', false, 'ttv3:35'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-11-23 15:30:00+08', '2026-11-23 18:30:00+08', 'Asia/Singapore', false, 'ttv3:36'),
    (uid, 'universita', 'Sustainable Asset Management', 'SUSTAINABLE ASSET MANAGEMENT Kian Ong 3H', 'SIM · Singapore', '2026-11-24 12:30:00+08', '2026-11-24 15:30:00+08', 'Asia/Singapore', false, 'ttv3:37'),
    (uid, 'universita', 'Ethics & ESG', 'Fundamentals of Ethics and ESG Lawrence Lee (3H)', 'SIM · Singapore', '2026-11-26 12:30:00+08', '2026-11-26 15:30:00+08', 'Asia/Singapore', false, 'ttv3:38'),
    (uid, 'universita', 'Advanced Research Methods', 'Advanced Research MethodsArthur Cho Wee Weng (3H)', 'SIM · Singapore', '2026-11-30 08:30:00+08', '2026-11-30 11:30:00+08', 'Asia/Singapore', false, 'ttv3:39'),
    (uid, 'universita', 'Advanced Research Methods', 'Advanced Research MethodsArthur Cho Wee Weng (3H)', 'SIM · Singapore', '2026-12-01 08:30:00+08', '2026-12-01 11:30:00+08', 'Asia/Singapore', false, 'ttv3:40'),
    (uid, 'universita', 'Advanced Research Methods', 'Advanced Research MethodsArthur Cho Wee Weng (3H)', 'SIM · Singapore', '2026-12-02 08:30:00+08', '2026-12-02 11:30:00+08', 'Asia/Singapore', false, 'ttv3:41'),
    (uid, 'universita', 'Advanced Research Methods', 'Advanced Research MethodsArthur Cho Wee Weng (3H)', 'SIM · Singapore', '2026-12-03 08:30:00+08', '2026-12-03 11:30:00+08', 'Asia/Singapore', false, 'ttv3:42'),
    (uid, 'universita', 'Ethics & ESG', 'Fundamentals of Ethics and ESG Lawrence Lee (3H)', 'SIM · Singapore', '2026-12-03 12:30:00+08', '2026-12-03 15:30:00+08', 'Asia/Singapore', false, 'ttv3:43'),
    (uid, 'universita', 'Advanced Research Methods', 'Advanced Research MethodsArthur Cho Wee Weng (3H)', 'SIM · Singapore', '2026-12-04 08:30:00+08', '2026-12-04 11:30:00+08', 'Asia/Singapore', false, 'ttv3:44'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-12-07 15:30:00+08', '2026-12-07 18:30:00+08', 'Asia/Singapore', false, 'ttv3:45'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-12-14 15:30:00+08', '2026-12-14 18:30:00+08', 'Asia/Singapore', false, 'ttv3:46'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2026-12-21 15:30:00+08', '2026-12-21 18:30:00+08', 'Asia/Singapore', false, 'ttv3:47'),
    (uid, 'universita', 'Advanced Financial Statement Analysis', 'Advanced Financial Statement Analysis Isabelle Chaboud (3H)', 'SIM · Singapore', '2027-01-04 15:30:00+08', '2027-01-04 18:30:00+08', 'Asia/Singapore', false, 'ttv3:48'),
    (uid, 'universita', 'Advanced Financial Statement Analysis', 'Advanced Financial Statement Analysis Isabelle Chaboud (3H)', 'SIM · Singapore', '2027-01-05 12:30:00+08', '2027-01-05 15:30:00+08', 'Asia/Singapore', false, 'ttv3:49'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2027-01-05 15:30:00+08', '2027-01-05 18:30:00+08', 'Asia/Singapore', false, 'ttv3:50'),
    (uid, 'universita', 'Advanced Financial Statement Analysis', 'Advanced Financial Statement Analysis Isabelle Chaboud (3H)', 'SIM · Singapore', '2027-01-06 12:30:00+08', '2027-01-06 15:30:00+08', 'Asia/Singapore', false, 'ttv3:51'),
    (uid, 'universita', 'Advanced Financial Statement Analysis', 'Advanced Financial Statement Analysis Isabelle Chaboud (3H)', 'SIM · Singapore', '2027-01-07 12:30:00+08', '2027-01-07 15:30:00+08', 'Asia/Singapore', false, 'ttv3:52'),
    (uid, 'universita', 'Advanced Financial Statement Analysis', 'Advanced Financial Statement Analysis Isabelle Chaboud (3H)', 'SIM · Singapore', '2027-01-08 12:30:00+08', '2027-01-08 15:30:00+08', 'Asia/Singapore', false, 'ttv3:53'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2027-01-11 15:30:00+08', '2027-01-11 18:30:00+08', 'Asia/Singapore', false, 'ttv3:54'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2027-01-18 15:30:00+08', '2027-01-18 18:30:00+08', 'Asia/Singapore', false, 'ttv3:55'),
    (uid, 'universita', 'Data Analytics & Financial Modelling', 'Data Analytics & Financial Modelling Nicolas Paris (3H)', 'SIM · Singapore', '2027-01-25 15:30:00+08', '2027-01-25 18:30:00+08', 'Asia/Singapore', false, 'ttv3:56'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-01-27 08:30:00+08', '2027-01-27 11:30:00+08', 'Asia/Singapore', false, 'ttv3:57'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-01-27 12:30:00+08', '2027-01-27 15:30:00+08', 'Asia/Singapore', false, 'ttv3:58'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-01-28 08:30:00+08', '2027-01-28 11:30:00+08', 'Asia/Singapore', false, 'ttv3:59'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-01-28 12:30:00+08', '2027-01-28 15:30:00+08', 'Asia/Singapore', false, 'ttv3:60'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-01-29 08:30:00+08', '2027-01-29 11:30:00+08', 'Asia/Singapore', false, 'ttv3:61'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-02-01 08:30:00+08', '2027-02-01 11:30:00+08', 'Asia/Singapore', false, 'ttv3:62'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-02-01 12:30:00+08', '2027-02-01 15:30:00+08', 'Asia/Singapore', false, 'ttv3:63'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-02-02 08:30:00+08', '2027-02-02 11:30:00+08', 'Asia/Singapore', false, 'ttv3:64'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-02-02 12:30:00+08', '2027-02-02 15:30:00+08', 'Asia/Singapore', false, 'ttv3:65'),
    (uid, 'universita', 'Private Equity, LBOs & VC', 'PRIVATE EQUITY, LBOs & VC P. Guerrand 3H', 'SIM · Singapore', '2027-02-03 08:30:00+08', '2027-02-03 11:30:00+08', 'Asia/Singapore', false, 'ttv3:66'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Rafael LE SAUX 3H', 'SIM · Singapore', '2027-02-09 08:30:00+08', '2027-02-09 11:30:00+08', 'Asia/Singapore', false, 'ttv3:67'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Rafael LE SAUX 3H', 'SIM · Singapore', '2027-02-09 12:30:00+08', '2027-02-09 15:30:00+08', 'Asia/Singapore', false, 'ttv3:68'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Rafael LE SAUX 3H', 'SIM · Singapore', '2027-02-10 12:30:00+08', '2027-02-10 15:30:00+08', 'Asia/Singapore', false, 'ttv3:69'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Rafael LE SAUX 3H', 'SIM · Singapore', '2027-02-11 12:30:00+08', '2027-02-11 15:30:00+08', 'Asia/Singapore', false, 'ttv3:70'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Rafael LE SAUX 3H', 'SIM · Singapore', '2027-02-12 08:30:00+08', '2027-02-12 11:30:00+08', 'Asia/Singapore', false, 'ttv3:71'),
    (uid, 'universita', 'CFA Preparation', 'CFA Preparation Audrey Yong Wee En (3H)', 'SIM · Singapore', '2027-02-15 12:30:00+08', '2027-02-15 18:30:00+08', 'Asia/Singapore', false, 'ttv3:72'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Safwan Mchawrab TBC 3H', 'SIM · Singapore', '2027-02-16 12:30:00+08', '2027-02-16 15:30:00+08', 'Asia/Singapore', false, 'ttv3:73'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Safwan Mchawrab TBC 3H', 'SIM · Singapore', '2027-02-17 08:30:00+08', '2027-02-17 11:30:00+08', 'Asia/Singapore', false, 'ttv3:74'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Safwan Mchawrab TBC 3H', 'SIM · Singapore', '2027-02-17 12:30:00+08', '2027-02-17 15:30:00+08', 'Asia/Singapore', false, 'ttv3:75'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Safwan Mchawrab TBC 3H', 'SIM · Singapore', '2027-02-18 08:30:00+08', '2027-02-18 11:30:00+08', 'Asia/Singapore', false, 'ttv3:76'),
    (uid, 'universita', 'Investment Banking', 'INVESTMENT BANKING Safwan Mchawrab TBC 3H', 'SIM · Singapore', '2027-02-18 12:30:00+08', '2027-02-18 15:30:00+08', 'Asia/Singapore', false, 'ttv3:77'),
    (uid, 'universita', 'Farewell meeting', 'Farewell meeting Safwan Mchawrab', 'SIM · Singapore', '2027-02-19 08:30:00+08', '2027-02-19 11:30:00+08', 'Asia/Singapore', false, 'ttv3:78'),
    (uid, 'universita', 'CFA Preparation', 'CFA Preparation Audrey Yong Wee En (3H)', 'SIM · Singapore', '2027-02-22 12:30:00+08', '2027-02-22 18:30:00+08', 'Asia/Singapore', false, 'ttv3:79'),
    (uid, 'universita', 'CFA Preparation', 'CFA Preparation Audrey Yong Wee En (3H)', 'SIM · Singapore', '2027-02-23 12:30:00+08', '2027-02-23 15:30:00+08', 'Asia/Singapore', false, 'ttv3:80');
end $$;

-- Verifica: quante lezioni università sono inserite (atteso 81, senza duplicati).
select count(*) as eventi_universita
from eventi e join auth.users u on u.id = e.utente_id
where u.email = 'andrea.bosatelli@gmail.com' and e.origine = 'universita';
