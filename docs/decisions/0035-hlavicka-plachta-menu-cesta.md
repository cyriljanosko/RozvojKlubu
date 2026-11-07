# 0035 – Hlavička s plachtou menu, cestou a hľadaním

- Stav: **prijaté** – 7. 11. 2026; návrh schválil Ján Letko („Schvaľujem, fáza 1“), Cyril potvrdí zlúčením PR
- Dátum: 2026-11-07
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0016 (SFZ Design System), 0018 (UI len z komponentov SFZ), 0019 (vizuálne testy)
- Návrh: `docs/dizajn/hlavicka-ai-navrh.md` (fáza 1 z 4; AI odpovede, `ai_usage` a MCP sú samostatné ADR)

## Kontext

Hlavička mala druhý riadok s hlavnou navigáciou (desktop) a na mobile spodnú lištu s položkou „Viac“, ktorá
viedla na stránku `/viac`. Administrácia mala na mobile vlastnú vysúvaciu lištu (Drawer). Používateľ nevidel,
kde v štruktúre je (klub → Kompas → odoslaný Kompas), a hľadanie bolo len na stránke `/hladat`.

Ján zadal 7. 11. 2026 prerobiť hlavičku a menu podľa contineo.app: tlačidlo plachty pred logom, uprostred pole
na hľadanie (neskôr aj otázky na AI), cesta (breadcrumb) pod hlavičkou. Dizajn systém SFZ 1.5.1 nemá plachtu
menu, spodnú plachtu, cestu ani pole s okamžitým hľadaním.

## Rozhodnutie

1. **Hlavička v jednom riadku:** tlačidlo plachty · logo s nápisom „Akadémia“ · pole hľadania · avatar alebo
   „Prihlásiť sa“. Druhý riadok s navigáciou odpadá (otázka Q1 návrhu – len plachta).
2. **Plachta menu (`MenuSheetButton`, `MenuPanel`):** na desktope panel pod hlavičkou so stĺpcami Hlavné ·
   aktívny klub · Ďalšie · Správa. Obsah z jednej funkcie `menuSections()` v `src/lib/navigation.ts` – rovnaké
   položky a oprávnenia ako doteraz (role klubu, mentor, admin). Bez JavaScriptu je tlačidlo odkaz na `/viac`,
   ktorá ukáže to isté menu ako stránku.
3. **Mobil:** spodná lišta ostáva; prihlásený používateľ má namiesto „Viac“ položku „Menu“, ktorá otvorí spodnú
   plachtu (`BottomSheet`) nad lištou s tým istým `MenuPanel` v dvoch stĺpcoch. Návštevník má v lište všetky
   hlavné položky, plachtu otvára tlačidlo v hlavičke. Mobilná lišta a Drawer administrácie odpadajú – Správa je
   stĺpec plachty (otázka Q2 návrhu). Na desktope ostáva bočné menu administrácie.
4. **Cesta (`Breadcrumbs`):** skladá sa z adresy stránky (`breadcrumbs()`), nie z histórie prehliadača. Názvy
   klubov dodá server z rámca; oblasti zatiaľ „Oblasť N“. Na mobile len rodič so šípkou späť a aktuálna stránka.
   Domov, Moja akadémia a vývojové stránky cestu nemajú.
5. **Hľadanie v hlavičke (`HeaderSearch`):** okamžité výsledky z existujúceho `GET /api/v1/search` (najviac 6,
   od 2 znakov, 200 ms oneskorenie), šípky a Enter, ⌘K / Ctrl+K, Esc. Na mobile ikona otvorí celoobrazovkové
   hľadanie. Bez JavaScriptu formulár na `/hladat`. Žiadne AI – tá je fáza 2.
6. Plachty zatvára ×, klik mimo, Esc, výber položky a zmena stránky (stav je viazaný na adresu). Focus ide do
   plachty a späť na tlačidlo.
7. Chýbajúce komponenty sú zložené z tokenov v `src/components/sfz` a navrhnuté do SFZ Design System (PR do
   `sfz-design-system`).

## Dôsledky

- Jedna definícia menu pre desktop, mobil aj `/viac`; nová položka sa pridá na jednom mieste.
- `AppNavBar` už nemá riadok navigácie; vizuálne základy `ukazky-*` a `prihlasenie-*` sa menia (ADR 0019 – nové
  Linux screenshoty z CI v tomto PR).
- Pole hľadania volá API pri písaní; na produkcii je to rovnaký dotaz ako stránka `/hladat`, bez nového indexu.
- Keď dizajn systém komponenty prevezme, obaly v `src/components/sfz` sa nahradia importom z balíka.

## Zamietnuté alternatívy a prečo

- **Plachta aj riadok navigácie na desktope** – dve cesty k tým istým odkazom, viac miesta v hlavičke; Ján
  zvolil len plachtu (Q1).
- **Drawer administrácie na mobile popri plachte** – dve vysúvacie menu na jednej obrazovke; Správa je stĺpec
  plachty (Q2).
- **Cesta z histórie prehliadača** – po príchode z odkazu alebo obnovení stránky by bola iná; z adresy je
  stabilná a funguje bez JavaScriptu na serveri aj klientovi.
- **Modal dizajn systému ako plachta** – centrovaný dialóg so scrimom cez celú obrazovku zakrýva spodnú lištu
  a nepripomína menu; plachta pod hlavičkou a nad lištou nechá navigáciu viditeľnú.
