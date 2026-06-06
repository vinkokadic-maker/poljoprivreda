-- Provjera da je baza dobro postavljena.
-- Zalijepi u Supabase SQL Editor i pokreni (Run).
-- Usporedi brojeve sa "Očekivano" niže.

SELECT 'tablice' AS sto, count(*) AS broj
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'pogledi', count(*)
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 'tablice s RLS', count(*)
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public' AND c.relrowsecurity
UNION ALL
SELECT 'politike (public)', count(*)
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 'storage bucket dokumenti', count(*)
FROM storage.buckets
WHERE id = 'dokumenti'
ORDER BY sto;

-- Očekivano:
--   tablice                   = 16
--   pogledi                   = 2
--   tablice s RLS             = 16
--   politike (public)         = 18
--   storage bucket dokumenti  = 1
