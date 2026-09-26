"""Turn trained weights into the ONNX file the app loads.

    cd backend
    python ml/export_onnx.py --run rooms

Writes ml/models/room_seg.onnx and room_seg.classes.json. The app runs this
with onnxruntime, which it already has for reading text, so a machine serving
the site never needs PyTorch installed.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from train_rooms import UNet  # noqa: E402

MODELS = HERE / "models"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", default="rooms", help="folder under ml/runs")
    ap.add_argument("--out", default=str(MODELS / "room_seg.onnx"))
    ap.add_argument("--opset", type=int, default=17)
    args = ap.parse_args()

    checkpoint_path = HERE / "runs" / args.run / "best.pt"
    if not checkpoint_path.exists():
        sys.exit(f"{checkpoint_path} not found — train first")
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    classes = checkpoint["classes"]
    size = int(checkpoint.get("size", 512))

    model = UNet(len(classes), pretrained=False)
    model.load_state_dict(checkpoint["model"])
    model.eval()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros(1, 3, size, size)
    torch.onnx.export(
        model, dummy, str(out),
        input_names=["image"], output_names=["logits"],
        # The app feeds one plan at a time, but a square other than the trained
        # one should still work, so height and width stay free.
        dynamic_axes={"image": {0: "batch", 2: "height", 3: "width"},
                      "logits": {0: "batch", 2: "height", 3: "width"}},
        opset_version=args.opset,
    )
    meta = {"classes": classes, "size": size, "val_miou": checkpoint.get("val_miou")}
    out.with_suffix(".classes.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")

    try:
        import onnxruntime as ort
        import numpy as np
        session = ort.InferenceSession(str(out), providers=["CPUExecutionProvider"])
        logits = session.run(None, {"image": np.zeros((1, 3, size, size), dtype=np.float32)})[0]
        print("onnxruntime check passed, output", logits.shape)
    except Exception as exc:                                  # noqa: BLE001
        print("WARNING: could not verify with onnxruntime:", exc)

    print(f"wrote {out}  ({out.stat().st_size / 1e6:.1f} MB)  classes={len(classes)}")
    print("copy ml/models/ to the server and set ROOM_MODEL_PATH to that .onnx file")


if __name__ == "__main__":
    main()
