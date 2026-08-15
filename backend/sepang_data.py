"""Realistic mock spatial dataset for Sepang, Selangor (SPARK).
Coordinates are approximate real locations within the Sepang district.
Waste figures are synthetic but internally consistent for demo/competition use.
"""

# --- Zones: the analytical spatial units of Sepang ---
# waste in tonnes/month, population, recovery_rate %, growth (annual %),
# land_use dominant, waste_type breakdown %, severity of hotspot
ZONES = [
    {
        "id": "labu-lanjut",
        "name": "Labu Lanjut East",
        "lat": 2.7355, "lng": 101.7602,
        "population": 18400,
        "waste_tonnes": 8.6,
        "recovery_rate": 61,
        "growth": 24,
        "land_use": "Commercial",
        "waste_types": {"Plastic": 34, "Organic": 29, "Paper": 18, "Metal": 9, "E-Waste": 6, "Other": 4},
        "severity": "critical",
        "collection_coverage": 68,
        "service_gap_km": 2.4,
        "drivers": {"Population growth": 42, "Commercial activity": 31, "Tourism": 18, "Other": 9},
    },
    {
        "id": "klia-sepang",
        "name": "KLIA / Sepang Utama",
        "lat": 2.7456, "lng": 101.7099,
        "population": 12200,
        "waste_tonnes": 11.2,
        "recovery_rate": 74,
        "growth": 19,
        "land_use": "Transport / Commercial",
        "waste_types": {"Plastic": 31, "Organic": 34, "Paper": 21, "Metal": 6, "E-Waste": 4, "Other": 4},
        "severity": "high",
        "collection_coverage": 82,
        "service_gap_km": 1.1,
        "drivers": {"Tourism": 46, "Commercial activity": 33, "Population growth": 14, "Other": 7},
    },
    {
        "id": "salak-tinggi",
        "name": "Bandar Baru Salak Tinggi",
        "lat": 2.8110, "lng": 101.7402,
        "population": 26800,
        "waste_tonnes": 9.4,
        "recovery_rate": 70,
        "growth": 16,
        "land_use": "Residential",
        "waste_types": {"Organic": 41, "Plastic": 26, "Paper": 17, "Metal": 7, "E-Waste": 5, "Other": 4},
        "severity": "medium",
        "collection_coverage": 88,
        "service_gap_km": 0.8,
        "drivers": {"Population growth": 54, "Commercial activity": 22, "Tourism": 10, "Other": 14},
    },
    {
        "id": "dengkil",
        "name": "Dengkil / Cyberjaya Fringe",
        "lat": 2.8503, "lng": 101.6802,
        "population": 31500,
        "waste_tonnes": 7.1,
        "recovery_rate": 66,
        "growth": 28,
        "land_use": "Mixed / Institutional",
        "waste_types": {"Organic": 33, "Plastic": 30, "Paper": 20, "Metal": 8, "E-Waste": 5, "Other": 4},
        "severity": "high",
        "collection_coverage": 71,
        "service_gap_km": 1.9,
        "drivers": {"Population growth": 48, "Commercial activity": 28, "Tourism": 9, "Other": 15},
    },
    {
        "id": "sungai-pelek",
        "name": "Sungai Pelek",
        "lat": 2.6503, "lng": 101.7605,
        "population": 14100,
        "waste_tonnes": 5.2,
        "recovery_rate": 58,
        "growth": 12,
        "land_use": "Agriculture / Residential",
        "waste_types": {"Organic": 47, "Plastic": 22, "Paper": 15, "Metal": 8, "E-Waste": 4, "Other": 4},
        "severity": "medium",
        "collection_coverage": 74,
        "service_gap_km": 1.6,
        "drivers": {"Population growth": 38, "Commercial activity": 19, "Tourism": 8, "Other": 35},
    },
    {
        "id": "bagan-lalang",
        "name": "Bagan Lalang Coastal",
        "lat": 2.5905, "lng": 101.6903,
        "population": 6800,
        "waste_tonnes": 4.3,
        "recovery_rate": 52,
        "growth": 21,
        "land_use": "Tourism / Coastal",
        "waste_types": {"Plastic": 39, "Organic": 30, "Paper": 14, "Metal": 7, "E-Waste": 3, "Other": 7},
        "severity": "critical",
        "collection_coverage": 63,
        "service_gap_km": 3.1,
        "drivers": {"Tourism": 57, "Commercial activity": 21, "Population growth": 12, "Other": 10},
    },
    {
        "id": "kota-warisan",
        "name": "Kota Warisan",
        "lat": 2.8303, "lng": 101.7002,
        "population": 22400,
        "waste_tonnes": 6.4,
        "recovery_rate": 77,
        "growth": 17,
        "land_use": "Residential",
        "waste_types": {"Organic": 43, "Plastic": 25, "Paper": 18, "Metal": 7, "E-Waste": 4, "Other": 3},
        "severity": "low",
        "collection_coverage": 91,
        "service_gap_km": 0.6,
        "drivers": {"Population growth": 51, "Commercial activity": 25, "Tourism": 8, "Other": 16},
    },
    {
        "id": "sepang-town",
        "name": "Sepang Town Centre",
        "lat": 2.6902, "lng": 101.7503,
        "population": 16900,
        "waste_tonnes": 6.9,
        "recovery_rate": 64,
        "growth": 15,
        "land_use": "Commercial / Residential",
        "waste_types": {"Organic": 36, "Plastic": 28, "Paper": 19, "Metal": 8, "E-Waste": 5, "Other": 4},
        "severity": "medium",
        "collection_coverage": 80,
        "service_gap_km": 1.2,
        "drivers": {"Commercial activity": 40, "Population growth": 34, "Tourism": 12, "Other": 14},
    },
]

