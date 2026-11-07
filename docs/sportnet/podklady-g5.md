# Podklady G5 – administrácia (S3)

- Pre: Ján Letko (LTK Solutions), etapa S3 zo zadania `docs/sportnet/zadanie-s1-s3.md`
- Pripravil: Cyril Janoško (Claude), 7. 11. 2026
- Stav návrhu: **doplnený 7. 11., čaká na schválenie Cyrila.** Kým pri obrazovke nie je „schválené“, server
  a rám sa robiť môžu, obrazovka sa dokončí až po schválení (CLAUDE.md, ADR 0018).

Odpovede na otázky Jána zo 7. 11. sú v poradí jeho bodov 1–7.

## 1. Prístup k návrhu

- Plátno „Rozvoj klubu – redesign“: https://claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb, riadok **Skupina 5**.
  Zdieľanie s účtom Jána nastaví Cyril (Share). Kým nie je zdieľané, platí tento dokument a export, ktorý pošle Cyril.
- Artboardy G5 (súbory na plátne):

| Artboard                     | Obrazovka                                                  | Stav 7. 11.                           |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `AdminSportnet.dc.html`      | Sportnet – desktop, interaktívny                           | nové, čaká                            |
| `AdminMobilSportnet.dc.html` | Sportnet – mobil 375 px, menu v Drawer                     | nové, čaká                            |
| `AdminKluby.dc.html`         | Kluby – desktop, detail v Drawer                           | upravené, čaká                        |
| `AdminMobilKluby.dc.html`    | Kluby – mobil, karty a filtre v Modale                     | nové, čaká                            |
| `AdminCiselniky.dc.html`     | Číselníky – desktop                                        | upravené, čaká                        |
| `AdminOsoby.dc.html`         | Osoby a členstvá – desktop, prepínač „Sportnet neodpovedá“ | upravené, čaká                        |
| `AdminPouzivatelia.dc.html`  | Používatelia – desktop                                     | nové, čaká                            |
| `AdminPrehlad.dc.html`       | Prehľad administrácie – desktop                            | nové, čaká                            |
| `AdminStavy.dc.html`         | Stavy všetkých obrazoviek + pravidlá pre mobil             | nové, čaká                            |
| `AdminObsah.dc.html`         | Obsah – len nové menu a záložka Knižnica                   | upravené, čaká                        |
| `AdminKniznica.dc.html`      | Knižnica oblasti                                           | schválené 30. 10. (ADR 0022 odložené) |

Mená, kluby a čísla na artboardoch sú ilustračné, okrem stavu zo 6. – 7. 11. (1 558 aktívnych klubov, 3 084
v Sportnete, prvý beh 6. 11.). `[počet]`, `[IČO]` a pod. doplní server.

## 2. Schválenie

Cyril schválil 7. 11. Kluby, Osoby a členstvá, Číselníky a Obsah **ako základ**. Po jeho kontrole doplnení zo 7. 11.
pribudne pri každom artboarde „schválené“ a riadok v tejto tabuľke. Server (API, služby, testy) a rám
administrácie môžu vznikať hneď.

## 3. Rozsah a poradie

Ján robí všetky obrazovky G5 vrátane **Prehľadu** a **Používateľov** (Cyril 7. 11.) a rám administrácie.
Poradie: **Sportnet → Kluby → Číselníky → Osoby a členstvá → Používatelia → Prehľad** (Prehľad posledný – len
sčíta ostatné). Obsah a Novinky ostávajú, ako sú; menia sa len v menu.

## 4. Obrazovky a dáta

### Sportnet – `/admin/sportnet`

- Server je hotový: `GET`/`POST /api/v1/admin/sportnet/sync` (ADR 0030).
- Karty stavu: `clubs.activeClubs`, `clubs.withoutDetails`, `clubs.oldestDetailsAt`. Počet klubov v Sportnete
  (3 084) je v `result.sportnetClubs` posledného úspešného behu – nové pole netreba.
