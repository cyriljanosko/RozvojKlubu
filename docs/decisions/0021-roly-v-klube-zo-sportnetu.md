# 0021 – Roly v klube zo sportnet.online (S2)

- Stav: **návrh** – čaká na rozhodnutie Cyrila
- Dátum: 2026-10-28
- Pripravil: Ján Letko (Claude) · Rozhodne: Cyril Janoško
- Nadväzuje na: 0002 (prihlásenie Sportnet), 0003 (tenant = klub), 0004 (roly ako väzby), 0005 (zdroj dát klubov)
- Zadanie: `docs/sportnet/zadanie-s1-s3.md`, časť S2

## Kontext

Roly v klube dnes prideľuje admin SFZ ručne (`club_memberships`, roly `management`, `coach`, `mentor`,
ADR 0004). Zadanie S2 žiada, aby aplikácia rolu odvodila z príslušnosti osoby ku klubu v sportnet.online.
Cieľové roly (Cyril, 26. 10., `docs/dizajn/analyza-obrazoviek.md` kap. 3): **Klubový manažér, Tréner,
Tímový manažér, Hráč, Člen**; mentor a admin SFZ ostávajú z aplikácie.

### Čo sportnet.online o osobe a klube vie (overené v dokumentácii 28. 10. 2026)

Zdroj: dokumentácia CoreApi (`api.sportnet.online/v1`), auth.sportnet.online, issf-connector a ISSF (P04, P31).

| Čo                                                                                      | Kde v sportnet.online                                                                                                                                                                                              | Ako čítať                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Správca klubu (ISSF klubový manažér)                                                    | **Rola v aplikácii CRM pre appSpace klubu** (`appspaces` `CRM:{appSpace}`). issf-connector ju prideľuje manažérom klubu z ISSF pri synchronizácii klubu (`updateClub`).                                            | `GET /me/appspaces` (token používateľa) – aplikácie a organizácie, kde má rolu; filtrovať `app_id = CRM` a appSpace klubu.                                                          |
| Tréner s licenciou, funkcionár, vedúci družstva, lekár… (ISSF klubová príslušnosť, P04) | `users.sport_expert_orgs[]` – `org_profile_id` (appSpace klubu), typ odborníka, `license_id`, `date_from`/`date_to`. Z ISSF ich píše issf-connector (`updatePerson`, `source: issf`).                              | `GET /me/sport-expert-orgs` (token používateľa) alebo verejne `GET /ppo/{appSpace}/users/{userId}/sport-expert-orgs`; za klub `GET /crm/{appSpace}/users` (CRM rola / `ppoApiKey`). |
| Hráč (registrácia, prestup, hosťovanie)                                                 | `users.sport_orgs[]` – `org_profile_id`, `transfer_type` (`primary_registration`, `transfer`, `hosting`, `foreign_transfer`), `date_from`/`date_to`, `isActive` (počíta sa pri čítaní).                            | `GET /me/sport-orgs`, verejne `GET /ppo/{appSpace}/users/{userId}/sport-orgs`.                                                                                                      |
| Tímový manažér (ISSF P31, `TIMOVY_ISSF_MANAZER`)                                        | **V sportnet.online nie je** – P31 je v analýze ISSF označený ako _Missing_. ISSF pozná aj typ odborníka „vedúci družstva / tímový manažér“ ako klubovú príslušnosť (P04) – ten sa do `sport_expert_orgs` zrkadlí. | Len cez `sport_expert_orgs` s typom vedúci družstva; samotná rola tímového ISSF manažéra sa odvodiť nedá.                                                                           |
| Štatutár                                                                                | ISSF `Statutar` (P04/P51); v sportnet.online len `organizations.statutory` (text), nie väzba na používateľa.                                                                                                       | Neodvodzovať.                                                                                                                                                                       |

Overené fakty o tokenoch: access token z auth.sportnet.online nesie `sub` (Sportnet ID), `rls` (roly len pre
**našu** aplikáciu a jej detské aplikácie, nie CRM), platnosť 15 min; refresh token 24 h. `/me/*` používa schému
`sportnet_user` (token ľubovoľnej aplikácie), nie `my_sportnet_user`. Rola správcu klubu v CRM sa preto do nášho
tokenu nedostane – treba ju čítať cez `/me/appspaces`.

**Neoverené (treba potvrdiť na živom API alebo s tímom sportnet.online):**

