# Architektúra

Stav k 15. 10. 2026. Pri rozpore platí kód.

## Prehľad

```
Prehliadač (UI, Next.js stránky) ─┐
Externí klienti (REST)            ─┼─> /api/v1/*      (route handlery + apiHandler + Zod)
MCP server (F5, plánovaný)        ─┘        │
                                            v
                              src/server/services      (doménová logika, oprávnenia)
                                 │                │
                     src/server/db (MongoDB)   src/server/integrations (Sportnet API, Ecomail)

/api/auth/*  ── Better Auth (relácie, magic link, Sportnet OIDC)
```

## Moduly

| Cesta                     | Zodpovednosť                                                                |
| ------------------------- | --------------------------------------------------------------------------- |
| `src/app`                 | Stránky (Server Components) a route handlery (`api/v1`, `api/auth`)         |
| `src/components`          | UI komponenty (`ui/` = shadcn/ui)                                           |
| `src/i18n`, `messages/`   | next-intl konfigurácia a texty (SK; fallback na SK)                         |
| `src/lib`                 | Zdieľané utility a klient Better Auth pre prehliadač                        |
| `src/server/api`          | HTTP vrstva: `ApiError`, envelope odpovedí, `apiHandler`                    |
| `src/server/auth`         | Better Auth (`auth.ts`), roly (`roles.ts`), Sportnet OIDC, `getCurrentUser` |
| `src/server/services`     | Doménová logika (bez HTTP), testovaná unit testami                          |
| `src/server/db`           | MongoDB klient (singleton na `globalThis`, lenivé pripojenie)               |
| `src/server/integrations` | Externé systémy: Sportnet API (F2), Ecomail                                 |
| `src/server/env.ts`       | Validované premenné prostredia (prázdna hodnota = nenastavené)              |

## Dátové toky

### Prihlásenie cez Sportnet (OIDC)

1. `/prihlasenie` → `authClient.signIn.social({ provider: "sportnet" })`
2. Better Auth presmeruje na `auth.sportnet.online/authorize` (Authorization Code + PKCE, scope `openid`)
3. Callback `/api/auth/oauth2/callback/sportnet` → výmena kódu na `/token`
4. ID token sa overí cez JWKS (`/.well-known/jwks.json`, RS256, `iss`, `aud`) → `sub` = Sportnet ID
5. Better Auth vytvorí/prepojí používateľa (podľa e-mailu) a reláciu (cookie)

### Prihlásenie e-mailovým odkazom

1. `/prihlasenie` → `authClient.signIn.magicLink({ email })`
2. Better Auth vytvorí overovací token (kolekcia `verification`, platnosť 15 min)
3. `sendMagicLinkEmail` → Ecomail `POST /transactional/send-message` (dev bez kľúča: odkaz do logu)
4. Klik na odkaz → overenie → relácia → `/ucet`

### Oprávnenia

- Globálna rola je pole `user.role`: `admin_sfz` alebo `public` (`src/server/auth/roles.ts`).
- Prví administrátori: `INITIAL_ADMIN_EMAILS` – pri vytvorení účtu aj pri ďalšom prihlásení (len povýšenie, nikdy odobratie).
- Roly v klube sú členstvá `club_memberships` (osoba – klub – rola – sezóna, ADR 0004): `management`, `coach` (voliteľne kategórie), `mentor`.
- Prístup ku klubu: admin SFZ všetky kluby, ostatní len kluby s členstvom v aktuálnej sezóne (`src/server/services/club-access.ts`).
- Tenant = klub (ADR 0003): každý dotaz na klubové dáta má filter `clubId` = Sportnet appSpace (ADR 0005).

### Spravovaný obsah (F3)

