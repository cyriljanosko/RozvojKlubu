# Hlavička s plachtou menu, cestou a AI odpoveďami – návrh

Stav: **schválené Jánom Letkom 7. 11. 2026** s odporúčaniami pre Q1 (len plachta, bez riadku položiek) a Q2 (Správa v spodnej plachte namiesto Drawera); začína fáza 1. Q3–Q9 sú otvorené do fázy 2.
Makety (desktop + 375 px, svetlá/tmavá): `hlavicka-ai-navrh.html` vedľa tohto súboru,
zverejnené aj ako https://claude.ai/artifact/XMXgTpDWdBDx8QoLB6oY5z.

Vzor: Contineo (`~/GitHub/contineo`, `Header.tsx`, `SectionsSheet.tsx`, `Breadcrumbs.tsx`,
`HeaderAsk.tsx`, `AskSheet.tsx`, `CitationSheet.tsx`, ADR-038 MCP, `lib/aiUsage.ts`).

## 1. Hlavička, plachta menu, cesta

- **Desktop (od 768 px)**, hlavička 64 px, sticky: tlačidlo plachty (9 bodiek) · logo D + „Akadémia“ ·
  v strede pole „Opýtajte sa alebo hľadajte v Akadémii“ (⌘K) · avatar (účet, téma, odhlásenie).
  Riadok položiek NavBaru odchádza do plachty (Q1).
- **Plachta menu**: stĺpce Hlavné · Môj klub (s prepínačom klubu) · Ďalšie · Správa (len admin),
  položky z `buildNavigation()` / `clubMenu()` / `adminMenu()` podľa rolí, počty ako odznak, aktuálna sekcia
  zvýraznená. Zavrie Esc, závoj, výber, zmena stránky. Bez JS `<details>`.
- **Telefón (375 px)**: hlavička 56 px (logo, ikona otázky, avatar). TabBar ostáva, „Viac“ sa mení na „Menu“
  a otvára spodnú plachtu s tým istým obsahom (úchyt, potiahnutie nadol); bez JS odkaz na `/viac`.
  Mobilný pruh administrácie s Drawerom (G5) nahradí stĺpec Správa v plachte (Q2); desktopové bočné menu G5 ostáva.
- **Cesta (breadcrumb)**: pás pod hlavičkou na každej stránke okrem Domova, z adresy (čistá funkcia
  `breadcrumbs(pathname, names)` v `src/lib/navigation.ts`, mená klubov a oblastí dodá server). Posledný krok
  nie je odkaz. Na telefóne skrátená na „‹ rodič › aktuálna“.

## 2. Pole otázky a odpoveď

- Fokus/⌘K rozbalí pole do plachty. Pri písaní sa ukazujú výsledky dnešného `search.service` (bez AI, bez nákladov).
- Enter / „Opýtať sa“ otvorí stránku `/opytat-sa` a odpoveď sa streamuje z `POST /api/v1/ask` (otázka v tele
  požiadavky, nie v URL – nedostane sa do logov Vercelu). Bez JS padá na `/hladat?q=`.
- Rozsah ako čip: **Obsah** (každý prihlásený) · **Môj klub** (roly v klube) · **Všetky kluby** (len `admin_sfz`).
  Rozsah len zužuje, nikdy nerozširuje oprávnenia.
- Odpoveď: tón kolegu z Akadémie, značky citácií `[n]` → úryvok zo zdroja, zdroje vpravo (desktop) / pod odpoveďou
  a v spodnej plachte citácie (telefón). Keď obsah odpoveď nemá, povie to a ponúkne výsledky vyhľadávania.
  Pätička: kopírovať, palec, „Odpovedá AI z obsahu, ktorý vidíte. Over si to v zdroji.“

## 3. Architektúra

- **Poskytovateľ**: Claude API cez `@anthropic-ai/sdk` (nová závislosť – Q3), Node runtime fra1, streaming SSE.
  Model a cenník v konfigurácii (Q4). Prompt caching na system prompte a nástrojoch.
- **Retrieval**: obsah je malý (stovky textov) → `rank()` zo `search.service` nad dokumentmi, ktoré používateľ
  smie vidieť; top 8 ako `document` bloky s `citations: {enabled: true}`. Vektory / Atlas Search až pri raste
  (Contineo ich má, ale na tisícoch článkov predpisov).