1. Presné hodnoty typu odborníka v `sport_expert_orgs` (pole `competence_type`, číselník
   `sport-expert-competence-type`) pre trénera, funkcionára a vedúceho družstva. issf-connector ich mapuje funkciou
   `issfProfileType2SportExpertCompetenceType`; ISSF kódy: `TRENER`, `FUNKCIONAR`, `VEDUCI-DRUZSTVA/TIMOVY-MANAZER`.
2. Názov CRM roly, ktorú issf-connector dáva klubovým manažérom (dokumentácia: „roly v CRM a Súťažiach“; CRM pozná
   `admin`, `manager`, `matrikar`).
3. Či `GET /me/appspaces` a `GET /me/sport-*` vyžadujú iný scope než `openid` (Better Auth dnes žiada len `openid`).

## Rozhodnutie (návrh)

### 1. Mapovanie sportnet.online → roly v klube

| Rola v aplikácii | Kód (`CLUB_ROLES`) | Zdroj v sportnet.online                                                                                     | Platnosť                                 |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Klubový manažér  | `club_manager`     | rola v `CRM:{clubId}` z `/me/appspaces` (ľubovoľná rola CRM v appSpace klubu)                               | kým rola v CRM trvá (`validTo` appspace) |
| Tréner           | `coach`            | `sport_expert_orgs` s `org_profile_id = clubId`, typ tréner, aktívna (`date_to` prázdne alebo v budúcnosti) | podľa `date_from`/`date_to`              |
| Tímový manažér   | `team_manager`     | `sport_expert_orgs` s typom vedúci družstva / tímový manažér, aktívna                                       | podľa `date_from`/`date_to`              |
| Hráč / hráčka    | `player`           | `sport_orgs` s `org_profile_id = clubId`, `isActive = true` (vrátane hosťovania)                            | podľa `date_from`/`date_to`              |
| Člen             | `member`           | každá iná aktívna položka `sport_expert_orgs` pre klub (funkcionár, lekár, masér, …)                        | podľa `date_from`/`date_to`              |
| Mentor zväzu     | `mentor`           | **aplikácia** (prideľuje admin SFZ) – bez zmeny                                                             | sezóna                                   |
| Admin SFZ        | `user.role`        | **aplikácia** – bez zmeny                                                                                   | –                                        |

Pravidlá:

- Hierarchia práv ostáva podľa analýzy kap. 3.1: `club_manager` ⊃ `coach` = `team_manager` ⊃ `member`; `player` = `member`.
- Dnešná rola `management` sa **premenuje** na `club_manager` (migrácia existujúcich väzieb pilotných klubov, len
  testovacie účty). Vo všetkých službách a testoch sa `management` nahradí.
- Osoba môže mať v jednom klube viac rolí naraz (ADR 0004) – každá je samostatná väzba.
- Tímový manažér: kým sportnet.online nepokryje P31, rolu môže **navyše** prideliť aj klubový manažér v aplikácii
  (zdroj `app`). Rovnako klubový manažér môže v aplikácii pridať `member` osobe bez príslušnosti (pozvánka, F7).

### 2. Schéma `club_memberships` (zmena schémy – vyžaduje súhlas)

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

### 3. Kedy sa roly obnovujú

1. **Pri každom prihlásení cez Sportnet** (hook Better Auth po prihlásení): zavolať `/me/appspaces`,
   `/me/sport-orgs`, `/me/sport-expert-orgs` access tokenom používateľa, prepočítať väzby `source: "sportnet"`
   pre aktuálnu sezónu, zapísať `syncedAt`.
2. **Na pozadí raz denne** (Vercel Cron) pre používateľov so `sportnetId`, ktorí sa dlhšie neprihlásili – cez
   verejné `GET /ppo/{clubId}/users/{userId}/sport-orgs` a `…/sport-expert-orgs` (bez tokenu; CRM rolu bez tokenu
   používateľa overiť nevieme – zostáva do ďalšieho prihlásenia).
3. **Ručne** tlačidlom „Obnoviť zo Sportnetu“ v administrácii (S3) – rovnaká služba.
4. Access token Sportnetu má 15 min, refresh 24 h: Better Auth ukladá oba v `account`; služba použije refresh,
   keď access vypršal, inak sa obnova odloží na ďalšie prihlásenie (bez chyby pre používateľa).

Používateľ prihlásený e-mailovým odkazom (bez `sportnetId`) roly zo Sportnetu nemá – môže mať len `app` väzby.

