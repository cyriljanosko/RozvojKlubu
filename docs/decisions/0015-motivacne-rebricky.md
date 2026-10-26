# 0015 – Motivačné rebríčky

- Stav: prijaté
- Dátum: 2026-10-26
- Rozhodol: Cyril Janoško

## Kontext

Rebríčky vo Vizitkách (VK-b) porovnávajú úroveň klubov: Kompas a licencovanie v hviezdičkách,
celé poradie verejne a bez súhlasu klubov. Z mentorského pohľadu to slabšie kluby skôr
demotivuje – malý klub ostane dole roky, aj keď na sebe pracuje – a verejné poradie bez súhlasu
môže poškodiť vzťah, ktorý mentor s klubom buduje. Kompas je navyše sebahodnotenie, takže
verejný rebríček z neho zvádza k nadhodnoteniu.

## Rozhodnutie

1. **Súhlas klubu (opt-in).** Do verejného rebríčka ide len klub, ktorého **vedenie** dalo súhlas.
   Súhlas sa dá kedykoľvek zrušiť. Uložený je v novej kolekcii `club_settings` (jeden dokument na
   klub, unikátne `clubId`, optimistická verzia) – nie v `clubs`, ktorú prepisuje import zo
   Sportnetu. Kolekcia slúži aj na ďalšie nastavenia klubu (napr. súhlas so zverejnením príbehu).
2. **Potvrdenie Kompasu mentorom.** Mentor klubu v danej sezóne alebo admin SFZ môže odoslaný
   Kompas potvrdiť (a potvrdenie zrušiť). Polia `confirmedAt` a `confirmedBy` v `kompas_submissions`
   – bez migrácie, chýbajúce pole = nepotvrdené. Nový odoslaný Kompas je nepotvrdený, stiahnutý
   (ADR 0009) sa potvrdiť nedá. Potvrdenie je **odznak**, hviezdy sa počítajú rovnako.
3. **Pokrok.** „Najväčší posun“ = posledný platný Kompas sezóny oproti poslednému platnému Kompasu
   predchádzajúcej sezóny, v rámci rovnakej veľkosti klubu (MR-b).
4. **Míľniky sezóny** (MR-b): odoslaný Kompas, Kompas potvrdený mentorom, zostavený plán sezóny,
   splnený cieľ plánu, návšteva mentora, uzavreté licenčné hodnotenie. „Tréner na školení“ až keď
   budú údaje o školeniach (Naši tréneri).
5. **Verejne bez posledných miest** (MR-b): v každej veľkosti prví traja podľa úrovne aj podľa
   posunu; ostatné kluby so súhlasom len hviezdy a míľniky bez čísla poradia. Celé poradie vidí
   klub sám, jeho mentor a admin SFZ. Verejne sa nepíše „Kompas neodoslaný“.

## Dôsledky

- Kým žiadny klub nedá súhlas, verejný rebríček je prázdny – stránka vyzve kluby na zapojenie.
- Súhlas dáva len vedenie klubu, nie admin SFZ za klub.
- Kompas sa bude dať zobraziť s označením „potvrdené mentorom“ vo Vizitke aj v rebríčkoch (MR-c).

## Zamietnuté alternatívy a prečo

- **Opt-out alebo bez súhlasu** – verejné hodnotenie klubu bez jeho súhlasu nesedí s mentorským
  prístupom.
- **Do rebríčka len potvrdený Kompas** – závisel by od času mentorov; odznak stačí.
- **Pokrok od prvého Kompasu klubu** – dal by sa ovplyvniť častým odosielaním v jednej sezóne.
- **Súhlas ako pole v `clubs`** – kolekciu prepisuje import zo Sportnetu.
- **Celé poradie verejne** – posledné miesta demotivujú.
