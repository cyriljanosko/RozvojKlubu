# RUNBOOK

## Prostredia

| Prostredie | Zdroj         | URL                                        | Databáza                               |
| ---------- | ------------- | ------------------------------------------ | -------------------------------------- |
| Production | vetva `main`  | https://rozvojklubu.ltk.solutions          | `rozvojklubu_dev`                      |
| Preview    | každý PR      | `rozvojklubu-git-<vetva>-cyro5.vercel.app` | `rozvojklubu_dev` (zdieľaná – dočasne) |
| Lokálne    | `npm run dev` | http://localhost:3000                      | podľa `.env.local`                     |

Preview a vercel.app adresy chráni Vercel Authentication (prihlásenie do Vercelu).

Adresa pre prihlasovanie (odkazy v e-mailoch, callbacky): Production berie `BETTER_AUTH_URL`.
Preview nemá mať `BETTER_AUTH_URL` ani `APP_URL` nastavené – adresu odvodí z `VERCEL_BRANCH_URL`
a `VERCEL_URL`, ktoré nastavuje Vercel sám (`src/server/auth/base-url.ts`). Preview potrebuje vlastný `BETTER_AUTH_SECRET`.

## Nasadenie

1. PR do `main` → Vercel vytvorí Preview a GitHub Actions spustí CI (format, lint, typecheck, test, build).
2. Po review merge commit (ADR 0017) → Vercel nasadí produkciu automaticky.
3. Kontrola: `https://rozvojklubu.ltk.solutions/api/v1/health` → `status: ok`, `database: ok`, `version` = prvých 7 znakov commitu.

Nastavenia projektu Vercel: Framework **Next.js**, Node 24.x, región funkcií **fra1**. Premenné prostredia: viď `.env.example`.

**Dizajn systém SFZ (ADR 0016):** `npm install` / `npm ci` sťahuje `@slovensky-futbalovy-zvaz/design-system` z GitHub Packages a potrebuje `NPM_GITHUB_TOKEN` (classic token, `read:packages`) – vo Verceli (všetky prostredia), v GitHub Actions secrets a v Dependabot secrets. Ak build alebo CI padne na `npm install` s 401/403, token chýba alebo vypršal: vytvoriť nový a vymeniť ho na všetkých troch miestach. Novú verziu dizajn systému prinesie Dependabot ako PR (skupina `sfz-design-system`) – skontrolovať náhľad a zlúčiť.

## Rollback

- Vercel → Deployments → posledné funkčné produkčné nasadenie → **Promote to Production** (okamžité).
- Potom revert commitu v `main` cez PR, aby sa chyba nevrátila pri ďalšom nasadení.

## Vizuálne regresné testy (Playwright, ADR 0019)

- Lokálne: `npm run build`, potom `npm run test:e2e` (server s `ENABLE_DEV_PAGES=1` spustí Playwright sám). Na macOS
  sa vytvoria len lokálne screenshoty `*-darwin.png` (necommitujú sa).
- CI porovnáva s Linux screenshotmi v `e2e/__screenshots__/*-linux.png`. Pri rozdiele CI zlyhá a priloží artefakt
  `playwright-report` (porovnanie aj nové obrázky).
- **Zámerná zmena vzhľadu** (alebo nový screenshot): stiahnuť artefakt a skopírovať nové obrázky ako základ.
  Súbory `*-actual.png` v `test-results/` sa premenujú na meno z chybovej hlášky (`<meno>-<projekt>-linux.png`)
  a uložia do `e2e/__screenshots__/`:

  ```bash
  gh run download <id-behu> -n playwright-report -D /tmp/pw
  ```

  Nový základ sa commituje v tom istom PR ako zmena, s vysvetlením v popise PR.

## Keď to spadne

| Príznak                                                        | Pravdepodobná príčina                                                     | Riešenie                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build: `No Output Directory named "public"`                    | Projekt nemá nastavený framework                                          | Settings → Build → Framework Preset = Next.js, redeploy (stalo sa 15. 10. 2026)                                                                                                                 |
| Health: `database: down`                                       | Zlý `MONGODB_URI` (iný cluster/projekt), chýba používateľ, Network Access | Overiť host clustra (`rozvojklubu-dev.bwcixej…`), používateľa `rozvojklubu-app-dev`, Network Access `0.0.0.0/0`; po zmene env redeploy. Dôvod je v runtime logu `[health] database ping failed` |
| Health: `database: not_configured`                             | Chýba `MONGODB_URI` pre dané prostredie                                   | Doplniť vo Verceli, redeploy                                                                                                                                                                    |
| Prihlásenie nefunguje, v logu `BETTER_AUTH_SECRET must be set` | Chýba tajomstvo v produkcii                                               | Doplniť `BETTER_AUTH_SECRET` (min. 32 znakov), redeploy. Web beží ďalej, len bez prihlásenia                                                                                                    |
| E-mail s odkazom nepríde                                       | Chýba `ECOMAIL_API_KEY`/`EMAIL_FROM` alebo neoverená doména v Ecomaile    | V produkcii vráti chybu; skontrolovať Ecomail účet a DNS (SPF/DKIM)                                                                                                                             |
| Tlačidlo „Prihlásiť sa cez Sportnet“ chýba                     | Nie je nastavený `SPORTNET_OAUTH_CLIENT_ID/SECRET`                        | Doplniť po registrácii klienta v Sportnete                                                                                                                                                      |
| Vlastná doména presmeruje na vercel.app                        | Doména nastavená ako redirect                                             | Settings → Domains → Edit → No Redirect (stalo sa 15. 10. 2026)                                                                                                                                 |

## Limity a cron

- Cron joby: žiadne.
- Atlas M0: zdieľaný cluster, max. 500 spojení, 512 MB – pred ostrou prevádzkou upgrade.
