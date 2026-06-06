# Kako pokrenuti aplikaciju (korak po korak)

Aplikacija je već napisana. Treba je samo spojiti na tvoju Supabase bazu i pokrenuti.

## 1. Upiši svoje Supabase ključeve

1. U Supabase otvori **Project Settings** (zupčanik) → **API**.
2. Trebaju ti dvije vrijednosti:
   - **Project URL** (npr. `https://abcd1234.supabase.co`)
   - **anon public** ključ (dugačak niz znakova)
3. U mapi projekta napravi novu datoteku imena **`.env.local`** (točno tako, s točkom na početku).
   Najlakše: kopiraj postojeću `.env.local.example`, preimenuj kopiju u `.env.local`, pa upiši svoje vrijednosti:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ovdje-zalijepi-anon-kljuc
```

## 2. Isključi potvrdu emaila (samo za razvoj)

Da se možeš odmah prijaviti bez potvrde maila:

1. Supabase → **Authentication** → **Sign In / Providers** → **Email**.
2. Isključi opciju **"Confirm email"** i spremi.

(Kasnije, kad app ide u stvarnu upotrebu, ovo se može vratiti.)

## 3. Instaliraj i pokreni

Otvori **Command Prompt** u mapi projekta. Najlakše: u File Exploreru uđi u mapu projekta, u adresnu traku upiši `cmd` i pritisni Enter — otvori se crni prozor već u toj mapi.

Upiši ove dvije naredbe (prvu pokreneš jednom, čeka se ~1 min):

```
npm install
npm run dev
```

Kad vidiš poruku `Local: http://localhost:3000`, otvori taj link u pregledniku.

## 4. Isprobaj

1. Klikni **Registriraj se**, upiši ime, naziv gospodarstva, email i lozinku.
2. Trebao bi se otvoriti ekran "Pregled" s nazivom tvog gospodarstva.
3. Dodaj objekt (npr. "Objekt 1", kapacitet 22000), pa dodaj turnus.

Ako sve to radi — cijeli sustav (aplikacija → baza → sigurnost) je spojen. 🎉

## Zaustavljanje / ponovno pokretanje

- Zaustavi server: u crnom prozoru pritisni `Ctrl + C`.
- Ponovno pokreni: `npm run dev` (ne treba opet `npm install`).

## Ako nešto ne radi

Prepiši mi točan tekst greške (iz preglednika ili iz crnog prozora) i riješit ćemo.
