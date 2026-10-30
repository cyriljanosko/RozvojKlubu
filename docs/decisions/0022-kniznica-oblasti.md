# 0022 – Knižnica oblasti: dokumenty na stiahnutie

- Stav: navrhnuté (úložisko a limit veľkosti ešte prediskutuje Cyril s kolegom z LTK Solutions)
- Dátum: 2026-10-30
- Rozhodol: Cyril Janoško
- Číslo 0021 je obsadené návrhom ADR o rolách zo sportnet.online (PR #103).

## Kontext

Každá oblasť potrebuje knižnicu dokumentov, ktorá sa bude priebežne dopĺňať o nové podnety: vzory,
príručky, tabuľky, prezentácie. Dnešná „Knižnica vzorov“ v Praxi obsahuje len texty na skopírovanie
a súbory aplikácia neukladá vôbec (`NEXT.md`: „knižnica vzorov s dokumentmi – úložisko súborov
rozhodnúť“). Cyril 30. 10. 2026 zadal:

- rôzne formáty (PDF, Word, Excel…), každý dokument na stiahnutie,
- knižnica každej oblasti rozdelená na **verejnú** a **po prihlásení**,
- dokument sa môže zobraziť vo **viacerých oblastiach** – knižnica prepája oblasti a podporuje
  spoluprácu medzi nimi,
- dokumenty nahráva **len admin SFZ**,
- neprihlásený vidí aj dokumenty „po prihlásení“ (názov so zámkom) – **motivuje k prihláseniu**,
- stačí delenie verejné / po prihlásení (bez rolí),
- **počítadlo stiahnutí** pre admina.

## Rozhodnutie

1. **Nová kolekcia `library_items`** (spoločný obsah, nie dáta klubu – bez `clubId`, ADR 0003):
   `title`, `description`, `kind` (vzor, príručka, tabuľka, prezentácia, iné), `areas` (zoznam
   čísel 1–11, aspoň jedna – dokument sa zobrazí v knižnici každej z nich), `primaryArea` (oblasť,
   z ktorej dokument vznikol; pri ostatných sa ukáže „aj v oblasti …“), `access`
   (`public` | `signedIn`), `order`, `status` (`draft` | `published` | `hidden`), `file`
   (`name`, `mime`, `size`, `key` v úložisku, `uploadedAt`), `downloads` (počítadlo),
   `version`, `createdAt/By`, `updatedAt/By`. História zmien v revíziách ako pri Metodike a Praxi.
2. **Úložisko: Vercel Blob v súkromnom režime** (zatiaľ – Cyril prediskutuje s kolegom). Súbor nemá
   verejnú adresu; sťahuje sa len cez `GET /api/v1/kniznica/{id}/stiahnut`, ktorá overí prístup
   (`public` každý, `signedIn` len prihlásený, `draft`/`hidden` len admin SFZ), zvýši počítadlo
   a pošle súbor s `Content-Disposition: attachment` a pôvodným názvom.
3. **Nahrávanie len adminom SFZ** priamo z prehliadača do úložiska (klientsky upload s krátkodobým
   tokenom, ktorý vydá server až po overení admina) – obíde limit tela požiadavky na Verceli
   (4,5 MB). Server potom uloží záznam do `library_items`.
4. **Povolené formáty**: PDF, Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx),
   OpenDocument (odt, ods, odp), obrázky (png, jpg). Kontroluje sa koncovka aj typ súboru.
   Spustiteľné súbory a archívy (zip) nie. **Limit 25 MB** (zatiaľ – prediskutuje s kolegom).
5. **Výmena súboru** zachová `id` dokumentu – odkazy, pripnutia a vyhľadávanie fungujú ďalej;
   starý súbor sa z úložiska zmaže až po úspešnom nahratí nového.
6. **Mazanie**: najprv skrytie (`hidden`); natrvalo (záznam aj súbor) až potvrdením admina.
7. **Zobrazenie**: v detaile oblasti tretia záložka **Knižnica** (Metodika | Prax | Knižnica) –
   časti „Pre všetkých“ a „Po prihlásení“; neprihlásený vidí v druhej časti názvy so zámkom
   a tlačidlo „Prihlásiť sa“. Dokument z inej oblasti má štítok „aj v oblasti …“. Dokumenty sa dajú
   pripnúť do obľúbených a nájsť v Hľadaní (len tie, ktoré používateľ smie vidieť).
8. **Administrácia**: Administrácia → Obsah → oblasť → Knižnica (nahratie, názov, popis, typ,
   oblasti, prístup, poradie, výmena, skrytie, počet stiahnutí). Administráciu (G5) robí kolega
   v S3 – obrazovku spravíme po dohode s ním; služba a API sú od nej nezávislé.
9. Dnešná „Knižnica vzorov“ v Praxi ostáva (texty na skopírovanie); v záložke Knižnica sa zobrazí
   spolu s dokumentmi.

## Dôsledky

- Nová kolekcia a indexy (`areas` + `status`, poradie) – zmena schémy, potrebný súhlas Cyrila;
  index sa zapíše do `ARCHITECTURE.md`.
- Nová závislosť `@vercel/blob` a premenná prostredia `BLOB_READ_WRITE_TOKEN` (do `.env.example`
  bez hodnoty; úložisko vo Verceli zapne Cyril) – oboje so súhlasom.
- Služba `library.service.ts` (oprávnenia, filtrovanie podľa prístupu, počítadlo) s testami;
  úložisko za rozhraním `LibraryStorage`, aby testy nebežali proti Vercel Blob a úložisko sa dalo
  neskôr vymeniť (SharePoint SFZ, S3/R2).
- Preview zdieľa databázu s produkciou (CLAUDE.md, časť 7) – nahrávanie na Preview zapisuje do
  ostrých dát; skúšať treba opatrne, kým Preview nemá vlastnú databázu.
- Antivírusovú kontrolu nerobíme – nahráva len admin SFZ; ak budú nahrávať aj iní, treba ju doplniť.

## Zamietnuté alternatívy a prečo

- **MongoDB GridFS** – Atlas M0 má spolu 512 MB, súbory by vytlačili dáta aplikácie.
- **SharePoint / OneDrive SFZ** – vyžaduje registráciu aplikácie v Entra ID (ešte nie je); môže
  nahradiť Vercel Blob neskôr cez `LibraryStorage`.
- **Verejné adresy súborov v úložisku** – dokumenty „po prihlásení“ by sa dali stiahnuť bez
  prihlásenia, kto by poznal adresu.
- **Delenie podľa rolí v klube** – zatiaľ netreba (Cyril 30. 10.); dá sa doplniť po S2 ďalšou
  hodnotou `access`.
- **Kópia dokumentu v každej oblasti** – pri zmene by sa verzie rozišli; jeden dokument s viacerými
  oblasťami (`areas`) prepája oblasti.
