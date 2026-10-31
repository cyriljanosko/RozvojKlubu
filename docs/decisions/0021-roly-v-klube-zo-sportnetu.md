# 0021 – Roly v klube zo sportnet.online (S2)

- Stav: **prijaté** – rozhodnutia 28. 10. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR #103
- Dátum: 2026-10-28
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0002 (prihlásenie Sportnet), 0003 (tenant = klub), 0004 (roly ako väzby), 0005 (zdroj dát klubov)
- Zadanie: `docs/sportnet/zadanie-s1-s3.md`, časť S2 · Otvorené otázky pre sportnet.online:
  `docs/sportnet/otazky-sportnet-online.md`

## Kontext

Roly v klube dnes prideľuje admin SFZ ručne (`club_memberships`, roly `management`, `coach`, `mentor`,
ADR 0004). Zadanie S2 žiada, aby aplikácia rolu odvodila z príslušnosti osoby ku klubu v sportnet.online.
Cieľové roly (Cyril, 26. 10., `docs/dizajn/analyza-obrazoviek.md` kap. 3): **Klubový manažér, Tréner,
Tímový manažér, Hráč, Člen**; mentor a admin SFZ ostávajú z aplikácie.

Rozhodnutie 28. 10.: aplikácia pracuje **len s dátami CoreApi / CRM sportnet.online** (`api.sportnet.online/v1`).
Synchronizačná služba issf-connector ani ISSF nie sú pre nás zdroj – to, ako dáta do Sportnetu prichádzajú,
nás nezaujíma, len to, čo v Sportnete je.

### Typy osôb a funkcie (ISSF → sportnet.online)

ISSF rozlišuje **typy osôb** (Hráč, Tréner, Delegát, Pozorovateľ, Rozhodca) a **funkcie** v klube
(Inštruktor, Masér, Terapeut, Psychológ, Lekár / Zdravotník, Ekonóm, Technický pracovník, Kontrolór, Cvičiteľ,
Učiteľ, Usporiadateľ, Funkcionár, Časomerač, Zapisovateľ, Organizátor, Vedúci družstva, Bezpečnostný manažér,
Hlavný usporiadateľ, Hlásateľ, Videotechnik, Kustod, Fyzioterapeut, Skaut – formulár ISSF „Registrácia
osoby/príslušnosti“). Jedna osoba má bežne viac typov aj funkcií naraz (hráč + tréner + rozhodca). Roly
v aplikácii sú iná vec – typy a funkcie len kopírujú tam, kde to dáva zmysel.

### Čo sportnet.online o osobe a klube vie

Overené 28. 10. 2026 v dokumentácii CoreApi a auth.sportnet.online **a na živom verejnom API** (bez tokenu,
tri pilotné kluby: Slavoj Trebišov, ŠKM Liptovský Hrádok, MFK Dukla Banská Bystrica).

| Čo                                          | Kde v sportnet.online                                                                                                                                                                                      | Ako čítať                                                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Správca klubu                               | **Rola v aplikácii CRM pre appSpace klubu** (`appspaces` `CRM:{appSpace}`, roly `admin`, `manager`, `matrikar`; číselník `organization-user-role` má len `manager`).                                       | `GET /me/appspaces` (token používateľa) – filtrovať `app_id = CRM` a appSpace klubu. Za klub: `GET /appgrant/CRM/{appSpace}` (vyžaduje rolu s `grant`/`readonly`, alebo aplikačný token). |
| Funkcie v klube (vedúci družstva, lekár, …) | `users.sport_expert_orgs[]` – `org_profile_id` (appSpace klubu), `competence_type`, `legal_form`, `license_id`, `date_from`/`date_to`, `source: "issf"`.                                                   | `GET /me/sport-expert-orgs` (token) alebo verejne `GET /ppo/{appSpace}/users/{userId}/sport-expert-orgs` (všetky príslušnosti osoby, s rozbalenou licenciou).                             |
| Hráč                                        | `users.sport_orgs[]` – `competence_type: "player"`, `transfer_type` (`primary_registration`, `transfer`, `hosting`, `foreign_transfer`, `foreign_hosting`), `date_from`/`date_to`, `sector`.               | `GET /me/sport-orgs`, verejne `GET /ppo/{appSpace}/users/{userId}/sport-orgs`.                                                                                                            |
| Tréner                                      | **V klubových príslušnostiach troch pilotných klubov sa `competence_type: "coach"` nevyskytuje ani raz.** Trénerská licencia je v `sport_expert_orgs` s `org_profile_id = futbalsfz.sk` (zväz), nie klub.  | Otázka pre sportnet.online (`otazky-sportnet-online.md`, B1): kde je väzba tréner ↔ klub. Dovtedy `coach` z aplikácie.                                                                    |
| Tímový manažér (ISSF P31)                   | Samotná rola tímového ISSF manažéra v Sportnete nie je. Klubová funkcia **„Vedúci družstva“** a **„Vedúci družstva / Tímový manažér“** je (v živých dátach najčastejšia funkcia: 34 + 26 osôb v Dukle BB). | Z `sport_expert_orgs` podľa `competence_type` (pozri normalizáciu nižšie).                                                                                                                |
| Zoznam členov klubu                         | Verejný `GET /ppo/{appSpace}/users?affiliationCategory=sport_expert_orgs\|sport_orgs&limit=100` (stránkované, bez tokenu, bez licencií, bez `isActive`; filter `competenceTypes` sa verejne neuplatňuje).  | Pre S3 (osoby v kluboch) bez tokenu; CRM `GET /crm/{appSpace}/users` len s rolou CRM, aplikačným tokenom alebo `ppoApiKey`.                                                               |
| Štatutár                                    | Len `organizations.statutory` (text), nie väzba na používateľa.                                                                                                                                            | Neodvodzovať.                                                                                                                                                                             |

