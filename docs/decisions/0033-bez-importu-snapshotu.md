# 0033 – Bez importu snapshotu klubov

- Stav: **prijaté** – 7. 11. 2026 (Ján Letko, SFZ)
- Dátum: 2026-11-07
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko
- Nadväzuje na: 0028 (kluby zo Sportnetu), 0029 (nočná synchronizácia klubov)
- Nahrádza: 0005 v časti, podľa ktorej admin SFZ nahráva snapshot Vizitky v administrácii

## Kontext

ADR 0005 zaviedol import snapshotu Vizitky (JSON k 11. 10. 2026) na `/admin/kluby` a cez
`POST /api/v1/admin/club-snapshot`, kým aplikácia nemala dáta zo Sportnetu. Od ADR 0028 a 0029 berie
aplikácia kluby (názov, logo, stav, zväz, región, IČO) zo sportnet.online nočnou synchronizáciou.
Snapshot sa nahral raz (10 pilotných klubov, 19 sezón) a ďalší nepríde. Formulár na stránke Kluby
by v návrhu G5 nemal miesto a import s menami osôb je zbytočne otvorená cesta zápisu.

## Rozhodnutie

- Import snapshotu sa odstráni: formulár a Server Action na `/admin/kluby`, `POST /api/v1/admin/club-snapshot`,
  `importClubSnapshot` a `mongoSnapshotStore`.
- Dáta sezóny pilotných klubov (`club_seasons`, `slug`, `dataAsOf`), ktoré sú v databáze, ostávajú bez zmeny
  a aplikácia ich ďalej číta, kým ich nenahradia Súťaže zo Sportnetu.
- `parseSnapshot` a vymyslený `club-snapshot.fixture` ostávajú – plnia testovacie dáta (kluby, Kompas, export).

## Dôsledky

- Dáta sezóny sa nedajú obnoviť ani doplniť – nové kluby ich nemajú, kým nepríde zdroj zo Sportnetu.
- Pri novej databáze (napr. vlastná DB pre Preview) sa dáta sezóny pilotných klubov neprenesú importom;
  treba ich skopírovať z `rozvojklubu_dev` alebo počkať na Súťaže.
- Súbor snapshotu v `data/private/` sa už nepoužíva.

## Zamietnuté alternatívy a prečo

- **Nechať import, len ho skryť z UI** – zostala by nepoužívaná cesta zápisu cez API.
- **Zmazať aj dáta sezóny z databázy** – karta klubu a Kompas pilotných klubov by stratili družstvá
  a kategórie; o dátach rozhodne až nahradenie Súťažami.
