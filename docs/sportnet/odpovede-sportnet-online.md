# Rozvoj klubu × sportnet.online – stav a odpovede

> Odpoveď vývojárov sportnet.online na `otazky-sportnet-online.md` (A1–A10, B1–B9), doručená 4. 11. 2026,
> zapísaná 5. 11. 2026 (Ján). Časti 0–5 sú ich text bez zmeny obsahu. Časť 6 je naša analýza dopadov.

Stav k 4. 11. 2026. Odpovede na otázky A1–A10 (OAuth klient) a B1–B9 (dáta o osobách v kluboch) sú
zistené priamo z kódu auth.sportnet.online, CoreApi a ISSF konektora.

## V skratke

- **Klient `rozvojklubu` je založený** na auth.sportnet.online, ako ste žiadali. Je to verejný
  klient s PKCE, **secret nepotrebujete** keďže nebudete používať client credentials, ale exchange token flow.
- **Prihlásenie** je štandardný OAuth2 Authorization Code + PKCE. OIDC discovery ani userinfo však
  nie sú, Better Auth treba nastaviť ručne (časť 1).
- **K CRM a Súťažiam nepristupujete aplikačným tokenom** (`client_credentials`). Aplikačný token
  nevieme obmedziť na konkrétne kluby, čítal by údaje všetkých klubov. Namiesto toho si vymeníte
  token prihláseného používateľa za jeho token pre CRM alebo Súťaže (**token exchange**, RFC 8693,
  časť 2). Je to nasadené a pre `rozvojklubu` povolené.
- **K endpointom, ktoré vyžadujú vymenený token, sa dostane len používateľ s oprávnením pre danú
  aplikáciu (CRM, Súťaže) a daný klub.** Oprávnenia sa prideľujú v Sportnet admine, nie vo vašej
  aplikácii.

## Na čo si dať pozor

1. **Žiadny OIDC discovery ani userinfo.** Existuje len JWKS na `/.well-known/jwks.json`. V Better
   Auth nepoužívajte `discoveryUrl` (detail v časti 1).
2. **ID token nemá `nonce` ani `picture`** a `email` v ňom nie je garantovaný.
3. **`allowed_hosts` nepozná wildcardy.** Host musí sedieť presne (A3).
4. **Scope sa nevaliduje a refresh token príde vždy.** `offline_access` netreba.
5. **Filter na `GET /ppo/{appSpace}/users` je `competenceType`** (jednotné číslo, viac hodnôt cez
   čiarku). `competenceTypes` sa ticho ignoruje. Filter funguje len s
   `affiliationCategory=sport_expert_orgs` a bez `autocomplete`.

## 1. Prihlásenie a OAuth klient (A1–A8)

Nastavenie Better Auth `genericOAuth`:

```ts
{
  providerId: 'sportnet',
  clientId: 'rozvojklubu',
  authorizationUrl: 'https://auth.sportnet.online/authorize',
  tokenUrl: 'https://auth.sportnet.online/token',
  pkce: true,
  scopes: ['openid'],
  // profil dekódujte z tokens.idToken (JWT, RS256, kľúče na /.well-known/jwks.json)
  getUserInfo: async (tokens) => { /* ... */ },
}
```

