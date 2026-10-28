# Zadanie S1 – S3: napojenie na sportnet.online

Stav: zadanie pre kolegu z LTK Solutions · Zadal: Cyril Janoško · Pripravil: Claude · 28. 10. 2026

Tento dokument stačí na začiatok práce aj bez histórie konverzácií. Prečítaj najprv `CLAUDE.md`, `AGENTS.md`,
`ARCHITECTURE.md` a `NEXT.md`; konvencie repozitára platia bez výnimky.

## 1. Cieľ

Aplikácia Rozvoj klubu dnes pozná kluby len zo snapshotu (JSON import v administrácii) a roly v klube prideľuje
admin ručne. Cieľ je, aby:

1. **S1** – sa ľudia prihlasovali účtom **sportnet.online** (OIDC) a aplikácia z neho získala profil osoby.
2. **S2** – aplikácia z príslušnosti osoby ku klubu v sportnet.online sama určila jej **rolu v klube**.
3. **S3** – **číselníky** osôb, členov klubov, rolí v klube, typov osôb a klubov (PO, PPO) boli napojené na
   číselníky sportnet.online a **administrácia** v aplikácii prestala dáta zadávať ručne.

Redesign obrazoviek (SFZ Design System) beží paralelne v inej session – pozri časť 6.

## 2. Čo už existuje

| Oblasť                  | Stav                                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prihlásenie (ADR 0002)  | Better Auth `genericOAuth` s poskytovateľom `src/server/auth/sportnet.ts` (Authorization Code + PKCE, `openid`, overenie ID tokenu cez JWKS, RS256). Zapína sa, keď sú nastavené `SPORTNET_OAUTH_CLIENT_ID` a `_SECRET` (`src/server/auth/auth.ts`). Doplnok: e-mailový odkaz (Ecomail). |
| Neoverené               | Názvy claimov v ID tokene (meno, priezvisko, e-mail, fotka) – mapovanie v `mapSportnetClaims` je obranné. OAuth klient v sportnet.online **nie je zaregistrovaný** (client_id, secret, redirect URI).                                                                                    |
| Účty                    | Prepájanie účtov podľa overeného e-mailu (`accountLinking`, `trustedProviders: ["sportnet"]`); `sportnetId` sa ukladá k používateľovi.                                                                                                                                                   |
| Kluby (ADR 0005)        | `clubId` = appSpace PPO klubu v sportnet.online. Dáta klubov zo **snapshotu** (`club-snapshot.service.ts`, import na `/admin/kluby`, kolekcie `clubs`, `club_seasons`, `source: "snapshot"`).                                                                                            |
| Sportnet API            | `src/server/integrations/sportnet/client.ts` – prázdny klient (Bearer `SPORTNET_API_KEY`), zatiaľ ho nič nevolá.                                                                                                                                                                         |
| Roly v klube (ADR 0004) | Kolekcia `club_memberships` (osoba – klub – rola – sezóna), roly `management`, `coach`, `mentor` (`CLUB_ROLES` v `src/server/db/types.ts`); pridáva ich admin e-mailom na `/admin/kluby/[clubId]`.                                                                                       |
| Prístupy                | Čisté funkcie v `src/server/services/club-access.ts`; navigácia podľa rolí v `src/lib/navigation.ts` (testy).                                                                                                                                                                            |

## 3. Rozhodnutia, ktoré platia

- **Roly v klube** (Cyril, 26. 10. 2026; `docs/dizajn/analyza-obrazoviek.md`, kap. 3 a 8):
  **Klubový manažér** (správca klubu), **Tréner**, **Tímový manažér** (predtým vedúci tímu, zatiaľ práva trénera),
  **Hráč** (samostatná rola), **Člen** (všetky ostatné príslušnosti, základné práva). Matica „kto čo vidí“ je
  v analýze, kap. 3.2.
- **Mentor** nie je rola zo sportnet.online – prideľuje ho SFZ v aplikácii (ostáva v `club_memberships`).
- **Admin SFZ** je globálna rola aplikácie (`admin_sfz`), nie zo sportnet.online. Môže meniť súhlas klubu
  s rebríčkom (ADR 0020).
