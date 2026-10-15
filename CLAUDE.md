# CLAUDE.md – pravidlá a konvencie repozitára

Tento súbor čítajú AI asistenti (Claude) aj ľudia pred prácou v repozitári.

## Projekt

Web aplikácia SFZ „Rozvoj klubu – Akadémia vzdelávania“ na https://rozvojklubu.ltk.solutions.
Plán a fázy: `README.md`, aktuálne úlohy: `NEXT.md`, rozhodnutia: `docs/decisions/`.

## Spolupráca

- Komunikácia so zadávateľom po slovensky.
- Pred začatím úlohy doplňujúce otázky; väčšia zmena = najprv plán (kroky, dotknuté súbory, riziká) a schválenie.
- Nemeniť nič mimo dohodnutého rozsahu (žiadne drive-by refaktoringy).
- Bez výslovného súhlasu nikdy: mazanie/presun/premenovanie súborov, zmeny schém a kolekcií v DB,
  zásahy do `.env*`, zmeny CI a produkčných nastavení, `force push`, rebase zdieľanej vetvy, mazanie vetvy.
- Žiadne tajomstvá v repozitári, dokumentácii ani devlogu. Tokeny, e-maily a ID maskovať.
- Pri rozpore dokumentácie a kódu platí kód a `git log`.

## Stack

- Next.js 16 (App Router, TypeScript), Node.js 22+
- Tailwind CSS 4 + shadcn/ui (`components.json`)
- MongoDB Atlas cez oficiálny driver `mongodb`
- Prihlasovanie: Better Auth (ADR 0001), primárne cez Sportnet OIDC (ADR 0002)
- Hosting: Vercel (región fra1), DB: Atlas EU_CENTRAL_1
- Testy: Vitest

Next.js 16 má zmeny oproti starším verziám – pred písaním kódu pozri `node_modules/next/dist/docs/` (viď `AGENTS.md`).

## Architektúra (API-first)

- Doménová logika len v `src/server/services`; route handlery a stránky ju iba volajú.
- Endpointy v `src/app/api/v1/**/route.ts`, obalené `apiHandler`, vstupy validuje Zod.
- Odpovede: `{ data, meta? }` alebo `{ error: { code, message, details? } }`.
- Kód v `src/server` je len serverový (`import "server-only"`).
- Dáta o kluboch a osobách sa čítajú živo zo Sportnetu; v MongoDB sú len dáta aplikácie.

## Rozhranie

- Mobile first je povinnosť – každé rozhranie navrhnúť a overiť najprv na šírke ~375 px.
- Texty v UI po slovensky.

## Konvencie

- Kód, názvy, komentáre a commity v angličtine; dokumentácia po slovensky.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` …), vetvy `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Zmeny cez pull request do `main`, squash merge.

## Definition of Done

1. Kód beží; `npm run format:check`, `lint`, `typecheck`, `test`, `build` prejdú.
2. Rozhranie overené mobile-first.
3. Aktualizovaný `NEXT.md`, `CHANGELOG.md` a devlog (`docs/devlog/RRRR-MM.md`).
4. Commit podľa konvencie.

## Rituály

- **Zorientuj sa** – prečítaj `CLAUDE.md`, `NEXT.md`, `git log -20`, aktuálnu vetvu; zhrň stav (max. 10 riadkov) a navrhni ďalší krok.
- **Poupratuj** – devlog → prečistiť `NEXT.md` proti `git log` → `CHANGELOG.md` → TODO/FIXME → lint a formát → commit.
- **Odovzdaj** – handover: čo je rozrobené a kde, čo treba vedieť, čo nefungovalo a prečo.
- **Rozhodni** – z diskusie ADR do `docs/decisions/NNNN-nazov.md`.
