"""Customize-step picks → render parameters and scene mapping. No database.

    cd backend
    .venv\\Scripts\\python -m pytest tests/test_design_selections.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import design_selections as D  # noqa: E402


def test_vendor_colour_names_resolve():
    assert D.resolve_colour("Blush Pink") == "#E7C4C0"          # same swatch as the viewer palette
    assert D.resolve_colour("Royal Navy Blue") == "#1E2B57"     # longest phrase wins over "blue"
    assert D.resolve_colour("  charcoal GREY ") == "#3C3F43"
    assert D.resolve_colour("#a1b2c3") == "#A1B2C3"
    light, base = D.resolve_colour("Light Teal"), D.resolve_colour("Teal")
    assert light != base and int(light[1:3], 16) > int(base[1:3], 16)
    assert D.resolve_colour("Unicorn Sparkle") is None           # unknown → keep the palette


def test_finish_fabric_and_wood_become_render_parameters():
    look = D.look_for({"color": "Blush Pink", "wood_finish": "Glossy"})
    assert look["hex"] == "#E7C4C0" and look["roughness"] < 0.3 and "wood_hex" not in look
    look = D.look_for({"wood_finish": "Teak Laminated"})
    assert look["wood_hex"] == D.WOOD_HEX["teak"]
    look = D.look_for({"fabric": "Faux Leather", "color": "Cognac"})
    assert look["fabric_family"] == "leather" and look["hex"]
    assert D.look_for({"fabric": "Boucle"})["fabric_family"] == "woven"
    assert D.look_for({"texture": "Matte"})["roughness"] > 0.7
    assert D.look_for({"color": "Mystery"}) == {"unresolved_colour": "Mystery"}


def test_products_map_to_the_scene_objects_they_dress():
    cat = lambda c, s="", n="": D.scene_categories(NS(category=c, subcategory=s, name=n))  # noqa: E731
    assert cat("coffee_tables") == ["coffee_table"]
    assert cat("sofas", n="Blush Pink Sofa Set") == ["sofa"]
    assert cat("bedside_tables") == ["nightstand"]
    assert cat("Bedroom Furniture", "Beds") == ["bed"]              # a room word is not a product
    assert cat("Kitchen", n="Base Cabinets") == ["counter_run", "wall_cabinets", "island"]
    assert cat("Lighting") == ["floor_lamp"]
    assert cat("Furniture", n="Matte Black Floor Lamp") == ["floor_lamp"]
    assert cat("Decor", n="Wall clock") == []


def test_project_rooms_map_to_scene_rooms():
    assert D.scene_room("bedroom_master") == ("master_bedroom", 0)
    assert D.scene_room("bedroom_2") == ("bedroom", 0)
    assert D.scene_room("bedroom_3") == ("bedroom", 1)
    assert D.scene_room("bathroom_2") == ("bathroom", 1)
    assert D.scene_room("balcony") == (None, 0)


def test_attributes_merge_old_columns_and_vendor_extras():
    item = NS(custom_color="Teal", custom_material=None, custom_size=None, custom_fabric="Velvet",
              custom_wood_finish=None, custom_texture=None, custom_cushion_style=None,
              custom_attributes={"Leg Style": "Tapered", "color": "Coral", "images": ["x.png"]})
    attrs = D.item_attributes(item)
    assert attrs == {"color": "Coral", "fabric": "Velvet", "leg_style": "Tapered"}
    assert D.clean_attributes({"custom_wood_finish": "Oak", "size": ["King", "Queen"], "x": ""}) == \
        {"wood_finish": "Oak", "size": "King"}


def test_render_prompt_names_every_chosen_option():
    from app.services.render_mock import build_prompt

    prompt = build_prompt("modern", [], "living_room", [
        {"name": "Blush Pink Coffee Table", "color": "Blush Pink", "wood_finish": "Matte", "leg_style": "Tapered"},
        {"name": "Sofa", "custom_fabric": "Velvet", "cushion_style": "Tufted"},
    ])
    for phrase in ("Blush Pink Coffee Table", "colour: Blush Pink", "wood finish: Matte",
                   "leg style: Tapered", "fabric: Velvet", "cushion style: Tufted"):
        assert phrase in prompt


def test_vendor_options_keep_new_groups_and_images():
    opts = D.catalog_variant_options({"Color": ["Red", "red ", ""], "Leg Style": "Tapered, Straight"},
                                     existing={"images": ["a.webp"], "color": ["Old"]})
    assert opts["color"] == ["Red"] and opts["leg_style"] == ["Tapered", "Straight"]
    assert opts["fabric"] == [] and opts["images"] == ["a.webp"]
