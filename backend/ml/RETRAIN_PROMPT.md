# Round two: brief for the coding agent

The first model trained cleanly and is in the repo. It is not switched on,
because measured on the 21 real plans it makes the product worse. Paste
everything below the line into the agent.

---

Retrain the floor-plan room segmentation model in this repo. A first model
exists at `backend/ml/models/room_seg.onnx` and reached **0.958 validation
mIoU**, but on the 21 real plans it is worse than the rules-based reader it was
meant to replace:

| measured on the 21 real plans | rules reader | your model |
|---|---|---|
| **BHK correct** | **15/21** | 7/21 |
| room type recall | 0.672 | **0.738** |
| area error (median) | 0.366 | **0.138** |
| size error (median) | **0.259** | 0.322 |

It finds and measures rooms better, and that part is a real win. But it
over-segments: on a 2 BHK it returned 5 bathrooms, 3 bedrooms and 2 kitchens.
BHK drives the package, the pricing and the 3D model, so halving its accuracy
makes the model unshippable however good the mIoU looks.

Post-processing was tried and does not rescue it. Tightening the blob
thresholds moved BHK from 7 to 10/21 but cost recall. Merging same-type boxes
gave 4/21 — it fuses two real adjacent bedrooms. Morphological closing gave
5/21 and pushed area error from 0.138 back to 0.268, which tells us the pieces
are not one room split by furniture; the model is genuinely mislabelling
regions. This has to be fixed in training.

## The one change that matters most

**Stop selecting checkpoints on validation mIoU.** It is measured on synthetic
plans drawn by the same script that produced the training data, so it mostly
reports how well the net memorised that generator. 0.958 there and 7/21 here is
the whole story.

Select on the real plans instead. `scripts/plan_eval.py` needs no boxes — it
scores BHK, room type recall and area error from the printed labels — so it
works as a validation metric directly:

```bash
ROOM_MODEL_PATH=ml/models/room_seg.onnx python scripts/plan_eval.py --tag try1
```

Make that the number you optimise. Export and score every few epochs if you
have to. A model that scores 0.80 on synthetic and beats 15/21 on real plans is
worth far more than one that scores 0.99 and does not.

## What to change, in order of expected value

1. **Harsher damage.** The synthetic plans are still too clean. In
   `scripts/synth_plans.py`, push the `damage()` pipeline much further: lower
   JPEG quality, heavier blur, lower resolution, stronger stretch and rotation,
   more aggressive cropping. Real brochure scans are far worse than what is
   generated now.
2. **More data.** `--count 8000` or higher. The first run used 4000.
3. **Teach it where rooms end.** The net currently labels pixels by type and
   has no notion of "this is one room", which is why one room becomes several
   blobs. Add a boundary class to `ml/export_dataset.py` — paint the wall band
   between rooms as its own class instead of leaving it background — and train
   on that. At inference the boundary gives a clean separator.
4. **Rebalance.** `family_lounge` had no pixels at all in a small sample, and
   `study` and `pooja_room` were under 1%. Check the class histogram after
   export and raise the generator's odds for the rare ones.

## Rules

- Do not train on `plan_dataset/images/` — those 21 plans are the test set.
  Training on them makes every number above meaningless.
- Do not edit anything under `backend/app/`.
- Report the `plan_eval.py` table, not the mIoU. If BHK does not beat 15/21,
  say so plainly rather than presenting the mIoU as success.
- Keep `--seed 7` unless you have a reason.

Report back: what you changed, epochs run, the `plan_eval.py` before/after
table, and the size of the exported model.
