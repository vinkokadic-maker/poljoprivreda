# Dodavanje članova (pristup farmi) — postavljanje

Vlasnik sada može kroz aplikaciju dodati osobu koja vidi sve podatke farme.
Za to treba: (1) primijeniti migraciju 0002 i (2) dodati Supabase service role ključ.

## 1. Primijeni migraciju u bazi

Supabase → **SQL Editor** → zalijepi i pokreni sadržaj datoteke
`supabase/migrations/0002_pridruzi_gospodarstvo.sql`.
(To samo ažurira postojeću funkciju — sigurno je pokrenuti.)

## 2. Dodaj service role ključ

Supabase → **Project Settings → API** → kopiraj **service_role** ključ (secret, dugačak `eyJ...`).

> ⚠️ Ovaj ključ ima puni pristup bazi. Drži ga u tajnosti — koristi se samo na serveru.

**Lokalno:** u `.env.local` dodaj:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...tvoj-service-role
```

Pa restart: Ctrl+C, `npm run dev`.

**Na Vercelu:** Settings → Environment Variables → dodaj isti `SUPABASE_SERVICE_ROLE_KEY` → Save → Deployments → Redeploy.

## 3. Pošalji kod na Vercel

```
git add .
git commit -m "Dodavanje clanova kroz app"
git push
```

## Kako se koristi

1. Na početnom ekranu, u kartici **Članovi**, upiši ime, email i početnu lozinku osobe.
2. Klikni **Dodaj člana**.
3. Javi toj osobi email i lozinku — ona se prijavi i odmah vidi sve podatke farme.

Novi član ima ulogu „clan". Vlasnik si ti (uloga „vlasnik"). Svi dijele iste podatke gospodarstva.
