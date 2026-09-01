"""Spatial cross-analysis of the built-in GeoJSON layers for the AI copilot.
Computes waste-class distribution, land-use areas, and a waste x land-use
crosstab (which land use dominates high/critical waste zones). Cached in-memory.
"""
from __future__ import annotations

import json
import os
from collections import defaultdict
from typing import Any, Optional

from shapely.geometry import shape
from shapely.prepared import prep

GEO_DIR = "/app/frontend/public/geo"
WASTE = os.path.join(GEO_DIR, "pop_waste.geojson")
LANDUSE = os.path.join(GEO_DIR, "landuse_min.geojson")

WASTE_BREAKS: list[tuple[str, float, float]] = [
    ("Very Low", 0, 19.16),
    ("Low", 19.16, 30.47),
    ("Moderate", 30.47, 47.22),
    ("High", 47.22, 83.02),
    ("Critical", 83.02, 1e9),
]

_cache: Optional[dict[str, Any]] = None


def _classify(v: Optional[float]) -> Optional[str]:
    if v is None:
        return None
    for label, _lo, hi in WASTE_BREAKS:
        if v <= hi:
            return label
    return "Critical"


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _load_landuse_categories() -> tuple[list[tuple[str, Any]], dict[str, float]]:
    """Return prepared land-use geometries per category and their area (ha)."""
    landuse = json.load(open(LANDUSE))
    cats: list[tuple[str, Any]] = []
    landuse_area: dict[str, float] = {}
    for f in landuse["features"]:
        cat = f["properties"].get("gtn1")
        try:
            geom = shape(f["geometry"])
        except Exception:
            continue
        cats.append((cat, prep(geom)))
        landuse_area[cat] = round(_to_float(f["properties"].get("luas_h")) or 0, 1)
    return cats, landuse_area


def _match_category(feature: dict[str, Any], cats: list[tuple[str, Any]]) -> Optional[str]:
    try:
        pt = shape(feature["geometry"]).representative_point()
    except Exception:
        return None
    for cat, pg in cats:
        if pg.contains(pt):
            return cat
    return None


def _build_crosstab(cats: list[tuple[str, Any]]) -> tuple[dict, dict]:
    """Return (class_stats, crosstab) for the waste layer against land-use."""
    waste = json.load(open(WASTE))
    class_stats: dict = defaultdict(lambda: {"count": 0, "tonnes": 0.0})
    crosstab: dict = defaultdict(lambda: defaultdict(float))
    for f in waste["features"]:
        recy = _to_float(f["properties"].get("recy_annual_t"))
        cls = _classify(recy)
        if cls is None:
            continue
        class_stats[cls]["count"] += 1
        class_stats[cls]["tonnes"] += recy
        matched = _match_category(f, cats)
        if matched:
            crosstab[cls][matched] += recy
    return class_stats, crosstab


def _top_cats(d: dict[str, float], n: int = 4) -> list[dict[str, Any]]:
    total = sum(d.values()) or 1
    items = sorted(d.items(), key=lambda x: -x[1])[:n]
    return [{"category": k, "tonnes": round(v, 1), "pct": round(v / total * 100)} for k, v in items]


def _hotzone(crosstab: dict) -> dict[str, float]:
    hotzone: dict = defaultdict(float)
    for cls in ("High", "Critical"):
        for cat, t in crosstab.get(cls, {}).items():
            hotzone[cat] += t
    return hotzone


def compute_insights() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache

    cats, landuse_area = _load_landuse_categories()
    class_stats, crosstab = _build_crosstab(cats)

    _cache = {
        "waste_classes": [
            {"label": lbl, "count": class_stats[lbl]["count"], "tonnes": round(class_stats[lbl]["tonnes"], 1)}
            for lbl, _lo, _hi in WASTE_BREAKS if lbl in class_stats
        ],
        "landuse_area_ha": landuse_area,
        "per_class_dominant": {cls: _top_cats(crosstab[cls]) for cls in crosstab},
        "hotzone_dominant": _top_cats(_hotzone(crosstab)),
    }
    return _cache


def _waste_lines(ins: dict[str, Any]) -> tuple[str, str]:
    label = "Annual Recyclable Waste (graduated, recy_annual_t t/yr)"
    wc = ", ".join(f"{c['label']}={c['count']} zones/{c['tonnes']}t" for c in ins["waste_classes"])
    return label, f"Waste class distribution: {wc}"


def _landuse_lines(ins: dict[str, Any]) -> tuple[str, str]:
    label = "Current Land Use / Guna Tanah (gtn1)"
    la = ", ".join(f"{k} {v}ha" for k, v in sorted(ins["landuse_area_ha"].items(), key=lambda x: -x[1]))
    return label, f"Land-use area by category: {la}"


def _cross_lines(ins: dict[str, Any]) -> list[str]:
    hz = ", ".join(f"{c['category']} ({c['pct']}%, {c['tonnes']}t)" for c in ins["hotzone_dominant"])
    lines = [f"CROSS-ANALYSIS — land use dominating HIGH+CRITICAL waste zones (by recyclable tonnage): {hz}"]
    for cls, tops in ins["per_class_dominant"].items():
        t = ", ".join(f"{c['category']} {c['pct']}%" for c in tops[:3])
        lines.append(f"  {cls} waste zones dominated by: {t}")
    return lines


def layer_context_text(layer_ids: Optional[list[str]] = None) -> str:
    """Build an authoritative text block for the copilot based on active layers."""
    ins = compute_insights()
    want_waste = layer_ids is None or "builtin-waste-recy" in layer_ids
    want_landuse = layer_ids is None or "builtin-landuse" in layer_ids

    lines = ["=== ACTIVE MAP LAYER DATA (authoritative — use for spatial questions) ==="]
    active: list[str] = []
    if want_waste:
        label, line = _waste_lines(ins)
        active.append(label)
        lines.append(line)
    if want_landuse:
        label, line = _landuse_lines(ins)
        active.append(label)
        lines.append(line)
    if want_waste and want_landuse:
        lines.extend(_cross_lines(ins))
    lines.insert(1, "Active layers: " + ("; ".join(active) if active else "none"))
    lines.append("=== END LAYER DATA ===")
    return "\n".join(lines)