- Ručný beh: krok 1 `POST { apply: false }` (skúšobný, nič nezapíše) → výsledok → **Modal** „Zapísať zmeny“ →
  krok 2 `POST { apply: true }` → Toast a nový riadok v histórii. Stav „beží“ je len v prehliadači toho, kto beh
  spustil (request trvá ~2 min, `maxDuration` 300 s); nočný beh, ktorý práve beží, server neukazuje.
- História: posledných 20 behov – spustil (`trigger`: Noc (cron) / Ručne), začiatok, trvanie, OK/Chyba, nové,
  zmenené, preskočené, podrobnosti, zlyhané, chyba. **Meno toho, kto spustil ručný beh, sa neukazuje** – API ho
  zámerne nevracia (ostáva v DB). Ak ho chceme zobraziť, rozhodne Cyril.
- Chyba Sportnetu: Alert „sportnet.online neodpovedá, nič sa nezapísalo“ + „Skúsiť znova“.

### Kluby – `/admin/kluby`

- Polia z `clubs` (`ClubDoc`): názov, logo, stav, zväz (`union`), región (`region`), IČO (`businessId`), právna
  forma (`legalForm`), názov PO (`legalName`), `sportnetDetailsAt`. Kontakty, e-maily ani telefóny sa neukladajú.
- Hľadanie (názov, IČO), filtre **Región** (BFZ, ZsFZ, SsFZ, VsFZ, _Bez regiónu_ – dnes 92 klubov: futsal, SFZ,
  plážový futbal, ÚLK, bez matričnej väzby), **Zväz**, **Stav**, **V aplikácii**; stránkovanie 25 na stranu.
- **Všetko na serveri**: nové `GET /api/v1/admin/clubs?q=&region=&union=&status=&inApp=&page=` (Zod, `apiHandler`).
  DataTable z DS filtruje a stránkuje len v prehliadači, na 1 558 klubov sa nehodí. Stav filtrov v URL.
  Nový index (ak bude treba) sa zakladá vedome a zapisuje do `ARCHITECTURE.md`; dotaz overiť cez `explain`.
- „V aplikácii“ = klub má aspoň jedno členstvo (`club_memberships`) alebo Kompas – **návrh, potvrdí Cyril**.
- Detail: desktop Drawer sprava, mobil celá stránka `/admin/kluby/[clubId]`. Časť „Zo sportnet.online“ len na
  čítanie, časť „V Akadémii“ (počet rolí, mentor, Kompas) s odkazom na Osoby.
- Import snapshotu JSON (`snapshot-form.tsx`, `/api/v1/admin/club-snapshot`) sa ruší – zmazanie súborov **len so
  súhlasom Cyrila**.

### Číselníky – `/admin/ciselniky`

- Len zobrazenie (needituje sa). Pri každom číselníku zdroj **Akadémia** alebo **sportnet.online**.
- Návrh zoznamu (8): roly v klube (Akadémia, s mapovaním), typy osôb, funkcie v klube, typy organizácií PO/PPO,
  zväzy, vekové kategórie (všetko sportnet.online), oblasti a línie, pásma Kompasu a licencií (Akadémia).
  Oproti analýze pribudli funkcie v klube, oblasti a línie a pásma – **úplnosť potvrdí Cyril pri schválení**.
- Mapovanie rolí (ADR 0021, 0024, 0027): klubový manažér = CRM `admin` / `matrikar` / `manager`; tímový manažér =
  odborná príslušnosť „Vedúci družstva“; hráč = hráčska príslušnosť; člen = iná aktívna odborná príslušnosť;
  tréner a mentor = Akadémia. Zo Sportnetu jedna, najsilnejšia rola na klub.

### Osoby a členstvá – `/admin/osoby`

- Najprv výber klubu, potom osoby klubu **živo zo Sportnetu** (verejné `GET /ppo/{appSpace}/users`, zadanie S1–S3, časť 8) +
  roly z `club_memberships`. Záložka Mentori (len Akadémia).
- Každá rola má zdroj: Badge **sportnet.online** (len na čítanie) alebo **Akadémia** (dá sa odobrať, cez Modal).
  „Pridať rolu v Akadémii“ – tréner (väzba tréner ↔ klub v Sportnete chýba, B1), voliteľne vekové kategórie.
