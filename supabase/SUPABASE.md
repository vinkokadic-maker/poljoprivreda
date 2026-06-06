# Supabase — postavljanje baze

Datoteke:

- `migrations/0001_init.sql` — cijela shema, RLS (multi-tenant), Storage bucket, auto-provisioning korisnika.
- `seed.sql` — demo podaci za testiranje (bez auth korisnika).

## Primjena — dvije opcije

### A) Brzo, preko web SQL editora (najlakše za početak)

1. U Supabase projektu otvori **SQL Editor**.
2. Zalijepi sadržaj `migrations/0001_init.sql` i pokreni.
3. (Opcionalno) zalijepi `seed.sql` i pokreni za demo podatke.

### B) Supabase CLI (preporučeno čim krene razvoj)

```bash
# u korijenu projekta (gdje je /supabase folder)
supabase login
supabase link --project-ref <PROJECT_REF>   # iz URL-a Supabase projekta
supabase db push                            # primijeni migracije na remote
# za lokalni razvoj: supabase start  +  supabase db reset (učita i seed.sql)
```

`<PROJECT_REF>` je dio URL-a tvog projekta (`https://<PROJECT_REF>.supabase.co`).

## Što migracija postavlja

- **16 tablica** + 2 izvještajna pogleda (`v_zarada_turnus`, `v_trosak_po_ha`).
- **RLS** uključen na svim tablicama. Pristup je ograničen na vlastito gospodarstvo preko funkcije `public.my_gospodarstva()`. Korisnik nikad ne vidi tuđe podatke — bitno za kasniju komercijalizaciju.
- **Auto-provisioning**: kad se registrira novi auth korisnik, trigger `on_auth_user_created` automatski kreira `gospodarstvo` i `korisnik` red. Pri registraciji možeš poslati metapodatke `ime` i `naziv_gospodarstva` (Supabase `signUp({ options: { data: {...} }})`). Ako želiš ručno upravljati, ukloni trigger na dnu migracije.
- **Storage bucket `dokumenti`** (privatan) za slike/scan/PDF. Putanja objekta neka bude `<gospodarstvo_id>/<dokument_id>.<ext>` — politike dopuštaju pristup samo unutar vlastitog gospodarstva. U `dokument.datoteka_url` spremi taj storage path.

## Vercel — env varijable

U Vercel projektu (Settings → Environment Variables) dodaj:

```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # SAMO za server-side (API rute), nikad u browser
```

`URL` i `anon key` su u Supabase: Project Settings → API. Service role ključ koristi isključivo na serveru (npr. za AI obradu dokumenata koja zaobilazi RLS).

## Redoslijed za AI obradu dokumenata (kasnije)

1. Klijent slika dokument → upload u `dokumenti` bucket na `<gospodarstvo_id>/...`.
2. Kreira se `dokument` red sa `status='novo'`, `datoteka_url`.
3. Server (Vercel API ruta, service role) pošalje sliku AI-u → popuni `tip`, `ai_podaci`, `ai_pouzdanost`, `dokument_stavka` → `status='prepoznato'`.
4. Korisnik u aplikaciji potvrdi → kreiraju se `transakcija`/`hrana_evidencija` → `status='potvrdeno'`.

## Napomena

`gen_random_uuid()` radi bez extension-a (pg15). Ako kasnije migracije rastu, drži ih numerirane (`0002_...`, `0003_...`) i nikad ne mijenjaj već primijenjenu migraciju — radije dodaj novu.