1. Zdroj v gite: `content/kompas-areas.json` – 11 oblastí a 220 otázok Kompasu v2 (verejné, bez osobných údajov)
2. Admin SFZ na `/admin/obsah` (alebo `POST /api/v1/admin/content-seed`) doplní chýbajúce dokumenty – upravený obsah sa nikdy neprepíše
3. Úpravy len admin SFZ; každá zvýši `version` (súbežná úprava → 409) a uloží `content_revisions` (pred/po, kto, kedy); vrátenie = nová zmena
4. Čítanie obsahu je **verejné bez prihlásenia** (ADR 0011): `/api/v1/areas`, `/api/v1/kompas/questions`, Metodika, Prax, katalóg rolí, stránky `/oblasti` a `/oblasti/[číslo]`. Kompas na vyskúšanie `/kompas?club=…` berie kategórie z vybraného klubu, odpovede drží len v prehliadači (`localStorage`), nič neukladá. Bloky klubu a predvolená rola v Praxi len pre prihlásených
5. **Metodika** oblastí: `content/metodika/NN.md` (front matter + sekcie `## Nadpis {#kľúč}`, Markdown/GFM) – strojovo prevedené z detailov oblastí, bez zmeny textu. Naplnenie ich číta zo súborov (`outputFileTracingIncludes` v `next.config.ts`) do `area_sections`
6. Zobrazenie `/oblasti`, `/oblasti/[číslo]` cez `react-markdown` + `remark-gfm` (bez HTML v obsahu); úprava sekcií `/admin/obsah/[číslo]/metodika` s „platné k“ a „revidované“, históriou a vrátením
7. **Prax** oblastí 3 a 4: `content/prax/NN.json` (roly, prvý krok, cesta s 3 variantmi a cestou B, zásobník, vzory, mentorské moduly) – overuje Zod schéma `practice.schema.ts` vrátane odkazov na vzory; jeden dokument na oblasť v `area_practice`. Zobrazenie na `/oblasti/[číslo]?tab=prax&role=…` len na čítanie (predvolená rola: vlastná rola z Moja Akadémia, inak podľa roly v klube), úprava ako JSON v `/admin/obsah/[číslo]/prax`. Postup klubu v Praxi – pozri „Postup v Praxi (F6d)“

### Kompas klubu (F4)

1. `GET /api/v1/clubs/:clubId/kompas` – 220 otázok s platnosťou podľa kategórií klubu, odpovede a výsledok; vedenie a admin SFZ upravujú, tréner len číta, mentor pracovné hodnotenie nevidí (len odoslané – F4c)
2. Kategórie klubu len zo Sportnetu (snapshot): U06–U11 → D, U12–U15 → Z, U16–U19 → DO, U21/dospelí → S, ženské družstvo → zd (aktuálna sezóna, inak posledná s dátami)
3. Výpočet `src/server/services/kompas-scoring.ts` (čisté funkcie): stĺpec = round(zaškrtnuté platné / platné × 10), menej než 3 platné → oblasť sa nepočíta, oblasť 0–20, pásma 0–4 / 5–8 / 9–12 / 13–16 / 17–20, „čo urobiť najbližšie“ = 3 najslabšie oblasti a ich nezaškrtnuté platné otázky
4. `PUT` uloží odpovede s verziou (súbežná úprava → 409); jedno hodnotenie na klub a sezónu
5. UI `/klub/[clubId]/kompas`: priebežný výpočet v prehliadači (rovnaké čisté funkcie), uloženie cez Server Action; v Praxi oblastí 3 a 4 blok „Kde stojí váš klub“ pre kluby, kde je používateľ vedenie alebo tréner

### Postup v Praxi (F6d)

1. `GET /api/v1/clubs/:clubId/practice/:area` – postup klubu v Praxi oblasti v aktuálnej sezóne: odškrtnuté úlohy prvého kroku, pri krokoch zvolená možnosť a „hotové“ s dátumom, súhrn po rolách (úlohy, kroky, ďalší krok); vedenie, tréner a admin SFZ upravujú, mentor zväzu číta
2. `PUT` uloží postup s verziou (súbežná úprava → 409); id úloh, krokov a možností sa overia proti obsahu Praxe, dátum „hotové“ sa pri ďalšom uložení zachová
3. Jeden spoločný záznam na klub, oblasť a sezónu (každá rola má vlastné kroky); bez prihlásenia sa nič neukladá, vo Vizitke sa neukazuje (rozhodnutie 17. 10. 2026)