**Hodnoty `competence_type` v živých dátach** sú zmes kódov z globálneho číselníka
`GET /codelist/sport-expert-competence-type` (41 položiek: `coach`, `functionary`, `matchmaker`, `organizer`,
`security_manager`, `masseur`, `hlasatel`, `timekeeper`, `reporter`, `technical_worker`, …) a **slovenských
názvov z ISSF uložených doslovne** (`Vedúci družstva`, `Vedúci družstva / Tímový manažér`, `Lekár / Zdravotník`,
`Hlavný usporiadateľ`, `Videotechnik`, `Kustod`, `Fyzioterapeut`) – tie v číselníku nie sú. Mapovanie preto
porovnáva hodnotu po normalizácii (malé písmená, bez diakritiky, orezané) a pre tímového manažéra používa
prefix `veduci druzstva`.

Tokeny: access token z auth.sportnet.online nesie `sub` (Sportnet ID), `rls` (roly len pre **našu**
aplikáciu a jej detské aplikácie, nie CRM), platnosť 15 min; refresh token 24 h. `/me/*` používa schému
`sportnet_user` (token ľubovoľnej aplikácie). Rola správcu klubu v CRM sa do nášho tokenu nedostane – treba ju
čítať cez `/me/appspaces`. Verejné `/ppo/…` endpointy `isActive` nevracajú – aktivita sa počíta z `date_from`
/ `date_to` (väčšina príslušností je bez `date_to`).

## Rozhodnutie

### 1. Mapovanie sportnet.online → roly v klube

| Rola v aplikácii | Kód (`CLUB_ROLES`) | Zdroj v sportnet.online                                                                                                                                      | Platnosť                                 |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Klubový manažér  | `club_manager`     | rola **`admin` alebo `manager`** v `CRM:{clubId}` z `/me/appspaces` (rozhodnutie 28. 10.; `matrikar` ani iné roly nie)                                       | kým rola v CRM trvá (`validTo` appspace) |
| Tréner           | `coach`            | **zatiaľ aplikácia** (prideľuje klubový manažér alebo admin SFZ); zo Sportnetu až po odpovedi na otázku B1 – potom `sport_expert_orgs` typu `coach` pre klub | sezóna / podľa `date_from`/`date_to`     |
| Tímový manažér   | `team_manager`     | `sport_expert_orgs` s `org_profile_id = clubId`, `competence_type` normalizovaný s prefixom `veduci druzstva`, aktívna                                       | podľa `date_from`/`date_to`              |
| Hráč / hráčka    | `player`           | `sport_orgs` s `org_profile_id = clubId`, `competence_type = player`, aktívna (vrátane hosťovania)                                                           | podľa `date_from`/`date_to`              |
| Člen             | `member`           | každá iná aktívna položka `sport_expert_orgs` pre klub (funkcionár, lekár, usporiadateľ, …)                                                                  | podľa `date_from`/`date_to`              |
| Mentor zväzu     | `mentor`           | **aplikácia** (prideľuje admin SFZ) – bez zmeny                                                                                                              | sezóna                                   |
| Admin SFZ        | `user.role`        | **aplikácia** – bez zmeny                                                                                                                                    | –                                        |