- **Tenant = klub** (ADR 0003): každý dotaz na dáta klubu má filter `clubId`.
- **Dáta o kluboch a osobách sa čítajú živo zo sportnet.online, v MongoDB sú len dáta aplikácie** (CLAUDE.md).
  Ak treba kópiu (výkon, analytika), je to rozhodnutie na nové ADR.
- **Prihlásenie:** text „Prihlásiť sa cez sportnet.online“ so symbolom sportnet.online (ľudia si mýlia
  sportnet.online so sportnet.sk).

## 4. Etapy a výstupy

Každá etapa = jedna alebo viac vetiev `feat/s1-…`, `feat/s2-…`, `feat/s3-…` a PR (merge commit, ADR 0017).
Väčšie rozhodnutie = najprv ADR (číslo podľa `docs/decisions/`).

### S1 – prihlásenie cez sportnet.online

1. Registrácia OAuth klienta v sportnet.online pre Production, Preview a localhost (redirect URI
   `…/api/auth/oauth2/callback/sportnet` – over v Better Auth). Hodnoty dá Cyril do Vercelu a `.env.local`.
2. Overiť skutočné claimy ID tokenu, upraviť `mapSportnetClaims` a test `sportnet.test.ts`.
3. Účet bez e-mailu, zmena e-mailu, prepojenie s existujúcim účtom z e-mailového odkazu – správanie + testy.
4. Overiť prihlásenie na Preview a v produkcii (zápis do `NEXT.md` a devlogu).

### S2 – roly a príslušnosť ku klubu

1. Zistiť v dokumentácii sportnet.online, odkiaľ čítať príslušnosť osoby ku klubu a jej typ (hráč, tréner,
   tímový manažér, funkcionár / správca klubu). Kandidáti na overenie – **nie sú potvrdené**:
   - `GET /me/appspaces` – aplikácie a organizácie, kde má prihlásený rolu (správca klubu v CRM).
   - `GET /ppo/{appSpace}/users/{userId}/sport-orgs` a `…/sport-expert-orgs` – hráčske a odborné príslušnosti
     (tréner s licenciou).
   - `GET /crm/{appSpace}/users` – register členov klubu (vyžaduje aplikačný token alebo `ppoApiKey`).
2. **ADR** s mapovaním typov osôb sportnet.online → roly v klube (časť 3) a s tým, kedy sa roly obnovujú
   (pri prihlásení, na pozadí, ručne).
3. Zmena schémy `club_memberships` a `CLUB_ROLES` (nové roly, zdroj `sportnet` / `app`, platnosť) –
   **vyžaduje súhlas Cyrila pred implementáciou** (CLAUDE.md, časť 8). Mentor ostáva z aplikácie.
4. Úprava `club-access.ts`, `src/lib/navigation.ts` (model už počíta s rozšírením rolí) a testov prístupov.

### S3 – číselníky a administrácia

1. Kluby: PO (právnická osoba, IČO) a PPO (profil klubu, väzba na zväz) zo sportnet.online namiesto importu
   snapshotu; zväzy RFZ/ObFZ; vekové kategórie; typy osôb. Snapshot import potom zrušiť (so súhlasom).
2. Administrácia podľa schváleného návrhu (plátno https://claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb, riadok
   „Skupina 5“): Kluby, Osoby a členstvá (osoby v kluboch zo sportnet.online, mentori v aplikácii, roly
   v aplikácii), Číselníky (so zdrojom Akadémia / sportnet.online a mapovaním rolí), stránka Sportnet
   (synchronizácia). UI výhradne v SFZ Design System (ADR 0018, skill `sfz-ui`).
3. Menu administrácie (`adminMenu` v `src/lib/navigation.ts`) doplniť o nové obrazovky.

## 5. Definition of Done (každý PR)

Podľa `CLAUDE.md`, časť 9: `format:check`, lint (vrátane pravidiel dizajnu), `typecheck`, `npm run test`,
`build` a `npm run test:e2e` prejdú; oprava chyby má reprodukujúci test; rozhranie overené na 375 px aj na
desktope; texty cez next-intl; aktualizovaný `NEXT.md`, `CHANGELOG.md` a devlog; PR s odôvodnením „prečo“.
**Testy nikdy nebežia proti živej databáze ani proti živému sportnet.online** – klient sa mockuje.

## 6. Spolupráca s redesignom