- Sportnet neodpovedá: Alert + zoznam len z rolí uložených v Akadémii (artboard má prepínač `sportnetDown`).
- Globálne roly už nie sú záložkou – sú v Používateľoch.

### Používatelia – `/admin/pouzivatelia`

- Roly aplikácie: `admin_sfz` (Admin SFZ), `public` (Používateľ). Zmena cez Modal, existuje
  `PUT /api/v1/users/[id]/role`; vlastnú rolu admina si odobrať nedá (už v službe).
- **Chýba zoznam používateľov.** Kolekciu `user` spravuje Better Auth – čítať len cez jeho API / `internalAdapter`,
  nie priamo (CLAUDE.md, časť 7). Hľadanie a stránkovanie na serveri ako pri kluboch. E-maily v zápisoch maskovať.

### Prehľad – `/admin`

- Bez vlastných dát: „Čaká na vás“ (návrhy noviniek, kluby bez matričnej väzby – dnes 15, zlyhaný posledný beh)
  a dlaždice Sportnet, Kluby, Osoby, Obsah s odkazmi.

## 5. Stavy na každej obrazovke

Artboard `AdminStavy.dc.html`: načítavanie (Skeleton v tvare obsahu), prázdny stav (EmptyState + „Zrušiť
filtre“), chyba (Alert podľa `error.code`, texty cez next-intl; bez prístupu 403, nie text), dlhé zoznamy (server,
25 na stranu, stav v URL), potvrdenie pred zápisom (Modal, na mobile zdola) a Toast po úspechu, stav „beží“
(`Button loading`), legenda zdroja údajov. Mobil 375 px: tabuľky → karty, filtre ako čipy + Modal, tlačidlá
v Modale pod sebou, dotyk ≥ 44 px.

## 6. Rám administrácie

- Ostáva `src/app/admin/layout.tsx` (bočné menu, na mobile nad obsahom). Nové: **na mobile Drawer zľava**
  (tlačidlo menu v hlavičke), TabBar aplikácie ostáva s aktívnou položkou Viac.
- `adminMenu` v `src/lib/navigation.ts`, poradie: **Prehľad · Kluby · Osoby a členstvá · Číselníky · Obsah ·
  Novinky · Používatelia · Sportnet**. Knižnica a Katalóg rolí sú záložky v Obsahu (dnes je „Roly“ samostatná
  položka – presúva sa do Obsahu). Testy `navigation.test.ts` a `navigation-messages.test.ts` upraviť.
- Redesign (Cyril) do `src/app/admin/**`, `src/components/app-frame/admin-side-menu.tsx` ani `adminMenu`
  nezasahuje. Spoločné súbory (`messages/sk.json`, `NEXT.md`, `CHANGELOG.md`, devlog) – len vlastné riadky.

## 7. Chýbajúce komponenty

SFZ Design System 1.5.1 má Alert, Badge, Button (`loading`), Card, Chip, DataTable, Drawer, EmptyState, Input,
Modal, Select, Skeleton, Stepper, Table (`stackOnMobile`), Tabs, Toast. Zložiť v `src/components/sfz` z tokenov:

- **Stránkovanie na serveri** (počet „26 – 50 z 1 558“, predchádzajúca/ďalšia, odkazy s `?page=`) – DataTable má
  stránkovanie len v prehliadači.
- **Bočné menu administrácie s Drawer na mobile** (rozšírenie `AdminSideMenu`).
- Časová os behov netreba – behy sú tabuľka (desktop) a karty (mobil).

## 8. Na potvrdenie Cyrilom pri schválení

1. Definícia filtra „V aplikácii“.
2. Smie admin ručne pridať aj klubového manažéra (výnimka mimo Sportnetu), alebo len trénera?
3. Úplnosť zoznamu číselníkov (časť 4).
4. Zobrazovať meno pri ručnom behu synchronizácie (dnes nie, ADR 0030)?
5. Súhlas so zmazaním importu snapshotu po nasadení Klubov.
