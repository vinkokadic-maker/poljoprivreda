# AI čitanje dokumenata — postavljanje

App sada može pročitati sliku dokumenta (otpremnica, račun, vagarski list) i sam predložiti podatke,
a ti odabereš turnus i potvrdiš → knjiži se u troškove. Za to treba Claude (Anthropic) API ključ.

## 1. Nabavi API ključ

1. Idi na **https://console.anthropic.com** i prijavi se / registriraj.
2. Lijevo **Settings → API Keys → Create Key**, daj mu ime (npr. „poljoprivreda"), kopiraj ključ (`sk-ant-...`).
3. Za korištenje treba imati malo kredita na računu (Billing → dodaj sredstva; svako čitanje dokumenta košta nekoliko centi).

## 2. Lokalno (na tvom kompu)

U datoteku **`.env.local`** dodaj novi red:

```
ANTHROPIC_API_KEY=sk-ant-...tvoj-kljuc
```

Zatim instaliraj novu biblioteku i ponovno pokreni:

```
npm install
```

(zaustavi server s Ctrl+C ako radi, pa `npm run dev`)

## 3. Na Vercelu (da radi i na mobitelu brata)

1. Pošalji izmjene na GitHub (Vercel će sam objaviti):

```
git add .
git commit -m "AI citanje dokumenata"
git push
```

2. U Vercelu: **Project → Settings → Environment Variables** dodaj:

```
ANTHROPIC_API_KEY = sk-ant-...tvoj-kljuc
```

3. **Deployments → ⋯ → Redeploy** (da pokupi novi ključ).

> Važno: `ANTHROPIC_API_KEY` nema `NEXT_PUBLIC_` prefiks — to znači da je tajan i koristi se samo na serveru, nikad se ne vidi u pregledniku.

## Kako koristiti

1. Na ekranu **Dokumenti** slikaj/odaberi dokument i klikni **Spremi i pročitaj**.
2. AI pročita sliku i ispod dokumenta pokaže prepoznate stavke.
3. Odabereš **turnus** (i po želji kanal) i klikneš **Potvrdi i knjiži** — stavke odu u troškove tog turnusa, a zarada se preračuna.

Ako AI promaši tip ili podatke, zasad to ispraviš ručno u troškovima turnusa. Kasnije možemo dodati uređivanje prijedloga prije knjiženja.
