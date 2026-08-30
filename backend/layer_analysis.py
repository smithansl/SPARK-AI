"""Spatial cross-analysis of the built-in GeoJSON layers for the AI copilot.
Computes waste-class distribution, land-use areas, and a waste x land-use
crosstab (which land use dominates high/critical waste zones). Cached in-memory.
"""
import json
import os
from collections import defaultdict

from shapely.geometry import shape
from shapely.prepared import prep

GEO_DIR = "/app/frontend/public/geo"
WASTE = os.path.join(GEO_DIR, "pop_waste.geojson")
LANDUSE = os.path.join(GEO_DIR, "landuse_min.geojson")

WASTE_BREAKS = [
    ("Very Low", 0, 19.16),
    ("Low", 19.16, 30.47),
    ("Moderate", 30.47, 47.22),
    ("High", 47.22, 83.02),
    ("Critical", 83.02, 1e9),
]

_cache = None


def _classify(v):
    if v is None:
        return None
    for label, lo, hi in WASTE_BREAKS:
        if v <= hi:
            return label
    return "Critical"


def compute_insights():
    global _cache
    if _cache is not None:
        return _cache

    waste = json.load(open(WASTE))
    landuse = json.load(open(LANDUSE))

    # Prepare land-use category geometries
    cats = []
    landuse_area = {}
    for f in landuse["features"]:
        cat = f["properties"].get("gtn1")
        try:
            geom = shape(f["geometry"])
        except Exception:
            continue
        cats.append((cat, prep(geom)))
        landuse_area[cat] = round(float(f["properties"].get("luas_h") or 0), 1)

    class_stats = defaultdict(lambda: {"count": 0, "tonnes": 0.0})
    # crosstab[class_label][landuse_cat] = tonnes
    crosstab = defaultdict(lambda: defaultdict(float))

    for f in waste["features"]:
        p = f["properties"]
        recy = p.get("recy_annual_t")
        cls = _classify(recy if not isinstance(recy, str) else float(recy)) if recy is not None else None
        if cls is None:
            continue
        class_stats[cls]["count"] += 1
        class_stats[cls]["tonnes"] += float(recy)
        try:
            pt = shape(f["geometry"]).representative_point()
        except Exception:
            continue
        matched = None
        for cat, pg in cats:
            if pg.contains(pt):
                matched = cat
                break
        if matched:
            crosstab[cls][matched] += float(recy)

    def top_cats(d, n=4):
        total = sum(d.values()) or 1
        items = sorted(d.items(), key=lambda x: -x[1])[:n]
        return [{"category": k, "tonnes": round(v, 1), "pct": round(v / total * 100)} for k, v in items]

    # combined High + Critical
    hotzone = defaultdict(float)
    for cls in ("High", "Critical"):
        for cat, t in crosstab.get(cls, {}).items():
            hotzone[cat] += t

    _cache = {
        "waste_classes": [
            {"label": lbl, "count": class_stats[lbl]["count"], "tonnes": round(class_stats[lbl]["tonnes"], 1)}
            for lbl, _, _ in WASTE_BREAKS if lbl in class_stats
        ],
        "landuse_area_ha": landuse_area,
        "per_class_dominant": {cls: top_cats(crosstab[cls]) for cls in crosstab},
        "hotzone_dominant": top_cats(hotzone),
    }
    return _cache


def layer_context_text(layer_ids=None):
    """Build an authoritative text block for the copilot based on active layers.
    layer_ids: list of active layer ids from the client (builtin-waste-recy / builtin-landuse).
    """
    ins = compute_insights()
    want_waste = layer_ids is None or "builtin-waste-recy" in layer_ids
    want_landuse = layer_ids is None or "builtin-landuse" in layer_ids

    lines = ["=== ACTIVE MAP LAYER DATA (authoritative — use for spatial questions) ==="]
    active = []
    if want_waste:
        active.append("Annual Recyclable Waste (graduated, recy_annual_t t/yr)")
        wc = ", ".join(f"{c['label']}={c['count']} zones/{c['tonnes']}t" for c in ins["waste_classes"])
        lines.append(f"Waste class distribution: {wc}")
    if want_landuse:
        active.append("Current Land Use / Guna Tanah (gtn1)")
        la = ", ".join(f"{k} {v}ha" for k, v in sorted(ins["landuse_area_ha"].items(), key=lambda x: -x[1]))
        lines.append(f"Land-use area by category: {la}")
    if want_waste and want_landuse:
        hz = ", ".join(f"{c['category']} ({c['pct']}%, {c['tonnes']}t)" for c in ins["hotzone_dominant"])
        lines.append(f"CROSS-ANALYSIS — land use dominating HIGH+CRITICAL waste zones (by recyclable tonnage): {hz}")
        for cls, tops in ins["per_class_dominant"].items():
            t = ", ".join(f"{c['category']} {c['pct']}%" for c in tops[:3])
            lines.append(f"  {cls} waste zones dominated by: {t}")
    lines.insert(1, "Active layers: " + ("; ".join(active) if active else "none"))
    lines.append("=== END LAYER DATA ===")
    return "\n".join(lines)