- **Nástroje** `src/server/ai/tools.ts`: len na čítanie, Zod schémy, každý volá existujúcu service funkciu
  s `CurrentUser` → platia `club-access` a tenant filter `clubId` (ADR 0003). Napr. `search_content`,
  `get_club_overview`, `get_kompas_status`, `list_clubs` (admin, nad API z #158). Odkazy v odpovedi len z `href`
  nástrojov; neznáme citácie server zahodí; obsah je pre model dáta, nie pokyny.
- **`ask.service.ts`**: limity → retrieval → slučka nástrojov → stream → záznam nákladov.
- **MCP server** (fáza 4, Q9): `/api/mcp`, Streamable HTTP bez stavu, OAuth 2.1 + PKCE so Sportnet identitou
  cez Better Auth, súhlas a odvolanie v Môj účet › Pripojené aplikácie, tie isté nástroje. AI v aplikácii MCP
  nepotrebuje.

Odhad ceny otázky (~9 000 vstupných, ~700 výstupných tokenov, cenník Claude API k 6. 10. 2026):
Opus 5.5 ≈ $0,05 · Sonnet 5.5 ≈ $0,025 · Haiku 5.5 ≈ $0,001. Otázka na údaje 1,5–2×.

## 4. Náklady a audit

- Nová kolekcia **`ai_usage`** (Q-súhlas s novou kolekciou): `userId`, `at`, `channel` (app/mcp), `scope`, `model`,
  tokeny (vstup, výstup, cache read/write), `costMicroUsd` + `pricelistVersion`, počet volaní nástrojov,
  `status` (ok/refusal/error/limit), `latencyMs`. **Bez textu otázky a odpovede.** Indexy `{userId:1, at:-1}`,
  TTL na `at` (25 mesiacov). Záznam aj pri chybe.
- Limity: denne na človeka, mesačný strop aplikácie → potom len vyhľadávanie (Q5).
- Správa › AI a náklady: súčty za obdobie, po dňoch, po používateľoch; `GET /api/v1/admin/ai-usage`.
- Audit log (po zlúčení #160, ADR 0034): akcia `ai.data_read` (AI čítala údaje klubu: `clubId`, nástroj, rozsah);
  pri MCP `mcp.client_authorized` / `mcp.client_revoked`.

## 5. ADR a fázy

| ADR  | Názov                              | Fáza |
| ---- | ---------------------------------- | ---- |
| 0035 | Hlavička s plachtou menu a cestou  | 1    |
| 0036 | AI odpovede z obsahu a údajov      | 2–3  |
| 0037 | Záznam nákladov na AI (`ai_usage`) | 2    |
| 0038 | MCP server Akadémie                | 4    |

Fázy: (1) hlavička, plachta, cesta, pole s okamžitým vyhľadávaním – bez AI a bez novej závislosti; komponenty
v `src/components/sfz`, potom PR do `Slovensky-futbalovy-zvaz/sfz-design-system` (MenuSheet, BottomSheet,
Breadcrumbs, AskField, Answer/Citation/SourceCard). (2) AI z obsahu + náklady. (3) AI z údajov + audit.
(4) MCP. Čísla ADR platia, ak medzitým nepribudne iné (0031–0034 sú v otvorených PR).

## 6. Otázky na rozhodnutie

1. Zrušiť riadok položiek na desktope a nechať len plachtu (odporúčam), alebo nechať 4 hlavné položky?
2. Administrácia na telefóne: nahradiť pruh s Drawerom (G5) stĺpcom Správa v spodnej plachte?
3. Súhlas so závislosťou `@anthropic-ai/sdk` a kľúčom `ANTHROPIC_API_KEY`; kto zakladá účet a platí (SFZ / LTK)?
4. Model: Opus 5.5 (predvolený), alebo Sonnet 5.5?
5. Limity: otázok denne na človeka, mesačný strop?
6. AI len pre prihlásených (odporúčam), alebo aj verejne s prísnym limitom?
7. Osobné údaje klubov u poskytovateľa: DPA a vyjadrenie zodpovednej osoby; dovtedy fáza 3 bez mien osôb?
8. Neukladať text otázok (odporúčam), alebo história „Moje otázky“ na 30 dní len pre autora?
9. MCP server teraz ako fáza 4, alebo odložiť do konkrétneho klienta?
