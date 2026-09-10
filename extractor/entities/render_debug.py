"""CPU textured-mesh preview. Used to verify extraction without launching the client."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image


def _apply_affine(x: np.ndarray, y: np.ndarray, tr: list[float]) -> tuple[np.ndarray, np.ndarray]:
    a, b, tx, c, d, ty = tr
    return a * x + b * y + tx, c * x + d * y + ty


def _compose(parent: list[float], local: list[float]) -> list[float]:
    a0, b0, tx0, c0, d0, ty0 = parent
    a1, b1, tx1, c1, d1, ty1 = local
    return [
        a0 * a1 + b0 * c1,
        a0 * b1 + b0 * d1,
        a0 * tx1 + b0 * ty1 + tx0,
        c0 * a1 + d0 * c1,
        c0 * b1 + d0 * d1,
        c0 * tx1 + d0 * ty1 + ty0,
    ]


def _raster_triangle(buf: np.ndarray, z: np.ndarray, pts, uvs, tex: np.ndarray) -> None:
    (x0, y0), (x1, y1), (x2, y2) = pts
    minx = max(int(np.floor(min(x0, x1, x2))), 0)
    miny = max(int(np.floor(min(y0, y1, y2))), 0)
    maxx = min(int(np.ceil(max(x0, x1, x2))), buf.shape[1] - 1)
    maxy = min(int(np.ceil(max(y0, y1, y2))), buf.shape[0] - 1)
    if maxx < minx or maxy < miny:
        return
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-6:
        return
    th, tw = tex.shape[0], tex.shape[1]
    for y in range(miny, maxy + 1):
        py = y + 0.5
        for x in range(minx, maxx + 1):
            px = x + 0.5
            w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area
            w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area
            w2 = 1.0 - w0 - w1
            if w0 < 0 or w1 < 0 or w2 < 0:
                continue
            u = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0]
            v = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1]
            tx = min(max(int(u * tw), 0), tw - 1)
            # Unity UV v=0 is bottom; numpy row 0 is top.
            ty = min(max(int((1.0 - v) * th), 0), th - 1)
            pixel = tex[ty, tx]
            if pixel[3] < 8:
                continue
            depth = y
            if depth <= z[y, x]:
                continue
            src_a = pixel[3] / 255.0
            dst = buf[y, x].astype(np.float32)
            out = pixel.astype(np.float32) * src_a + dst * (1.0 - src_a)
            out[3] = min(255.0, dst[3] + pixel[3] * (1.0 - dst[3] / 255.0))
            buf[y, x] = out.astype(np.uint8)
            z[y, x] = depth


def render_entity_preview(
    entity_json: Path,
    output_png: Path,
    animation: str = "AnimStatique_1",
    frame: int = 0,
    padding: int = 16,
) -> Path:
    doc = json.loads(entity_json.read_text())
    tex_path = entity_json.parent.parent / doc["texture"]
    tex = np.array(Image.open(tex_path).convert("RGBA"))

    frames = doc["animations"][animation]["frames"]
    nodes = frames[frame]
    # Hypothesis: node 0 (tag 0x17) is NOT a parent of the other nodes.
    # Official AnimStatique_1 bounds match the uncomposed local transforms
    # (y ≈ -16.6..43.7 vs recorded -16.75..42.3). See docs/HYPOTHESES.md.

    draw_items = []
    for node in nodes:
        # v2 documents carry the resolved SkinAsset part name in part_ref
        # (animation graphic ids are 0-based indices into aod.graphics);
        # fall back to the raw graphic id for v1 documents.
        graphic = node.get("part_ref", node.get("graphic"))
        tr = node.get("transform")
        if graphic is None or tr is None:
            continue
        part = doc["parts"].get(str(graphic))
        if part is None:
            continue
        draw_items.append((node["node"], tr, part))

    # First pass: bounds.
    xs: list[float] = []
    ys: list[float] = []
    prepared = []
    for order, world, part in draw_items:
        for chunk in part["chunks"]:
            vx = np.array([v["x"] for v in chunk["vertices"]], dtype=np.float32)
            vy = np.array([v["y"] for v in chunk["vertices"]], dtype=np.float32)
            wx, wy = _apply_affine(vx, vy, world)
            uu = [(v["u"], v["v"]) for v in chunk["vertices"]]
            idx = chunk["indices"]
            prepared.append((order, wx, wy, uu, idx))
            xs.extend(wx.tolist())
            ys.extend(wy.tolist())

    if not xs:
        Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(output_png)
        return output_png

    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    width = int(np.ceil(maxx - minx)) + padding * 2
    height = int(np.ceil(maxy - miny)) + padding * 2
    buf = np.zeros((height, width, 4), dtype=np.uint8)
    z = np.full((height, width), -1e9, dtype=np.float32)

    for _order, wx, wy, uu, idx in prepared:
        px = wx - minx + padding
        # Flip Y so the PNG matches a Y-up world (Unity).
        py = (maxy - wy) + padding
        for i in range(0, len(idx), 3):
            i0, i1, i2 = idx[i], idx[i + 1], idx[i + 2]
            pts = [(px[i0], py[i0]), (px[i1], py[i1]), (px[i2], py[i2])]
            uvs = [uu[i0], uu[i1], uu[i2]]
            _raster_triangle(buf, z, pts, uvs, tex)

    output_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(buf, "RGBA").save(output_png)
    return output_png
