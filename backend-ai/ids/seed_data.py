"""Default geometric variants and SKU definitions for automated interior design."""
from __future__ import annotations

from typing import Any


def create_default_skus() -> dict[str, Any]:
    return {
        "bed_king": {"category": "bed", "width": 1.8, "depth": 2.0, "height": 0.95, "base_price": 48000},
        "sofa_3seater": {"category": "sofa", "width": 2.1, "depth": 0.88, "height": 0.85, "base_price": 52000},
        "coffee_table_rect": {"category": "coffee_table", "width": 1.1, "depth": 0.58, "height": 0.45, "base_price": 14000},
        "wardrobe_3door": {"category": "wardrobe", "width": 1.6, "depth": 0.60, "height": 2.1, "base_price": 56000},
        "media_console_wood": {"category": "media_console", "width": 1.6, "depth": 0.45, "height": 0.52, "base_price": 24000},
        "dining_set_4seater": {"category": "dining_set", "width": 1.4, "depth": 0.90, "height": 0.76, "base_price": 42000},
        "counter_run_modular": {"category": "counter_run", "width": 2.2, "depth": 0.65, "height": 0.90, "base_price": 68000},
    }


def _make_svg(rooms: list[dict[str, Any]], title: str) -> str:
    rects = "".join(
        f'<rect x="{r["rect"][0]*50}" y="{r["rect"][1]*50}" width="{r["rect"][2]*50}" height="{r["rect"][3]*50}" '
        f'fill="#f8fafc" stroke="#334155" stroke-width="2"/>'
        for r in rooms
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><g>{rects}</g><text x="20" y="30" font-family="sans-serif" font-size="16" fill="#1e293b">{title}</text></svg>'


def _variant_1bhk(tier: str) -> dict[str, Any]:
    rooms = [
        {"room_id": "living_room", "label": "Living Room", "rect": [0.0, 0.0, 5.0, 4.0]},
        {"room_id": "bedroom", "label": "Bedroom", "rect": [0.0, 0.0, 4.5, 4.0]},
    ]
    openings = [
        {"opening_id": "d_liv", "room_id": "living_room", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_liv", "room_id": "living_room", "p0": [2.5, 4.0], "p1": [4.0, 4.0], "is_door": False, "swing_dir": "none"},
        {"opening_id": "d_bed", "room_id": "bedroom", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_bed", "room_id": "bedroom", "p0": [2.2, 4.0], "p1": [3.7, 4.0], "is_door": False, "swing_dir": "none"},
    ]
    objects = [
        {"object_id": "sofa_1", "room_id": "living_room", "category": "sofa",
         "position": {"x": 2.5, "y": 0.0, "z": 0.6}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 2.0, "depth": 0.85, "height": 0.85}},
        {"object_id": "coffee_1", "room_id": "living_room", "category": "coffee_table",
         "position": {"x": 2.5, "y": 0.0, "z": 1.8}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.0, "depth": 0.55, "height": 0.45}},
        {"object_id": "tv_1", "room_id": "living_room", "category": "media_console",
         "position": {"x": 2.5, "y": 0.0, "z": 3.6}, "rotation": {"yaw": 180.0},
         "dimensions": {"width": 1.5, "depth": 0.42, "height": 0.50}},
        {"object_id": "bed_1", "room_id": "bedroom", "category": "bed",
         "position": {"x": 2.25, "y": 0.0, "z": 1.25}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.8, "depth": 2.0, "height": 0.95}},
        {"object_id": "wardrobe_1", "room_id": "bedroom", "category": "wardrobe",
         "position": {"x": 3.6, "y": 0.0, "z": 2.5}, "rotation": {"yaw": 270.0},
         "dimensions": {"width": 1.6, "depth": 0.60, "height": 2.1}},
    ]
    if tier == "Standard":
        objects.append(
            {"object_id": "stand_1", "room_id": "bedroom", "category": "nightstand",
             "position": {"x": 0.8, "y": 0.0, "z": 1.25}, "rotation": {"yaw": 0.0},
             "dimensions": {"width": 0.5, "depth": 0.45, "height": 0.55}}
        )
    return {
        "scene": {"rooms": rooms, "openings": openings, "objects": objects},
        "svg": _make_svg(rooms, f"1 BHK — {tier}"),
    }