# Existing waste facilities
FACILITIES = [
    {"id": "mrf-salak", "name": "Salak Tinggi MRF", "lat": 2.8050, "lng": 101.7350, "type": "Material Recovery Facility", "capacity": 320},
    {"id": "ts-sepang", "name": "Sepang Transfer Station", "lat": 2.6950, "lng": 101.7450, "type": "Transfer Station", "capacity": 180},
    {"id": "hub-klia", "name": "KLIA Recycling Hub", "lat": 2.7500, "lng": 101.7150, "type": "Recycling Hub", "capacity": 210},
]

# Candidate sites for suitability analysis
CANDIDATE_SITES = [
    {
        "id": "site-a", "name": "Site A — Labu Industrial Edge",
        "lat": 2.7280, "lng": 101.7520, "score": 87,
        "pros": ["High waste demand", "Good road accessibility", "Low existing service coverage", "Available land parcel", "Compatible surrounding land use"],
        "constraints": ["Residential proximity (400m)", "Moderate flood exposure"],
        "recommendation": "Suitable with mitigation",
        "service_population": 18400,
    },
    {
        "id": "site-b", "name": "Site B — Dengkil North",
        "lat": 2.8600, "lng": 101.6750, "score": 74,
        "pros": ["Rapid population growth", "Central to service gap", "Available land"],
        "constraints": ["Longer haul distance", "Institutional buffer required"],
        "recommendation": "Suitable",
        "service_population": 31500,
    },
    {
        "id": "site-c", "name": "Site C — Bagan Lalang South",
        "lat": 2.5850, "lng": 101.6950, "score": 52,
        "pros": ["High tourism plastic load", "Coastal cleanup synergy"],
        "constraints": ["Environmentally sensitive area", "High flood risk", "Poor road access"],
        "recommendation": "Not recommended without major mitigation",
        "service_population": 6800,
    },
]

# Logistics collection routes (ordered stops through zones)
ROUTES = [
    {
        "id": "route-north", "name": "North Corridor", "color": "#00E5FF",
        "vehicles": 4, "distance_km": 38.2, "efficiency": 82, "load_tonnes": 23.2,
        "stops": ["dengkil", "kota-warisan", "salak-tinggi"],
    },
    {
        "id": "route-central", "name": "Central Corridor", "color": "#10b981",
        "vehicles": 3, "distance_km": 29.6, "efficiency": 76, "load_tonnes": 18.5,
        "stops": ["klia-sepang", "sepang-town", "labu-lanjut"],
    },
    {
        "id": "route-south", "name": "South Coastal Corridor", "color": "#f97316",
        "vehicles": 2, "distance_km": 41.7, "efficiency": 64, "load_tonnes": 9.5,
        "stops": ["sungai-pelek", "bagan-lalang"],
    },
]