### 4. Čo sa mení v kóde (S2, po súhlase)

- `src/server/db/types.ts` – `CLUB_ROLES`, nové polia; `ARCHITECTURE.md` – index.
- `src/server/integrations/sportnet/` – klient pre `/me/appspaces`, `/me/sport-orgs`, `/me/sport-expert-orgs`
  a verejné `/ppo/{appSpace}/users/{userId}/…` (mockovaný v testoch).
- `src/server/services/club-roles-sync.service.ts` – čistá funkcia `deriveClubRoles(appspaces, sportOrgs,
sportExpertOrgs, clubIds, season)` → zoznam väzieb (testy na každý riadok tabuľky) + zápis do DB.
- `club-access.ts`, `src/lib/navigation.ts`, `club-mentoring`, `kompas`, `club-plan`, `club-settings` – nahradiť
  `management` za `club_manager`, doplniť `team_manager`, `player`, `member` podľa matice kap. 3.2.
- Administrácia: väzby zo Sportnetu len na čítanie, s označením zdroja; ručne len `mentor`, `team_manager`, `member`.
- Migrácia: `management` → `club_manager`, `source: "app"` pre existujúce väzby (skript, dry-run, so súhlasom).

## Dôsledky

- Pilotné kluby majú roly zo Sportnetu až po tom, čo sa ľudia prihlásia Sportnet účtom (S1) – dovtedy ostávajú ručné
  väzby (`source: "app"`).
- Tenant filter `clubId` (ADR 0003) sa nemení; klub = appSpace PPO, čo sedí s `org_profile_id` v Sportnete.
- Osoba s rolou vo viacerých kluboch dostane väzbu pre každý klub, ktorý je v aplikácii (`clubs`); kluby mimo pilotu
  sa ignorujú, kým S3 nenačíta kluby zo Sportnetu.
- Zoznam členov klubu (obrazovka „Klub – členovia a roly“, redesign G2) sa dá postaviť z `club_memberships`
  (`clubId, season, source`), bez živého volania Sportnetu pri každom zobrazení.
- Dáta o osobách v MongoDB sú len väzby a identifikátory (CLAUDE.md: osobné údaje živo zo Sportnetu).

## Zamietnuté alternatívy a prečo

- **Čítať roly živo zo Sportnetu pri každom požiadavku** – `/me/*` vyžaduje platný token používateľa (15 min),
  verejné `/ppo/…` endpointy nedajú CRM rolu; pri každom requeste by to bolo pomalé a závislé od dostupnosti API.
  Cache vo väzbách s `syncedAt` je jednoduchšia a vysvetliteľná.
- **Roly z `rls` claimu v ID tokene** – nesie len roly našej aplikácie (a detských), nie CRM. Dalo by sa to obísť
  registráciou našej aplikácie ako detskej aplikácie CRM v Sportnete – otázka pre tím sportnet.online (bod 8.2
  zadania), zatiaľ nepočítame s tým.
- **Register členov cez `GET /crm/{appSpace}/users` aplikačným tokenom alebo `ppoApiKey`** – vyžaduje kľúč za každý
  klub alebo `sportnet_app` token s rolou CRM pre všetky kluby; vhodné pre S3 (číselníky, synchronizácia celého klubu),
  pre roly prihláseného človeka stačí `/me/*`.
- **Odvodiť tímového manažéra z ISSF** – Sportnet P31 nezrkadlí; čakať na Sportnet by blokovalo S2. Dočasne ručne.
- **Ponechať `management` ako kód** – názov by sa rozchádzal s cieľovou rolou „Klubový manažér“ a maticou prístupov;
  premenovanie je lacné, kým sú v DB len testovacie väzby.

## Otázky pre Cyrila (a tím sportnet.online)

1. Súhlas so zmenou schémy `club_memberships` a `CLUB_ROLES` podľa časti 2 (vrátane premenovania `management`).
2. Frekvencia obnovy podľa časti 3 (pri prihlásení + denne + ručne) – stačí, alebo len pri prihlásení?
3. Má byť `club_manager` každý s ľubovoľnou CRM rolou v appSpace klubu, alebo len `admin` / `manager`?
4. Neoverené body vyššie (`competence_type`, názov CRM roly, scope) – overiť po registrácii OAuth klienta (S1) na
   Preview s Cyrilovým účtom (má CRM rolu v Nižnom Žipove?), prípadne otázka na sportnet.online.