| #   | Odpoveď                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `_id: rozvojklubu` je založené. `flags: primary` má zmysel len pri aplikáciách s väzbami na iné aplikácie (rodičovské/detské), samostatnému klientovi nič nemení, preto ho nemá.                                                                                                                                                                                      |
| A2  | Klienta sme založili ručne. Secret nepotrebujete: prihlásenie chráni PKCE a token exchange secret nepoužíva. Nikde ho teda neukladáte.                                                                                                                                                                                                                                |
| A3  | Wildcard nie je podporovaný, host musí sedieť presne. Schéma ani cesta sa nekontrolujú a `localhost` bez portu pokryje aj `localhost:3000`. Povolené sú `localhost`, `rozvojklubu.ltk.solutions`, `rozvojklubu.futbalsfz.sk` a `rozvojklubu-cyro5.vercel.app`. Pre Preview potrebujeme jednu pevnú doménu alebo alias.                                                |
| A4  | Cesta `/api/auth/oauth2/callback/sportnet` je v poriadku. `redirect_uri` poslaná na `/token` musí byť zhodná s tou z `/authorize`.                                                                                                                                                                                                                                    |
| A5  | Používajte `authorization_code` s PKCE S256 a `refresh_token`. Secret sa neposiela, klienta overuje PKCE. Access token platí 15 min. Refresh token platí 24 h a pri každom použití sa vymení za nový. `client_credentials` nepoužívajte, pre CRM a Súťaže slúži token exchange (časť 2).                                                                              |
| A6  | Iba `response_type=code`.                                                                                                                                                                                                                                                                                                                                             |
| A7  | `openid` stačí. `/me/appspaces`, `/me/sport-orgs` a `/me/sport-expert-orgs` prijmú access token z prihlásenia bez ďalšieho scope a bez výmeny.                                                                                                                                                                                                                        |
| A8  | ID token nesie `sub`, `name` (meno), `surname` (priezvisko), `family_name`, `username` (môže byť pole), `email`, `photoUrl`, `photoIsPublic`, `aud`, `iss`, `jti`, `iat` a `exp` (24 h). `dnm` (zobrazované meno), `displayName` ani `picture` v ňom nie sú, `dnm` je len v access tokene. **`email` nie je garantovaný:** účty prihlasované cez ISSF ho mať nemusia. |

## 2. Volanie CRM a Súťaží: token exchange (A9, A10, B7)

Keď potrebujete volať CRM alebo Súťaže v mene prihláseného používateľa za konkrétny klub, najprv si
vymeníte jeho access token:

```
POST https://auth.sportnet.online/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
client_id=rozvojklubu
subject_token=<access token používateľa, ktorý ste dostali pri prihlásení>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
audience=CRM                      # alebo sutaze
scope=appSpace:<ppo klubu>
```

Odpoveď:

```json
{
  "access_token": "<token používateľa pre CRM>",
  "token_type": "Bearer",
  "expires_in": 900,
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token"
}
```

S týmto tokenom voláte API cieľovej aplikácie, napríklad `GET /crm/{appSpace}/users` v CoreApi
(zoznam osôb v CRM klubu).

Čo treba vedieť:

- **`subject_token`** musí byť access token vydaný pre `rozvojklubu`, nie ID token ani refresh
  token. `client_id` musí byť `rozvojklubu`, secret sa pri výmene neposiela.
- **`audience`** je cieľová aplikácia. Povolené sú `CRM` a `sutaze`.
- **`scope=appSpace:<ppo>`** určuje klub. Token nesie roly používateľa v tomto klube (v CRM
  `admin`, `matrikar` alebo `manager`) a platí len preň. Pre iný klub urobte novú výmenu.
- Vymenený token platí **15 min** a nemá refresh token. Keď vyprší, zopakujte výmenu s aktuálnym
  access tokenom používateľa. Ak vyprší aj ten, najprv ho obnovte refresh tokenom.
- Vymenený token má claim `act: { sub, aud: "rozvojklubu" }`, z ktorého vidno, že ho vyžiadala vaša
  aplikácia.
- `/revoke` volajte len s tokenmi vydanými pre `rozvojklubu`, nie s vymeneným tokenom.

### Prístup má len používateľ s oprávnením v aplikácii a klube

Token exchange nepridáva žiadne oprávnenia. Vymenený token nesie len roly, ktoré používateľ už má v
cieľovej aplikácii (CRM, Súťaže) a v klube zo `scope`.

- Ak používateľ v danom klube nemá rolu v CRM (alebo v Súťažiach), výmena prejde, ale token nemá
  rolu a API volanie za tento klub odmietne.
- Na endpointy, ktoré vyžadujú vymenený token, sa teda dostane **naozaj len človek s oprávnením
  pre danú aplikáciu a daný klub**. Vaša aplikácia nemôže nikomu prístup rozšíriť.
