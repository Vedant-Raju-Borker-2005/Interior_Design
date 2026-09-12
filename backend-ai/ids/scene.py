"""Shared scene model, 2D geometry primitives, and hard-constraint validator."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Sequence


def yaw_footprint(width: float, depth: float, yaw: float) -> tuple[float, float]:
    """Compute 2D footprint width and depth after yaw rotation."""
    y = int(round(yaw)) % 360
    if y in (90, 270):
        return float(depth), float(width)
    return float(width), float(depth)


@dataclass(frozen=True)
class Box:
    """Axis-aligned 2D bounding box."""
    x0: float
    y0: float
    x1: float
    y1: float

    def __post_init__(self):
        if self.x1 < self.x0:
            object.__setattr__(self, "x0", self.x1)
            object.__setattr__(self, "x1", self.x0)
        if self.y1 < self.y0:
            object.__setattr__(self, "y0", self.y1)
            object.__setattr__(self, "y1", self.y0)

    @classmethod
    def centred(cls, cx: float, cy: float, w: float, d: float) -> "Box":
        hw, hd = w / 2.0, d / 2.0
        return cls(cx - hw, cy - hd, cx + hw, cy + hd)

    @property
    def w(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def d(self) -> float:
        return max(0.0, self.y1 - self.y0)

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2.0

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2.0

    @property
    def area(self) -> float:
        return self.w * self.d

    def overlap(self, other: "Box") -> float:
        """Area of intersection between two boxes."""
        ox = max(0.0, min(self.x1, other.x1) - max(self.x0, other.x0))
        oy = max(0.0, min(self.y1, other.y1) - max(self.y0, other.y0))
        return ox * oy

    def contains(self, other: "Box", tol: float = 0.0) -> bool:
        """Check if this box fully contains another box within a tolerance."""
        return (
            self.x0 <= other.x0 + tol
            and other.x1 <= self.x1 + tol
            and self.y0 <= other.y0 + tol
            and other.y1 <= self.y1 + tol
        )

    def inflate(self, margin: float) -> "Box":
        """Expand (or shrink if negative) box boundaries by margin."""
        return Box(self.x0 - margin, self.y0 - margin, self.x1 + margin, self.y1 + margin)


@dataclass
class Room:
    room_id: str
    label: str
    rect: tuple[float, float, float, float]  # (x, y, w, d)

    @property
    def box(self) -> Box:
        x, y, w, d = self.rect
        return Box(x, y, x + w, y + d)

    def to_dict(self) -> dict[str, Any]:
        return {"room_id": self.room_id, "label": self.label, "rect": list(self.rect)}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Room":
        return cls(d["room_id"], d["label"], tuple(float(v) for v in d["rect"]))


@dataclass
class Opening:
    opening_id: str
    room_id: str
    p0: tuple[float, float]
    p1: tuple[float, float]
    is_door: bool
    swing_dir: str = "in"

    @property
    def centre(self) -> tuple[float, float]:
        return ((self.p0[0] + self.p1[0]) / 2.0, (self.p0[1] + self.p1[1]) / 2.0)

    @property
    def width(self) -> float:
        return float(math.hypot(self.p1[0] - self.p0[0], self.p1[1] - self.p0[1]))

    def swing_box(self) -> Box | None:
        """Clearance swing box for doors, unblocked by furniture."""
        if not self.is_door:
            return None
        w = max(self.width, 0.75)
        # Compute perpendicular direction into room
        dx = self.p1[0] - self.p0[0]
        dy = self.p1[1] - self.p0[1]
        length = math.hypot(dx, dy) or 1.0
        # Normal pointing into room
        nx, ny = -dy / length, dx / length
        cx, cy = self.centre
        scx = cx + nx * (w / 2.0)
        scy = cy + ny * (w / 2.0)
        return Box.centred(scx, scy, w, w)

    def to_dict(self) -> dict[str, Any]:
        return {
            "opening_id": self.opening_id,
            "room_id": self.room_id,
            "p0": list(self.p0),
            "p1": list(self.p1),
            "is_door": self.is_door,
            "swing_dir": self.swing_dir,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Opening":
        return cls(
            d["opening_id"],
            d["room_id"],
            (float(d["p0"][0]), float(d["p0"][1])),
            (float(d["p1"][0]), float(d["p1"][1])),
            bool(d["is_door"]),
            d.get("swing_dir", "in"),
        )


@dataclass
class SceneObject:
    object_id: str
    room_id: str
    category: str
    position: dict[str, float]
    rotation: dict[str, float]
    dimensions: dict[str, float]
    asset_url: str = ""

    def footprint(self) -> Box:
        w, d = yaw_footprint(
            self.dimensions["width"], self.dimensions["depth"], self.rotation.get("yaw", 0.0)
        )
        return Box.centred(self.position["x"], self.position["z"], w, d)

    def to_dict(self) -> dict[str, Any]:
        res: dict[str, Any] = {
            "object_id": self.object_id,
            "room_id": self.room_id,
            "category": self.category,
            "position": {k: float(v) for k, v in self.position.items()},
            "rotation": {k: float(v) for k, v in self.rotation.items()},
            "dimensions": {k: float(v) for k, v in self.dimensions.items()},
        }
        if self.asset_url:
            res["asset_url"] = self.asset_url
        return res

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SceneObject":
        return cls(
            object_id=d["object_id"],
            room_id=d["room_id"],
            category=d["category"],
            position=dict(d["position"]),
            rotation=dict(d["rotation"]),
            dimensions=dict(d["dimensions"]),
            asset_url=d.get("asset_url", ""),
        )


@dataclass(frozen=True)
class Violation:
    kind: str
    object_id: str
    details: str

    def __str__(self) -> str:
        return f"[{self.kind}] {self.object_id}: {self.details}"


class Scene:
    """The central data contract connecting all workflows."""

    def __init__(
        self,
        rooms: Sequence[Room] | None = None,
        objects: Sequence[SceneObject] | None = None,
        openings: Sequence[Opening] | None = None,
    ):
        self.rooms: list[Room] = list(rooms or [])
        self.objects: list[SceneObject] = list(objects or [])
        self.openings: list[Opening] = list(openings or [])

    def room(self, room_id: str) -> Room:
        for r in self.rooms:
            if r.room_id == room_id:
                return r
        raise KeyError(f"Room '{room_id}' not found in scene")

    def openings_in(self, room_id: str) -> list[Opening]:
        return [o for o in self.openings if o.room_id == room_id]

    def objects_in(self, room_id: str) -> list[SceneObject]:
        return [o for o in self.objects if o.room_id == room_id]

    def categories(self) -> list[str]:
        return [o.category for o in self.objects]

    def to_dict(self) -> dict[str, Any]:
        return {
            "rooms": [r.to_dict() for r in self.rooms],
            "openings": [o.to_dict() for o in self.openings],
            "objects": [o.to_dict() for o in self.objects],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Scene":
        return cls(
            rooms=[Room.from_dict(r) for r in d.get("rooms", [])],
            objects=[SceneObject.from_dict(o) for o in d.get("objects", [])],
            openings=[Opening.from_dict(op) for op in d.get("openings", [])],
        )


def validate(scene: Scene) -> list[Violation]:
    """Validate all hard constraints on a scene. Returns empty list if feasible."""
    from .solver import rule_for

    violations: list[Violation] = []
    for room in scene.rooms:
        inner = room.box.inflate(-0.04)
        objs = scene.objects_in(room.room_id)
        openings = scene.openings_in(room.room_id)
        doors = [op for op in openings if op.is_door]
        windows = [op for op in openings if not op.is_door]

        # 1. Boundary containment
        for o in objs:
            b = o.footprint()
            if not inner.contains(b, tol=0.03):
                violations.append(
                    Violation("boundary", o.object_id, f"exceeds boundary of room {room.room_id}")
                )

        # 2. Furniture pairwise overlaps
        for i in range(len(objs)):
            for j in range(i + 1, len(objs)):
                o1, o2 = objs[i], objs[j]
                r1 = rule_for(o1.category)
                r2 = rule_for(o2.category)
                if r1.stackable or r2.stackable:
                    continue
                ov = o1.footprint().overlap(o2.footprint())
                if ov > 0.04:
                    violations.append(
                        Violation("overlap", f"{o1.object_id}&{o2.object_id}", f"overlap area {ov:.2f}m²")
                    )

        # 3. Door swing clearance
        for d in doors:
            sb = d.swing_box()
            if not sb:
                continue
            for o in objs:
                if rule_for(o.category).stackable:
                    continue
                ov = sb.overlap(o.footprint())
                if ov > 0.03:
                    violations.append(
                        Violation("door_blocked", o.object_id, f"blocks door {d.opening_id} (overlap {ov:.2f}m²)")
                    )

        # 4. Window clearance for tall objects
        for w in windows:
            w_box = Box.centred(w.centre[0], w.centre[1], max(w.width, 0.4), 0.30)
            for o in objs:
                if o.dimensions.get("height", 0.0) > 1.1:
                    ov = w_box.overlap(o.footprint())
                    if ov > 0.03:
                        violations.append(
                            Violation("window_blocked", o.object_id, f"tall object blocks window {w.opening_id}")
                        )

    return violations