# Forecast trajectory (district totals), tonnes/month baseline & indices
FORECAST = {
    "years": [2026, 2028, 2030, 2035],
    "waste_tonnes": [42.8, 47.6, 53.1, 62.4],
    "population_index": [100, 109, 118, 131],
    "recycling_demand_index": [100, 111, 121, 138],
    "facility_demand": [4, 4, 5, 7],
    "trend_series": [
        {"year": 2026, "waste": 42.8, "recovery": 73},
        {"year": 2027, "waste": 45.1, "recovery": 72},
        {"year": 2028, "waste": 47.6, "recovery": 71},
        {"year": 2029, "waste": 50.2, "recovery": 70},
        {"year": 2030, "waste": 53.1, "recovery": 68},
        {"year": 2032, "waste": 57.0, "recovery": 66},
        {"year": 2035, "waste": 62.4, "recovery": 63},
    ],
    "alert": "Current recovery capacity may become insufficient by 2030. A projected 24% rise in waste generation outpaces the planned +5% recovery expansion.",
}


def district_kpis():
    total_waste = round(sum(z["waste_tonnes"] for z in ZONES), 1)
    pop = sum(z["population"] for z in ZONES)
    avg_recovery = round(sum(z["recovery_rate"] * z["population"] for z in ZONES) / pop)
    hotspots = sum(1 for z in ZONES if z["severity"] in ("critical", "high"))
    return {
        "total_waste_tonnes": total_waste,
        "growth_2030": 18.4,
        "recovery_rate": avg_recovery,
        "critical_hotspots": hotspots,
        "population": pop,
    }


def compute_landuse_correlation():
    """Return the flagship AI correlation insight combining layers."""
    commercial = [z for z in ZONES if "Commercial" in z["land_use"] or "Tourism" in z["land_use"]]
    high_plastic = [z for z in ZONES if z["waste_types"]["Plastic"] >= 30]
    overlap = [z for z in high_plastic if z in commercial]
    pct = round(len(overlap) / max(len(high_plastic), 1) * 100)
    return {
        "statement": f"{pct}% of high plastic-generation areas are associated with commercial or tourism land use.",
        "pct": pct,
        "zones": [z["name"] for z in overlap],
    }


def simulate(population_growth, recycling_rate, new_housing, new_commercial):
    """Deterministic what-if engine. Returns cascading impacts."""
    base_waste = district_kpis()["total_waste_tonnes"]
    # waste growth: population elasticity ~1.2, plus housing & commercial contributions
    housing_factor = (new_housing / 500) * 3.0  # % per 500 units
    commercial_factor = 6.0 if new_commercial else 0.0
    waste_increase = round(population_growth * 1.2 + housing_factor + commercial_factor, 1)
    projected_waste = round(base_waste * (1 + waste_increase / 100), 1)

    collection_demand = round(waste_increase * 0.8, 1)
    # capacity gap: each 20% waste over baseline ~ 1 hub
    capacity_gap_hubs = max(0, round(waste_increase / 22))
    traffic_impact = round(collection_demand * 0.42, 1)
    # recovery offset from recycling rate improvement
    diverted = round(projected_waste * (recycling_rate / 100), 1)
    net_landfill = round(projected_waste - diverted, 1)

    return {
        "base_waste": base_waste,
        "projected_waste": projected_waste,
        "waste_increase_pct": waste_increase,
        "collection_demand_pct": collection_demand,
        "capacity_gap_hubs": capacity_gap_hubs,
        "traffic_impact_pct": traffic_impact,
        "diverted_tonnes": diverted,
        "net_landfill_tonnes": net_landfill,
        "affected_zone": "Zone B — Dengkil / Cyberjaya Fringe" if population_growth >= 15 else "Zone A — Labu Lanjut East",
    }
