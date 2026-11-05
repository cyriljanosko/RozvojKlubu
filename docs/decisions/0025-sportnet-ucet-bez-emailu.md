# 0025 – Prihlásenie Sportnet účtom bez e-mailu sa odmietne s výzvou

- Stav: **prijaté** – rozhodnutie 5. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR #137
- Dátum: 2026-11-05
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0001 (Better Auth), 0002 (prihlásenie Sportnet, prepájanie účtov podľa e-mailu)
- Podklad: `docs/sportnet/odpovede-sportnet-online.md` (A8, R3)

## Kontext

sportnet.online 4. 11. odpovedali (A8), že **`email` v ID tokene nie je garantovaný** – účty prihlasované cez
ISSF ho mať nemusia. Better Auth e-mail používateľa vyžaduje a ADR 0002 prepája účty z rôznych spôsobov
prihlásenia podľa e-mailu. Dnešný `mapSportnetClaims` bez e-mailu vráti `null` a prihlásenie spadne na
všeobecnú chybu bez vysvetlenia.

## Rozhodnutie

1. Ak ID token Sportnetu neobsahuje `email`, **účet sa nezaloží a prihlásenie sa odmietne**.
2. Používateľ uvidí na stránke prihlásenia zrozumiteľnú výzvu (cez next-intl, podľa kódu chyby): jeho Sportnet
   účet nemá e-mail, nech si ho doplní v nastaveniach účtu Sportnet a prihlási sa znova; alebo nech použije
   prihlásenie e-mailovým odkazom. Presnú adresu nastavení účtu Sportnet overiť pri implementácii (S1).
3. Žiadne technické ani náhradné e-maily (`<sub>@…`) sa nevytvárajú.

## Dôsledky

- V MongoDB nevzniknú účty s falošnou adresou, ktoré by sa neskôr museli zlučovať; prepájanie podľa e-mailu
  (ADR 0002) ostáva spoľahlivé.
- Časť ľudí z ISSF sa prvýkrát neprihlási – pre pilot prijateľné, výzva im povie, čo urobiť.
- S1: chyba má vlastný kód (napr. `sportnet_email_missing`), text v `messages/sk.json`, test na mapovanie
  claims bez e-mailu a na zobrazenie výzvy.

## Zamietnuté alternatívy a prečo

- **Technický e-mail `<sub>@sportnet.invalid`** – účet by vznikol hneď, ale e-mailové notifikácie by nikam
  nechodili, prepájanie podľa e-mailu by nefungovalo a neskôr by bolo treba adresy meniť a účty zlučovať.
- **Vypýtať e-mail v aplikácii po prihlásení** – vlastný krok registrácie s overením adresy navyše; adresa by
  sa líšila od Sportnetu. Odložené, ak bude takých ľudí veľa.
