# Automated Interior Design System

Three workflows off one shared scene model, exactly as the architecture
specifies. Workflows 2 and 3 never talk to each other — they both only read and
write `ids.scene.Scene`.

```
ids/
  scene.py      shared scene model + hard-constraint validator
  solver.py     Workflow 2 — CP-SAT (optional) or sweep feasibility, then annealing
  models.py     Workflow 1 — FP-Growth rules, style embeddings, price GBR
  history.py    order-history adapters (real dataframe + synthetic bootstrap)
  catalog.py    styles, palettes, tiers, SKU dimensions
  textures.py   procedural PBR texture bakery
  export.py     Workflow 3 — single-file HTML assembly
  pipeline.py   orchestration
  service.py    FastAPI surface
```

## Install

```bash
pip install -e ".[dev]"
pip install -e ".[solver]"    # optional: enables CPSATBackend
pip install -e ".[serve]"     # optional: enables ids.service
```

## Train once, reuse

```python
from ids import DesignPipeline, Brief

pipe = DesignPipeline.build(blobs="build/data_blobs.js")
pipe.save("artifacts/2026-09-11")
```

Point it at real orders instead of the synthetic bootstrap:

```python
from ids.history import from_dataframe
hist = from_dataframe(orders_df)               # one row per order line
pipe = DesignPipeline.build(blobs="build/data_blobs.js", history=hist)
```

## Serve

```bash
IDS_ARTIFACTS=artifacts/2026-09-11 IDS_BLOBS=build/data_blobs.js \
  uvicorn ids.service:app --port 8000
```

`POST /design` returns the solved scene, ranked recommendations and a predicted
price. `GET /options` returns the onboarding vocabulary. `GET /health` returns
the loaded model's metrics.

## Ship a viewer

```python
result = pipe.design(Brief(bhk="3 BHK", style="Luxury"))
pipe.render_html(result, "out/home.html",
                 textures="build/textures.json", viewer_js="build/viewer.js")
```

## Gates that matter in CI

* `test_solver_feasible_all_variants` — no layout ships with a hard-constraint
  breach.
* `test_price_parity` — the exported trees reproduce sklearn, so the browser and
  the server quote the same number.

## Known limitations

* The price GBR is unconstrained and so not monotonic in item count; a superset
  basket can price marginally lower. `DesignPipeline.design` clamps this and
  `test_price_monotonicity_rate` keeps the raw rate visible.
* `StyleEmbedder` is content-based (TF-IDF over tag documents). The architecture
  calls for a vision model over product imagery — use `fit_images(encoder, …)`.
* Floor-plan geometry (rooms, walls, openings) is input, not generated. The
  solver places furniture within a given plan.
