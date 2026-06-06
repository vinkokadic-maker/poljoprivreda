-- =============================================================
-- Seed: demo podaci za testiranje modela
-- Pokreni preko Supabase SQL editora (service role => RLS se zaobilazi),
-- ili `supabase db reset` (automatski uključuje seed.sql).
-- Ne kreira auth korisnika — služi samo da se model vidi "na djelu".
-- =============================================================

-- Fiksni UUID-ovi radi ponovljivosti
-- gospodarstvo
INSERT INTO gospodarstvo (id, naziv, mibpg)
VALUES ('00000000-0000-0000-0000-000000000001', 'OPG Kadić (demo)', '1234567')
ON CONFLICT (id) DO NOTHING;

-- partneri
INSERT INTO partner (id, gospodarstvo_id, naziv, tip) VALUES
('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','Vindija','kooperant'),
('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','Drugi dobavljač pilića','dobavljac'),
('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','Lokalni kupac (živa vaga)','kupac'),
('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-000000000001','Mesnica Horvat','kupac')
ON CONFLICT (id) DO NOTHING;

-- objekti
INSERT INTO objekt (id, gospodarstvo_id, naziv, kapacitet, skov_id) VALUES
('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000001','Objekt 1',22000,'SKOV-1'),
('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000001','Objekt 2',23000,'SKOV-2')
ON CONFLICT (id) DO NOTHING;

-- turnus u Objektu 1
INSERT INTO turnus (id, gospodarstvo_id, objekt_id, redni_broj, datum_useljenja, plan_datum_izlova, status) VALUES
('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1',3,'2026-05-10','2026-06-12','aktivan')
ON CONFLICT (id) DO NOTHING;

-- DVA kanala (jata) u istom turnusu: Vindija + vlastiti
INSERT INTO jato (id, gospodarstvo_id, turnus_id, model, dobavljac_id, kupac_id, broj_useljenih, cijena_pilica, cijena_otkupa_kg) VALUES
('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','kooperacija','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1',21000,0.45,1.05),
('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','vlastiti','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3',900,0.40,2.20)
ON CONFLICT (id) DO NOTHING;

-- parcele
INSERT INTO parcela (id, gospodarstvo_id, naziv, povrsina_ha) VALUES
('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','Njiva kod kuće',8.5),
('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001','Velika tabla',12.0)
ON CONFLICT (id) DO NOTHING;

-- sezone kultura 2026
INSERT INTO sezona_kulture (id, gospodarstvo_id, parcela_id, godina, kultura, datum_sjetve) VALUES
('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1',2026,'kukuruz','2026-04-15'),
('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e2',2026,'soja','2026-04-28')
ON CONFLICT (id) DO NOTHING;

-- nekoliko transakcija (troškovi + prihod) vezanih na turnus/jato i parcelu
INSERT INTO transakcija (gospodarstvo_id, datum, smjer, kategorija, opis, iznos, turnus_id, jato_id) VALUES
('00000000-0000-0000-0000-000000000001','2026-05-10','ulaz','pilici','Useljenje Vindija 21.000 kom',9450,'00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1'),
('00000000-0000-0000-0000-000000000001','2026-05-20','ulaz','hrana','Hrana grower',6200,'00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1'),
('00000000-0000-0000-0000-000000000001','2026-05-31','ulaz','struja','Struja svibanj',1100,'00000000-0000-0000-0000-0000000000c1',NULL);

INSERT INTO transakcija (gospodarstvo_id, datum, smjer, kategorija, opis, iznos, parcela_id, sezona_id) VALUES
('00000000-0000-0000-0000-000000000001','2026-04-15','ulaz','sjeme','Sjeme kukuruza',780,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1'),
('00000000-0000-0000-0000-000000000001','2026-04-20','ulaz','gnojivo','NPK',1350,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1');