- **Oprávnenia sa riešia v Sportnet admine:** rolu v CRM alebo Súťažiach klubu pridelí správca
  klubu alebo my. Vaša aplikácia ich nespravuje. Ak používateľ prístup nemá, odkážte ho na správcu
  klubu.
- Správcovia klubov z ISSF majú rolu `matrikar` v CRM a `admin` v Súťažiach automaticky (B3).
  Ostatným ich treba prideliť v Sportnet admine.

Chyby výmeny:

| Stav | Kód                     | Príčina                                                                   |
| ---- | ----------------------- | ------------------------------------------------------------------------- |
| 400  | `InvalidUserInput`      | chýba `audience` alebo `subject_token_type` nie je access token           |
| 401  | `INVALID_SUBJECT_TOKEN` | subject token je neplatný, expirovaný alebo to nie je používateľský token |
| 403  | `INVALID_CLIENT_ID`     | subject token nebol vydaný pre `rozvojklubu`                              |
| 403  | `FORBIDDEN_DELEGATION`  | výmena pre danú `audience` nie je povolená                                |

Odpovede na konkrétne otázky:

| #   | Odpoveď                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A9  | Aplikačný token (`client_credentials`) pre CRM nedávame: rola, ktorá by mu sprístupnila zoznam osôb, číta CRM všetkých klubov naraz. Zoznam osôb klubu čítajte cez `GET /crm/{appSpace}/users` s vymeneným tokenom pre `CRM`. Prejde pre používateľov, ktorí majú v CRM klubu rolu `admin`, `matrikar` alebo `manager`. |
| A10 | Prihlasovať sa cez `client_id` CRM netreba. Roly CRM a Súťaží pre konkrétny klub získate výmenou tokenu. Prehľad všetkých rolí používateľa naprieč klubmi dáva `/me/appspaces` (B4).                                                                                                                                    |
| B7  | Rovnako ako A9: osoby klubu cez `GET /crm/{appSpace}/users` s vymeneným tokenom. Bez prihláseného používateľa s rolou v klube je k dispozícii len verejný `GET /ppo/{appSpace}/users`.                                                                                                                                  |

## 3. Dáta o osobách v kluboch (B1–B6, B8)

Správca klubu z ISSF má v CRM rolu `matrikar`, tréner sa ku klubu zvyčajne nezrkadlí a názvy
funkcií treba normalizovať u vás.

| #   | Odpoveď                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Väzba tréner ↔ klub vzniká len vtedy, keď ISSF vráti klubovú príslušnosť s klubom. Registrácia trénera (licencia) sa zapisuje pri zväze a pri `futbalsfz.sk`, nie pri klube. Preto vidíte licenciu pri zväze, ale `coach` v klube nie. Tréneri družstiev sú strojovo v nomináciách zápasov v Súťažiach, pri osobe uložení nie sú. Rolu Tréner zatiaľ prideľujte ručne. |
| B2  | Názov funkcie z ISSF sa porovnáva znak po znaku s názvami v číselníku `sport-expert-competence-type`. Keď sa nájde, uloží sa kód, inak doslovný slovenský názov z ISSF. Kodifikáciu zatiaľ neplánujeme a reťazce sa zmenia, len keď ich zmení ISSF. Odporúčame normalizačnú tabuľku na vašej strane, ktorá prijme kód aj názov.                                        |
| B3  | Klubový manažér z ISSF dostane v CRM klubu rolu **`matrikar`** (s `grant: true`), nie `admin` ani `manager`. V Súťažiach dostane `admin`. Za správcu klubu považujte rolu `admin`, `matrikar` alebo `manager`. Roly z ISSF sa len pridávajú, po skončení funkcie ostanú. Iná väzba (`ppoRelations`, `grant`) sa nezapisuje.                                            |
| B4  | Tvar odpovede `GET /me/appspaces` je pod tabuľkou. `?expandApp=true` pridá detail aplikácie. Rola získaná len cez `child_apps_role` nemá vlastnú položku, je vnorená pod rodičovskou aplikáciou.                                                                                                                                                                       |
| B5  | Áno, `openid` stačí. `/me/sport-orgs` a `/me/sport-expert-orgs` vracajú `isActive` vypočítané z `date_from`/`date_to`. Neaktívne záznamy sa nevynechávajú, filtrujte podľa `isActive`.                                                                                                                                                                                 |
| B6  | Tímového manažéra (P31) dnes nezrkadľujeme. Ak ho ISSF pošle ako príslušnosť, príde len ako text „Vedúci družstva / Tímový manažér“. Na rolu Tímový manažér vám zatiaľ stačí „Vedúci družstva“.                                                                                                                                                                        |
| B8  | CoreApi nemá v aplikácii rate limit. Stránkovanie je po 100, s parametrom `q` je offset vždy 0. Pri hromadnom čítaní klubov odporúčame sekvenčné volania, nie paralelné.                                                                                                                                                                                               |

