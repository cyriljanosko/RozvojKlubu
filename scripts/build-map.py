"""Builds content/mapa-sr.json – simplified SVG paths of Slovak regions (kraje) and districts (okresy).

Source (download once, ODbL – © OpenStreetMap contributors, via geoBoundaries gbOpen 9469f09):
  https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SVK/ADM1/geoBoundaries-SVK-ADM1_simplified.geojson
  https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SVK/ADM2/geoBoundaries-SVK-ADM2_simplified.geojson

Usage: python3 scripts/build-map.py ADM1.geojson ADM2.geojson content/mapa-sr.json

District names in the source lost their diacritics; NAMES maps them to the official names.
"""
import sys, json, math
adm1, adm2, out = sys.argv[1], sys.argv[2], sys.argv[3]
NAMES = {
 "Banskk vtiavnica":"Banská Štiavnica","Bansks Bystrica":"Banská Bystrica","Bardejov":"Bardejov","Bonovce nad Bebra*":"Bánovce nad Bebravou",
 "Bratislava I":"Bratislava I","Bratislava II":"Bratislava II","Bratislava III":"Bratislava III","Bratislava IV":"Bratislava IV","Bratislava V":"Bratislava V",
 "Brezno":"Brezno","Bytca":"Bytča","Cadca":"Čadca","Detva":"Detva","Dolne Kub":"Dolný Kubín","Dunajskn Streda":"Dunajská Streda","Gala":"Šaľa",
 "Galanta":"Galanta","Gelnica":"Gelnica","Giar nad Hronom":"Žiar nad Hronom","Hlohovec":"Hlohovec","Humennn":"Humenné","Ilava":"Ilava",
 "Kermarok":"Kežmarok","Kolice I":"Košice I","Kolice II":"Košice II","Kolice III":"Košice III","Kolice IV":"Košice IV","Komprno":"Komárno",
 "Kovice - okolie":"Košice-okolie","Krupina":"Krupina","Kysucki Novi Mesto":"Kysucké Nové Mesto","Levice":"Levice","Levoca":"Levoča",
 "Liptovsk":"Liptovský Mikuláš","Lucenec":"Lučenec","Malacky":"Malacky","Martin":"Martin","Medzilaborce":"Medzilaborce","Michalovce":"Michalovce",
 "Myjava":"Myjava","Nitra":"Nitra","Nova Mesto nad Va*":"Nové Mesto nad Váhom","Nova Zkmky":"Nové Zámky","Numestovo":"Námestovo",
 "Partizonske":"Partizánske","Pezinok":"Pezinok","Piertany":"Piešťany","Pilina":"Žilina","Poltcr":"Poltár","Poprad":"Poprad",
 "Povacskn Bystrica":"Považská Bystrica","Prchov":"Púchov","Predov":"Prešov","Prievidza":"Prievidza","Revnca":"Revúca","Rimavsk":"Rimavská Sobota",
 "Ronnava":"Rožňava","Ruromberok":"Ružomberok","Sabinov":"Sabinov","Senec":"Senec","Senica":"Senica","Skalica":"Skalica","Snina":"Snina",
 "Sobrance":"Sobrance","Spieskn Novo Ves":"Spišská Nová Ves","Stark Lubovna":"Stará Ľubovňa","Stropkov":"Stropkov","Svidnsk":"Svidník",
 "Tarnovica":"Žarnovica","Topolcany":"Topoľčany","Trebi ov":"Trebišov","Trencon":"Trenčín","Trnava":"Trnava","Turcianske Teplice":"Turčianske Teplice",
 "Tvrdo":"Tvrdošín","Velka Krta":"Veľký Krtíš","Vranov nad Toplou":"Vranov nad Topľou","Zlatc Moravce":"Zlaté Moravce","Zvolen":"Zvolen",
}
KRAJE = {"Region of Banská Bystrica":"Banskobystrický","Region of Bratislava":"Bratislavský","Region of Košice":"Košický","Region of Nitra":"Nitriansky",
 "Region of Prešov":"Prešovský","Region of Trenčín":"Trenčiansky","Region of Trnava":"Trnavský","Region of Žilina":"Žilinský"}
