# Analýza obrazoviek pre redesign (R1)

Stav: návrh na schválenie · Pripravil: Claude · 26. 10. 2026 · Plán: `docs/dizajn/plan-redesignu.md`, ADR 0018

Analýza vychádza z kódu na `main` (`0e9db5e`). Obrazovky sa v prehliadači neprechádzali – čísla riadkov a riziká
pre mobil sú z kódu a overia sa pri návrhu (R2) a prepise (R4).

## 1. Zhrnutie

- **30 obrazoviek** v šiestich skupinách: verejné (8), klub (10), osobné (2), mentor (1), analýza (1), administrácia (7)
  - prihlásenie.
- **Aplikácia nemá hlavné menu ani podmenu.** Hlavička má len ikony (hľadať, o Akadémii, Vizitky, Moja Akadémia, účet).
  Neexistuje žiadny `layout.tsx` pre klub ani pre administráciu – každá stránka si sama skladá okraje, šírku
  (`max-w-2xl` až `max-w-6xl`) a návrat cez textový odkaz.
- **shadcn sa takmer nepoužíva:** v projekte sú len `button`, `card`, `input`, `label`; `Input` a `Label` mimo
  prihlásenia a administrácie nikde. Formuláre, výbery, prepínače, záložky, čipy, akordeóny a tabuľky sú ručne písané
  HTML s Tailwindom (trieda `field` skopírovaná v 4 súboroch). Prechod na SFZ teda nie je výmena komponentov, ale
  prepis rozloženia – v súlade so zadaním.
- **Farby natvrdo** sú sústredené v piatich paletách, ktoré sa opakujú v kóde: pásma Kompasu (2×), pásma licenčného
  hodnotenia (2×), tri línie oblastí (3×), závažnosť úloh (2×), farby grafov a mapy. Plus jednorazové akcenty
  (emerald „potvrdené“, amber upozornenie, blue tip, green „hotové“) a ilustrácie (ihrisko, Hub).
  Dizajn systém má na všetko sémantické tokeny (kap. 6).
- **Najväčšie riziká na mobile:** lepkavé panely skóre v Kompase a licenčnom hodnotení (`sticky top-0` – zájdu pod
  hlavičku a zaberú veľkú časť obrazovky), tabuľky v licenčnom hodnotení, rebríčku (`min-w-[640px]`), Metodike
  (`min-w-[32rem]`) a analýze (`min-w-[34rem]`), JSON editory v administrácii (28 riadkov), dotykové plochy 32 px
  (`size-8`) namiesto 44 px (`--touch-target`).
- **Potvrdenia sú vložené tlačidlá**, žiadne okno (Modal) – ani pri mazaní člena, vrátení revízie či naplnení obsahu.

## 2. Inventár obrazoviek

Prístup: **V** verejné · **P** prihlásený · **K** rola v klube (vedenie / tréner / mentor) · **A** admin SFZ.
Návrh = čo sa pri redesigne zmení okrem výmeny za komponenty SFZ.

### 2.1 Verejné

