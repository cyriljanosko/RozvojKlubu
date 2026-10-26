# CLAUDE.md — Rozvoj klubu (Akadémia vzdelávania SFZ)

> Konvencie tohto repozitára. Globálne pravidlá (jazyk, plánovanie, zákaz mazania, rituály) sú v Instructions for Claude a tu sa neopakujú.

## 1. Čo to je a ako to rozbehať

- Web aplikácia SFZ na vzdelávanie a rozvoj futbalových klubov: https://rozvojklubu.ltk.solutions
- Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4 + shadcn/ui, MongoDB Atlas (oficiálny driver `mongodb`), Better Auth, next-intl, Vercel (fra1), Vitest
- Štruktúra: jedna aplikácia, API-first – pozri `ARCHITECTURE.md`
- Lokálny beh: `npm install && npm run dev` → http://localhost:3000 (stav: `/api/v1/health`)
- Premenné prostredia: všetky kľúče sú v `.env.example` (bez hodnôt). Nové kľúče vždy doplň aj tam.
- Next.js 16 sa líši od starších verzií – pred písaním kódu pozri `node_modules/next/dist/docs/` (viď `AGENTS.md`).

## 2. Kánon súborov

| Súbor                          | Na čo je                                 |
| ------------------------------ | ---------------------------------------- |
| `README.md`                    | Čo to je + rozbehanie do 5 minút         |
| `CLAUDE.md`                    | Konvencie repa (tento súbor)             |
| `ARCHITECTURE.md`              | Moduly, dátové toky, hranice systému     |
| `docs/decisions/NNNN-nazov.md` | ADR — jedno rozhodnutie = jeden súbor    |
| `NEXT.md`                      | Otvorené veci a ďalšie kroky             |
| `devlog/YYYY-MM-DD.md`         | Denný zápis priebehu prác                |
| `CHANGELOG.md`                 | Keep a Changelog + SemVer                |
| `RUNBOOK.md`                   | Deploy, rollback, čo robiť keď to spadne |
| `.env.example`                 | Kľúče bez hodnôt                         |
| `messages/sk.json`             | Texty pre používateľa (i18n, slovenčina) |

Zdroj pravdy pri rozpore: **kód → git log → ADR → NEXT.md → devlog** (vyhráva ľavá strana).

## 3. Git

- Vetvy: `feat/<popis>`, `fix/<popis>`, `chore/<popis>`, `docs/<popis>`. Do `main` sa nepushuje priamo, pokiaľ si to Cyril výslovne neželá.
- `main` je vždy nasaditeľný.
- Každá zmena ide cez PR (squash merge) priamo do `main`, bez reťazí PR. PR zlučuje Cyril, alebo Claude **len na jeho výslovný pokyn** pre konkrétny PR – PR aj tak vzniká, lebo nesie odôvodnenie zmeny. Po zlúčení sa stav overí cez GitHub API.
- Conventional Commits v angličtine: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Jeden commit = jedna logická zmena.
- Popis PR odpovedá na **prečo**, nie na čo. Odkaz na issue alebo ADR.
- Zakázané bez súhlasu: `force push`, rebase zdieľanej vetvy, mazanie vetvy.
- **Dve sessions v jednom repozitári = dve vetvy.** Nikdy dve na `main` ani na jednej spoločnej.
- Súbory do commitu sa pridávajú **menovite**, nie `git add -A`. Cudzí `M` v `git status` = niekto ďalší pracuje → vlastná vetva, nepribaľovať.
- Claude pushuje **vlastné** vetvy a otvára PR (cez `gh` účtom Cyrila, rozhodnutie 16. 10. 2026). Do `main` nepushuje nikdy.

## 4. Devlog

Jeden súbor na deň: `devlog/YYYY-MM-DD.md`, sekcie **Spravené / Rozhodnuté / Nefungovalo / zamietnuté / Zostáva**.
Sekcia „Nefungovalo“ je povinná, keď sa niečo zamietlo – z git logu sa to nedá vyčítať.

## 5. ADR (`docs/decisions/`)

- Názov `NNNN-nazov.md`, číslovanie priebežné, nikdy sa nerecykluje.
- Kostra: **Kontext → Rozhodnutie → Dôsledky → Zamietnuté alternatívy a prečo**.
- ADR sa needituje. Zmena rozhodnutia = nové ADR s riadkom `Nahrádza: NNNN`, v starom sa doplní `Nahradené: NNNN`.

## 6. Konvencie kódu

- Identifikátory (súbory, funkcie, typy, premenné, komponenty, DB kolekcie a polia, npm skripty, URL query kľúče) sú **anglicky**.
- **Komentáre v kóde sú anglicky** (výnimka oproti šablóne – rozhodnutie Cyrila 12. 10. 2026, potvrdené 15. 10. 2026). Dokumentácia je slovensky.
- Každý text pre používateľa ide cez **next-intl** (`messages/sk.json`, `useTranslations` / `getTranslations`). Nič natvrdo v komponentoch.
  Zatiaľ len slovenčina; CS/EN pribudnú ako `messages/cs.json` a `messages/en.json`, chýbajúci kľúč padá na slovenčinu (`src/i18n/config.ts`), nikdy na kľúč.
- Chybové hlášky API (`error.message`) sú anglické a určené vývojárom; UI prekladá podľa `error.code`.
- Rozhranie: mobile-first, overené na šírke ~375 px pred označením za hotové.
- URL stránok sú slovenské (`/prihlasenie`, `/ucet`), URL API anglické (`/api/v1/...`).

