"""Uploaded floor plan -> traced rooms -> the viewer's 2D plan and 3D scene.

Three stages, each usable on its own:

1. ``detect_rooms`` finds the rooms in a plan image. With ``GEMINI_KEY`` set,
   Gemini vision reads the printed labels and dimensions; otherwise (or if that
   call fails) an offline wall-mask heuristic runs. Detection is a starting
   point only — the customer confirms or corrects the rooms before use.
2. ``build_plan_variant`` turns confirmed room rectangles (normalised image
   boxes + the plan's real width) into the same scene contract the baked IDS
   variants use: walls, doors, windows, an entrance, furniture placed by the
   IDS spatial solver, and a matching SVG plan.
3. The viewer renders that variant exactly like a baked one, so the 2D plan,
   the 3D model and the GLB export all describe the customer's own home.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import html
import io
import json
import math
import statistics
from . import plan_scale as PlanScale
from functools import lru_cache
import os
import re
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Optional

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

from .ids_service import BACKEND_AI_DIR, _viewer_shell  # noqa: F401  (path setup)

# ════════════════════════════════════════════════════════════ vocabulary ═════
ROOM_TYPES: "OrderedDict[str, dict[str, str]]" = OrderedDict([
    ("living_room",    {"label": "Living Room",     "fill": "#F7EBD3"}),
    ("dining_area",    {"label": "Dining Area",     "fill": "#F7EBD3"}),
    ("kitchen",        {"label": "Kitchen",         "fill": "#DCE7EC"}),
    ("master_bedroom", {"label": "Master Bedroom",  "fill": "#F7EBD3"}),
    ("bedroom",        {"label": "Bedroom",         "fill": "#F7EBD3"}),
    ("bathroom",       {"label": "Bathroom",        "fill": "#DCE7EC"}),
    ("study",          {"label": "Study",           "fill": "#F7EBD3"}),
    ("family_lounge",  {"label": "Family Lounge",   "fill": "#F7EBD3"}),
    ("pooja_room",     {"label": "Pooja Room",      "fill": "#F7EBD3"}),
    ("balcony",        {"label": "Balcony",         "fill": "#E7E9E2"}),
    ("passage",        {"label": "Passage / Utility", "fill": "#F3F0EA"}),
])
BEDROOM_TYPES = {"master_bedroom", "bedroom"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PLAN_BYTES = 10 * 1024 * 1024

# The thresholds that decide what counts as a wall and a room, fitted on the
# training plans (48 synthetic + 14 real) by scripts/tune_plan_reader.py on
# 2026-09-22: combined score 0.687 -> 0.710. Re-run the tuner to change them.
TUNING: dict[str, float] = {
    "dark_lum": 106.4,        # wall ink is darker than this...
    "dark_sat": 75.25,         # ...and greyer than this
    "blob_span": 0.063,        # a piece of wall spans at least this share of the plan...
    "blob_mass": 0.002,       # ...or covers at least this share of it
    "door_m": 1.72,            # the widest gap closed as a doorway, in metres
    "wide_m": 2.8,            # the widest opening still treated as one space
    "min_room_m2": 0.85,       # the smallest space kept as a room
    "sliver_walls": 1.5,      # a sliver thinner than this many walls joins its neighbour
}

# Typical carpet area (m²) of the rooms themselves, and the plan envelope
# including walls, per bedroom count. Only used to guess a starting scale.
_CARPET_M2 = {0: 28, 1: 38, 2: 58, 3: 85, 4: 112, 5: 140}
_ENVELOPE_M2 = {0: 38, 1: 55, 2: 85, 3: 120, 4: 160, 5: 200}


def room_type_options() -> list[dict[str, str]]:
    return [{"value": k, "label": v["label"]} for k, v in ROOM_TYPES.items()]


# ════════════════════════════════════════════════════════════ detection ══════
def load_plan_image(data: bytes) -> Image.Image:
    """Open an uploaded plan, honouring EXIF rotation and flattening alpha."""
    img = Image.open(io.BytesIO(data))
    img.load()
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    return img.convert("RGB")


def detect_rooms(img: Image.Image, *, bhk_hint: int = 2, raw: Optional[bytes] = None,
                 mime: str = "image/png", panel: Optional[int] = None) -> dict[str, Any]:
    """Best-effort room detection. Always returns a usable (maybe empty) draft.

    A brochure sheet showing several flats is cut up first and one flat is read:
    the one asked for, or the largest. The others come back under "panels" so
    the customer can say which flat is theirs.
    """
    notes: list[str] = []
    panels = []
    try:
        from .plan_sheet import split_sheet
        panels = split_sheet(img)
    except Exception:                       # splitting is an extra, never a gate
        panels = []
    chosen = None
    if len(panels) > 1:
        area = lambda p: (p.box[2] - p.box[0]) * (p.box[3] - p.box[1])   # noqa: E731
        chosen = panel if panel is not None and 0 <= panel < len(panels) else \
            max(range(len(panels)), key=lambda i: area(panels[i]))
        img = panels[chosen].crop(img)
        raw, mime = None, mime            # the crop is what gets read from here on
        notes.append(f"This sheet shows {len(panels)} flats; reading flat {chosen + 1}."
                     " Pick another below if that is not yours.")

    w, h = img.size
    result: Optional[dict[str, Any]] = None
    if os.getenv("GEMINI_KEY") and raw is not None:
        try:
            result = _detect_with_gemini(raw, mime, w, h, bhk_hint)
            if not result["rooms"]:
                notes.append("Gemini found no rooms; used the offline detector.")
                result = None
        except Exception as exc:  # network, quota, malformed JSON…
            notes.append(f"Gemini vision unavailable ({type(exc).__name__}); used the offline detector.")
            result = None
    if result is None:
        # A trained segmentation model, when one is installed, is better at
        # finding rooms than tracing walls is. It only says where they are;
        # the names and the scale still come from the printed text below.
        from . import plan_model
        if plan_model.available():
            try:
                from .plan_ocr import apply_area_numbers, apply_labels, apply_legend, build_labels, read_texts
                model_rooms = plan_model.detect(img, bhk_hint=bhk_hint)
                if model_rooms is not None:
                    texts = read_texts(img)
                    result = model_rooms
                    result = apply_labels(result, img, texts=texts,
                                          labels=build_labels(texts, w, h))
                    result = apply_legend(result, img, texts=texts)
                    result = apply_area_numbers(result, img, texts=texts)
            except Exception as exc:  # noqa: BLE001
                import logging
                logging.getLogger(__name__).exception("segmentation model failed")
                notes.append(f"The room model could not read this plan ({type(exc).__name__}).")
                result = None

    if result is None:
        # Read the printed text first: it is erased before tracing walls (big
        # title lettering looks like wall), then names the rooms and sets the scale.
        # Reading labels is an improvement, never a requirement: if it fails
        # for any reason the upload still gets the shape-only detection.
        try:
            from .plan_ocr import apply_area_numbers, apply_labels, apply_legend, build_labels, read_texts
            texts = read_texts(img)
            labels = build_labels(texts, w, h)
            result = _detect_with_heuristic(img, bhk_hint, text_boxes=[(t.x0, t.y0, t.x1, t.y1) for t in texts],
                                            labels=labels)
            result = apply_labels(result, img, texts=texts, labels=result.pop("_labels", labels))
            # Architects' plans number the rooms and list the names in a key.
            result = apply_legend(result, img, texts=texts)
            # Colour plans name nothing and print each room's area instead.
            result = apply_area_numbers(result, img, texts=texts)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).exception("plan label reading failed; using shapes only")
            result = _detect_with_heuristic(img, bhk_hint)
            result.pop("_labels", None)
            notes.append(f"Couldn't read the room names on this plan ({type(exc).__name__}); check them below.")
    # Every hint the drawing gave about its own scale gets one vote, so a
    # single misread number is outvoted instead of deciding the answer.
    evidence = result.pop("_scale_evidence", [])
    aspect = result.pop("_scale_aspect", None)
    resolved = PlanScale.resolve(evidence, w, h) if evidence else None
    if resolved is not None:
        ppm, named = resolved
        result["plan_width_m"] = round(w / ppm, 2)
        # A depth of None means "same scale both ways"; only an unevenly
        # resized image needs its own number here.
        result["plan_depth_m"] = round(h / (ppm * aspect), 2) if aspect else None
        result["scale_source"] = named

    result["notes"] = notes + result.get("notes", [])
    result["image_w"], result["image_h"] = w, h
    if len(panels) > 1:
        result["panels"] = [{"box": [round(v, 4) for v in p.box], "source": p.source} for p in panels]
        result["panel"] = chosen
    return result


# ── offline heuristic ────────────────────────────────────────────────────────
def _detect_with_heuristic(img: Image.Image, bhk_hint: int,
                           text_boxes: Optional[list[tuple[float, float, float, float]]] = None,
                           labels: Optional[list[Any]] = None) -> dict[str, Any]:
    target = 900
    w0, h0 = img.size
    s = target / max(w0, h0)
    if text_boxes:
        # White out printed text so letters never become walls.
        img = img.copy()
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        for x0, y0, x1, y1 in text_boxes:
            draw.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=(255, 255, 255))
    small = img.resize((max(1, round(w0 * s)), max(1, round(h0 * s))), Image.LANCZOS)
    rgb = np.asarray(small, dtype=np.int32)     # int16 overflows in the luminance sum
    H, W = rgb.shape[:2]

    walls, thin_walls = _structural_walls(rgb, with_thin=True)
    if walls.sum() < 0.004 * H * W:
        return {"rooms": [], "plan_width_m": _fallback_width(bhk_hint, W / H), "method": "heuristic",
                "notes": ["Couldn't find wall lines in this image — draw the rooms on the plan."]}

    ys, xs = np.nonzero(walls)
    bbox_px = float((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1))
    # A working scale for the gap bridge. Deliberately independent of the
    # project's BHK: the plan decides what it contains, not the project.
    ppm0 = math.sqrt(bbox_px / _ENVELOPE_M2[2])
    wall_px = _wall_thickness(walls)

    pad = int(max(W, H) * 0.1) + 4
    wp = np.pad(walls, pad)
    rgbp = np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)), constant_values=255)
    run = max(3, int(round(1.6 * wall_px)))
    horiz = ndi.binary_opening(wp, structure=np.ones((1, run), bool))
    vert = ndi.binary_opening(wp, structure=np.ones((run, 1), bool))
    door = int(np.clip(TUNING["door_m"] * ppm0, 0.03 * max(W, H), 0.15 * max(W, H)))
    wide = int(np.clip(TUNING["wide_m"] * ppm0, door + 2, 0.3 * max(W, H)))

    gap_samples: list[int] = []
    gap_fills: list[tuple[np.ndarray, str]] = []
    closed_door = _bridge_wall_gaps(wp, horiz, vert, door, gaps=gap_samples, fills=gap_fills)
    closed_wide = _bridge_wall_gaps(wp, horiz, vert, wide)
    outside = _outside_mask(closed_wide)

    free = ~closed_door & ~outside
    labels = _drop_repeated_labels(labels or [], free, W, H, pad)
    seeds = [(lb.cx, lb.cy) for lb in labels]
    lab, _n = ndi.label(free)
    min_px = max(TUNING["min_room_m2"] * ppm0 * ppm0, 0.0012 * H * W)
    found: list[dict[str, Any]] = []
    for idx, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        comp = lab[sl] == idx
        if comp.sum() < min_px:
            continue
        # A printed room label inside this space: carve that room around the
        # label. Two labels in one space (rooms joined by an open doorway) give
        # two rooms rather than one merged shape.
        inside = []
        for sx, sy in seeds or []:
            gx, gy = int(sx * W) + pad - sl[1].start, int(sy * H) + pad - sl[0].start
            if 0 <= gy < comp.shape[0] and 0 <= gx < comp.shape[1]:
                inside.append((gx, gy))
        rects = _seeded_rects(comp, inside, min_area=min_px * 0.6) if len(inside) >= 2 else []
        for (x0, y0, x1, y1), secondary in rects or _inscribed_rects(comp, min_area=min_px):
            gx0, gy0 = x0 + sl[1].start, y0 + sl[0].start
            gx1, gy1 = x1 + sl[1].start, y1 + sl[0].start
            found.append({
                "rect": (gx0 - pad, gy0 - pad, gx1 - pad, gy1 - pad),
                "component": idx, "secondary": secondary,
                "fill": _fill_stats(rgbp[gy0:gy1, gx0:gx1]),
                "outside_edges": _outside_edges(outside, gx0, gy0, gx1, gy1, int(wall_px * 2 + 4)),
                # Open to the outside with no wall in between: a balcony's railing side.
                "open_edges": _outside_edges(outside, gx0, gy0, gx1, gy1, max(4, int(wall_px * 0.6))),
                # Sides bounded by a thin railing / double line rather than a solid wall.
                "railing_edges": _outside_edges(np.pad(thin_walls, pad), gx0, gy0, gx1, gy1, int(wall_px * 2 + 4)),
            })

    # Grow every rectangle to the wall centreline so neighbours share an edge.
    half = wall_px / 2.0
    for f in found:
        x0, y0, x1, y1 = f["rect"]
        f["rect"] = (max(0.0, x0 - half), max(0.0, y0 - half), min(W, x1 + half), min(H, y1 + half))
    snapped = _snap_rects_aligned([f["rect"] for f in found], tol=max(wall_px * 1.2, 0.2 * ppm0))
    items = []
    for f, r in zip(found, snapped):
        if r is not None and r[2] - r[0] > 2 and r[3] - r[1] > 2:
            items.append({**f, "rect": r})
    items = _merge_slivers(items, tol=max(wall_px * TUNING["sliver_walls"], 4.0))

    typed = _guess_types(items, ppm0)
    n_bed = sum(1 for t in typed if t["room_type"] in BEDROOM_TYPES)
    rooms_px = sum((r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1])
                   for r in typed if r["room_type"] != "balcony")
    coverage = rooms_px / bbox_px if bbox_px else 0
    ppm_env = math.sqrt(bbox_px / _ENVELOPE_M2.get(min(n_bed or bhk_hint, 5), 85))
    from_carpet = bool(rooms_px and coverage >= 0.45)
    ppm = math.sqrt(rooms_px / _CARPET_M2.get(min(n_bed, 5), 58)) if from_carpet else ppm_env
    evidence = [PlanScale.Evidence(
        ppm, "typical carpet area" if from_carpet else "typical envelope")]
    # Doors are the one thing drawn at a near-constant real size (~0.95 m), so
    # the median door gap is a better ruler than guessed room areas.
    doors = [g for g in gap_samples if 0.5 * ppm <= g <= 1.35 * ppm and g >= 2 * wall_px]
    if len(doors) >= 2 * max(2, int(wall_px)):
        ppm_door = float(np.median(doors)) / 0.95
        evidence.append(PlanScale.Evidence(ppm_door, "door widths", samples=len(doors)))
        ppm = ppm_door ** 0.65 * ppm ** 0.35

    for r in typed:
        x0, y0, x1, y1 = r["box"]
        r["box"] = [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]
    notes = (["Room types and the scale are estimates — check them against your plan."] if typed
             else ["No enclosed rooms were found automatically — draw them on the plan."])
    return {"rooms": _label_rooms(typed), "plan_width_m": round(W / ppm, 2),
            "_scale_evidence": evidence,
            "door_gaps": _gap_hints(gap_fills, rgbp, pad, W, H, ppm, wall_px),
            "wall_frac": round(wall_px / W, 4),
            "_labels": labels,
            "method": "heuristic", "notes": notes}


def _gap_hints(fills, rgbp, pad, W, H, ppm, wall_px) -> list[dict[str, Any]]:
    """Where the plan actually has doors and windows: every wall gap the
    bridging closed, as a segment in image fractions. A gap with glazing lines
    running through it is a window; an empty one is a door or opening."""
    lum = (299 * rgbp[..., 0] + 587 * rgbp[..., 1] + 114 * rgbp[..., 2]) / 1000
    hints: list[dict[str, Any]] = []
    for mask, axis in fills:
        lab, _ = ndi.label(mask)
        for sl in ndi.find_objects(lab):
            if sl is None:
                continue
            rows, cols = sl
            if axis == "x":
                length, thick = cols.stop - cols.start, rows.stop - rows.start
                pos, a, b = (rows.start + rows.stop) / 2 - pad, cols.start - pad, cols.stop - pad
                span, depth = W, H
            else:
                length, thick = rows.stop - rows.start, cols.stop - cols.start
                pos, a, b = (cols.start + cols.stop) / 2 - pad, rows.start - pad, rows.stop - pad
                span, depth = H, W
            if thick < max(2, 0.4 * wall_px) or not 0.55 * ppm <= length <= 2.6 * ppm:
                continue
            # Glazing is a line running the whole gap; a door leaf or swing
            # arc only crosses it. Look for a row (or column) of line pixels
            # spanning most of the gap.
            dark = lum[sl] < 175
            along_run = dark.mean(axis=1 if axis == "x" else 0) if dark.size else np.zeros(1)
            kind = "window" if float(along_run.max()) >= 0.7 else "door"
            if kind == "door" and length > 1.6 * ppm:
                continue                           # a wide empty gap is not a door
            hints.append({"axis": axis, "pos": round(pos / depth, 4),
                          "a": round(a / span, 4), "b": round(b / span, 4), "kind": kind})
    return hints[:60]


def _structural_walls(rgb: np.ndarray, with_thin: bool = False):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (299 * r + 587 * g + 114 * b) / 1000
    sat = rgb.max(axis=-1) - rgb.min(axis=-1)
    dark = (lum < TUNING["dark_lum"]) & (sat < TUNING["dark_sat"])
    opened = ndi.binary_opening(dark, structure=np.ones((3, 3), bool))
    walls = _keep_long_blobs(opened)
    if walls.sum() < 0.004 * dark.size:
        # Hollow (double-line) walls: fuse the two outlines into one band first.
        opened = ndi.binary_opening(ndi.binary_closing(dark, structure=np.ones((7, 7), bool)),
                                    structure=np.ones((3, 3), bool))
        walls = _keep_long_blobs(opened)
    walls = walls | _wall_stubs(opened & ~walls, walls)
    # Line work of any colour: CAD exports draw walls as thin red/blue double
    # lines on white, brochures as grey ones. Solid dark blobs (columns) anchor
    # the wall network even when no wall is drawn solid.
    # A coloured stroke counts only where it is a thin line on white paper;
    # coloured floor fills and tiles (brochure plans) never become wall ink.
    minc = rgb.min(axis=-1).astype(np.int16)
    paper = ndi.grey_closing(minc, size=(9, 9))
    ink = ((lum < 175) & (sat < 45)) | ((paper >= 225) & (paper - minc >= 30))
    anchors = ndi.binary_opening(dark, structure=np.ones((3, 3), bool))
    thin = _double_line_walls(ink, walls, anchors)
    if (walls | thin).sum() < 0.004 * dark.size:
        # Nothing solid and no double lines: an architect's export where every
        # wall is a single stroke. The line work itself is the wall network.
        thin = thin | _single_line_walls(ink)
    return (walls | thin, thin) if with_thin else walls | thin


def _single_line_walls(ink: np.ndarray) -> np.ndarray:
    """Walls drawn as one thin stroke each (CAD exports, blue-line brochures).

    Only the long straight runs are kept, and only if together they enclose the
    drawing — a page of furniture outlines or text rules does not.
    """
    H, W = ink.shape
    length = max(14, int(0.09 * max(H, W)))
    h = ndi.binary_opening(ndi.binary_dilation(ink, structure=np.ones((3, 1), bool)),
                           structure=np.ones((1, length), bool))
    v = ndi.binary_opening(ndi.binary_dilation(ink, structure=np.ones((1, 3), bool)),
                           structure=np.ones((length, 1), bool))
    lines = ndi.binary_dilation(h | v, structure=np.ones((3, 3), bool))
    if not lines.any():
        return np.zeros_like(ink)
    # Door openings break each wall into pieces, so the runs are judged together:
    # they must cover the drawing the way a plan's walls do.
    rows = np.where(lines.any(axis=1))[0]
    cols = np.where(lines.any(axis=0))[0]
    spans_x = (cols[-1] - cols[0]) / W
    spans_y = (rows[-1] - rows[0]) / H
    if spans_x < 0.6 or spans_y < 0.6 or lines.mean() < 0.004:
        return np.zeros_like(ink)          # a table, a legend or a title block
    return lines


def _double_line_walls(ink: np.ndarray, walls: np.ndarray, anchors: Optional[np.ndarray] = None) -> np.ndarray:
    """Walls drawn as two thin parallel lines (balcony railings, glazing,
    light partitions).

    Only long straight runs that pair up into a band are candidates, and a
    candidate must be attached to the wall network: both ends on a wall, or one
    end on a wall if it is long. Furniture outlines (a chair, a counter edge)
    float in the room or jut out from one wall briefly, so they are dropped."""
    H, W = ink.shape
    thin = ink & ~walls
    length = max(12, int(0.07 * max(H, W)))
    t = _wall_thickness(walls) if walls.any() else 6.0
    band = max(3, int(round(t * 0.45)))
    gap = max(band * 3, int(0.02 * max(H, W)))      # the spacing of a double-line wall
    h = ndi.binary_opening(ndi.binary_dilation(thin, structure=np.ones((3, 1), bool)),
                           structure=np.ones((1, length), bool))
    h = ndi.binary_opening(ndi.binary_closing(h, structure=np.ones((gap, 1), bool)),
                           structure=np.ones((band + 2, 1), bool))
    h = ndi.binary_opening(h, structure=np.ones((1, length), bool))
    v = ndi.binary_opening(ndi.binary_dilation(thin, structure=np.ones((1, 3), bool)),
                           structure=np.ones((length, 1), bool))
    v = ndi.binary_opening(ndi.binary_closing(v, structure=np.ones((1, gap), bool)),
                           structure=np.ones((1, band + 2), bool))
    v = ndi.binary_opening(v, structure=np.ones((length, 1), bool))

    segments = []
    for mask, horizontal in ((h, True), (v, False)):
        lab, n = ndi.label(mask)
        for i, sl in enumerate(ndi.find_objects(lab), start=1):
            if sl is not None:
                segments.append((lab[sl] == i, sl, horizontal))

    reach = int(t) + 4
    network = walls.copy()
    if anchors is not None:
        network |= anchors
    accepted = np.zeros_like(walls)
    if not network.any():
        # Nothing drawn solid at all: the very long runs are the outer walls.
        for seg, sl, horizontal in segments:
            run = (sl[1].stop - sl[1].start) if horizontal else (sl[0].stop - sl[0].start)
            if run >= 2.5 * length:
                accepted[sl] |= seg
        network |= accepted
    pending = list(range(len(segments)))
    for _ in range(4):                       # later segments may attach to earlier ones
        grown = ndi.binary_dilation(network, iterations=reach)
        still = []
        for k in pending:
            seg, sl, horizontal = segments[k]
            rows, cols = sl
            run = (cols.stop - cols.start) if horizontal else (rows.stop - rows.start)
            if horizontal:
                a = grown[rows, max(0, cols.start - 1):cols.start + 2].any()
                b = grown[rows, max(0, cols.stop - 2):min(W, cols.stop + 1)].any()
            else:
                a = grown[max(0, rows.start - 1):rows.start + 2, cols].any()
                b = grown[max(0, rows.stop - 2):min(H, rows.stop + 1), cols].any()
            if (a and b) or ((a or b) and run >= 1.6 * length):
                accepted[sl] |= seg
                network[sl] |= seg
            else:
                still.append(k)
        if len(still) == len(pending):
            break
        pending = still
    return accepted


def _wall_stubs(candidates: np.ndarray, walls: np.ndarray) -> np.ndarray:
    """Short wall pieces between two doors are too small for the blob filter,
    but unlike text they are solid bars about one wall thick."""
    if not walls.any() or not candidates.any():
        return np.zeros_like(walls)
    t = _wall_thickness(walls)
    lab, n = ndi.label(candidates)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        short, long_ = min(h, w), max(h, w)
        fill = (lab[sl] == i).sum() / float(h * w)
        if fill >= 0.8 and long_ >= 2 * short and 0.5 * t <= short <= 2.2 * t and long_ >= 1.5 * t:
            keep[i] = True
    return keep[lab]


def _keep_long_blobs(mask: np.ndarray) -> np.ndarray:
    """Drop text, symbols and furniture outlines; keep the wall network."""
    lab, n = ndi.label(mask, structure=np.ones((3, 3), bool))
    if n == 0:
        return mask
    H, W = mask.shape
    sizes = ndi.sum(mask, lab, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        span = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
        if span >= TUNING["blob_span"] * max(H, W) or sizes[i - 1] >= TUNING["blob_mass"] * H * W:
            keep[i] = True
    return keep[lab]


def _wall_thickness(walls: np.ndarray) -> float:
    edt = ndi.distance_transform_edt(walls)
    ridge = walls & (edt >= ndi.maximum_filter(edt, size=3)) & (edt >= 1)
    return float(np.clip(2 * np.median(edt[ridge]) if ridge.any() else 6.0, 2.0, 40.0))


def _bridge_wall_gaps(walls: np.ndarray, horiz: np.ndarray, vert: np.ndarray, length: int,
                      gaps: Optional[list[int]] = None,
                      fills: Optional[list[tuple[np.ndarray, str]]] = None) -> np.ndarray:
    """Close door and window gaps *along* walls.

    A free run of pixels is bridged only when it is short enough and at least
    one of its two ends is the continuation of a wall running the same way.
    The gap between two parallel walls (a narrow WC, a corridor) is never
    filled, which plain morphological closing would do. When ``gaps`` is given,
    the length of every gap with wall on both sides is appended (one sample per
    pixel row of wall), which is what the door-width scale estimate uses."""
    out = walls.copy()
    for mask, along in ((horiz, 1), (vert, 0)):
        wm = walls if along == 1 else walls.T
        am = mask if along == 1 else mask.T
        rows, cols = wm.shape
        # int32 throughout: these are full-image index arrays, and plans are
        # traced on machines with little memory to spare.
        idx = np.broadcast_to(np.arange(cols, dtype=np.int32)[None, :], (rows, cols))
        last = np.maximum.accumulate(np.where(wm, idx, np.int32(-1)), axis=1)
        nxt = np.flip(np.minimum.accumulate(np.flip(np.where(wm, idx, np.int32(cols)), axis=1), axis=1), axis=1)
        gap = nxt - last - 1
        ok = (~wm) & (last >= 0) & (nxt < cols) & (gap <= length)
        r_idx = np.broadcast_to(np.arange(rows, dtype=np.int32)[:, None], (rows, cols))
        left_along = np.zeros_like(ok)
        right_along = np.zeros_like(ok)
        left_along[ok] = am[r_idx[ok], last[ok]]
        right_along[ok] = am[r_idx[ok], nxt[ok]]
        # A door beside a corner has one end on the turning wall. That wall
        # stops at this line (it continues on one side only); a wall that runs
        # straight past on both sides is the far side of a narrow room instead.
        reach = max(3, int(round(_wall_thickness(walls))) + 2) if walls.any() else 6
        up_r = np.clip(r_idx - reach, 0, rows - 1)
        dn_r = np.clip(r_idx + reach, 0, rows - 1)
        left_corner = np.zeros_like(ok)
        right_corner = np.zeros_like(ok)
        left_corner[ok] = ~(wm[up_r[ok], last[ok]] & wm[dn_r[ok], last[ok]])
        right_corner[ok] = ~(wm[up_r[ok], nxt[ok]] & wm[dn_r[ok], nxt[ok]])
        fill = ok & ((left_along & right_along) | (left_along & right_corner) | (right_along & left_corner))
        out |= fill if along == 1 else fill.T
        if fills is not None:              # "x": a gap in a horizontal wall
            fills.append((fill, "x") if along == 1 else (fill.T, "y"))
        if gaps is not None:
            starts = fill & (idx == last + 1) & left_along & right_along
            gaps.extend(int(g) for g in gap[starts])
    return out


def _drop_repeated_labels(labels: list[Any], free: np.ndarray, W: int, H: int, pad: int) -> list[Any]:
    """A label printed twice ("KITCHEN 3.1*1.9" copied into the dining area)
    names one room only: keep the copy whose surrounding space matches the
    printed size, judged at the scale the plan's unique labels agree on."""
    from .plan_ocr import _fit_ppm

    key = lambda lb: (lb.room_type, tuple(round(v, 1) for v in lb.dims_m))  # noqa: E731
    groups: dict[tuple, list[Any]] = {}
    for lb in labels:
        if len(lb.dims_m) == 2:
            groups.setdefault(key(lb), []).append(lb)
    if not any(len(g) > 1 for g in groups.values()):
        return labels
    small = free[::2, ::2]
    sizes: dict[int, Optional[tuple[float, float]]] = {}
    for lb in labels:
        r = _rect_around(small, (int(lb.cx * W) + pad) // 2, (int(lb.cy * H) + pad) // 2)
        sizes[id(lb)] = ((r[3] - r[1]) * 2.0, (r[4] - r[2]) * 2.0) if r else None
    ppms = []
    for g in groups.values():
        if len(g) == 1 and sizes.get(id(g[0])):
            fit = _fit_ppm(sizes[id(g[0])], g[0].dims_m)
            if fit and fit[1] <= 0.35:
                ppms.append(fit[0])
    if not ppms:
        return labels
    ppm = float(np.median(ppms))
    drop: set[int] = set()
    for g in groups.values():
        if len(g) < 2:
            continue

        def mismatch(lb):
            size = sizes.get(id(lb))
            if not size:
                return 99.0
            area_m2 = size[0] * size[1] / (ppm * ppm)
            return abs(math.log(max(area_m2, 1e-3) / (lb.dims_m[0] * lb.dims_m[1])))
        keep = min(g, key=mismatch)
        drop.update(id(lb) for lb in g if lb is not keep)
    return [lb for lb in labels if id(lb) not in drop]


def _rect_around(mask: np.ndarray, px: int, py: int) -> Optional[tuple[int, int, int, int, int]]:
    """Largest all-True rectangle that contains (px, py): (area, x0, y0, x1, y1)."""
    H, W = mask.shape
    if not (0 <= px < W and 0 <= py < H):
        return None
    if not mask[py, px]:                          # the label sits on a line: step to free space nearby
        ys, xs = np.nonzero(mask[max(0, py - 6):py + 7, max(0, px - 6):px + 7])
        if not len(xs):
            return None
        k = int(np.argmin((xs - min(px, 6)) ** 2 + (ys - min(py, 6)) ** 2))
        px, py = max(0, px - 6) + int(xs[k]), max(0, py - 6) + int(ys[k])
    x_lo = px
    while x_lo > 0 and mask[py, x_lo - 1]:
        x_lo -= 1
    x_hi = px
    while x_hi < W - 1 and mask[py, x_hi + 1]:
        x_hi += 1
    col = mask[:, x_lo:x_hi + 1]
    # Free run up and down from row py in every column of the row span.
    up = np.zeros(x_hi - x_lo + 1, dtype=np.int32)
    dn = np.zeros(x_hi - x_lo + 1, dtype=np.int32)
    for i in range(x_hi - x_lo + 1):
        c = col[:, i]
        blocked_up = np.nonzero(~c[:py + 1][::-1])[0]
        blocked_dn = np.nonzero(~c[py:])[0]
        up[i] = blocked_up[0] - 1 if len(blocked_up) else py
        dn[i] = blocked_dn[0] - 1 if len(blocked_dn) else H - 1 - py
    c0 = px - x_lo
    best = None
    left_up, left_dn = np.minimum.accumulate(up[:c0 + 1][::-1]), np.minimum.accumulate(dn[:c0 + 1][::-1])
    right_up, right_dn = np.minimum.accumulate(up[c0:]), np.minimum.accumulate(dn[c0:])
    for a in range(len(left_up)):
        for b in range(len(right_up)):
            u = min(left_up[a], right_up[b])
            d = min(left_dn[a], right_dn[b])
            area = (a + b + 1) * (u + d + 1)
            if best is None or area > best[0]:
                best = (area, c0 - a + x_lo, py - u, c0 + b + x_lo + 1, py + d + 1)
    return best


def _seeded_rects(comp: np.ndarray, seeds: list[tuple[int, int]], min_area: float
                  ) -> list[tuple[tuple[int, int, int, int], bool]]:
    """One room per printed label inside a joined-up space, largest first,
    each carved out before the next so they never overlap."""
    f = 2 if max(comp.shape) > 120 else 1
    grid = comp[::f, ::f].copy() if f > 1 else comp.copy()
    candidates = []
    for sx, sy in seeds:
        r = _rect_around(grid, sx // f, sy // f)
        if r:
            candidates.append((r, (sx // f, sy // f)))
    points = [p for _, p in candidates]
    out = []
    for _, (gx, gy) in sorted(candidates, key=lambda c: -c[0][0]):
        r = _rect_around(grid, gx, gy)
        if not r or r[0] * f * f < min_area:
            continue
        _, x0, y0, x1, y1 = r
        # Another label inside this rectangle is another room: split between
        # the two at the narrowest line (where a partial wall or door is).
        for _ in range(len(points)):
            others = [(ox, oy) for ox, oy in points if (ox, oy) != (gx, gy)
                      and x0 <= ox < x1 and y0 <= oy < y1]
            if not others:
                break
            ox, oy = min(others, key=lambda q: (q[0] - gx) ** 2 + (q[1] - gy) ** 2)
            if abs(oy - gy) >= abs(ox - gx):
                lo, hi = sorted((gy, oy))
                counts = grid[lo + 1:hi, x0:x1].sum(axis=1)
                if not len(counts):
                    break
                mid = (hi - lo) / 2
                cut = lo + 1 + int(min(range(len(counts)), key=lambda k: (counts[k], abs(k - mid))))
                y0, y1 = (y0, cut) if oy > gy else (cut + 1, y1)
            else:
                lo, hi = sorted((gx, ox))
                counts = grid[y0:y1, lo + 1:hi].sum(axis=0)
                if not len(counts):
                    break
                mid = (hi - lo) / 2
                cut = lo + 1 + int(min(range(len(counts)), key=lambda k: (counts[k], abs(k - mid))))
                x0, x1 = (x0, cut) if ox > gx else (cut + 1, x1)
        if (x1 - x0) * (y1 - y0) * f * f < min_area:
            continue
        out.append(((x0 * f, y0 * f, x1 * f, y1 * f), False))
        grid[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1] = False
    return out


def _outside_mask(walls: np.ndarray) -> np.ndarray:
    """Free space outside the home.

    Border-connected space is only a candidate: a room behind a window wider
    than the gap bridge also connects to the border. A pixel is truly outside
    when it can see the image edge in at least two directions without crossing
    a wall; a room pixel lined up with a window sees out one way at most."""
    lab, _ = ndi.label(~walls)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    reach = np.isin(lab, border[border > 0])
    w = walls.astype(np.int32)
    escapes = ((np.cumsum(w, axis=0) == 0).astype(np.uint8)
               + (np.flip(np.cumsum(np.flip(w, 0), axis=0), 0) == 0)
               + (np.cumsum(w, axis=1) == 0)
               + (np.flip(np.cumsum(np.flip(w, 1), axis=1), 1) == 0))
    return reach & (escapes >= 2)


def _largest_rect(mask: np.ndarray) -> tuple[int, int, int, int, int]:
    """Largest all-True axis-aligned rectangle: (area, x0, y0, x1, y1)."""
    H, W = mask.shape
    heights = np.zeros(W, dtype=np.int32)
    best = (0, 0, 0, 0, 0)
    for y in range(H):
        heights = np.where(mask[y], heights + 1, 0)
        stack: list[tuple[int, int]] = []
        for x in range(W + 1):
            hcur = int(heights[x]) if x < W else 0
            start = x
            while stack and stack[-1][1] >= hcur:
                s0, hh = stack.pop()
                area = hh * (x - s0)
                if area > best[0]:
                    best = (area, s0, y - hh + 1, x, y + 1)
                start = s0
            stack.append((start, hcur))
    return best


def _inscribed_rects(comp: np.ndarray, min_area: float) -> list[tuple[tuple[int, int, int, int], bool]]:
    """Cover a free-space component with up to three rectangles.

    Returns ``(rect, secondary)`` pairs. A rectangle that opens straight onto
    an earlier one (an L-shaped living/dining) is secondary; one reached only
    through a narrow neck (two rooms joined by an unclosed door) is a room."""
    f = 2 if max(comp.shape) > 120 else 1
    grid = comp[::f, ::f] if f > 1 else comp
    out: list[tuple[tuple[int, int, int, int], bool]] = []
    rest = grid.copy()
    first_area = 0
    min_side = math.sqrt(min_area) * 0.9
    for k in range(3):
        area, x0, y0, x1, y1 = _largest_rect(rest)
        if k == 0:
            if area * f * f < min_area:
                return out
            first_area = area
        elif area * f * f < max(min_area * 1.5, 0.25 * first_area * f * f) or min(x1 - x0, y1 - y0) * f < min_side:
            break
        secondary = k > 0 and any(_open_contact((x0, y0, x1, y1), prev) for prev, _ in
                                  ((tuple(v // f for v in r), s) for r, s in out))
        out.append(((x0 * f, y0 * f, x1 * f, y1 * f), secondary))
        rest[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1] = False
        # Trim the slivers a rectangle leaves along its sides.
        rest = ndi.binary_opening(rest, structure=np.ones((3, 3), bool))
    return out


def _open_contact(r: tuple[int, int, int, int], q: tuple[int, int, int, int]) -> bool:
    """True when two rectangles carved from one space touch along most of an edge."""
    ox = min(r[2], q[2]) - max(r[0], q[0])
    oy = min(r[3], q[3]) - max(r[1], q[1])
    gap_x = max(r[0] - q[2], q[0] - r[2])
    gap_y = max(r[1] - q[3], q[1] - r[3])
    shorter = min(r[2] - r[0], r[3] - r[1])
    if gap_x <= 3 and oy > 0:
        return oy >= 0.5 * shorter
    if gap_y <= 3 and ox > 0:
        return ox >= 0.5 * shorter
    return False


def _fill_stats(patch: np.ndarray) -> dict[str, float]:
    """Floor colour of a room, ignoring walls, text and furniture outlines."""
    if patch.size == 0:
        return {"lum": 255.0, "sat": 0.0, "r": 255.0, "g": 255.0, "b": 255.0, "texture": 0.0}
    px = patch.reshape(-1, 3).astype(np.float32)
    lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2])
    keep = lum > 120
    if keep.sum() < 20:
        keep = np.ones_like(lum, bool)
    med = np.median(px[keep], axis=0)
    return {"lum": float(np.median(lum[keep])), "sat": float(med.max() - med.min()),
            "r": float(med[0]), "g": float(med[1]), "b": float(med[2]),
            "texture": float(np.std(lum[keep]))}


def _outside_edges(outside: np.ndarray, x0: int, y0: int, x1: int, y1: int, reach: int) -> dict[str, float]:
    """Fraction of each side of a rectangle that faces the outside of the plan."""
    H, W = outside.shape
    def frac(band):
        return float(band.mean()) if band.size else 0.0
    return {
        "top": frac(outside[max(0, y0 - reach):y0, x0:x1].any(axis=0)),
        "bottom": frac(outside[y1:min(H, y1 + reach), x0:x1].any(axis=0)),
        "left": frac(outside[y0:y1, max(0, x0 - reach):x0].any(axis=1)),
        "right": frac(outside[y0:y1, x1:min(W, x1 + reach)].any(axis=1)),
    }


def _cluster_map(values: list[float], tol: float) -> dict[float, float]:
    mapping: dict[float, float] = {}
    group: list[float] = []
    for v in sorted(set(values)):
        if group and v - group[0] > tol:
            mean = sum(group) / len(group)
            mapping.update({g: mean for g in group})
            group = []
        group.append(v)
    if group:
        mean = sum(group) / len(group)
        mapping.update({g: mean for g in group})
    return mapping


def _snap_rects_aligned(rects, tol):
    if not rects:
        return []
    xm = _cluster_map([v for r in rects for v in (r[0], r[2])], tol)
    ym = _cluster_map([v for r in rects for v in (r[1], r[3])], tol)
    return _resolve_overlaps_aligned([(xm[r[0]], ym[r[1]], xm[r[2]], ym[r[3]]) for r in rects])


def _resolve_overlaps_aligned(rects: list[tuple[float, float, float, float]]
                              ) -> list[Optional[tuple[float, float, float, float]]]:
    """Trim the smaller of any two overlapping rectangles off the larger one.
    Returns one entry per input (None where a rectangle was trimmed away)."""
    rs = [list(r) for r in rects]
    for _ in range(4 * len(rs)):
        changed = False
        order = sorted(range(len(rs)), key=lambda i: -(rs[i][2] - rs[i][0]) * (rs[i][3] - rs[i][1]))
        for a_i, i in enumerate(order):
            for j in order[a_i + 1:]:
                a, b = rs[i], rs[j]
                ox = min(a[2], b[2]) - max(a[0], b[0])
                oy = min(a[3], b[3]) - max(a[1], b[1])
                if ox <= 1e-6 or oy <= 1e-6 or a[2] <= a[0] or b[2] <= b[0]:
                    continue
                if ox <= oy:
                    if (b[0] + b[2]) / 2 < (a[0] + a[2]) / 2:
                        b[2] = min(b[2], a[0])
                    else:
                        b[0] = max(b[0], a[2])
                else:
                    if (b[1] + b[3]) / 2 < (a[1] + a[3]) / 2:
                        b[3] = min(b[3], a[1])
                    else:
                        b[1] = max(b[1], a[3])
                changed = True
        if not changed:
            break
    return [tuple(r) if r[2] > r[0] and r[3] > r[1] else None for r in rs]


def _merge_slivers(items: list[dict[str, Any]], tol: float) -> list[dict[str, Any]]:
    """No room is shallower than ~0.8 m. A strip that thin is a counter, a sill
    or a ledge drawn with its own outline: fold it into the room it belongs to."""
    if len(items) < 2:
        return items
    largest = max((it["rect"][2] - it["rect"][0]) * (it["rect"][3] - it["rect"][1]) for it in items)
    limit = 0.18 * math.sqrt(largest)
    keep = list(items)
    for sliver in sorted(items, key=lambda it: min(it["rect"][2] - it["rect"][0], it["rect"][3] - it["rect"][1])):
        x0, y0, x1, y1 = sliver["rect"]
        if min(x1 - x0, y1 - y0) >= limit or sliver not in keep:
            continue
        best = None
        for other in keep:
            if other is sliver:
                continue
            a0, b0, a1, b1 = other["rect"]
            # Same span along the shared edge, touching across it.
            if abs(a0 - x0) <= tol and abs(a1 - x1) <= tol and (abs(b1 - y0) <= tol or abs(y1 - b0) <= tol):
                best = other
            elif abs(b0 - y0) <= tol and abs(b1 - y1) <= tol and (abs(a1 - x0) <= tol or abs(x1 - a0) <= tol):
                best = other
            if best is not None:
                break
        if best is None:
            keep.remove(sliver)          # too thin to be a room and nothing to join: a ledge or a gap
            continue
        a0, b0, a1, b1 = best["rect"]
        best["rect"] = (min(a0, x0), min(b0, y0), max(a1, x1), max(b1, y1))
        keep.remove(sliver)
    return keep


def _guess_types(items: list[dict[str, Any]], ppm: float) -> list[dict[str, Any]]:
    """Name rooms from floor colour, shape and size. The customer corrects the rest."""
    if not items:
        return []
    for it in items:
        x0, y0, x1, y1 = it["rect"]
        it["w"], it["d"] = x1 - x0, y1 - y0
        it["area"] = it["w"] * it["d"]
        it["short"], it["long"] = min(it["w"], it["d"]), max(it["w"], it["d"])
    items.sort(key=lambda it: -it["area"])
    unfilled = lambda f: f["lum"] >= 242 and f["sat"] <= 14  # noqa: E731
    filled_plan = sum(1 for it in items if not unfilled(it["fill"])) >= 2
    primary = [it for it in items if not it["secondary"]]
    # On a coloured plan, white floor is circulation, never the living room.
    candidates = [it for it in primary if not (filled_plan and unfilled(it["fill"]))] or primary or items
    living = candidates[0]
    largest = living["area"]
    living["room_type"] = "living_room"
    lf = living["fill"]
    # Thresholds are relative to the living room, never to the guessed scale,
    # so the project's BHK can't change how a plan is read.
    ref = math.sqrt(largest)

    def colour_gap(f):
        return math.sqrt((f["r"] - lf["r"]) ** 2 + (f["g"] - lf["g"]) ** 2 + (f["b"] - lf["b"]) ** 2)

    colour_coded = filled_plan and any(
        colour_gap(it["fill"]) > 28 for it in items if it is not living and not unfilled(it["fill"]))

    for it in items:
        if "room_type" in it:
            continue
        f, oe = it["fill"], it["outside_edges"]
        aspect = it["long"] / max(it["short"], 1e-6)
        long_sides = ("top", "bottom") if it["w"] >= it["d"] else ("left", "right")
        faces_out = max(oe[s] for s in long_sides) > 0.5
        open_side = max(it["open_edges"][s] for s in long_sides) > 0.5
        railing_side = max(it.get("railing_edges", {}).get(s, 0.0) for s in long_sides) > 0.5
        if it["secondary"]:
            base = next((o for o in items if o["component"] == it["component"] and not o["secondary"]), None)
            it["room_type"] = "dining_area" if base is living else "passage"
        elif filled_plan and unfilled(f):
            it["room_type"] = "passage"          # unfilled floor on a coloured plan
        elif (open_side or railing_side) and aspect >= 1.6 and it["short"] < 0.45 * ref:
            it["room_type"] = "balcony"
        elif aspect >= 2.4 and it["short"] < 0.4 * ref:
            it["room_type"] = "balcony" if faces_out else "passage"
        elif it["area"] < 0.16 * largest:
            # When floors are colour-coded, a small space in the living room's
            # colour is a lobby or passage; a WC or bath is drawn tiled.
            it["room_type"] = "passage" if colour_coded and colour_gap(f) <= 28 else "bathroom"
        elif filled_plan and colour_gap(f) > 28 and it["area"] < 0.6 * largest:
            it["room_type"] = "wet"              # tiled floor: kitchen or bathroom, decided below

    wet = sorted((it for it in items if it.get("room_type") == "wet"), key=lambda it: -it["area"])
    has_kitchen = False
    for k, it in enumerate(wet):
        # Bathrooms rarely exceed ~5 m²; kitchens rarely fall below it.
        roomy = it["area"] >= 0.27 * largest
        bigger = k == 0 and (roomy or len(wet) == 1 or it["area"] >= 1.25 * wet[1]["area"]) \
            and it["area"] >= 0.18 * largest
        it["room_type"] = "kitchen" if bigger else "bathroom"
        has_kitchen = has_kitchen or bigger
    rest = [it for it in items if "room_type" not in it]
    if not has_kitchen and rest:
        smallest = min(rest, key=lambda it: it["area"])
        others = [it["area"] for it in rest if it is not smallest]
        if (others and smallest["area"] < 0.7 * max(others)) or (not others and smallest["area"] < 0.4 * largest):
            smallest["room_type"] = "kitchen"
    beds = sorted((it for it in items if "room_type" not in it), key=lambda it: -it["area"])
    for k, it in enumerate(beds):
        it["room_type"] = "master_bedroom" if k == 0 else "bedroom"
    by_hue = False
    if colour_coded:
        by_hue = _retype_by_hue(items)
        if not by_hue:
            _retype_by_floor_colour(items, living)
    return [{"box": list(it["rect"]), "room_type": it["room_type"],
             # Floor drawn in a different colour from the living room (tiles).
             "tiled": bool(colour_coded and colour_gap(it["fill"]) > 28 and it is not living),
             # Typed from a colour code: later size rules must not overrule it.
             "by_colour": by_hue and it.get("hue_role") is not None}
            for it in items]


def _hue(f: dict[str, float]) -> float:
    import colorsys
    h, _l, _s = colorsys.rgb_to_hls(f["r"] / 255, f["g"] / 255, f["b"] / 255)
    return h * 360


def _retype_by_hue(items: list[dict[str, Any]]) -> bool:
    """Saturated colour-coded plans follow a convention across Indian brochures:
    yellow for living, orange / salmon / pink for bedrooms, cyan and blue for
    kitchen and toilets, grey for balconies. Reading the code beats assuming
    the living room is the biggest room — a master bedroom often is bigger.

    Returns False (and changes nothing) when the fills are not a colour code.
    """
    def role(f):
        if f["lum"] >= 242 and f["sat"] <= 14:
            return None                                  # white floor: circulation
        if f["sat"] < 28:
            return "grey"
        h = _hue(f)
        if 165 <= h <= 255:
            return "wet"
        if 38 <= h < 75:
            return "living"
        if h < 38 or h >= 300:
            return "sleeping"
        return None

    saturated = [it for it in items if not it["secondary"] and it["fill"]["sat"] >= 60]
    roles = {role(it["fill"]) for it in saturated}
    if len(saturated) < 3 or not {"living", "sleeping"} <= roles:
        return False

    for it in items:
        it["hue_role"] = role(it["fill"]) if not it["secondary"] else None

    living = [it for it in items if it["hue_role"] == "living"]
    sleeping = [it for it in items if it["hue_role"] == "sleeping"]
    wet = [it for it in items if it["hue_role"] == "wet"]
    grey = [it for it in items if it["hue_role"] == "grey"]

    # Living: the biggest yellow room; smaller yellow spaces are dining or passage.
    living.sort(key=lambda it: -it["area"])
    for k, it in enumerate(living):
        narrow = it["long"] >= 2.4 * it["short"]
        if k == 0:
            it["room_type"] = "living_room"
        elif narrow or it["area"] < 0.3 * living[0]["area"]:
            it["room_type"] = "passage"
        else:
            it["room_type"] = "dining_area"

    # Bedrooms: every warm room big enough to sleep in; the biggest is the master.
    sleeping.sort(key=lambda it: -it["area"])
    biggest_bed = sleeping[0]["area"] if sleeping else 0.0
    for k, it in enumerate(sleeping):
        if k and it["area"] < 0.35 * biggest_bed:
            it["room_type"] = "passage"                  # a warm-coloured nook, not a bedroom
        else:
            it["room_type"] = "master_bedroom" if k == 0 else "bedroom"

    # Wet rooms: two blues mean kitchen (lighter, cyan) and toilets (deeper blue);
    # one blue is split by size — the kitchen is the one clearly bigger.
    if wet:
        groups: list[list[dict[str, Any]]] = []
        for it in sorted(wet, key=lambda it: _hue(it["fill"])):
            if groups and abs(_hue(it["fill"]) - _hue(groups[-1][0]["fill"])) <= 14:
                groups[-1].append(it)
            else:
                groups.append([it])
        if len(groups) >= 2:
            kitchen_group = min(groups, key=lambda g: _hue(g[0]["fill"]))      # cyan sits below blue
            for g in groups:
                for it in g:
                    it["room_type"] = "kitchen" if g is kitchen_group else "bathroom"
            kitchens = [it for it in kitchen_group]
            if len(kitchens) > 1:                         # a cyan utility beside the kitchen
                kitchens.sort(key=lambda it: -it["area"])
                for it in kitchens[1:]:
                    it["room_type"] = "passage"
        else:
            # One shade of blue for all wet rooms: the kitchen is the biggest of them.
            ordered = sorted(wet, key=lambda it: -it["area"])
            lone_is_small = len(ordered) == 1 and biggest_bed and ordered[0]["area"] < 0.25 * biggest_bed
            for k, it in enumerate(ordered):
                it["room_type"] = "kitchen" if k == 0 and not lone_is_small else "bathroom"

    # Grey: balconies when they face out or are long and thin, else passage.
    for it in grey:
        aspect = it["long"] / max(it["short"], 1e-6)
        outside = max(it["outside_edges"].values()) > 0.5
        it["room_type"] = "balcony" if outside or aspect >= 1.8 else "passage"

    if not wet and not any(it["room_type"] == "kitchen" for it in items):
        # No wet colour at all: the smallest bedroom-sized room is the kitchen.
        spare = [it for it in items if it["room_type"] in ("bedroom",) and it["area"] < 0.6 * biggest_bed]
        if spare:
            min(spare, key=lambda it: it["area"])["room_type"] = "kitchen"
    return True


def _retype_by_floor_colour(items: list[dict[str, Any]], living: dict[str, Any]) -> None:
    """On a brochure that colour-codes its floors, rooms sharing a colour are
    the same kind of room: the bedrooms are one colour, the wet rooms another.

    Grouping by colour beats judging each room on its own size, which is what
    turns a compact flat's 4 m² bedroom into a bathroom.
    """
    def gap(a, b):
        return math.dist((a["r"], a["g"], a["b"]), (b["r"], b["g"], b["b"]))

    groups: list[dict[str, Any]] = []
    for it in items:
        if it["secondary"] or it["fill"]["lum"] >= 242 and it["fill"]["sat"] <= 14:
            continue                                   # circulation, not a coloured room
        for g in groups:
            if gap(it["fill"], g["fill"]) <= 30:
                g["members"].append(it)
                break
        else:
            groups.append({"fill": it["fill"], "members": [it]})
    if len(groups) < 3:
        return                                          # not enough colours to mean anything

    def outdoorish(it):
        aspect = it["long"] / max(it["short"], 1e-6)
        return aspect >= 2.0 and (max(it["outside_edges"].values()) > 0.5
                                  or max(it.get("railing_edges", {}).values() or [0.0]) > 0.5)

    home = next(g for g in groups if living in g["members"])
    rest = [g for g in groups if g is not home]
    for g in rest:
        g["area"] = statistics.median(m["area"] for m in g["members"])
    outdoor = [g for g in rest if all(outdoorish(m) for m in g["members"])]
    indoor = sorted((g for g in rest if g not in outdoor), key=lambda g: g["area"])
    if not indoor:
        return

    for g in outdoor:
        for m in g["members"]:
            m["room_type"] = "balcony"
    wet, kitchen_group = indoor[0], indoor[1] if len(indoor) > 1 else None
    for m in wet["members"]:
        m["room_type"] = "bathroom"
    if kitchen_group is not None and len(kitchen_group["members"]) <= 2 and len(indoor) > 2:
        for m in kitchen_group["members"]:
            m["room_type"] = "kitchen"
        bedroom_groups = indoor[2:]
    else:
        bedroom_groups = indoor[1:]
    sleeping = [m for g in bedroom_groups for m in g["members"]]
    for m in sorted(sleeping, key=lambda m: -m["area"]):
        m["room_type"] = "bedroom"
    if sleeping:
        max(sleeping, key=lambda m: m["area"])["room_type"] = "master_bedroom"


def _label_rooms(rooms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Give every room an id and a human label ("Bedroom 2", "Bathroom 2")."""
    order = {k: i for i, k in enumerate(ROOM_TYPES)}
    rooms = sorted(rooms, key=lambda r: (order.get(r["room_type"], 99), r["box"][1], r["box"][0]))
    n_bed = sum(1 for r in rooms if r["room_type"] in BEDROOM_TYPES)
    counts: dict[str, int] = {}
    for i, r in enumerate(rooms):
        t = r["room_type"]
        counts[t] = counts.get(t, 0) + 1
        if r.get("label"):
            pass
        elif t == "master_bedroom":
            r["label"] = "Bedroom" if n_bed == 1 else "Master Bedroom"
        elif t == "bedroom":
            r["label"] = f"Bedroom {counts[t] + (1 if any(x['room_type'] == 'master_bedroom' for x in rooms) else 0)}"
        elif counts[t] > 1:
            r["label"] = f"{ROOM_TYPES[t]['label']} {counts[t]}"
        else:
            r["label"] = ROOM_TYPES[t]["label"]
        r.setdefault("id", f"r{i + 1}")
    return rooms


def _fallback_width(bhk: int, aspect: float) -> float:
    return round(math.sqrt(_ENVELOPE_M2.get(min(max(bhk, 0), 5), 85) * max(aspect, 0.3)), 2)


# ── Gemini vision ────────────────────────────────────────────────────────────
_GEMINI_TYPES = ", ".join(ROOM_TYPES)


def _detect_with_gemini(raw: bytes, mime: str, w: int, h: int, bhk_hint: int) -> dict[str, Any]:
    import requests

    model = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
           f"?key={os.getenv('GEMINI_KEY')}")
    prompt = (
        "The image is a 2D architectural floor plan of one apartment. List every enclosed room or "
        "space (living, dining, kitchen, bedrooms, bathrooms/WC, balconies, passages). For each give: "
        f'"name" as printed; "type" — one of: {_GEMINI_TYPES} (use bathroom for WC/toilet, passage for '
        'corridors, utility and wash areas, master_bedroom for the largest bedroom); "box_2d" — the room\'s '
        "inner outline as [ymin, xmin, ymax, xmax] normalised to 0-1000 over the whole image; and, only when "
        'dimensions are printed, "width_m" (horizontal extent in the image) and "depth_m" (vertical extent), '
        "converted from feet-inches to metres. Ignore furniture, dimension lines, the compass and captions. "
        'Reply with JSON only: {"rooms": [...]}'
    )
    payload = {
        "contents": [{"parts": [
            {"inlineData": {"mimeType": mime, "data": base64.b64encode(raw).decode()}},
            {"text": prompt},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
    }
    resp = requests.post(url, json=payload, timeout=45)
    resp.raise_for_status()
    text = "".join(p.get("text", "") for c in resp.json().get("candidates", [])
                   for p in c.get("content", {}).get("parts", []))
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    data = json.loads(text)
    rooms, widths = [], []
    for item in data.get("rooms", []) if isinstance(data, dict) else []:
        box = item.get("box_2d") or []
        if len(box) != 4:
            continue
        y0, x0, y1, x1 = (max(0.0, min(1000.0, float(v))) / 1000.0 for v in box)
        if x1 - x0 < 0.02 or y1 - y0 < 0.02:
            continue
        rtype = str(item.get("type", "")).strip().lower()
        if rtype not in ROOM_TYPES:
            rtype = "passage"
        name = str(item.get("name") or "").strip().title()[:40]
        rooms.append({"box": [x0, y0, x1, y1], "room_type": rtype, "label": name or None})
        for key, span in (("width_m", x1 - x0), ("depth_m", (y1 - y0) * h / w)):
            try:
                metres = float(item.get(key) or 0)
            except (TypeError, ValueError):
                metres = 0
            if 0.8 <= metres <= 15 and span > 0.03:
                widths.append(metres / span)
    for r in rooms:
        if not r["label"]:
            r.pop("label")
    plan_width = float(np.median(widths)) if len(widths) >= 2 else None
    if plan_width is None or not 3 <= plan_width <= 60:
        n_bed = sum(1 for r in rooms if r["room_type"] in BEDROOM_TYPES)
        area_norm = sum((r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1]) * h / w
                        for r in rooms if r["room_type"] != "balcony")
        plan_width = math.sqrt(_CARPET_M2.get(min(n_bed, 5), 58) / area_norm) if area_norm else _fallback_width(bhk_hint, w / h)
    rooms = _label_rooms([{**r, "box": [round(v, 4) for v in r["box"]]} for r in rooms])
    return {"rooms": rooms, "plan_width_m": round(plan_width, 2), "method": "gemini",
            "notes": ["Rooms read from your plan by Gemini vision — check them before generating."]}


# ═══════════════════════════════════════════════════ validation (input) ══════
class PlanError(ValueError):
    pass


def clean_plan(rooms: list[dict[str, Any]], plan_width_m: float, image_w: int, image_h: int,
               plan_depth_m: Optional[float] = None) -> dict[str, Any]:
    """Validate a customer-confirmed plan; raise PlanError with a readable reason."""
    if not image_w or not image_h:
        raise PlanError("Upload the floor plan image first.")
    if not (2.0 <= float(plan_width_m) <= 80.0):
        raise PlanError("Plan width must be between 2 m and 80 m.")
    if not rooms:
        raise PlanError("Mark at least one room on the plan.")
    if len(rooms) > 30:
        raise PlanError("A plan can have at most 30 rooms.")
    out = []
    plan_h = plan_width_m * image_h / image_w
    if plan_depth_m is not None:
        # A stretched image: its height is at a different scale from its width.
        if not (0.4 <= float(plan_depth_m) / plan_h <= 2.5):
            raise PlanError("Plan depth doesn't fit the image — reset the scale and try again.")
        plan_h = float(plan_depth_m)
    for i, r in enumerate(rooms):
        rtype = r.get("room_type")
        if rtype not in ROOM_TYPES:
            raise PlanError(f"Unknown room type '{rtype}'.")
        try:
            x0, y0, x1, y1 = (float(v) for v in r.get("box", []))
        except (TypeError, ValueError):
            raise PlanError("Every room needs a box of four numbers.")
        x0, x1 = sorted((min(max(x0, 0.0), 1.0), min(max(x1, 0.0), 1.0)))
        y0, y1 = sorted((min(max(y0, 0.0), 1.0), min(max(y1, 0.0), 1.0)))
        label = str(r.get("label") or ROOM_TYPES[rtype]["label"]).strip()[:40]
        if (x1 - x0) * plan_width_m < 0.6 or (y1 - y0) * plan_h < 0.6:
            raise PlanError(f"'{label}' is smaller than 0.6 m on one side — resize or remove it.")
        out.append({"id": str(r.get("id") or f"r{i + 1}")[:16], "label": label, "room_type": rtype,
                    "box": [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)]})
    cleaned = {"rooms": out, "plan_width_m": round(float(plan_width_m), 3),
               "image_w": int(image_w), "image_h": int(image_h)}
    if plan_depth_m is not None:
        cleaned["plan_depth_m"] = round(plan_h, 3)
    return cleaned


def plan_bhk(rooms: list[dict[str, Any]]) -> str:
    n = sum(1 for r in rooms if r.get("room_type") in BEDROOM_TYPES)
    return f"{min(max(n, 1), 5)} BHK"


# ═════════════════════════════════════════════════════ scene generation ═════
@dataclass
class _Space:
    sid: str
    label: str
    room_type: str
    kind: str        # room | circulation | balcony
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def d(self) -> float:
        return self.y1 - self.y0

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    def contains(self, x: float, y: float) -> bool:
        return self.x0 - 1e-6 <= x <= self.x1 + 1e-6 and self.y0 - 1e-6 <= y <= self.y1 + 1e-6


OPEN_PAIRS = [{"living_room", "dining_area"}]
HUB = ["living_room", "dining_area", "passage", "family_lounge"]
DOOR_PREFS = {
    "bathroom": HUB + ["master_bedroom", "bedroom", "study", "kitchen"],
    "kitchen": ["dining_area", "living_room", "passage", "family_lounge"],
}
WINDOW_SPEC = {"bathroom": (0.6, 1.5, 0.8), "kitchen": (1.15, 1.25, 1.1)}  # width, sill, height
FEATURE_WALL_TYPES = {"living_room", "master_bedroom", "bedroom", "family_lounge"}
RESIZABLE = {"counter_run", "wall_cabinets", "wardrobe", "bookshelf", "sideboard",
             "media_console", "vanity", "shower", "dresser", "island", "console_table"}
_VARIANT_CACHE: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
_BAKED: dict[str, Any] = {"html_id": None, "variants": None, "catalog": None}


def _baked() -> tuple[dict[str, Any], dict[str, Any]]:
    """The viewer's baked variants and catalogue, parsed once per viewer file."""
    shell = _viewer_shell()
    if shell is None:
        raise RuntimeError("Interactive viewer build not found")
    if _BAKED["html_id"] != id(shell):
        variants = catalog = None
        for line in shell.splitlines():
            if line.startswith("window.__VARIANTS__ = "):
                variants = json.loads(line[len("window.__VARIANTS__ = "):].rstrip().rstrip(";"))
            elif line.startswith("window.__CATALOG__ = "):
                catalog = json.loads(line[len("window.__CATALOG__ = "):].rstrip().rstrip(";"))
            if variants is not None and catalog is not None:
                break
        if not variants or not catalog:
            raise RuntimeError("Viewer build carries no baked variants")
        _BAKED.update(html_id=id(shell), variants=variants, catalog=catalog)
    return _BAKED["variants"], _BAKED["catalog"]


def viewer_tier(brief: dict[str, Any]) -> str:
    """Mirror of the viewer's resolveTier(), so the server picks the same tier."""
    _, catalog = _baked()
    budgets, qualities = catalog["budgets"], catalog["qualities"]
    b = budgets.index(brief["budget"]) / (len(budgets) - 1) if brief.get("budget") in budgets else 0.5
    q = qualities.index(brief["quality"]) / 2 if brief.get("quality") in qualities else 0.5
    score = 0.45 * b + 0.55 * q
    return "Budget" if score < 0.33 else "Standard" if score < 0.68 else "Premium"


def build_plan_variant(plan: dict[str, Any], brief: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Confirmed plan -> {scene, svg, bhk, summary}. Cached per geometry + tier."""
    brief = brief or {}
    tier = viewer_tier(brief)
    key_src = json.dumps({"rooms": plan["rooms"], "w": plan["plan_width_m"], "gaps": plan.get("door_gaps") or [],
                          "d": plan.get("plan_depth_m"),
                          "iw": plan["image_w"], "ih": plan["image_h"], "tier": tier,
                          "v": 3}, sort_keys=True)
    key = hashlib.sha1(key_src.encode()).hexdigest()
    if key in _VARIANT_CACHE:
        _VARIANT_CACHE.move_to_end(key)
        return copy.deepcopy(_VARIANT_CACHE[key])
    variant = _build(plan, tier, brief)
    _VARIANT_CACHE[key] = variant
    while len(_VARIANT_CACHE) > 24:
        _VARIANT_CACHE.popitem(last=False)
    return copy.deepcopy(variant)


def _build(plan: dict[str, Any], tier: str, brief: dict[str, Any]) -> dict[str, Any]:
    variants, catalog = _baked()
    spaces, to_metres = _spaces_from_plan(plan)
    rooms = [s for s in spaces if s.kind == "room"]
    bhk = plan_bhk([{"room_type": s.room_type} for s in rooms])
    template = variants.get(f"{bhk}|{tier}") or next(
        (v for k, v in variants.items() if k.endswith(f"|{tier}")), next(iter(variants.values())))
    tscene = template["scene"]

    walls, adjacency, exterior = _walls(spaces)
    openings, entrance = _openings(spaces, adjacency, exterior, walls, _hints_in_metres(plan, to_metres))

    room_meta = {r["room_type"]: r for r in tscene["rooms"]}
    fallback_meta = tscene["rooms"][0]
    scene_rooms, objects, dropped = [], [], []
    alternates: dict[str, list] = {}
    pools = _template_pools(variants, bhk, tier)
    used: dict[str, int] = {}
    for s in rooms:
        meta = room_meta.get(s.room_type) or room_meta.get(_meta_alias(s.room_type)) or fallback_meta
        ceiling = float(meta.get("ceiling_m", 2.9))
        room_layouts, lost = _furnish(s, pools, used, openings)
        dropped.extend(lost)
        # The winning arrangement is the scene. The alternates ride alongside
        # so the viewer can offer them, without changing what anything else
        # sees in scene["objects"].
        room_objects = room_layouts[0]["objects"] if room_layouts else []
        objects.extend(room_objects)
        if len(room_layouts) > 1:
            alternates[s.sid] = [
                {"name": lay["name"],
                 "objects": [copy.deepcopy(o) for o in lay["objects"]]}
                for lay in room_layouts
            ]
        scene_rooms.append({
            "room_id": s.sid, "label": s.label, "room_type": s.room_type,
            "rect": [round(s.x0, 3), round(s.y0, 3), round(s.w, 3), round(s.d, 3)],
            "ceiling_m": ceiling, "area_m2": round(s.w * s.d, 2),
            "floor_hex": meta.get("floor_hex"), "floor_label": meta.get("floor_label"),
            "wall_hex": meta.get("wall_hex"), "feature_wall_hex": meta.get("feature_wall_hex"),
            "feature_wall": _feature_wall(s, openings) if s.room_type in FEATURE_WALL_TYPES else None,
            "light": {**(meta.get("light") or {"intensity": 1.0, "colour": "#FFF1DE"}),
                      "height": round(ceiling - 0.28, 2)},
            "object_ids": [o["object_id"] for o in room_objects],
        })

    balconies = [s for s in spaces if s.kind == "balcony"]
    circulation = [[round(s.x0, 3), round(s.y0, 3), round(s.w, 3), round(s.d, 3)]
                   for s in spaces if s.kind == "circulation"]
    circulation += [[round(b.x0, 3), round(b.y0, 3), round(b.w, 3), round(b.d, 3)] for b in balconies[1:]]
    width = max(s.x1 for s in spaces)
    depth = max(s.y1 for s in spaces)
    area = sum(s.w * s.d for s in spaces if s.kind != "balcony")

    design = dict(tscene.get("design") or {})
    for field_name, brief_key in (("style", "style"), ("wood", "wood"), ("fabric", "fabric"),
                                  ("city", "city"), ("budget", "budget"), ("property_name", "property")):
        if brief.get(brief_key):
            design[field_name] = brief[brief_key]
    design["tier"] = tier
    design["source"] = "customer floor plan"

    scene = {
        "home_id": f"PLAN_{hashlib.sha1(json.dumps(plan['rooms'], sort_keys=True).encode()).hexdigest()[:8]}",
        "bhk": bhk, "units": "metres",
        "bounds": {"width": round(width, 3), "depth": round(depth, 3), "area_m2": round(area, 2)},
        "design": design,
        "cutaway_height_m": tscene.get("cutaway_height_m", 1.45),
        "circulation": circulation,
        "balcony": ([round(balconies[0].x0, 3), round(balconies[0].y0, 3),
                     round(balconies[0].w, 3), round(balconies[0].d, 3)] if balconies else None),
        "entrance": entrance,
        "rooms": scene_rooms, "walls": walls, "openings": openings, "objects": objects,
        # {room_id: [{name, objects}, ...]} — the first entry is what is already
        # in "objects" above; the rest are the other ways this room could be laid
        # out. Only the 3D viewer reads this.
        "layouts": alternates,
    }
    svg = _plan_svg(scene, spaces, brief, tier, catalog)
    summary = {
        "bhk": bhk, "tier": tier, "rooms": len(scene_rooms), "objects": len(objects),
        "area_m2": round(area, 1), "area_sqft": round(area * 10.764),
        "width_m": round(width, 2), "depth_m": round(depth, 2),
        "doors": sum(1 for o in openings if o["kind"] in ("door", "balcony_door", "entrance")),
        "windows": sum(1 for o in openings if o["kind"] == "window"),
        "skipped_items": dropped,
    }
    return {"scene": scene, "svg": svg, "bhk": bhk, "summary": summary}


def _meta_alias(room_type: str) -> str:
    return {"family_lounge": "living_room", "study": "bedroom", "pooja_room": "bedroom",
            "dining_area": "living_room"}.get(room_type, room_type)


def _spaces_from_plan(plan: dict[str, Any]):
    """Rooms in metres, plus a function mapping image fractions to the same frame."""
    W = float(plan["plan_width_m"])
    Hm = float(plan.get("plan_depth_m") or W * plan["image_h"] / plan["image_w"])
    rects, meta = [], []
    for r in plan["rooms"]:
        x0, y0, x1, y1 = r["box"]
        rects.append((x0 * W, (1 - y1) * Hm, x1 * W, (1 - y0) * Hm))
        meta.append(r)
    # Merge edges that are meant to be one wall, then grid-snap to 5 cm.
    xm = _cluster_map([v for rc in rects for v in (rc[0], rc[2])], 0.25)
    ym = _cluster_map([v for rc in rects for v in (rc[1], rc[3])], 0.25)
    snap = lambda v: round(v / 0.05) * 0.05  # noqa: E731
    rects = [(snap(xm[rc[0]]), snap(ym[rc[1]]), snap(xm[rc[2]]), snap(ym[rc[3]])) for rc in rects]
    resolved = _resolve_overlaps_aligned(rects)

    spaces: list[_Space] = []
    ids: dict[str, int] = {}
    for i, rc in enumerate(resolved):
        if rc is None:
            continue
        x0, y0, x1, y1 = (round(v, 3) for v in rc)
        if x1 - x0 < 0.6 or y1 - y0 < 0.6:
            continue
        r = meta[i]
        t = r["room_type"]
        kind = "balcony" if t == "balcony" else "circulation" if t == "passage" else "room"
        base = {"bathroom": "bathroom", "bedroom": "bedroom"}.get(t, t)
        ids[base] = ids.get(base, 0) + 1
        sid = f"{base}_{ids[base]}" if base in ("bathroom", "bedroom", "balcony", "passage") or ids[base] > 1 else base
        spaces.append(_Space(sid, r["label"], t, kind, x0, y0, x1, y1))
    if not spaces:
        raise PlanError("None of the rooms are large enough to build.")
    spaces.extend(_fill_holes(spaces))
    minx, miny = min(s.x0 for s in spaces), min(s.y0 for s in spaces)
    for s in spaces:
        s.x0, s.x1 = round(s.x0 - minx, 3), round(s.x1 - minx, 3)
        s.y0, s.y1 = round(s.y0 - miny, 3), round(s.y1 - miny, 3)

    def to_metres(xn: float, yn: float) -> tuple[float, float]:
        return xn * W - minx, (1 - yn) * Hm - miny
    return spaces, to_metres


def _hints_in_metres(plan: dict[str, Any], to_metres) -> list[dict[str, Any]]:
    out = []
    for i, g in enumerate(plan.get("door_gaps") or []):
        try:
            if g["axis"] == "x":
                (xa, y), (xb, _) = to_metres(g["a"], g["pos"]), to_metres(g["b"], g["pos"])
                out.append({"id": i, "axis": "x", "fixed": y, "lo": min(xa, xb), "hi": max(xa, xb),
                            "kind": g.get("kind", "door")})
            elif g["axis"] == "y":
                (x, ya), (_, yb) = to_metres(g["pos"], g["a"]), to_metres(g["pos"], g["b"])
                out.append({"id": i, "axis": "y", "fixed": x, "lo": min(ya, yb), "hi": max(ya, yb),
                            "kind": g.get("kind", "door")})
        except (KeyError, TypeError):
            continue
    return out


def _fill_holes(spaces: list[_Space]) -> list[_Space]:
    """Unmarked floor fully enclosed by rooms (a lobby, a corridor stub) becomes
    passage, so the model has a continuous floor and no doubled walls."""
    xs = sorted({round(v, 3) for s in spaces for v in (s.x0, s.x1)})
    ys = sorted({round(v, 3) for s in spaces for v in (s.y0, s.y1)})
    nx, ny = len(xs) - 1, len(ys) - 1
    if nx < 1 or ny < 1:
        return []
    covered = np.zeros((ny, nx), bool)
    for j in range(ny):
        for i in range(nx):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            covered[j, i] = any(s.contains(cx, cy) for s in spaces)
    lab, n = ndi.label(~covered)
    holes: list[_Space] = []
    for k in range(1, n + 1):
        cells = lab == k
        rows, cols = np.nonzero(cells)
        if rows.min() == 0 or cols.min() == 0 or rows.max() == ny - 1 or cols.max() == nx - 1:
            continue                      # open to the outside: a notch, not a hole
        remaining = cells.copy()
        while remaining.any():
            j, i = map(int, np.argwhere(remaining)[0])
            i1 = i
            while i1 + 1 < nx and remaining[j, i1 + 1]:
                i1 += 1
            j1 = j
            while j1 + 1 < ny and remaining[j1 + 1, i:i1 + 1].all():
                j1 += 1
            remaining[j:j1 + 1, i:i1 + 1] = False
            x0, x1, y0, y1 = xs[i], xs[i1 + 1], ys[j], ys[j1 + 1]
            if (x1 - x0) * (y1 - y0) >= 0.3 and min(x1 - x0, y1 - y0) >= 0.5:
                holes.append(_Space(f"passage_auto_{len(holes) + 1}", "Passage", "passage", "circulation",
                                    x0, y0, x1, y1))
    return holes


# ── walls ────────────────────────────────────────────────────────────────────
def _wall_kind(a: Optional[_Space], b: Optional[_Space]) -> Optional[str]:
    if a is None and b is None:
        return None
    if a is None or b is None:
        s = a or b
        return "parapet" if s.kind == "balcony" else "exterior"
    if a is b:
        return None
    if a.kind == "circulation" and b.kind == "circulation":
        return None
    if a.kind == "balcony" and b.kind == "balcony":
        return None
    if {a.room_type, b.room_type} in OPEN_PAIRS:
        return None
    if a.kind == "balcony" or b.kind == "balcony":
        return "exterior"
    return "partition"


def _walls(spaces: list[_Space]):
    """Split every edge at every breakpoint, classify each piece by what lies on
    either side, and merge runs of the same kind into walls."""
    segments = []  # (axis, fixed, a, b, kind, lo_side, hi_side)
    for axis in ("x", "y"):
        lines: dict[float, set[float]] = {}
        for s in spaces:
            if axis == "x":
                for fixed in (s.y0, s.y1):
                    lines.setdefault(round(fixed, 3), set()).update((s.x0, s.x1))
            else:
                for fixed in (s.x0, s.x1):
                    lines.setdefault(round(fixed, 3), set()).update((s.y0, s.y1))
        for fixed, pts in lines.items():
            # Breakpoints must include every edge that lies on this line.
            for s in spaces:
                on = (axis == "x" and fixed in (round(s.y0, 3), round(s.y1, 3))) or \
                     (axis == "y" and fixed in (round(s.x0, 3), round(s.x1, 3)))
                if on:
                    pts.update((s.x0, s.x1) if axis == "x" else (s.y0, s.y1))
            ordered = sorted(pts)
            for a, b in zip(ordered, ordered[1:]):
                if b - a < 0.02:
                    continue
                mid = (a + b) / 2
                if axis == "x":
                    lo = next((s for s in spaces if s.contains(mid, fixed - 0.01) and s.y0 < fixed - 0.005), None)
                    hi = next((s for s in spaces if s.contains(mid, fixed + 0.01) and s.y1 > fixed + 0.005), None)
                    on_edge = any(abs(s.y0 - fixed) < 1e-3 or abs(s.y1 - fixed) < 1e-3 for s in (lo, hi) if s)
                else:
                    lo = next((s for s in spaces if s.contains(fixed - 0.01, mid) and s.x0 < fixed - 0.005), None)
                    hi = next((s for s in spaces if s.contains(fixed + 0.01, mid) and s.x1 > fixed + 0.005), None)
                    on_edge = any(abs(s.x0 - fixed) < 1e-3 or abs(s.x1 - fixed) < 1e-3 for s in (lo, hi) if s)
                if not on_edge:
                    continue
                segments.append((axis, fixed, a, b, _wall_kind(lo, hi), lo, hi))

    walls, adjacency, exterior = [], {}, {}
    for axis, fixed, a, b, kind, lo, hi in segments:
        if lo and hi and lo is not hi:
            key = (min(lo.sid, hi.sid), max(lo.sid, hi.sid))
            adjacency.setdefault(key, []).append((axis, fixed, a, b))
        elif (lo is None) != (hi is None):
            s = lo or hi
            exterior.setdefault(s.sid, []).append((axis, fixed, a, b, 1 if hi is s else -1))

    runs: dict[tuple, list] = {}
    for axis, fixed, a, b, kind, lo, hi in segments:
        if kind is None:
            continue
        runs.setdefault((axis, fixed, kind), []).append((a, b, lo, hi))
    for (axis, fixed, kind), pieces in runs.items():
        pieces.sort(key=lambda p: p[0])
        merged: list[list] = []
        for a, b, lo, hi in pieces:
            if merged and abs(merged[-1][1] - a) < 1e-3:
                merged[-1][1] = b
                merged[-1][2].extend(x for x in (lo, hi) if x)
            else:
                merged.append([a, b, [x for x in (lo, hi) if x]])
        for a, b, sides in merged:
            thickness = 0.23 if kind == "exterior" else 0.115
            height = 1.05 if kind == "parapet" else 2.9
            p0, p1 = ([a, fixed], [b, fixed]) if axis == "x" else ([fixed, a], [fixed, b])
            room = next((s.sid for s in sides if s.kind == "room"), None)
            walls.append({
                "wall_id": f"w_{p0[0]:.3f}_{p0[1]:.3f}__{p1[0]:.3f}_{p1[1]:.3f}",
                "room_id": room if kind == "partition" else None,
                "p0": [round(p0[0], 3), round(p0[1], 3)], "p1": [round(p1[0], 3), round(p1[1], 3)],
                "thickness": thickness, "height": height, "kind": kind,
            })
    return walls, _merge_intervals(adjacency), _merge_exterior(exterior)


def _merge_intervals(adjacency):
    out = {}
    for key, parts in adjacency.items():
        groups: dict[tuple, list] = {}
        for axis, fixed, a, b in parts:
            groups.setdefault((axis, fixed), []).append([a, b])
        merged = []
        for (axis, fixed), ivs in groups.items():
            ivs.sort()
            cur = None
            for a, b in ivs:
                if cur and abs(cur[1] - a) < 1e-3:
                    cur[1] = b
                else:
                    if cur:
                        merged.append((axis, fixed, cur[0], cur[1]))
                    cur = [a, b]
            if cur:
                merged.append((axis, fixed, cur[0], cur[1]))
        out[key] = merged
    return out


def _merge_exterior(exterior):
    out = {}
    for sid, parts in exterior.items():
        groups: dict[tuple, list] = {}
        for axis, fixed, a, b, sign in parts:
            groups.setdefault((axis, fixed, sign), []).append([a, b])
        merged = []
        for (axis, fixed, sign), ivs in groups.items():
            ivs.sort()
            cur = None
            for a, b in ivs:
                if cur and abs(cur[1] - a) < 1e-3:
                    cur[1] = b
                else:
                    if cur:
                        merged.append((axis, fixed, cur[0], cur[1], sign))
                    cur = [a, b]
            if cur:
                merged.append((axis, fixed, cur[0], cur[1], sign))
        out[sid] = sorted(merged, key=lambda m: -(m[3] - m[2]))
    return out


# ── doors, windows, entrance ─────────────────────────────────────────────────
def _openings(spaces, adjacency, exterior, walls, hints=()):
    by_id = {s.sid: s for s in spaces}
    openings: list[dict[str, Any]] = []
    taken: dict[tuple, list[tuple[float, float]]] = {}
    used_hints: set[int] = set()

    def hint_on(axis, fixed, lo, hi, kind="door"):
        """The plan's own door/window gap lying on this stretch of wall, if any."""
        best = None
        for h in hints:
            if h["id"] in used_hints or h["kind"] != kind or h["axis"] != axis or abs(h["fixed"] - fixed) > 0.35:
                continue
            overlap = min(hi, h["hi"]) - max(lo, h["lo"])
            if overlap >= 0.5 * (h["hi"] - h["lo"]) and (best is None or overlap > best[1]):
                best = (h, overlap)
        return best[0] if best else None

    def slot_at_hint(h, axis, fixed, lo, hi, min_w, max_w):
        width = min(max(h["hi"] - h["lo"], min_w), max_w, (hi - lo) - 0.1)
        if width < min_w * 0.8:
            return None
        start = min(max(h["lo"] + ((h["hi"] - h["lo"]) - width) / 2, lo + 0.05), hi - width - 0.05)
        end = start + width
        if all(end + 0.05 <= a or start - 0.05 >= b for a, b in taken.get((axis, round(fixed, 3)), [])):
            used_hints.add(h["id"])
            return start, width
        return None

    def free_slot(axis, fixed, lo, hi, width, prefer="start", margin=0.15):
        usable_lo, usable_hi = lo + margin, hi - margin
        if usable_hi - usable_lo < width:
            return None
        cands = {"start": [usable_lo, usable_hi - width, (lo + hi - width) / 2],
                 "centre": [(lo + hi - width) / 2, usable_lo, usable_hi - width]}[prefer]
        for start in cands:
            end = start + width
            if all(end + 0.1 <= a or start - 0.1 >= b for a, b in taken.get((axis, round(fixed, 3)), [])):
                return start
        return None

    def add(oid, room_id, axis, fixed, start, width, kind, height, sill, into, hinge="start"):
        end = start + width
        if axis == "x":
            p0, p1, swing = [start, fixed], [end, fixed], [0.0, float(into)]
        else:
            p0, p1, swing = [fixed, start], [fixed, end], [float(into), 0.0]
        taken.setdefault((axis, round(fixed, 3)), []).append((start, end))
        openings.append({
            "opening_id": oid, "room_id": room_id,
            "wall_id": f"w_{p0[0]:.3f}_{p0[1]:.3f}__{p1[0]:.3f}_{p1[1]:.3f}", "kind": kind,
            "p0": [round(p0[0], 3), round(p0[1], 3)], "p1": [round(p1[0], 3), round(p1[1], 3)],
            "width": round(width, 3), "height": height, "sill": sill,
            "swing_into": swing, "hinge": hinge,
        })

    def into_sign(space, axis, fixed):
        centre = space.cy if axis == "x" else space.cx
        return 1 if centre > fixed else -1

    def neighbours(space):
        out = []
        for (a, b), ivs in adjacency.items():
            if space.sid in (a, b):
                other = by_id[b if a == space.sid else a]
                out.extend((other, iv) for iv in ivs)
        return out

    def is_open(a, b):
        return {a.room_type, b.room_type} in OPEN_PAIRS or (a.kind == b.kind == "circulation")

    # Doors: every enclosed room opens onto its most sensible neighbour.
    door_order = ["master_bedroom", "bedroom", "study", "pooja_room", "kitchen", "bathroom",
                  "family_lounge", "dining_area"]
    rooms = sorted((s for s in spaces if s.kind == "room" and s.room_type != "living_room"),
                   key=lambda s: door_order.index(s.room_type) if s.room_type in door_order else 99)
    for s in rooms:
        nbrs = [(o, iv) for o, iv in neighbours(s) if o.kind != "balcony"]
        if any(is_open(s, o) for o, _ in nbrs):
            continue
        prefs = DOOR_PREFS.get(s.room_type, HUB + ["study", "master_bedroom", "bedroom"])
        width = 0.76 if s.room_type == "bathroom" else 1.0 if s.room_type == "kitchen" else 0.9
        height = 2.0 if s.room_type == "bathroom" else 2.1

        def rank(item):
            o, iv = item
            key = o.room_type if o.kind != "circulation" else "passage"
            has_gap = hint_on(iv[0], iv[1], iv[2], iv[3]) is not None
            return (0 if has_gap else 1, prefs.index(key) if key in prefs else len(prefs), -(iv[3] - iv[2]))

        ordered = sorted(nbrs, key=rank)
        done = False
        for o, (axis, fixed, lo, hi) in ordered:
            h = hint_on(axis, fixed, lo, hi)
            placed = slot_at_hint(h, axis, fixed, lo, hi, 0.7, 1.4 if s.room_type == "kitchen" else 1.1) if h else None
            if placed:
                start, w = placed
            else:
                start, w = free_slot(axis, fixed, lo, hi, width), width
            if start is not None:
                add(f"{s.sid}_door_0", s.sid, axis, fixed, start, w, "door", height, 0.0,
                    into_sign(s, axis, fixed))
                done = True
                break
        if not done:
            # A small room (a 1 m WC) shares only short walls: fit a narrower
            # door with tighter jambs rather than leave it without a way in.
            for o, (axis, fixed, lo, hi) in ordered:
                w = min(width, (hi - lo) - 0.12)
                start = free_slot(axis, fixed, lo, hi, w, margin=0.06) if w >= 0.6 else None
                if start is not None:
                    add(f"{s.sid}_door_0", s.sid, axis, fixed, start, round(w, 3), "door", height, 0.0,
                        into_sign(s, axis, fixed))
                    break

    # Balcony doors.
    for b in (s for s in spaces if s.kind == "balcony"):
        cands = [(o, iv) for o, iv in neighbours(b) if o.kind == "room" and o.room_type != "bathroom"]
        cands.sort(key=lambda item: (0 if item[0].room_type in ("living_room", "dining_area") else 1,
                                     -(item[1][3] - item[1][2])))
        for o, (axis, fixed, lo, hi) in cands:
            h = hint_on(axis, fixed, lo, hi)
            placed = slot_at_hint(h, axis, fixed, lo, hi, 0.9, 2.4) if h else None
            if placed:
                add(f"{o.sid}_balcony_door", o.sid, axis, fixed, placed[0], placed[1], "balcony_door", 2.1, 0.0,
                    into_sign(o, axis, fixed), hinge="end")
                break
            width = min(1.8, (hi - lo) - 0.4)
            if width < 0.9:
                continue
            start = free_slot(axis, fixed, lo, hi, width, prefer="centre")
            if start is not None:
                add(f"{o.sid}_balcony_door", o.sid, axis, fixed, start, width, "balcony_door", 2.1, 0.0,
                    into_sign(o, axis, fixed), hinge="end")
                break

    # Main entrance on the longest outside wall of a shared space.
    entrance = None
    hubs = [s for s in spaces if s.room_type in ("living_room", "dining_area", "passage", "family_lounge")]
    # Prefer an outside wall where the plan itself shows a door gap.
    hub_edges = sorted(((s, e) for s in hubs for e in exterior.get(s.sid, [])),
                       key=lambda item: (0 if hint_on(item[1][0], item[1][1], item[1][2], item[1][3]) else 1,
                                         0 if item[0].room_type == "living_room" else 1,
                                         -(item[1][3] - item[1][2])))
    for s, (axis, fixed, lo, hi, sign) in hub_edges:
        h = hint_on(axis, fixed, lo, hi)
        placed = slot_at_hint(h, axis, fixed, lo, hi, 0.8, 1.3) if h else None
        start, width = placed if placed else (free_slot(axis, fixed, lo, hi, 1.0, prefer="centre"), 1.0)
        if start is None:
            continue
        into = into_sign(s, axis, fixed)
        add("main_entrance", None, axis, fixed, start, width, "entrance", 2.1, 0.0, into)
        side = ({1: "south", -1: "north"} if axis == "x" else {1: "west", -1: "east"})[into]
        centre = [start + width / 2, fixed] if axis == "x" else [fixed, start + width / 2]
        entrance = {"wall": side, "center": [round(centre[0], 3), round(centre[1], 3)],
                    "width": round(width, 3), "height": 2.1}
        break

    # Windows on outside walls.
    for s in spaces:
        if s.kind != "room":
            continue
        spec_w, sill, height = WINDOW_SPEC.get(s.room_type, (1.5, 0.9, 1.4))
        edges = sorted(exterior.get(s.sid, []),
                       key=lambda e: 0 if hint_on(e[0], e[1], e[2], e[3], "window") else 1)
        for axis, fixed, lo, hi, sign in edges:
            h = hint_on(axis, fixed, lo, hi, "window")
            placed = slot_at_hint(h, axis, fixed, lo, hi, 0.5, 2.4) if h else None
            if placed:
                add(f"{s.sid}_window_1", s.sid, axis, fixed, placed[0], round(placed[1], 3), "window", height, sill,
                    into_sign(s, axis, fixed), hinge="end")
                break
            width = min(spec_w, (hi - lo) - 0.5)
            if width < 0.5:
                continue
            start = free_slot(axis, fixed, lo, hi, width, prefer="centre")
            if start is not None:
                add(f"{s.sid}_window_1", s.sid, axis, fixed, start, round(width, 3), "window", height, sill,
                    into_sign(s, axis, fixed), hinge="end")
                break
    return openings, entrance


def _feature_wall(s: _Space, openings) -> Optional[str]:
    def blocked(y):
        return any(abs(o["p0"][1] - y) < 0.02 and abs(o["p1"][1] - y) < 0.02
                   and min(o["p0"][0], o["p1"][0]) < s.x1 and max(o["p0"][0], o["p1"][0]) > s.x0
                   for o in openings)
    if s.w < 1.8:
        return None
    if not blocked(s.y1):
        return "north"
    if not blocked(s.y0):
        return "south"
    return None


# ── furniture ────────────────────────────────────────────────────────────────
def _template_pools(variants, bhk, tier):
    """room_type -> [objects of one template room], nearest variants first."""
    order = [f"{bhk}|{tier}"] + [k for k in variants if k.endswith(f"|{tier}") and k != f"{bhk}|{tier}"] \
        + [k for k in variants if not k.endswith(f"|{tier}")]
    pools: dict[str, list[list[dict]]] = {}
    for key in order:
        v = variants.get(key)
        if not v:
            continue
        sc = v["scene"]
        for room in sc["rooms"]:
            objs = [o for o in sc["objects"] if o["room_id"] == room["room_id"]]
            if objs:
                pools.setdefault(room["room_type"], []).append({"rect": room["rect"], "objects": objs})
    return pools


_FACING = {0.0: (0.0, 1.0), 90.0: (1.0, 0.0), 180.0: (0.0, -1.0), 270.0: (-1.0, 0.0)}


def _stray_of_a_pair(kept: list[dict[str, Any]]):
    """A flanking pair (two nightstands) that the room could not seat properly.

    Returns the one to drop: the partner sits either side of the bed, level with
    the headboard, or it does not belong in the room at all.
    """
    from ids.solver import rule_for

    by_cat: dict[str, list[dict[str, Any]]] = {}
    for o in kept:
        by_cat.setdefault(o["category"], []).append(o)
    for cat, items in by_cat.items():
        rule = rule_for(cat)
        if not rule.flanks or len(items) != 2:
            continue
        for anchor_cat in rule.against:
            anchors = by_cat.get(anchor_cat) or []
            if not anchors:
                continue
            anchor = anchors[0]
            fx, fy = _FACING.get(float(anchor["rotation"]["yaw"]) % 360, (0.0, 1.0))
            lx, ly = -fy, fx
            placed = []
            for item in items:
                dx = item["position"]["x"] - anchor["position"]["x"]
                dy = item["position"]["z"] - anchor["position"]["z"]
                placed.append((dx * lx + dy * ly, abs(dx * fx + dy * fy), item))
            (side_a, along_a, first), (side_b, along_b, second) = placed
            level = (anchor["dimensions"]["depth"] + 0.6) / 2
            same_side = side_a * side_b >= 0
            if same_side or max(along_a, along_b) > level:
                return second if along_b >= along_a else first
    return None


# Pieces a room can do without when the point is clear floor, and the ones
# worth keeping when the point is somewhere to put things. Varying these is
# what makes one layout genuinely different from another rather than the same
# furniture nudged a few centimetres.
_LOOSE = ("planter", "floor_lamp", "armchair", "bench", "side_table", "console_table")
_SEATING = ("armchair", "bench", "side_table")

# name, solver seed, categories this arrangement leaves out
LAYOUT_STRATEGIES: tuple[tuple[str, int, tuple[str, ...]], ...] = (
    ("Balanced", 7, ()),
    ("Open", 23, _LOOSE),
    ("Storage", 41, _SEATING),
)


def _openings_for(space: _Space, openings) -> list:
    """The doors and windows that sit on this room's own walls."""
    from ids.scene import Opening as SOpening

    out = []
    for op in openings:
        (ax0, ay0), (ax1, ay1) = op["p0"], op["p1"]
        horizontal = abs(ay0 - ay1) < 1e-4
        if horizontal:
            if abs(ay0 - space.y0) > 0.02 and abs(ay0 - space.y1) > 0.02:
                continue
            if max(ax0, ax1) <= space.x0 or min(ax0, ax1) >= space.x1:
                continue
            inside_up = space.cy > ay0
            p0, p1 = (((min(ax0, ax1), ay0), (max(ax0, ax1), ay0)) if inside_up
                      else ((max(ax0, ax1), ay0), (min(ax0, ax1), ay0)))
        else:
            if abs(ax0 - space.x0) > 0.02 and abs(ax0 - space.x1) > 0.02:
                continue
            if max(ay0, ay1) <= space.y0 or min(ay0, ay1) >= space.y1:
                continue
            inside_left = space.cx < ax0
            p0, p1 = (((ax0, min(ay0, ay1)), (ax0, max(ay0, ay1))) if inside_left
                      else ((ax0, max(ay0, ay1)), (ax0, min(ay0, ay1))))
        if op["kind"] == "balcony_door":
            # A sliding balcony door needs a walkway, not a 1.8 m swing arc.
            (px0, py0), (px1, py1) = p0, p1
            mx, my = (px0 + px1) / 2, (py0 + py1) / 2
            ux, uy = (px1 - px0) / (op["width"] or 1), (py1 - py0) / (op["width"] or 1)
            p0, p1 = (mx - ux * 0.45, my - uy * 0.45), (mx + ux * 0.45, my + uy * 0.45)
        out.append(SOpening(op["opening_id"], space.sid, p0, p1,
                            op["kind"] in ("door", "balcony_door", "entrance")))
    return out


def _room_candidates(space: _Space, pools, used):
    """Everything this room could hold, sized to fit, plus its must-haves."""
    rtype = {"family_lounge": "family_lounge",
             "pooja_room": "pooja_room"}.get(space.room_type, space.room_type)
    pool = pools.get(rtype) or pools.get(_meta_alias(rtype)) or []
    if not pool:
        return [], [], ()
    idx = used.get(rtype, 0)
    used[rtype] = idx + 1
    template = pool[idx % len(pool)]

    inner_w, inner_d = space.w - 0.14, space.d - 0.14
    long_side, short_side = max(inner_w, inner_d), min(inner_w, inner_d)
    candidates, dropped = [], []
    for o in template["objects"]:
        o = copy.deepcopy(o)
        dims = o["dimensions"]
        if o["category"] in RESIZABLE and dims["width"] > long_side:
            dims["width"] = round(max(0.6, long_side - 0.05), 3)
        if dims["depth"] > short_side or dims["width"] > long_side:
            dropped.append(f"{space.label}: {o['label']}")
            continue
        candidates.append(o)

    # A bedroom needs a bed AND a wardrobe; a bathroom needs its pan and basin.
    # All of them, not just the first: the old code read [0] and let everything
    # after it compete for floor area, which is why bedrooms had no almirah.
    must_haves = tuple(_ESSENTIAL.get(space.room_type) or ())
    for wanted in must_haves:
        if any(o["category"] == wanted for o in candidates):
            continue
        spare = _example_object(wanted)
        if spare is None:
            continue
        spare = copy.deepcopy(spare)
        dims = spare["dimensions"]
        fit = min(long_side / max(dims["width"], 1e-6),
                  short_side / max(dims["depth"], 1e-6), 1.0)
        if fit < 1.0:
            dims["width"] = round(dims["width"] * fit, 3)
            dims["depth"] = round(dims["depth"] * fit, 3)
        candidates.append(spare)
    return candidates, dropped, must_haves


def _select(space: _Space, candidates, must_haves, omit: tuple[str, ...]):
    """Which of the candidates this arrangement tries to fit, and what it leaves."""
    from ids.solver import rule_for

    wanted = [o for o in candidates
              if o["category"] not in omit or o["category"] in must_haves]
    left_out = [o for o in candidates if o not in wanted]
    wanted.sort(key=lambda o: rule_for(o["category"]).priority)
    floor = space.w * space.d

    def area(o):
        return o["dimensions"]["width"] * o["dimensions"]["depth"]

    # The pieces that make a room what it is go in first, judged only against a
    # ceiling that leaves somewhere to stand. Everything else then shares half
    # of whatever floor is left, so a bed and a wardrobe no longer spend the
    # whole allowance and leave nothing for a nightstand.
    kept, taken, seen = [], 0.0, set()
    for o in wanted:
        cat = o["category"]
        if cat not in must_haves or cat in seen:
            continue
        if kept and not rule_for(cat).stackable and taken + area(o) > 0.82 * floor:
            left_out.append(o)
            continue
        seen.add(cat)
        if not rule_for(cat).stackable:
            taken += area(o)
        kept.append(o)

    budget, used_area = 0.5 * max(floor - taken, 0.0), 0.0
    for o in wanted:
        if o in kept:
            continue
        stack = rule_for(o["category"]).stackable
        if kept and not stack and used_area + area(o) > budget:
            left_out.append(o)
            continue
        if not stack:
            used_area += area(o)
        kept.append(o)
    kept.sort(key=lambda o: rule_for(o["category"]).priority)
    return kept, left_out


def _solve_layout(space, kept, room, s_openings, must_haves, seed, prefix="", effort=500):
    """Place the chosen pieces, giving up only on what genuinely will not fit."""
    from ids.scene import Scene as SScene, SceneObject as SObj, validate
    from ids.solver import SpatialSolver, SweepBackend, rule_for

    solver = SpatialSolver(backend=SweepBackend(), seed=seed, iterations=effort)
    dropped, counts = [], {}
    for o in kept:
        counts[o["category"]] = counts.get(o["category"], 0) + 1
        suffix = "" if counts[o["category"]] == 1 else f"_{counts[o['category']]}"
        o["object_id"] = f"{space.sid}__{prefix}{o['category']}{suffix}"
        o["room_id"] = space.sid

    shrunk = 0
    for _attempt in range(6):
        s_objs = [SObj(o["object_id"], space.sid, o["category"],
                       {"x": space.cx, "y": 0.0, "z": space.cy}, {"yaw": 0.0},
                       dict(o["dimensions"])) for o in kept]
        place, _report = solver.solve_room(room, s_objs, s_openings)
        for o in kept:
            p = place.get(o["object_id"])
            if p is not None:
                o["position"] = {"x": round(p.x, 3), "y": 0.0, "z": round(p.y, 3)}
                o["rotation"] = {"yaw": float(p.yaw)}
        scene = SScene(rooms=[room], openings=s_openings,
                       objects=[SObj(o["object_id"], space.sid, o["category"], o["position"],
                                     o["rotation"], o["dimensions"]) for o in kept])
        bad = {part for v in validate(scene) for part in v.object_id.split("&")}
        if not bad:
            stray = _stray_of_a_pair(kept)
            if stray is not None:
                # A bedside table with nowhere to stand looks like a leftover.
                # One nightstand beside the bed reads as a decision.
                dropped.append(f"{space.label}: {stray['label']}")
                kept = [o for o in kept if o is not stray]
                continue
            break
        bad_objects = [o for o in kept if o["object_id"] in bad]
        removable = [o for o in bad_objects if o["category"] not in must_haves]
        if not removable:
            # A bedroom without its bed or its almirah is not a bedroom. If a
            # piece that makes the room readable is the only thing that will
            # not fit, give it a smaller model rather than dropping it or
            # stripping out the furniture around it, which is not in its way.
            essential = next((o for o in bad_objects if o["category"] in must_haves), None)
            if essential is not None and shrunk < 2:
                shrunk += 1
                dims = essential["dimensions"]
                dims["width"] = round(dims["width"] * 0.88, 3)
                dims["depth"] = round(dims["depth"] * 0.88, 3)
                continue
            removable = bad_objects
        worst = max(removable, key=lambda o: rule_for(o["category"]).priority)
        dropped.append(f"{space.label}: {worst['label']}")
        kept = [o for o in kept if o is not worst]
        if not kept:
            break
    return kept, dropped


def _layout_score(space: _Space, objects, must_haves) -> float:
    """How well an arrangement serves the room, so the best one leads."""
    present = {o["category"] for o in objects}
    score = 1000.0 * sum(1 for m in must_haves if m in present)
    score += 10.0 * len(objects)
    # Furniture wants to sit against something. Reward a layout that leaves the
    # middle of the room walkable rather than parking a wardrobe in the open.
    floor = max(space.w * space.d, 1e-6)
    filled = sum(o["dimensions"]["width"] * o["dimensions"]["depth"] for o in objects)
    score -= 40.0 * max(0.0, filled / floor - 0.55)
    return score


def _furnish(space: _Space, pools, used, openings):
    """Up to three workable arrangements for one room, best first.

    Each is solved against this room's own rectangle and its real doors, so the
    result follows the customer's uploaded plan rather than a stock template.
    """
    candidates, dropped, must_haves = _room_candidates(space, pools, used)
    if not candidates:
        return [], []

    room_rect = (space.x0, space.y0, space.w, space.d)
    from ids.scene import Room as SRoom
    room = SRoom(space.sid, space.label, room_rect)
    s_openings = _openings_for(space, openings)

    # A shower room barely wider than its door has one sensible arrangement, and
    # working out two more costs as much as the room it is in. Only rooms with
    # space to rearrange get alternatives.
    roomy = space.w * space.d >= 5.0 and len(candidates) >= 3
    strategies = LAYOUT_STRATEGIES if roomy else LAYOUT_STRATEGIES[:1]

    layouts, seen_signatures = [], set()
    for index, (name, seed, omit) in enumerate(strategies):
        chosen, left_out = _select(space, copy.deepcopy(candidates), must_haves, omit)
        if not chosen:
            continue
        prefix = "" if index == 0 else f"L{index}__"
        # The arrangement that ships gets the full search; the alternatives are
        # a choice, not the default, and do not need to be hunted as hard.
        placed, lost = _solve_layout(space, chosen, room, s_openings,
                                     must_haves, seed, prefix,
                                     effort=500 if index == 0 else 220)
        if not placed:
            continue
        signature = tuple(sorted(
            (o["category"], round(o["position"]["x"], 1), round(o["position"]["z"], 1),
             int(o["rotation"]["yaw"])) for o in placed))
        if signature in seen_signatures:
            continue          # the same room twice is not a choice
        seen_signatures.add(signature)
        layouts.append({
            "name": name,
            "objects": placed,
            "score": _layout_score(space, placed, must_haves),
            "dropped": [f"{space.label}: {o['label']}" for o in left_out] + lost,
        })

    if not layouts:
        # A WC barely wider than its door still has a pan in it. Rather than
        # show the customer an empty tiled box, fit the room's essential piece.
        essential = _essential_fitting(space, candidates, openings)
        if essential is None:
            return [], dropped
        essential["object_id"] = f"{space.sid}__{essential['category']}"
        essential["room_id"] = space.sid
        return [{"name": "Balanced", "objects": [essential], "score": 0.0, "dropped": []}], dropped

    layouts.sort(key=lambda lay: -lay["score"])
    # Whichever arrangement won now takes the plain object ids, because every
    # other part of the app — the 2D plan, the quotation, the item list —
    # already reads those. The alternates keep a prefix so all three can be
    # loaded into the viewer at once and switched between.
    for index, layout in enumerate(layouts):
        prefix = "" if index == 0 else f"L{index}__"
        counts: dict[str, int] = {}
        for o in layout["objects"]:
            counts[o["category"]] = counts.get(o["category"], 0) + 1
            suffix = "" if counts[o["category"]] == 1 else f"_{counts[o['category']]}"
            o["object_id"] = f"{space.sid}__{prefix}{o['category']}{suffix}"
    return layouts, dropped + layouts[0]["dropped"]


@lru_cache(maxsize=1)
def _examples_by_category() -> dict[str, dict[str, Any]]:
    """One real object of each category, taken from the baked room templates."""
    variants, _ = _baked()
    out: dict[str, dict[str, Any]] = {}
    for variant in variants.values():
        for o in (variant.get("scene") or {}).get("objects", []):
            out.setdefault(o["category"], o)
    return out


def _example_object(category: str) -> Optional[dict[str, Any]]:
    return _examples_by_category().get(category)


_ESSENTIAL = {"bathroom": ("wc", "vanity"), "kitchen": ("counter_run", "wall_cabinets"),
              "master_bedroom": ("bed", "wardrobe"), "bedroom": ("bed", "wardrobe"),
              "living_room": ("sofa",),
              "dining_area": ("dining_set",), "study": ("desk",), "pooja_room": ("mandir",)}


def _essential_fitting(space: _Space, candidates: list[dict[str, Any]], openings) -> Optional[dict[str, Any]]:
    """The one piece that makes a room read as that room, shrunk to fit and put
    in the corner furthest from the door."""
    wanted = _ESSENTIAL.get(space.room_type, ())
    pick = next((o for cat in wanted for o in candidates if o["category"] == cat), None)
    if pick is None:
        return None
    item = copy.deepcopy(pick)
    dims = item["dimensions"]
    inner_w, inner_d = max(space.w - 0.24, 0.35), max(space.d - 0.24, 0.35)
    if dims["width"] > inner_w or dims["depth"] > inner_d:
        shrink = min(inner_w / dims["width"], inner_d / dims["depth"], 1.0)
        dims["width"] = round(dims["width"] * shrink, 3)
        dims["depth"] = round(dims["depth"] * shrink, 3)
    doors = [o for o in openings if o["room_id"] == space.sid and o["kind"] != "window"]
    door = doors[0] if doors else None
    dx = space.x0 + dims["width"] / 2 + 0.12
    dz = space.y0 + dims["depth"] / 2 + 0.12
    if door is not None:                       # sit away from the doorway
        cx = (door["p0"][0] + door["p1"][0]) / 2
        cy = (door["p0"][1] + door["p1"][1]) / 2
        dx = (space.x0 + dims["width"] / 2 + 0.12) if cx > space.cx             else (space.x1 - dims["width"] / 2 - 0.12)
        dz = (space.y0 + dims["depth"] / 2 + 0.12) if cy > space.cy             else (space.y1 - dims["depth"] / 2 - 0.12)
    item["position"] = {"x": round(dx, 3), "y": 0.0, "z": round(dz, 3)}
    item["rotation"] = {"yaw": 0.0}
    return item


# ═════════════════════════════════════════════════════════════ SVG plan ══════
def _plan_svg(scene, spaces, brief, tier, catalog) -> str:
    B0 = scene["bounds"]
    width, depth = max(B0["width"], 1.0), max(B0["depth"], 1.0)
    s = 776.0 / width
    left, top = 112.0, 120.0
    plan_bottom = top + depth * s
    total_h = plan_bottom + 180

    X = lambda x: left + x * s  # noqa: E731
    Y = lambda y: top + (depth - y) * s  # noqa: E731
    esc = lambda t: html.escape(str(t), quote=True)  # noqa: E731
    out: list[str] = []
    a = out.append

    def poly(pts, fill, stroke="none", sw=1.0, extra=""):
        p = " ".join(f"{X(x):.2f},{Y(y):.2f}" for x, y in pts)
        a(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.2f}" stroke-linejoin="miter"{extra}/>')

    def line(pts, stroke, sw, extra=""):
        p = " ".join(f"{X(x):.2f},{Y(y):.2f}" for x, y in pts)
        a(f'<polyline points="{p}" fill="none" stroke="{stroke}" stroke-width="{sw:.2f}" stroke-linejoin="miter" stroke-linecap="butt"{extra}/>')

    def text(x, y, t, size, fill="#6C6C6C", bold=False, anchor="middle", extra="", raw=False):
        weight = "bold" if bold else "normal"
        xx, yy = (x, y) if raw else (X(x), Y(y))
        a(f'<text x="{xx:.2f}" y="{yy:.2f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" '
          f'font-weight="{weight}" dominant-baseline="central"{extra}>{esc(t)}</text>')

    def rect_pts(x0, y0, x1, y1):
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="{total_h:.0f}" '
      f'viewBox="0 0 1000 {total_h:.0f}" font-family="Helvetica, Arial, sans-serif">')
    a(f"<title>{esc(scene['bhk'])} floor plan — traced from your upload</title>")
    a('<rect width="100%" height="100%" fill="#FFFFFF"/>')

    for sp in spaces:
        if sp.kind != "balcony":
            continue
        a(f'<g data-room="{esc(sp.sid)}" class-="plan-room">')
        poly(rect_pts(sp.x0, sp.y0, sp.x1, sp.y1), ROOM_TYPES["balcony"]["fill"], "#B9A87F", 1.0)
        step = 0.45
        xx = sp.x0 + step
        while xx < sp.x1 - 0.05:
            line([(xx, sp.y0), (xx, sp.y1)], "#D3D5CD", 0.8)
            xx += step
        text(sp.cx, sp.cy, sp.label.upper(), 9.5)
        a("</g>")
    circ = [sp for sp in spaces if sp.kind == "circulation"]
    if circ:
        a('<g data-room="circulation" class-="plan-room">')
        for sp in circ:
            poly(rect_pts(sp.x0, sp.y0, sp.x1, sp.y1), "#F3F0EA")
        for sp in circ:
            if sp.w * s > 60 and sp.d * s > 16:
                text(sp.cx, sp.cy, sp.label.upper(), 8.5)
        a("</g>")
    for room in scene["rooms"]:
        x, y, w, d = room["rect"]
        a(f'<g data-room="{esc(room["room_id"])}" class-="plan-room">')
        poly(rect_pts(x, y, x + w, y + d), ROOM_TYPES.get(room["room_type"], {}).get("fill", "#F7EBD3"), "#B9A87F", 1.0)
        a("</g>")

    labels = []
    # Rugs sit under everything else.
    for o in sorted(scene["objects"], key=lambda o: o["category"] != "rug"):
        _object_symbol(o, a, poly, line, X, Y, s, esc)
        dims = o["dimensions"]
        if dims["width"] * dims["depth"] >= 0.9 and o["category"] != "rug":
            labels.append((o["position"]["x"], o["position"]["z"], o["label"].upper()))
    for x, y, t in labels:
        text(x, y, t, 6.2, fill="#5F564A")

    for wall in scene["walls"]:
        t = wall["thickness"]
        (x0, y0), (x1, y1) = wall["p0"], wall["p1"]
        if abs(y0 - y1) < 1e-4:
            lo, hi = sorted((x0, x1))
            pts = [(lo - t / 2, y0), (hi + t / 2, y0)]
        else:
            lo, hi = sorted((y0, y1))
            pts = [(x0, lo - t / 2), (x0, hi + t / 2)]
        colour = "#6F6F6F" if wall["kind"] == "parapet" else "#1F1F1F"
        line(pts, colour, t * s)

    for op in scene["openings"]:
        (x0, y0), (x1, y1) = op["p0"], op["p1"]
        horizontal = abs(y0 - y1) < 1e-4
        depth_m = 0.254 if op["kind"] in ("window", "entrance") or op["kind"] == "balcony_door" else 0.14
        if horizontal:
            poly(rect_pts(min(x0, x1), y0 - depth_m / 2, max(x0, x1), y0 + depth_m / 2), "#FFFFFF")
        else:
            poly(rect_pts(x0 - depth_m / 2, min(y0, y1), x0 + depth_m / 2, max(y0, y1)), "#FFFFFF")
        if op["kind"] == "window":
            off = 0.1
            for k, sw, colour in ((-off, 1.3, "#5E8CA6"), (off, 1.3, "#5E8CA6"), (0.0, 0.8, "#5E8CA6")):
                if horizontal:
                    line([(x0, y0 + k), (x1, y1 + k)], colour, sw)
                else:
                    line([(x0 + k, y0), (x1 + k, y1)], colour, sw)
            continue
        if op["kind"] == "balcony_door":
            # Two overlapping sliding panels rather than a swing arc.
            half = op["width"] / 2
            for k, b_off in ((-0.05, (0.0, half + 0.1)), (0.05, (half - 0.1, op["width"]))):
                if horizontal:
                    lo = min(x0, x1)
                    line([(lo + b_off[0], y0 + k), (lo + b_off[1], y0 + k)], "#1F1F1F", 1.6)
                else:
                    lo = min(y0, y1)
                    line([(x0 + k, lo + b_off[0]), (x0 + k, lo + b_off[1])], "#1F1F1F", 1.6)
            continue
        hinge = op["p0"] if op["hinge"] == "start" else op["p1"]
        jamb = op["p1"] if op["hinge"] == "start" else op["p0"]
        sx, sy = op["swing_into"]
        r = op["width"]
        leaf_end = (hinge[0] + sx * r, hinge[1] + sy * r)
        a0 = math.atan2(jamb[1] - hinge[1], jamb[0] - hinge[0])
        a1 = math.atan2(sy, sx)
        delta = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        arc = [(hinge[0] + r * math.cos(a0 + delta * i / 18), hinge[1] + r * math.sin(a0 + delta * i / 18))
               for i in range(19)]
        line(arc, "#1F1F1F", 0.9)
        line([tuple(hinge), leaf_end], "#1F1F1F", 2.2)
        if op["kind"] == "entrance":
            ox, oy = (op["p0"][0] + op["p1"][0]) / 2 - sx * 0.4, (op["p0"][1] + op["p1"][1]) / 2 - sy * 0.4
            text(ox, oy, "ENTRY", 8.0, fill="#C2410C", bold=True)

    for room in scene["rooms"]:
        x, y, w, d = room["rect"]
        cx, cy = x + w / 2, y + d / 2
        small = w * s < 95 or d * s < 60
        name = room["label"].upper()
        size = 8.5 if small else 11.5
        box_w = max(len(name) * size * 0.62, 70 if not small else 52)
        px, py = X(cx), Y(cy)
        a(f'<polygon points="{px - box_w / 2:.2f},{py - 8:.2f} {px + box_w / 2:.2f},{py - 8:.2f} '
          f'{px + box_w / 2:.2f},{py + 30:.2f} {px - box_w / 2:.2f},{py + 30:.2f}" fill="#FFFFFFD9" '
          f'stroke="none" stroke-width="1.00" stroke-linejoin="miter"/>')
        text(px, py, name, size, fill="#232323", bold=True, raw=True)
        text(px, py + 13, f"{room['area_m2']:.2f} m²", 8.4 if not small else 7.0, raw=True)
        text(px, py + 24, f"{w:.2f} m × {d:.2f} m", 8.4 if not small else 7.0, raw=True)

    # Overall dimensions.
    ytop = top - 62
    a(f'<polyline points="{left:.2f},{ytop:.2f} {X(width):.2f},{ytop:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    a(f'<polyline points="{left:.2f},{ytop - 4:.2f} {left:.2f},{ytop + 4:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    a(f'<polyline points="{X(width):.2f},{ytop - 4:.2f} {X(width):.2f},{ytop + 4:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    text(left + width * s / 2, ytop - 7, f"{width:.2f}m", 9.6, fill="#3A3A3A", raw=True)
    xr = 950.0
    a(f'<polyline points="{xr:.2f},{plan_bottom:.2f} {xr:.2f},{top:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    a(f'<polyline points="{xr - 4:.2f},{plan_bottom:.2f} {xr + 4:.2f},{plan_bottom:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    a(f'<polyline points="{xr - 4:.2f},{top:.2f} {xr + 4:.2f},{top:.2f}" fill="none" stroke="#3A3A3A" stroke-width="0.90"/>')
    mid = (plan_bottom + top) / 2
    text(xr - 8, mid, f"{depth:.2f}m", 9.6, fill="#3A3A3A", raw=True,
         extra=f' transform="rotate(-90.0 {xr - 8:.2f} {mid:.2f})"')

    # Title block — ids match what the viewer re-tints live.
    ty = plan_bottom + 70
    a(f'<polyline points="{left:.2f},{ty:.2f} {left + 776:.2f},{ty:.2f}" fill="none" stroke="#CFCAC1" stroke-width="1.00"/>')
    style = brief.get("style") or scene["design"].get("style", "")
    text(left, ty + 22, f"{scene['bhk']} · {style} · {tier} tier", 13.0, fill="#232323", bold=True,
         anchor="start", raw=True, extra=' id="tb-title"')
    text(left, ty + 39, f"{brief.get('wood', '')} · {brief.get('fabric', '')} · {brief.get('property', '')}", 9.2,
         anchor="start", raw=True, extra=' id="tb-detail"')
    area = B0["area_m2"]
    text(left, ty + 55, f"Traced from your floor plan · {area:.1f} m² ({round(area * 10.764)} sq ft) · "
                        f"{len(scene['rooms'])} rooms · {len(scene['objects'])} furniture items", 9.2,
         anchor="start", raw=True)
    hexes = catalog.get("colors", {})
    colours = (brief.get("colors") or [])[:3] or ["Warm White", "Charcoal Grey", "Blush Pink"]
    while len(colours) < 3:
        colours.append(colours[-1])
    for i, c in enumerate(colours):
        cx0 = left + i * 77.7
        a(f'<polygon points="{cx0:.2f},{ty + 66:.2f} {cx0 + 15:.2f},{ty + 66:.2f} {cx0 + 15:.2f},{ty + 81:.2f} '
          f'{cx0:.2f},{ty + 81:.2f}" fill="{hexes.get(c, "#DDDDDD")}" stroke="#B4AFA6" stroke-width="0.80" '
          f'stroke-linejoin="miter" id="chip-{i}"/>')
        text(cx0 + 20, ty + 74, c, 8.4, anchor="start", raw=True, extra=f' id="chip-label-{i}"')
    bar_m = 5 if width >= 7 else 2
    bx0 = left + 776 - bar_m * s
    a(f'<polyline points="{bx0:.2f},{ty + 72:.2f} {left + 776:.2f},{ty + 72:.2f}" fill="none" stroke="#3A3A3A" stroke-width="1.20"/>')
    for k in range(bar_m + 1):
        xx = bx0 + k * s
        a(f'<polyline points="{xx:.2f},{ty + 68:.2f} {xx:.2f},{ty + 76:.2f}" fill="none" stroke="#3A3A3A" stroke-width="1.00"/>')
    text(bx0, ty + 85, "0m", 8.0, raw=True)
    text(left + 776, ty + 85, f"{bar_m}m", 8.0, raw=True)
    a('<polygon points="870.00,52.00 863.00,76.00 870.00,70.00 877.00,76.00" fill="#2B2B2B" stroke="none" stroke-width="1.00"/>')
    text(870, 88, "N", 9.5, fill="#232323", bold=True, raw=True)
    a("</svg>")
    return "\n".join(out)


_ROUND = {"side_table", "floor_lamp", "planter"}


def _object_symbol(o, a, poly, line, X, Y, s, esc):
    dims, role = o["dimensions"], o.get("role") or "wood"
    yaw = int(round(o["rotation"].get("yaw", 0))) % 360
    w, d = (dims["depth"], dims["width"]) if yaw in (90, 270) else (dims["width"], dims["depth"])
    cx, cy = o["position"]["x"], o["position"]["z"]
    x0, y0, x1, y1 = cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2
    face = {0: (0, 1), 90: (1, 0), 180: (0, -1), 270: (-1, 0)}.get(yaw, (0, 1))
    stroke = "#6E6353"
    a(f'<g data-object="{esc(o["object_id"])}" data-room="{esc(o["room_id"])}" class-="plan-object">')
    if o["category"] in _ROUND:
        r = min(w, d) / 2
        fill = "#DDE6D8" if o["category"] == "planter" else "#F0EDE6" if o["category"] == "floor_lamp" else "#E5D6C3"
        cls = f' class="fx-{role}-b"' if o["category"] == "side_table" else ""
        a(f'<circle cx="{X(cx):.2f}" cy="{Y(cy):.2f}" r="{r * s:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="0.90"{cls}/>')
    elif o["category"] == "rug":
        poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "#F8EEED", "#EDD2CF", 0.9,
             f' stroke-dasharray="6,4" class="fx-{role}-s fxs-{role}-o"')
    else:
        poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], "#E5D6C3", stroke, 0.9, f' class="fx-{role}-b"')
        if o["category"] in ("sofa", "armchair", "bed", "bench", "chair"):
            band = 0.18 if o["category"] != "bed" else 0.12
            fx, fy = face
            if fx == 0:
                by0, by1 = (y0, y0 + d * band) if fy > 0 else (y1 - d * band, y1)
                poly([(x0, by0), (x1, by0), (x1, by1), (x0, by1)], "#CFC2B0", stroke, 0.9, f' class="fx-{role}-d"')
            else:
                bx0, bx1 = (x0, x0 + w * band) if fx > 0 else (x1 - w * band, x1)
                poly([(bx0, y0), (bx1, y0), (bx1, y1), (bx0, y1)], "#CFC2B0", stroke, 0.9, f' class="fx-{role}-d"')
            if o["category"] == "bed":
                # two pillows at the head end
                fx, fy = face
                for k in (0.25, 0.75):
                    if fx == 0:
                        px = x0 + w * k
                        py = (y0 + d * 0.2) if fy > 0 else (y1 - d * 0.2)
                        poly([(px - w * 0.18, py - d * 0.06), (px + w * 0.18, py - d * 0.06),
                              (px + w * 0.18, py + d * 0.06), (px - w * 0.18, py + d * 0.06)], "#FFFFFF", stroke, 0.7)
                    else:
                        py = y0 + d * k
                        px = (x0 + w * 0.2) if fx > 0 else (x1 - w * 0.2)
                        poly([(px - w * 0.06, py - d * 0.18), (px + w * 0.06, py - d * 0.18),
                              (px + w * 0.06, py + d * 0.18), (px - w * 0.06, py + d * 0.18)], "#FFFFFF", stroke, 0.7)
        elif o["category"] in ("dining_set", "coffee_table", "island"):
            m = min(w, d) * 0.12
            poly([(x0 + m, y0 + m), (x1 - m, y0 + m), (x1 - m, y1 - m), (x0 + m, y1 - m)], "none", stroke, 0.7)
        elif o["category"] in ("wardrobe", "counter_run", "wall_cabinets", "bookshelf", "sideboard", "media_console"):
            if w >= d:
                for k in range(1, max(2, int(w / 0.6))):
                    line([(x0 + w * k / max(2, int(w / 0.6)), y0), (x0 + w * k / max(2, int(w / 0.6)), y1)], stroke, 0.7)
            else:
                for k in range(1, max(2, int(d / 0.6))):
                    line([(x0, y0 + d * k / max(2, int(d / 0.6))), (x1, y0 + d * k / max(2, int(d / 0.6)))], stroke, 0.7)
        elif o["category"] == "shower":
            line([(x0, y0), (x1, y1)], stroke, 0.7)
            line([(x0, y1), (x1, y0)], stroke, 0.7)
        elif o["category"] in ("wc", "vanity"):
            r = min(w, d) * 0.28
            a(f'<circle cx="{X(cx):.2f}" cy="{Y(cy):.2f}" r="{r * s:.2f}" fill="#FFFFFF" stroke="{stroke}" stroke-width="0.70"/>')
    a("</g>")
