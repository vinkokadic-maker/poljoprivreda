-- =============================================================
-- Poljoprivreda app — podatkovni model (MVP)
-- PostgreSQL DDL
-- Verzija 0.1  (2026-06-05)
--
-- Pokriva: peradarstvo (tov u kooperaciji + vlastiti kanal),
-- ratarstvo (parcele/kulture), svinje, te foto-arhivu dokumenata
-- s AI ekstrakcijom i jedinstvenom knjigom troškova/prihoda.
--
-- Dizajn je multi-tenant (kolona gospodarstvo_id svuda) zbog
-- moguće kasnije komercijalizacije na druge kooperante.
-- =============================================================

-- Za UUID ključeve (preporuka za mobile/sync); ako ne treba, makni i koristi BIGSERIAL.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- ENUM tipovi
-- -------------------------------------------------------------
CREATE TYPE partner_tip      AS ENUM ('dobavljac', 'kupac', 'kooperant', 'ostalo');
CREATE TYPE jato_model       AS ENUM ('kooperacija', 'vlastiti');      -- Vindija vs vlastiti kanal
CREATE TYPE turnus_status    AS ENUM ('planiran', 'aktivan', 'izlovljen', 'zatvoren');
CREATE TYPE dokument_tip     AS ENUM (
    'otpremnica_pilici', 'otpremnica_hrana', 'otpremnica_lijekovi',
    'vagarski_list', 'otkupni_blok', 'veterinarski_nalaz',
    'racun_rezije', 'racun_repromaterijal', 'poticaji', 'ostalo'
);
CREATE TYPE dokument_status  AS ENUM ('novo', 'prepoznato', 'potvrdeno', 'odbijeno');
CREATE TYPE smjer            AS ENUM ('ulaz', 'izlaz');                  -- trošak (ulaz robe/računa) vs prihod
CREATE TYPE trosak_kategorija AS ENUM (
    'pilici', 'hrana', 'lijekovi', 'struja', 'plin', 'stelja',
    'veterinar', 'rad', 'pilici_radnicima', 'prasad', 'sjeme',
    'gnojivo', 'zastita', 'gorivo', 'prihod_otkup', 'prihod_ostalo',
    'poticaj', 'ostalo'
);
CREATE TYPE svinje_status    AS ENUM ('u_tovu', 'prodano');

