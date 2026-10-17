# Changelog

Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Unreleased]

### Pridané

- Video „Akadémia za 8 minút“ na stránke „O Akadémii“ pod úvodom: YouTube (bez cookies) sa načíta až po kliknutí, s označením, že video vytvorila umelá inteligencia.
- Stránka „O Akadémii“ (H7): `/o-akademii` – základné info, pomoc klubom na každej úrovni a v každej oblasti, prečo futbal v obci, čo klub prináša obci, škole, rodinám a mladým, význam športovania cez futbal (komunita, zdravie, výchova); krátke texty s ikonami a výzva na výber roly a Kompas. Odkaz z úvodu, z päty (namiesto rozbaľovacieho „O Akadémii“) a ikonou „i“ v hlavičke.
- Vyhľadávanie (H6): pole „Čo vo vašom klube riešite?“ na úvodnej stránke pod blokom „Ako Akadémia funguje“ (s tipmi) a v hlavičke (na mobile lupa); stránka `/hladat` s výsledkami podľa typu (oblasti, Metodika, Prax, vzory, kluby/Vizitka); bez diakritiky a so skloňovaním; odkaz otvorí a ukáže sekciu, krok Praxe alebo vzor; mentorská Prax len pre mentorov; `GET /api/v1/search?q=`.
- Postup v Praxi v Moja Akadémia a na úvodnej obrazovke (F6d-c): keď klub v Praxi začal, úloha „Prax oblasti N: dokončite prvý krok – …“ alebo „pokračujte – 2. týždeň: …“ s odkazom na rolu a klub (rola z vlastných rolí v oblastiach, inak z roly v klube); na úvode samostatne „Pokračujte v Praxi“; pri slabej oblasti „Prax: x z y krokov“.
- Postup v Praxi v UI (F6d-b): na karte Prax oblasti zaškrtávanie úloh prvého kroku, výber možnosti pri kroku a „hotové“ s dátumom, priebeh roly a stav ukladania; ukladá sa hneď pri zmene (Server Action), mentor zväzu vidí len na čítanie, výber klubu pri viacerých kluboch (`?club=`); neprihlásený vidí výzvu prihlásiť sa.
- Postup v Praxi – základ (F6d-a): spoločný záznam klubu na oblasť a sezónu (úlohy prvého kroku, zvolená možnosť a „hotové“ pri krokoch, súhrn po rolách), vedenie a tréner zapisujú, mentor zväzu číta; `GET|PUT /api/v1/clubs/:clubId/practice/:area`, kolekcia `practice_progress`.
- „Ako Akadémia funguje“ na úvodnej stránke pre neprihlásených (H5c): Vizitka klubu so zoznamom pilotných klubov, 1. úroveň samoštúdium v 11 oblastiach, 2. úroveň klub v Akadémii po prihlásení (mentor zväzu; komunikácia s ľuďmi klubu „pripravujeme“).
- Mentor zväzu je na pozadí (rozhodnutie 16. 10.): rolu Mentor zväzu na úvodnej obrazovke, v Metodike aj v Praxi oblastí vidí len prihlásený mentor sezóny a admin SFZ; verejnosť a ostatní členovia klubu ju nevidia (katalóg rolí bez zmeny).
- Úvodná obrazovka po prihlásení (H5b): blok „Vaša Akadémia“ nad verejnou časťou – pre každý klub Vizitka (Kompas a licenčné hodnotenie), „Čaká na vás“ (najviac 3 úlohy, ďalšie v Moja Akadémia) a slabé oblasti podľa Kompasu s odkazom na Prax; mentor vidí kluby kohorty so stavom Kompasu (zbalené). Úvod s obrázkom sa prihlásenému skráti.
- Nová úvodná obrazovka (H5a): úvod Akadémie s obrázkom (zatiaľ ilustrácia), „Kto ste v klube?“ s kartami rolí, Kompas ako informácia s odkazom, oblasti – pri role 3 prioritné, ďalšie oblasti roly ako „Ďalšie kroky“, ostatné zbalené; bez roly všetkých 11; na záver Kompas s výberom klubu. Akadémia profesionálneho klubu presunutá do päty („pripravujeme“).
- Metodika podľa roly (H4, ADR 0011): sekcie Metodiky zbalené (rozbalia sa kliknutím), „Všeobecný popis“ prvý, sekcie pre zvolenú rolu hore a zvýraznené; prepínač roly v Metodike, rola z adresy (rola Hubu aj Praxe) alebo z členstva v klube, prenáša sa medzi Metodikou a Praxou. Návrh označenia 106 sekcií rolami v katalógu rolí (`sections`, `sectionsDraft`).
- Hub na úvodnej stránke (H3, ADR 0011): dráhy Klub v obci a Akadémia profesionálneho klubu („pripravujeme“), výber roly z katalógu („Ktorá rola som ja?“), výber pilotného klubu s kartou zo Sportnetu, „Začnite tu“, karta Kompasu, 11 oblastí zoradených podľa roly s vetou pre rolu, „O Akadémii“; výber v adrese (`?track=&role=&club=`) a v prehliadači, prihlásenému sa predvolí rola a klub z členstva; rola z Hubu predvolí rolu v Praxi oblasti.
- Katalóg rolí v2 (H2, ADR 0011): dráhy Klub v obci a Akadémia profesionálneho klubu („pripravujeme“), roly Hubu s poradím oblastí, vetami pre rolu, „Začnite tu“ a popisom roly; nové základné roly Dobrovoľník, Hráč / hráčka a Fanúšik (len verejný Hub). Úprava oblasti (názov, krátky názov, popis) adminom s históriou – `PUT /api/v1/areas/:area`.
- Verejný obsah a Kompas na vyskúšanie (H1, ADR 0011): oblasti s Metodikou a Praxou a čítacie API bez prihlásenia; `/kompas` – výber pilotného klubu, kategórie zo Sportnetu, priebežné skóre, odpovede len v prehliadači, výzva prihlásiť sa.
- Moja Akadémia (F6b, ADR 0010): `/moja-akademia` pre manažéra a výbor, trénera a mentora zväzu – kde klub stojí (Kompas, licenčné hodnotenie, Vizitka), „Čo mám urobiť ja“ s úlohami odvodenými z dát (nevyplnený / neodoslaný Kompas, neuzavreté licenčné hodnotenie, družstvá bez trénera, najslabšie oblasti → Prax), vlastné roly v oblastiach z katalógu (predvolia rolu v Praxi), kohorta mentora so súhrnnými úlohami; odkaz v hlavičke, po prihlásení sa otvorí Moja Akadémia, `/mentor` presmeruje mentorov sem.
- Roly v oblastiach ako spravovaný obsah (F6a, ADR 0010): katalóg 6 základných rolí a 60 rolí v 11 oblastiach podľa návrhu „Roly v 11 oblastiach“ (v1, 11. 10. 2026), stav schválené / návrh, väzba na roly v Praxi oblastí 3 a 4; editor admina s históriou a vrátením (`/admin/obsah/roly`), `GET|PUT /api/v1/roles`, `GET /api/v1/roles/revisions`.
- Zrušenie odoslania Kompasu adminom SFZ (ADR 0009): odoslanie zostáva v histórii ako „zrušené“, Vizitka, prehľad mentora a riadok SFZ-KOMPAS-1 berú posledné platné; `POST /api/v1/clubs/:clubId/kompas/submissions/:submissionId/withdraw`, tlačidlo s potvrdením.
- Znovuotvorenie uzavretej sezóny licenčného hodnotenia adminom SFZ (ADR 0008): uzavretá kópia zostáva v histórii ako „znovu otvorená“, sezóna sa dá upraviť a znovu uzavrieť; `POST /api/v1/clubs/:clubId/licensing/reopen`, tlačidlo s potvrdením.
- Vizitka klubu (F5c, ADR 0007): verejná `/vizitka/[clubId]` bez prihlásenia (profil klubu a hodnotenie oblastí odoslaného Kompasu a uzavretého licenčného hodnotenia) a `/klub/[clubId]/vizitka` pre roly (navyše dátumy, koeficient, stav rozpracovaného hodnotenia, odkazy na detail); prepínanie sezón, odkaz z karty klubu.
- Licenčné hodnotenie v UI (F5b): `/klub/[clubId]/licencne-hodnotenie` – prehľad 6 oblastí s pásmami, oblasti 2–4 zo Sportnetu (tabuľky, tréneri s opravou pohlavia), formuláre 5–7, počet obyvateľov a koeficient, priebežný výpočet, uloženie, uzavretie sezóny s potvrdením, prepínanie sezón; odkaz z karty klubu.
- Licenčné hodnotenie – základ (F5a, ADR 0006): pravidlá „pilot 2026, predbežné“ z Vizitky (oblasti 2–4 zo Sportnetu, 5–7 vstupy klubu, koeficient sídla, pásma), uloženie na sezónu s verziou (vedenie, mentor, admin; tréner číta), uzavretie sezóny ako zmrazená kópia; `GET|PUT /api/v1/clubs/:clubId/licensing`, `GET|POST .../licensing/submissions`.
- Odoslanie Kompasu mentorovi (F4c): zmrazená kópia (odpovede, znenie otázok, výsledok) pri každom odoslaní, história odoslaných verzií s detailom, riadok `SFZ-KOMPAS-1` na skopírovanie do zbernej tabuľky, prehľad mentora `/mentor` (len odoslané hodnotenia); API `GET|POST /api/v1/clubs/:clubId/kompas/submissions`, `GET .../submissions/:id`, `GET /api/v1/mentor/clubs`.
- Kompas klubu v aplikácii (F4b): `/klub/[clubId]/kompas` – zaškrtávanie s priebežným skóre, pásma oblastí, „Čo urobiť najbližšie“ s odkazmi na Metodiku a Prax, uloženie (vedenie), čítanie (tréner); odkaz z karty klubu; blok „Kde stojí váš klub“ v Praxi oblastí 3 a 4.
- Kompas klubu – základ (F4a): výpočet skóre podľa Kompasu v2 (platnosť otázok podľa kategórií klubu zo Sportnetu, minimum 3 platných otázok, pásma, čo urobiť najbližšie), uloženie odpovedí vedením klubu s verziou, `GET|PUT /api/v1/clubs/:clubId/kompas`.
- Prax oblastí 3 a 4 (F3c): obsah z návrhov prevedený do `content/prax`, zobrazenie podľa roly na stránke oblasti (karty Metodika / Prax), úprava ako JSON s kontrolou štruktúry, históriou a vrátením.
- Metodika 11 oblastí (F3b): obsah detailov prevedený do Markdownu (`content/metodika`), stránky `/oblasti` a `/oblasti/[číslo]` pre prihlásených, úprava sekcií adminom s „platné k“, „revidované“, históriou a vrátením. Nové závislosti `react-markdown`, `remark-gfm`.
- Spravovaný obsah (F3a): 11 oblastí a 220 otázok Kompasu v2 v databáze, úprava otázok adminom SFZ s verziou, históriou zmien a vrátením (`/admin/obsah`, `/api/v1/areas`, `/api/v1/kompas/questions`).
- Kluby zo Sportnetu (snapshot, ADR 0005): import v administrácii (`/admin/kluby`, `POST /api/v1/admin/club-snapshot`), karta klubu `/klub/[clubId]` s počtami a družstvami podľa sezóny.
- Roly v klube (ADR 0004): vedenie, tréner, mentor na sezónu; pridelenie a odobratie adminom SFZ (`/admin/kluby/[clubId]`, `/api/v1/clubs/:clubId/members`); „Moje kluby“ na `/ucet`; `GET /api/v1/clubs`.
- Prihlasovanie cez Better Auth: e-mailový odkaz (Ecomail, v dev režime do logu), príprava na Sportnet OIDC (zapne sa po doplnení client_id/secret).
- Roly (admin SFZ, ObFZ/RFZ, manažér klubu, mentor, dobrovoľník, verejnosť); prví admini cez `INITIAL_ADMIN_EMAILS`.
- API `GET /api/v1/me` a `PATCH /api/v1/users/:id/role` (len admin SFZ, ochrana proti odobratiu vlastnej roly admina).
- Stránky `/prihlasenie` a `/ucet` (mobile-first), hlavička so stavom prihlásenia.
- i18n cez next-intl: všetky texty pre používateľa v `messages/sk.json` (fallback na slovenčinu).
- `ARCHITECTURE.md`, `RUNBOOK.md`, ADR 0003 (tenant = klub); `CLAUDE.md` podľa šablóny konvencií; devlog po dňoch v `devlog/`.
- Testy route handlerov `/api/v1/me` a `/api/v1/users/:id/role` a reprodukčné testy k opraveným bugom.
- Projektové súbory: `CLAUDE.md`, `NEXT.md`, `CHANGELOG.md`, devlog a rozhodnutia (ADR 0001 Better Auth, ADR 0002 Sportnet OIDC).

