"""Command line entry point.

    python -m ids demo                     # end-to-end, writes out/
    python -m ids train                    # fit models, write artifacts/
    python -m ids solve                    # re-solve + validate every variant
    python -m ids design --bhk "3 BHK" --style Luxury
    python -m ids render --out out/home.html
    python -m ids serve --port 8000

Every command takes --blobs and --artifacts; the defaults assume you are in the
repository root.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .catalog import Brief, Catalog
from .pipeline import DesignPipeline
from .scene import validate
from .solver import SpatialSolver, SweepBackend

DEF_BLOBS = "build/data_blobs.js"
DEF_ARTIFACTS = "artifacts/latest"
DEF_TEXTURES = "build/textures.json"
DEF_VIEWER = None      # None -> the copy packaged in ids/assets/


def _rule(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * max(28, len(title)))


def _brief_from(args, catalog: Catalog) -> Brief:
    base = catalog.default_brief()
    colors = tuple(args.colors.split(",")) if args.colors else base.colors
    return Brief(
        city=args.city or base.city, bhk=args.bhk or base.bhk,
        scope=args.scope or base.scope, budget=args.budget or base.budget,
        quality=args.quality or base.quality, timeline=base.timeline,
        style=args.style or base.style, wood=args.wood or base.wood,
        fabric=args.fabric or base.fabric, colors=colors,
        property_name=base.property_name)


def _load(args) -> DesignPipeline:
    art = Path(args.artifacts)
    if (art / "bundle.joblib").exists():
        print(f"loading models from {art}")
        return DesignPipeline.load(art, blobs=args.blobs)
    print(f"no artifacts at {art} — training from scratch "
          f"(run `python -m ids train` to cache them)")
    return DesignPipeline.build(blobs=args.blobs)


# ───────────────────────────────────────────────────────────── commands ────
def cmd_train(args) -> int:
    _rule("Workflow 1 — training")
    t = time.time()
    pipe = DesignPipeline.build(blobs=args.blobs, version=args.version)
    meta = pipe.bundle.export()["meta"]
    print(f"trained on {meta['orders']:,} bundles in {time.time() - t:.1f}s")
    print(f"  association rules : {meta['rules']:,}")
    print(f"  embedding         : {meta['embedding_dim']}-d, "
          f"{meta['explained_variance']:.1%} variance explained")
    print(f"  price model       : MAPE {meta['price_mape']:.1%}  "
          f"R² {meta['price_r2']:.3f}  MAE ₹{meta['price_mae']:,}")
    out = pipe.save(args.artifacts)
    print(f"\nsaved -> {out}/bundle.joblib, {out}/model.json")
    print("\ntop rules by lift:")
    for r in pipe.bundle.association.rules[:8]:
        print(f"  {{{', '.join(r.antecedent)}}} -> {r.consequent:14s} "
              f"conf {r.confidence:.2f}  lift {r.lift:.2f}")
    return 0


def cmd_solve(args) -> int:
    _rule("Shared step — spatial constraint solver")
    catalog = Catalog.from_blobs(args.blobs)
    solver = SpatialSolver(backend=None if args.cpsat else SweepBackend(),
                           seed=args.seed, iterations=args.iterations)
    print(f"backend: {solver.backend.name}, {args.iterations} annealing steps\n")
    total_bad = t0 = 0
    t0 = time.time()
    for key in catalog.variants:
        from .scene import Scene
        scene = Scene.from_dict(catalog.variant_scene(*key.split("|")))
        solved, reports = solver.solve_scene(scene)
        bad = validate(solved)
        total_bad += len(bad)
        flag = "\033[32mok\033[0m" if not bad else f"\033[31m{len(bad)} violations\033[0m"
        print(f"  {key:20s} {len(scene.objects):3d} objects  {flag}")
        for v in bad[:2]:
            print(f"      {v}")
    print(f"\n{len(catalog.variants)} variants in {time.time() - t0:.1f}s, "
          f"{total_bad} total violations")
    return 1 if total_bad else 0


def cmd_design(args) -> int:
    pipe = _load(args)
    brief = _brief_from(args, pipe.catalog)
    _rule("Design")
    print(f"brief: {brief.bhk} · {brief.style} · {brief.budget} · "
          f"{brief.quality} · {', '.join(brief.colors)}")
    t = time.time()
    r = pipe.design(brief, solve=not args.no_solve)
    print(f"solved in {time.time() - t:.1f}s\n")
    s = r.summary()
    print(f"  tier            : {s['tier']}")
    print(f"  palette         : {' / '.join(s['palette'])}")
    print(f"  rooms / objects : {s['rooms']} / {s['objects']}")
    print(f"  feasible        : {s['feasible']} ({s['violations']} violations)")
    print(f"  predicted price : ₹{s['price']:,}  "
          f"(₹{s['price_with_recommendations']:,} with add-ons)")
    print("\n  recommended add-ons:")
    for rec in r.recommendations:
        rule = rec["rule"]
        print(f"    {rec['category']:16s} score {rec['score']:.3f}  "
              f"conf {rule['confidence']:.0%}  lift {rule['lift']:.2f}  "
              f"style fit {rec['style_fit']:.0%}")
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps(
            {"summary": s, "scene": r.scene.to_dict(),
             "recommendations": r.recommendations}, indent=2, ensure_ascii=False))
        print(f"\nwrote {args.json}")
    return 0 if r.feasible else 1


def _ensure_textures(path: str) -> str:
    from . import textures as bakery
    if not Path(path).exists():
        print(f"baking PBR atlas -> {path} (one-off, ~40s)")
        bakery.main(path)
    return path


def cmd_render(args) -> int:
    pipe = _load(args)
    _ensure_textures(args.textures)
    brief = _brief_from(args, pipe.catalog)
    _rule("Workflow 3 — render")
    r = pipe.design(brief, solve=not args.no_solve)
    out = pipe.render_html(r, args.out, textures=args.textures,
                           viewer_js=args.viewer)
    print(f"{out}  ({out.stat().st_size / 1048576:.2f} MB)")
    print("open it in a browser — three.js loads from the CDN on first view")
    return 0


def cmd_demo(args) -> int:
    """Everything, in order, with the outputs printed as it goes."""
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    _rule("1/5  Catalogue")
    catalog = Catalog.from_blobs(args.blobs)
    print(f"  {len(catalog.variants)} scene variants, {len(catalog.skus)} SKUs")
    print(f"  styles : {', '.join(catalog.styles)}")
    print(f"  woods  : {', '.join(catalog.woods)}")

    _rule("2/5  Workflow 1 — train")
    t = time.time()
    pipe = DesignPipeline.build(blobs=args.blobs)
    meta = pipe.bundle.export()["meta"]
    print(f"  {meta['orders']:,} bundles -> {meta['rules']:,} rules in "
          f"{time.time() - t:.1f}s")
    print(f"  price model MAPE {meta['price_mape']:.1%}, R² {meta['price_r2']:.3f}")
    pipe.save(args.artifacts)
    print(f"  artifacts -> {args.artifacts}")

    _rule("3/5  Shared step — solve and validate every variant")
    t = time.time()
    pipe.solve_all()
    bad = {k: v for k, v in pipe.solve_summary.items() if v}
    print(f"  {len(pipe.solve_summary)} variants in {time.time() - t:.1f}s")
    print(f"  violations: {bad or 'none'}")

    _rule("4/5  Design three briefs")
    briefs = [
        Brief(bhk="1 BHK", style="Boho", budget="₹3L–₹5L", quality="Budget",
              wood="Teak Laminate", fabric="Woven Fabric",
              colors=("Ivory", "Burnt Orange")),
        Brief(bhk="3 BHK", style="Luxury", budget="₹12L–₹20L", quality="Premium",
              wood="Walnut Laminate", fabric="Velvet",
              colors=("Off White", "Charcoal Grey", "Champagne Gold")),
        Brief(bhk="5 BHK", style="Indian Contemporary", budget="₹20L+",
              quality="Premium", wood="Teak Laminate", fabric="Linen",
              colors=("Warm White", "Deep Emerald")),
    ]
    results = []
    for b in briefs:
        r = pipe.design(b)
        results.append(r)
        s = r.summary()
        print(f"  {b.bhk:7s} {b.style:21s} {s['tier']:9s} "
              f"{s['objects']:3d} objects  feasible={str(s['feasible']):5s} "
              f"₹{s['price']:>10,}  +{', '.join(s['recommendations'][:3]) or '-'}")

    _rule("5/5  Workflow 3 — render the middle brief")
    _ensure_textures(args.textures)
    html = pipe.render_html(results[1], out_dir / "home_viewer.html",
                            textures=args.textures, viewer_js=args.viewer)
    print(f"  {html}  ({html.stat().st_size / 1048576:.2f} MB)")

    plan = _plot_rooms(results[1], out_dir / "solved_layout.png")
    if plan:
        print(f"  {plan}")
    (out_dir / "design.json").write_text(json.dumps(
        {"summary": results[1].summary(),
         "recommendations": results[1].recommendations}, indent=2, ensure_ascii=False))
    print(f"  {out_dir / 'design.json'}")
    print("\n\033[1mdone\033[0m — open the HTML in a browser.")
    return 0


def _plot_rooms(result, path: Path):
    """Top-down plot of the solved layout. Skipped if matplotlib is absent."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Rectangle
    except Exception:
        return None
    scene = result.scene
    rooms = scene.rooms[:6]
    cols = min(3, len(rooms))
    rows = (len(rooms) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(4.6 * cols, 4.2 * rows))
    axes = list(axes.flat) if hasattr(axes, "flat") else [axes]
    for ax, room in zip(axes, rooms):
        x, y, w, d = room.rect
        ax.add_patch(Rectangle((x, y), w, d, fill=False, lw=2, ec="#333"))
        for op in scene.openings_in(room.room_id):
            ax.plot([op.p0[0], op.p1[0]], [op.p0[1], op.p1[1]], lw=4,
                    color="#c2410c" if op.is_door else "#2563eb")
            sb = op.swing_box()
            if sb:
                ax.add_patch(Rectangle((sb.x0, sb.y0), sb.w, sb.d,
                                       fc="#c2410c", alpha=.10))
        for o in scene.objects_in(room.room_id):
            b = o.footprint()
            ax.add_patch(Rectangle((b.x0, b.y0), b.w, b.d, fc="#8ea9c9",
                                   ec="#31506e", alpha=.85))
            ax.text(b.cx, b.cy, o.category.replace("_", "\n"), ha="center",
                    va="center", fontsize=6)
        ax.set_aspect("equal")
        ax.set_title(f"{room.label}", fontsize=10)
        ax.autoscale_view()
        ax.set_xticks([]); ax.set_yticks([])
    for ax in axes[len(rooms):]:
        ax.axis("off")
    fig.suptitle(f"Solver output — {result.brief.bhk} {result.brief.style} "
                 f"({result.tier})  ·  orange = door swing, blue = window")
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)
    return path


