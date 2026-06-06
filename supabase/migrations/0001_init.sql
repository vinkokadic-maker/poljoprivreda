-- =============================================================
-- Poljoprivreda app — Supabase migracija 0001 (init)
-- Shema + RLS (multi-tenant) + Storage
-- PostgreSQL / Supabase (pg15+)
--
-- Napomene za Supabase:
--  * gen_random_uuid() je u jezgri pg13+, ne treba extension.
--  * korisnik.id = auth.users.id (1 auth korisnik = 1 red).
--  * gospodarstvo_id je na SVIM tablicama (denormalizirano) da
--    RLS politike budu jednostavne i brze.
-- =============================================================

-- -------------------------------------------------------------
-- ENUM tipovi
-- -------------------------------------------------------------
CREATE TYPE partner_tip       AS ENUM ('dobavljac', 'kupac', 'kooperant', 'ostalo');
CREATE TYPE jato_model        AS ENUM ('kooperacija', 'vlastiti');
CREATE TYPE turnus_status     AS ENUM ('planiran', 'aktivan', 'izlovljen', 'zatvoren');
CREATE TYPE dokument_tip      AS ENUM (
    'otpremnica_pilici', 'otpremnica_hrana', 'otpremnica_lijekovi',
    'vagarski_list', 'otkupni_blok', 'veterinarski_nalaz',
    'racun_rezije', 'racun_repromaterijal', 'poticaji', 'ostalo'
);
CREATE TYPE dokument_status   AS ENUM ('novo', 'prepoznato', 'potvrdeno', 'odbijeno');
CREATE TYPE smjer             AS ENUM ('ulaz', 'izlaz');
CREATE TYPE trosak_kategorija AS ENUM (
    'pilici', 'hrana', 'lijekovi', 'struja', 'plin', 'stelja',
    'veterinar', 'rad', 'pilici_radnicima', 'prasad', 'sjeme',
    'gnojivo', 'zastita', 'gorivo', 'prihod_otkup', 'prihod_ostalo',
    'poticaj', 'ostalo'
);
CREATE TYPE svinje_status     AS ENUM ('u_tovu', 'prodano');