Pravidlá:

- Aktívna príslušnosť = `date_from` ≤ dnes a (`date_to` prázdne alebo ≥ dnes).
- Hierarchia práv ostáva podľa analýzy kap. 3.1: `club_manager` ⊃ `coach` = `team_manager` ⊃ `member`; `player` = `member`.
- Dnešná rola `management` sa **premenuje** na `club_manager` (migrácia existujúcich väzieb pilotných klubov, len
  testovacie účty). Vo všetkých službách a testoch sa `management` nahradí.
- Osoba môže mať v jednom klube viac rolí naraz (ADR 0004) – každá je samostatná väzba. Delegát, pozorovateľ
  a rozhodca sú príslušnosti k zväzu, nie ku klubu – rolu v klube nedávajú.
- Klubový manažér môže v aplikácii **navyše** prideliť `coach`, `team_manager` a `member` (zdroj `app`) – pre
  trénerov, kým ich Sportnet nedá, a pre osoby bez príslušnosti (pozvánka, F7).

### 2. Schéma `club_memberships` (súhlas 28. 10. 2026)

Nové polia na väzbe:

```ts
interface ClubMembershipDoc {
  userId: string; // Better Auth user id (bez zmeny)
  clubId: string; // appSpace PPO klubu (bez zmeny)
  role: ClubRole; // "club_manager" | "coach" | "team_manager" | "player" | "member" | "mentor"
  season: string; // bez zmeny
  source: "sportnet" | "app"; // NOVÉ – odkiaľ väzba je
  sportnetRef?: string; // NOVÉ – _id položky sport_orgs / sport_expert_orgs, alebo "appspace:CRM"
  validFrom?: Date;
  validTo?: Date; // NOVÉ – platnosť zo Sportnetu (date_from / date_to)
  syncedAt?: Date; // NOVÉ – kedy bola väzba naposledy potvrdená zo Sportnetu
  createdBy?: string; // bez zmeny (len pre source = "app")
}
```

- `CLUB_ROLES` = `["club_manager", "coach", "team_manager", "player", "member", "mentor"]`.
- Index `{ userId, clubId, role, season }` ostáva; pridáva sa `{ clubId, season, source }` pre zoznam členov klubu.
- Väzby so `source: "sportnet"` aplikácia nikdy needituje ručne – pri obnove sa prepíšu; väzby `source: "app"`
  obnova nechá tak.

### 3. Kedy sa roly obnovujú (rozhodnutie 28. 10.: pri prihlásení + ručne, bez cronu)

1. **Pri každom prihlásení cez Sportnet** (hook Better Auth po prihlásení): zavolať `/me/appspaces`,
   `/me/sport-orgs`, `/me/sport-expert-orgs` access tokenom používateľa, prepočítať väzby `source: "sportnet"`
   pre aktuálnu sezónu, zapísať `syncedAt`.
2. **Ručne** tlačidlom „Obnoviť zo Sportnetu“ v administrácii (S3) – pre jednu osobu alebo celý klub cez verejné
   `GET /ppo/{clubId}/users/{userId}/…` (CRM rolu bez tokenu používateľa overiť nevieme – ostáva do ďalšieho
   prihlásenia).
3. Access token Sportnetu má 15 min, refresh 24 h: Better Auth ukladá oba v `account`; služba použije refresh,
   keď access vypršal, inak sa obnova odloží na ďalšie prihlásenie (bez chyby pre používateľa).

Prečo bez denného cronu: roly sa používajú len vtedy, keď je osoba v aplikácii – a vtedy sú čerstvé
z prihlásenia. Cron by vedel obnoviť len `team_manager`, `player` a `member` z verejných endpointov; rolu
`club_manager` (CRM) bez tokenu používateľa neobnoví, takže by aj tak nebol úplný. Jediné, čo cron rieši, je
zoznam členov klubu pre iných (obrazovka „Členovia klubu“) – tam stačí ručná obnova klubu v administrácii.
Ak sa neskôr ukáže, že zoznamy členov zastarávajú, pridá sa Vercel Cron nad verejnými endpointmi (lacný, bez
tokenu) ako nové ADR.