| Obrazovka           | Účel                                                                                  | Prístup dnes               | Farby natvrdo                                   | Mobil                                                            | Návrh                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/` Hub             | Rozcestník: dráha, rola, 11 oblastí, Kompas; prihlásenému aj blok Moja Akadémia       | V (prihlásený vidí viac)   | línie oblastí, Kompas (amber), ilustrácia       | ~9 sekcií pod sebou, odkazy `text-xs`                            | Rozdeliť: verejný Hub (rola → oblasti → Kompas) a pre prihláseného presmerovať „domov“ na Moju Akadémiu; kratšia stránka |
| `/o-akademii`       | O Akadémii: video, „Jedenástka“ (ihrisko so 11 hráčmi), úrovne, prínosy               | V                          | ihrisko (`#3b8c2e`…), línie                     | piny 26 px, popisky `text-[10px]`                                | Ihrisko z tokenov (`--program-green`), väčšie piny, popover → Drawer na mobile                                           |
| `/oblasti`          | Zoznam 11 oblastí                                                                     | V                          | línie oblastí                                   | –                                                                | Karty SFZ s líniou oblasti ako Badge                                                                                     |
| `/oblasti/[area]`   | Detail oblasti: záložky Metodika / Prax, rola, postup klubu                           | V; postup a pin len P/K    | „hotové“ green, pin amber                       | najdlhšia obrazovka, tabuľky Metodiky, čipy, pin 32 px           | Tabs SFZ, akordeón sekcií (chýba v DS), Stepper pre cestu krokov v Praxi, tabuľky ako karty na mobile                    |
| `/kompas`           | Kompas na vyskúšanie bez uloženia (výber klubu → dotazník v prehliadači)              | V                          | pásma Kompasu                                   | lepkavý panel pod hlavičkou, malé checkboxy                      | Spoločný „dotazník“ vzor s klubovým Kompasom; skóre ako spodný panel; výsledok + CTA prihlásiť sa / uložiť               |
| `/hladat`           | Fulltext: oblasti, sekcie, Prax, šablóny, kluby                                       | V                          | –                                               | tipy `py-0.5`                                                    | Input SFZ s ikonou, výsledky po skupinách (Tabs alebo Chip filter), EmptyState                                           |
| `/vizitka`          | Vizitky klubov: mapa SR, filtre, zoznam, rebríčky, poradie zväzov                     | V (viac pre vlastné kluby) | mapa a hviezdy (blue/orange), míľniky (emerald) | tabuľka `min-w-[640px]`, malé polygóny ObFZ, prepínače `text-xs` | Mapa a rebríčky ako samostatné záložky; filtre v Drawer na mobile; rebríček ako karty, DataTable len desktop             |
| `/vizitka/[clubId]` | Verejná vizitka klubu: profil, Kompas a licenčné podľa oblastí, míľniky, verejný plán | V                          | pásma Kompasu aj licenčného, plán green         | nízke                                                            | Hlavička klubu (rovnaká ako v klubovej časti), pásma ako Badge z tokenov                                                 |
| `/prihlasenie`      | Sportnet + e-mailový odkaz                                                            | V                          | –                                               | –                                                                | Sportnet ako hlavné tlačidlo, e-mail ako doplnok; prihláseného presmerovať                                               |

### 2.2 Osobné

| Obrazovka        | Účel                                                                                                        | Prístup dnes | Farby natvrdo                      | Mobil                                      | Návrh                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/moja-akademia` | Osobná nástenka: prepínač klubu, panely (úlohy, Kompas graf, slabé oblasti, plán, návštevy, míľniky, Prax…) | P            | závažnosť úloh, grafy (`#2563eb`…) | 3 ikony 32 px na paneli, jeden dlhý stĺpec | „Domov“ prihláseného: najprv „Váš ďalší krok“ a úlohy, panely ako Card SFZ; prepínač klubu do hlavičky; menej panelov naraz |
| `/ucet`          | Meno, e-mail, rola, Sportnet, moje kluby, odkazy, odhlásenie                                                | P            | –                                  | –                                          | Menu účtu (Avatar) v hlavičke; stránka len profil a prepojenie so Sportnetom                                                |

### 2.3 Klub (`/klub/[clubId]/…`)

