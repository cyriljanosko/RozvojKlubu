# Changelog

Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Unreleased]

### Pridané

- Projektové súbory: `CLAUDE.md`, `NEXT.md`, `CHANGELOG.md`, devlog a rozhodnutia (ADR 0001 Better Auth, ADR 0002 Sportnet OIDC).

## [0.1.0] – 2026-10-12

### Pridané

- Kostra aplikácie: Next.js 16, TypeScript, Tailwind 4, základ shadcn/ui.
- API vrstva s jednotným formátom odpovedí a endpoint `/api/v1/health` (stav aplikácie a databázy).
- Pripojenie k MongoDB Atlas, validované premenné prostredia, základ klienta Sportnet.
- CI na GitHube (formát, lint, typy, testy, build), Dependabot, CODEOWNERS, šablóna PR.
- Nasadenie na Vercel (fra1) s doménou rozvojklubu.ltk.solutions.
