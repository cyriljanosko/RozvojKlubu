# NEXT – ďalšie kroky

Aktualizované: 27. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [ ] DS – dizajn podľa SFZ Design System (rozhodnuté 26. 10., ADR 0016): projekt predvolene vychádza z `@slovensky-futbalovy-zvaz/design-system` (^1), nové verzie prináša Dependabot denne ako PR; žiadne natvrdo zapísané farby.
  - [x] DS-1 – napojenie (PR #82, v produkcii `5b2daff`): balík z GitHub Packages (`.npmrc`, `NPM_GITHUB_TOKEN` v Actions, Dependabot a Verceli – nastavené 26. 10.), tokeny namiesto farieb shadcn, písmo SF Pro (namiesto Geist), tmavá téma podľa zariadenia, logo SFZ (variant D) v hlavičke, Dependabot s privátnym registrom.
  - [ ] DS-2 a DS-3 nahradil redesign (ADR 0018, nižšie) – farby aj komponenty sa riešia pri prepise skupín.
- [ ] Redesign a Sportnet (zadanie Cyrila 26. 10., plán `docs/dizajn/plan-redesignu.md`): celá aplikácia vyhradne v SFZ Design System bez dočasného shadcn (ADR 0018), prepracované rozloženie a UX, verejné vs. prihlásené podľa roly v klube, hlavné menu a podmenu; potom Sportnet (prihlásenie, roly, číselníky).
  - [x] R0 – ADR 0018, pravidlo v `CLAUDE.md`, skill `sfz-ui` (PR #88).
  - [x] R1 – analýza obrazoviek, model prístupov, menu (`docs/dizajn/analyza-obrazoviek.md`, PR #88), rozhodnutia v kap. 8.
  - [x] R2a – návrh skupiny 1 schválený 26. 10. (plátno https://claude.ai/artifact/9QUPTrsQ2KiRHh2SweNbkb).
  - [x] R2b – návrh skupín 2–5 na tom istom plátne (15 obrazoviek) schválený 26. 10.
  - [ ] R3 – technický základ (postup schválený 26. 10., `docs/dizajn/plan-redesignu.md`): R3.1 vrstva `src/components/sfz`, R3.2 navigačný model, R3.3 rám aplikácie hneď pre celú appku, R3.4 lint + Playwright; PR do sfz-design-system s chýbajúcimi ikonami.
    - [x] R3.1 – vrstva `src/components/sfz` (PR #89): komponenty DS za klientskou hranicou, `AppNavBar`, `AppTabBar`, `LinkTabs`, akordeón, ukazovateľ postupu, pásma z tokenov.
    - [x] R3.2 – navigačný model `src/lib/navigation.ts` (PR #90). Stránky `/viac`, členovia a nastavenia klubu, číselníky a Sportnet v administrácii model zatiaľ nemá – pribudnú s R3.3, R4 a S3.
    - [x] R3.3 – rám aplikácie (PR #91): `AppFrame` v root layoute, `/viac`, `klub/[clubId]/layout.tsx`, `admin/layout.tsx`. Stará `src/components/site-header.tsx` zmazaná so súhlasom 28. 10.
    - [x] R3.4 – lint pravidlá dizajnu a Playwright screenshoty v CI (PR #92, ADR 0019).
    - [x] PR do sfz-design-system: ikony `map`, `map-pin`, `compass`, `book-open`, `star`, `Accordion` a `ProgressBar` (Slovensky-futbalovy-zvaz/sfz-design-system#1, 28. 10.). Po vydaní verzie: nahradiť vlastný akordeón a ukazovateľ postupu v `src/components/sfz` a hviezdu z lucide v `pin-button.tsx`.
  - [x] Opravy prístupov z analýzy obrazoviek (kap. 3.3), každá vlastný PR: zlúčené bod 1 (PR #93), bod 2 (PR #94), bod 3 (PR #95), bod 5 (PR #96); bod 4 – admin SFZ mení súhlas s rebríčkom za klub (rozhodnutie Cyrila 28. 10., ADR 0020, PR #97).
  - [ ] R4… – prepis po skupinách; potom odstrániť shadcn (so súhlasom).
    - [x] G1a – Akadémia (Hub), Oblasti, Prihlásenie (PR #98). Rozdelenie G1 na 4 PR – Cyril 28. 10.
    - [x] G1b – detail oblasti `/oblasti/[area]` (Metodika v akordeóne podľa roly, Prax na kartách so Stepperom) – PR #101.
    - [x] G1c – Kompas na vyskúšanie (PR #102): nový formulár Kompasu (spoločný s Kompasom klubu), vyskúšanie bez klubu, prenos odpovedí do Kompasu klubu (Cyril 28. 10.).
    - [x] G1d – Kluby (`/vizitka`) a vizitka klubu (PR #104): záložky Mapa / Rebríčky so všetkými funkciami, zoznam až po hľadaní, hviezdičky v modrej SFZ, vizitka spoločná pre verejnú aj klubovú (Cyril 28. 10.).
    - [ ] G2d – mentoring a návštevy (vetva `feat/g2d-mentoring-visits`): zoznam návštev je krok 3 na stránke Mentoring, `/navstevy` presmeruje, podmenu klubu bez položky Návštevy; formulár návštevy ostáva jeden so sekciami (Cyril 29. 10.).
    - [ ] Overiť na preview ako klubový manažér: Prax s uloženým postupom (G1b), prenos odpovedí a nový formulár v Kompase klubu (G1c), klubová vizitka (G1d). Ikony míľnikov a hviezda pinu po vydaní DS.
    - [ ] Vizuálne testy Akadémie, Oblastí, detailu oblasti, Kompasu a Klubov potrebujú testovacie dáta (stránky čítajú MongoDB, CI databázu nemá) – navrhnúť riešenie.
    - [ ] `src/components/search/search-form.tsx` zmazať (so súhlasom), keď ho po prepise `/hladat` nič nepoužije.
  - [ ] S1 – prihlásenie cez sportnet.online; S2 – roly zo sportnet.online (zmena schémy – súhlas); S3 – číselníky a administrácia (obrazovky G5). Robí kolega z LTK Solutions paralelne s redesignom – zadanie `docs/sportnet/zadanie-s1-s3.md` (28. 10.); otvorené otázky v jeho časti 8.
  - [x] Artifact „SFZ Design System“ v Claude Design (z repozitára sfz-design-system, 26. 10.): https://claude.ai/artifact/YMgD4uTMvAci1YvDWQESp3 – vzhľad overí Cyril a nastaví ho ako predvolený dizajn systém pre návrhy obrazoviek.
- [x] Upgrade Next.js 16.4.0 → 16.4.3 (bezpečnostná oprava) – PR #83 (`6210a90`). Dependabot PR #85 (minor a patch) – rozhodne Cyril.

- [x] Mapa produktu z návrhov v artifactoch (`docs/produkt/mapa-produktu.md`) – schválená 16. 10., roly v klube v ADR 0004.
- [ ] Pilot Stupňa II podľa mapy, časť 11 (F1 → F7). Rozsah: Vizitka, Kompas v aplikácii s odoslaním mentorovi, Moja Akadémia (vedenie, tréner, mentor), Naši tréneri; 10 pilotných klubov z Vizitky.
- [x] F2 – roly v klube a dáta pilotných klubov – PR #14 (zlúčený 16. 10.).
  - Snapshot (10 klubov, 19 sezón) nahratý do `rozvojklubu_dev`, Cyril: admin SFZ, vedenie FK v Nižnom Žipove, mentor 10 klubov.
  - Snapshot leží len v `data/private/` na Macu – pri inom počítači treba súbor preniesť mimo gitu.
- [x] F3 – spravovaný obsah (rozhodnuté 16. 10.: Markdown + `react-markdown`, len pre prihlásených, obsah môže byť vo verejnom gite, história zmien, „platné k“ a dátum revízie).
  - [x] F3a – oblasti a 220 otázok Kompasu v2 (vetva `feat/content-catalog`), naplnené v `rozvojklubu_dev`.
  - [x] F3a – PR #15.
  - [x] F3b – Metodika 11 oblastí (106 sekcií v `rozvojklubu_dev`) – PR #16.
  - [x] F3c – Prax oblastí 3 a 4 (`area_practice` naplnené) – PR #17.
  - [ ] Prax pre ďalšie oblasti – keď vznikne obsah (model je spoločný).
  - [x] Ukladanie postupu klubu v Praxi – F6d (PR #39–#41); ukazovatele neskôr.
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
  - [x] Hub (ADR 0011) – v produkcii 16. 10. (`4501576`): verejný Hub s výberom roly (Celý klub, Manažér a výbor, Tréner a trénerka, Rodič, Dobrovoľník, Hráč / hráčka, Mentor zväzu, Fanúšik), preusporiadanie oblastí, vety pre rolu, „Začnite tu“, výber klubu, dve dráhy (Akadémia profesionálneho klubu „pripravujeme“); Metodika a Prax verejne; Metodika podľa roly (sekcie zbalené, pre rolu hore); Kompas na vyskúšanie bez uloženia.
    - [x] H1 – verejné čítanie oblastí (Metodika, Prax) a Kompas na vyskúšanie bez uloženia; kategórie len z vybraného klubu – PR #31 (zlúčený 16. 10.).
    - [x] H2 – katalóg rolí v2 (roly Hubu, dráhy, texty rolí); premenovať rolu aj oblasť 4 na „Dobrovoľníci“ (rozhodnuté 16. 10.) (vetva `feat/roles-v2`): katalóg v2 a premenovanie (58 zmien, schválené) zapísané do DB s históriou – PR #32 (zlúčený 16. 10.).
    - [x] H3 – Hub na `/` (dráhy, roly, výber klubu, oblasti podľa roly, „Začnite tu“, Kompas, O Akadémii; druhá dráha „pripravujeme“) – PR #33 (zlúčený 16. 10.).
    - [x] H5 – nová úvodná obrazovka (rozhodnuté 16. 10.):
      - [x] H5a – verejná – PR #36 (zlúčený 16. 10.): úvod Akadémie s obrázkom → „Kto ste v klube?“ (karty rolí) → Kompas ako informácia s odkazom → oblasti (pri role 3 prioritné, ďalšie oblasti roly ako ďalšie kroky, ostatné stručne; bez roly všetkých 11) → na záver Kompas s výberom klubu. Profesionálna akadémia do päty („pripravujeme“).
      - [x] H5b – po prihlásení – PR #37 (zlúčený 16. 10., v produkcii `5d9f0ba`; prihlásený pohľad overený lokálne, na produkcii nie – prehliadač nie je prihlásený): Vizitka klubu (hodnotenie) → úlohy z Moja Akadémia → slabé oblasti podľa Kompasu; mentor vidí svoje kluby so stavom Kompasu.
      - [x] Mentor zväzu na pozadí: rolu na úvode, v Metodike a v Praxi vidí len prihlásený mentor a admin SFZ (PR #37).
      - [x] H5c – „Ako Akadémia funguje“ pre neprihlásených: Vizitka klubu (zoznam pilotných klubov), 1. úroveň samoštúdium, 2. úroveň po prihlásení (komunikácia „pripravujeme“, mentor zväzu) – PR #38 (zlúčený 16. 10., v produkcii `16c2e65`, overené na 375 px).
      - [ ] Obrázok v úvode je zatiaľ ilustrácia; nahradiť fotkou SFZ (dodá Cyril).
    - [x] H7 – stránka „O Akadémii“ `/o-akademii` – PR #43 (zlúčený 17. 10.): základné info, pomoc klubom na každej úrovni a v každej oblasti, prečo futbal v obci, benefity klubu (obec, škola, rodiny, mladí), význam športovania cez futbal (komunita, zdravie, výchova); krátke texty s ikonami, bez čísel; odkaz z úvodu, z päty a ikonou v hlavičke.
    - [x] Video „Akadémia za 8 minút“ na `/o-akademii` (YouTube neverejné, načíta sa po kliknutí) – PR #44 (zlúčený 17. 10., v produkcii `713faf6`, prehranie overené).
    - [x] „Prečo 11 oblastí“ na `/o-akademii` – PR #47 (zlúčený 17. 10.); ikony a ihrisko v perspektíve (vetva `feat/eleven-icons`, 18. 10., PR na review): jedenástka 1-4-3-3 – brankár Vedenie; obrana Financie, Právo, Dáta, Prostredie; stred Manažér, Tréneri, Dobrovoľníci; útok Hráč, Aktivity, Marketing; po kliknutí okno s opisom oblasti a odkazom na detail.
    - [ ] Infografika „Ako Akadémia funguje“ – návrh ukázaný 17. 10., odložené.
    - [ ] Neskôr (téma do budúcnosti, rozhodnuté 17. 10.): „Vypočuť si“ Metodiku – audio pri každej sekcii a playlist celej oblasti (napr. v aute). Pre auto treba nahovorené MP3 neurónovým hlasom sk-SK (hlas prehliadača sa pri zamknutom telefóne zastaví), úložisko súborov, kľúč poskytovateľa a prepis ~420 riadkov tabuliek do viet; odhad ~430 000 znakov, ~7 h audia.
    - [ ] Neskôr: pri návrate na holé `/` sa zapamätaný výber obnoví až v prehliadači (krátko sa ukáže predvolená rola) – zvážiť cookie namiesto `localStorage`.
    - [x] H4 – Metodika podľa roly: označenie 106 sekcií navrhne a nasadí Claude ako návrh, neskôr ho skontroluje pracovná skupina; môže navrhnúť aj doplnenie obsahu (vetva `feat/methodology-roles`): hotové, katalóg v5 v DB (súhlas 16. 10.) – PR #34 (zlúčený 16. 10.).
    - [ ] Pracovná skupina: skontrolovať označenie sekcií rolami (napr. Manažér a výbor má v oblasti 8 zvýraznených 12 z 13 sekcií; fanúšik v oblasti 3 žiadnu).
    - [ ] Neskôr: knižnica vzorov s dokumentmi (PDF, Word, Excel, obrázky) – úložisko súborov rozhodnúť.
    - [x] H6 – vyhľadávanie – PR #42 (zlúčený 17. 10., tipy schválené): pole na úvodnej stránke pod blokom „Ako Akadémia funguje“ a v hlavičke; prehľadáva oblasti, Metodiku, Prax a vzory a kluby (Vizitka), bez otázok Kompasu; bez diakritiky a so skloňovaním; výsledky na `/hladat`, `GET /api/v1/search`; rýchle tipy pod poľom (návrh, schváli Cyril); mentorská Prax len pre mentorov.
    - [ ] Neskôr: hodnotenie klubu očami hráča (do 18 r. so súhlasom zákonného zástupcu); obsah dráhy Akadémia profesionálneho klubu.
  - [x] Návšteva mentora (rozhodnuté 21. 10., z analýzy FAF/DFB): mentor zväzu a admin SFZ zapisujú návštevu (dátum, forma, prítomní menom, zhrnutie, zistenia pri vybraných oblastiach, dohodnuté kroky – čo, oblasť, kto, do kedy); rozpracovaná → odoslaná klubu → zrušená (nič sa nemaže); vedenie a tréner čítajú odoslané a odškrtávajú kroky; kroky ako úlohy v Moja Akadémia; v neverejnej Vizitke posledná návšteva a otvorené kroky; bez e-mailu zatiaľ.
    - [x] MV-a – kolekcia `mentor_visits`, služba, API – PR #53 (zlúčený 21. 10.).
    - [x] MV-b – formulár mentora – PR #54 (zlúčený 21. 10.): prítomní zo zoznamu ľudí s rolou v klube + voľné pole (pole `participantIds`), pripomienka minulej návštevy a najslabších oblastí, zrušenie aj po odoslaní, úprava krokov po odoslaní. Overiť po prihlásení v prehliadači.
    - [x] MV-c – PR #55 (zlúčený 21. 10.): zodpovedný za krok sa vyberá z ľudí klubu (alebo iná osoba textom); úlohu vidí zodpovedný a na kontrolu vedenie klubu (pri textovom zodpovednom len vedenie); krok po termíne naliehavý; klub môže splnenie vrátiť; klub odškrtáva v detaile návštevy; prehľad mentora (posledná návšteva, otvorené a po termíne) a súhrnná úloha „kluby bez návštevy v sezóne“; riadok v neverejnej Vizitke.
  - [x] Plán klubu na sezónu (rozhodnuté 21. 10., z analýzy FAF/DFB – EFQM „smer“): zostavuje vedenie a mentor, tréner číta; ponuka 2 cieľov z najslabších oblastí Kompasu + tlačidlo na ďalšie (najviac 10); oblasť povinná; stav nezačatý / rozbehnutý / splnený (mení aj zodpovedný); mentor môže plán potvrdiť (nepovinné); pri každom cieli povinný „text pre verejnú Vizitku“ s vysvetlením, ako ho písať – verejná Vizitka ukáže oblasť, tento text a stav, bez mien; úlohy pri termíne zodpovednému a vedeniu; neverejná Vizitka a prehľad mentora.
    - [x] CP-a – kolekcia `club_plans`, služba, API – PR #57 (zlúčený 21. 10.).
    - [x] CP-b – PR #58 (zlúčený 22. 10.): stránka plánu (zostavenie, stavy, potvrdenie); verejná Vizitka „Na čom klub tento rok pracuje“ s oblasťou, verejným textom a stavom; úloha 14 dní pred termínom a po ňom; „Zostaviť plán sezóny“ až po vyplnení Kompasu; potvrdenie ostáva pri úprave s poznámkou „upravené po potvrdení“; prehľad mentora a súhrn „bez plánu“; ciele v pripomienke pri návšteve.
  - [x] Analýza – pracovná plocha s panelmi (rozhodnuté 22. 10.): pre admina SFZ (celý pilot), mentora (svoje kluby, Kompas len odoslaný) a vedenie klubu (vlastný klub + anonymný priemer klubov rovnakej veľkosti, len ak sú aspoň 3); dáta Kompas, licenčné hodnotenie, aktivita v Akadémii, Sportnet v čase; filtre sezóna / ObFZ / veľkosť, porovnanie klubov, usporiadanie panelov (v prehliadači), export CSV a PDF cez tlač (Excel zatiaľ nie); odkaz v Moja Akadémia a pre admina v hlavičke; grafy Recharts, sieťový graf Cytoscape.js (súhlas s oboma závislosťami) – uzly oblasti, roly, úlohy klubu, ľudia (ľudia len pre vedenie, mentora, admina), prepínač mapa Akadémie / mapa klubu.
    - [x] DA-a – výpočty a API podľa roly, bez novej kolekcie (PR #59).
    - [x] DA-b – stránka `/analyza`, 4 panely, filtre, mobil (PR #60).
    - [x] DA-c – porovnanie klubov, usporiadanie panelov, export (PR #62).
    - [x] DA-d – sieťový graf (PR #63). Ťuknutie prstom na skutočnom telefóne overí Cyril.
    - [ ] Sieťový graf: Cytoscape odmieta farbu menoviek `lab(…)` z CSS (menovky môžu mať náhradnú farbu) a hlási vlastnú citlivosť kolieska – opraviť (navrhnuté ako samostatná úloha).
  - [x] Moja Akadémia ako nástenka (rozhodnuté 22. 10., ADR 0012): dlaždice s posúvaním a skrytím, pripínanie obľúbených hviezdičkou (oblasť, sekcia Metodiky, krok a vzor Praxe, Vizitka, plán a návštevy klubu), prepínač klubu pri viacerých kluboch, malý graf Kompasu, vlastné dlaždice pre admina a mentora; uložené v účte (kolekcia `user_preferences`, súhlas).
    - [x] MD-a – kolekcia `user_preferences`, služba, API (PR #64).
    - [x] MD-b – nástenka v Moja Akadémia (PR #65). Dva stĺpce od 1024 px overiť na počítači.
    - [x] MD-c – hviezdička „Pripnúť“ a dlaždica Obľúbené (PR #66).
  - [x] Mentoring klubu (rozhodnuté 22. 10., ADR 0013, podľa vzoru mentoringu EYA): sezónny cyklus – úvodné sebahodnotenie klubu (vedenie), zameranie rozvoja od mentora (1–3 prioritné oblasti), stretnutia (návštevy s témou, naplánovaním, úlohou vopred, hodnotením v štyroch poliach a hodnotením krokov), záver klubu a mentora s plánom na ďalšiu sezónu; pripomienky klubu k mentoringu vidí mentor a admin SFZ; kolekcia `club_mentoring` a nové polia v `mentor_visits` (súhlas).
    - [x] MC-a – model a API (PR #67).
    - [x] MC-b – rozšírená návšteva v UI vrátane hodnotenia podľa tém (PR #68, ADR 0014).
    - [x] MC-c – stránka Mentoring klubu (PR #69).
    - [x] MC-d – úlohy, nástenka, Vizitka a prehľady (PR #70, v produkcii `aca4c0b`).
    - [ ] Po prvom skutočnom uložení mentoringu overiť index `club_mentoring` cez `explain`; úlohy záveru sezóny skontrolovať v máji.
  - [ ] Vizitky klubov na mape (rozhodnuté 26. 10.): verejná stránka `/vizitka` – mapa SR (RFZ / ObFZ, farba podľa počtu klubov, klik = filter), filtre (názov, RFZ, ObFZ, veľkosť), zoznam verejných Vizitiek; zatiaľ pilotné kluby; hranice z geoBoundaries (OSM, ODbL); odkaz z úvodu a z hlavičky.
    - [x] VK-a – mapa, filtre a zoznam (PR #75, v produkcii `37f86dd`).
    - [x] Tabuľka okres → ObFZ skontrolovaná Cyrilom (26. 10.).
    - [x] VK-b – rebríčky v `/vizitka` (PR #77, v produkcii `e9b3501`); blok hľadania pod mapou, zoznam až po hľadaní (PR #78, `de5ed81`).
  - [ ] Mentorský smer (rozhodnuté 26. 10.): prioritne pomôcť klubom a ľuďom v klube, hodnotenie a rebríčky majú motivovať.
    - [ ] MR – motivačné rebríčky (ADR 0015): súhlas klubu (opt-in, vedenie), Kompas potvrdený mentorom (odznak), najväčší posun oproti minulej sezóne, míľniky sezóny, verejne len top 3 v každej veľkosti + hviezdy bez poradia.
      - [x] MR-a – dáta a API: kolekcia `club_settings` (súhlas), `confirmedAt`/`confirmedBy` v `kompas_submissions` (PR #79, v produkcii `fb735d7`).
      - [x] MR-b – pravidlá (rozhodnuté 26. 10.): kluby bez súhlasu v zozname neutrálne bez hviezd, verejne všetkých 6 míľnikov, posun v bodoch aj hviezdach, top 3 vždy (aj menej klubov); `GET /api/v1/vizitky` – vetva `feat/mr-b-ranking-rules`, PR #80 (v produkcii `51f7f4a`). Top 3 a posun s ozajstnými dátami overiť po prvom súhlase klubu.
      - [x] MR-c – rozhranie (rozhodnuté 26. 10.): súhlas vo Vizitke klubu + úloha vedenia, kým nerozhodne; „Potvrdiť Kompas“ na detaile odoslaného Kompasu + úloha mentora; odznak „potvrdené mentorom“ v rebríčku aj vo verejnej Vizitke (pri každom klube); míľniky v rebríčku, vo verejnej Vizitke (so súhlasom) a dlaždica v Moja Akadémia – PR #81 (v produkcii `38c20da`). Prepínač súhlasu a tlačidlo potvrdenia overiť v preview s účtom vedenia a mentora.
    - [ ] DK – karta „Váš ďalší krok“ v Moja Akadémia a sprievodca „Prvých 30 dní v Akadémii“.
    - [ ] ZK – sekcia „Zo života klubov“: príbehy klubov (so súhlasom klubu), odporúčania, novinky Akadémie; úvod (3 najnovšie), `/novinky`, pri oblasti, dlaždica v Moja Akadémia, neskôr v e-maile; bez chatu.
    - [ ] EM – e-mailové prihlasovanie (dotiahne Cyril) a týždenný súhrn „čo vás čaká“ a pochvala po splnení cieľa.
    - [ ] PS – spätná väzba z pilotu: krátka anketa po každej fáze, rozhovory s 2 – 3 klubmi.
  - [ ] F6c – Naši tréneri: kategória → tréner → licencia, upozornenia, náhradník (dopĺňa vedenie). Odložené 22. 10. (návrh a otázky v devlogu); treba rozhodnúť zdroj licencií.
  - [x] Prepojenie na web SFZ (rozhodnuté 22. 10.): v oblasti 3 odkaz na futbalsfz.sk pri prvej zmienke školenia, licencie a kontinuálneho vzdelávania v Metodike a Praxi, rozbaľovací rozcestník „Vzdelávanie trénera“ a dlaždica v Moja Akadémia – PR #72 (v produkcii `4265fc6`, 38 odkazov v oblasti 3).
    - [ ] Neskôr: rozšíriť automatické odkazy na ďalšie oblasti (napr. Ochrana detí v oblasti 11, ISSF v oblasti 10) – stačí doplniť `areas` v súbore.
  - [x] F6d – postup v Praxi (rozhodnuté 17. 10.): spoločný za klub, oblasť a sezónu; zapisuje vedenie a tréner, mentor číta; bez prihlásenia sa neukladá; nie vo Vizitke; ukazovatele a čísla mentora neskôr.
    - [x] F6d-a – kolekcia `practice_progress` (index `clubId + season + area`), služba, `GET|PUT /api/v1/clubs/:clubId/practice/:area` – PR #39 (zlúčený 17. 10.).
    - [x] F6d-b – UI v Praxi: úlohy prvého kroku, výber možnosti a „hotové“ pri kroku, priebeh roly, výber klubu – PR #40 (zlúčený 17. 10.).
    - [ ] Neskôr: zvýrazniť celú kartu zvolenej možnosti (dnes len tlačidlo „Zvolené“).
    - [x] F6d-c – úloha „pokračujte krokom…“ v Moja Akadémia a na úvodnej obrazovke, postup pri slabej oblasti – PR #41 (zlúčený 17. 10.). Úloha sa ukáže až keď klub v Praxi začal.
  - [ ] Neskôr: rodič a tímový hráč klubu pozvánkou (F7), mladí v klube po vyriešení súhlasu zákonného zástupcu; platnosť licencie a kurz ochrany detí, keď budú dáta zo Sportnetu/ISSF.
- [ ] Zdroj licencií trénerov pre F6 (Naši tréneri) – zatiaľ zo snapshotu.
- [ ] Sportnet API: verejné čítacie rozhranie existuje (kluby, družstvá, súpisky), zatiaľ ho nepoužívame (ADR 0005). Neverejné API s kľúčom – zistiť.

- [ ] F1 – zostáva:
  - [ ] Overiť prihlásenie na preview (čaká na Ecomail alebo Sportnet pre Preview).
  - [ ] Overiť názov hlavičky Ecomail API (`key`) pri prvom reálnom odoslaní – nepodarilo sa potvrdiť z dokumentácie.
  - [ ] Overiť názvy claimov v Sportnet ID tokene (meno, e-mail) po registrácii klienta.

## Závislosti

- [ ] TypeScript 7 (Dependabot PR #5) – čaká na podporu v typescript-eslint (`eslint-config-next`); dovtedy TS 5.9.

## Pred prvými ostrými dátami

- [ ] Samostatná databáza pre Preview (vlastný DB používateľ, iné `MONGODB_URI`/`MONGODB_DB` pre Preview vo Verceli). Naliehavejšie: skúšky (návštevy, mentoring, obľúbené) dnes zapisujú do tej istej databázy ako produkcia – mentoring sa preto nedal vyskúšať uložením.
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
