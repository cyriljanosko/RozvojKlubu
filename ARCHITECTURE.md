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

- Rola je pole `user.role` (6 rolí v `src/server/auth/roles.ts`), predvolená `public`.
- Prví administrátori: `INITIAL_ADMIN_EMAILS` pri vytvorení účtu.
- API kontroluje rolu v service vrstve (`requireUser`, `requireRole`).
- Tenant = klub (ADR 0003) – uplatní sa s prvými klubovými dátami (F3).

## Hranice systému

- **Sportnet** je zdroj pravdy pre kluby a osoby (čítanie živo, F2) a hlavný poskytovateľ identity.
- **MongoDB** drží len dáta aplikácie.
- **Ecomail** len odosiela transakčné e-maily, nič neukladáme.

## Kolekcie a indexy (MongoDB `rozvojklubu_dev`)

| Kolekcia       | Vlastník    | Poznámka                                        |
| -------------- | ----------- | ----------------------------------------------- |
| `user`         | Better Auth | + polia `role`, `sportnetId`                    |
| `session`      | Better Auth | relácie                                         |
| `account`      | Better Auth | prepojenia na poskytovateľov (Sportnet, e-mail) |
| `verification` | Better Auth | tokeny magic linku                              |

Vlastné indexy: zatiaľ žiadne. Kolekcie vzniknú pri prvom prihlásení (vyžaduje súhlas – zmena schémy).