## 7. Stack — konvencie

### Architektúra (API-first)

- Doménová logika len v `src/server/services`; route handlery, stránky aj Server Actions ju iba volajú.
- Verejné a strojové rozhranie: `src/app/api/v1/**/route.ts`, obalené `apiHandler`, vstupy validuje Zod, odpovede `{ data, meta? }` / `{ error: { code, message, details? } }`. Rovnakú service vrstvu použije budúci MCP server.
- Server Action je povolená na mutácie z formulárov, ale len ako tenká vrstva nad service.
- Kód v `src/server` je len serverový (`import "server-only"`).

### Next.js (App Router)

- Server Components sú default. `"use client"` len tam, kde je naozaj potrebná interaktivita, a čo najnižšie v strome.
- Dáta sa načítavajú v serverovej vrstve, nie cez `useEffect` + `fetch`.
- `next/image` povinne. Dizajn (farby, písmo, tmavá téma, logá) vychádza z balíka `@slovensky-futbalovy-zvaz/design-system` (ADR 0016): farby len cez tokeny, písmo SF Pro z tokenov (žiadne webfonty, bez Google Fonts).
- Zapnuté `cacheComponents`: dynamické časti (session, `headers()`) patria do `<Suspense>`. Cachovanie sa nastavuje vedome; zmena cache stratégie patrí do devlogu.
- Žiadne `any` v props a v návratových typoch API.

### MongoDB Atlas (oficiálny `mongodb` driver, bez ODM)

- Jeden klient cachovaný na `globalThis` (`src/server/db/mongo.ts`), pripája sa lenivo.
- Kolekcie Better Auth (`user`, `session`, `account`, `verification`) spravuje Better Auth – nečítať/nezapisovať ich priamo, len cez jeho API / `internalAdapter`.
- Typy vlastných kolekcií budú ručne v `src/server/db/types.ts`, cez `db.collection<T>("name")`.
- **Tenant = klub** (ADR 0003): každý dotaz na dáta klubu obsahuje filter `clubId` (Sportnet ID klubu), bez výnimky, aj pri administrátorských operáciách. ObFZ/admin pracujú s explicitným zoznamom klubov. Spoločný obsah (kurzy, metodika) je globálny.
- Zoskupovanie a spájanie agregačnou pipeline, nie slučkou v Node.
- `_id` je `ObjectId` interne, na string sa konvertuje až na hranici API.
- Nový index sa zakladá vedome a zapisuje do `ARCHITECTURE.md`; nový dotaz nad veľkou kolekciou sa overí cez `explain`.
- Dáta o kluboch a osobách sa čítajú živo zo Sportnetu; v MongoDB sú len dáta aplikácie.

### Vercel

- Prostredia: **Production** (`main`) + **Preview** (každý PR), región funkcií fra1.
- Env premenné len cez Vercel dashboard a `.env.example`. Nikdy hodnoty v kóde.
- **Odchýlka od šablóny:** Preview zatiaľ zdieľa databázu `rozvojklubu_dev` s produkciou (rozhodnutie 15. 10. 2026). Pred prvými ostrými dátami musí mať Preview vlastnú databázu (viď `NEXT.md`).
- Runtime `nodejs` (MongoDB driver); edge len tam, kde netreba DB.
- Build nastavenia a limity sú v `RUNBOOK.md`.

### Vitest

- Testy sú `*.test.ts` vedľa testovaného súboru.
- Povinne pokryté: čisté funkcie (oprávnenia, tenant filtre, parsovanie), API route handlery aspoň happy path + kontrola autorizácie (a tenanta).
- **Každý opravený bug dostane test, ktorý ho reprodukuje.** Najprv padajúci test, potom oprava.
- Testy nikdy nebežia proti živej databáze – mock alebo dedikovaná testovacia DB.
- `npm run test` musí prejsť pred commitom.

## 8. Čo nesmieš bez výslovného súhlasu

- DB migrácie a zmeny schém (vrátane nových kolekcií)
- Zásahy do `.env*` (okrem šablóny `.env.example`), CI, deployment a produkčných nastavení
- Mazanie, prepis, presun a premenovanie súborov
- Inštalácia nových závislostí
- Zmeny mimo dohodnutého rozsahu úlohy

## 9. Definition of Done

`format:check`, lint, `typecheck`, `npm run test` a `build` prejdú → oprava bugu má reprodukujúci test → rozhranie overené mobile-first → texty cez i18n (zatiaľ SK) → aktualizovaný `NEXT.md`, `CHANGELOG.md` a devlog → commit podľa konvencie → PR s odôvodnením a funkčným preview deploymentom.

## 10. Špecifiká prostredia

- Lokálna kópia: MacBook `~/Developer/rozvojklubu` (mimo OneDrive/Synology).
- Od 15. 10. 2026 Claude pracuje priamo v lokálnej kópii na Macu (Claude Code); `gh` je prihlásený, DB `rozvojklubu_dev` dostupná cez `.env.local`.
- Atlas: projekt RozvojKlubu, cluster `rozvojklubu-dev` (M0, Frankfurt), DB `rozvojklubu_dev`.
- Vercel: projekt `rozvojklubu` (tím cyro5); konektor Vercel nevie čítať logy, env premenné ani meniť domény.
- Prihlásenie: Sportnet OIDC (`auth.sportnet.online`) – hlavné, e-mailový odkaz cez Ecomail – doplnok.
