"""Order history synthesis, adapters, and style document tags."""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any, Sequence

CATALOG_ROWS: list[dict[str, Any]] = [
    {"category": "bed", "base_price": 45000.0, "footprint": 3.6},
    {"category": "wardrobe", "base_price": 55000.0, "footprint": 1.4},
    {"category": "sofa", "base_price": 50000.0, "footprint": 2.2},
    {"category": "counter_run", "base_price": 65000.0, "footprint": 2.0},
    {"category": "island", "base_price": 35000.0, "footprint": 1.5},
    {"category": "dining_set", "base_price": 42000.0, "footprint": 2.4},
    {"category": "media_console", "base_price": 24000.0, "footprint": 0.8},
    {"category": "bookshelf", "base_price": 18000.0, "footprint": 0.6},
    {"category": "wall_cabinets", "base_price": 28000.0, "footprint": 0.9},
    {"category": "tall_storage", "base_price": 22000.0, "footprint": 0.5},
    {"category": "vanity", "base_price": 20000.0, "footprint": 0.6},
    {"category": "wc", "base_price": 12000.0, "footprint": 0.4},
    {"category": "shower", "base_price": 18000.0, "footprint": 0.8},
    {"category": "desk", "base_price": 16000.0, "footprint": 0.9},
    {"category": "chair", "base_price": 7500.0, "footprint": 0.3},
    {"category": "nightstand", "base_price": 8500.0, "footprint": 0.25},
    {"category": "dresser", "base_price": 25000.0, "footprint": 0.7},
    {"category": "sideboard", "base_price": 26000.0, "footprint": 0.8},
    {"category": "bar_unit", "base_price": 22000.0, "footprint": 0.5},
    {"category": "mandir", "base_price": 20000.0, "footprint": 0.4},
    {"category": "bench", "base_price": 11000.0, "footprint": 0.6},
    {"category": "coffee_table", "base_price": 14000.0, "footprint": 0.7},
    {"category": "side_table", "base_price": 6000.0, "footprint": 0.2},
    {"category": "console_table", "base_price": 15000.0, "footprint": 0.45},
    {"category": "armchair", "base_price": 18000.0, "footprint": 0.75},
    {"category": "floor_lamp", "base_price": 8000.0, "footprint": 0.2},
    {"category": "planter", "base_price": 4500.0, "footprint": 0.15},
    {"category": "rug", "base_price": 12000.0, "footprint": 3.0},
    {"category": "fridge", "base_price": 40000.0, "footprint": 0.65},
]

TIERS: list[str] = ["Budget", "Standard", "Premium"]

CITY_MULT: dict[str, float] = {
    "Mumbai": 1.15,
    "Delhi": 1.10,
    "Bengaluru": 1.08,
    "Pune": 1.02,
    "Hyderabad": 1.00,
    "Chennai": 1.00,
    "Kolkata": 0.95,
    "Goa": 1.05,
}

STYLE_TAGS: dict[str, str] = {
    "Modern": "sleek clean geometric monochrome steel glass urban minimal",
    "Boho": "eclectic earthy rattan woven natural ethnic warm rustic texture",
    "Luxury": "velvet marble rich brass gold opulent lighting chandelier plush",
    "Indian Contemporary": "wood ritual traditional brass teak warm carved jali heritage",
    "Minimalist": "light spacious functional uncluttered architectural serene",
    "Scandinavian": "nordic blonde wood cozy functional pastel neutral hygge simple",
}

ITEM_TAGS: dict[str, str] = {
    "bed": "sleep bedroom rest wood fabric headboard comfort",
    "wardrobe": "storage closet clothes bedroom cabinetry wood sliding",
    "sofa": "seating fabric lounge living living_room comfort velvet",
    "counter_run": "kitchen cook prep granite quartz modular cabinetry",
    "island": "kitchen dining counter seating luxury marble stone",
    "dining_set": "dining eat table chairs family meal wood marble",
    "media_console": "living tv entertainment storage audio shelf",
    "bookshelf": "study books display storage wall library wood",
    "wall_cabinets": "overhead kitchen storage cabinetry modular utility",
    "tall_storage": "pantry utility storage cabinet corner tall",
    "vanity": "bathroom mirror wash basin storage marble stone",
    "wc": "bathroom toilet ceramic sanitary fixture",
    "shower": "bathroom glass shower stall enclosure fixture",
    "desk": "study work office computer table writing wood",
    "chair": "seating desk office dining ergonomic comfort",
    "nightstand": "bedroom bedside table drawer lamp wood",
    "dresser": "bedroom mirror makeup drawers storage vanity",
    "sideboard": "dining buffet credenza storage crockery wood marble",
    "bar_unit": "bar wine glasses entertainment cocktail luxury counter",
    "mandir": "wood ritual traditional puja prayer teak brass temple shrine",
    "bench": "seating bedroom entryway bench fabric wood",
    "coffee_table": "living table center sofa wood glass marble",
    "side_table": "living end table sofa corner lamp wood metal",
    "console_table": "foyer entryway decor wall mirror table sleek",
    "armchair": "accent seating lounge living velvet fabric chair",
    "floor_lamp": "lighting decor ambiance tall metal brass living",
    "planter": "plants greenery indoor nature ceramic clay decor",
    "rug": "floor carpet woven wool soft pattern living bedroom",
    "fridge": "kitchen appliance cold storage food utility steel",
}


