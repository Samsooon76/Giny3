from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from extractor.entities.export_bone import export_bone
from extractor.entities.render_debug import render_entity_preview
from extractor.maps.export_map import export_map
from extractor.unity_loader import DEFAULT_CLIENT

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "output"


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

    poc = sub.add_parser("poc", help="Extract Bouftou + map + CPU previews")
    poc.add_argument("--bone", type=int, default=563)
    poc.add_argument("--map", type=int, default=154644)
    poc.add_argument("--scale", type=float, default=1.05)

    menu = sub.add_parser("menu", help="Write menuActions.json and figmaIcons.json")
    menu.add_argument(
        "ui_root",
        type=Path,
        nargs="?",
        default=ROOT / ".cache" / "dofus3" / "ui" / "current",
        help="Directory that already holds the extracted UI tables",
    )

    tiles = sub.add_parser(
        "tiles",
        help="Name banner-menu tiles by matching a screenshot against icons/",
    )
    tiles.add_argument("screenshot", type=Path)
    tiles.add_argument(
        "--icons",
        type=Path,
        default=ROOT / ".cache" / "dofus3" / "ui" / "current" / "icons",
    )
    tiles.add_argument("--cols", type=int, required=True)
    tiles.add_argument("--rows", type=int, required=True)
    tiles.add_argument(
        "--crop",
        type=int,
        nargs=4,
        metavar=("L", "T", "R", "B"),
        help="Grid bounding box inside the screenshot (left top right bottom)",
    )

    sym = sub.add_parser(
        "symbols",
        help="Write monoScripts.json and linkTypes.json (real class names the build ships)",
    )
    sym.add_argument(
        "dest",
        type=Path,
        nargs="?",
        default=DEFAULT_OUTPUT / "symbols",
        help="Directory for the name tables (default: output/symbols)",
    )

    i18n = sub.add_parser("i18n", help="Write i18n.json.gz from I18n/{lang}.bin")
    i18n.add_argument("--lang", default="fr")
    i18n.add_argument(
        "dest",
        type=Path,
        nargs="?",
        default=DEFAULT_OUTPUT / "client",
        help="Directory for i18n.json.gz (default: output/client)",
    )

    look = sub.add_parser("look", help="Compose a {bone|skins|…} look (bone + overlay skins)")
    look.add_argument("look")
    look.add_argument("--scale", type=float, default=1.05)

    sub.add_parser("boneindex", help="Extract boneindex from bones_assets_boneindexdata.bundle")
    sub.add_parser("worldmaps", help="Extract worldmap tiles from worldmap_assets_.bundle")
    sub.add_parser("overlays", help="Extract the world overlay sprites (map-change arrow)")
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
        return 0

    if args.cmd == "map":
        dest = export_map(args.client, args.map_id, output)
        print(f"wrote {dest}")
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
        return 0

    if args.cmd == "menu":
        from extractor.ui.menu import write_figma_icons, write_menu_actions

        ui_root: Path = args.ui_root
        ui_root.mkdir(parents=True, exist_ok=True)
        actions = write_menu_actions(ui_root, args.client)
        icons = write_figma_icons(ui_root, args.client)
        print(f"wrote {actions}")
        print(f"wrote {icons}")
        return 0

    if args.cmd == "symbols":
        from extractor.symbols import linker, monoscripts

        dest: Path = args.dest
        scripts = monoscripts.write_monoscripts(dest, args.client)
        types = linker.write_link_types(dest, args.client)
        print(monoscripts.format_summary(json.loads(scripts.read_text())))
        print(linker.format_summary(json.loads(types.read_text())))
        print(f"wrote {scripts}")
        print(f"wrote {types}")
        return 0

    if args.cmd == "tiles":
        from extractor.ui.match_tiles import format_matches, match_grid

        crop = (args.crop[0], args.crop[1], args.crop[2], args.crop[3]) if args.crop else None
        matches = match_grid(
            args.screenshot,
            args.icons,
            cols=args.cols,
            rows=args.rows,
            crop=crop,
        )
        print(format_matches(matches))
        return 0

    if args.cmd == "i18n":
        from extractor.i18n import write_i18n

        dest = write_i18n(args.dest, args.client, args.lang)
        print(f"wrote {dest}")
        return 0

    if args.cmd == "look":
        from extractor.entities.export_look import export_look

        dest = export_look(args.client, args.look, output, scale=args.scale)
        print(dest)
        return 0

    if args.cmd == "boneindex":
        from extractor.entities.export_boneindex import export_boneindex

        dest = export_boneindex(args.client, output)
        print(f"wrote {dest}")
        return 0

    if args.cmd == "worldmaps":
        from extractor.maps.export_worldmap import export_worldmaps

        dest = export_worldmaps(args.client, output)
        print(f"wrote {dest}")
        return 0

    if args.cmd == "overlays":
        from extractor.maps.export_overlays import export_overlays

        dest = export_overlays(args.client, output)
        print(f"wrote {dest}")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
