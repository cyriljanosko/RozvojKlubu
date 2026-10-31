# 0023 – Novinky: príbehy klubov, odporúčania a novinky Akadémie

- Stav: prijaté 31. 10. 2026 vrátane novej kolekcie `news_posts` (úložisko súborov sa rozhodne spolu s knižnicou, ADR 0022)
- Dátum: 2026-10-31
- Rozhodol: Cyril Janoško
- Návrh obrazoviek: plátno redizajnu, riadok „ZK – Novinky“ (https://claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb),
  schválený Cyrilom 31. 10. 2026 okrem úložiska.

## Kontext

V `NEXT.md` je bod ZK – priestor, kde kluby zdieľajú skúsenosti s inými klubmi a SFZ oznamuje novinky
Akadémie. Cyril 30. – 31. 10. 2026 zadal:

- sekcia sa volá **Novinky**, pod nadpisom filter Všetko · Príbehy klubov · Odporúčania · Novinky Akadémie,
- píšu **SFZ aj kluby** – klub navrhne, SFZ schváli,
- príspevok môže mať **fotky aj dokumenty**,
- príspevky sa majú dať **publikovať aj mimo Akadémie** (web SFZ, sociálne siete),
- model prístupov navrhuje Claude (tento ADR).

## Rozhodnutie

1. **Typy príspevku** (`kind`): `story` (príbeh klubu), `tip` (odporúčanie), `academy` (novinka Akadémie).
   `story` a `tip` navrhuje klub, `academy` píše len SFZ.
2. **Nová kolekcia `news_posts`**:
   `kind`, `clubId` (Sportnet ID klubu; pri `academy` chýba), `title`, `slug`, `areas` (0 – 3 čísla oblastí 1–11),
   `sections` (štruktúrovaný text: S čím sme začínali, Čo sme urobili, Výsledok, Čo by sme odporučili; pri
   `academy` voľný text), `photos` (najviac 10: `key`, `caption`, `width`, `height`; prvá je titulná),
   `documents` (`name`, `mime`, `size`, `key`, `access`: `public` | `signedIn`), `consents` (pozri bod 5),
   `status`, `reviewNote`, `pinned`, `externalUrl` (článok na futbalsfz.sk), `commsSharedAt/By`,
   `views`, `submittedAt/By`, `publishedAt/By`, `createdAt/By`, `updatedAt/By`.
   Zmeny textu po odoslaní sa ukladajú do revízií ako pri Metodike a Praxi.
3. **Tenant (ADR 0003)**: rozpracované, odoslané a vrátené príspevky klubu sú dáta klubu – každý dotaz
   v časti klubu má filter `clubId`. Zverejnený príspevok je spoločný obsah a číta sa bez filtra klubu
   (len `status: published`).
4. **Stavy** (`status`): `draft` (koncept) → `submitted` (na schválení) → `published` (zverejnené),
   alebo `submitted` → `returned` (vrátené klubu s povinnou poznámkou) → znova `submitted`.
   `hidden` = stiahnuté zo zverejnenia (napr. klub odvolá súhlas). Ak SFZ pri schvaľovaní upraví text
   klubu, príspevok ide klubu na odsúhlasenie konečnej verzie (`returned` s poznámkou „upravené SFZ“)
   a zverejní sa až po jeho potvrdení. Lehota na posúdenie: 10 pracovných dní (cieľ, nie kontrola
   v aplikácii).
5. **Súhlasy klubu** (`consents`, každý s `at` a `by`): povinné – zverejnenie v Akadémii a vyhlásenie,
   že klub má súhlas ľudí na fotkách (za deti zákonný zástupca); nepovinné – zdieľanie mimo Akadémie
   (futbalsfz.sk, sociálne siete SFZ). Súhlasy ľudí na fotkách uchováva klub, aplikácia ukladá len
   vyhlásenie klubu.
6. **Oprávnenia** (vyhodnocuje service vrstva):
   - **čítanie**: zverejnené príspevky verejne aj bez prihlásenia; dokument `signedIn` len prihlásený
     (neprihlásený vidí názov so zámkom),
   - **návrh, úprava konceptu, odoslanie, odsúhlasenie úprav SFZ**: vedenie klubu (manažér, výbor,
     štatutár – ADR 0004/0021) za svoj klub,
   - **mentor**: vidí stav návrhov svojich klubov, nepíše,
   - **admin SFZ**: píše novinky Akadémie, schvaľuje, upravuje, vracia, zverejňuje, pripína, skrýva,
     posiela komunikácii SFZ.
7. **Súbory**: fotky a dokumenty sú v tom istom úložisku ako knižnica (ADR 0022) za rozhraním úložiska;
   nič nemá verejnú adresu. Fotky sa po nahratí zmenšia, prevedú (HEIC → JPG) a odstránia sa z nich
   metadáta vrátane polohy. Dokumenty sa sťahujú cez API, ktoré overí `access`. Povolené formáty
   a limity veľkosti preberáme z ADR 0022; fotky JPG, PNG, HEIC do 10 MB.
8. **Zverejnenie mimo Akadémie**:
   - **zdieľanie odkazom** (kopírovať, Facebook, WhatsApp, e-mail) – stránka príspevku má Open Graph
     (titulná fotka, názov, prvá veta),
   - **balík pre komunikáciu SFZ** – len pri súhlase klubu; admin ho v administrácii pripraví (text,
     fotky s popismi, odkaz) a odovzdá komunikácii SFZ, aplikácia zapíše `commsSharedAt/By`; článok
     uverejní redakcia SFZ a admin vloží jeho adresu do `externalUrl` – príspevok potom ukazuje
     „Uverejnené aj na futbalsfz.sk“,
   - **RSS kanál** zverejnených príspevkov – neskôr, ak si ho web SFZ bude chcieť preberať sám.
9. **Zobrazenie** (podľa plátna): `/novinky` (filter typu a oblasti, pripnutý príspevok, zoznam),
   `/novinky/{slug}` (detail), blok na úvode Akadémie (3 najnovšie), „Ako to robia iné kluby“ v detaile
   oblasti, dlaždica v Moja Akadémia (príspevky k najslabšej oblasti Kompasu a k cieľom plánu, stav
   vlastného návrhu), „Navrhnúť príbeh“ v časti klubu, Administrácia → Novinky.
10. **API**: `/api/v1/news` (zoznam a detail zverejnených), `/api/v1/clubs/{clubId}/news` (návrhy klubu),
    `/api/v1/admin/news` (schvaľovanie); doménová logika v `news.service.ts`.

## Dôsledky

- Nová kolekcia `news_posts` a indexy (`status` + `publishedAt`, `clubId` + `status`, `areas`, jedinečný
  `slug`) – zmena schémy, potrebný súhlas Cyrila; indexy sa zapíšu do `ARCHITECTURE.md`.
- Implementácia súborov čaká na rozhodnutie o úložisku (ADR 0022); bez neho sa dá urobiť text,
  schvaľovanie a zobrazenie a fotky doplniť v ďalšom PR.
- Nahrávať budú aj kluby, nielen admin SFZ – ADR 0022 tento prípad vylučoval z antivírusovej kontroly.
  Pred spustením nahrávania klubmi treba rozhodnúť kontrolu súborov (aspoň typ podľa obsahu, nie podľa
  koncovky; dokumenty klubu sa zverejnia až po schválení adminom).
- Spracovanie fotiek (zmenšenie, HEIC, metadáta) môže vyžadovať novú závislosť – so súhlasom.
- E-maily klubu pri vrátení a zverejnení cez existujúce odosielanie (Ecomail) – texty v `messages/sk.json`.
- Preview zdieľa databázu s produkciou (CLAUDE.md, časť 7) – skúšobné návrhy na Preview sú v ostrých
  dátach; skúšať opatrne alebo až s vlastnou databázou Preview.
- Kto v komunikácii SFZ balíky preberá, dohodne Cyril; do dohody sa balík len pripraví na stiahnutie.

## Zamietnuté alternatívy a prečo

- **Názov „Zo života klubov“** – Cyril 31. 10.: „Novinky“ je kratšie a zrozumiteľné, rozlíšenie robí filter.
- **Zverejnenie bez schválenia SFZ** – riziko nevhodného obsahu a fotiek detí bez súhlasu.
- **Návrhy od každého člena klubu** – za obsah zodpovedá klub; navrhuje vedenie, ostatní mu môžu príbeh
  poslať mimo aplikácie.
- **Komentáre a chat pri príspevkoch** – zadanie ZK je bez chatu; moderovanie by bolo ďalšou prácou.
- **Automatické zverejnenie na futbalsfz.sk** – web SFZ nemá rozhranie na príjem článkov a redakcia
  chce text pred uverejnením upraviť; balík + `externalUrl` je bez integrácie, RSS sa dá doplniť.
- **Príspevky ako sekcie Metodiky** – Metodika je stály obsah oblasti s revíziami SFZ; príspevky majú
  autora (klub), schvaľovanie a dátum, preto vlastná kolekcia.
- **Fotky v MongoDB (GridFS)** – rovnako ako pri knižnici, Atlas M0 má 512 MB.
