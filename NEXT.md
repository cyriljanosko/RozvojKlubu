# NEXT – ďalšie kroky

Aktualizované: 16. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [x] Mapa produktu z návrhov v artifactoch (`docs/produkt/mapa-produktu.md`) – schválená 16. 10., roly v klube v ADR 0004.
- [ ] Pilot Stupňa II podľa mapy, časť 11 (F1 → F7). Rozsah: Vizitka, Kompas v aplikácii s odoslaním mentorovi, Moja Akadémia (vedenie, tréner, mentor), Naši tréneri; 10 pilotných klubov z Vizitky.
- [ ] F2 – roly v klube a dáta pilotných klubov (vetva `feat/club-memberships`): hotové a overené lokálne 16. 10., čaká na PR.
  - Snapshot (10 klubov, 19 sezón) nahratý do `rozvojklubu_dev`, Cyril: admin SFZ, vedenie FK v Nižnom Žipove, mentor 10 klubov.
  - Snapshot leží len v `data/private/` na Macu – pri inom počítači treba súbor preniesť mimo gitu.
- [ ] F3 – spravovaný obsah (rozhodnuté 16. 10.: Markdown + `react-markdown`, len pre prihlásených, obsah môže byť vo verejnom gite, história zmien, „platné k“ a dátum revízie).
  - [x] F3a – oblasti a 220 otázok Kompasu v2 (vetva `feat/content-catalog`), naplnené v `rozvojklubu_dev`.
  - [x] F3a – PR #15.
  - [ ] F3b – Metodika 11 oblastí (vetva `feat/content-methodology`): hotové a overené lokálne, 106 sekcií v `rozvojklubu_dev`, čaká na PR (po #15).
  - [ ] F3c – Prax oblastí 3 a 4 (vetva `feat/content-practice`): hotové a overené lokálne, `area_practice` naplnené, čaká na PR (po #16).
  - [ ] Prax pre ďalšie oblasti – keď vznikne obsah (model je spoločný).
  - [ ] Ukladanie postupu klubu v Praxi (odškrtnuté kroky, zvolený variant, ukazovatele) – F6 Moja Akadémia.
- [x] F4 – Kompas klubu v aplikácii (rozhodnuté 16. 10.: vypĺňa vedenie, tréner číta, mentor vidí len odoslané; kategórie len zo Sportnetu; bez ručného režimu; pri odoslaní zmrazená kópia; Vizitka pre obec neskôr).
  - [x] F4a – výpočet, model, API – PR #18 (zlúčený 16. 10.).
  - [x] F4b – vyplnenie a výsledok v UI – PR #19 (zlúčený 16. 10.).
  - [x] F4c – odoslanie mentorovi (zmrazená kópia), pohľad mentora, export `SFZ-KOMPAS-1` – PR #20 (zlúčený 16. 10.).
- [x] F5 – licenčné hodnotenie a Vizitka klubu (ADR 0006, 0007) – v produkcii 16. 10. (`281f5f4`).
  - [x] F5a – pravidlá, výpočet, model, API – PR #21 (zlúčený 16. 10.).
  - [x] Znovuotvorenie sezóny adminom (ADR 0008) – PR #25 (zlúčený 16. 10.); index zmenený, Žipov 2026/2027 otvorený a vstupy prázdne.
  - [x] Zrušenie odoslania Kompasu adminom (ADR 0009) – PR #27 (zlúčený 16. 10.); skúšobné odoslanie Žipova zrušené, verejná Vizitka „zatiaľ neodoslané“.
  - [x] F5b – licenčné hodnotenie v UI – PR #22 (zlúčený 16. 10.).
  - [x] F5c – Vizitka klubu (ADR 0007): verejná `/vizitka/[clubId]` a pre roly `/klub/[clubId]/vizitka`, Kompas a licenčné hodnotenie vedľa seba za sezónu – PR #23 (zlúčený 16. 10.).
  - [ ] Neskôr: tlač / PDF Vizitky, vizitka pre obec.
  - [ ] Neskôr: levely klubu (malý / stredný / veľký podľa počtu hráčov) a 1–5 hviezd, samostatne pre Kompas a licenčné hodnotenie – pravidlo zatiaľ chýba.
- [ ] F6 – Moja Akadémia (rozhodnuté 16. 10., ADR 0010).
  - [x] F6a – roly ako spravovaný obsah: 6 základných rolí a roly v 11 oblastiach podľa návrhu z 11. 10., editor admina, „vedenie“ → „Manažér a výbor“ – PR #29 (zlúčený 16. 10.).
  - [x] F6b – nástenka `/moja-akademia` pre manažéra a výbor, trénera a mentora; vlastné roly v oblastiach; prehľad mentora presunúť sem – PR #30 (zlúčený 16. 10.).
  - [ ] Hub (ADR 0011, po F6b): verejný Hub s výberom roly (Celý klub, Manažér a výbor, Tréner a trénerka, Rodič, Dobrovoľník, Hráč / hráčka, Mentor zväzu, Fanúšik), preusporiadanie oblastí, vety pre rolu, „Začnite tu“, výber klubu, dve dráhy (Akadémia profesionálneho klubu „pripravujeme“); Metodika a Prax verejne; Metodika podľa roly (sekcie zbalené, pre rolu hore); Kompas na vyskúšanie bez uloženia.
    - [x] H1 – verejné čítanie oblastí (Metodika, Prax) a Kompas na vyskúšanie bez uloženia; kategórie len z vybraného klubu – PR #31 (zlúčený 16. 10.).
    - [x] H2 – katalóg rolí v2 (roly Hubu, dráhy, texty rolí); premenovať rolu aj oblasť 4 na „Dobrovoľníci“ (rozhodnuté 16. 10.) (vetva `feat/roles-v2`): katalóg v2 a premenovanie (58 zmien, schválené) zapísané do DB s históriou – PR #32 (zlúčený 16. 10.).
    - [x] H3 – Hub na `/` (dráhy, roly, výber klubu, oblasti podľa roly, „Začnite tu“, Kompas, O Akadémii; druhá dráha „pripravujeme“) – PR #33 (zlúčený 16. 10.).
    - [ ] H5 – nová úvodná obrazovka (rozhodnuté 16. 10.):
      - [x] H5a – verejná – PR #36 (zlúčený 16. 10.): úvod Akadémie s obrázkom → „Kto ste v klube?“ (karty rolí) → Kompas ako informácia s odkazom → oblasti (pri role 3 prioritné, ďalšie oblasti roly ako ďalšie kroky, ostatné stručne; bez roly všetkých 11) → na záver Kompas s výberom klubu. Profesionálna akadémia do päty („pripravujeme“).
      - [ ] H5b – po prihlásení (vetva `feat/hub-signed-in`, hotové a overené lokálne na 375 px, PR na review): Vizitka klubu (hodnotenie) → úlohy z Moja Akadémia → slabé oblasti podľa Kompasu; mentor vidí svoje kluby so stavom Kompasu.
      - [ ] Obrázok v úvode je zatiaľ ilustrácia; nahradiť fotkou SFZ (dodá Cyril).
    - [ ] Neskôr: pri návrate na holé `/` sa zapamätaný výber obnoví až v prehliadači (krátko sa ukáže predvolená rola) – zvážiť cookie namiesto `localStorage`.
    - [ ] H4 – Metodika podľa roly: označenie 106 sekcií navrhne a nasadí Claude ako návrh, neskôr ho skontroluje pracovná skupina; môže navrhnúť aj doplnenie obsahu (vetva `feat/methodology-roles`): hotové, katalóg v5 v DB (súhlas 16. 10.), overené lokálne, PR #34 na review.
    - [ ] Pracovná skupina: skontrolovať označenie sekcií rolami (napr. Manažér a výbor má v oblasti 8 zvýraznených 12 z 13 sekcií; fanúšik v oblasti 3 žiadnu).
    - [ ] Neskôr: knižnica vzorov s dokumentmi (PDF, Word, Excel, obrázky) – úložisko súborov rozhodnúť.
    - [ ] Neskôr: vyhľadávanie v oblastiach a otázkach Kompasu; hodnotenie klubu očami hráča (do 18 r. so súhlasom zákonného zástupcu); obsah dráhy Akadémia profesionálneho klubu.
  - [ ] F6c – Naši tréneri: kategória → tréner → licencia, upozornenia, náhradník (dopĺňa vedenie).
  - [ ] F6d – postup v Praxi (kroky, varianty).
  - [ ] Neskôr: rodič a tímový hráč klubu pozvánkou (F7), mladí v klube po vyriešení súhlasu zákonného zástupcu; platnosť licencie a kurz ochrany detí, keď budú dáta zo Sportnetu/ISSF.
- [ ] Zdroj licencií trénerov pre F6 (Naši tréneri) – zatiaľ zo snapshotu.
- [ ] Sportnet API: verejné čítacie rozhranie existuje (kluby, družstvá, súpisky), zatiaľ ho nepoužívame (ADR 0005). Neverejné API s kľúčom – zistiť.

- [ ] F1 – zostáva:
  - [ ] Overiť prihlásenie na preview (čaká na Ecomail alebo Sportnet pre Preview).
  - [ ] Overiť názov hlavičky Ecomail API (`key`) pri prvom reálnom odoslaní – nepodarilo sa potvrdiť z dokumentácie.
  - [ ] Overiť názvy claimov v Sportnet ID tokene (meno, e-mail) po registrácii klienta.

## Pred prvými ostrými dátami

- [ ] Samostatná databáza pre Preview (vlastný DB používateľ, iné `MONGODB_URI`/`MONGODB_DB` pre Preview vo Verceli).
- [ ] Atlas: upgrade z M0 a obmedzenie DB používateľa len na svoju databázu.

## Čaká na niekoho iného

- [ ] Registrácia OAuth klienta v Sportnete (auth.sportnet.online) – client_id, client_secret, redirect URI.
- [ ] Ecomail: API kľúč a overená odosielateľská doména (DNS SPF/DKIM u správcu ltk.solutions).
- [ ] Ochrana vetvy `main` na GitHube (Settings → Branches).
- [ ] Prístup Claude ku GitHubu (zatiaľ push robí Cyril).

## Ďalej v poradí

- [ ] F1 / Krok 3 – Microsoft Entra ID (tenant SFZ) – registrácia aplikácie v Azure.
- [ ] Dependabot PR s veľkými verziami (ESLint 10, TypeScript 7, @types/node 26, actions v7) – prejsť riadene.
- [ ] Zrušiť nepoužívaný cluster v Atlas „Project 0“ (rozhodne Cyril).
- [ ] CS a EN preklady (`messages/cs.json`, `messages/en.json`).
