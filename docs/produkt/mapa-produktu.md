# Mapa produktu – Akadémia rozvoja klubov

Stav k 16. 10. 2026. Schválené Cyrilom 16. 10. 2026 (rozhodnutia v časti 10). Zostavené z artifactov, ktoré v claude.ai navrhol kolega
v niekoľkých sessions. Pri rozpore platí kód → ADR → tento dokument.

## 1. Zadanie a rozhodnutia (Cyril, 15. 10. 2026)

- Z návrhov v artifactoch vznikne **jedna aplikácia** na `rozvojklubu.ltk.solutions`.
- **Prvý cieľ: rovno pilot Stupňa II** (prihlásená časť) pre pilotné kluby. Termín nie je.
- Obsah oblastí, detailov a otázok je **spravovateľný obsah** (upraviteľný bez programátora).
- Aplikácia je **samostatný web s prihlásením cez Sportnet** (nie sekcia v my.sportnet.online).
- Pri rozpore medzi artifactmi platí **vždy najnovšia verzia**.

## 2. Inventár artifactov

Všetky vlastní Cyril. Ukladajú len do prehliadača (`localStorage`, URL hash); výnimkou je Vizitka (zdieľaná DB artifactu).

### Hlavné stránky

| Artifact                                                                                 | Úroveň      | Stav                         | Poznámka                                           |
| ---------------------------------------------------------------------------------------- | ----------- | ---------------------------- | -------------------------------------------------- |
| [Hub „dve dráhy“](https://claude.ai/artifact/Eh9FMegEMaPXtVQ8VpdVdv)                     | I (verejný) | náčrt, **najnovší**          | dráhy Klub v obci + Akadémia profesionálneho klubu |
| [Hub v2](https://claude.ai/artifact/H5PD8ySzmvKueNXP88cQkR)                              | I           | náčrt, o chlp starší         | naň stále odkazujú všetky oblasti („Zmeniť klub“)  |
| [Hub v1](https://claude.ai/code/artifact/7ad4a766-67c1-458c-9eec-7f6260dfab14)           | I           | zastaraný                    | iné pravidlo veľkosti, 5 rolí                      |
| [Kompas klubu v2](https://claude.ai/artifact/Ae7wEPZywnW5wXWnGCVgEt)                     | I           | **najnovší**                 | sebahodnotenie 11 × 20 otázok                      |
| [Kompas klubu v13](https://claude.ai/code/artifact/88e2045d-5269-462c-bda8-e532956b6b00) | I           | „zostáva v prevádzke“        | ručný režim, `k3`/`k4` prenos, REF priemer         |
| [Moja Akadémia](https://claude.ai/artifact/KiFPjbgRfYctPcGqeLBM7J)                       | II          | ukážka s ilustračnými dátami | nástenka podľa 7 rolí, kalendár, blok Stupeň II    |
| [Vizitka klubu – licenčný systém](https://claude.ai/artifact/V4vuQsZw4EscYsBQ7EzYwA)     | II          | „ostrá verzia pre pilot“     | body oblastí 2–7, zdieľané ukladanie               |

### Oblasti (prehľad + detail)

| #   | Oblasť                    | Prehľad                                                                          | Detail                                                                           | Formát detailu                          |
| --- | ------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Vedenie klubu             | [a1fe4e94](https://claude.ai/code/artifact/a1fe4e94-9f18-4360-966e-b3e8e3bec55b) | [1cd0c1b5](https://claude.ai/code/artifact/1cd0c1b5-0aa4-4cc2-bdbb-15cfbdfa5d1a) | statický (Stupeň I)                     |
| 2   | Manažér klubu             | [9f01cc85](https://claude.ai/code/artifact/9f01cc85-2dd7-41a6-89c5-adb6070a4840) | [76b6d262](https://claude.ai/code/artifact/76b6d262-f7ea-4a86-b3f8-bb2ecb2e8afd) | statický                                |
| 3   | Tréneri                   | [0923f8a0](https://claude.ai/code/artifact/0923f8a0-a574-4cca-b96b-73d048c07d21) | [a2883ec3](https://claude.ai/code/artifact/a2883ec3-2a4e-4d9e-9356-a77279a2de88) | **nový – „Moja prax“ podľa roly**       |
| 4   | Tímoví hráči klubu        | [2173b5c9](https://claude.ai/code/artifact/2173b5c9-4fe2-4f59-9d25-02cd984e3eb4) | [d88df306](https://claude.ai/code/artifact/d88df306-c280-4e5d-b084-a27c0ddc2061) | **nový – „Moja prax“ podľa roly**       |
| 5   | Hráč, hráčka              | [c0197f4f](https://claude.ai/code/artifact/c0197f4f-4221-439c-b599-16025e42e03d) | [18eacd05](https://claude.ai/code/artifact/18eacd05-c64e-4a5d-9585-7800d815b98b) | statický + filter kategórií             |
| 6   | Aktivity v klube          | [23fdf503](https://claude.ai/code/artifact/23fdf503-6e62-4ae2-874b-bbe0d3dae04d) | [5ttqA1ZA](https://claude.ai/artifact/5ttqA1ZAWtNo8Rrw1P6qEi)                    | statický + filter kategórií             |
| 7   | Marketing a fanúšikovia   | [26dd5c6a](https://claude.ai/code/artifact/26dd5c6a-92bf-4ed7-8c99-2b466f858b62) | [QNtCudkT](https://claude.ai/artifact/QNtCudkTNqvSKNQNz3NKWx)                    | statický                                |
| 8   | Financie a zdroje         | [4cfd302c](https://claude.ai/code/artifact/4cfd302c-444d-4425-9347-74e16e20874d) | [2EFy1ucR](https://claude.ai/artifact/2EFy1ucRTrZk6ddAGAG6mA)                    | statický                                |
| 9   | Právne a formálne minimum | [02474a87](https://claude.ai/code/artifact/02474a87-eb6a-4533-a0cb-8a769f45af20) | [BTQcu18M](https://claude.ai/artifact/BTQcu18MZN59RTgr1Soj6Q)                    | statický                                |
| 10  | Digitalizácia a dáta      | [5915b6ed](https://claude.ai/code/artifact/5915b6ed-8a6e-47bb-ba0e-cc27b1cffef5) | [SPRup7UH](https://claude.ai/artifact/SPRup7UHNsTdGySUbwSMAJ)                    | statický                                |
| 11  | Prostredie klubu          | [dad55acb](https://claude.ai/code/artifact/dad55acb-06b7-4627-8a15-65177fbc82ff) | [JSbGcT6g](https://claude.ai/artifact/JSbGcT6g2Np9GcChJPcqyu)                    | statický (zlúčené Zdravie a bezpečnosť) |

Pásma oblastí (farby): 1–4 Ľudia a riadenie, 5–7 Hráči a rast, 8–11 Chod klubu.

## 3. Produkt v skratke

**Stupeň I – verejný, bez prihlásenia**

- **Hub**: vyhľadávanie „Čo dnes riešite?“ (index 853 položiek: kroky, vzory, 220 otázok), pohľad podľa roly
  (rola mení len poradie oblastí, nič neskrýva), výber klubu s číslami zo Sportnetu, veľkosť klubu, 11 dlaždíc oblastí.
  Druhá dráha _Akadémia profesionálneho klubu_ má 11 vlastných oblastí – zatiaľ len názvy („pripravujeme“).
- **Oblasť** (prehľad, 6 blokov): opis → prečo → čo klub robí → sebahodnotenie 2 × 10 → čo ďalej (3 horizonty) → roly a kam sa obrátiť.
- **Detail oblasti** (samoštúdium): popis → dôležitosť → implementácia (vetvy A/B/C, kroky s výstupom, akčný plán,
  6 chýb) → tematické časti → sociálna zodpovednosť → sebahodnotenie → knižnica vzorov.
  Nový formát (oblasti 3 a 4) pridáva **„Moja prax“**: 5 rolí, prvý krok na tento týždeň, cesta s 3 variantmi
  (rýchla / bežná / pre väčší klub), zásobník krokov, ukazovatele „teraz / o mesiac“, mentorské moduly Stupňa II.
- **Kompas klubu**: sebahodnotenie 11 oblastí × 20 otázok (220 bodov), „čo urobiť najbližšie“ (3 najslabšie oblasti),
  profil klubu, vizitka pre obec (tlač/PDF, bez skóre), riadok `SFZ-KOMPAS-1` pre mentora.

**Stupeň II – po prihlásení (pilot)**

- **Moja Akadémia**: nástenka podľa roly – kvalifikácia z ISSF, stav v Akadémii (stupeň, certifikované oblasti),
  „čo mám urobiť ja“, novinky, kontakty, „čo táto rola vidí“, kalendár s potvrdzovaním účasti.
  Blok **Klub v Stupni II**: _Naši tréneri_ (kategória → tréner → licencia → platnosť → náhradník → kurz ochrany detí,
  s upozorneniami) a _Náš tím_ (tímoví hráči klubu, hodiny, poďakovanie, potvrdenie 40+ h pre 3 % dane).
- **Vizitka klubu – licenčný systém**: oblasti 2 Tímy, 3 Hráči, 4 Tréneri sa počítajú zo Sportnetu (uzamknuté),
  5 Infraštruktúra, 6 Aktivity, 7 Spolupráca vypĺňa klub; pásma Grassroots / Bronzový / Strieborný / Zlatý.
- **Kohorta a mentor**: kluby ObFZ v kohorte, mentor overuje oblasti (30 min, 3 dôkazy), certifikát oblasti,
  regionálny deň, kredit pre klub (príklad 140 € za 2 oblasti). Zatiaľ len opis, žiadne pravidlá.

## 4. Spravovaný obsah (globálny, bez tenanta)

| Entita           | Obsah                                                                                                                    | Poznámka                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Area             | číslo, názov, krátky názov, pásmo, dráha, silné väzby, popis, texty pre roly                                             | 11 + 11 (dráha akadémie)                                                                            |
| AreaOverview     | 6 blokov                                                                                                                 | zdvojené v detaile („Prehľadové bloky“) – zdroj pravdy určiť                                        |
| AreaDetail       | sekcie, vetvy, kroky (`title, body, output`), akčný plán, chyby, tematické časti                                         | časť obsahu je časovo citlivá (dane, e-faktúry 2027, odmeny trénerov) → `validAsOf` a dátum revízie |
| PracticeByRole   | rola → zodpovednosti, prvý krok, cesta (kroky × 3 možnosti, alternatíva pre vetvu B), zásobník, ukazovatele, „kam ďalej“ | zatiaľ len oblasti 3 a 4                                                                            |
| Template (vzor)  | typ (tabuľka, vzor, scenár, formulár, dohoda, checklist), názov, úvod, text                                              | dnes len text; sľubované Word/Excel/PDF                                                             |
| KompasQuestion   | oblasť, stĺpec (`i` implementácia / `s` sociálna zodpovednosť), poradie, text, značky `D Z DO S zd rast`                 | 220 otázok, verzované                                                                               |
| RoleLens         | rola, dráha, primárne oblasti, vety, „Začnite tu“                                                                        | Hub                                                                                                 |
| SizeTierVariant  | ľubovoľný blok s variantom pre stredný / veľký klub                                                                      |                                                                                                     |
| LicensingRuleSet | body licencií, koeficient sídla, prahy pásiem, položky infraštruktúry, aktivít a spolupráce                              | verzia + príznak „predbežné“                                                                        |

## 5. Dáta klubu a osôb

Zdroj pravdy o kluboch a osobách je Sportnet (čítanie), v MongoDB sú len dáta aplikácie s `clubId` (ADR 0003).

| Entita              | Kľúčové polia                                                                       | Zdroj                                                               |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Club                | `clubId` (kanonické Sportnet ID), názov, ObFZ, RFZ, úroveň, akadémia                | Sportnet                                                            |
| ClubSeason          | sezóna, mládež, dospelí, dievčatá, družstvá, kategórie, tréneri                     | Sportnet (cache s dátumom)                                          |
| Team / Roster       | vekovka, pohlavie, súťaže a ich úroveň, hráči                                       | Sportnet                                                            |
| CoachAssignment     | osoba, družstvá, pozícia, licencie (`type, validTo`), kurz ochrany detí             | Sportnet + ISSF                                                     |
| Membership          | osoba, klub alebo zväz, rola, rozsah (kategórie), platnosť (sezóna), kto pozval     | funkcionári zo Sportnetu; rodič a tímový hráč pozvánkou v aplikácii |
| KompasAssessment    | klub, sezóna, odpovede, ručné skóre, režim, profil, odoslané mentorovi              | aplikácia                                                           |
| PracticeProgress    | klub, oblasť, rola, hotové kroky, zvolené varianty, dátum štartu, ukazovatele       | aplikácia                                                           |
| LicensingEvaluation | klub, sezóna, počet obyvateľov, ručné polia oblastí 5–7, pohlavie trénera           | aplikácia                                                           |
| CoachRegisterNote   | klub, kategória, náhradník                                                          | aplikácia (zvyšok zo Sportnetu)                                     |
| TeamMember          | klub, osoba alebo meno, čo vie, s čím pomôže, čas, hodiny, poďakovanie              | aplikácia – **GDPR**                                                |
| Cohort              | zväz, mentor, kluby, sezóna, otvorené oblasti                                       | aplikácia                                                           |
| AreaCertification   | klub, oblasť, stav, overenie (dátum, mentor, dôkazy)                                | aplikácia                                                           |
| Credit              | klub, suma, dôvod                                                                   | aplikácia                                                           |
| Event / Rsvp        | druh (klub, kategória, kohorta, SFZ, obsadenie), adresáti, potvrdzovanie, dochádzka | aplikácia; obsadenia a súťaže zo Sportnetu                          |
| Consent             | dieťa, klub, typ (fotky, video), dátum                                              | otvorené – aplikácia alebo Sportnet                                 |

## 6. Roly a viditeľnosť

Roly v návrhoch (súčasný kód má iné: `admin_sfz, obfz, club_manager, mentor, volunteer, public`).

| Rola                      | Kde                       | Vidí                                                                                  | Nevidí                                |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Vedenie / manažér / výbor | klub                      | **všetko o klube**: skóre, slabiny, rozpočet, certifikácie, kredit; edituje Stupeň II | –                                     |
| Tréner                    | klub                      | skóre klubu (svoje oblasti 3 a 5 zvýraznené), svoje kategórie a licenciu              | rozpočet, osobné údaje iných trénerov |
| Mentor zväzu              | kohorta ObFZ              | kluby kohorty menovite (ako vedenie, bez interných textov), len na čítanie            | iné ObFZ menovite (len priemery)      |
| Rodič                     | klub (pozvánka, 1 sezóna) | vizitku klubu, kategóriu dieťaťa, trénera, termíny                                    | sebahodnotenie a slabiny              |
| Hráč (od 15 r.)           | klub                      | registráciu, ponuku druhej roly, termíny                                              | sebahodnotenie, iných hráčov          |
| Tímový hráč klubu         | klub (pozvánka, 1 sezóna) | úlohy, termíny, čo klub ponúka                                                        | skóre, rozpočet                       |
| Rozhodca                  | ObFZ                      | licenciu, obsadenia, odmeny                                                           | sebahodnotenie klubov                 |
| SFZ                       | celoslovensky             | agregáty a rebríček oblastí                                                           | –                                     |
| Fanúšik                   | verejne                   | len Stupeň I                                                                          | –                                     |

## 7. Pravidlá a výpočty

**Veľkosť klubu** (od 8. 10. 2026): hráči a hráčky mládeže + dospelí. Malý pod 80, stredný 80–199, veľký 200+.
Kategórie a partnerské školy veľkosť nemenia.

**Kompas**

- Otázka platí, ak nemá vekovú značku, má `rast`, klub nemá zadanú žiadnu vekovú kategóriu, alebo značka sedí.
- Body za stĺpec = `round(zaškrtnuté platné / platné × 10)`; stĺpec s menej ako 3 platnými otázkami → oblasť sa nepočíta.
- Oblasť 0–20, spolu 0–220. Ručný režim: 0–10 + 0–10.
- Pásma: 0–4 Začiatok, 5–8 Rozbieha sa, 9–12 Priemer, 13–16 Dobré, 17–20 Vzor.
- Cesty v detailoch: oblasť 3 – kategória bez trénera → A, inak B; oblasť 4 – „Pri každej úlohe je meno“ neplatí → A.
- Riadok pre mentora:
  `SFZ-KOMPAS-1|klub|ObFZ|kraj|sezóna|veľkosť|u-s ×11 (čiarkou, „-“ = nevyplnené)|kk;cm;dievčatá;tréneri;trénerky;ks;cd;bez trénera`

**Vizitka (licenčný systém)**

| Oblasť           | Body                                                                          | Pásma G / B / S / Z              |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| 2 Tímy           | družstvá v súťaži × 20 (ženské × 1,5) × koeficient sídla                      | 0–99 / 100–159 / 160–199 / 200+  |
| 3 Hráči          | hráči + hráčky × 1,5, × koeficient; pod 15 bez pásma                          | 15–39 / 40–79 / 80–119 / 120+    |
| 4 Tréneri        | najvyššia platná licencia: PRO 15, A 10, B 6, C 4, GC 2, GL 1; trénerky × 1,5 | 0–19 / 20–39 / 40–59 / 60+       |
| 5 Infraštruktúra | počet kusov × body podľa rozmeru                                              | 0–59 / 60–119 / 120–179 / 180+   |
| 6 Aktivity       | predbežné body (XPS, nábory, turnaje, kempy, web, siete)                      | 0–148 / 149–248 / 249–349 / 350+ |
| 7 Spolupráca     | predbežné body (komisie, festivaly, krúžky, súťaže škôl)                      | bez pásma                        |

Koeficient sídla podľa počtu obyvateľov: do 99 → 1,9 … od 50 000 → 1,0 (10 pásiem). Zatiaľ ho zadáva klub.

## 8. Integrácie

- **Sportnet OIDC** – prihlásenie (hotové v kóde, neoverené end-to-end).
- **Sportnet / ISSF dáta** – kluby, sezóny, družstvá a súťaže, súpisky, realizačné tímy, licencie trénerov a ich
  platnosť, ďalší členovia tímov. Dnes sú v artifactoch ako statický snapshot (10 klubov, stav 30. 9. – 11. 10. 2026).
- **statistika.futbalsfz.sk** – počty hráčov v Hube a Kompase (líšia sa od súpisiek vo Vizitke, napr. Dukla 507 vs. 423).
- **Futbalnet** – odkaz na profil klubu.
- Kalendár: obsadenia rozhodcov a súťažné termíny majú prísť zo Sportnetu.

Pilotné kluby: MFK Dukla Banská Bystrica, Slavoj Trebišov, ŠKM Liptovský Hrádok, FK Koprivnica-Marhaň,
OFK Pusté Úľany, TJ Slovan Bojná, FAM Poprad, MŠK Snežnica, FK v Nižnom Žipove, TJ Družstevník Plechotice.

## 9. Nezrovnalosti v návrhoch

1. **Názov oblasti 4**: „Tímoví hráči klubu“ (Hub, Kompas, detail 4) vs. „Dobrovoľníci a rodičia“ (Moja Akadémia, oblasti 3, 5, 6).
   Oblasť 9 aj ako „Zdravie a bezpečnosť“ (detail 2), „hospodár“ v oblasti 2 v zmysle ekonóma.
2. **Tri sady otázok na oblasť**: prehľad oblasti (20, oblasť 11 má 40) ≠ detail = Kompas (20).
3. **Dva formáty detailu**: nový „Moja prax“ (3, 4) a statický (ostatné).
4. **Dve číslovania**: licenčný systém má 9 oblastí, Akadémia 11 (napr. Tréneri = 4 vs. 3).
5. **ID klubu**: `klub-11686` / `issf_club_11686` / futbalnet slug – treba jedno kanonické.
6. **Počet hráčov**: štatistiky SFZ vs. súpisky.
7. **Viditeľnosť mentora**: „kluby svojho kraja“ (Kompas) vs. „kluby svojej kohorty ObFZ“ (Moja Akadémia).
8. **Moja Akadémia** používa fiktívny klub a fiktívnu kohortu Trebišov, nie pilotných 10; dni v týždni v kalendári nesedia.
9. **Odkazy** medzi artifactmi vedú na rôzne verzie Hubu a Kompasu.
10. **Neexistuje**: „Kompas SFZ“ (zber riadkov a reporty), pravidlá certifikácie, kreditu a celkovej úrovne klubu.

## 10. Rozhodnutia (pôvodne otázky)

1. **Rozsah pilotu Stupňa II** – **Rozhodnuté 16. 10.:** Vizitka (licenčný systém), Kompas uložený v aplikácii
   s odoslaním mentorovi, Moja Akadémia pre vedenie, trénera a mentora, Naši tréneri. Kohorta, certifikácia,
   Náš tím a kalendár až v ďalšej vlne.
2. **Pilotné kluby** – **Rozhodnuté 16. 10.:** 10 klubov z Vizitky (zoznam v časti 8).
3. **Sportnet dáta** – ~~máme API?~~ **Rozhodnuté 16. 10.: API zatiaľ nemáme.** Začneme importom snapshotu
   z artifactov (10 klubov, 2 sezóny) za rozhraním, ktoré neskôr nahradí živé API.
4. **Jedna sada otázok na oblasť** – **Rozhodnuté 16. 10.: áno**, 220 otázok Kompasu; sady z prehľadov oblastí sa vypúšťajú.
5. **Formát detailu** – **Rozhodnuté 16. 10.: každá oblasť bude mať dve časti, Prax (podľa roly) a Metodiku (celý materiál).**
   Prax dnes existuje len v oblastiach 3 a 4 a preberá sa hneď; pri ostatných oblastiach sa prevezme metodika
   a prax sa doplní, keď vznikne. Obsahový model musí prax podporovať pre všetkých 11 oblastí.
6. **Mentor** – **Rozhodnuté 16. 10.: vidí kluby svojej kohorty (ObFZ) menovite**, ostatné len ako priemery.
7. **Roly** – **Rozhodnuté 16. 10.:** roly v klube ako väzba osoba – klub – rola – sezóna; `user.role` zostáva
   len pre globálne oprávnenia (admin SFZ). Pozri ADR 0004.
8. **Správa obsahu** – **Rozhodnuté 16. 10.:** zatiaľ len admin SFZ cez jednoduchú administráciu, ďalší redaktori neskôr.

## 11. Poradie prác

| Fáza  | Obsah                                                                                       | Výsledok                                   |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F1    | dokončiť prihlásenie (PR, test s DB, premenné vo Verceli)                                   | prihlásenie cez Sportnet aj e-mail funguje |
| F2    | model rolí v klube + kluby a sezóny zo Sportnetu pre pilotné kluby                          | používateľ vidí svoj klub a rolu           |
| F3    | spravovaný obsah: oblasti a 220 otázok Kompasu (+ jednoduchá administrácia)                 | obsah v DB, upraviteľný                    |
| F4    | Kompas v aplikácii: sebahodnotenie, výsledok, odoslanie mentorovi (+ export `SFZ-KOMPAS-1`) | klub sa ohodnotí a mentor to vidí          |
| F5    | Vizitka – licenčný systém (oblasti 2–4 zo Sportnetu, 5–7 ručne)                             | body a pásma pre pilotné kluby             |
| F6    | Moja Akadémia: nástenka pre vedenie, trénera a mentora; Naši tréneri                        | Stupeň II v ostrej podobe                  |
| F7    | kohorta, overenie a certifikácia oblastí; Náš tím; kalendár                                 | celý cyklus Stupňa II                      |
| ďalej | Hub a obsah Stupňa I verejne, dráha akadémie, CS/EN                                         |                                            |

Každá fáza = vlastná vetva a PR, rozhodnutia ako ADR.