### Návšteva mentora (MV)

1. `GET|POST /api/v1/clubs/:clubId/mentor-visits`, `GET|PATCH .../:visitId`, `POST .../:visitId/send`, `POST .../:visitId/withdraw`, `PATCH .../:visitId/actions/:actionId` – služba `mentor-visit.service.ts`
2. Záznam: dátum, forma (osobne / online / telefonicky), prítomní (mená, len pre klub, jeho mentora a admina SFZ), zhrnutie, zistenia pri vybraných oblastiach, dohodnuté kroky (čo, oblasť, kto, do kedy, splnené)
3. Stav rozpracovaná → odoslaná klubu → zrušená (nič sa nemaže); zapisuje mentor klubu v sezóne a admin SFZ, vedenie a tréner vidia len odoslané a odškrtávajú kroky; verzia (súbežná úprava → 409)
4. Mentoring (MC, ADR 0013): stav aj **naplánovaná** (klub ju vidí), téma 0–3 oblasti, úloha vopred (`PATCH .../:visitId/prep` – klub odškrtne), hodnotenie podľa tém (blok pri každej téme, bez témy všeobecný) a celkové hodnotenie namiesto zhrnutia a zistení (ADR 0014), hodnotenia úlohy a krokov mentorom (`PATCH .../:visitId/ratings`); staré záznamy dostanú prázdne nové polia pri čítaní

### Mentoring klubu (MC)

1. `GET /api/v1/clubs/:clubId/mentoring?season=`, `PUT .../mentoring/:part` (`intro`, `focus`, `closing-club`, `closing-mentor`) – služba `club-mentoring.service.ts`, jeden dokument na klub a sezónu, verzia (súbežná úprava → 409)
2. Úvod a záver klubu píše vedenie, zameranie a záver mentora mentor klubu, admin SFZ všetko; tréner číta bez pripomienok k mentoringu; zapisuje sa len aktuálna sezóna
3. Stránka `/klub/[clubId]/mentoring` (MC-c) skladá cyklus z `club-mentoring.service` a návštev sezóny; časti ukladá Server Action; prioritné oblasti zamerania prejdú do plánu sezóny cez `?oblasti=`
4. Úlohy a prehľady (MC-d): `getMyAcademy` číta stav cyklu (`mentoringStatus`) pri kluboch s mentorom sezóny; úlohy vedenia (úvod, príprava na naplánované stretnutie, záver v máji a júni) a mentora (bez zamerania, bez záveru); neverejná Vizitka ukazuje počet vyplnených častí

### Plán klubu na sezónu (CP)

1. `GET|PUT /api/v1/clubs/:clubId/plan`, `PATCH .../plan/goals/:goalId` (stav), `POST .../plan/confirm`, `GET .../plan/public` – služba `club-plan.service.ts`
2. Jeden plán na klub a sezónu: ciele (oblasť, cieľ, text pre verejnú Vizitku, ukazovateľ, zodpovedný, termín, stav nezačatý / rozbehnutý / splnený), potvrdenie mentorom (nepovinné), verzia (súbežná úprava → 409)
3. Zapisuje vedenie, mentor klubu a admin SFZ, tréner číta; stav cieľa mení aj jeho zodpovedný; prázdny plán ponúkne 2 najslabšie oblasti Kompasu (odoslaného, inak pracovného – ak ho čitateľ smie vidieť); verejne len oblasť, verejný text a stav, bez mien

### Vizitky klubov na mape (VK)

