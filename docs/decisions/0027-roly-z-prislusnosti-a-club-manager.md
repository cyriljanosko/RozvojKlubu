# 0027 – Roly z príslušností Sportnetu a premenovanie na `club_manager` (S2-b etapa 2)

- Stav: **prijaté** – 6. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR
- Dátum: 2026-11-06
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0021 (roly v klube zo Sportnetu), 0024 (klubový manažér), 0026 (S2-b po etapách)

## Kontext

ADR 0021 určuje mapovanie rolí zo Sportnetu a premenovanie `management` → `club_manager`. ADR 0026 dodal
v prvej etape len klubového manažéra. Pri dokončení zostali otvorené detaily, ktoré 0021 nerieši:

- osoba môže mať v jednom klube viac príslušností (hráč aj funkcionár, vedúci družstva aj klubový manažér),
- `management` je zároveň kód základnej roly v katalógu rolí (URL, uložené voľby v Akadémii),
- produkcia beží nad tou istou databázou ako vývoj a migrácia sa nespustí v tej istej sekunde ako nasadenie,
- tvar obalu odpovede `/me/sport-orgs` a `/me/sport-expert-orgs` nie je zdokumentovaný.

## Rozhodnutie

1. **Mapovanie podľa ADR 0021:** `player` = aktívna položka `sport_orgs` s `competence_type` `player`;
   `team_manager` = aktívna položka `sport_expert_orgs`, ktorej normalizovaný `competence_type` (malé písmená,
   bez diakritiky) začína `veduci druzstva` (B6); `member` = každá iná aktívna položka `sport_expert_orgs`.
   Tréner ostáva ručný (B1). Aktívnosť podľa `isActive` z `/me/*` (B5), bez neho podľa `date_from`/`date_to`.
2. Roly z príslušností **len v kluboch, ktoré sú v aplikácii** – klub sa zakladá iba z roly klubového manažéra
   (ADR 0026).
3. **Jedna rola zo Sportnetu na klub – najsilnejšia:** `club_manager` > `team_manager` > `player` > `member`.
   Slabšia rola nepridáva prístup (analýza kap. 3.1) a zoznam rolí v účte ostane čitateľný. Ručné roly
   z aplikácie sa neprepisujú a rovnaká rola sa neduplikuje.
4. `sportnetRef` = `appspace:CRM`, `sport_orgs:<_id>` alebo `sport_expert_orgs:<_id>`.
5. **Premenuje sa len rola v klube** (`club_memberships.role`, `clubRole` v katalógu). Kód základnej roly
   `management` („Manažér a výbor“) v katalógu, URL a uložených voľbách ostáva.
6. **Nasadenie pred migráciou je bezpečné:** úložisko aj schéma katalógu čítajú `management` ako
   `club_manager`. Migrácia `scripts/migrate-club-roles.mjs` (dry-run predvolene, `--apply` zapisuje) premenuje
   väzby a katalóg a doplní `source: "app"` väzbám bez zdroja; pri konflikte s unikátnym indexom nezapíše nič.
7. **Chyba Sportnetu nič nemaže:** obe čítania (`/me/appspaces`, príslušnosti) prebehnú pred zápisom; keď
   niektoré zlyhá, uložené roly ostanú a prihlásenie pokračuje.

## Dôsledky

- Hráč, vedúci družstva alebo funkcionár pilotného klubu vidí po prihlásení cez Sportnet svoj klub
  (prehľad a plán; tímový manažér aj Kompas, licenčné hodnotenie a mentoring).
- Normalizačná tabuľka `competence_type` je natrvalo u nás (B2); zmena reťazcov v ISSF môže zmeniť
  vedúceho družstva na člena.
- Obal odpovede `/me/sport-orgs` sa parsuje obranne (pole alebo prvé pole v objekte); overí sa na ostrom účte.

## Zamietnuté alternatívy a prečo

- **Všetky roly zo Sportnetu v klube naraz** – nepridávajú prístup a v účte by osoba videla napr. „Hráč, Člen
  klubu, Tímový manažér“ pre jeden klub.
- **Premenovať aj kód základnej roly v katalógu** – rozbilo by URL a uložené voľby rolí v Akadémii bez úžitku.
- **Najprv migrácia, potom nasadenie** – medzi migráciou a nasadením by stará verzia nepoznala `club_manager`
  a klubový manažér by stratil prístup.
- **Pri chybe príslušností uložiť aspoň klubového manažéra** – čiastočný zápis by zmazal roly z príslušností
  z minulého prihlásenia.
