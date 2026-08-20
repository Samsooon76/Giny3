from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from extractor.entities.export_bone import export_bone
from extractor.entities.render_debug import render_entity_preview
from extractor.maps.export_map import export_map
from extractor.unity_loader import DEFAULT_CLIENT

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "output"
DEFAULT_GODOT_DATA = ROOT / "godot" / "data"


def _sync_godot_data(output: Path, godot_data: Path) -> None:
    if godot_data.exists():
        shutil.rmtree(godot_data)
    shutil.copytree(output, godot_data)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="extractor", description="Dofus 3 → intermediate format")
    p.add_argument("--client", type=Path, default=DEFAULT_CLIENT)
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("bone", help="Extract a bone / entity (Milestone 1-3)")
    b.add_argument("bone_id", type=int)
    b.add_argument("--scale", type=float, default=1.05)
    b.add_argument("--all-anims", action="store_true")
    b.add_argument("--preview", action="store_true", default=True)
    b.add_argument("--no-preview", action="store_false", dest="preview")

    m = sub.add_parser("map", help="Extract one map + used gfx (Milestone 4)")
    m.add_argument("map_id", type=int)

    poc = sub.add_parser("poc", help="Bouftou + map + Godot data (all milestones)")
    poc.add_argument("--bone", type=int, default=563)
    poc.add_argument("--map", type=int, default=154644)
    poc.add_argument("--scale", type=float, default=1.05)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    output: Path = args.output
    output.mkdir(parents=True, exist_ok=True)

    if args.cmd == "bone":
        filt = {"*"} if args.all_anims else None
        dest = export_bone(args.client, args.bone_id, output, scale=args.scale, animation_filter=filt)
        print(f"wrote {dest}")
        if args.preview:
            preview = output / "entities" / f"{args.bone_id}_preview.png"
            render_entity_preview(dest, preview)
            print(f"preview {preview}")
        _sync_godot_data(output, DEFAULT_GODOT_DATA)
        return 0

    if args.cmd == "map":
        dest = export_map(args.client, args.map_id, output)
        print(f"wrote {dest}")
        _sync_godot_data(output, DEFAULT_GODOT_DATA)
        return 0

    if args.cmd == "poc":
        entity = export_bone(args.client, args.bone, output, scale=args.scale)
        print(f"wrote {entity}")
        preview = output / "entities" / f"{args.bone}_preview.png"
        render_entity_preview(entity, preview)
        print(f"preview {preview}")
        # extra previews for walk frame 0
        for anim in ("AnimMarche_1", "AnimStatique_5", "AnimMarche_5"):
            png = output / "entities" / f"{args.bone}_{anim}.png"
            try:
                render_entity_preview(entity, png, animation=anim, frame=0)
                print(f"preview {png}")
            except Exception as exc:
                print(f"skip preview {anim}: {exc}", file=sys.stderr)
        mdest = export_map(args.client, args.map, output)
        print(f"wrote {mdest}")
        manifest = {
            "entity": f"entities/{args.bone}.json",
            "map": f"maps/{args.map}.json",
            "look": "{563|||105}",
            "scale": args.scale,
        }
        (output / "poc.json").write_text(json.dumps(manifest, indent=2))
        _sync_godot_data(output, DEFAULT_GODOT_DATA)
        print(f"synced {DEFAULT_GODOT_DATA}")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
