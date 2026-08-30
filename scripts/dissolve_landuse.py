import json
from collections import defaultdict
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

SRC = "/app/frontend/public/geo/landuse_min.geojson"
OUT = "/app/frontend/public/geo/landuse_min.geojson"
TOL = 0.00012


def round_coords(obj, nd=5):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(obj[0]), nd), round(float(obj[1]), nd)]
        return [round_coords(x, nd) for x in obj]
    return obj


d = json.load(open(SRC))
groups = defaultdict(list)
total_area = defaultdict(float)
for f in d["features"]:
    cat = f["properties"].get("gtn1")
    if not cat:
        continue
    try:
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        if g.is_empty:
            continue
        groups[cat].append(g)
        total_area[cat] += float(f["properties"].get("luas_h") or 0)
    except Exception:
        continue

out_feats = []
for cat, geoms in groups.items():
    try:
        merged = unary_union(geoms)
        if not merged.is_valid:
            merged = merged.buffer(0)
        merged = merged.simplify(TOL, preserve_topology=True)
        if not merged.is_valid:
            merged = merged.buffer(0)
    except Exception as e:
        print("union fail", cat, e)
        merged = unary_union([g.buffer(0) for g in geoms]).simplify(TOL, preserve_topology=True)
    if merged.is_empty:
        continue
    gj = mapping(merged)
    gj = {"type": gj["type"], "coordinates": round_coords(gj["coordinates"])}
    out_feats.append({
        "type": "Feature",
        "properties": {"gtn1": cat, "count": len(geoms), "luas_h": round(total_area[cat], 2)},
        "geometry": gj,
    })
    print(cat, len(geoms))

fc = {"type": "FeatureCollection", "features": out_feats}
json.dump(fc, open(OUT, "w"), separators=(",", ":"))
print("dissolved features:", len(out_feats))