def _variant_2bhk(tier: str) -> dict[str, Any]:
    rooms = [
        {"room_id": "living_room", "label": "Living Room", "rect": [0.0, 0.0, 5.5, 4.5]},
        {"room_id": "master_bedroom", "label": "Master Bedroom", "rect": [0.0, 0.0, 4.8, 4.2]},
        {"room_id": "bedroom_2", "label": "Guest Bedroom", "rect": [0.0, 0.0, 4.2, 3.8]},
    ]
    openings = [
        {"opening_id": "d_liv", "room_id": "living_room", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_liv", "room_id": "living_room", "p0": [2.5, 4.5], "p1": [4.5, 4.5], "is_door": False, "swing_dir": "none"},
        {"opening_id": "d_mbed", "room_id": "master_bedroom", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_mbed", "room_id": "master_bedroom", "p0": [2.2, 4.2], "p1": [3.8, 4.2], "is_door": False, "swing_dir": "none"},
        {"opening_id": "d_bed2", "room_id": "bedroom_2", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_bed2", "room_id": "bedroom_2", "p0": [2.0, 3.8], "p1": [3.4, 3.8], "is_door": False, "swing_dir": "none"},
    ]
    objects = [
        {"object_id": "sofa_1", "room_id": "living_room", "category": "sofa",
         "position": {"x": 2.75, "y": 0.0, "z": 0.65}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 2.2, "depth": 0.90, "height": 0.85}},
        {"object_id": "coffee_1", "room_id": "living_room", "category": "coffee_table",
         "position": {"x": 2.75, "y": 0.0, "z": 2.0}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.1, "depth": 0.60, "height": 0.45}},
        {"object_id": "dining_1", "room_id": "living_room", "category": "dining_set",
         "position": {"x": 4.2, "y": 0.0, "z": 2.2}, "rotation": {"yaw": 90.0},
         "dimensions": {"width": 1.4, "depth": 0.90, "height": 0.76}},
        {"object_id": "tv_1", "room_id": "living_room", "category": "media_console",
         "position": {"x": 2.75, "y": 0.0, "z": 4.1}, "rotation": {"yaw": 180.0},
         "dimensions": {"width": 1.6, "depth": 0.45, "height": 0.52}},
        {"object_id": "bed_master", "room_id": "master_bedroom", "category": "bed",
         "position": {"x": 2.4, "y": 0.0, "z": 1.3}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.8, "depth": 2.0, "height": 0.95}},
        {"object_id": "wardrobe_master", "room_id": "master_bedroom", "category": "wardrobe",
         "position": {"x": 4.1, "y": 0.0, "z": 2.6}, "rotation": {"yaw": 270.0},
         "dimensions": {"width": 1.8, "depth": 0.60, "height": 2.1}},
        {"object_id": "bed_2", "room_id": "bedroom_2", "category": "bed",
         "position": {"x": 2.1, "y": 0.0, "z": 1.25}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.6, "depth": 1.95, "height": 0.90}},
    ]
    if tier == "Premium":
        objects.append(
            {"object_id": "stand_master", "room_id": "master_bedroom", "category": "nightstand",
             "position": {"x": 0.9, "y": 0.0, "z": 1.3}, "rotation": {"yaw": 0.0},
             "dimensions": {"width": 0.5, "depth": 0.45, "height": 0.55}}
        )
    return {
        "scene": {"rooms": rooms, "openings": openings, "objects": objects},
        "svg": _make_svg(rooms, f"2 BHK — {tier}"),
    }


