"""Reading printed labels on floor plans: room names, sizes, and matching them to shapes.

Pure functions — no OCR model needed.

    cd backend
    .venv\\Scripts\\python -m pytest tests/test_plan_ocr.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.plan_ocr import Label, Text, apply_labels, build_labels, parse_dimensions, room_word  # noqa: E402


@pytest.mark.parametrize("text, metres", [
    ("3.1*1.9", [3.1, 1.9]),
    ("3*4.5M", [3.0, 4.5]),
    ("3.11.9", [3.1, 1.9]),                 # OCR dropped the "*"
    ("2.5*1.2MBALCONY", [2.5, 1.2]),
    ("3100X1900", [3.1, 1.9]),              # millimetres
    ("11'0\" x 9'2\"", [3.35, 2.79]),
    ("110\"×9'2\"", [3.35, 2.79]),          # OCR dropped the foot mark
    ("10\"x15.9\"", [3.05, 4.8]),           # 10' x 15'9" as drawn on a brochure
    ("12'-6\" X 10'-0\"", [3.81, 3.05]),
    ("1.2MWIDE", [1.2]),
    ("BALCONY 4' WIDE", [1.22]),
    ("AREA 64 MSQ.", []),
])
def test_printed_sizes_are_read(text, metres):
    assert [round(v, 2) for v in parse_dimensions(text)] == metres


@pytest.mark.parametrize("text, expected", [
    ("LIVING+DINING", "living_room"), ("BED ROOM", "bedroom"), ("MASTER BEDROOM", "master_bedroom"),
    ("KITCHEN", "kitchen"), ("WC", "bathroom"), ("TOILET", "bathroom"), ("PASSAGE", "passage"),
    ("2.5*1.2 M BALCONY", "balcony"), ("POOJA", "pooja_room"),
    ("FLOOR PLAN", None), ("1BHK FOR LIG UNIT", None), ("TV", None),
])
def test_room_names_are_recognised(text, expected):
    found = room_word(text)
    assert (found[0] if found else None) == expected


def test_name_and_size_lines_are_grouped():
    texts = [Text("BEDROOM", 416, 251, 480, 267, 1.0), Text("3*4.5M", 415, 265, 458, 281, 0.9),
             Text("BATH", 250, 377, 288, 393, 1.0), Text("1.2*1.8M", 249, 391, 298, 406, 0.9),
             Text("FLOOR FLAN", 426, 444, 600, 469, 1.0)]
    labels = build_labels(texts, 692, 558)
    assert [(l.name, l.dims_m) for l in labels] == [("Bedroom", [3.0, 4.5]), ("Bath", [1.2, 1.8])]


def test_labels_name_shapes_and_set_the_scale():
    # Two rooms traced at 50 px per metre on a 1000 px wide image.
    detection = {"rooms": [
        {"box": [0.10, 0.10, 0.25, 0.325], "room_type": "bedroom", "label": "Bedroom"},      # 3 x 4.5 m
        {"box": [0.25, 0.10, 0.31, 0.19], "room_type": "passage", "label": "Passage"},       # 1.2 x 1.8 m
    ], "plan_width_m": 30.0, "wall_frac": 0.0, "notes": []}
    labels = [Label("bedroom", "Bedroom", 0.17, 0.2, [3.0, 4.5]), Label("bathroom", "Bath", 0.28, 0.14, [1.2, 1.8])]
    from PIL import Image
    out = apply_labels(detection, Image.new("RGB", (1000, 1000), "white"), texts=[], labels=labels)
    assert out["plan_width_m"] == pytest.approx(20.0, rel=0.02)
    assert [r["room_type"] for r in out["rooms"]] == ["master_bedroom", "bathroom"]
    assert out["rooms"][1]["label"] == "Bath"


def test_misread_sizes_never_become_zero():
    from app.services.plan_ocr import _fit_ppm
    assert [round(v, 2) for v in parse_dimensions("11'0′×9'2\"")] == [3.35, 2.79]   # prime after the inches
    assert parse_dimensions("0'0\"x9'2\"") == []                                     # a 0 m wall is a misread
    assert _fit_ppm((100.0, 50.0), [0.0, 2.0]) is None


def test_stretched_images_get_separate_scales():
    from app.services.plan_ocr import solve_scales
    # Rooms drawn at 75 px/m across and 50 px/m down (an image resized unevenly).
    sizes = [(3.3 * 75, 5.1 * 50, 3.3, 5.1), (3.5 * 75, 3.0 * 50, 3.0, 3.5), (1.8 * 75, 2.0 * 50, 1.8, 2.0)]
    sx, sy = solve_scales(sizes)
    assert sx == pytest.approx(75, rel=0.03) and sy == pytest.approx(50, rel=0.03)
    # An evenly scaled image keeps one scale.
    even = [(3.3 * 60, 5.1 * 60, 5.1, 3.3), (3.0 * 60, 3.5 * 60, 3.0, 3.5)]
    sx, sy = solve_scales(even)
    assert sx == sy == pytest.approx(60, rel=0.03)


def test_label_reading_failure_still_returns_rooms(monkeypatch):
    from app.services import plan_layout as PL
    from app.services import plan_ocr
    from plan_samples import one_bhk_plan

    def broken(*args, **kwargs):
        raise ZeroDivisionError("simulated")
    monkeypatch.setattr(plan_ocr, "apply_labels", broken)
    im, _ = one_bhk_plan()
    det = PL.detect_rooms(im, bhk_hint=2)
    assert len(det["rooms"]) >= 5
    assert any("Couldn't read the room names" in n for n in det["notes"])