Používateľ prihlásený e-mailovým odkazom (bez `sportnetId`) roly zo Sportnetu nemá – môže mať len `app` väzby.

### 4. Čo sa mení v kóde (S2)

- `src/server/db/types.ts` – `CLUB_ROLES`, nové polia; `ARCHITECTURE.md` – index.
- `src/server/integrations/sportnet/` – klient pre `/me/appspaces`, `/me/sport-orgs`, `/me/sport-expert-orgs`
  a verejné `/ppo/{appSpace}/users/{userId}/…` (mockovaný v testoch).
- `src/server/services/club-roles-sync.service.ts` – čistá funkcia `deriveClubRoles(appspaces, sportOrgs,
sportExpertOrgs, clubIds, season, today)` → zoznam väzieb (testy na každý riadok tabuľky vrátane normalizácie
  `competence_type`) + zápis do DB.
- `club-access.ts`, `src/lib/navigation.ts`, `club-mentoring`, `kompas`, `club-plan`, `club-settings` – nahradiť
  `management` za `club_manager`, doplniť `team_manager`, `player`, `member` podľa matice kap. 3.2.
- Administrácia: väzby zo Sportnetu len na čítanie, s označením zdroja; ručne `mentor`, `coach`, `team_manager`,
  `member`.
- Migrácia: `management` → `club_manager`, `source: "app"` pre existujúce väzby (skript, dry-run, so súhlasom).

## Dôsledky

- Pilotné kluby majú roly zo Sportnetu až po tom, čo sa ľudia prihlásia Sportnet účtom (S1) – dovtedy ostávajú ručné
  väzby (`source: "app"`).
- Tréneri sú do odpovede sportnet.online (B1) ručná rola – rovnako ako dnes.
- Tenant filter `clubId` (ADR 0003) sa nemení; klub = appSpace PPO, čo sedí s `org_profile_id` v Sportnete.
- Osoba s rolou vo viacerých kluboch dostane väzbu pre každý klub, ktorý je v aplikácii (`clubs`); kluby mimo pilotu
  sa ignorujú, kým S3 nenačíta kluby zo Sportnetu.
- Zoznam členov klubu (obrazovka „Klub – členovia a roly“, redesign G2) sa dá postaviť z `club_memberships`
  (`clubId, season, source`), bez živého volania Sportnetu pri každom zobrazení.
- Dáta o osobách v MongoDB sú len väzby a identifikátory (CLAUDE.md: osobné údaje živo zo Sportnetu).
- Mapovanie `competence_type` je závislé od doslovných slovenských názvov z ISSF – ak ich Sportnet skodifikuje
  (otázka B2), zmení sa len normalizačná tabuľka v `deriveClubRoles`.

## Zamietnuté alternatívy a prečo

- **Čítať roly živo zo Sportnetu pri každom požiadavku** – `/me/*` vyžaduje platný token používateľa (15 min),
  verejné `/ppo/…` endpointy nedajú CRM rolu; pri každom requeste by to bolo pomalé a závislé od dostupnosti API.
  Cache vo väzbách s `syncedAt` je jednoduchšia a vysvetliteľná.
- **Denný cron** (pôvodný návrh) – zamietnuté 28. 10., dôvody v časti 3.
- **Roly z `rls` claimu v ID tokene** – nesie len roly našej aplikácie (a detských), nie CRM. Dalo by sa to obísť
  registráciou našej aplikácie ako detskej aplikácie CRM v Sportnete – otázka A10 pre tím sportnet.online, zatiaľ
  nepočítame s tým.
- **Klubový manažér = ktokoľvek s rolou v CRM klubu** – zamietnuté 28. 10.; `matrikar` a prípadné ďalšie roly
  nie sú vedenie klubu.
- **Register členov cez `GET /crm/{appSpace}/users` aplikačným tokenom alebo `ppoApiKey`** – pre roly prihláseného
  človeka stačí `/me/*`; pre S3 (zoznam osôb klubu) stačí verejný `/ppo/{appSpace}/users`. Aplikačný token sa
  rieši v otázkach A9 a B7.
- **Odvodiť tímového manažéra z ISSF** – Sportnet P31 nezrkadlí; funkcia „Vedúci družstva“ v `sport_expert_orgs`
  stačí.
- **Ponechať `management` ako kód** – názov by sa rozchádzal s cieľovou rolou „Klubový manažér“ a maticou prístupov;
  premenovanie je lacné, kým sú v DB len testovacie väzby.