-- -------------------------------------------------------------
-- Jezgra
-- -------------------------------------------------------------
CREATE TABLE gospodarstvo (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naziv     TEXT NOT NULL,
    oib       TEXT,
    mibpg     TEXT,
    kreirano  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1 red = 1 auth korisnik
CREATE TABLE korisnik (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    ime             TEXT,
    email           TEXT,
    uloga           TEXT NOT NULL DEFAULT 'vlasnik',
    kreirano        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_korisnik_gosp ON korisnik(gospodarstvo_id);

CREATE TABLE partner (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,
    tip             partner_tip NOT NULL DEFAULT 'ostalo',
    oib             TEXT,
    napomena        TEXT
);
CREATE INDEX ix_partner_gosp ON partner(gospodarstvo_id);

-- -------------------------------------------------------------
-- Peradarstvo
-- -------------------------------------------------------------
CREATE TABLE objekt (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,
    kapacitet       INTEGER,
    skov_id         TEXT,
    aktivan         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_objekt_gosp ON objekt(gospodarstvo_id);

CREATE TABLE turnus (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id   UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    objekt_id         UUID NOT NULL REFERENCES objekt(id) ON DELETE RESTRICT,
    redni_broj        INTEGER,
    datum_useljenja   DATE NOT NULL,
    plan_datum_izlova DATE,
    datum_izlova      DATE,
    status            turnus_status NOT NULL DEFAULT 'planiran',
    napomena          TEXT
);
CREATE INDEX ix_turnus_objekt ON turnus(objekt_id);
CREATE INDEX ix_turnus_gosp ON turnus(gospodarstvo_id);

CREATE TABLE jato (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id   UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    turnus_id         UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    model             jato_model NOT NULL,
    dobavljac_id      UUID REFERENCES partner(id),
    kupac_id          UUID REFERENCES partner(id),
    broj_useljenih    INTEGER NOT NULL,
    cijena_pilica     NUMERIC(12,4),
    cijena_otkupa_kg  NUMERIC(12,4),
    dop_uginuca_posto NUMERIC(5,2) DEFAULT 6,
    napomena          TEXT
);
CREATE INDEX ix_jato_turnus ON jato(turnus_id);
CREATE INDEX ix_jato_gosp ON jato(gospodarstvo_id);

CREATE TABLE dnevni_unos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    dan_starosti    INTEGER,
    uginuca         INTEGER DEFAULT 0,
    prosj_tezina_g  NUMERIC(10,2),
    voda_l          NUMERIC(12,2),
    temperatura_c   NUMERIC(5,2),
    vlaga_posto     NUMERIC(5,2),
    izvor           TEXT DEFAULT 'rucno',
    napomena        TEXT,
    UNIQUE (turnus_id, datum)
);
CREATE INDEX ix_dnevni_turnus ON dnevni_unos(turnus_id);
CREATE INDEX ix_dnevni_gosp ON dnevni_unos(gospodarstvo_id);

CREATE TABLE primjena_tretmana (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    jato_id         UUID REFERENCES jato(id),
    datum           DATE NOT NULL,
    naziv           TEXT NOT NULL,
    kolicina        NUMERIC(12,3),
    jedinica        TEXT,
    napomena        TEXT
);
CREATE INDEX ix_tretman_turnus ON primjena_tretmana(turnus_id);
CREATE INDEX ix_tretman_gosp ON primjena_tretmana(gospodarstvo_id);

CREATE TABLE hrana_evidencija (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    turnus_id       UUID NOT NULL REFERENCES turnus(id) ON DELETE CASCADE,
    jato_id         UUID REFERENCES jato(id),
    datum           DATE NOT NULL,
    smjer           smjer NOT NULL,
    vrsta           TEXT,
    kolicina_kg     NUMERIC(12,2) NOT NULL,
    vlastita_hrana  BOOLEAN NOT NULL DEFAULT FALSE,
    dokument_id     UUID,
    napomena        TEXT
);
CREATE INDEX ix_hrana_turnus ON hrana_evidencija(turnus_id);
CREATE INDEX ix_hrana_gosp ON hrana_evidencija(gospodarstvo_id);

-- -------------------------------------------------------------
-- Ratarstvo
-- -------------------------------------------------------------
CREATE TABLE parcela (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    naziv           TEXT NOT NULL,
    arkod           TEXT,
    povrsina_ha     NUMERIC(10,4) NOT NULL,
    napomena        TEXT
);
CREATE INDEX ix_parcela_gosp ON parcela(gospodarstvo_id);

CREATE TABLE sezona_kulture (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    parcela_id      UUID NOT NULL REFERENCES parcela(id) ON DELETE CASCADE,
    godina          INTEGER NOT NULL,
    kultura         TEXT NOT NULL,
    datum_sjetve    DATE,
    datum_zetve     DATE,
    prinos_t        NUMERIC(12,3),
    UNIQUE (parcela_id, godina, kultura)
);
CREATE INDEX ix_sezona_parcela ON sezona_kulture(parcela_id);
CREATE INDEX ix_sezona_gosp ON sezona_kulture(gospodarstvo_id);

CREATE TABLE operacija_kulture (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    sezona_id       UUID NOT NULL REFERENCES sezona_kulture(id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    tip             TEXT NOT NULL,
    materijal       TEXT,
    kolicina        NUMERIC(12,3),
    jedinica        TEXT,
    napomena        TEXT
);
CREATE INDEX ix_operacija_sezona ON operacija_kulture(sezona_id);
CREATE INDEX ix_operacija_gosp ON operacija_kulture(gospodarstvo_id);

-- -------------------------------------------------------------
-- Svinje
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- Dokumenti (foto-arhiva + AI)
-- -------------------------------------------------------------
CREATE TABLE dokument (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id  UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    tip              dokument_tip NOT NULL DEFAULT 'ostalo',
    status           dokument_status NOT NULL DEFAULT 'novo',
    partner_id       UUID REFERENCES partner(id),
    datum_dokumenta  DATE,
    datoteka_url     TEXT NOT NULL,
    izvor            TEXT DEFAULT 'foto',
    ocr_tekst        TEXT,
    ai_podaci        JSONB,
    ai_pouzdanost    NUMERIC(5,2),
    potvrdio_id      UUID REFERENCES korisnik(id),
    potvrdeno_kada   TIMESTAMPTZ,
    turnus_id        UUID REFERENCES turnus(id),
    jato_id          UUID REFERENCES jato(id),
    sezona_id        UUID REFERENCES sezona_kulture(id),
    svinje_turnus_id UUID REFERENCES svinje_turnus(id),
    kreirano         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_dokument_gosp ON dokument(gospodarstvo_id);
CREATE INDEX ix_dokument_status ON dokument(status);

CREATE TABLE dokument_stavka (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    dokument_id     UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
    opis            TEXT,
    kolicina        NUMERIC(14,3),
    jedinica        TEXT,
    cijena          NUMERIC(14,4),
    iznos           NUMERIC(14,2)
);
CREATE INDEX ix_dokstavka_dok ON dokument_stavka(dokument_id);

ALTER TABLE hrana_evidencija
    ADD CONSTRAINT fk_hrana_dokument
    FOREIGN KEY (dokument_id) REFERENCES dokument(id);

-- -------------------------------------------------------------
-- Jedinstvena knjiga troškova i prihoda
-- -------------------------------------------------------------
CREATE TABLE transakcija (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gospodarstvo_id  UUID NOT NULL REFERENCES gospodarstvo(id) ON DELETE CASCADE,
    datum            DATE NOT NULL,
    smjer            smjer NOT NULL,
    kategorija       trosak_kategorija NOT NULL,
    opis             TEXT,
    kolicina         NUMERIC(14,3),
    jedinica         TEXT,
    iznos            NUMERIC(14,2) NOT NULL,
    partner_id       UUID REFERENCES partner(id),
    dokument_id      UUID REFERENCES dokument(id),
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

-- -------------------------------------------------------------
-- Izvještajni pogledi
-- -------------------------------------------------------------
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

-- =============================================================
-- RLS — multi-tenant sigurnost
-- =============================================================

-- Vraća gospodarstva kojima trenutni auth korisnik pripada.
-- SECURITY DEFINER => čita korisnik tablicu bez RLS-a (nema rekurzije).
CREATE OR REPLACE FUNCTION public.my_gospodarstva()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT gospodarstvo_id FROM korisnik WHERE id = auth.uid();
$$;

-- gospodarstvo: korisnik vidi samo svoje
ALTER TABLE gospodarstvo ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON gospodarstvo FOR SELECT TO authenticated
    USING (id IN (SELECT public.my_gospodarstva()));
CREATE POLICY tenant_mod ON gospodarstvo FOR UPDATE TO authenticated
    USING (id IN (SELECT public.my_gospodarstva()))
    WITH CHECK (id IN (SELECT public.my_gospodarstva()));

-- korisnik: vidi sebe i članove istog gospodarstva
ALTER TABLE korisnik ENABLE ROW LEVEL SECURITY;
CREATE POLICY korisnik_self ON korisnik FOR SELECT TO authenticated
    USING (id = auth.uid() OR gospodarstvo_id IN (SELECT public.my_gospodarstva()));
CREATE POLICY korisnik_update ON korisnik FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Sve poslovne tablice: jedinstvena tenant politika preko gospodarstvo_id.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'partner','objekt','turnus','jato','dnevni_unos','primjena_tretmana',
        'hrana_evidencija','parcela','sezona_kulture','operacija_kulture',
        'svinje_turnus','dokument','dokument_stavka','transakcija'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format($p$
            CREATE POLICY tenant_all ON %I FOR ALL TO authenticated
            USING (gospodarstvo_id IN (SELECT public.my_gospodarstva()))
            WITH CHECK (gospodarstvo_id IN (SELECT public.my_gospodarstva()));
        $p$, t);
    END LOOP;
END $$;

-- =============================================================
-- STORAGE — bucket za slike dokumenata
-- Putanja objekta: <gospodarstvo_id>/<dokument_id>.<ext>
-- Politike dopuštaju pristup samo unutar vlastitog gospodarstva.
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumenti', 'dokumenti', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dokumenti_select" ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'dokumenti'
        AND (storage.foldername(name))[1] IN (SELECT public.my_gospodarstva()::text)
    );
CREATE POLICY "dokumenti_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'dokumenti'
        AND (storage.foldername(name))[1] IN (SELECT public.my_gospodarstva()::text)
    );
CREATE POLICY "dokumenti_delete" ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'dokumenti'
        AND (storage.foldername(name))[1] IN (SELECT public.my_gospodarstva()::text)
    );

-- =============================================================
-- AUTO-PROVISIONING: kod registracije novog auth korisnika
-- kreiraj gospodarstvo + korisnik red (možeš ukloniti ako radiš ručno).
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g_id UUID;
BEGIN
    INSERT INTO public.gospodarstvo (naziv)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'naziv_gospodarstva', 'Moje gospodarstvo'))
    RETURNING id INTO g_id;

    INSERT INTO public.korisnik (id, gospodarstvo_id, ime, email)
    VALUES (NEW.id, g_id, NEW.raw_user_meta_data->>'ime', NEW.email);

    RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
