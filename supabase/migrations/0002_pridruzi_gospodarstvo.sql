-- =============================================================
-- Migracija 0002 — pridruživanje postojećem gospodarstvu
--
-- Ažurira handle_new_user: ako registracija nosi metapodatak
-- 'gospodarstvo_id', novi korisnik se pridružuje TOM gospodarstvu
-- (ne stvara se novo). Tako vlasnik može dodati člana koji vidi
-- sve postojeće podatke.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g_id UUID;
BEGIN
    IF NEW.raw_user_meta_data ? 'gospodarstvo_id' THEN
        -- pridruži se postojećem gospodarstvu
        g_id := (NEW.raw_user_meta_data->>'gospodarstvo_id')::uuid;
    ELSE
        -- standardna registracija: novo gospodarstvo
        INSERT INTO public.gospodarstvo (naziv)
        VALUES (COALESCE(NEW.raw_user_meta_data->>'naziv_gospodarstva', 'Moje gospodarstvo'))
        RETURNING id INTO g_id;
    END IF;

    INSERT INTO public.korisnik (id, gospodarstvo_id, ime, email, uloga)
    VALUES (
        NEW.id,
        g_id,
        NEW.raw_user_meta_data->>'ime',
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'uloga', 'vlasnik')
    );

    RETURN NEW;
END $$;
