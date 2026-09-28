# Training the room model on a Kaggle notebook

Kaggle gives a free T4, 16 GB of RAM and about 9 hours per GPU session, which
is enough for this. Everything below is copied into cells in order.

## Before the first cell

New Notebook, then in the right-hand panel:

* **Accelerator → GPU T4 x2**. Without this the training cell runs on CPU and
  will not finish in a session.
* **Internet → On**. Needed to clone the repo and pip install. Kaggle only
  offers this on a phone-verified account; verify first if the toggle is
  greyed out.
* **Persistence → Files only** so `/kaggle/working` survives a restart.

Both repositories are public, so no token is needed.

---

## Cell 1 — get the code

```python
!git clone --depth 1 --branch design-studio-feedback \
    https://github.com/Vedant-Raju-Borker-2005/Interior_Design.git /kaggle/working/repo
%cd /kaggle/working/repo/backend
!pip -q install "rapidocr-onnxruntime>=1.2,<1.5" onnx onnxruntime
import torch; print("GPU:", torch.cuda.get_device_name(0))
```

Kaggle already has torch, torchvision, numpy, scipy, Pillow and OpenCV, so only
the three above are missing. If `get_device_name` raises, the accelerator is
not on — fix that before going further.

## Cell 2 — draw the training plans

```python
!python scripts/synth_plans.py --count 6000 --seed 7
```

Roughly 40–60 minutes on Kaggle's CPU. Start at 6000; going higher is only
worth it once a run has beaten the numbers below. Deterministic given the seed.

## Cell 3 — turn them into image/mask pairs

```python
!python ml/export_dataset.py
```

A minute or two. It prints the pair counts and the class list — check that all
twelve classes appear and that none is at zero, because `family_lounge`,
`study` and `pooja_room` are rare and a class with no pixels cannot be learned.

## Cell 4 — train

```python
!python ml/train_rooms.py --epochs 40 --batch 8 --workers 2
```

About 1.5–3 hours for 6000 plans on a T4. `--workers 2` matters: Kaggle gives
few CPU cores and the default of 4 starves the GPU. If it runs out of memory,
lower `--batch` to 4 — never lower `--size`, thin walls need the resolution.

## Cell 5 — export

```python
!python ml/export_onnx.py --run rooms
!ls -la ml/models/
```

## Cell 6 — the number that actually matters

```python
import os
os.environ["ROOM_MODEL_PATH"] = "/kaggle/working/repo/backend/ml/models/room_seg.onnx"
!python scripts/plan_eval.py --tag with_model
```

Then compare against the reader it has to beat:

```python
!python scripts/plan_eval.py --tag without_model     # ROOM_MODEL_PATH not set
```

The second command must run in a cell where `ROOM_MODEL_PATH` is unset, so put
it first or restart the kernel between the two.

**Targets, on the 21 real plans:**

| | rules reader | first model | you need |
|---|---|---|---|
| BHK correct | **15/21** | 7/21 | beat 15/21 |
| type recall | 0.672 | 0.738 | hold above 0.672 |
| area error | 0.366 | 0.138 | hold below 0.366 |
| size error | 0.259 | 0.322 | hold near 0.259 |

**BHK is the one that decides it.** The first model scored 0.958 validation
mIoU and still halved BHK accuracy, because that mIoU is measured on synthetic
plans drawn by the same script that made the training data. Ignore it. If BHK
does not beat 15/21 the model does not ship, whatever else improves.

## Cell 7 — take the model out

```python
!mkdir -p /kaggle/working/out
!cp ml/models/room_seg.onnx ml/models/room_seg.classes.json /kaggle/working/out/
!cp ml/runs/rooms/history.json /kaggle/working/out/
!ls -la /kaggle/working/out
```

Download those three from the Output panel on the right. The `.onnx` is around
57 MB.

---

## If BHK is still poor

Do these one at a time and re-run cell 6 after each, so you know which one
helped.

**Harsher damage.** The synthetic plans are still cleaner than a real brochure
scan, which is the likeliest reason the model does well on synthetic and badly
on real. In `scripts/synth_plans.py`, find `damage()` and push it further:
lower JPEG quality, stronger blur, smaller resolutions, more stretch and
rotation. Then re-run cells 2–6.

**A boundary class.** The model labels pixels by room type and has no idea
where one room ends, which is why a single room comes back as several blobs and
the bedroom count goes wrong. In `ml/export_dataset.py`, paint the wall band
between rooms as its own class instead of leaving it as background. This is the
most promising change and the most work.

**More plans.** `--count 12000`. Cheapest to try, least likely to be the
problem on its own.

## Rules

* Do not train on `plan_dataset/images/` — those 21 plans are the test set, and
  training on them makes every number above meaningless.
* Do not edit anything under `backend/app/`.
* Keep `--seed 7` so a run can be repeated.
* Report the `plan_eval.py` table, never the mIoU.
