#!/usr/bin/env python3
"""Slice a generated character sheet (transparent PNG, rows x cols grid) into trimmed mascot PNGs.

usage: slice_cast.py SHEET.png OUT_DIR --grid 4x2 --names a,b,c,... [--height 256] [--alpha-floor 24]
Run with: uv run --with pillow --with numpy python slice_cast.py ...
"""
import argparse, os
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("sheet"); ap.add_argument("out")
ap.add_argument("--grid", default="4x2", help="COLSxROWS")
ap.add_argument("--names", required=True, help="comma list, row-major")
ap.add_argument("--height", type=int, default=256, help="output height in px")
ap.add_argument("--alpha-floor", type=int, default=24, help="alpha below this becomes 0 (kills halos)")
a = ap.parse_args()

cols, rows = (int(v) for v in a.grid.lower().split("x"))
names = [n.strip() for n in a.names.split(",")]
img = Image.open(a.sheet).convert("RGBA")
W, H = img.size
cw, ch = W / cols, H / rows
os.makedirs(a.out, exist_ok=True)
for i, name in enumerate(names):
    r, c = divmod(i, cols)
    cell = img.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
    px = np.array(cell)
    alpha = px[:, :, 3]
    alpha[alpha < a.alpha_floor] = 0
    px[:, :, 3] = alpha
    cell = Image.fromarray(px)
    # trim to the solid body (alpha > 128) plus a small pad, so faint floor glows don't inflate the box
    ys, xs = np.where(alpha > 128)
    if len(xs) == 0:
        raise SystemExit(f"empty cell for {name}")
    pad = 6
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, cell.width), min(ys.max() + pad, cell.height))
    cell = cell.crop(box)
    scale = a.height / cell.height
    cell = cell.resize((max(1, round(cell.width * scale)), a.height), Image.LANCZOS)
    path = os.path.join(a.out, f"{name}.png")
    cell.save(path, optimize=True)
    print(f"{name}: {cell.width}x{cell.height} -> {path}")
