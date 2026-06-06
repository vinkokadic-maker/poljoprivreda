# Objava na Vercel

## Korak 1 — kod na GitHub

Otvori terminal **u korijenu projekta** (mapa `poljoprivreda`, ondje gdje je `package.json` — NE u `app` podmapi).

Ako mapa još nije git repo:

```
git init
git add .
git commit -m "Poljoprivreda app - prva verzija"
```

Napravi novi **prazan** repo na GitHubu (bez README), pa:

```
git branch -M main
git remote add origin https://github.com/<tvoj-korisnik>/<ime-repoa>.git
git push -u origin main
```

> `.env.local` se NEĆE poslati (u `.gitignore` je) — to je ispravno, ključeve unosimo u Vercel ručno.

## Korak 2 — import u Vercel

1. Na **vercel.com** → **Add New… → Project**.
2. Odaberi taj GitHub repo → **Import**.
3. Framework: **Next.js** (sam prepozna). Root Directory: ostavi `./`.
4. Otvori **Environment Variables** i dodaj dvije (iste kao u `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL   = https://<tvoj-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon public ključ>
```

5. Klikni **Deploy** i pričekaj ~1 min.

## Korak 3 — provjera

- Vercel ti da link tipa `https://ime-projekta.vercel.app`.
- Otvori ga na mobitelu, registriraj se / prijavi, isprobaj.
- Na mobitelu možeš „dodati na početni ekran" da izgleda kao app.

## Korak 4 — Supabase (ako koristiš potvrdu emaila)

Supabase → **Authentication → URL Configuration** → upiši svoj Vercel link u **Site URL**.
(Za sada radimo s isključenom potvrdom emaila, pa nije kritično, ali korisno je postaviti.)

## Od sada nadalje

Svaki put kad promijenimo kod i napraviš `git push`, Vercel **sam** napravi novu verziju online. Ništa više ne treba ručno.