| Obrazovka              | Účel                                                                                  | Prístup dnes (čítanie / zápis)                                                 | Farby natvrdo        | Mobil                                               | Návrh                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| prehľad                | Rozcestník klubu: 6 odkazov, moje roly, sezóna, čísla, družstvá                       | K / –                                                                          | –                    | 6 tlačidiel v 3–4 riadkoch                          | Spoločný layout klubu s hlavičkou a podmenu; prehľad = stav a ďalšie kroky, nie zoznam odkazov |
| `kompas`               | Sebahodnotenie 11 oblastí, uložiť, odoslať mentorovi, história                        | vedenie, tréner (číta) / vedenie, A; **mentor FORBIDDEN**                      | pásma Kompasu        | lepkavý panel 3–4 riadky                            | Dotazník po oblastiach (Stepper alebo zoznam oblastí → detail), skóre v spodnom paneli         |
| `kompas/odoslane/[id]` | Zmrazený odoslaný Kompas; mentor potvrdí, admin stiahne                               | K / mentor (potvrdiť), A (stiahnuť)                                            | „potvrdené“ emerald  | kopírovací riadok sa posúva                         | Potvrdenie a stiahnutie cez Modal                                                              |
| `licencne-hodnotenie`  | 6 oblastí bodovania, uložiť, uzavrieť sezónu, admin otvorí                            | K / vedenie, mentor, A                                                         | pásma licenčného     | **najhoršie:** tabuľky 5 stĺpcov, riadky so vstupmi | Oblasti ako samostatné kroky; tabuľky ako karty; uzavretie cez Modal                           |
| `mentoring`            | Sezónny dokument mentoringu (4 časti), tlač                                           | K / vedenie (časti klubu), mentor (časti mentora), A; tréner bez spätnej väzby | –                    | nízke                                               | Časová os (Stepper) 4 častí; formuláre v Drawer                                                |
| `navstevy`             | Zoznam návštev mentora                                                                | K (klub vidí len naplánované a odoslané) / mentor, A                           | –                    | nízke                                               | Pod Mentoring (podmenu), zoznam kariet so stavom                                               |
| `navstevy/nova`        | Mentor plánuje alebo zapisuje návštevu                                                | mentor, A                                                                      | amber                | dlhý formulár bez krokov, `grid-cols-3`             | Stepper: termín → témy → hodnotenie → dohodnuté kroky                                          |
| `navstevy/[visitId]`   | Detail návštevy, odškrtávanie krokov, hodnotenie mentora, úprava                      | K / mentor, A; odškrtnutie každý, kto vidí                                     | amber                | ako `nova`                                          | Detail + akcie; úprava v samostatnom režime                                                    |
| `plan`                 | Plán rozvoja: až 10 cieľov, stav, potvrdenie mentorom                                 | K / vedenie, mentor, A; stav cieľa aj vlastník                                 | tip blue             | 10 cieľov = dlhý formulár                           | Ciele ako karty, úprava cieľa v Drawer (nie celý formulár naraz)                               |
| `vizitka`              | Interná vizitka: súhrn Kompas + licenčné, stav plánu a mentoringu, súhlas s rebríčkom | K / súhlas len vedenie                                                         | pásma oboch, emerald | husté riadky oblastí                                | Splynie s prehľadom klubu (dnes duplicita); súhlas do Nastavení klubu                          |

### 2.4 Mentor, analýza

