# 0028 – Kluby zo sportnet.online (S3-a)

- Stav: **prijaté** – 6. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR
- Dátum: 2026-11-06
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0003 (tenant = klub), 0005 (zdroj dát klubov), 0026 (klub pri prihlásení)
- Nahrádza: 0026 bod 2 v časti „kluby sa zakladajú len z roly klubového manažéra“ – kluby už nezakladá
  len prihlásenie, ale import zo Sportnetu

## Kontext

V aplikácii je 11 klubov: 10 pilotných zo snapshotu a jeden založený pri prihlásení (ADR 0026). Zadanie S3
chce kluby zo sportnet.online namiesto importu snapshotu. Verejné CoreApi (bez tokenu, B8 – sekvenčne, bez
rate limitu) overené 6. 11.:

- `GET /ppo/futbalsfz.sk/related-ppos?ppoType=club` – 3 084 futbalových klubov (`_id` = appSpace, `name`,
  `organization_name`, `status`, `logo_public_url`); aktívnych (`status: active`) je 1 558, ostatné sú
  `excluded`, `inactive` alebo bez stavu.
- `GET /ppo/futbalsfz.sk/relations-structure` – strom SFZ → zväzy (ObFZ, regionálne zväzy, ÚLK) → kluby
  v jednom volaní; zväz má `shortNames` (napr. `ObFZ Trebišov`) a matričnú väzbu na regionálny zväz.
- `GET /ppo/{appSpace}/invoice-profile` – IČO (`business_id`), právna forma a celý názov právnickej osoby,
  jedno volanie na klub. Odpoveď obsahuje aj kontaktnú osobu, e-mail a telefón – tie sa neukladajú.

Dnešný `clubs.union` zo snapshotu je zväz najvyššej súťaže (Dukla = SFZ, Bojná = ZsFZ). Sportnet dáva
matričný zväz (Bojná = ObFZ Topoľčany, regionálny zväz ZsFZ).

Verejné Kluby (vizitky, mapa, rebríčky), Kompas na vyskúšanie, prehľad mentora a analýza admina prechádzali
všetky kluby po jednom s niekoľkými dotazmi na klub – pri 1 558 kluboch by to boli tisíce dotazov na jedno
načítanie stránky.

## Rozhodnutie

1. **Import všetkých aktívnych klubov** zo Sportnetu do kolekcie `clubs` (`source: "sportnet"`). Existujúci
   klub sa doplní a obnoví (snapshot si nechá `slug` a dáta sezóny), nový sa založí. Klub, ktorý v Sportnete
   prestal byť aktívny, sa nemaže – dostane stav zo Sportnetu.
2. **Zväz = matričný zväz zo Sportnetu** (skratka zo `shortNames`, inak názov), **región = regionálny zväz**
   (BFZ, ZsFZ, SsFZ, VsFZ) – aj pre pilotné kluby. Úroveň súťaže príde zo Súťaží (D2–D3).
3. **Nové voliteľné polia `clubs`:** `status`, `logoUrl`, `unionId`, `regionId`, `legalName`, `businessId`
   (IČO), `legalForm`, `sportnetSyncedAt`. Kontaktné osoby, e-maily a telefóny nikdy.
4. **Aktívny klub v aplikácii** = má záznam v niektorej kolekcii s dátami klubu (sezóna, roly, Kompas,
   licenčné hodnotenie, plán, návštevy, mentoring, nastavenia, Prax). Zoznamy a analýza čítajú dáta po
   jednom len pre aktívne kluby (`ClubStore.listActiveClubIds`); ostatné kluby majú neutrálnu kartu bez
   dotazov. Výber klubu v Kompase na vyskúšanie a analýza admina ukazujú len aktívne kluby.
5. **Poradie:** najprv sa nasadí kód zoznamov (PR S3-a1), až potom sa spustí import – inak by verejné
   stránky po importe čítali tisíce klubov. Import začína dry-runom.

## Dôsledky

- Verejné Kluby nájdu po importe každý aktívny klub; mapa ukáže len kluby s okresom, kým sa miesto
  neodvodí zo zväzu zo Sportnetu.
- Filtre analýzy a rozsah ObFZ sa po importe opierajú o matričný zväz – pilotné kluby Dukla a Bojná zmenia
  zväz (SFZ → ÚLK/ObFZ, ZsFZ → ObFZ Topoľčany).
- Snapshot ostáva zdrojom dát sezóny (družstvá, hráči, tréneri), kým ich nenahradia Súťaže.
- Klub bez dát nemá v zozname veľkosť ani hodnotenie – rovnako ako klub bez súhlasu s rebríčkom.

## Zamietnuté alternatívy a prečo

- **Len kluby v aplikácii** – klubový manažér mimo pilotu by klub našiel až po prihlásení; Ján chce
  všetky aktívne kluby (6. 11.).
- **Číselník `sportnet_clubs` oddelene od `clubs`** – menej zmien v službách, ale dva zdroje pravdy o klube
  a nová kolekcia; Ján zvolil všetky kluby v `clubs` s úpravou zoznamov.
- **Zväz zo snapshotu ponechať** – pilotné kluby by mali iný význam poľa než ostatné kluby.
- **IČO z `GET /organizations`** – vracia 15 486 organizácií všetkých športov aj so štatutármi; po klube je
  presnejšie a bez cudzích osobných údajov.
