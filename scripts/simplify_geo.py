import json, sys
from shapely.geometry import shape, mapping
from shapely import set_precision

SRC = "/app/frontend/public/geo/landuse.geojson"
OUT = "/app/frontend/public/geo/landuse_min.geojson"
KEEP = ["fid", "UPI", "gtn1", "nama", "luas_h"]
TOL = 0.00010  # ~11m

d = json.load(open(SRC))
out_feats = []
kept = 0
for f in d["features"]:
    try:
        g = shape(f["geometry"])
        g = g.simplify(TOL, preserve_topology=True)
        if g.is_empty:
            continue
        g = set_precision(g, 0.00001)  # 5 decimal grid
        if g.is_empty:
            continue
        props = {k: f["properties"].get(k) for k in KEEP}
        out_feats.append({"type": "Feature", "properties": props, "geometry": mapping(g)})
        kept += 1
    except Exception:
        continue

fc = {"type": "FeatureCollection", "features": out_feats}
json.dump(fc, open(OUT, "w"), separators=(",", ":"))
print("features in", len(d["features"]), "out", kept)