def item_documents() -> dict[str, str]:
    return dict(ITEM_TAGS)


def style_documents() -> dict[str, str]:
    return dict(STYLE_TAGS)


@dataclass
class History:
    baskets: list[list[str]]
    orders: list[dict[str, Any]]
    prices: list[float]
    synthetic: bool = False

    def __len__(self) -> int:
        return len(self.orders)


def synthesise(n_orders: int = 2500, seed: int = 7) -> History:
    """Bootstrap realistic historical orders for offline model training."""
    rng = random.Random(seed)
    cats = [r["category"] for r in CATALOG_ROWS]
    prices_by_cat = {r["category"]: r["base_price"] for r in CATALOG_ROWS}
    tier_mults = {"Budget": 0.82, "Standard": 1.0, "Premium": 1.38}
    styles = list(STYLE_TAGS)
    cities = list(CITY_MULT)

    baskets: list[list[str]] = []
    orders: list[dict[str, Any]] = []
    prices: list[float] = []

    for _ in range(n_orders):
        bhk_num = rng.choice([1, 2, 3, 5])
        bhk_label = f"{bhk_num} BHK"
        style = rng.choice(styles)
        tier = rng.choice(TIERS)
        city = rng.choice(cities)

        # Baseline essentials
        items: set[str] = {"bed", "wardrobe", "sofa", "counter_run"}
        if bhk_num >= 2:
            items.update(["dining_set", "media_console", "coffee_table"])
        if bhk_num >= 3:
            items.update(["desk", "chair", "vanity", "shower", "wc"])
        if bhk_num >= 5:
            items.update(["island", "sideboard", "bar_unit", "mandir"])

        # Realistic probabilistic co-occurrences
        if "bed" in items and rng.random() < 0.85:
            items.add("nightstand")
        if "sofa" in items and rng.random() < 0.80:
            items.add("coffee_table")
        if "sofa" in items and rng.random() < 0.65:
            items.add("floor_lamp")
        if "desk" in items and rng.random() < 0.88:
            items.add("chair")
        if "dining_set" in items and rng.random() < 0.55:
            items.add("sideboard")
        if rng.random() < 0.50:
            items.add("rug")
        if rng.random() < 0.40:
            items.add("planter")
        if style == "Indian Contemporary" and rng.random() < 0.70:
            items.add("mandir")
        if tier == "Premium" and rng.random() < 0.60:
            items.add("armchair")

        item_list = sorted(items)
        raw_sum = sum(prices_by_cat[c] for c in item_list)
        final_price = raw_sum * tier_mults[tier] * CITY_MULT[city] * rng.uniform(0.96, 1.04)

        baskets.append(item_list)
        orders.append({
            "items": item_list,
            "bhk": bhk_num,
            "style": style,
            "tier": tier,
            "city": city,
        })
        prices.append(float(round(final_price, 2)))

    return History(baskets=baskets, orders=orders, prices=prices, synthetic=True)


def from_dataframe(df: Any) -> History:
    """Adapt pandas DataFrame of order lines into History."""
    orders_map: dict[Any, dict[str, Any]] = {}
    for _, row in df.iterrows():
        oid = row["order_id"]
        if oid not in orders_map:
            orders_map[oid] = {
                "items": set(),
                "bhk": int(row.get("bhk", 2)),
                "style": str(row.get("style", "Modern")),
                "tier": str(row.get("tier", "Standard")),
                "city": str(row.get("city", "Mumbai")),
                "price": float(row.get("price", 0.0)),
            }
        orders_map[oid]["items"].add(str(row["category"]))

    baskets = [sorted(d["items"]) for d in orders_map.values()]
    orders = [{
        "items": sorted(d["items"]),
        "bhk": d["bhk"],
        "style": d["style"],
        "tier": d["tier"],
        "city": d["city"],
    } for d in orders_map.values()]
    prices = [float(d["price"]) for d in orders_map.values()]
    return History(baskets=baskets, orders=orders, prices=prices, synthetic=False)