### Zmenené

- Kompas na vyskúšanie: parameter adresy `?klub=` → `?club=` (konvencia anglických kľúčov).
- Oblasť 4 „Tímoví hráči klubu“ → **Dobrovoľníci**, rola „Tímový hráč klubu“ → **Dobrovoľník**, „Mladí v klube“ → **Hráč / hráčka** – 58 zmien v obsahu (otázky Kompasu, Metodika, Prax) podľa schváleného zoznamu `docs/obsah/premenovanie-dobrovolnici.md`.
- Čítanie oblastí, otázok Kompasu, Metodiky, Praxe a katalógu rolí už nevyžaduje prihlásenie (úpravy zostávajú adminovi SFZ).
- Roly v klube v texte: „Vedenie klubu“ → „Manažér a výbor“, „Tréner“ → „Tréner a trénerka“, „Mentor“ → „Mentor zväzu“ (kľúče v dátach bez zmeny).
- Globálne roly zúžené na `admin_sfz` a `public`; ostatné roly sú roly v klube (ADR 0004).

### Opravené

- Uloženie obsahu z formulára prepísalo text na konce riadkov CRLF (falošná zmena v histórii) – text sa ukladá s LF.
- `INITIAL_ADMIN_EMAILS` povýši na admina SFZ aj existujúci účet pri ďalšom prihlásení (predtým len pri vytvorení účtu).
- Neplatný JSON v tele požiadavky API vracia 400 namiesto 500.
- Prihlásenie na Vercel Preview: odkazy v e-mailoch a callbacky smerovali na `http://localhost:3000`; adresa sa teraz odvodí z adresy nasadenia (len vlastné hostiteľské mená, bez zástupných znakov).
- Prázdne hodnoty v `.env` (`KEY=`) sa berú ako nenastavené (predtým zlyhala validácia).
- MongoDB klient si nepamätá neúspešný prvý pokus o pripojenie; health endpoint loguje dôvod chyby DB.

## [0.1.0] – 2026-10-12

### Pridané

- Kostra aplikácie: Next.js 16, TypeScript, Tailwind 4, základ shadcn/ui.
- API vrstva s jednotným formátom odpovedí a endpoint `/api/v1/health` (stav aplikácie a databázy).
- Pripojenie k MongoDB Atlas, validované premenné prostredia, základ klienta Sportnet.
- CI na GitHube (formát, lint, typy, testy, build), Dependabot, CODEOWNERS, šablóna PR.
- Nasadenie na Vercel (fra1) s doménou rozvojklubu.ltk.solutions.
