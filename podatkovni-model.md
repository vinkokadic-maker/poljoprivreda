# Poljoprivreda app — podatkovni model (MVP)

Verzija 0.1 — 5.6.2026

Ovaj dokument opisuje podatkovni model za aplikaciju. Prati ga `schema.sql` (PostgreSQL DDL) i `er-dijagram.mermaid` (ER dijagram). Model je dizajniran oko tri glavna izvještaja koja je korisnik tražio — zarada po turnusu, trošak po hektaru, godišnji pregled — i oko foto-arhive dokumenata s AI ekstrakcijom.

## Ključne odluke

**Multi-tenant od početka.** Svaki zapis nosi `gospodarstvo_id`. Za jednog korisnika to je nevidljivo, ali omogućuje kasniju komercijalizaciju na ~70 sličnih kooperanata bez prepravke modela.

**Dva kanala unutar istog turnusa.** Najvažnija posebnost ovog gospodarstva: u istom objektu, u istom periodu, drže se Vindijini pilići (model `kooperacija`) i pilići drugog dobavljača (model `vlastiti`, hranjeni vlastitom hranom i prodani drugim kupcima). Zato turnus nije isto što i jato. `TURNUS` je fizički ciklus u objektu; `JATO` je pojedini kanal pilića unutar tog turnusa, sa svojim dobavljačem, kupcem, cijenama i dopuštenim postotkom uginuća. Tako se zarada može računati zasebno po kanalu, a okolišni podaci (koje SKOV mjeri na razini cijele kuće) ostaju na razini turnusa.

**Jedinstvena knjiga troškova i prihoda.** Sve novčane stavke idu u jednu tablicu `TRANSAKCIJA` sa smjerom (ulaz = trošak, izlaz = prihod) i kategorijom. Svaka se transakcija može vezati na turnus, jato, parcelu, sezonu kulture ili svinje, te na izvorni dokument. Ovaj jedan dizajn pokreće sve izvještaje — ne treba zasebna logika po grani.

**Dokument kao izvor podataka.** Foto-arhiva nije odvojena galerija. `DOKUMENT` nosi sliku/PDF, AI prijedlog (`ai_podaci` JSONB + `ai_pouzdanost`) i status (`novo` → `prepoznato` → `potvrdeno`). Nakon potvrde korisnika, iz dokumenta se generiraju stavke (`DOKUMENT_STAVKA`) i transakcije/hrana. Time se "lakša evidencija" rješava slikanjem papira, uz potvrdu prije knjiženja (kako je dogovoreno za MVP).

## Entiteti

**Jezgra.** `GOSPODARSTVO` (gospodarstvo/farma), `KORISNIK` (vlasnik, član, radnik), `PARTNER` (dobavljači i kupci — Vindija, drugi dobavljač pilića, mesari, dobavljači repromaterijala).

**Peradarstvo.** `OBJEKT` (peradarnik, kapacitet, veza na SKOV). `TURNUS` (ciklus tova u objektu — datumi useljenja/izlova, status). `JATO` (kanal pilića u turnusu — model, dobavljač, kupac, broj, cijene, dopušteni % uginuća). `DNEVNI_UNOS` (dnevno po turnusu — uginuća, težina, voda, temperatura, vlaga; izvor ručno ili SKOV). `PRIMJENA_TRETMANA` (lijekovi i vitamini). `HRANA_EVIDENCIJA` (ulaz/dostava i utrošak hrane; zastavica `vlastita_hrana` za vlastiti kanal).

**Ratarstvo.** `PARCELA` (naziv, ARKOD, površina u ha). `SEZONA_KULTURE` (kultura na parceli u jednoj godini — omogućuje plodored i prinos). `OPERACIJA_KULTURE` (sjetva, gnojidba, zaštita, žetva — za troškove i evidenciju poticaja).

**Svinje.** `SVINJE_TURNUS` (nabava prasadi, broj, datum/prodaja — osnovni podaci, sporedna grana).

**Dokumenti i financije.** `DOKUMENT`, `DOKUMENT_STAVKA`, `TRANSAKCIJA` (opisani gore).

## Kako model podržava izvještaje

**Zarada po turnusu** — pogled `v_zarada_turnus` zbraja prihode i troškove vezane na turnus. Za odvojenu računicu po kanalu (Vindija vs vlastiti) filtrira se po `jato_id`.

**Trošak po hektaru** — pogled `v_trosak_po_ha` dijeli zbroj troškova sezone kulture s površinom parcele.

**Godišnji pregled** — agregacija `TRANSAKCIJA` po godini i kategoriji/grani (svi entiteti dijele isti format transakcije).

**Novčani tok** — ista tablica, grupirano po datumu/mjesecu (spremno za kasnije, iako nije u prva tri prioriteta).

## Što namjerno NIJE u MVP-u

Automatski uvoz iz SKOV-a (model je spreman preko `objekt.skov_id` i `dnevni_unos.izvor`, ali integracija dolazi kasnije). Potpuno automatsko knjiženje bez potvrde (prvo s potvrdom). Detaljno praćenje mehanizacije, sati rada i goriva po stroju (zasad samo kao transakcija/trošak). Obračun konverzije hrane kao zaseban modul (podaci postoje, izvještaj kasnije).

## Sljedeći korak

Na temelju ovog modela: popis ekrana/funkcija za MVP, odabir tehnologije (npr. mobilni klijent + backend), te seed podaci za testiranje (jedan turnus s dva jata, par parcela).