- **Dve sessions = dve vetvy.** Nikdy nepracuj na `main` ani na vetve redesignu (`feat/g…`).
- **Hranica:** S1–S3 menia hlavne `src/server/auth/**`, `src/server/integrations/sportnet/**`, služby klubov a
  členstiev, `src/server/db/types.ts` a obrazovky administrácie. Redesign (G1 – G4) mení obrazovky verejnej
  časti, klubu, Mojej Akadémie a analýzy. **Obrazovky administrácie (G5) robí S3** podľa schváleného návrhu.
- **Obrazovka Členovia klubu** (`/klub/[clubId]/clenovia`, návrh „Klub – členovia a roly“) potrebuje dáta z S2 –
  rozhranie služby dohodnúť cez PR skôr, než vznikne obrazovka.
- **Spoločné súbory** (`messages/sk.json`, `NEXT.md`, `CHANGELOG.md`, devlog dňa) – pridávaj vlastné riadky, pri
  konflikte sa zachovávajú obe strany.
- PR zlučuje Cyril.

## 7. Prístupy a nastavenie

- GitHub: spolupracovník repozitára (hotovo 28. 10.).
- `npm install` potrebuje `NPM_GITHUB_TOKEN` (classic, len `read:packages`) pre balík dizajn systému – lokálne
  `export NPM_GITHUB_TOKEN=$(gh auth token)` (ak účet vidí balík `@slovensky-futbalovy-zvaz/design-system`).
- `.env.local` podľa `.env.example` – hodnoty (MongoDB `rozvojklubu_dev`, Better Auth, Sportnet OAuth) dá Cyril.
  **Pozor:** Preview zdieľa databázu s produkciou (CLAUDE.md, časť 7) – zápisy pri skúšaní len so súhlasom.
- MCP so Sportnet dokumentáciou (`search-sportnet-documentation`) – pripojiť v Claude Code; dokumentácia
  CoreApi (`api.sportnet.online/v1`), `issf-connector` (synchronizácia PO/PPO a osôb) a ISSF (procesy P04 –
  príslušnosti, P31 – tímový manažér).
- Vercel (tím cyro5) a Atlas (projekt RozvojKlubu) – podľa potreby pridá Cyril.

## 8. Otvorené otázky – odpovede 28. 10. 2026 (Ján Letko, SFZ)

1. **OAuth klient** – nastaví Ján (SFZ), prípadne po konzultácii s vývojármi sportnet.online. Čo treba
   (client_id, hosty, redirect URI, granty, scope, claims): `docs/sportnet/otazky-sportnet-online.md`, časť A.
2. **Token pre register členov** – nie JWT používateľa, ale aplikačný token (`client_credentials`, rovnaký
   `client_id` a `secret`). Až v S3; pre zoznam osôb klubu zatiaľ stačí verejný `GET /ppo/{appSpace}/users`.
   Potrebné app roly sú otázka B7 pre sportnet.online.
3. **Typy osôb a funkcie** – typy osôb v ISSF: Hráč, Tréner, Delegát, Pozorovateľ, Rozhodca; funkcie v klube
   (Vedúci družstva, Funkcionár, Lekár / Zdravotník, …) podľa formulára ISSF „Registrácia osoby/príslušnosti“.
   Jedna osoba má bežne viac typov aj funkcií. Mapovanie na roly: ADR 0021, časť 1. Tréner ↔ klub sa
   v Sportnete nenašiel – otázka B1.
4. **Frekvencia obnovy rolí** – pri prihlásení + ručne v administrácii, bez cronu (ADR 0021, časť 3).
   **Dáta klubov** (S3): odporúčanie – pri štarte raz ručne (import v administrácii zo Sportnetu), potom
   týždenný Vercel Cron nad verejnými `/ppo/…` endpointmi (bez tokenu) + ručné tlačidlo; kluby sa menia
   zriedka (zlúčenia, premenovania, nové kluby medzi sezónami), denný beh by bol zbytočný. Rozhodne Cyril v S3.
5. **Databáza pre Preview** – nateraz netreba, Preview ďalej používa `rozvojklubu_dev` (rozhodnutie Jána 28. 10. 2026). Prázdna `rozvojklubu_preview` založená v ten deň bola hneď zrušená. Platí odchýlka
   v CLAUDE.md, časť 7: pred prvými ostrými dátami vlastná databáza.