def cmd_serve(args) -> int:
    import os
    os.environ.setdefault("IDS_ARTIFACTS", args.artifacts)
    os.environ.setdefault("IDS_BLOBS", args.blobs)
    try:
        import uvicorn
    except ImportError:
        print("uvicorn not installed — pip install -e '.[serve]'", file=sys.stderr)
        return 2
    uvicorn.run("ids.service:app", host=args.host, port=args.port, reload=False)
    return 0


# ───────────────────────────────────────────────────────────────── main ────
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser("ids", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--blobs", default=DEF_BLOBS)
    p.add_argument("--artifacts", default=DEF_ARTIFACTS)
    sub = p.add_subparsers(dest="cmd", required=True)

    def brief_flags(sp):
        for f in ("city", "bhk", "scope", "budget", "quality", "style", "wood",
                  "fabric", "colors"):
            sp.add_argument(f"--{f}", default=None,
                            help="comma separated" if f == "colors" else None)
        sp.add_argument("--no-solve", action="store_true",
                        help="use the cached layout instead of re-solving")

    t = sub.add_parser("train", help="fit the models and cache artifacts")
    t.add_argument("--version", default="v1")
    t.set_defaults(func=cmd_train)

    s = sub.add_parser("solve", help="re-solve and validate every scene variant")
    s.add_argument("--iterations", type=int, default=900)
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--cpsat", action="store_true", help="prefer OR-Tools if installed")
    s.set_defaults(func=cmd_solve)

    d = sub.add_parser("design", help="design one home and print the result")
    brief_flags(d)
    d.add_argument("--json", default=None, help="also write the full result here")
    d.set_defaults(func=cmd_design)

    r = sub.add_parser("render", help="design and write the single-file viewer")
    brief_flags(r)
    r.add_argument("--out", default="out/home_viewer.html")
    r.add_argument("--textures", default=DEF_TEXTURES)
    r.add_argument("--viewer", default=DEF_VIEWER, help="override the packaged viewer")
    r.set_defaults(func=cmd_render)

    dm = sub.add_parser("demo", help="run everything end to end")
    dm.add_argument("--out-dir", default="out")
    dm.add_argument("--textures", default=DEF_TEXTURES)
    dm.add_argument("--viewer", default=DEF_VIEWER, help="override the packaged viewer")
    dm.set_defaults(func=cmd_demo)

    sv = sub.add_parser("serve", help="run the FastAPI service")
    sv.add_argument("--host", default="127.0.0.1")
    sv.add_argument("--port", type=int, default=8000)
    sv.set_defaults(func=cmd_serve)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not Path(args.blobs).exists():
        print(f"scene data not found at {args.blobs} — pass --blobs", file=sys.stderr)
        return 2
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
