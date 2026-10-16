# Changelog

Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Unreleased]

### Pridané

- Prihlasovanie cez Better Auth: e-mailový odkaz (Ecomail, v dev režime do logu), príprava na Sportnet OIDC (zapne sa po doplnení client_id/secret).
- Roly (admin SFZ, ObFZ/RFZ, manažér klubu, mentor, dobrovoľník, verejnosť); prví admini cez `INITIAL_ADMIN_EMAILS`.
- API `GET /api/v1/me` a `PATCH /api/v1/users/:id/role` (len admin SFZ, ochrana proti odobratiu vlastnej roly admina).
- Stránky `/prihlasenie` a `/ucet` (mobile-first), hlavička so stavom prihlásenia.
- i18n cez next-intl: všetky texty pre používateľa v `messages/sk.json` (fallback na slovenčinu).
- `ARCHITECTURE.md`, `RUNBOOK.md`, ADR 0003 (tenant = klub); `CLAUDE.md` podľa šablóny konvencií; devlog po dňoch v `devlog/`.
- Testy route handlerov `/api/v1/me` a `/api/v1/users/:id/role` a reprodukčné testy k opraveným bugom.
- Projektové súbory: `CLAUDE.md`, `NEXT.md`, `CHANGELOG.md`, devlog a rozhodnutia (ADR 0001 Better Auth, ADR 0002 Sportnet OIDC).

### Opravené

- Prázdne hodnoty v `.env` (`KEY=`) sa berú ako nenastavené (predtým zlyhala validácia).
- MongoDB klient si nepamätá neúspešný prvý pokus o pripojenie; health endpoint loguje dôvod chyby DB.

## [0.1.0] – 2026-10-12

### Pridané

- Kostra aplikácie: Next.js 16, TypeScript, Tailwind 4, základ shadcn/ui.
- API vrstva s jednotným formátom odpovedí a endpoint `/api/v1/health` (stav aplikácie a databázy).
- Pripojenie k MongoDB Atlas, validované premenné prostredia, základ klienta Sportnet.
- CI na GitHube (formát, lint, typy, testy, build), Dependabot, CODEOWNERS, šablóna PR.
- Nasadenie na Vercel (fra1) s doménou rozvojklubu.ltk.solutions.