1. Verejná stránka `/vizitka` – `vizitky.service.ts` skladá zoznam z verejnej Vizitky každého klubu (veľkosť, odoslaný Kompas, uzavreté licenčné), bez prihlásenia
2. Mapa: `content/mapa-sr.json` (SVG cesty 8 krajov a 79 okresov z geoBoundaries / OpenStreetMap, ODbL, generuje `scripts/build-map.py`), `content/obfz-okresy.json` (38 ObFZ → okresy, RFZ), `content/kluby-okresy.json` (okres klubu); čisté funkcie v `src/lib/slovakia-map.ts`; RFZ sa kreslí z krajov, ObFZ z okresov
3. Filtre a mapa bežia v prehliadači (desiatky klubov); pri stovkách klubov prejsť na filtrovanie na serveri

### Odkazy na web SFZ

1. `content/odkazy-sfz.json` – pojmy → stránky futbalsfz.sk (školenia, kontinuálne vzdelávanie, Ticketing, ISSF…), oblasti, kde sa používajú (zatiaľ 3), a skupiny rozcestníka; mení sa cez PR
2. `src/lib/sfz-links.ts` – čisté funkcie: prvá zmienka každej stránky v sekcii Metodiky (remark plugin v `MarkdownContent`) a v kroku Praxe (`LinkedText`), najdlhší pojem prvý, celé slová, nie v kóde, odkazoch a nadpisoch
3. Rozcestník `CoachEducation` v oblasti 3 a dlaždica v Moja Akadémia; termíny len odkazom na SFZ Ticketing (bez verejného API)

### Analýza (DA)

1. `GET /api/v1/analytics?season=&union=&size=&clubs=a,b` – služba `analytics.service.ts`, bez novej kolekcie: Kompas po oblastiach, licenčné hodnotenie (uzavreté), aktivita (odoslaný Kompas, uzavreté licenčné, návštevy a kroky, plán), Sportnet po sezónach
2. Rozsah podľa roly: admin SFZ všetky kluby (pracovný Kompas), mentor svoju kohortu (len odoslaný Kompas), vedenie a tréner vlastný klub (pracovný Kompas) a anonymný priemer klubov rovnakej veľkosti z odoslaných Kompasov – len ak sú aspoň 3 (`MIN_BENCHMARK`), bez mien
3. Stránka `/analyza` volá službu priamo (Server Component), filtre sú GET formulár; grafy sú klientske obaly Recharts v `src/components/analytics/`, teplotná mapa Kompasu je serverová tabuľka
4. Porovnanie je ten istý výpočet s filtrom `clubs` (najviac 4 na stránke); `format=csv` vráti ten istý pohľad ako CSV (`analyticsCsv`), takže export má rovnaké oprávnenia; rozloženie panelov je len v prehliadači (`localStorage` kľúč `analytics.layout.v1`), PDF je tlač prehliadača
5. Mapa súvislostí (DA-d): `GET /api/v1/analytics/network?map=academy|club&club=` – služba `network.service.ts` skladá uzly (oblasti, roly, úlohy, ľudia) a hrany z katalógu rolí, Kompasu, odoslaných návštev, plánu sezóny a členov klubu; prístup ku klubu cez `getAnalytics`; ľudia len pre vedenie, mentora a admina, Mentor zväzu len pre mentora a admina; graf kreslí Cytoscape.js na klientovi (dynamický import)
6. Obľúbené (MD-c): hviezdička `PinButton` / `ClubPin` (`src/components/favorites`) volá Server Actions nad `preferences.service`; pripnutie, odopnutie aj poradie berú najnovší zoznam s opakovaním (bez verzie), rozloženie nástenky ide s verziou
7. Moja Akadémia je nástenka dlaždíc (MD-b): dáta z `getMyAcademy` (pre admina aj prehľad všetkých klubov), rozloženie dlaždíc z `user_preferences` (ADR 0012) cez Server Action `saveDashboardAction`; spoločný komponent `BoardView` pre panely analýzy (rozloženie v prehliadači) aj dlaždice (rozloženie v účte)
8. Výpočet ide po kluboch (N dotazov) – pri 10 pilotných kluboch ~1,5 s v dev režime; pri väčšom počte prerobiť na agregáciu alebo cache

