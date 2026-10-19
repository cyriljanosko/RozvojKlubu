# 0009 – Zrušenie odoslania Kompasu adminom

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško

## Kontext

Odoslaný Kompas je zmrazená kópia (F4c) a od ADR 0007 sa posledné odoslanie ukazuje aj na verejnej Vizitke.
Skúšobné odoslanie FK v Nižnom Žipove z F4c (z testovacích odpovedí) je tak verejne vidieť. Odoslanie sa
nedalo vziať späť – jediná náprava by bolo ručné mazanie v databáze. Pri licenčnom hodnotení to rieši
znovuotvorenie sezóny bez mazania (ADR 0008).

## Rozhodnutie

1. **Admin SFZ** môže konkrétne odoslanie **zrušiť** (tlačidlo s potvrdením v detaile odoslanej verzie,
   `POST /api/v1/clubs/:clubId/kompas/submissions/:submissionId/withdraw`).
2. **Nič sa nemaže:** odoslanie dostane `status: "withdrawn"`, `withdrawnAt`, `withdrawnBy` a zostáva v histórii
   s označením „zrušené“ (staršie odoslania bez `status` sa berú ako platné).
3. Zrušené odoslanie sa **nepočíta** vo verejnej Vizitke, Vizitke pre roly, prehľade mentora ani v riadku
   `SFZ-KOMPAS-1` na kopírovanie – platí posledné nezrušené odoslanie, inak „zatiaľ neodoslané“.
4. Pracovná verzia Kompasu sa nemení; klub môže odoslať znova. Zrušenie sa nedá vrátiť (nové odoslanie áno).

## Dôsledky

- `kompas_submissions` dostáva voliteľné polia `status`, `withdrawnAt`, `withdrawnBy`; index sa nemení (nie je unikátny).
- Vedenie, tréner ani mentor odoslanie zrušiť nemôžu – odoslanie je pre mentora záväzné.

## Zamietnuté alternatívy a prečo

- **Zmazať odoslanú kópiu** – stratí sa stopa; rovnaký princíp ako ADR 0008.
- **Zrušenie aj pre vedenie klubu** – mentor by nemal istotu, čo klub odoslal.