RFZ = {"Bratislavský":"BFZ","Trnavský":"ZsFZ","Nitriansky":"ZsFZ","Trenčiansky":"ZsFZ","Žilinský":"SsFZ","Banskobystrický":"SsFZ","Prešovský":"VsFZ","Košický":"VsFZ"}
LAT0 = math.radians(48.7)
def proj(lon, lat): return (lon * math.cos(LAT0), -lat)
def rings(geom):
    if geom["type"] == "Polygon": return [geom["coordinates"]]
    return geom["coordinates"]
f1 = json.load(open(adm1))["features"]; f2 = json.load(open(adm2))["features"]
allpts = [proj(*p) for f in f1 for poly in rings(f["geometry"]) for ring in poly for p in ring]
minx = min(p[0] for p in allpts); maxx = max(p[0] for p in allpts); miny = min(p[1] for p in allpts); maxy = max(p[1] for p in allpts)
W = 1000.0; scale = W / (maxx - minx); H = (maxy - miny) * scale; PAD = 6
def xy(p):
    x, y = proj(*p); return ((x - minx) * scale + PAD, (y - miny) * scale + PAD)
def dp(pts, eps):
    if len(pts) < 3: return pts
    (x1,y1),(x2,y2) = pts[0], pts[-1]; dmax, idx = 0, 0
    for i in range(1, len(pts)-1):
        x0,y0 = pts[i]; dx, dy = x2-x1, y2-y1
        d = abs(dy*x0 - dx*y0 + x2*y1 - y2*x1) / (math.hypot(dx, dy) or 1)
        if d > dmax: dmax, idx = d, i
    if dmax > eps: return dp(pts[:idx+1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]
def path(geom, eps=1.2):
    out = []
    for poly in rings(geom):
        for ring in poly:
            full = [xy(p) for p in ring]
            # a closed ring: split at the middle so that Douglas-Peucker has a real chord
            mid = len(full) // 2
            pts = dp(full[: mid + 1], eps)[:-1] + dp(full[mid:], eps)
            if len(pts) < 4: continue
            out.append("M" + "L".join(f"{x:.0f},{y:.0f}" for x, y in pts[:-1]) + "Z")
    return "".join(out)
def inside(pt, geom):
    x, y = pt; hit = False
    for poly in rings(geom):
        ring = poly[0]
        for i in range(len(ring)):
            (x1,y1),(x2,y2) = ring[i], ring[i-1]
            if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: hit = not hit
    return hit
def centroid(geom):
    ring = rings(geom)[0][0]; return (sum(p[0] for p in ring)/len(ring), sum(p[1] for p in ring)/len(ring))
kraje = [{"id": KRAJE[f["properties"]["shapeName"]], "rfz": RFZ[KRAJE[f["properties"]["shapeName"]]], "path": path(f["geometry"])} for f in f1]
okresy = []
for f in f2:
    raw = f["properties"]["shapeName"].replace("District of ", "")
    name = NAMES[raw]
    c = centroid(f["geometry"])
    kraj = next((KRAJE[k["properties"]["shapeName"]] for k in f1 if inside(c, k["geometry"])), None)
    okresy.append({"id": name, "kraj": kraj, "path": path(f["geometry"], 1.0)})
assert len(set(o["id"] for o in okresy)) == 79, "district names must be unique"
missing = [o["id"] for o in okresy if not o["kraj"]]
data = {
  "source": "geoBoundaries SVK ADM1/ADM2 (gbOpen 9469f09) – © OpenStreetMap contributors, ODbL 1.0; zjednodušené pre web",
  "viewBox": f"0 0 {W + 2*PAD:.0f} {H + 2*PAD:.0f}",
  "kraje": sorted(kraje, key=lambda k: k["id"]),
  "okresy": sorted(okresy, key=lambda o: o["id"]),
}
json.dump(data, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print("viewBox", data["viewBox"], "missing kraj:", missing, "bytes", len(json.dumps(data, ensure_ascii=False, separators=(",", ":"))))
from collections import Counter; print(Counter(o["kraj"] for o in okresy))