def _variant_3bhk(tier: str) -> dict[str, Any]:
    rooms = [
        {"room_id": "living_room", "label": "Living Room", "rect": [0.0, 0.0, 6.0, 5.0]},
        {"room_id": "master_bedroom", "label": "Master Bedroom", "rect": [0.0, 0.0, 5.0, 4.5]},
        {"room_id": "bedroom_2", "label": "Bedroom 2", "rect": [0.0, 0.0, 4.5, 4.0]},
    ]
    openings = [
        {"opening_id": "d_liv", "room_id": "living_room", "p0": [0.2, 0.0], "p1": [1.2, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_liv", "room_id": "living_room", "p0": [2.5, 5.0], "p1": [4.8, 5.0], "is_door": False, "swing_dir": "none"},
        {"opening_id": "d_mbed", "room_id": "master_bedroom", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_mbed", "room_id": "master_bedroom", "p0": [2.2, 4.5], "p1": [4.0, 4.5], "is_door": False, "swing_dir": "none"},
        {"opening_id": "d_bed2", "room_id": "bedroom_2", "p0": [0.2, 0.0], "p1": [1.1, 0.0], "is_door": True, "swing_dir": "in"},
        {"opening_id": "w_bed2", "room_id": "bedroom_2", "p0": [2.0, 4.0], "p1": [3.6, 4.0], "is_door": False, "swing_dir": "none"},
    ]
    objects = [
        {"object_id": "sofa_1", "room_id": "living_room", "category": "sofa",
         "position": {"x": 3.0, "y": 0.0, "z": 0.7}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 2.4, "depth": 0.92, "height": 0.85}},
        {"object_id": "coffee_1", "room_id": "living_room", "category": "coffee_table",
         "position": {"x": 3.0, "y": 0.0, "z": 2.2}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.2, "depth": 0.65, "height": 0.45}},
        {"object_id": "dining_1", "room_id": "living_room", "category": "dining_set",
         "position": {"x": 4.8, "y": 0.0, "z": 2.6}, "rotation": {"yaw": 90.0},
         "dimensions": {"width": 1.6, "depth": 0.95, "height": 0.76}},
        {"object_id": "tv_1", "room_id": "living_room", "category": "media_console",
         "position": {"x": 3.0, "y": 0.0, "z": 4.55}, "rotation": {"yaw": 180.0},
         "dimensions": {"width": 1.8, "depth": 0.48, "height": 0.52}},
        {"object_id": "bed_master", "room_id": "master_bedroom", "category": "bed",
         "position": {"x": 2.5, "y": 0.0, "z": 1.35}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.8, "depth": 2.0, "height": 0.95}},
        {"object_id": "wardrobe_master", "room_id": "master_bedroom", "category": "wardrobe",
         "position": {"x": 4.3, "y": 0.0, "z": 2.8}, "rotation": {"yaw": 270.0},
         "dimensions": {"width": 2.0, "depth": 0.65, "height": 2.1}},
        {"object_id": "bed_2", "room_id": "bedroom_2", "category": "bed",
         "position": {"x": 2.25, "y": 0.0, "z": 1.3}, "rotation": {"yaw": 0.0},
         "dimensions": {"width": 1.6, "depth": 1.95, "height": 0.90}},
    ]
    return {
        "scene": {"rooms": rooms, "openings": openings, "objects": objects},
        "svg": _make_svg(rooms, f"3 BHK — {tier}"),
    }


def create_default_variants() -> dict[str, Any]:
    return {
        "1 BHK|Budget": _variant_1bhk("Budget"),
        "1 BHK|Standard": _variant_1bhk("Standard"),
        "2 BHK|Standard": _variant_2bhk("Standard"),
        "2 BHK|Premium": _variant_2bhk("Premium"),
        "3 BHK|Standard": _variant_3bhk("Standard"),
        "3 BHK|Premium": _variant_3bhk("Premium"),
        "3 BHK|Luxury": _variant_3bhk("Luxury"),
    }