| Obrazovka  | Účel                                                                                                       | Prístup dnes                                             | Farby natvrdo                                        | Mobil                                                   | Návrh                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/mentor`  | Všetky kluby s posledným odoslaným Kompasom                                                                | **v praxi len A** (mentor presmerovaný na Moju Akadémiu) | –                                                    | dlhý zoznam bez filtra                                  | Pracovisko mentora: moje kluby, na potvrdenie, najbližšie návštevy; pre A s filtrom zväzu  |
| `/analyza` | Analytika: filtre, porovnanie klubov, Kompas, licenčné, aktivita, sieťový graf, Sportnet v čase, CSV, tlač | P s rolou (rozsah A / mentor / klub)                     | grafy, heatmapa, sieťový graf (nesleduje tmavú tému) | heatmapa `min-w-[34rem]`, graf `touch-none`, osi 110 px | Grafy a sieť z tokenov `--chart-*`; filtre v Drawer; na mobile panely ako karty so súhrnom |

### 2.5 Administrácia (`/admin/…`, všetko len A)

| Obrazovka               | Účel                                                         | Číselníky / dáta                                                                | Návrh                                                                         |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `kluby`                 | Zoznam klubov, import snapshotu Sportnetu (JSON)             | `clubs`, `club_seasons` – jediný vstup dát o kluboch, nie naživo                | DataTable s hľadaním; import nahradí Sportnet (S3)                            |
| `kluby/[clubId]`        | Členstvá klubu v aktuálnej sezóne (pridať e-mailom, odobrať) | `club_memberships`, roly natvrdo (`CLUB_ROLES` 2×), vekové kategórie voľný text | Osoby a členstvá zo Sportnetu (S2–S3); odobratie cez Modal; výber sezóny      |
| `obsah`                 | 11 oblastí, katalóg rolí, naplnenie obsahu                   | súbory `content/*` → MongoDB                                                    | Sekcia „Obsah“ v bočnom menu administrácie                                    |
| `obsah/[area]`          | Otázky Kompasu oblasti, história, návrat                     | `kompas_questions`, štítky natvrdo                                              | Zoznam otázok + úprava v Drawer; meno a popis oblasti (API existuje, UI nie)  |
| `obsah/[area]/metodika` | Sekcie Metodiky (Markdown v textovom poli)                   | `area_sections`                                                                 | Editor s náhľadom                                                             |
| `obsah/[area]/prax`     | Prax ako surový JSON                                         | `area_practice`                                                                 | Štruktúrovaný formulár (na mobile JSON nepoužiteľný)                          |
| `obsah/roly`            | Katalóg rolí ako surový JSON                                 | `role_catalog`                                                                  | Štruktúrovaný formulár; prepojiť s rolami v klube (dnes dva oddelené zoznamy) |

Spoločné pre administráciu: 7 stránok opakuje rovnakú kontrolu prístupu a zobrazí text „bez prístupu“ namiesto 403;
chýba layout, bočné menu aj drobčeky. Pre globálnu rolu používateľa existuje API (`PUT /api/v1/users/[id]/role`),
ale obrazovka nie.

## 3. Model prístupov (návrh)

### 3.1 Úrovne

| Úroveň | Kto                                                                    | Zdroj (dnes → po S2)                               |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| V      | ktokoľvek bez prihlásenia                                              | –                                                  |
| P      | prihlásený bez roly v klube (rodič, fanúšik, dobrovoľník bez pozvánky) | Better Auth                                        |
| Č      | **člen klubu** (hráč/hráčka, iný člen)                                 | – → Sportnet (príslušnosť ku klubu)                |
| T      | **realizačný tím**: tréner, **tímový manažér**, **vedúci tímu**        | `coach` → Sportnet (funkcie pri družstve)          |
| M      | **vedenie klubu**: štatutár, **klubový manažér**, výbor                | `management` → Sportnet (funkcionári klubu PO/PPO) |
| Mn     | mentor zväzu (kohorta klubov)                                          | `mentor` (väzba v aplikácii, nie zo Sportnetu)     |
| A      | admin SFZ (neskôr aj ObFZ so zoznamom klubov)                          | globálna rola `admin_sfz`                          |

Vyššia úroveň v klube zahŕňa nižšie (M ⊃ T ⊃ Č). Mentor a admin sú mimo klubu, ich práva sú vymenované.

### 3.2 Čo kto vidí a robí

| Funkcia                                | V                   | P             | Č       | T                           | M                               | Mn                    | A                  |
| -------------------------------------- | ------------------- | ------------- | ------- | --------------------------- | ------------------------------- | --------------------- | ------------------ |
| Hub, oblasti, Metodika, Prax (čítanie) | ✓                   | ✓             | ✓       | ✓                           | ✓                               | ✓                     | ✓                  |
| Kompas „otestuj sa“ (bez uloženia)     | ✓                   | ✓             | ✓       | ✓                           | ✓                               | ✓                     | ✓                  |
| Vizitky, rebríčky, verejná vizitka     | ✓                   | ✓             | ✓       | ✓                           | ✓                               | ✓                     | ✓                  |
| Obľúbené, osobný postup v Praxi        | –                   | ✓             | ✓       | ✓                           | ✓                               | ✓                     | ✓                  |
| Prehľad klubu, interná vizitka         | –                   | –             | čítanie | čítanie                     | čítanie                         | svoje kluby           | ✓                  |
| Plán rozvoja                           | verejné ciele       | verejné ciele | čítanie | čítanie + svoje ciele       | zápis                           | zápis + potvrdenie    | ✓                  |
| Kompas klubu (vyplniť, odoslať)        | –                   | –             | –       | čítanie                     | zápis                           | odoslaný + potvrdenie | ✓                  |
| Licenčné hodnotenie                    | výsledok vo vizitke | výsledok      | –       | čítanie                     | zápis                           | zápis                 | ✓ + otvoriť sezónu |
| Mentoring a návštevy                   | –                   | –             | –       | čítanie (bez spätnej väzby) | časti klubu, odškrtnúť kroky    | zápis                 | ✓                  |
| Súhlas s rebríčkom, nastavenia klubu   | –                   | –             | –       | –                           | zápis                           | –                     | čítanie            |
| Analýza                                | –                   | –             | –       | –                           | vlastný klub + anonymný priemer | kohorta               | všetko             |
| Administrácia                          | –                   | –             | –       | –                           | –                               | –                     | ✓                  |

Pravidlo zo zadania: **hodnotenia a zbery dát sa ukladajú len po prihlásení**; bez prihlásenia sa dá vyskúšať Kompas
(výsledok ostane v prehliadači, po prihlásení ho možno preniesť do klubu – nová funkcia na schválenie).

### 3.3 Nálezy v prístupoch na opravu (samostatné opravy, každá s testom)

1. Mentor vo vizitke klubu vidí odkaz na Kompas, ktorý mu vráti „bez prístupu“ (`vizitka-view.tsx:140`, `kompas.service.ts:53`).
2. Používateľ, ktorý je v klube mentor aj vedenie, nemôže písať časti klubu v Mentoringu – `roleFor` uprednostní
   mentora (`club-mentoring.service.ts:93`).
3. `/mentor` pustí len admina, hoci služba podporuje aj mentora (`mentor/page.tsx:21`).
4. Súhlas s rebríčkom nemôže meniť ani admin (`club-settings.service.ts:69`) – ak je to zámer, zapísať do ADR 0015.
5. `?season=` v Mentoringu očakáva `2025/2026`, ostatné stránky `2025-2026` (`club-mentoring.service.ts:147`).

## 4. Informačná architektúra

### 4.1 Hlavné menu

**Desktop – NavBar SFZ (`tone="light"`)**

- Neprihlásený: **Akadémia** (Hub) · **Oblasti** · **Kompas** · **Kluby** (Vizitky a rebríčky) · **O Akadémii** ·
  vpravo hľadanie a **Prihlásiť sa**.
- Prihlásený: **Domov** (Moja Akadémia) · **Môj klub** (s prepínačom klubu, ak ich má viac) · **Oblasti** ·
  **Kompas** · **Kluby** · vpravo hľadanie a menu účtu (Avatar): Môj účet, Pracovisko mentora (Mn), Analýza (M, Mn, A),
  Administrácia (A), O Akadémii, Odhlásiť.

**Mobil – TabBar SFZ (max. 5 položiek)**

- Neprihlásený: Akadémia · Oblasti · Kompas · Kluby · Prihlásiť.
- Prihlásený s klubom: Domov · Môj klub · Oblasti · Kompas · Viac (Drawer: Kluby, hľadanie, účet, mentor, analýza,
  administrácia, o Akadémii).
- Hlavička na mobile: logo, hľadanie, pri prihlásenom Avatar.

### 4.2 Podmenu

**Klub** – spoločný `src/app/klub/[clubId]/layout.tsx`: hlavička klubu (meno, zväz, sezóna, moje roly) + Tabs
(na mobile vodorovne posuvné):

| Položka             | Route (stránka)                            | API                                              | Kto    |
| ------------------- | ------------------------------------------ | ------------------------------------------------ | ------ |
| Prehľad             | `/klub/[id]` (zlúčený s internou vizitkou) | `GET /api/v1/clubs/[id]` (+ vizitka – API chýba) | Č+     |
| Kompas              | `/klub/[id]/kompas`                        | `/clubs/[id]/kompas`, `…/submissions`            | T+, Mn |
| Plán                | `/klub/[id]/plan`                          | `/clubs/[id]/plan`                               | Č+, Mn |
| Licenčné hodnotenie | `/klub/[id]/licencne-hodnotenie`           | `/clubs/[id]/licensing`                          | T+, Mn |
| Mentoring           | `/klub/[id]/mentoring` (+ `navstevy`)      | `/clubs/[id]/mentoring`, `/mentor-visits`        | T+, Mn |
| Členovia _(S2)_     | `/klub/[id]/clenovia`                      | `/clubs/[id]/members`                            | M, A   |
| Nastavenia          | `/klub/[id]/nastavenia`                    | `/clubs/[id]/settings`                           | M, A   |

**Mentor** – `/mentor`: Moje kluby · Na potvrdenie (Kompas, plán) · Návštevy (naprieč klubmi).

**Administrácia** – `src/app/admin/layout.tsx` s bočným menu (na mobile Drawer):
Prehľad · Kluby · Osoby a členstvá _(S3)_ · Číselníky _(S3: roly v klube, typy osôb, vekové kategórie, zväzy, typy
klubu PO/PPO)_ · Obsah (oblasti, otázky Kompasu, Metodika, Prax, katalóg rolí) · Používatelia (globálna rola) ·
Sportnet _(S3: synchronizácia namiesto importu JSON)_.

### 4.3 Routy

- **Pravidlo:** URL stránok ostávajú slovenské a kopírujú štruktúru API (`/klub/[id]/…` ↔ `/api/v1/clubs/[id]/…`).
  Podmenu sa odvodzuje z prostriedkov API klubu.
- **Bez premenovania existujúcich URL** (odkazy z e-mailov a záložky); `/vizitka` ostáva, v menu sa volá „Kluby“.
- **Nové:** `/klub/[id]/clenovia`, `/klub/[id]/nastavenia`, `/admin/osoby`, `/admin/ciselniky/*`,
  `/admin/pouzivatelia`, `/admin/sportnet`.
- **Zlúčenie:** `/klub/[id]/vizitka` → prehľad klubu (stará URL presmeruje).
- **Chýbajúce API** pre budúci MCP server: interná vizitka klubu, revert katalógu rolí.

## 5. Vzory → komponenty SFZ

| Vzor v aplikácii                            | Komponent SFZ                                    | Poznámka                             |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| hlavička, ikony v hlavičke                  | NavBar, TabBar, Drawer, Avatar                   | obal s `next/link` (R3)              |
| záložky z odkazov (`aria-current`)          | Tabs                                             | variant pre odkazy (dnes `onChange`) |
| čipy filtrov, prepínače `aria-pressed`      | Chip                                             |                                      |
| odznaky stavu a pásma                       | Badge                                            | farby z tokenov (kap. 6)             |
| karty (`rounded-xl border p-4`)             | Card                                             |                                      |
| vstupy, výbery, textové polia, checkboxy    | Field, Input, Select, Textarea, Checkbox, Toggle | nahradí kopírovanú triedu `field`    |
| tabuľky                                     | Table, DataTable                                 | na mobile karty                      |
| dlhé formuláre (návšteva, licenčné, Kompas) | Stepper                                          |                                      |
| vložené potvrdenia                          | Modal                                            |                                      |
| úpravy v rámci zoznamu (cieľ, otázka)       | Drawer                                           |                                      |
| hlášky, tipy, upozornenia                   | Alert, Toast                                     |                                      |
| prázdne zoznamy                             | EmptyState                                       |                                      |
| načítavanie (`Suspense` fallback)           | Skeleton                                         |                                      |
| termíny návštev                             | Calendar                                         | voliteľne pre mentora                |

**Medzery dizajn systému** (skladať v `src/components/sfz` z tokenov a navrhnúť do DS): akordeón (`<details>` v
Metodike, Kompase, histórii), drobčeky, ukazovateľ postupu / skóre (Kompas, Prax), hviezdy hodnotenia, míľniky,
grafy (Recharts – len farby z `--chart-*`), mapa SR (vlastné SVG), sieťový graf (Cytoscape), editor Markdownu
s náhľadom, ilustrácie (ihrisko, Hub).

## 6. Farby natvrdo → tokeny (návrh)

| Paleta (výskyty)                                                           | Návrh tokenov                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pásma Kompasu – 5 úrovní (`kompas-form`, `vizitka-view`)                   | `--danger`, `--warning`, `--ink-muted`, `--brand-blue`, `--gold`                                        |
| Pásma licenčného (`licensing-form`, `vizitka-view`)                        | `--success`, `--warning`, `--ink-muted`, `--gold`                                                       |
| Línie oblastí – 4 (`page.tsx`, `oblasti`, `hub-illustration`, `formation`) | `--program-sky`, `--program-cyan`, `--program-green`, `--program-yellow` alebo `--brand-blue` + odtiene |
| Závažnosť úloh (`moja-akademia`, `my-academy-home`)                        | `--danger`, `--warning`, `--info`                                                                       |
| Grafy a mapa (`charts`, `network-graph`, `vizitky-explorer`)               | `--chart-1` … `--chart-4`; škála mapy z `--brand-blue-tint` → `--brand-blue`                            |
| Akcenty: potvrdené, hotové, upozornenie, tip                               | `--success`/`--success-ink`, `--warning-tint`, `--info-tint`                                            |
| Ihrisko, biela, čierna                                                     | `--program-green`, `--surface`, `--ink`, `--overlay`                                                    |

Pásma budú mať jednu definíciu v `src/components/sfz` (dnes sú skopírované 2× až 3×). Presné priradenie overí
Cyril pri návrhu R2a (kontrast vo svetlej aj tmavej téme).

## 7. Skupiny pre návrh (R2)

- **Skupina 1 (R2a):** rám aplikácie (NavBar, TabBar, menu účtu, päta), Hub `/`, `/oblasti`, `/oblasti/[area]`,
  `/kompas` (otestuj sa), `/vizitka`, `/vizitka/[clubId]`, `/prihlasenie` a **prehľad klubu s podmenu**. Spolu
  vzniknú spoločné vzory: hlavička klubu, karta oblasti, pásma, dotazník, filtre, rebríček.
- **Skupina 2:** klub – Kompas, odoslaný Kompas, plán, licenčné hodnotenie, mentoring, návštevy, nastavenia.
- **Skupina 3:** Moja Akadémia (domov prihláseného), účet, pracovisko mentora.
- **Skupina 4:** analýza.
- **Skupina 5:** administrácia (s ohľadom na číselníky zo Sportnetu – obrazovky Osoby a Číselníky sa navrhnú, dáta
  pribudnú v S3).

## 8. Otvorené otázky pre Cyrila

1. **Člen klubu (hráč/hráčka, bez funkcie):** má vidieť prehľad klubu a plán (návrh v 3.2), alebo len verejnú vizitku?
2. **Tímový manažér a vedúci tímu:** rovnaké práva ako tréner (návrh), alebo aj zápis do plánu / licenčného?
3. **Prihlásený bez klubu** – „domov“ = Moja Akadémia s obľúbenými a Hubom, súhlas?
4. **Prenos Kompasu „otestuj sa“** do klubu po prihlásení – chceme to?
5. **Zlúčenie internej vizitky s prehľadom klubu** – súhlas?
6. **Línie oblastí** – farby `--program-*` z dizajn systému, alebo jednofarebne (modrá SFZ v odtieňoch)?
