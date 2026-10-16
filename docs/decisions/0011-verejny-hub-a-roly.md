# 0011 – Verejný Hub s výberom roly a dve úrovne Akadémie

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško
- Nahrádza: 0010 (bod 3 – zoznam základných rolí, čiastočne); rozhodnutie F3 „obsah len pre prihlásených“

## Kontext

Akadémia má fungovať v dvoch úrovniach. Verejný Hub (Stupeň I) pomáha komukoľvek nájsť sa v 11 oblastiach podľa
roly; po prihlásení (Stupeň II, Moja Akadémia) prichádzajú pozície v klube, úlohy a hodnotenia. Najnovší návrh Hubu
(„dve dráhy“) má výber roly, preusporiadanie oblastí, vety pre rolu, blok „Začnite tu“, výber klubu a dve dráhy
(Klub v obci, Akadémia profesionálneho klubu – náčrt). Doteraz bol obsah (Metodika, Prax, Kompas) len pre prihlásených.

## Rozhodnutie

1. **Verejné bez prihlásenia:** Hub, 11 oblastí (Metodika aj Prax) a Kompas na vyskúšanie **bez uloženia**
   (výsledok zostáva v prehliadači). Uloženie, odoslanie mentorovi, licenčné hodnotenie a Moja Akadémia len po prihlásení.
2. **Roly na verejnom Hube:** Celý klub (bez filtra), Manažér a výbor, Tréner a trénerka, Rodič, **Dobrovoľník**
   (doterajší „Tímový hráč klubu“), **Hráč / hráčka** (nahrádza „Mladí v klube 15–25“), Mentor zväzu a **Fanúšik**
   (len verejný Hub, bez roly v klube).
3. **Hráč / hráčka:** ponuka možností uplatnenia v klube; neskôr aj hodnotenie klubu očami hráča (ako sa v klube cíti,
   čo by zlepšil) – pri hráčoch do 18 rokov so súhlasom zákonného zástupcu.
4. **Rola na Hube** preusporiada oblasti a zobrazí vety pre rolu a „Začnite tu“; platí aj v detaile oblasti:
   sekcie Metodiky pre rolu sú hore a zvýraznené, ostatné pod nimi; **všetky sekcie sú zbalené a rozbalia sa kliknutím**.
   Sekcie Metodiky dostanú označenie rolí (návrh pripraví Claude, schváli Cyril).
5. **Rola sa pamätá** v prehliadači a v adrese (`?rola=…`); po prihlásení sa predvolí rola z klubu a dá sa prepnúť.
6. **Texty pre roly** (poradie oblastí, veta pri oblasti, „Začnite tu“) sú spravovaný obsah v katalógu rolí (ADR 0010).
7. **Dve dráhy:** model počíta s dráhou Klub v obci aj Akadémia profesionálneho klubu; druhá sa zobrazí s oblasťami
   ako „pripravujeme“ a obsah sa vypracuje neskôr.
8. **Výber klubu** na Hube (pilotné kluby, verejné počty zo Sportnetu ako vo Vizitke); vyhľadávanie neskôr.

## Dôsledky

- Metodika, Prax a obsahové API sa otvoria pre neprihlásených (čítanie); úpravy zostávajú len adminovi.
- Katalóg rolí sa rozšíri o roly Hubu, dráhy a texty pre roly; oblasti 4 sa týka premenovanie roly (názov oblasti otvorený).
- Poradie: dokončiť F6b, potom Hub, potom F6c (Naši tréneri) a F6d (postup v Praxi).

## Zamietnuté alternatívy a prečo

- **Obsah len pre prihlásených** – Hub má osloviť aj ľudí bez účtu, napr. rodičov a dobrovoľníkov.
- **Rola mení len poradie oblastí** – v detaile má byť Metodika prioritne pre rolu.
- **Len sekcie pre rolu, ostatné skryté** – človek by stratil prehľad o celej oblasti.
- **Vynechať dráhu profesionálnych akadémií** – bude potrebná, obsah sa vypracuje.
