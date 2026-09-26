# Room segmentation model

The floor-plan reader finds rooms by tracing walls pixel by pixel. That works
on a clean drawing and falls apart on a blurred JPEG where an interior wall is
one pixel wide: on the 21 labelled real plans it finds about two thirds of the
rooms, and on the worst images it misses the living room entirely.

This trains a replacement — a U-Net that labels every pixel with the room type
covering it — and exports it to ONNX so the site can run it without PyTorch.

**Nothing here is required to run the app.** With no model installed the reader
behaves exactly as it does today. The model is picked up only when the
`ROOM_MODEL_PATH` environment variable points at an `.onnx` file.

## What the model does and does not do

It answers one question: which pixels belong to which room. Naming the rooms,
working out the scale in metres, splitting a sheet of several flats, and
building the 3D scene all stay where they are and are unchanged. That keeps the
change small and means a bad model degrades one thing instead of everything.

## Training data

Real plans are not usable for this. `plan_dataset/ground_truth.json` records
each real room's type and printed area but **not its box**, so there is no mask
to learn from. Drawing 21 plans by hand would also not be enough data.

Synthetic plans are. `scripts/synth_plans.py` generates sheets from a generated
apartment, so every room's box and type are known exactly, and it already
reproduces what wrecks the tracer: JPEG artefacts, blur, low resolution,
uneven stretch, rotation, cropping, colour casts, watermarks, phone screenshot
furniture, single- and double-line CAD exports, colour-coded plans that print
only an area, and numbered plans with a legend.

The real plans stay as the honest test. They are never trained on; they are
scored with `scripts/plan_eval.py`, which is what decides whether the model is
actually better.

Expect a domain gap. Synthetic plans are cleaner than a photograph of a printed
sheet, so validation mIoU will flatter the model. Trust `plan_eval.py`.

## Steps

Everything runs from `backend/`.

```bash
# 0. install (torch for your CUDA version first — see requirements-train.txt)
pip install -r ml/requirements-train.txt

# 1. draw the training sheets. 600 is the default and is not enough; use 4000+.
#    ~40 min for 4000 on a normal CPU. Deterministic given --seed.
python scripts/synth_plans.py --count 4000 --seed 7

# 2. turn them into image/mask pairs (one flat per pair, cropped)
python ml/export_dataset.py

# 3. train. ~1-2 h for 40 epochs on an RTX 3060 at batch 8.
python ml/train_rooms.py --epochs 40 --batch 8

# 4. export for the app
python ml/export_onnx.py --run rooms
```

Step 3 prints validation mIoU each epoch and keeps the best weights in
`ml/runs/rooms/best.pt`. Step 4 writes `ml/models/room_seg.onnx` plus a
`.classes.json` naming the channels.

If the GPU runs out of memory, lower `--batch` before lowering `--size`;
resolution matters more than batch size for thin walls.

## Checking it is actually better

This is the part that matters. Compare against the current reader on the real
plans, which neither version has trained on:

```bash
python scripts/plan_eval.py --tag before                       # model off

set ROOM_MODEL_PATH=ml/models/room_seg.onnx                    # Windows
export ROOM_MODEL_PATH=ml/models/room_seg.onnx                 # Linux/macOS
python scripts/plan_eval.py --tag after
```

Today's numbers, to beat:

| | now |
|---|---|
| BHK correct | 15/21 |
| room type recall | 0.672 |
| area error (median) | 0.366 |
| room size error (median) | 0.259 |

`type_recall` is the one the model should move most, because missed rooms are
the problem it exists to solve. If `after` is not better on the real plans,
the model does not ship however good its mIoU looked.

Also run the tests, which must stay green either way:

```bash
python -m pytest tests/ -q          # 79 expected
```

## Installing the model on the server

Copy `ml/models/room_seg.onnx` and `room_seg.classes.json` to the machine and
set `ROOM_MODEL_PATH` to the `.onnx` file. No PyTorch needed — inference uses
the `onnxruntime` already installed for reading text. Unset the variable to go
back to wall tracing; the app does not need a restart to *fall back*, and
reloads the model if the file is replaced.

Note the app's own machine has 4 GB of RAM and the OCR engine already uses
400-600 MB, so keep the exported model small. A ResNet-18 U-Net is about 50 MB
and adds roughly 200 MB while running, which fits. A larger encoder may not.

## Files

| file | what it is |
|---|---|
| `export_dataset.py` | synthetic sheets → image/mask pairs, one flat each |
| `train_rooms.py` | the U-Net, the training loop, mIoU |
| `export_onnx.py` | `best.pt` → `room_seg.onnx` |
| `requirements-train.txt` | training-only packages |
| `../app/services/plan_model.py` | how the app loads and runs the model |
| `AGENT_PROMPT.md` | a short brief to hand a coding agent |
