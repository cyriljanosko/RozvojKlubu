# 0008 – Znovuotvorenie uzavretej sezóny licenčného hodnotenia

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško
- Nahrádza: 0006 (bod 3 – „upravovať sa dá, kým nie je uzavretá“, čiastočne)

## Kontext

Podľa ADR 0006 uzavretie sezóny uloží zmrazenú kópiu a sezónu natrvalo zamkne. Pri teste na preview (zdieľa
databázu s produkciou) sa uzavrela sezóna 2026/2027 FK v Nižnom Žipove a verejná Vizitka ukázala testovacie údaje.
Bez možnosti znovu otvoriť sezónu by jediná náprava bola ručné mazanie v databáze.

## Rozhodnutie

1. **Admin SFZ** môže uzavretú sezónu **znovu otvoriť** (tlačidlo s potvrdením, `POST /api/v1/clubs/:clubId/licensing/reopen`).
2. **Nič sa nemaže:** uzavretá kópia dostane `status: "reopened"`, `reopenedAt`, `reopenedBy` a zostáva v histórii.
3. Pracovná verzia zostáva, dá sa upraviť a sezóna sa dá znovu uzavrieť (nová kópia).
4. Platné je len uzavretie so `status` „closed“ (staršie bez `status` sa berú ako „closed“); Vizitka a obrazovka
   hodnotenia otvorené uzavretia ignorujú.
5. Unikátny index `{ clubId, season }` v `licensing_submissions` platí **len pre platné uzavretia**
   (čiastočný index `club_season_closed`, `partialFilterExpression: { status: "closed" }`).

## Dôsledky

- Starý unikátny index `clubId_1_season_1` treba raz zrušiť (so súhlasom), inak by sa sezóna nedala znovu uzavrieť.
- Uzavretia pred týmto ADR nemajú `status` a čiastočný index ich nepokrýva; jediné také (Žipov 2026/2027) sa pri
  znovuotvorení označí ako „reopened“.
- Vedenie ani mentor sezónu znovu otvoriť nemôžu – uzavretie je pre klub záväzné.

## Zamietnuté alternatívy a prečo

- **Jednorazovo zmazať uzavretú kópiu** – stratí sa stopa a pri ďalšej chybe treba znovu ručný zásah.
- **Presun do archívnej kolekcie** – tiež mazanie a nová kolekcia navyše.
- **Znovuotvorenie aj pre vedenie / mentora** – uzavretie by stratilo zmysel.
