# 0017 – PR sa zlučujú cez merge commit

- Stav: prijaté
- Dátum: 2026-10-26
- Rozhodol: Cyril Janoško

## Kontext

Pull requesty sa doteraz zlučovali cez squash merge (`CLAUDE.md`, `CONTRIBUTING.md`, `RUNBOOK.md`): celá vetva
padla do `main` ako jeden commit a jednotlivé commity vetvy (každý = jedna logická zmena podľa Conventional Commits)
sa z histórie `main` stratili. Cyril chce, aby história zachovala každý commit zvlášť.

## Rozhodnutie

1. PR sa zlučujú cez **merge commit** (`gh pr merge N --merge`): všetky commity vetvy ostanú v histórii `main`
   a pribudne merge commit „Merge pull request #N …“, ktorý ukazuje hranicu PR.
2. Ostatné pravidlá ostávajú: každá zmena cez PR, zlučuje Cyril alebo Claude len na výslovný pokyn, po zlúčení
   overenie cez GitHub API, jeden commit = jedna logická zmena.

## Dôsledky

- Na kvalite jednotlivých commitov záleží viac – správy commitov vo vetve idú do `main` tak, ako sú.
- Zlúčenie `main` do vetvy (riešenie konfliktov) sa v histórii objaví ako ďalší merge commit.
- Verzia v `/api/v1/health` po zlúčení ukazuje hash merge commitu.
- Konflikty pri zlučovaní `main` do rozpracovanej vetvy budú menšie (pri squashi git nevedel, že commity vetvy sú už
  v `main`).

## Zamietnuté alternatívy a prečo

- **Squash merge** – doterajší spôsob; stráca jednotlivé commity, čo Cyril nechce.
- **Rebase merge** – zachová commity bez merge commitu, ale z histórie nevidno, ktoré commity patrili k jednému PR.
