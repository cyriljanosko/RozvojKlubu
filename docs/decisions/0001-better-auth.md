# 0001 – Knižnica na prihlasovanie: Better Auth

- Stav: prijaté
- Dátum: 2026-10-15
- Rozhodol: Cyril Janoško

## Kontext

Aplikácia potrebuje prihlasovanie, roly, neskôr API kľúče, JWT pre externé služby a OAuth pre budúci MCP server.
Pôvodný plán počítal s Auth.js v5, ktorý je stále iba v beta verzii (`5.0.0-beta.32`).

## Rozhodnutie

Použijeme **Better Auth** (stabilná verzia 1.7) s MongoDB adaptérom nad oficiálnym driverom `mongodb`.

## Dôvody

- Stabilná verzia, podpora Next.js 16 a MongoDB driveru 7.
- Hotové pluginy: magic link, admin/roly, API kľúče, JWT (JWKS), generic OAuth/OIDC, OAuth pre MCP.
- Poskytovatelia Microsoft Entra ID (s `tenantId`), Google, Apple a ďalší.
- Menej vlastného bezpečnostne citlivého kódu.

## Dôsledky

- Nová závislosť `better-auth`.
- Better Auth si v MongoDB vytvorí vlastné kolekcie (`user`, `session`, `account`, `verification`, neskôr `jwks`, `apikey`).
- Predvolený stack (Next.js + MongoDB driver + Vercel + Vitest) sa nemení.

## Zvážené alternatívy

- Auth.js v5 – beta, API kľúče a MCP OAuth by sme museli robiť sami.
- Vlastná implementácia nad `mongodb` – najmenej závislostí, ale najviac bezpečnostne citlivého kódu na údržbu.