### Vyhľadávanie (H6)

1. `GET /api/v1/search?q=` a stránka `/hladat` volajú `search.service.ts`: oblasti, sekcie Metodiky, Prax (prvý krok, kroky, vzory) a kluby; otázky Kompasu nie (rozhodnutie 17. 10. 2026)
2. Bez indexu a bez novej kolekcie – obsah (stovky textov) sa prehľadá v pamäti servera: normalizácia bez diakritiky, hrubý kmeň slova pre skloňovanie, všetky slová musia sedieť (inak aspoň jedno), názov váži viac, oblasť najviac; Atlas Search až pri väčšom obsahu
3. Mentorská Prax len pre mentora sezóny a admina SFZ (`seesMentor`); odkazy `?open=` otvoria sekciu alebo vzor, `ScrollToHash` sa po načítaní posunie na kotvu

### Dáta klubov (snapshot, ADR 0005)

1. Admin SFZ nahrá snapshot (JSON z návrhu Vizitky) na `/admin/kluby` alebo `POST /api/v1/admin/club-snapshot`
2. `parseSnapshot` ho overí (Zod) a premapuje → upsert do `clubs` a `club_seasons`
3. Karta klubu `/klub/[clubId]` a `GET /api/v1/clubs/:clubId` čítajú len počty a družstvá (mená trénerov nie)
4. Snapshot s menami leží len lokálne v `data/private/` (gitignore), nikdy v gite

## Hranice systému

- **Sportnet** je zdroj pravdy pre kluby a osoby a hlavný poskytovateľ identity. Dáta klubov zatiaľ zo snapshotu (ADR 0005), verejné API Sportnetu sa zatiaľ nepoužíva.
- **MongoDB** drží len dáta aplikácie.
- **Ecomail** len odosiela transakčné e-maily, nič neukladáme.

## Kolekcie a indexy (MongoDB `rozvojklubu_dev`)

| Kolekcia                | Vlastník           | Poznámka                                                    |
| ----------------------- | ------------------ | ----------------------------------------------------------- |
| `user`                  | Better Auth        | + polia `role`, `sportnetId`                                |
| `session`               | Better Auth        | relácie                                                     |
| `account`               | Better Auth        | prepojenia na poskytovateľov (Sportnet, e-mail)             |
| `verification`          | Better Auth        | tokeny magic linku                                          |
| `clubs`                 | aplikácia          | klub zo snapshotu, `clubId` = Sportnet appSpace             |
| `club_seasons`          | aplikácia          | družstvá, počty hráčov, tréneri s licenciami (osobné údaje) |
| `club_memberships`      | aplikácia          | roly v klube na sezónu (ADR 0004)                           |
| `areas`                 | aplikácia          | 11 oblastí (spravovaný obsah, bez tenanta)                  |
| `kompas_questions`      | aplikácia          | 220 otázok Kompasu, `questionId` napr. `4.i.2`, verzia      |
| `content_revisions`     | aplikácia          | história zmien spravovaného obsahu                          |
| `area_sections`         | aplikácia          | sekcie Metodiky, Markdown, verzia                           |
| `area_practice`         | aplikácia          | Prax oblasti (všetky roly), validovaný JSON, verzia         |
| `kompas_assessments`    | aplikácia (tenant) | pracovné sebahodnotenie klubu na sezónu, verzia             |
| `kompas_submissions`    | aplikácia (tenant) | odoslané (zmrazené) kópie Kompasu pre mentora, história     |
| `licensing_evaluations` | aplikácia (tenant) | licenčné hodnotenie – pracovná verzia na sezónu (ADR 0006)  |
| `licensing_submissions` | aplikácia (tenant) | uzavreté (zmrazené) licenčné hodnotenie sezóny              |
| `practice_progress`     | aplikácia (tenant) | postup klubu v Praxi oblasti na sezónu, verzia (F6d)        |
| `mentor_visits`         | aplikácia (tenant) | návštevy mentora s dohodnutými krokmi, stav, verzia (MV)    |
| `club_mentoring`        | aplikácia (tenant) | mentoring klubu na sezónu – úvod, zameranie, záver (MC)     |
| `club_plans`            | aplikácia (tenant) | plán klubu na sezónu – ciele, stav, potvrdenie, verzia (CP) |
| `user_preferences`      | aplikácia (osobné) | nástenka a obľúbené používateľa, verzia (MD, ADR 0012)      |