Tvar odpovede `GET /me/appspaces` (B4):

```json
{
  "apps": [
    {
      "app_id": "CRM",
      "appspaces": [
        {
          "app_id": "CRM",
          "app_space": "<ppo>",
          "validTo": null,
          "display_name": "...",
          "role": "matrikar",
          "grant": true,
          "child_apps_role": [{ "app_id": "mediamanager", "role": "admin" }],
          "user_id": "...",
          "org_profile": {
            "_id": "<ppo>",
            "name": "...",
            "type": "...",
            "sport": "...",
            "status": "...",
            "parent_ppo": "..."
          }
        }
      ]
    }
  ]
}
```

## 4. Testovanie (B9)

Staging neexistuje, testuje sa na produkcii. Áno, rolu `manager` v CRM testovacieho klubu mať
môžete. Keďže ste obaja admini na Sportnete, testovací klub aj roly si nastavíte sami v Sportnet
admine. Na overenie výmeny tokenu odporúčame vyskúšať aj účet bez roly v klube (API volanie musí
skončiť zamietnutím).

## 5. Ďalšie kroky

**My:**

- nič ďalšie, klient `rozvojklubu` aj výmena tokenov sú pripravené.

**Od vás potrebujeme:**

- pevnú Preview doménu alebo alias pre povolené hosty (A3);
- zoznam endpointov Súťaží, ktoré plánujete volať, aby sme overili, že ich token pre `sutaze` pokryje.

## 6. Dopady na Rozvoj klubu (naša analýza, 5. 11. 2026)

### Treba vrátiť sportnet.online

| #   | Čo                                                                                                                                                                                                                                                                            | Kto        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1  | **Produkčná doména `klub.futbalsfz.sk` nie je medzi povolenými hostmi.** Povolené sú `rozvojklubu.ltk.solutions` a `rozvojklubu.futbalsfz.sk`; aplikácia od 3. 11. beží na `klub.futbalsfz.sk`. Bez doplnenia prihlásenie na produkcii neprejde (`redirect_uri` host nesedí). | Ján        |
| D2  | Pevná doména pre Preview. Per-vetvové adresy `rozvojklubu-git-<vetva>-cyro5.vercel.app` nepôjdu. Návrh: jedna doména alebo alias vo Verceli pre vetvu, na ktorej sa testuje Sportnet (napr. `preview.klub.futbalsfz.sk`), a tú dať povoliť.                                   | Ján, Cyril |
| D3  | Zoznam endpointov Súťaží. Zatiaľ žiadne nevoláme. Kandidát je len čítanie nominácií zápasov ako zdroj väzby tréner ↔ klub (B1) – rozhodnúť, či to chceme, až potom posielať zoznam.                                                                                           | Ján        |

### Rozhodnutia, ktoré treba urobiť

