import pytest
from app.routers.recommendations import (
    COLOR_HARMONY_MAP,
    ROOM_BUDGET_WEIGHTS,
    get_color_match_priority
)

def test_color_harmony_mappings():
    """Verify that every color family has defined primary, complementary, and accent palettes."""
    assert "royal navy blue" in COLOR_HARMONY_MAP
    assert "warm beige" in COLOR_HARMONY_MAP
    assert "charcoal grey" in COLOR_HARMONY_MAP
    assert "emerald green" in COLOR_HARMONY_MAP

    navy_harmony = COLOR_HARMONY_MAP["royal navy blue"]
    assert "royal navy blue" in navy_harmony["primary"]
    assert "warm beige" in navy_harmony["complementary"]
    assert len(navy_harmony["accent"]) > 0

def test_room_budget_weights():
    """Verify that room budget weights cover all standard room types."""
    assert "living_room" in ROOM_BUDGET_WEIGHTS
    assert "bedroom_master" in ROOM_BUDGET_WEIGHTS
    assert "kitchen" in ROOM_BUDGET_WEIGHTS
    assert "bathroom" in ROOM_BUDGET_WEIGHTS
    assert "balcony" in ROOM_BUDGET_WEIGHTS
    assert ROOM_BUDGET_WEIGHTS["living_room"] >= 0.25

def test_color_match_priority():
    """Verify color matching priority scoring logic."""
    assert get_color_match_priority(["Navy Blue"], ["navy blue"]) == 1
    assert get_color_match_priority(["White"], ["UnrelatedColor"]) == 3