Vlastné indexy (zakladá `src/server/db/clubs.store.ts` pred prvým zápisom, súhlas 16. 10. 2026):

- `clubs`: `{ clubId: 1 }` unikátny
- `club_seasons`: `{ clubId: 1, season: 1 }` unikátny
- `club_memberships`: `{ userId: 1, season: 1 }`; `{ clubId: 1, season: 1, userId: 1, role: 1 }` unikátny (`club_season_user_role`)

Indexy obsahu (zakladá `src/server/db/content.store.ts`, súhlas 16. 10. 2026):

- `areas`: `{ number: 1 }` unikátny
- `kompas_questions`: `{ questionId: 1 }` unikátny; `{ area: 1, column: 1, order: 1 }`
- `content_revisions`: `{ entity: 1, entityId: 1, version: -1 }`
- `area_sections`: `{ area: 1, kind: 1, key: 1 }` unikátny
- `area_practice`: `{ area: 1 }` unikátny
- `area_role_choices`: `{ userId: 1, clubId: 1, season: 1 }` unikátny (zakladá `src/server/db/academy.store.ts`, súhlas 16. 10. 2026)
- `role_catalog`: `{ key: 1 }` unikátny (jeden dokument `key: "roles"`, zakladá `src/server/db/content.store.ts`, súhlas 16. 10. 2026)
- `kompas_assessments`: `{ clubId: 1, season: 1 }` unikátny (zakladá `src/server/db/kompas.store.ts`)
- `kompas_submissions`: `{ clubId: 1, season: 1, submittedAt: -1 }` (zakladá `src/server/db/kompas.store.ts`, súhlas 16. 10. 2026)
- `licensing_evaluations`: `{ clubId: 1, season: 1 }` unikátny; `licensing_submissions`: `{ clubId: 1, season: 1 }` unikátny
  len pre platné uzavretia (`club_season_closed`, `partialFilterExpression: { status: "closed" }`, ADR 0008)
  – jedno platné uzavretie na sezónu, znovu otvorené zostávajú v histórii (zakladá `src/server/db/licensing.store.ts`, súhlas 16. 10. 2026)
- `practice_progress`: `{ clubId: 1, season: 1, area: 1 }` unikátny (zakladá `src/server/db/practice-progress.store.ts`, súhlas 17. 10. 2026; dotaz overený cez `explain` – IXSCAN)
- `mentor_visits`: `{ clubId: 1, season: 1, date: -1 }` (zakladá `src/server/db/mentor-visit.store.ts`, súhlas 21. 10. 2026; dotaz overený cez `explain` – IXSCAN)
- `club_plans`: `{ clubId: 1, season: 1 }` unikátny (zakladá `src/server/db/club-plan.store.ts`, súhlas 21. 10. 2026; dotaz overený cez `explain` – IXSCAN)
- `club_mentoring`: `{ clubId: 1, season: 1 }` unikátny (zakladá `src/server/db/club-mentoring.store.ts` pri prvom uložení, súhlas 22. 10. 2026; ADR 0013)
- `user_preferences`: `{ userId: 1 }` unikátny (zakladá `src/server/db/preferences.store.ts` pri prvom uložení, súhlas 22. 10. 2026; osobné dáta mimo tenanta – ADR 0012)
