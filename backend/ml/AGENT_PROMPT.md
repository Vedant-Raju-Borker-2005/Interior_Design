# Brief for the coding agent doing the training

Paste everything below the line into the agent. It is deliberately short: the
code is written and tested, so the agent's job is to run it on the GPU, read
the numbers, and report. It should not redesign anything.

---

Train and export the floor-plan room segmentation model in this repo. The code
is already written and working — run it, do not redesign it. Read
`backend/ml/README.md` first; it is short and authoritative.

Work from `backend/`. GPU machine, Python 3.11.

```bash
pip install -r ml/requirements-train.txt        # install torch for your CUDA first
python scripts/synth_plans.py --count 4000 --seed 7
python ml/export_dataset.py
python ml/train_rooms.py --epochs 40 --batch 8
python ml/export_onnx.py --run rooms
```

Then measure on the real plans, which are never trained on:

```bash
python scripts/plan_eval.py --tag before
export ROOM_MODEL_PATH=ml/models/room_seg.onnx   # set ROOM_MODEL_PATH=... on Windows
python scripts/plan_eval.py --tag after
python -m pytest tests/ -q                        # 79 expected, must stay green
```

Beat these, on the real plans, not on validation mIoU:

| metric | now |
|---|---|
| BHK correct | 15/21 |
| type recall | 0.672 |
| area error (median) | 0.366 |
| size error (median) | 0.259 |

`type_recall` is the one that should move; missed rooms are the whole point.

Rules:
- Do not edit anything under `backend/app/` — the app side is done and tested.
- Do not train on `plan_dataset/images/` (the 21 real plans). They are the test
  set. Training on them makes the numbers meaningless.
- Out of GPU memory: lower `--batch` first, never `--size` — thin walls need
  the resolution.
- If validation mIoU is high but `after` is not better than `before`, that is
  the synthetic-to-real domain gap, not a bug. Say so and raise `--count`
  rather than tuning against the real plans.
- `--seed 7` keeps the sheets reproducible; keep it unless you have a reason.

Report back: epochs run, best validation mIoU, the before/after table from
`plan_eval.py`, wall-clock time, and the size of `room_seg.onnx`. Commit
`ml/models/room_seg.onnx` and `room_seg.classes.json` plus
`ml/runs/rooms/history.json`. Do not commit the generated sheets under
`plan_dataset/synthetic/` or `plan_dataset/seg/` — they are large and
regenerable, and already gitignored.

If something fails, paste the actual error rather than working around it.
