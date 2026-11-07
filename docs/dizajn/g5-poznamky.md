# Poznámky k návrhu G5 – administrácia (artboardy Admin\*)

Stav: pracovné poznámky na implementáciu S3 · Pripravil: Claude pre Jána Letka · 7. 11. 2026

## Zdroje

| Zdroj                                                                    | Čo z neho je                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| HTML export plátna „Rozvoj klubu – redesign“ (Cyril, 7. 11. 2026 14:52)  | Zdrojový kód všetkých artboardov G5: rozloženie, komponenty, doslovné texty, interaktívne stavy. **Hlavný zdroj tohto dokumentu.** |
| Plátno `claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb`, riadok **Skupina 5** | Názvy artboardov a štítky stavu nad nimi (prezreté v prehliadači 7. 11.).                                                          |
| `docs/sportnet/podklady-g5.md` (vetva `docs/g5-podklady`, PR #155)       | Dáta, API, poradie prác, otvorené otázky.                                                                                          |

Nadpis riadka na plátne: **„Skupina 5 – administrácia SFZ · doplnené 7. 11. (Sportnet, prehľad, používatelia, mobil,
stavy) · čaká na schválenie Cyrila · robí S3 (Ján)“**.

Všetky mená, kluby a čísla na artboardoch sú ilustračné, okrem stavu zo 6. – 7. 11. (1 558 aktívnych klubov, 3 084
v Sportnete, beh zo 6. 11.). Zástupné `[počet]`, `[IČO]`, `[e-mail]`, `[dátum]`, `[meno mentora]`, `[stav]` dopĺňa server.
Texty nižšie sú doslovné z exportu; v implementácii idú do `messages/sk.json` (next-intl).

## Súhrn: stav schválenia

| Artboard (súbor)             | Štítok na plátne                                             | Stav podľa podkladov 7. 11.               |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `AdminSportnet.dc.html`      | Administrácia – Sportnet · desktop · nové 7. 11.             | nové, čaká                                |
| `AdminMobilSportnet.dc.html` | Administrácia – Sportnet (mobil)                             | nové, čaká                                |
| `AdminKluby.dc.html`         | Administrácia – kluby · desktop · upravené 7. 11.            | upravené, čaká (základ schválený 7. 11.)  |
| `AdminMobilKluby.dc.html`    | Administrácia – kluby (mobil)                                | nové, čaká                                |
| `AdminCiselniky.dc.html`     | Administrácia – číselníky · desktop · upravené 7. 11.        | upravené, čaká (základ schválený 7. 11.)  |
| `AdminOsoby.dc.html`         | Administrácia – osoby a členstvá · desktop · upravené 7. 11. | upravené, čaká (základ schválený 7. 11.)  |
| `AdminPouzivatelia.dc.html`  | Administrácia – používatelia · desktop · nové 7. 11.         | nové, čaká                                |
| `AdminPrehlad.dc.html`       | Administrácia – prehľad · desktop · nové 7. 11.              | nové, čaká                                |
| `AdminStavy.dc.html`         | Administrácia – stavy obrazoviek · nové 7. 11.               | nové, čaká                                |
| `AdminObsah.dc.html`         | Administrácia – obsah (otázky Kompasu) · desktop             | upravené, čaká (základ schválený 7. 11.)  |
| `AdminKniznica.dc.html`      | Administrácia – knižnica oblasti · desktop · schválené       | **schválené 30. 10.** (ADR 0022 odložené) |

Okrem Knižnice dnes nie je žiadny artboard G5 „schválené“. Server (API, služby, testy) a rám sa robiť môžu hneď,
obrazovka sa dokončí až po schválení (CLAUDE.md, ADR 0018).

Poradie implementácie (Cyril 7. 11.): **Sportnet → Kluby → Číselníky → Osoby a členstvá → Používatelia → Prehľad**.
Obsah a Novinky sa menia len v menu.

Mimo rozsahu: na plátne je aj `AdminNovinky.dc.html` (Administrácia – Novinky, desktop), ale patrí do riadka Noviniek,
nie do Skupiny 5.

## Spoločné pre všetky artboardy

### Rám – desktop (šírka náhľadu 1280 px)

- Hlavička: `sfz-navbar sfz-navbar--light`, logo „Slovenský futbalový zväz“ (výška 36 px), odkazy **Domov · Kluby ·
  Analýza · Administrácia** (aktívna), vpravo Avatar „Admin SFZ“ ako odkaz „Môj účet“ (min. 44 × 44 px).
  Knižnica má ešte staršiu hlavičku: **Domov · Oblasti · Analýza · Administrácia**.
- Obsah: max. šírka 1200 px, padding 24 px, flex s `wrap`, medzera 24 px.
- Bočné menu `<nav aria-label="Menu administrácie">`: šírka 220 – 260 px, podklad `--surface-raised`, `--radius-md`.
  Položka: ikona 18 px + text 15 px, výška min. 44 px. Aktívna má `aria-current="page"`, podklad `--brand-blue-tint`,
  farbu `--brand-blue-ink` a hrúbku 600.
- Položky a ikony (Icon):

  | Položka          | Ikona           |
  | ---------------- | --------------- |
  | Prehľad          | `home`          |
  | Kluby            | `trophy`        |
  | Osoby a členstvá | `users`         |
  | Číselníky        | `file-text`     |
  | Obsah            | `edit`          |
  | Novinky          | `bell`          |
  | Používatelia     | `user`          |
  | Sportnet         | `arrow-up-down` |

- `<main>`: flex stĺpec, medzera 16 px (Prehľad 24 px). Nadpis `h1.title-1`, pod ním `p.callout` v `--ink-muted`.
- Poznámka pod obsahom: `p.footnote` v `--ink-muted`. Texty, ktoré len opisujú návrh („Mená sú ilustračné“),
  sa do aplikácie neprenášajú.

### Rám – mobil (náhľad 390 px; overiť na 375 px)

- Hlavička: IconButton `menu` („Menu administrácie“, variant `tertiary`) · text „Administrácia“ (`headline`) ·
  Avatar „Môj účet“ (44 × 44 px). Spodná čiara `--hairline`.
- Menu: **Drawer zľava**, názov „Administrácia“, rovnaké položky ako desktop; položka min. 48 px, text 17 px,
  ikona 20 px.
- Dole TabBar aplikácie: **Domov · Môj klub · Oblasti · Kompas · Viac**, aktívna **Viac** (`value="more"`).
  Obsah má spodný padding 88 px, aby ho TabBar neprekryl.
- Nadpis `h1.large-title`, `main` s paddingom 16 px.

### Komponenty SFZ DS

Artboardy používajú: Alert, Avatar, Badge, Button, Card, Checkbox, Chip, Drawer, EmptyState, Icon, IconButton,
Input, Modal, Select, Skeleton, Stepper, TabBar, Table, Tabs, Textarea, Toast. Overené 7. 11.: všetky sú v
`@slovensky-futbalovy-zvaz/design-system` 1.5.1. Použité vlastnosti (`sheetOnMobile`, `orientation`,
`stackOnMobile`, `hideOnMobile`, `onRemove`, `side`, `width`, `loading`, `block`, `flush`, `action`, `dot`)
sú v typoch balíka.

Poznámky k implementácii:

- Tabuľky Kluby, Sportnet, Osoby, Používatelia a Knižnica sú v artboardoch **ručné HTML tabuľky**
  (`sc-raw-table`) v Card `flush`, nie DataTable. Dôvod: stránkovanie a filtre robí server. Na mobile treba karty
  (Kluby a Sportnet ich majú nakreslené), pri ostatných Table `stackOnMobile` alebo karty.
- DS Table (`stack-on-mobile`) je použitý len v Číselníkoch (mapovanie rolí) a v záložke Mentori.
- **Chýba v DS, zložiť v `src/components/sfz`:** stránkovanie na serveri (Stavy, bod 4) a bočné menu s Drawerom na
  mobile.

### Stavy (artboard `AdminStavy.dc.html`, platí pre všetky obrazovky)

Nadpis „Stavy obrazoviek administrácie“, popis „Platia pre Kluby, Osoby a členstvá, Číselníky, Používateľov aj
Sportnet. Každá obrazovka ich má mať všetky.“ Šesť kariet (Card):

1. **Načítavanie** – „Skeleton v tvare obsahu, nie točiace sa koliesko. Hlavička a filtre ostávajú použiteľné.“
   Ukážka: 4 riadky = Skeleton `circle` 32 px + Skeleton `text` na 2 riadky; `aria-busy="true"`.
2. **Prázdny stav** – EmptyState `search` „Žiadny klub nevyhovuje filtrom“ / „Skúste iný názov alebo zrušte
   niektorý filter.“ + Button `secondary sm` „Zrušiť filtre“. EmptyState `inbox` „Synchronizácia ešte nebežala“ /
   „Prvý nočný beh prebehne o 3:00, alebo ju spustite ručne.“
3. **Chyba** – Alert `warning` „sportnet.online teraz neodpovedá“ / „Údaje uložené v Akadémii vidíte, osoby zo
   sportnet.online teraz nie.“ Alert `danger` „Zmenu sa nepodarilo uložiť“ / „Skúste to znova. Ak chyba trvá,
   napíšte správcovi aplikácie.“ Button `secondary sm` „Skúsiť znova“. Pravidlo: „Text podľa error.code z API (UI
   prekladá cez next-intl), nikdy technická správa servera. Bez prístupu: stránka 403, nie text ‚bez prístupu‘.“
4. **Dlhé zoznamy** – „Kluby (1 558) a používatelia: hľadanie, filtre a stránkovanie na serveri, 25 na stranu, stav
   v URL (?q=&region=&page=). Číselníky a behy (najviac 20): celé naraz.“ Ukážka stránkovania: „26 – 50 z 1 558“ ·
   IconButton `chevron-left` „Predchádzajúca strana“ · „2 / 63“ (`aria-current="page"`) · IconButton
   `chevron-right` „Ďalšia strana“. Badge `warning` „Chýba v DS: stránkovanie na serveri – zložiť v
   src/components/sfz“.
5. **Potvrdenie pred zápisom** – „Každý zápis, ktorý mení dáta iných (synchronizácia, odobratie roly, zmena roly
   v aplikácii), ide cez Modal. Na mobile sa vysunie zdola. Po úspechu Toast.“ Ukážka: Modal `sm` „Odobrať rolu?“ /
   „Ján Tréner stratí rolu Tréner v klube Klub A.“ / „Zrušiť“ (`secondary`) + „Odobrať“ (`danger`) → Toast `success`
   „Rola odobratá.“
6. **Beží a zdroj údajov** – `role="status"`: ikona `loader` + „Zápis beží… približne 2 minúty“, Button `primary`
   `loading` „Zapisuje sa“. Legenda: Badge `neutral` „sportnet.online“ + „len na čítanie“, Badge `brand` „Akadémia“ +
   „dá sa upraviť“.

Karta **Mobil (375 px)** (Card `outline`):

- „Bočné menu administrácie sa mení na Drawer zľava (tlačidlo menu v hlavičke). TabBar aplikácie ostáva, aktívna je
  položka Viac.“
- „Tabuľky sa menia na karty (Table stackOnMobile alebo zoznam kariet ako v Kluboch), stĺpce s menšou váhou sa
  skryjú.“
- „Filtre sú čipy nad zoznamom, plný výber v Modale zdola. Detail klubu na celú obrazovku namiesto Drawer sprava.“
- „Dotykové plochy aspoň 44 px, tlačidlá v Modale pod sebou.“

---

## AdminSportnet.dc.html – Sportnet, desktop (`/admin/sportnet`)

- **Stav:** nové 7. 11., čaká na schválenie. Prvé v poradí.
- **Server:** hotový – `GET`/`POST /api/v1/admin/sportnet/sync` (ADR 0030). Počet klubov v Sportnete je
  `result.sportnetClubs` posledného úspešného behu.
- **Prepínač artboardu (Tweaks):** `sportnetDown` (boolean) – po skúšobnom behu ukáže chybový stav namiesto výsledku.

**Rozloženie (zhora):**

1. `h1` „Sportnet“ + callout „Kluby sa preberajú zo sportnet.online každú noc o 3:00. Tu vidíte stav a môžete
   synchronizáciu spustiť ručne.“
2. Tri Card v mriežke `auto-fit, minmax(200px, 1fr)` (`aria-label="Stav klubov"`):
   - „Aktívne kluby v aplikácii“ · **1 558** · „sportnet.online eviduje 3 084 klubov“
   - „Bez podrobností“ · **0** · Badge `success` s bodkou „Všetky kluby majú zväz a IČO“
   - „Najstaršie podrobnosti“ · **6. 11. 2026** · „obnovuje sa 600 klubov za noc“
   - Čísla `title-1`, `tabular-nums`; popisy `footnote` `--ink-muted`.
3. Card **„Ručná synchronizácia“** – Badge stavu, Stepper (3 kroky), obsah podľa fázy (nižšie).
4. Card **„Posledné behy“** (`flush`), caption „Posledných 20 zapisujúcich behov“, tabuľka s vodorovným posunom.
   Stĺpce: Začiatok · Spustil · Trvanie · Výsledok · Nové · Zmenené · Preskočené · Podrobnosti · Zlyhané · Chyba.
   Číselné stĺpce zarovnané doprava. Výsledok je Badge s bodkou: `success` „OK“, `danger` „Chyba“. Chyba je
   `footnote` `--ink-muted`, bez chyby „–“.
5. Poznámka: „Ukazuje sa 20 posledných behov, ktoré zapisovali (nočný aj ručný). Skúšobný beh sa do histórie
   neukladá.“

Stepper: „Skúšobný beh“ / „iba číta sportnet.online“ · „Kontrola“ / „čo by sa zmenilo“ · „Zápis“ / „uloží sa do
histórie“.

**Fázy karty Ručná synchronizácia** (stav prototypu `phase`):

| Fáza       | Badge (tón · text)         | Krok       | Obsah                                                                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`     | neutral · „Pripravené“     | 1          | „Skúšobný beh iba prečíta sportnet.online a ukáže, čo by sa zmenilo. Nič nezapíše.“ + Button `primary`, ikona `search`, „Spustiť skúšobný beh“                                                                                                                                                                                                |
| `dry`      | info · „Beží skúšobný beh“ | 1          | `role="status" aria-live="polite"`: ikona `loader` + „Skúšobný beh beží…“, callout „Trvá to približne 2 minúty. Nezatvárajte stránku, inak výsledok neuvidíte (beh na serveri dobehne).“, Skeleton 3 riadky. (Tlačidlo „Ukážka: beh skončil“ je len pre prototyp.)                                                                            |
| `dryDone`  | brand · „Čaká na zápis“    | 2          | Alert `info` „Skúšobný beh hotový za 1 min 58 s“ / „Takto by sa zmenili údaje. Zatiaľ sa nič nezapísalo.“ Šesť počtov (`dl`, mriežka 140 px): „Kluby v sportnet.online“ 3 084 · „Nové“ 2 · „Zmenené“ 14 · „Preskočené (neaktívne)“ 1 526 · „Podrobnosti prečítané“ 600 · „Zlyhané“ 0. Button `primary` „Zapísať zmeny“ + `secondary` „Zrušiť“ |
| `error`    | danger · „Chyba“           | 1          | Alert `danger` „sportnet.online neodpovedá“ / „Nič sa nezapísalo. Údaje v aplikácii ostávajú z poslednej úspešnej synchronizácie. Skúste to znova o chvíľu.“ + Button `secondary sm` „Skúsiť znova“ (spustí znova skúšobný beh)                                                                                                               |
| `applying` | info · „Beží zápis“        | 3          | Rovnako ako `dry`, nadpis „Zápis beží…“                                                                                                                                                                                                                                                                                                       |
| `done`     | success · „Hotovo“         | 3 (hotový) | Alert `success` „Zmeny sú zapísané“ / „Beh sa uložil do histórie nižšie.“ + Button `secondary sm` „Nový skúšobný beh“; v histórii pribudne riadok navrchu                                                                                                                                                                                     |

- **Modal** (`sm`) po „Zapísať zmeny“: názov „Zapísať zmeny zo sportnet.online?“, text „Zapíše sa 2 nových a 14
  zmenených klubov a podrobnosti 600 klubov. Údaje sa medzičasom môžu v sportnet.online zmeniť – zapíše sa ich
  aktuálny stav.“, footnote „Zápis trvá približne 2 minúty a uloží sa do histórie behov.“, tlačidlá vpravo
  „Zrušiť“ (`secondary`) a „Zapísať“ (`primary`) → fáza `applying`.
- **Toast** po zápise (`success`): „Synchronizácia zapísaná: 2 nové, 14 zmenených, 0 zlyhaných.“
- Čísla v Modale a Toaste dopĺňa výsledok skúšobného, resp. ostrého behu.
- **Meno toho, kto spustil ručný beh, sa neukazuje** – stĺpec „Spustil“ má len „Noc (cron)“ / „Ručne“ (ADR 0030,
  otvorená otázka č. 4).
- Stav „beží“ existuje len v prehliadači toho, kto beh spustil. Nočný beh, ktorý práve beží, UI neukazuje.

## AdminMobilSportnet.dc.html – Sportnet, mobil

- **Stav:** nové 7. 11., čaká. Interaktívne je len menu (Drawer); skúšobný beh na mobile nie je nakreslený
  krok za krokom – fázy, Modal a Toast sú rovnaké ako na desktope, Modal sa vysunie zdola.
- **Rozloženie:** mobilný rám (Drawer zľava, TabBar „Viac“).
  1. `h1.large-title` „Sportnet“ + callout „Kluby sa preberajú každú noc o 3:00.“ (kratšie ako desktop).
  2. `dl` v mriežke 2 stĺpce: „Aktívne kluby“ **1 558** · „Bez podrobností“ **0** · cez celú šírku „Najstaršie
     podrobnosti“ „6. 11. 2026 · 600 klubov za noc“. Bloky s podkladom `--surface-raised`, nie Card.
  3. Card „Ručná synchronizácia“: Stepper **vertikálny** – „Skúšobný beh“ / „iba číta sportnet.online“ · „Kontrola“ /
     „čo by sa zmenilo“ · „Zápis“ / **„potvrdenie v okne zdola“**. Callout „Skúšobný beh iba prečíta
     sportnet.online. Zápis potvrdíte až po kontrole.“ Button `primary` `block`, ikona `search`, „Spustiť skúšobný
     beh“.
  4. `h2.title-3` „Posledné behy“ – **karty** namiesto tabuľky. Karta: začiatok (`headline`) + Badge OK/Chyba ·
     „{spustil} · {trvanie}“ (`footnote`) · počty „nové 0 · zmenené 3 · podrobnosti 600 · zlyhané 0“
     (`subheadline`) · pri chybe text chyby v `--danger-ink`. Chybný beh namiesto počtov: „nič sa nezapísalo“.
     Na mobile sa skrýva stĺpec Preskočené.

## AdminKluby.dc.html – Kluby, desktop (`/admin/kluby`)

- **Stav:** upravené 7. 11., čaká; základ schválený 7. 11.
- **Server (nový):** `GET /api/v1/admin/clubs?q=&region=&union=&status=&inApp=&page=` – Zod, `apiHandler`, 25 na
  stranu, stav filtrov v URL. Nový index len vedome (`ARCHITECTURE.md`), dotaz overiť cez `explain`.

**Rozloženie:**

1. Hlavička stránky: `h1` „Kluby“ + callout „1 558 aktívnych klubov zo sportnet.online · obnovené 7. 11. 2026 3:00“;
   vpravo odkaz s ikonou `arrow-up-down` „Synchronizácia“ (na `/admin/sportnet`, výška 44 px).
2. Rad filtrov (flex `wrap`, zarovnané na spodok):
   - Input „Hľadať“, placeholder „Názov klubu alebo IČO“ (najširší, `flex 2 1 260px`)
   - Select „Región“: Všetky · BFZ · ZsFZ · SsFZ · VsFZ (predvolené Všetky)
   - Select „Zväz“: Všetky · ObFZ Trnava · ObFZ Nitra · „… ďalšie zväzy regiónu“ (predvolené Všetky)
   - Select „Stav“: Aktívny · Neaktívny · Vylúčený (predvolené **Aktívny**)
   - Select „V aplikácii“: Všetky · Áno · Nie (predvolené Všetky)
3. Card `flush`, caption „Kluby – zoradené podľa názvu“. Stĺpce: **Klub · Zväz · Región · IČO · Stav · V aplikácii**.
   - Klub: tlačidlo cez celú bunku (min. 44 px) s Avatarom (`sm`, iniciály) a dvomi riadkami – názov
     (`subheadline` 600, `--brand-blue-ink`) a názov PO (`footnote`, napr. „Klub A, o. z.“). Klik otvorí detail.
   - IČO `tabular-nums`; Stav Badge `success` s bodkou „Aktívny“; V aplikácii Badge `brand` „Áno“ / `neutral` „Nie“.
4. Stránkovanie v päte karty (`<nav aria-label="Stránkovanie">`): „1 – 25 z 1 558“ · IconButton „Predchádzajúca
   strana“ (na 1. strane `disabled`) · „1 / 63“ · IconButton „Ďalšia strana“.
5. Poznámka: „Hľadanie, filtre a stránkovanie robí server (25 klubov na stranu, filtre v URL). ‚V aplikácii‘ = klub má
   aspoň jedno členstvo alebo Kompas v Akadémii.“

**Detail – Drawer sprava** (šírka 420 px, názov = názov klubu):

- Sekcia „Zo sportnet.online“ + Badge `neutral` „len na čítanie“; `dl` (2 : 3): Klub (PPO) · Právnická osoba ·
  Právna forma (napr. „Občianske združenie“, „Akciová spoločnosť“, „Obec“) · IČO · Zväz · Región · Stav ·
  Podrobnosti z („6. 11. 2026“ = `sportnetDetailsAt`).
- Sekcia „V Akadémii“ + Badge `brand` „Akadémia“: Roly v klube „[počet] osôb“ · Mentor „[meno mentora]“ ·
  Kompas „[stav]“; odkaz „Osoby a členstvá klubu“ s ikonou `chevron-right`.
- Kontakty, e-maily ani telefóny nie sú (neukladajú sa).

**Odchýlky od podkladov na potvrdenie:**

- Select Región v artboarde **nemá „Bez regiónu“** (podklady: 92 klubov bez regiónu). Podklady ho žiadajú – v
  implementácii doplniť, Cyrilovi spomenúť pri schválení.
- „V aplikácii“ – definícia je návrh, potvrdí Cyril (otázka č. 1).
- Import snapshotu JSON sa ruší, súbory sa mažú len so súhlasom Cyrila (otázka č. 5).

## AdminMobilKluby.dc.html – Kluby, mobil

- **Stav:** nové 7. 11., čaká.
- **Rozloženie:** mobilný rám.
  1. `h1.large-title` „Kluby“ + footnote „1 558 aktívnych · obnovené 7. 11. 3:00“.
  2. Input „Hľadať“ s ikonou `search`, placeholder „Názov klubu alebo IČO“.
  3. Rad Chipov s vodorovným posunom (`aria-label="Filtre"`): Chip s ikonou `filter` „Filtre · 1“ (otvorí Modal) ·
     vybraný Chip „ZsFZ“ s × (`onRemove` zruší filter) · Chip „V aplikácii“ (rýchly filter).
  4. Zoznam **kariet** (odkazy, min. 64 px, podklad `--surface-raised`): Avatar `md` · názov (`headline`) ·
     „{zväz} · {región} · IČO [IČO]“ (`footnote`) · Badge „Aktívny“ + Badge `brand` „V aplikácii“ alebo `neutral`
     „Nie je v aplikácii“ · ikona `chevron-right`. Bez stĺpca Názov PO.
  5. Stránkovanie: IconButton `secondary` „Predchádzajúca strana“ (disabled) · „1 – 25 z 412“ · IconButton
     „Ďalšia strana“ (bez „x / y“).
  6. Poznámka: „Na mobile sa riadky tabuľky menia na karty. Ťuknutie otvorí detail klubu na celú obrazovku.“
- **Modal „Filtre“** (`sheetOnMobile` – zdola): Select Región (tu ZsFZ), Zväz, Stav, V aplikácii; Button
  `primary` `block` **„Zobraziť 412 klubov“** (počet z servera) a `tertiary` `block` „Zrušiť filtre“, pod sebou.
- **Detail na mobile** (`/admin/kluby/[clubId]`, celá stránka) **nie je nakreslený**; karta v artboarde vedie na
  desktopové Kluby. Obsah = sekcie Drawera z desktopu. Ak treba vlastný návrh, spýtať sa Cyrila.

## AdminCiselniky.dc.html – Číselníky, desktop (`/admin/ciselniky`)

- **Stav:** upravené 7. 11., čaká; základ schválený 7. 11. Len zobrazenie, nič sa needituje.
- **Rozloženie:** `h1` „Číselníky“; pod ním dva stĺpce (flex `wrap`):
  - Vľavo zoznam (`ul`, 260 px+, podklad `--surface-raised`): riadok min. 60 px – názov (`body`), popis (`footnote`),
    vpravo Badge zdroja (`brand` Akadémia / `neutral` sportnet.online). Vybraný riadok má podklad
    `--brand-blue-tint`.

    | Číselník                 | Popis v riadku                               | Zdroj           |
    | ------------------------ | -------------------------------------------- | --------------- |
    | Roly v klube             | 6 rolí · mapovanie na sportnet.online        | Akadémia        |
    | Typy osôb                | hráč, tréner, delegát, pozorovateľ, rozhodca | sportnet.online |
    | Funkcie v klube          | vedúci družstva, funkcionár, lekár…          | sportnet.online |
    | Typy organizácií         | PO (právnická osoba), PPO (klub)             | sportnet.online |
    | Zväzy                    | 4 regionálne · [počet] oblastných            | sportnet.online |
    | Vekové kategórie         | U9 … dospelí                                 | sportnet.online |
    | Oblasti a línie          | 11 oblastí · 4 línie                         | Akadémia        |
    | Pásma Kompasu a licencií | 5 + 5 pásiem                                 | Akadémia        |

  - Vpravo Card „Roly v klube“ s akciou „Akadémia“: callout „Rola v Akadémii určuje prístup. Zo sportnet.online sa
    pri prihlásení preberie jedna rola na klub – najsilnejšia (ADR 0027). Tréner a mentor sa priraďujú v Akadémii.“
    DS Table (`stackOnMobile`), caption „Mapovanie rolí na sportnet.online“, stĺpce Rola v Akadémii · Zdroj · Väzba
    v sportnet.online · Prístup (`hideOnMobile`):

    | Rola v Akadémii | Zdroj           | Väzba v sportnet.online                              | Prístup                                   |
    | --------------- | --------------- | ---------------------------------------------------- | ----------------------------------------- |
    | Klubový manažér | sportnet.online | Rola admin, matrikár alebo manager v CRM klubu       | Zápis: Kompas, licenčné, plán, nastavenia |
    | Tréner          | Akadémia        | – (väzba tréner ↔ klub v sportnet.online chýba)      | Čítanie, svoje ciele plánu                |
    | Tímový manažér  | sportnet.online | Odborná príslušnosť „Vedúci družstva“                | Ako tréner                                |
    | Hráč            | sportnet.online | Hráčska príslušnosť ku klubu                         | Prehľad a plán – čítanie                  |
    | Člen            | sportnet.online | Iná aktívna odborná príslušnosť (funkcionár, lekár…) | Prehľad a plán – čítanie                  |
    | Mentor          | Akadémia        | – (prideľuje SFZ)                                    | Kluby, ktoré mentoruje                    |

    Footnote: „Mapovanie je v kóde (ADR 0021, 0024, 0027) – obrazovka ho len zobrazuje, needituje sa.“
- **Nenakreslené:** detail ostatných 7 číselníkov (len „Roly v klube“). Úplnosť zoznamu potvrdí Cyril (otázka č. 3).
- **Mobil:** artboard nie je. Podľa Stavov: zoznam a detail pod sebou, Table `stackOnMobile`, stĺpec Prístup skrytý.

## AdminOsoby.dc.html – Osoby a členstvá, desktop (`/admin/osoby`)

- **Stav:** upravené 7. 11., čaká; základ schválený 7. 11.
- **Prepínač artboardu (Tweaks):** `sportnetDown` (boolean).
- **Dáta:** osoby klubu živo zo Sportnetu (`GET /ppo/{appSpace}/users`) + roly z `club_memberships`.

**Rozloženie:**

1. `h1` „Osoby a členstvá“; Tabs `segmented` (`aria-label="Zobrazenie"`): **„Osoby v kluboch“ · „Mentori“**.
2. Záložka Osoby v kluboch:
   - Filtre: Input „Klub“, placeholder „Hľadať klub“ (v ukážke „Klub A“) · Select „Rola v Akadémii“: Všetky ·
     Klubový manažér · Tréner · Tímový manažér · Hráč · Člen · Bez roly.
   - Legenda (`aria-label="Legenda zdroja"`): Badge `neutral` „sportnet.online“ + „preberá sa, v Akadémii sa
     nemení“ · Badge `brand` „Akadémia“ + „priraďuje admin SFZ, dá sa upraviť“.
   - Card `flush`, názov „Klub A · 6 osôb v sportnet.online“. Stĺpce: **Meno · V sportnet.online · Rola v Akadémii ·
     Zdroj roly · Prihlásený · (Akcie – skrytý nadpis)**. Meno `subheadline` 600; V sportnet.online v
     `--ink-muted`; Zdroj roly Badge; Prihlásený „áno“ / „nie“; pri roli zo zdroja Akadémia Button `tertiary sm`
     „Odobrať“.
   - Ukážkové riadky: Mária Kováčová – Funkcionár · správca v CRM – Klubový manažér – sportnet.online – áno ·
     Ján Tréner – Tréner (licencia UEFA C) – Tréner – **Akadémia** – áno – Odobrať · Eva Manažérka – Vedúci družstva –
     Tímový manažér · Tomáš Hráč – Hráč – Hráč · Zuzana Členka – Lekár / zdravotník – Člen · Martin Novák – Tréner –
     „–“ – „–“ – nie.
   - Päta karty: „Tréner sa v sportnet.online ku klubu neviaže – priraďuje ho admin SFZ.“ + Button `primary sm`,
     ikona `plus`, „Pridať rolu v Akadémii“.
3. Záložka Mentori: DS Table `stackOnMobile`, caption „Mentori zväzu a ich kluby“, stĺpce Mentor · Zväz · Kluby ·
   Sezóna (napr. „Peter Mentor – ZsFZ – Klub A, Klub B, Klub F – 2026/2027“). Akcie (pridať/odobrať mentora)
   **nie sú nakreslené**.
4. Poznámka: „Osoby klubu sa čítajú živo zo sportnet.online, v Akadémii sú uložené len roly a mentori. Globálne roly
   aplikácie sú v Používatelia.“

**Modaly (`sm`):**

- „Pridať rolu v Akadémii“: Select „Osoba“ (osoby klubu) · Select „Rola“: **„Tréner“, „Klubový manažér
  (výnimka)“** · Input „Vekové kategórie (nepovinné)“, placeholder „napr. U11, U13“, hint „Prázdne = celý klub“ ·
  „Zrušiť“ (`secondary`) + „Pridať“ (`primary`).
- „Odobrať rolu?“: „Ján Tréner stratí rolu Tréner v klube Klub A. Roly zo sportnet.online ostanú.“ · „Zrušiť“ +
  „Odobrať“ (`danger`). Po úspechu Toast (podľa Stavov „Rola odobratá.“).

**Sportnet neodpovedá (`sportnetDown`):** nad tabuľkou Alert `warning` „sportnet.online teraz neodpovedá“ / „Osoby
klubu zo sportnet.online sa nedajú načítať. Nižšie sú len roly uložené v Akadémii – roly zo sportnet.online ukazujú
stav z posledného prihlásenia osoby.“ + Button `secondary sm` „Skúsiť znova“. Názov karty sa zmení na „Klub A · roly
uložené v Akadémii“, ukážu sa len osoby, ktoré sa prihlásili, stĺpec V sportnet.online má hodnotu „nedostupné“.

**Na potvrdenie:** voľba „Klubový manažér (výnimka)“ v Modale = otvorená otázka č. 2. Kým ju Cyril nepotvrdí,
implementovať len Trénera.

**Mobil:** artboard nie je. Podľa Stavov: tabuľka → karty, filtre ako čipy + Modal, Modaly zdola, tlačidlá pod sebou.

## AdminPouzivatelia.dc.html – Používatelia, desktop (`/admin/pouzivatelia`)

- **Stav:** nové 7. 11., čaká.
- **Server:** zmena roly existuje (`PUT /api/v1/users/[id]/role`, vlastnú rolu admina si odobrať nedá). **Zoznam
  chýba** – kolekcia `user` len cez Better Auth API / `internalAdapter`, hľadanie a stránkovanie na serveri.

**Rozloženie:**

1. `h1` „Používatelia“ + callout „Rola v aplikácii platí nezávisle od klubu. Roly v kluboch a mentori sú v Osoby
   a členstvá.“
2. Filtre: Input „Hľadať“, placeholder „Meno alebo e-mail“ · Select „Rola v aplikácii“: Všetky · Admin SFZ · Používateľ.
3. Card `flush`, caption „Používatelia, ktorí sa prihlásili do Akadémie“. Stĺpce: **Meno · E-mail · Prihlásenie ·
   Rola v aplikácii · (Akcie)**. Meno s Avatarom `sm`; E-mail „[e-mail]“; Prihlásenie „sportnet.online“ alebo
   „e-mailový odkaz“; Rola Badge `brand` „Admin SFZ“ / `neutral` „Používateľ“; Button `tertiary sm` „Zmeniť rolu“.
4. Poznámka: „Admin SFZ sa určuje aj zoznamom e-mailov v nastaveniach servera; tu sa mení len rola v aplikácii.“
   Text je určený adminovi – ponechať ho aj v aplikácii.

- **Modal „Zmeniť rolu v aplikácii“** (`sm`): „Používateľ: **{meno}**“ · Select „Rola v aplikácii“ (Admin SFZ /
  Používateľ) · pri vlastnom účte Alert `warning` „Vlastnú rolu admina si odobrať nemôžete“ / „Požiadajte iného
  admina SFZ.“ · „Zrušiť“ (`secondary`) + „Uložiť“ (`primary`). Po uložení Toast (text nie je nakreslený).
- **Stránkovanie nie je nakreslené**, hoci podklady aj Stavy (bod 4) ho pre používateľov žiadajú – použiť rovnaký
  komponent ako pri Kluboch.
- **Mobil:** artboard nie je; platia pravidlá zo Stavov. E-maily v zápisoch (devlog, PR) maskovať.

## AdminPrehlad.dc.html – Prehľad administrácie, desktop (`/admin`)

- **Stav:** nové 7. 11., čaká. Posledné v poradí – nemá vlastné dáta.
- **Rozloženie** (medzera 24 px):
  1. `h1` „Administrácia“ + callout „Čo čaká na vás a v akom stave sú dáta Akadémie.“
  2. `h2.title-3` **„Čaká na vás“** – zoznam odkazov (riadok min. 60 px): ikona · názov (`headline`) · popis
     (`footnote`) · Badge s počtom · `chevron-right`.

     | Ikona            | Názov                           | Popis                                  | Počet (tón)       | Odkaz    |
     | ---------------- | ------------------------------- | -------------------------------------- | ----------------- | -------- |
     | `bell`           | Návrhy noviniek od klubov       | Na posúdenie redakciou SFZ             | [počet] (warning) | Novinky  |
     | `alert-triangle` | Kluby bez matričnej väzby       | V sportnet.online chýba väzba na zväz  | 15 (warning)      | Kluby    |
     | `x-circle`       | Posledná synchronizácia zlyhala | Ukáže sa len pri chybe posledného behu | 1 (danger)        | Sportnet |

  3. `h2.title-3` **„Stav dát“** – 4 dlaždice-odkazy (mriežka `minmax(220px, 1fr)`, podklad `--surface-raised`):
     ikona + názov · hodnota (`title-2`) · popis · Badge s bodkou.

     | Dlaždica         | Hodnota     | Popis                                     | Badge (tón)                          |
     | ---------------- | ----------- | ----------------------------------------- | ------------------------------------ |
     | Sportnet         | 7. 11. 3:00 | posledná synchronizácia klubov            | OK (success)                         |
     | Kluby            | 1 558       | aktívnych · [počet] aktívnych v aplikácii | zo sportnet.online (neutral)         |
     | Osoby a členstvá | [počet]     | rolí v kluboch · [počet] mentorov         | Akadémia + sportnet.online (neutral) |
     | Obsah            | 11          | oblastí · posledná zmena [dátum]          | Akadémia (brand)                     |

  4. Poznámka: „Počty v hranatých zátvorkách doplní server. Prehľad nemá vlastné dáta – zobrazuje súhrny z ostatných
     obrazoviek a vedie na ne.“
- Prázdny stav „Čaká na vás“ (nič nečaká) **nie je nakreslený**.
- **Mobil:** artboard nie je.

## AdminObsah.dc.html – Obsah (`/admin/obsah`), len menu a záložky

- **Stav:** upravené, čaká; základ schválený 7. 11. Mení sa len nové menu a záložky; obsah obrazovky ostáva.
- **Rozloženie:** `h1` „Obsah“ + vpravo Select „Oblasť“ (napr. „1 · Vedenie klubu“, „3 · Tréneri“, „8 · Financie a
  zdroje“). Tabs `underline` (`aria-label="Typ obsahu"`): **Otázky Kompasu · Metodika · Prax · Knižnica · Katalóg
  rolí · Názov a popis oblasti**.
- Záložka Otázky Kompasu: zoznam – ID (`data-mono`, napr. „3.i.1“) · text otázky · Badge kategórií (D, Z, DO, S,
  „rast“) · „verzia N“ · IconButton `edit` „Upraviť otázku“.
- Drawer sprava (420 px) „Otázka 3.i.2“: Textarea „Text otázky“ · fieldset „Platí pre kategórie“ – Checkbox „Deti (D)“,
  „Žiaci (Z)“, „Dorast (DO)“, „Seniori (S)“ · Button `primary` `block` „Uložiť ako verziu 3“ · „História“ –
  „Verzia 1 · 16. 10. 2026 · Admin SFZ“ + Button `tertiary sm` „Vrátiť“.
- Poznámka: „Metodika dostane editor s náhľadom, Prax a katalóg rolí štruktúrovaný formulár namiesto surového JSON.
  Každá zmena má históriu a dá sa vrátiť.“ – to je rozsah redesignu Obsahu (Cyril), nie S3.
- Pre S3: Katalóg rolí sa presúva z menu do záložky Obsahu (dnes samostatná položka „Roly“).

## AdminKniznica.dc.html – Knižnica oblasti

- **Stav:** **schválené 30. 10.**; ADR 0022 odložené. V S3 len ako záložka v Obsahu.
- Rozloženie pre úplnosť: drobčeková navigácia „Obsah · oblasť 3 · Tréneri“, `h1.large-title` „Knižnica“, Tabs
  `underline` Otázky Kompasu · Metodika · Prax · Knižnica (**bez Katalógu rolí** – nezhoda s Obsahom, starší návrh).
  Card `flush` „Dokumenty oblasti“, stĺpce Dokument · Oblasti · Prístup (Badge „Pre všetkých“ `neutral` /
  „Po prihlásení“ `brand`) · Stiahnutí · Stav (Badge „Zverejnený“ `success` / „Koncept“ `neutral`). Poznámka:
  „Poradie sa mení presunutím riadku. Skrytý dokument nevidí nikto okrem admina; natrvalo sa maže až po potvrdení.“
  Bočný panel Card „Nový dokument“: zóna „Presuňte súbor sem alebo vyberte“ / „PDF, Word, Excel, PowerPoint,
  OpenDocument, obrázky · do 25 MB“ · Input „Názov“ · Textarea „Krátky popis“ (hint „Jedna–dve vety, čo dokument
  obsahuje a komu pomôže.“) · Select „Typ“ (Vzor, Príručka, Tabuľka, Prezentácia, Iné) · „Oblasti (dokument sa
  zobrazí v každej)“ – Chipy + „Pridať oblasť“ · „Prístup“ – Tabs `segmented` Pre všetkých / Po prihlásení ·
  „Zverejniť“ (`primary`) + „Uložiť ako koncept“ (`secondary`).

---

## Čo v návrhu chýba alebo sa líši od podkladov (na potvrdenie Cyrilom)

1. Kluby: filter Región bez voľby **„Bez regiónu“** (podklady ju majú).
2. Kluby: **detail na mobile** (`/admin/kluby/[clubId]`) nie je nakreslený.
3. Osoby: Modal ponúka **„Klubový manažér (výnimka)“** – otvorená otázka č. 2.
4. Osoby: akcie v záložke **Mentori** nie sú nakreslené.
5. Používatelia: **stránkovanie** a Toast po zmene roly nie sú nakreslené.
6. Číselníky: nakreslený je len detail **Roly v klube**.
7. Prehľad: chýba prázdny stav „Čaká na vás“.
8. Mobilné artboardy sú len pre Sportnet a Kluby; ostatné obrazovky idú podľa pravidiel zo Stavov.
9. Knižnica má záložky bez Katalógu rolí, Obsah s ním – platí Obsah (novší).

## Otvorené otázky (podklady, časť 8)

1. Definícia filtra „V aplikácii“.
2. Smie admin ručne pridať aj klubového manažéra (výnimka mimo Sportnetu), alebo len trénera?
3. Úplnosť zoznamu číselníkov.
4. Zobrazovať meno pri ručnom behu synchronizácie (dnes nie, ADR 0030)?
5. Súhlas so zmazaním importu snapshotu po nasadení Klubov.

## Hranice práce (podklady, časť 6)

Redesign (Cyril) do `src/app/admin/**`, `src/components/app-frame/admin-side-menu.tsx` ani `adminMenu` nezasahuje.
V spoločných súboroch (`messages/sk.json`, `NEXT.md`, `CHANGELOG.md`, devlog) len vlastné riadky. Poradie `adminMenu`:
Prehľad · Kluby · Osoby a členstvá · Číselníky · Obsah · Novinky · Používatelia · Sportnet; upraviť
`navigation.test.ts` a `navigation-messages.test.ts`.
