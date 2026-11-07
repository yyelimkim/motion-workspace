#!/usr/bin/env python3
"""Study a reference video's motion: frames, contact sheets, speed, cuts, curves.

    python3 tools/analyze-reference.py references/ref.mov [out_dir]

Writes to out_dir (default: references/<name>-analysis/):
  frames/            every frame, small (for close looks)
  sheet-N.jpg        contact sheets, labelled with frame number and time
  speed.txt          per-frame motion speed (mean pixel change), as a bar chart
  shots.txt          detected cuts; for each shot: when its speed peaks, its
                     progress at 25/50/75% of its time, and the cubic-bezier
                     that best fits it (paste into a clip's transition)

Screen recordings often repeat frames (e.g. 24 fps content at 60): speed is
measured between distinct frames only, so repeats don't read as stops.
Needs opencv-python and numpy.
"""
import sys, os
from pathlib import Path
import numpy as np
import cv2


def bez(x1, y1, x2, y2, xs):
    t = np.linspace(0, 1, 2001)
    bx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3
    by = 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3
    return np.interp(xs, bx, by)


def fit_bezier(u, p):
    """Best cubic-bezier(x1, y1, x2, y2) through a progress curve (coarse then fine)."""
    best = (1e9, None)
    for x1 in np.arange(0.0, 1.0001, 0.05):
        for y1 in (-0.1, 0.0, 0.2, 0.5):
            for x2 in np.arange(0.0, 1.0001, 0.05):
                for y2 in (0.5, 0.8, 1.0, 1.1):
                    e = np.abs(bez(x1, y1, x2, y2, u) - p).max()
                    if e < best[0]:
                        best = (e, (x1, y1, x2, y2))
    x1, y1, x2, y2 = best[1]
    for _ in range(2):
        for d in (0.02, 0.01):
            for dx1 in (-d, 0, d):
                for dy1 in (-d, 0, d):
                    for dx2 in (-d, 0, d):
                        for dy2 in (-d, 0, d):
                            c = (min(1, max(0, x1 + dx1)), y1 + dy1, min(1, max(0, x2 + dx2)), y2 + dy2)
                            e = np.abs(bez(*c, u) - p).max()
                            if e < best[0]:
                                best = (e, c)
                                x1, y1, x2, y2 = c
    return best


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.parent / f"{src.stem}-analysis"
    (out / "frames").mkdir(parents=True, exist_ok=True)
    v = cv2.VideoCapture(str(src))
    fps = v.get(cv2.CAP_PROP_FPS) or 30
    small, gray = [], []
    while True:
        ok, f = v.read()
        if not ok:
            break
        h, w = f.shape[:2]
        s = cv2.resize(f, (544, int(544 * h / w)))
        cv2.imwrite(str(out / "frames" / f"f{len(small):04d}.jpg"), s)
        small.append(s)
        gray.append(cv2.cvtColor(cv2.resize(f, (272, int(272 * h / w))), cv2.COLOR_BGR2GRAY).astype(np.float32))
    n = len(small)
    print(f"{src.name}: {n} frames at {fps:.2f} fps ({n / fps:.2f}s)")

    # contact sheets: 24 frames each, labelled
    step = max(1, n // 72)
    idx = list(range(0, n, step))
    for k in range(0, len(idx), 24):
        tiles = []
        for i in idx[k:k + 24]:
            a = cv2.resize(small[i], (360, int(360 * small[i].shape[0] / small[i].shape[1])))
            cv2.putText(a, f"{i} {i / fps:.2f}s", (6, 20), 0, 0.55, (0, 0, 255), 2)
            tiles.append(a)
        while len(tiles) % 4:
            tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[r:r + 4]) for r in range(0, len(tiles), 4)]
        cv2.imwrite(str(out / f"sheet-{k // 24 + 1}.jpg"), np.vstack(rows))

    # speed between distinct frames (repeated frames skipped)
    uniq = [0]
    for i in range(1, n):
        if np.abs(gray[i] - gray[uniq[-1]]).mean() > 0.3:
            uniq.append(i)
    jump = {uniq[k]: float(np.abs(gray[uniq[k]] - gray[uniq[k - 1]]).mean()) for k in range(1, len(uniq))}
    speed = [(uniq[k], jump[uniq[k]] / (uniq[k] - uniq[k - 1])) for k in range(1, len(uniq))]
    # a cut: one jump between distinct frames far above the usual motion
    # (measured on the raw jump, so repeated frames don't dilute it)
    med = np.median(list(jump.values())) if jump else 0
    cut_level = max(35.0, med * 6)
    with open(out / "speed.txt", "w") as fh:
        for i, s in speed:
            fh.write(f"{i:4d} {i / fps:6.2f}s {s:7.2f} {'#' * int(min(s, 60))}{'  <- cut' if jump[i] > cut_level else ''}\n")

    # shots between cuts, each with its curve
    cuts = [i for i, _ in speed if jump[i] > cut_level]
    bounds = [0] + cuts + [n]
    with open(out / "shots.txt", "w") as fh:
        fh.write(f"cuts at: {', '.join(f'{c / fps:.2f}s' for c in cuts) or 'none'}\n\n")
        for a, b in zip(bounds, bounds[1:]):
            seg = [(i, s) for i, s in speed if a < i < b]
            tot = sum(s for _, s in seg)
            if len(seg) < 4 or tot < 1:
                continue
            u = np.array([(i - a) / (b - a) for i, _ in seg])
            p = np.cumsum([s for _, s in seg]) / tot
            peak = max(seg, key=lambda x: x[1])
            err, c = fit_bezier(u, p)
            at = [round(float(np.interp(x, u, p)), 2) for x in (0.25, 0.5, 0.75)]
            fh.write(f"shot {a / fps:.2f}–{b / fps:.2f}s ({(b - a) / fps:.2f}s): speed peaks at {(peak[0] - a) / (b - a):.2f} of the shot; "
                     f"progress at 25/50/75% = {at}; best fit cubic-bezier({', '.join(f'{x:.2f}' for x in c)}) (max error {err:.3f})\n")
    print(f"wrote {out}/ (sheets, speed.txt, shots.txt)")
    print(open(out / "shots.txt").read())


if __name__ == "__main__":
    main()
