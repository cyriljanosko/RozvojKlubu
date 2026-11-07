# 0034 – Audit log administrátorských a oprávňovacích zmien

- Stav: **prijaté** – 7. 11. 2026 (Ján Letko, SFZ) vrátane súhlasu s kolekciou `audit_log` (CLAUDE.md, časť 8)
- Dátum: 2026-11-07
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko
- Nadväzuje na: 0003 (tenant = klub), 0030 a 0031 (záznam behov synchronizácie)

## Kontext

Ján 7. 11. 2026: audit log je potrebný. Dnes aplikácia zaznamenáva len časti:

- `sync_runs` – kto a kedy spustil ručný beh synchronizácie (ADR 0030, 0031);
- `createdBy` / `updatedBy` na dokumentoch – len kto dokument založil a kto ho naposledy zmenil, nie celý priebeh;
- história verzií spravovaného obsahu (Kompas, Metodika, Prax, Katalóg rolí).

Chýba odpoveď na otázky typu „kto dal tomuto človeku rolu admina“, „kto odobral trénera z klubu“, „kto skryl
novinku“ alebo „kto znovu otvoril licenčné hodnotenie“. Odobratím člena alebo zmenou roly stopa zmizne úplne.
Logy Vercelu na to nestačia: uchovávajú sa krátko, nedajú sa filtrovať podľa klubu a konektor Vercelu ich nevie
čítať. Aplikácia narába s osobnými údajmi a s rolami v kluboch, takže SFZ ako prevádzkovateľ musí vedieť
preukázať, kto menil prístupy a dáta klubov.

## Rozhodnutie

1. **Kolekcia `audit_log`, len pripisovanie.** Služba záznamy len vkladá; v kóde nie je úprava ani mazanie
   jednotlivých záznamov.
2. **Tvar záznamu** (`AuditLogDoc` v `src/server/db/types.ts`):
   - `at` – čas zmeny;
   - `actorId` – ID používateľa (Better Auth), `null` pri automatickom behu; `actorRole` – jeho rola v tej chvíli;
   - `source` – `user` (zmena prihláseného používateľa – UI aj API idú cez tú istú službu a nerozlišujú sa),
     `cron` (beh bez používateľa) alebo `sportnet` (roly zo Sportnetu pri prihlásení, ADR 0021);
   - `action` – kód akcie v tvare `oblasť.objekt.sloveso`, napr. `user.role.change`, `club.member.add`,
     `news.hide`; zoznam kódov je v kóde ako `AUDIT_ACTIONS`;
   - `clubId` – klub, ktorého sa zmena týka, `null` pri spoločnom obsahu a účtoch (ADR 0003);
   - `target` – `{ type, id }` zmeneného objektu (napr. `membership`, ID členstva);
   - `changes` – len názvy polí a hodnoty bez osobných údajov (rola, stav, vek. kategórie), napr.
     `{ role: { from: "user", to: "admin_sfz" } }`.
3. **Bez kópií osobných údajov.** Do záznamu nejde meno, e-mail, IP adresa ani text novinky či odpovede.
   Mená sa doplnia pri čítaní z Better Auth, ako pri histórii synchronizácie (ADR 0031): zmazaný účet sa ukáže
   ako „neznámy používateľ“.
4. **Čo sa zaznamenáva – prvá etapa** (zmeny prístupov a administrátorské zásahy):
   - rola používateľa (`changeUserRole`);
   - členstvo v klube – pridanie, odobratie (`addClubMember`, `removeClubMember`) a roly zo Sportnetu, len keď
     sa naozaj zmenia (`syncSportnetClubRoles`);
   - novinky – zverejnenie, vrátenie klubu, skrytie, pripnutie;
   - licenčné hodnotenie – uzavretie a znovuotvorenie; Kompas – potvrdenie a stiahnutie odovzdania;
   - súhlas klubu s rebríčkom (`setRankingConsent`);
   - spravovaný obsah a Katalóg rolí – úprava a návrat k verzii (odkaz na verziu, nie obsah);
   - ručný zápis synchronizácie (odkaz na záznam v `sync_runs`).

   Bežná práca klubu (odpovede v Kompase, plán, postup v Praxi, osobné nastavenia) sa nezaznamenáva – má
   vlastný stav a jej objem by log zahltil.

   Ďalšia etapa: udalosti AI (otázky na obsah a údaje) pribudnú ako nové kódy v `AUDIT_ACTIONS` spolu
   s funkciou AI; náklady na AI po používateľoch rieši vlastné ADR (Ján, 7. 11. 2026).

5. **Zápis v service vrstve** cez `recordAudit(deps.audit, entry)` po úspešnej zmene, rovnako pre UI aj API
   (API-first). Keď zápis do logu zlyhá, zmena ostane platná a chyba sa zapíše do logu servera
   (`[audit] write failed`) – log nesmie zablokovať prácu admina.
6. **Čítanie len pre admina SFZ:** `GET /api/v1/admin/audit?clubId=&actorId=&action=&from=&to=&page=`,
   novšie prvé, 50 na stranu. Obrazovka v administrácii až podľa návrhu Cyrila. Klubový manažér a ObFZ
   log nevidia, kým sa to nerozhodne zvlášť.
7. **Indexy:** `{ clubId: 1, at: -1 }`, `{ actorId: 1, at: -1 }`, `{ at: -1 }`; zapíšu sa do `ARCHITECTURE.md`.
8. **Uchovanie 3 roky:** TTL index na `at` (`expireAfterSeconds` = 3 roky); `{ at: -1 }` z bodu 7 ho nahradí.

## Dôsledky

- Nová kolekcia a 3 indexy (súhlas Jána pred vytvorením). Odhad objemu: desiatky záznamov denne.
- Každá služba z bodu 4 dostane závislosť `audit` a jej testy overia, že vznikne záznam so správnym `action`
  a `clubId`, a že v ňom nie sú osobné údaje.
- Zmeny pred zavedením logu sa spätne nedoplnia; staré `createdBy` / `updatedBy` ostávajú.
- Preview zdieľa databázu s produkciou, takže skúšobné zmeny na Preview sa zapíšu do toho istého logu
  (`source` to nerozlíši) – vyrieši sa vlastnou databázou pre Preview (`NEXT.md`).
- Pri žiadosti o výmaz osobných údajov ostáva v logu len ID používateľa bez mena.

## Zamietnuté alternatívy a prečo

- **Len logy Vercelu (`console.info`)** – krátke uchovanie, bez filtra podľa klubu, nedostupné z aplikácie.
- **Polia `updatedBy` a história na každej kolekcii** – žiadny spoločný pohľad a pri zmazaní (odobratý člen)
  stopa zmizne.
- **MongoDB change streams** – potrebujú stále bežiaci proces, ktorý vo Vercel Functions nemáme, a nevedia,
  kto zmenu urobil.
- **Externá služba na audit** – nová závislosť a osobné údaje mimo našej databázy.
- **Zaznamenávať všetko vrátane práce klubu** – objem bez úžitku pre kontrolu prístupov.
- **Zablokovať zmenu, keď zlyhá zápis do logu** (transakcia) – pri výpadku by admin nemohol opraviť prístupy;
  zlyhanie sa zachytí v logu servera.
