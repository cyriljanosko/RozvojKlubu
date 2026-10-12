# Rozvoj klubu – Akadémia vzdelávania

Web aplikácia Slovenského futbalového zväzu pre vzdelávanie a rozvoj futbalových klubov.

- **Produkcia:** https://rozvojklubu.ltk.solutions (zatiaľ nenasadené)
- **Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · MongoDB Atlas · Vercel
- **Moduly MVP:** vizitka klubu a mapa · akadémia vzdelávania · dashboard osoby · 10 oblastí rozvoja a licencie

## Architektúra (API-first)

```
UI (Next.js stránky)  ─┐
Externí klienti       ─┼─> /api/v1/*   REST, Zod validácia, jednotný formát odpovede
MCP server (neskôr)   ─┘        │
                                v
                 src/server/services   doménová logika, oprávnenia
                     │                        │
         src/server/db (MongoDB)   src/server/integrations (Sportnet API)
```

Pravidlá:

1. Doménová logika patrí len do `src/server/services`. Route handlery a stránky ju iba volajú.
2. Každý endpoint je v `src/app/api/v1/**/route.ts`, obalený `apiHandler` a vstupy validuje Zod.
3. Odpovede: `{ data, meta? }` alebo `{ error: { code, message, details? } }`.
4. Kód v `src/server` je len serverový (`import "server-only"`), tajomstvá nikdy neidú do klienta.
5. Dáta o kluboch a osobách sa čítajú živo zo Sportnetu (s cache). V MongoDB sú len dáta aplikácie.

### Štruktúra

```
src/
  app/                 stránky a route handlery (api/v1/*)
  components/ui/       shadcn/ui komponenty
  lib/                 zdieľané utility (klient aj server)
  server/
    api/               HTTP vrstva: chyby, envelope, apiHandler
    db/                MongoDB klient
    integrations/      externé systémy (Sportnet)
    services/          doménová logika (testovateľná, bez HTTP)
    env.ts             validované premenné prostredia
test/                  pomocné súbory pre testy
```

## Lokálny vývoj

Požiadavky: Node.js 22+ (pozri `.nvmrc`), npm.

```bash
npm install
cp .env.example .env.local   # doplň hodnoty
npm run dev                  # http://localhost:3000
```

Kontrola stavu API: http://localhost:3000/api/v1/health

| Príkaz              | Popis               |
| ------------------- | ------------------- |
| `npm run dev`       | vývojový server     |
| `npm run build`     | produkčný build     |
| `npm run lint`      | ESLint              |
| `npm run typecheck` | kontrola typov      |
| `npm test`          | unit testy (Vitest) |
| `npm run format`    | Prettier            |

Nový shadcn/ui komponent: `npx shadcn@latest add <komponent>`.

## Nasadenie

- Každý pull request dostane preview deploy na Verceli.
- Merge do `main` nasadí produkciu.
- Premenné prostredia sa nastavujú vo Vercel (Production / Preview / Development), nikdy v repozitári.

## Fázy projektu

| Fáza | Obsah                                                               |
| ---- | ------------------------------------------------------------------- |
| F0   | Príprava: prístupy, GDPR, backlog                                   |
| F1   | Základ: kostra, CI, Vercel + doména, Atlas, prihlásenie + roly, API |
| F2   | Integrácia Sportnet API                                             |
| F3   | MVP moduly                                                          |
| F4   | Kvalita, bezpečnosť, pilot ObFZ Trebišov                            |
| F5   | MCP server                                                          |

Postup práce je v [CONTRIBUTING.md](CONTRIBUTING.md).
