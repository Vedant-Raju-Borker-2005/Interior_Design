"""Read a floor plan with the trained segmentation model, when one is installed.

Set ROOM_MODEL_PATH to an .onnx file produced by ml/export_onnx.py and
``detect_rooms`` will use this instead of tracing walls pixel by pixel. Nothing
else changes: the rooms this returns go through the same naming, scale and
scene building as before, so the model only has to answer one question — which
pixels belong to which room.

Inference runs on onnxruntime, which is already installed for reading text, so
no extra dependency and no PyTorch on the server.
"""
from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import numpy as np
from PIL import Image

log = logging.getLogger(__name__)

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# A blob smaller than this share of the plan is a smudge in the prediction, not
# a room, and a room the net is this unsure about is not worth showing.
MIN_ROOM_FRACTION = 0.004
MIN_CONFIDENCE = 0.35


def model_path() -> Optional[Path]:
    raw = os.getenv("ROOM_MODEL_PATH")
    if not raw:
        return None
    path = Path(raw)
    return path if path.exists() else None


@lru_cache(maxsize=1)
def _session(path: str, mtime: float):
    """The loaded model. Keyed by mtime so replacing the file reloads it."""
    import onnxruntime as ort
    options = ort.SessionOptions()
    # One plan at a time on a small box: extra threads only cost memory.
    options.intra_op_num_threads = max(1, min(4, (os.cpu_count() or 2) // 2))
    session = ort.InferenceSession(path, options, providers=["CPUExecutionProvider"])
    meta_file = Path(path).with_suffix(".classes.json")
    meta = json.loads(meta_file.read_text(encoding="utf-8")) if meta_file.exists() else {}
    classes = meta.get("classes") or []
    return session, classes, int(meta.get("size") or 512)


def available() -> bool:
    path = model_path()
    if path is None:
        return False
    try:
        _session(str(path), path.stat().st_mtime)
        return True
    except Exception as exc:                                  # noqa: BLE001
        log.warning("room model could not be loaded (%s); using the offline detector", exc)
        return False


def _boxes_from_mask(labels: np.ndarray, probability: np.ndarray, classes: list[str]):
    """One box per connected run of a class, as fractions of the image."""
    import cv2

    h, w = labels.shape
    found = []
    for index in range(1, len(classes)):
        blob = (labels == index).astype(np.uint8)
        if not blob.any():
            continue
        count, tags, stats, _ = cv2.connectedComponentsWithStats(blob, connectivity=4)
        for tag in range(1, count):
            x, y, bw, bh, area = stats[tag]
            if area < MIN_ROOM_FRACTION * h * w or bw < 4 or bh < 4:
                continue
            confidence = float(probability[tags == tag].mean())
            if confidence < MIN_CONFIDENCE:
                continue
            found.append({
                "room_type": classes[index],
                "box": [round(x / w, 4), round(y / h, 4),
                        round((x + bw) / w, 4), round((y + bh) / h, 4)],
                "confidence": round(confidence, 3),
                # How much of the box the room actually fills. A tidy rectangle
                # is near 1; anything low is an L-shape the box overstates.
                "fill": round(float(area) / max(bw * bh, 1), 3),
            })
    return found


def detect(img: Image.Image, bhk_hint: int = 2) -> Optional[dict[str, Any]]:
    """Rooms for one flat, or None if the model is not installed or fails."""
    path = model_path()
    if path is None:
        return None
    try:
        session, classes, size = _session(str(path), path.stat().st_mtime)
        if not classes:
            return None

        w, h = img.size
        scaled = img.convert("RGB").resize((size, size), Image.BILINEAR)
        x = np.asarray(scaled, dtype=np.float32) / 255.0
        x = ((x - MEAN) / STD).transpose(2, 0, 1)[None]

        logits = session.run(None, {session.get_inputs()[0].name: x.astype(np.float32)})[0][0]
        logits = logits - logits.max(axis=0, keepdims=True)
        probabilities = np.exp(logits)
        probabilities /= probabilities.sum(axis=0, keepdims=True)
        labels = probabilities.argmax(axis=0).astype(np.int32)
        confidence = probabilities.max(axis=0)

        rooms = _boxes_from_mask(labels, confidence, classes)
        if not rooms:
            return None
        rooms.sort(key=lambda r: -(r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1]))

        from .plan_layout import _CARPET_M2, BEDROOM_TYPES, _label_rooms
        from . import plan_scale

        # The printed text decides the scale. This is only so a plan with
        # nothing printed on it still comes out roughly the right size.
        covered = sum((r["box"][2] - r["box"][0]) * w * (r["box"][3] - r["box"][1]) * h
                      for r in rooms if r["room_type"] != "balcony")
        beds = sum(1 for r in rooms if r["room_type"] in BEDROOM_TYPES)
        evidence = []
        if covered > 0:
            typical = _CARPET_M2.get(min(beds or bhk_hint, 5), 58)
            evidence.append(plan_scale.Evidence(
                (covered / typical) ** 0.5, "typical carpet area"))

        return {
            "rooms": _label_rooms(rooms),
            "_scale_evidence": evidence,
            # The model says where the rooms are, not how big they are in
            # metres. The scale comes from the printed text, exactly as before.
            "plan_width_m": None,
            "door_gaps": [],
            "method": "segmentation",
            "notes": [],
            "_labels": [],
        }
    except Exception as exc:                                  # noqa: BLE001
        log.warning("room model failed (%s); using the offline detector", exc)
        return None
