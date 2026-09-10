"""Name the tiles of a banner-menu screenshot by matching the icon bundle.

The count and shape of a menu entry are readable in the compiled client, but the
25 sprite names are not: they go through its string obfuscation (see
`docs/IL2CPP.md`). They are however plainly visible on screen, and the bundle
that holds every candidate is right here — so a screenshot of the official menu
plus the 3508 files of `icons/` is enough to recover each name mechanically.

The comparison is on **silhouettes, not colours**. A tile paints its sprite
through `itemTile_icon_Vector`, which the official theme may tint flat, so the
colours on screen are not the file's colours — but the shape is untouched. Each
tile crop is reduced to a foreground mask (what differs from the tile's own
background) and scored against each candidate's alpha mask by intersection over
union, maximised over a small scale sweep since the glyph does not fill the tile
edge to edge.

That makes the result checkable rather than a matter of opinion: every tile
comes back with a score and a runner-up, and a thin margin between the two is
the signal to look at that tile by hand.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

#: Files that are not menu candidates: per-instance variants the extractor
#: writes with a hash suffix, and the drop-shadow duplicates of a base glyph.
_NOISE = re.compile(r"_[0-9a-f]{8}_|ShadowOutline")

#: The glyph never fills the tile: USS puts a 24px icon in a 36px tile, and a
#: screenshot may be scaled. Sweeping the occupied fraction covers both.
_SCALES = (0.52, 0.58, 0.64, 0.70, 0.76, 0.82)


@dataclass
class Match:
    tile: int
    name: str
    score: float
    runner_up: str
    runner_up_score: float

    @property
    def margin(self) -> float:
        return self.score - self.runner_up_score

    @property
    def confident(self) -> bool:
        """A clear win: a decent absolute overlap and daylight behind it."""
        return self.score >= 0.55 and self.margin >= 0.06


def tile_boxes(width: int, height: int, cols: int, rows: int) -> list[tuple[int, int, int, int]]:
    """Split a cropped grid image into `cols * rows` equal cells."""
    cell_w, cell_h = width / cols, height / rows
    return [
        (round(c * cell_w), round(r * cell_h), round((c + 1) * cell_w), round((r + 1) * cell_h))
        for r in range(rows)
        for c in range(cols)
    ]


def foreground_mask(tile: Image.Image, size: int = 48) -> list[bool]:
    """What stands out from the tile's own background.

    The background is taken from the border ring rather than assumed: a tile is
    a rounded slot whose fill differs between the grid's alternating rows, and
    an opened tile is drawn pressed."""
    small = tile.convert("RGB").resize((size, size), Image.LANCZOS)
    px = small.load()
    ring = [px[x, y] for x in range(size) for y in range(size)
            if x < 3 or y < 3 or x >= size - 3 or y >= size - 3]
    br = sum(p[0] for p in ring) // len(ring)
    bg_g = sum(p[1] for p in ring) // len(ring)
    bb = sum(p[2] for p in ring) // len(ring)
    out = []
    for y in range(size):
        for x in range(size):
            r, g, b = px[x, y]
            out.append(abs(r - br) + abs(g - bg_g) + abs(b - bb) > 60)
    return out


def sprite_mask(path: Path, size: int, scale: float) -> list[bool]:
    """A candidate's alpha, placed in the middle of a `size` box at `scale`."""
    inner = max(4, round(size * scale))
    alpha = Image.open(path).convert("RGBA").split()[3].resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("L", (size, size), 0)
    canvas.paste(alpha, ((size - inner) // 2, (size - inner) // 2))
    return [v > 110 for v in canvas.getdata()]


def iou(a: list[bool], b: list[bool]) -> float:
    inter = union = 0
    for x, y in zip(a, b):
        if x or y:
            union += 1
            if x and y:
                inter += 1
    return inter / union if union else 0.0


def candidates(icons_dir: Path) -> list[Path]:
    return sorted(p for p in icons_dir.glob("*.png") if not _NOISE.search(p.name))


def match_grid(
    screenshot: Path,
    icons_dir: Path,
    cols: int,
    rows: int,
    crop: tuple[int, int, int, int] | None = None,
    size: int = 48,
) -> list[Match]:
    """Name every tile of the grid in `screenshot`.

    `crop` is the grid's bounding box inside the screenshot, tile row 0 column 0
    at its top-left corner; without it the whole image is taken as the grid."""
    image = Image.open(screenshot).convert("RGB")
    if crop:
        image = image.crop(crop)
    pool = candidates(icons_dir)
    if not pool:
        raise LookupError(f"no icon candidate in {icons_dir}")
    masks = {path: [sprite_mask(path, size, s) for s in _SCALES] for path in pool}
    out: list[Match] = []
    for index, box in enumerate(tile_boxes(image.width, image.height, cols, rows)):
        target = foreground_mask(image.crop(box), size)
        if sum(target) < size * size * 0.01:
            continue  # tuile vide
        ranked = sorted(
            ((max(iou(target, m) for m in variants), path.stem) for path, variants in masks.items()),
            reverse=True,
        )
        (best, name), (second, other) = ranked[0], ranked[1]
        out.append(Match(index, name, round(best, 4), other, round(second, 4)))
    return out


def format_matches(matches: list[Match]) -> str:
    """One line per tile: index, name, score, runner-up, margin, confidence."""
    lines = ["tile  name                      score  runner-up                 runner  margin  ok"]
    for item in matches:
        lines.append(
            f"{item.tile:<4d}  {item.name:<24s}  {item.score:5.3f}  "
            f"{item.runner_up:<24s}  {item.runner_up_score:5.3f}  "
            f"{item.margin:6.3f}  {'yes' if item.confident else 'no'}"
        )
    return "\n".join(lines)