-- -------------------------------------------------------------
-- Jezgra: gospodarstvo, korisnici, partneri
-- -------------------------------------------------------------
CREATE TABLE gospodarstvo (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naziv         TEXT NOT NULL,
    oib           TEXT,
    mibpg         TEXT,                         -- matični broj poljoprivrednog gospodarstva
    kreirano      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE korisnik (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    ime             TEXT NOT NULL,
    email           TEXT UNIQUE,
    uloga           TEXT NOT NULL DEFAULT 'vlasnik',  -- vlasnik / clan / radnik
    kreirano        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE partner (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,                -- npr. "Vindija", "Mesnica Horvat"
    tip             partner_tip NOT NULL DEFAULT 'ostalo',
    oib             TEXT,
    napomena        TEXT
);
CREATE INDEX ix_partner_gosp ON partner(gospodarstvo_id);

-- =============================================================
-- PERADARSTVO
-- =============================================================

-- Peradarnik (fizički objekt)
CREATE TABLE objekt (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,               -- "Objekt 1", "Objekt 2"
    kapacitet       INTEGER,                     -- npr. 23000
    skov_id         TEXT,                        -- ID kuće u SKOV sustavu (za buduci auto-import)
    aktivan         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_objekt_gosp ON objekt(gospodarstvo_id);

-- Turnus = jedan ciklus tova u jednom objektu
CREATE TABLE turnus (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id     UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    objekt_id           UUID NOT NULL REFERENCES objekt(id) ON DELETE RESTRICT,
    redni_broj          INTEGER,                 -- redni broj turnusa u godini
    datum_useljenja     DATE NOT NULL,
    plan_datum_izlova   DATE,
    datum_izlova        DATE,                    -- stvarni (izlovi 30-33 dana, max 40)
    status              turnus_status NOT NULL DEFAULT 'planiran',
    napomena            TEXT
);
CREATE INDEX ix_turnus_objekt ON turnus(objekt_id);
CREATE INDEX ix_turnus_gosp ON turnus(gospodarstvo_id);

-- Jato = jedan "kanal" pilića unutar turnusa.
-- KLJUČNO: u istom objektu/turnusu paralelno žive Vindijini pilići
-- (model 'kooperacija') i pilići drugog dobavljača (model 'vlastiti',
-- hranjeni vlastitom hranom, prodani drugim kupcima).
CREATE TABLE jato (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id     UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    turnus_id           UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    model               jato_model NOT NULL,
    dobavljac_id        UUID REFERENCES partner(id),   -- od koga su pilići
    kupac_id            UUID REFERENCES partner(id),   -- tko otkupljuje
    broj_useljenih      INTEGER NOT NULL,
    cijena_pilica       NUMERIC(12,4),           -- zadana nabavna cijena po komadu
    cijena_otkupa_kg    NUMERIC(12,4),           -- zadana otkupna cijena po kg žive vage
    dop_uginuca_posto   NUMERIC(5,2) DEFAULT 6,  -- dopušteni % uginuća (Vindija ~6%)
    napomena            TEXT
);
CREATE INDEX ix_jato_turnus ON jato(turnus_id);

-- Dnevni unos okolišnih/proizvodnih podataka (razina objekta/turnusa).
-- SKOV mjeri na razini kuće => podaci se vode na turnusu, ne po jatu.
CREATE TABLE dnevni_unos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    dan_starosti    INTEGER,                     -- dan turnusa
    uginuca         INTEGER DEFAULT 0,
    prosj_tezina_g  NUMERIC(10,2),               -- prosječna težina (g)
    voda_l          NUMERIC(12,2),               -- potrošnja vode
    temperatura_c   NUMERIC(5,2),
    vlaga_posto     NUMERIC(5,2),
    izvor           TEXT DEFAULT 'rucno',        -- 'rucno' | 'skov'
    napomena        TEXT,
    UNIQUE (turnus_id, datum)
);
CREATE INDEX ix_dnevni_turnus ON dnevni_unos(turnus_id);

-- Primjene lijekova/vitamina (ručni unos)
CREATE TABLE primjena_tretmana (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    jato_id         UUID REFERENCES jato(id),    -- opcionalno, ako se odnosi na pojedini kanal
    datum           DATE NOT NULL,
    naziv           TEXT NOT NULL,               -- lijek/vitamin
    kolicina        NUMERIC(12,3),
    jedinica        TEXT,
    napomena        TEXT
);
CREATE INDEX ix_tretman_turnus ON primjena_tretmana(turnus_id);

-- Hrana: i ulaz (dostava) i utrošak. Za vlastiti kanal bilježi se
-- koliko VLASTITE hrane je dano (vlastita_hrana = TRUE).
CREATE TABLE hrana_evidencija (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    jato_id         UUID REFERENCES jato(id),
    datum           DATE NOT NULL,
    smjer           smjer NOT NULL,              -- 'ulaz' = dostava, 'izlaz' = utrošak
    vrsta           TEXT,                        -- starter/grower/finisher...
    kolicina_kg     NUMERIC(12,2) NOT NULL,
    vlastita_hrana  BOOLEAN NOT NULL DEFAULT FALSE,
    dokument_id     UUID,                        -- veza na otpremnicu (FK dodan niže)
    napomena        TEXT
);
CREATE INDEX ix_hrana_turnus ON hrana_evidencija(turnus_id);

-- =============================================================
-- RATARSTVO
-- =============================================================
CREATE TABLE parcela (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,
    arkod           TEXT,                        -- ARKOD oznaka parcele
    povrsina_ha     NUMERIC(10,4) NOT NULL,
    napomena        TEXT
);
CREATE INDEX ix_parcela_gosp ON parcela(gospodarstvo_id);

-- Sezona kulture = jedna kultura na parceli u jednoj godini (plodored)
CREATE TABLE sezona_kulture (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcela_id      UUID NOT NULL REFERENCES parcela(id) ON DELETE CASCADE,
    godina          INTEGER NOT NULL,
    kultura         TEXT NOT NULL,               -- kukuruz/pšenica/ječam/soja/suncokret
    datum_sjetve    DATE,
    datum_zetve     DATE,
    prinos_t        NUMERIC(12,3),               -- ukupni prinos (t)
    UNIQUE (parcela_id, godina, kultura)
);
CREATE INDEX ix_sezona_parcela ON sezona_kulture(parcela_id);

-- Operacije na parceli (sjetva, gnojidba, zaštita, žetva) — i za poticaje/evidenciju
CREATE TABLE operacija_kulture (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sezona_id       UUID NOT NULL REFERENCES sezona_kulture(id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    tip             TEXT NOT NULL,               -- sjetva/gnojidba/zastita/zetva/ostalo
    materijal       TEXT,                        -- naziv gnojiva/sredstva/sjemena
    kolicina        NUMERIC(12,3),
    jedinica        TEXT,
    napomena        TEXT
);
CREATE INDEX ix_operacija_sezona ON operacija_kulture(sezona_id);

-- =============================================================
-- SVINJE (sporedna grana — osnovni podaci)
-- =============================================================
CREATE TABLE svinje_turnus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    oznaka          TEXT,
    datum_nabave    DATE NOT NULL,
    broj_prasadi    INTEGER NOT NULL,
    dobavljac_id    UUID REFERENCES partner(id),
    datum_prodaje   DATE,
    broj_prodanih   INTEGER,
    status          svinje_status NOT NULL DEFAULT 'u_tovu',
    napomena        TEXT
);
CREATE INDEX ix_svinje_gosp ON svinje_turnus(gospodarstvo_id);

-- =============================================================
-- DOKUMENTI (foto-arhiva + AI ekstrakcija)
-- =============================================================
CREATE TABLE dokument (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    tip             dokument_tip NOT NULL DEFAULT 'ostalo',
    status          dokument_status NOT NULL DEFAULT 'novo',
    partner_id      UUID REFERENCES partner(id),
    datum_dokumenta DATE,
    datoteka_url    TEXT NOT NULL,               -- slika/scan/PDF (storage)
    izvor           TEXT DEFAULT 'foto',         -- 'foto' | 'mail' | 'upload'
    ocr_tekst       TEXT,                        -- sirovi OCR
    ai_podaci       JSONB,                       -- strukturirana AI ekstrakcija (prijedlog)
    ai_pouzdanost   NUMERIC(5,2),                -- confidence (0-100)
    potvrdio_id     UUID REFERENCES korisnik(id),
    potvrdeno_kada  TIMESTAMPTZ,
    -- veze na ono na što se dokument odnosi (sve opcionalno):
    turnus_id       UUID REFERENCES turnus(id),
    jato_id         UUID REFERENCES jato(id),
    sezona_id       UUID REFERENCES sezona_kulture(id),
    svinje_turnus_id UUID REFERENCES svinje_turnus(id),
    kreirano        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_dokument_gosp ON dokument(gospodarstvo_id);
CREATE INDEX ix_dokument_status ON dokument(status);

-- Stavke izvučene iz dokumenta (npr. linije otpremnice)
CREATE TABLE dokument_stavka (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokument_id     UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
    opis            TEXT,
    kolicina        NUMERIC(14,3),
    jedinica        TEXT,
    cijena          NUMERIC(14,4),
    iznos           NUMERIC(14,2)
);
CREATE INDEX ix_dokstavka_dok ON dokument_stavka(dokument_id);

-- naknadni FK: hrana_evidencija -> dokument
ALTER TABLE hrana_evidencija
    ADD CONSTRAINT fk_hrana_dokument
    FOREIGN KEY (dokument_id) REFERENCES dokument(id);

-- =============================================================
-- JEDINSTVENA KNJIGA TROŠKOVA I PRIHODA
-- Pokreće sve izvještaje: zarada po turnusu, trošak po hektaru,
-- godišnji pregled, novčani tok. Svaka transakcija može biti
-- vezana na turnus/jato/parcelu/sezonu/svinje i na dokument-izvor.
-- =============================================================
CREATE TABLE transakcija (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id  UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    datum            DATE NOT NULL,
    smjer            smjer NOT NULL,             -- ulaz (trošak) / izlaz (prihod)
    kategorija       trosak_kategorija NOT NULL,
    opis             TEXT,
    kolicina         NUMERIC(14,3),
    jedinica         TEXT,
    iznos            NUMERIC(14,2) NOT NULL,
    partner_id       UUID REFERENCES partner(id),
    dokument_id      UUID REFERENCES dokument(id),
    -- na što se odnosi (točno jedno bi obično bilo popunjeno):
    turnus_id        UUID REFERENCES turnus(id),
    jato_id          UUID REFERENCES jato(id),
    parcela_id       UUID REFERENCES parcela(id),
    sezona_id        UUID REFERENCES sezona_kulture(id),
    svinje_turnus_id UUID REFERENCES svinje_turnus(id),
    kreirano         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_trans_gosp ON transakcija(gospodarstvo_id);
CREATE INDEX ix_trans_turnus ON transakcija(turnus_id);
CREATE INDEX ix_trans_parcela ON transakcija(parcela_id);
CREATE INDEX ix_trans_datum ON transakcija(datum);

-- =============================================================
-- POMOĆNI POGLEDI (izvještaji)
-- =============================================================

-- Zarada po turnusu
CREATE VIEW v_zarada_turnus AS
SELECT
    t.id AS turnus_id,
    t.gospodarstvo_id,
    t.objekt_id,
    t.datum_useljenja,
    t.datum_izlova,
    COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'izlaz'), 0) AS prihod,
    COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'ulaz'),  0) AS trosak,
    COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'izlaz'), 0)
      - COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'ulaz'), 0) AS zarada
FROM turnus t
LEFT JOIN transakcija tr ON tr.turnus_id = t.id
GROUP BY t.id;

-- Trošak po hektaru (po sezoni kulture)
CREATE VIEW v_trosak_po_ha AS
SELECT
    s.id AS sezona_id,
    p.gospodarstvo_id,
    p.naziv AS parcela,
    s.godina,
    s.kultura,
    p.povrsina_ha,
    COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'ulaz'), 0) AS ukupni_trosak,
    CASE WHEN p.povrsina_ha > 0
         THEN COALESCE(SUM(tr.iznos) FILTER (WHERE tr.smjer = 'ulaz'), 0) / p.povrsina_ha
         ELSE NULL END AS trosak_po_ha
FROM sezona_kulture s
JOIN parcela p ON p.id = s.parcela_id
LEFT JOIN transakcija tr ON tr.sezona_id = s.id
GROUP BY s.id, p.gospodarstvo_id, p.naziv, s.godina, s.kultura, p.povrsina_ha;
