"""Train a U-Net to label every pixel of a floor plan with its room type.

    cd backend
    python ml/train_rooms.py --epochs 40 --batch 8

Needs a GPU and the packages in ml/requirements-train.txt. Reads the pairs made
by ml/export_dataset.py, writes the best weights (by validation mean IoU) to
ml/runs/<name>/best.pt, and a history.json beside them.

The encoder is a ResNet-18 from torchvision, pretrained on photographs. Floor
plans are not photographs, but the early layers still arrive knowing about
edges and corners, which is most of what a line drawing is, and that is worth
several epochs of training.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.models import ResNet18_Weights, resnet18

BACKEND = Path(__file__).resolve().parents[1]
SEG = BACKEND / "plan_dataset" / "seg"
RUNS = Path(__file__).resolve().parent / "runs"


# ── data ──────────────────────────────────────────────────────────────────────

class Plans(Dataset):
    """Image/mask pairs, with the knocks a scanned or photographed plan takes."""

    def __init__(self, root: Path, size: int, train: bool):
        self.items = sorted((root / "images").glob("*.png"))
        self.masks = root / "masks"
        self.size, self.train = size, train

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path = self.items[i]
        image = Image.open(path).convert("RGB")
        mask = Image.open(self.masks / path.name)

        if self.train:
            # A plan can arrive rotated a quarter turn or flipped; the room
            # types are the same either way, so the net should not care.
            k = random.randint(0, 3)
            if k:
                image, mask = image.rotate(90 * k, expand=True), mask.rotate(90 * k, expand=True)
            if random.random() < 0.5:
                image, mask = (image.transpose(Image.FLIP_LEFT_RIGHT),
                               mask.transpose(Image.FLIP_LEFT_RIGHT))

        image = image.resize((self.size, self.size), Image.BILINEAR)
        mask = mask.resize((self.size, self.size), Image.NEAREST)
        x = torch.from_numpy(np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 255.0)

        if self.train:
            # Brightness, contrast and a little noise stand in for a phone
            # photo of a printed sheet.
            x = (x * random.uniform(0.85, 1.15) + random.uniform(-0.08, 0.08)).clamp(0, 1)
            if random.random() < 0.3:
                x = (x + torch.randn_like(x) * random.uniform(0.01, 0.05)).clamp(0, 1)

        x = (x - torch.tensor([0.485, 0.456, 0.406])[:, None, None]) / \
            torch.tensor([0.229, 0.224, 0.225])[:, None, None]
        return x, torch.from_numpy(np.asarray(mask, dtype=np.int64))


# ── model ─────────────────────────────────────────────────────────────────────

class Up(nn.Module):
    def __init__(self, in_ch: int, skip_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch + skip_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
        )

    def forward(self, x, skip):
        x = F.interpolate(x, size=skip.shape[-2:], mode="nearest")
        return self.block(torch.cat([x, skip], dim=1))


class UNet(nn.Module):
    """ResNet-18 encoder, plain decoder. Small enough to run on a CPU later."""

    def __init__(self, classes: int, pretrained: bool = True):
        super().__init__()
        net = resnet18(weights=ResNet18_Weights.DEFAULT if pretrained else None)
        self.stem = nn.Sequential(net.conv1, net.bn1, net.relu)   # /2   64
        self.pool = net.maxpool                                    # /4
        self.layer1, self.layer2 = net.layer1, net.layer2          # /4 64, /8 128
        self.layer3, self.layer4 = net.layer3, net.layer4          # /16 256, /32 512
        self.up4 = Up(512, 256, 256)
        self.up3 = Up(256, 128, 128)
        self.up2 = Up(128, 64, 64)
        self.up1 = Up(64, 64, 48)
        self.head = nn.Conv2d(48, classes, 1)

    def forward(self, x):
        size = x.shape[-2:]
        s0 = self.stem(x)
        s1 = self.layer1(self.pool(s0))
        s2 = self.layer2(s1)
        s3 = self.layer3(s2)
        s4 = self.layer4(s3)
        d = self.up4(s4, s3)
        d = self.up3(d, s2)
        d = self.up2(d, s1)
        d = self.up1(d, s0)
        return F.interpolate(self.head(d), size=size, mode="bilinear", align_corners=False)


# ── loss and score ────────────────────────────────────────────────────────────

def dice_loss(logits, target, classes: int, eps: float = 1.0):
    """Cross-entropy alone lets the background win; most of a plan is background."""
    probs = logits.softmax(dim=1)
    hot = F.one_hot(target, classes).permute(0, 3, 1, 2).float()
    dims = (0, 2, 3)
    inter = (probs * hot).sum(dims)
    union = probs.sum(dims) + hot.sum(dims)
    return 1.0 - ((2 * inter + eps) / (union + eps)).mean()


@torch.no_grad()
def mean_iou(model, loader, classes: int, device) -> float:
    inter = torch.zeros(classes, device=device)
    union = torch.zeros(classes, device=device)
    model.eval()
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        pred = model(x).argmax(1)
        for c in range(classes):
            p, t = pred == c, y == c
            inter[c] += (p & t).sum()
            union[c] += (p | t).sum()
    present = union > 0
    return float((inter[present] / union[present]).mean()) if present.any() else 0.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(SEG))
    ap.add_argument("--name", default="rooms")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--no-pretrained", action="store_true")
    args = ap.parse_args()

    data = Path(args.data)
    classes_file = data / "classes.json"
    if not classes_file.exists():
        sys.exit(f"{classes_file} not found — run ml/export_dataset.py first")
    classes = json.loads(classes_file.read_text(encoding="utf-8"))
    n_classes = len(classes)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: no GPU found; this will be extremely slow.")
    train_set = Plans(data / "train", args.size, train=True)
    val_set = Plans(data / "val", args.size, train=False)
    if not len(train_set):
        sys.exit(f"no training pairs in {data / 'train' / 'images'}")
    print(f"train {len(train_set)}  val {len(val_set)}  classes {n_classes}  device {device}")

    train_loader = DataLoader(train_set, batch_size=args.batch, shuffle=True,
                              num_workers=args.workers, pin_memory=True, drop_last=True)
    val_loader = DataLoader(val_set, batch_size=args.batch, shuffle=False,
                            num_workers=args.workers, pin_memory=True)

    model = UNet(n_classes, pretrained=not args.no_pretrained).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=args.lr, total_steps=args.epochs * max(1, len(train_loader)))
    scaler = torch.amp.GradScaler(device, enabled=device == "cuda")

    out = RUNS / args.name
    out.mkdir(parents=True, exist_ok=True)
    (out / "classes.json").write_text(json.dumps(classes, indent=1), encoding="utf-8")
    history, best = [], -1.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        started, total = time.time(), 0.0
        for x, y in train_loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast(device, enabled=device == "cuda"):
                logits = model(x)
                loss = F.cross_entropy(logits, y) + dice_loss(logits, y, n_classes)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            total += float(loss)
        iou = mean_iou(model, val_loader, n_classes, device) if len(val_set) else 0.0
        row = {"epoch": epoch, "loss": round(total / max(1, len(train_loader)), 4),
               "val_miou": round(iou, 4), "seconds": round(time.time() - started, 1)}
        history.append(row)
        print(f"epoch {epoch:3d}  loss {row['loss']:.4f}  val mIoU {row['val_miou']:.4f}"
              f"  {row['seconds']:.0f}s" + ("   <- best" if iou > best else ""))
        if iou > best:
            best = iou
            torch.save({"model": model.state_dict(), "classes": classes,
                        "size": args.size, "val_miou": iou}, out / "best.pt")
        (out / "history.json").write_text(json.dumps(history, indent=1), encoding="utf-8")

    print(f"\nbest validation mIoU {best:.4f}  ->  {out / 'best.pt'}")
    print("next: python ml/export_onnx.py --run", args.name)


if __name__ == "__main__":
    main()
