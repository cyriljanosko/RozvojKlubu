# 0024 – Klubový manažér aj s CRM rolou `matrikar`

- Stav: **prijaté** – rozhodnutie 5. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR #137
- Dátum: 2026-11-05
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nahrádza: 0021 (časť 1 – zdroj roly Klubový manažér „len `admin` alebo `manager`“ a zamietnutá alternatíva
  „Klubový manažér = ktokoľvek s rolou v CRM klubu“ v rozsahu roly `matrikar`; ostatné časti 0021 platia)
- Podklad: `docs/sportnet/odpovede-sportnet-online.md` (B3, R1, R2)

## Kontext

ADR 0021 (28. 10.) odvodzuje rolu Klubový manažér (`club_manager`) z roly `admin` alebo `manager`
v `CRM:{clubId}` a `matrikar` výslovne vylučuje – predpoklad bol, že matrikár je administratívna rola, nie
vedenie klubu.

sportnet.online 4. 11. odpovedali (B3): **klubový manažér z ISSF dostane v CRM klubu rolu `matrikar`**
(s `grant: true`), nie `admin` ani `manager`, a odporúčajú za správcu klubu považovať `admin`, `matrikar` aj
`manager`. Roly z ISSF sa v CRM len pridávajú – po skončení funkcie ostanú.

S pravidlom z 0021 by sa klubovým manažérom zo Sportnetu nestal takmer nikto; všetkým pilotným klubom by
rolu musel ručne prideliť admin SFZ alebo správca v Sportnet admine.

## Rozhodnutie

1. **Klubový manažér (`club_manager`) = rola `admin`, `matrikar` alebo `manager` v `CRM:{clubId}`**
   z `/me/appspaces`, kým rola v CRM trvá (`validTo` appspace). Iné roly v CRM (a `child_apps_role`) rolu
   nedávajú.
2. Ide o rozhodnutie „nateraz“ (Ján, 5. 11.) – jednoduchšie pre pilot, kým nevieme, ako často `matrikar`
   ostáva bývalým manažérom. Prehodnotí sa po pilote alebo pri prvom prípade, keď rolu bude mať niekto, kto
   už klub nevedie.
3. Odobratie roly ostáva v Sportnete: rolu `matrikar` z ISSF odoberie v Sportnet admine správca klubu alebo
   SFZ; pri ďalšom prihlásení sa väzba `source: "sportnet"` zruší (ADR 0021, časť 3). Aplikácia vlastný príznak
   na vypnutie väzby zo Sportnetu zatiaľ nemá.

## Dôsledky

- Klubový manažér z ISSF má rolu v aplikácii hneď po prvom prihlásení cez Sportnet, bez ručného pridelenia.
- `deriveClubRoles` (S2-b) berie `CRM` appspace s `role ∈ {admin, matrikar, manager}`; test pokryje všetky tri
  aj odmietnutie inej roly.
- **Riziko:** bývalý manažér klubu, ktorému ostal `matrikar` z ISSF, má v aplikácii naďalej práva klubového
  manažéra (Kompas, plán, nastavenia klubu). Rieši sa odobratím roly v Sportnet admine; ak to bude časté,
  pribudne v aplikácii vypnutie väzby (nové ADR).
- Rovnaká trojica rolí platí pre token exchange s CRM (`GET /crm/{appSpace}/users`), takže kto je v aplikácii
  klubový manažér, ten vie (S3) čítať aj zoznam osôb klubu z CRM.

## Zamietnuté alternatívy a prečo

- **Ponechať len `admin` a `manager` (ADR 0021)** – Ján to 5. 11. najprv potvrdil a v ten istý deň zmenil:
  pre pilot by takmer všetci klubovi manažéri potrebovali ručné pridelenie, čo je viac práce ako riziko
  bývalých matrikárov.
- **Príznak „vypnúť väzbu zo Sportnetu“ v aplikácii hneď** – zmena schémy a obrazovky navyše pre prípad,
  ktorý v pilote zatiaľ nepoznáme; odloží sa, kým nebude potrebný.
- **Klubový manažér = ktokoľvek s rolou v CRM klubu** – iné roly (a detské aplikácie) nie sú vedenie klubu;
  ostáva zamietnuté.