| #   | Čo                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Klubový manažér a rola `matrikar`.** ADR 0021 (prijaté 28. 10.) hovorí „len `admin` alebo `manager`“. Podľa B3 dostáva klubový manažér z ISSF v CRM rolu `matrikar`. S dnešným pravidlom by sa klubovým manažérom nestal takmer nikto z ISSF. **Rozhodnuté 5. 11. (Ján): klubový manažér = `admin`, `matrikar` alebo `manager` – ADR 0024** (nahrádza časť 1 ADR 0021).                            |
| R2  | **Roly z ISSF sa v CRM neodoberajú** (B3) – bývalý manažér klubu ostáva `matrikar`. Rozhodnuté v ADR 0024: riziko prijaté pre pilot, rolu odoberá správca klubu alebo SFZ v Sportnet admine; vypnutie väzby v aplikácii až keď bude treba.                                                                                                                                                           |
| R3  | **Účet bez e-mailu.** ID token nemusí niesť `email` (účty cez ISSF). Dnes `mapSportnetClaims` bez e-mailu vráti `null` a prihlásenie zlyhá. Better Auth e-mail vyžaduje. Možnosti: (a) technický e-mail `<sub>@sportnet.invalid` a neskôr výzva na doplnenie, (b) odmietnuť s vysvetlením „doplňte si e-mail v my.sportnet.online“. **Rozhodnuté 5. 11. (Ján): (b) – odmietnuť s výzvou, ADR 0025.** |
| R4  | **Zoznam osôb klubu (S3).** Aplikačný token nebude. CRM zoznam (`GET /crm/{appSpace}/users`) pôjde len cez token exchange prihláseného človeka s rolou v CRM klubu. Admin SFZ bez roly v CRM klubu má len verejný `GET /ppo/{appSpace}/users`. Návrh: S3 stavia na verejnom zozname, token exchange až keď bude treba neverejné údaje.                                                               |

### Čo sa mení v kóde (S1, S2-b)

- **Verejný klient bez secretu:** `auth.ts` dnes zapína Sportnet len pri `SPORTNET_OAUTH_CLIENT_ID` aj
  `SPORTNET_OAUTH_CLIENT_SECRET`. Stačiť má `client_id`; `SPORTNET_OAUTH_CLIENT_SECRET` z `.env.example`
  a z Vercelu preč. Better Auth 1.7.10 klienta bez secretu podporuje (`clientSecret` je voliteľný, PKCE).
  Hotové v S1 (5. 11.). Callback Better Auth 1.7 je `/api/auth/callback/sportnet`, nie `/api/auth/oauth2/…`
  z A4 – Sportnet cestu nekontroluje (A3), na localhoste overené: `/authorize` presmerovanie prijal.
- **Claims:** fotka je `photoUrl` (použiť len pri `photoIsPublic`), nie `photo`/`picture`; meno z `name` +
  `surname`; `dnm` a `displayName` v ID tokene nie sú – z `mapSportnetClaims` vypadnú. `username` môže byť pole.
- **Refresh token sa pri každom použití mení** – po obnove treba uložiť nový (overiť, že to Better Auth
  v `account` robí).
- **`/me/sport-orgs` a `/me/sport-expert-orgs` vracajú `isActive`** – `deriveClubRoles` ho použije; výpočet
  z `date_from`/`date_to` ostáva len pre verejné `/ppo/…` endpointy.
- **`/me/appspaces`** má tvar `{ apps: [{ app_id, appspaces: [{ app_space, role, grant, validTo, … }] }] }` –
  typ a mock klienta podľa neho.
- **Filter verejného zoznamu je `competenceType`** (jednotné číslo, hodnoty cez čiarku, len so
  `sport_expert_orgs`) – naše zistenie z 28. 10., že filter verejne nefunguje, bolo preklepom v názve parametra.
- **Normalizačná tabuľka `competence_type`** (kód aj slovenský názov) ostáva u nás natrvalo (B2).
- **Tréner** ostáva ručná rola (B1). **Tímový manažér** = „Vedúci družstva“ a „Vedúci družstva / Tímový manažér“ (B6).
- **Hromadné čítanie klubov** sekvenčne, stránky po 100 (B8).
- **Testovanie** len na produkcii Sportnetu s testovacím klubom; overiť aj účet bez roly v klube (B9). Automatické
  testy ostávajú na mockoch.
