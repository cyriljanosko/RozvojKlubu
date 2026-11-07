# Poznámky k návrhu G5 – administrácia (artboardy Admin\*)

Stav: pracovné poznámky na implementáciu S3 · Pripravil: Claude pre Jána Letka · 7. 11. 2026

## Zdroje a čo sa z nich podarilo prečítať

| Zdroj                                                                                                | Stav 7. 11.                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plátno „Rozvoj klubu – redesign“, riadok **Skupina 5** (`claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb`) | **Neprečítané.** Plátno patrí do inej organizácie claude.ai než účet, z ktorého sa čítalo. Treba ho zdieľať s účtom Jána alebo dodať export (Cyril). |
| `docs/sportnet/podklady-g5.md` (vetva `docs/g5-podklady`, PR #155)                                   | Prečítané celé. Všetko nižšie pochádza odtiaľto, ak nie je uvedené inak.                                                                             |

Pravidlo pre tento dokument: čo je len na plátne (presné rozloženie, poradie prvkov, doslovné texty, ikony), je
označené **„neviem – z plátna“**. Nič z toho sa nedopĺňa odhadom. Po sprístupnení plátna sa tieto miesta doplnia
a riadok vyššie sa zmení.

Podľa podkladov (časť 1–2) zároveň platí: kým pri obrazovke nie je „schválené“, server (API, služby, testy) a rám
administrácie sa robiť môžu, **obrazovka sa dokončí až po schválení** (CLAUDE.md, ADR 0018).

## Súhrn stavu schválenia

| Artboard                     | Obrazovka                                      | Stav podľa podkladov 7. 11.               |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `AdminSportnet.dc.html`      | Sportnet – desktop, interaktívny               | nové, čaká                                |
| `AdminMobilSportnet.dc.html` | Sportnet – mobil 375 px, menu v Drawer         | nové, čaká                                |
| `AdminKluby.dc.html`         | Kluby – desktop, detail v Drawer               | upravené, čaká (základ schválený 7. 11.)  |
| `AdminMobilKluby.dc.html`    | Kluby – mobil, karty a filtre v Modale         | nové, čaká                                |
| `AdminCiselniky.dc.html`     | Číselníky – desktop                            | upravené, čaká (základ schválený 7. 11.)  |
| `AdminOsoby.dc.html`         | Osoby a členstvá – desktop, prepínač Sportnetu | upravené, čaká (základ schválený 7. 11.)  |
| `AdminPouzivatelia.dc.html`  | Používatelia – desktop                         | nové, čaká                                |
| `AdminPrehlad.dc.html`       | Prehľad administrácie – desktop                | nové, čaká                                |
| `AdminStavy.dc.html`         | Stavy všetkých obrazoviek + pravidlá pre mobil | nové, čaká                                |
| `AdminObsah.dc.html`         | Obsah – nové menu a záložka Knižnica           | upravené, čaká (základ schválený 7. 11.)  |
| `AdminKniznica.dc.html`      | Knižnica oblasti                               | **schválené 30. 10.** (ADR 0022 odložené) |

„Základ schválený“ = Cyril 7. 11. schválil Kluby, Osoby a členstvá, Číselníky a Obsah ako základ; doplnenia zo 7. 11. čakajú na jeho kontrolu. Žiadny artboard G5 okrem Knižnice dnes nie je „schválené“ v plnom zmysle.

Poradie implementácie (Cyril 7. 11.): **Sportnet → Kluby → Číselníky → Osoby a členstvá → Používatelia →
Prehľad**. Obsah a Novinky sa menia len v menu.

Mená, kluby a čísla na artboardoch sú ilustračné, okrem stavu zo 6. – 7. 11. (1 558 aktívnych klubov, 3 084
v Sportnete, prvý beh 6. 11.). Zástupné `[počet]`, `[IČO]` a pod. dopĺňa server.

## Spoločné pre všetky artboardy

### Rám administrácie

- Ostáva `src/app/admin/layout.tsx`: bočné menu vľavo; dnes na mobile nad obsahom.
- Nové: **na mobile Drawer zľava**, otvára ho tlačidlo menu v hlavičke. TabBar aplikácie ostáva, aktívna položka
  **Viac**.
- Poradie položiek `adminMenu` (`src/lib/navigation.ts`): **Prehľad · Kluby · Osoby a členstvá · Číselníky ·
  Obsah · Novinky · Používatelia · Sportnet**. „Roly“ prestáva byť samostatnou položkou – Katalóg rolí a Knižnica
  sú záložky v Obsahu. Upraviť testy `navigation.test.ts` a `navigation-messages.test.ts`.
- Komponent: rozšírenie `AdminSideMenu` o Drawer na mobile – skladá sa v `src/components/sfz`.
- Ikona a text tlačidla menu v hlavičke: neviem – z plátna.

### Komponenty SFZ DS 1.5.1, ktoré G5 používa

Alert, Badge, Button (`loading`), Card, Chip, DataTable, Drawer, EmptyState, Input, Modal, Select, Skeleton,
Stepper, Table (`stackOnMobile`), Tabs, Toast.

Chýba a skladá sa v `src/components/sfz` z tokenov:

- **Stránkovanie na serveri** – text „26 – 50 z 1 558“, predchádzajúca/ďalšia, odkazy s `?page=`. DataTable
  stránkuje len v prehliadači, na 1 558 klubov sa nehodí.
- **Bočné menu s Drawer na mobile** (viď rám).
- Časová os behov sa nerobí – behy sú tabuľka (desktop) a karty (mobil).

### Stavy (artboard `AdminStavy.dc.html`, platí pre všetky obrazovky)

| Stav             | Riešenie                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| Načítavanie      | Skeleton v tvare obsahu                                                                 |
| Prázdny výsledok | EmptyState + tlačidlo „Zrušiť filtre“                                                   |
| Chyba            | Alert podľa `error.code`, texty cez next-intl                                           |
| Bez prístupu     | HTTP 403 (stránka), nie text v obsahu                                                   |
| Dlhé zoznamy     | Stránkovanie na serveri, 25 na stranu, stav filtrov a strany v URL                      |
| Pred zápisom     | Modal s potvrdením; na mobile sa vysúva zdola                                           |
| Po úspechu       | Toast                                                                                   |
| Prebieha akcia   | `Button loading`                                                                        |
| Zdroj údajov     | Legenda zdroja: Badge **sportnet.online** (len na čítanie) / **Akadémia** (upraviteľné) |

### Mobil 375 px (pravidlá z `AdminStavy`)

- Tabuľky → karty (Table `stackOnMobile` alebo vlastné karty).
- Filtre → čipy (Chip) + Modal s filtrami.
- Tlačidlá v Modale pod sebou.
- Dotykové ciele ≥ 44 px.
- Menu administrácie v Drawer zľava, TabBar s aktívnou „Viac“.

### Texty

Všetky texty idú cez next-intl (`messages/sk.json`). Doslovné texty zo samotných artboardov (nadpisy, popisy,
štítky stĺpcov, tlačidlá, texty prázdnych stavov) sú **neviem – z plátna**. Nižšie sú uvedené len texty, ktoré
podklady citujú doslova (v úvodzovkách).

---

## AdminSportnet.dc.html – Sportnet, desktop (`/admin/sportnet`)

- **Stav:** nové, čaká na schválenie. Prvé v poradí implementácie.
- **Server:** hotový – `GET`/`POST /api/v1/admin/sportnet/sync` (ADR 0030).
- **Rozloženie:** karty stavu → ručný beh → história behov. Presné usporiadanie (mriežka, šírky, poradie) – neviem
  – z plátna.
- **Karty stavu (Card):**
  - aktívne kluby – `clubs.activeClubs`,
  - kluby bez podrobností – `clubs.withoutDetails`,
  - najstaršie podrobnosti – `clubs.oldestDetailsAt`,
  - kluby v Sportnete – `result.sportnetClubs` z posledného úspešného behu (dnes 3 084; nové pole netreba).
  - Nadpisy kariet: neviem – z plátna.
- **Ručný beh (dvojkrokový):**
  1. `POST { apply: false }` – skúšobný beh, nič nezapíše; Button v stave `loading` (request ~2 min,
     `maxDuration` 300 s).
  2. Zobrazí sa výsledok skúšobného behu.
  3. **Modal „Zapísať zmeny“** → `POST { apply: true }`.
  4. **Toast** a nový riadok v histórii.
  - Stav „beží“ existuje len v prehliadači toho, kto beh spustil. Nočný beh, ktorý práve beží, server neukazuje –
    UI ho nesmie predstierať.
  - Text tlačidla skúšobného behu a obsah výsledku: neviem – z plátna.
- **História (Table/DataTable):** posledných 20 behov, stĺpce: spustil (`trigger`: „Noc (cron)“ / „Ručne“),
  začiatok, trvanie, OK/Chyba (Badge), nové, zmenené, preskočené, podrobnosti, zlyhané, chyba.
  - **Meno toho, kto spustil ručný beh, sa neukazuje** – API ho zámerne nevracia (ADR 0030). Otvorená otázka č. 4.
- **Chyba Sportnetu:** Alert „sportnet.online neodpovedá, nič sa nezapísalo“ + tlačidlo „Skúsiť znova“.
- **Interaktivita artboardu:** artboard je interaktívny; ktoré stavy sa na ňom prepínajú – neviem – z plátna.

## AdminMobilSportnet.dc.html – Sportnet, mobil 375 px

- **Stav:** nové, čaká na schválenie.
- **Rozloženie:** menu administrácie v **Drawer zľava** (tlačidlo v hlavičke), TabBar s aktívnou „Viac“.
- **Karty stavu:** pod sebou alebo v mriežke – neviem – z plátna.
- **História behov:** karty namiesto tabuľky; ktoré polia sú na karte viditeľné hneď a ktoré v rozbalení – neviem –
  z plátna.
- **Modal „Zapísať zmeny“:** vysúva sa zdola, tlačidlá pod sebou, ≥ 44 px.
- **Texty:** rovnaké kľúče ako desktop; mobilné skratky (ak sú) – neviem – z plátna.

## AdminKluby.dc.html – Kluby, desktop (`/admin/kluby`)

- **Stav:** upravené, čaká; základ schválený 7. 11.
- **Server (nový):** `GET /api/v1/admin/clubs?q=&region=&union=&status=&inApp=&page=` – Zod, `apiHandler`,
  filtrovanie a stránkovanie na serveri, stav filtrov v URL. Nový index len vedome, zapísať do `ARCHITECTURE.md`,
  dotaz overiť cez `explain`.
- **Rozloženie:** hľadanie + filtre nad tabuľkou, tabuľka klubov, stránkovanie pod ňou, detail v **Drawer sprava**.
  Presné umiestnenie prvkov – neviem – z plátna.
- **Komponenty:** Input (hľadanie), Select alebo Chip (filtre – ktorý z nich, neviem – z plátna), Table, Badge
  (stav), vlastné stránkovanie, Drawer, EmptyState, Skeleton.
- **Hľadanie:** názov, IČO.
- **Filtre:**
  - **Región:** BFZ, ZsFZ, SsFZ, VsFZ, _Bez regiónu_ (dnes 92 klubov: futsal, SFZ, plážový futbal, ÚLK, bez
    matričnej väzby),
  - **Zväz**, **Stav**, **V aplikácii**.
  - „V aplikácii“ = klub má aspoň jedno členstvo (`club_memberships`) alebo Kompas – **návrh, potvrdí Cyril**
    (otvorená otázka č. 1).
- **Stránkovanie:** 25 na stranu, „26 – 50 z 1 558“.
- **Polia klubu (`ClubDoc`):** názov, logo, stav, zväz (`union`), región (`region`), IČO (`businessId`), právna
  forma (`legalForm`), názov PO (`legalName`), `sportnetDetailsAt`. Kontakty, e-maily ani telefóny sa neukladajú
  ani nezobrazujú. Ktoré z nich sú stĺpce tabuľky – neviem – z plátna.
- **Detail (Drawer):**
  - časť „Zo sportnet.online“ – len na čítanie,
  - časť „V Akadémii“ – počet rolí, mentor, Kompas, odkaz na Osoby a členstvá.
- **Ruší sa:** import snapshotu JSON (`snapshot-form.tsx`, `/api/v1/admin/club-snapshot`). Súbory sa mažú **len so
  súhlasom Cyrila** (otvorená otázka č. 5).

## AdminMobilKluby.dc.html – Kluby, mobil 375 px

- **Stav:** nové, čaká na schválenie.
- **Rozloženie:** zoznam klubov ako **karty**; filtre ako **čipy** nad zoznamom, plný výber filtrov v **Modale**
  (zdola, tlačidlá pod sebou).
- **Detail:** nie Drawer, ale **celá stránka `/admin/kluby/[clubId]`** s rovnakými časťami ako desktopový Drawer.
- **Stránkovanie:** rovnaké ako desktop (server, `?page=`); podoba na mobile – neviem – z plátna.
- **Obsah karty klubu** (logo, názov, región, stav…) a texty Modalu filtrov: neviem – z plátna.

## AdminCiselniky.dc.html – Číselníky, desktop (`/admin/ciselniky`)

- **Stav:** upravené, čaká; základ schválený 7. 11.
- **Správanie:** len zobrazenie, nič sa needituje.
- **Zdroj:** pri každom číselníku Badge **Akadémia** alebo **sportnet.online**.
- **Zoznam (návrh, 8):**

  | Číselník                   | Zdroj           |
  | -------------------------- | --------------- |
  | Roly v klube (s mapovaním) | Akadémia        |
  | Typy osôb                  | sportnet.online |
  | Funkcie v klube            | sportnet.online |
  | Typy organizácií PO/PPO    | sportnet.online |
  | Zväzy                      | sportnet.online |
  | Vekové kategórie           | sportnet.online |
  | Oblasti a línie            | Akadémia        |
  | Pásma Kompasu a licencií   | Akadémia        |

  Funkcie v klube, oblasti a línie a pásma pribudli oproti analýze – **úplnosť potvrdí Cyril** (otázka č. 3).

- **Mapovanie rolí** (ADR 0021, 0024, 0027): klubový manažér = CRM `admin` / `matrikar` / `manager`; tímový manažér
  = odborná príslušnosť „Vedúci družstva“; hráč = hráčska príslušnosť; člen = iná aktívna odborná príslušnosť;
  tréner a mentor = Akadémia. Zo Sportnetu jedna, najsilnejšia rola na klub.
- **Rozloženie** (zoznam číselníkov vľavo a detail vpravo, Tabs, alebo Card pod sebou) a podoba tabuľky mapovania:
  neviem – z plátna.
- **Mobil:** samostatný artboard nie je; platia všeobecné pravidlá (tabuľky → karty).

## AdminOsoby.dc.html – Osoby a členstvá, desktop (`/admin/osoby`)

- **Stav:** upravené, čaká; základ schválený 7. 11.
- **Tok:** najprv **výber klubu**, potom osoby klubu **živo zo Sportnetu** (verejné `GET /ppo/{appSpace}/users`,
  zadanie S1–S3, časť 8) + roly z `club_memberships`.
- **Tabs:** osoby klubu / **Mentori** (len Akadémia). Globálne roly už nie sú záložkou – sú v Používateľoch.
- **Roly osoby:** každá s Badge zdroja – **sportnet.online** (len na čítanie) alebo **Akadémia** (dá sa odobrať cez
  Modal s potvrdením, potom Toast).
- **Akcia „Pridať rolu v Akadémii“:** tréner (väzba tréner ↔ klub v Sportnete chýba, B1), voliteľne vekové
  kategórie. Či smie admin pridať aj klubového manažéra – otvorená otázka č. 2.
- **Sportnet neodpovedá:** Alert + zoznam len z rolí uložených v Akadémii. Artboard má prepínač `sportnetDown` na
  ukážku oboch stavov.
- **Rozloženie** (výber klubu – Select/hľadanie, tabuľka osôb, formulár pridania rolí – Modal alebo Drawer) a texty:
  neviem – z plátna.
- **Mobil:** samostatný artboard nie je; platia všeobecné pravidlá.

## AdminPouzivatelia.dc.html – Používatelia, desktop (`/admin/pouzivatelia`)

- **Stav:** nové, čaká na schválenie.
- **Roly aplikácie:** `admin_sfz` („Admin SFZ“), `public` („Používateľ“).
- **Zmena roly:** cez Modal; existuje `PUT /api/v1/users/[id]/role`. Vlastnú rolu admina si odobrať nedá (už
  v službe) – v UI zodpovedajúca akcia neaktívna/skrytá; podoba – neviem – z plátna.
- **Chýba zoznam používateľov (server).** Kolekciu `user` spravuje Better Auth – čítať len cez jeho API /
  `internalAdapter`. Hľadanie a stránkovanie na serveri ako pri Kluboch (25 na stranu, stav v URL).
- **Súkromie:** e-maily v zápisoch (devlog, PR) maskovať.
- **Rozloženie a stĺpce:** neviem – z plátna.
- **Mobil:** samostatný artboard nie je; platia všeobecné pravidlá.

## AdminPrehlad.dc.html – Prehľad administrácie, desktop (`/admin`)

- **Stav:** nové, čaká na schválenie. Posledné v poradí – len sčíta ostatné.
- **Bez vlastných dát.**
- **„Čaká na vás“:** návrhy noviniek, kluby bez matričnej väzby (dnes 15), zlyhaný posledný beh synchronizácie.
- **Dlaždice (Card) s odkazmi:** Sportnet, Kluby, Osoby, Obsah.
- **Rozloženie, čísla na dlaždiciach a texty:** neviem – z plátna.
- **Mobil:** samostatný artboard nie je; platia všeobecné pravidlá.

## AdminStavy.dc.html – Stavy a pravidlá pre mobil

- **Stav:** nové, čaká na schválenie.
- Obsah je zhrnutý vyššie v častiach „Stavy“ a „Mobil 375 px“. Pre ktoré obrazovky artboard ukazuje konkrétne
  príklady a ich texty: neviem – z plátna.

## AdminObsah.dc.html – Obsah (len menu a záložka Knižnica)

- **Stav:** upravené, čaká; základ schválený 7. 11.
- **Rozsah zmeny:** nové poradie menu (viď rám) a záložky v Obsahu – **Knižnica** a **Katalóg rolí** (doteraz
  samostatná položka „Roly“). Obsah samotných obrazoviek Obsahu a Noviniek sa nemení.
- **Ďalšie záložky a ich poradie:** neviem – z plátna.

## AdminKniznica.dc.html – Knižnica oblasti

- **Stav:** **schválené 30. 10.**; ADR 0022 odložené.
- Do rozsahu G5 patrí len ako záložka v Obsahu. Detaily artboardu: neviem – z plátna.

---

## Otvorené otázky na Cyrila (z podkladov, časť 8)

1. Definícia filtra „V aplikácii“.
2. Smie admin ručne pridať aj klubového manažéra (výnimka mimo Sportnetu), alebo len trénera?
3. Úplnosť zoznamu číselníkov.
4. Zobrazovať meno pri ručnom behu synchronizácie (dnes nie, ADR 0030)?
5. Súhlas so zmazaním importu snapshotu po nasadení Klubov.

## Hranice práce (podklady, časť 6)

Redesign (Cyril) do `src/app/admin/**`, `src/components/app-frame/admin-side-menu.tsx` ani `adminMenu`
nezasahuje. V spoločných súboroch (`messages/sk.json`, `NEXT.md`, `CHANGELOG.md`, devlog) len vlastné riadky.

## Čo doplniť po sprístupnení plátna

Pri každom artboarde nahradiť „neviem – z plátna“: presné rozloženie (mriežka, poradie, šírky), doslovné texty
(nadpisy, štítky, tlačidlá, prázdne stavy, chyby), stĺpce tabuliek a obsah kariet, interaktívne stavy artboardu
a prípadné nové označenie „schválené“.
