#!/usr/bin/env python3
"""AI-facing client UX tool: export, edit, and inject ActionScript classes."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "scripts/patches/manifest.json"
FFDEC_DIR = Path(os.environ.get("FFDEC_DIR", "/Applications/FFDec.app/Contents/Resources"))
FFDEC = FFDEC_DIR / "ffdec.sh"


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def resolve(rel: str) -> Path:
    return ROOT / rel


def classes(manifest: dict, only: list[str] | None = None) -> list[dict]:
    items = manifest["classes"]
    if not only:
        return items
    wanted = {name.lower() for name in only}
    found = []
    for item in items:
        aliases = {item["id"].lower(), item["fqcn"].lower(), item["fqcn"].rsplit(".", 1)[-1].lower()}
        if wanted & aliases:
            found.append(item)
    if len(found) != len(only):
        known = ", ".join(item["id"] for item in items)
        raise SystemExit(f"unknown class. known: {known}")
    return found


def as_relpath(fqcn: str) -> Path:
    return Path("scripts") / Path(*fqcn.split(".")).with_suffix(".as")


def src_path(manifest: dict, item: dict) -> Path:
    if item.get("existing_src"):
        return resolve(item["existing_src"])
    return resolve(manifest["src_dir"]) / f"{item['id']}.as"


def vanilla_path(manifest: dict, item: dict) -> Path:
    return resolve(manifest["vanilla_dir"]) / f"{item['id']}.as"


def ffdec_env(home: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["JAVA_TOOL_OPTIONS"] = f"-Djava.awt.headless=true -Duser.home={home}"
    env["FFDEC_MEMORY"] = env.get("FFDEC_MEMORY", "4096m")
    env["FFDEC_JARFILENAME"] = "ffdec-cli.jar"
    return env


def run_ffdec(args: list[str], home: Path) -> None:
    if not FFDEC.is_file() or not os.access(FFDEC, os.X_OK):
        raise SystemExit(f"FFDec introuvable: {FFDEC}")
    subprocess.run(
        [str(FFDEC), *args],
        check=True,
        env=ffdec_env(home),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def export_classes(manifest: dict, items: list[dict], swf: Path) -> dict[str, Path]:
    resolve(manifest["vanilla_dir"]).mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        select = ",".join(item["fqcn"] for item in items)
        run_ffdec(
            ["-selectclass", select, "-format", "script:as", "-export", "script", str(tmp_path / "export"), str(swf)],
            tmp_path,
        )
        exported = {}
        for item in items:
            src = tmp_path / "export" / as_relpath(item["fqcn"])
            if not src.is_file():
                matches = list((tmp_path / "export").rglob(f"{item['id']}.as"))
                if not matches:
                    raise SystemExit(f"FFDec n'a pas exporté {item['fqcn']}")
                src = matches[0]
            dest = vanilla_path(manifest, item)
            dest.write_bytes(src.read_bytes())
            exported[item["id"]] = dest
        return exported


def apply_snapshot_transforms(item: dict, text: str) -> str:
    ident = item["id"]
    if ident == "AuthentificationFrame":
        return text.replace("if(!validHosts)", "if(false)", 1)
    if ident == "AuthentificationManager":
        import re

        text = re.sub(
            r"private function cipherRsa\(login:String, pwd:String, certificate:TrustCertificate\) : Vector\.<int>.*?\n      private function generateRandomAESKey",
            "private function cipherRsa(login:String, pwd:String, certificate:TrustCertificate) : Vector.<int>\n"
            "      {\n"
            "         var input:ByteArray = new ByteArray();\n"
            "         input.writeUTF(login);\n"
            "         input.writeUTF(pwd);\n"
            "         input.writeBytes(this._AESKey,0,32);\n"
            "         var result:Vector.<int> = new Vector.<int>();\n"
            "         input.position = 0;\n"
            "         while(input.bytesAvailable != 0)\n"
            "         {\n"
            "            result.push(input.readByte());\n"
            "         }\n"
            "         return result;\n"
            "      }\n"
            "      private function generateRandomAESKey",
            text,
            count=1,
            flags=re.S,
        )
        text = re.sub(
            r"public function setPublicKey\(publicKey:Vector\.<int>\) : void.*?\n      public function setValidationAction",
            "public function setPublicKey(publicKey:Vector.<int>) : void\n"
            "      {\n"
            "         this._publicKey = \"\";\n"
            "      }\n"
            "      \n"
            "      public function setValidationAction",
            text,
            count=1,
            flags=re.S,
        )
        return text
    if ident == "Chat":
        import re

        text = re.sub(
            r"(public function onTextInformation\(content:String = \"\", channel:int = 0, timestamp:Number = 0, saveMsg:Boolean = true, forceDisplay:Boolean = false\) : void\s*\{)",
            r"\1\n         if(content.indexOf(\"[POKEFUS_STATE]\") == 0 || content.indexOf(\"[GUILD_CAMP_STATE]\") == 0)\n"
            r"         {\n            return;\n         }",
            text,
            count=1,
        )
        return text
    return text


def run_perl_pipeline(item: dict, source: str) -> str:
    scripts = item.get("perl") or []
    if not scripts:
        return source
    text = source
    extra = [str(resolve(arg)) if arg.endswith(".json") else arg for arg in item.get("perl_args") or []]
    for script in scripts:
        proc = subprocess.run(
            ["perl", str(resolve(script)), *extra],
            input=text,
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            raise SystemExit(f"perl {script} failed:\n{proc.stderr}")
        text = proc.stdout
    return text


def write_src(manifest: dict, item: dict, text: str) -> Path:
    dest = src_path(manifest, item)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    return dest


def replace_class(swf_in: Path, swf_out: Path, item: dict, as_file: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        run_ffdec(
            ["-air", "-replace", str(swf_in), str(swf_out), item["fqcn"], str(as_file)],
            Path(tmp),
        )
    if not swf_out.is_file():
        raise SystemExit(f"FFDec replace failed for {item['id']}")


def cmd_list(_args: argparse.Namespace) -> int:
    manifest = load_manifest()
    for item in manifest["classes"]:
        src = src_path(manifest, item)
        flag = "src" if src.is_file() else "—"
        state = ",".join(item.get("state") or [])
        print(f"{item['id']:32} {flag:3}  {item['screen']}")
        print(f"{'':32}      {item['fqcn']}")
        if state:
            print(f"{'':32}      state {state}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    manifest = load_manifest()
    items = classes(manifest, args.names or None)
    swf = resolve(manifest["swf_original"])
    if not swf.is_file():
        swf = resolve(manifest["swf"])
    exported = export_classes(manifest, items, swf)
    for ident, path in exported.items():
        print(f"OK  {ident} -> {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")
    return 0


def cmd_snapshot(args: argparse.Namespace) -> int:
    manifest = load_manifest()
    items = classes(manifest, args.names or None)
    swf = resolve(manifest["swf_original"])
    if not swf.is_file():
        raise SystemExit(f"missing {swf}")
    export_classes(manifest, items, swf)
    resolve(manifest["src_dir"]).mkdir(parents=True, exist_ok=True)
    for item in items:
        vanilla = vanilla_path(manifest, item).read_text(encoding="utf-8")
        if item.get("existing_src"):
            src = resolve(item["existing_src"])
            print(f"OK  {item['id']:32} keep {src.relative_to(ROOT)}")
            continue
        text = apply_snapshot_transforms(item, vanilla)
        text = run_perl_pipeline(item, text)
        dest = write_src(manifest, item, text)
        print(f"OK  {item['id']:32} {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    manifest = load_manifest()
    item = classes(manifest, [args.name])[0]
    src = src_path(manifest, item)
    vanilla = vanilla_path(manifest, item)
    print(f"id       {item['id']}")
    print(f"fqcn     {item['fqcn']}")
    print(f"screen   {item['screen']}")
    print(f"why      {item['why']}")
    print(f"src      {src} {'OK' if src.is_file() else 'MISSING'}")
    print(f"vanilla  {vanilla} {'OK' if vanilla.is_file() else 'MISSING'}")
    if item.get("state"):
        print(f"state    {', '.join(item['state'])}")
    target = src if src.is_file() else vanilla
    if target.is_file():
        print(f"lines    {sum(1 for _ in target.open(encoding='utf-8', errors='replace'))}")
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    manifest = load_manifest()
    items = classes(manifest, [args.name] if args.name else None)
    needle = args.pattern
    hits = 0
    for item in items:
        path = src_path(manifest, item)
        if not path.is_file():
            path = vanilla_path(manifest, item)
        if not path.is_file():
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if needle.lower() in line.lower():
                print(f"{item['id']}:{number}:{line.rstrip()}")
                hits += 1
                if hits >= args.limit:
                    return 0
    return 0 if hits else 1


def cmd_apply(args: argparse.Namespace) -> int:
    manifest = load_manifest()
    items = classes(manifest, args.names)
    live = resolve(manifest["swf"])
    if not live.is_file():
        raise SystemExit(f"missing {live}")
    current = live
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for index, item in enumerate(items):
            src = src_path(manifest, item)
            if not src.is_file():
                raise SystemExit(f"missing src for {item['id']}: run snapshot first ({src})")
            out = tmp_path / f"step-{index}.swf"
            print(f"replace {item['fqcn']} <- {src.relative_to(ROOT)}")
            replace_class(current, out, item, src)
            current = out
        shutil.copyfile(current, live)
    print(f"applied {len(items)} class(es) -> {live.relative_to(ROOT)}")
    return 0


def cmd_rebuild(_args: argparse.Namespace) -> int:
    manifest = load_manifest()
    original = resolve(manifest["swf_original"])
    live = resolve(manifest["swf"])
    if not original.is_file():
        raise SystemExit(f"missing {original}")
    missing = [item["id"] for item in manifest["classes"] if not src_path(manifest, item).is_file()]
    if missing:
        raise SystemExit("missing src: " + ", ".join(missing) + " (run: python3 scripts/ux.py snapshot)")
    current = original
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for index, item in enumerate(manifest["classes"]):
            src = src_path(manifest, item)
            out = tmp_path / f"step-{index}.swf"
            print(f"replace {item['id']}")
            replace_class(current, out, item, src)
            current = out
        shutil.copyfile(current, live)
    print(f"rebuilt {live.relative_to(ROOT)} from original + src/")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Show UX classes the project already patches").set_defaults(func=cmd_list)

    export = sub.add_parser("export", help="Export vanilla AS from the original SWF")
    export.add_argument("names", nargs="*", help="Class ids (default: all)")
    export.set_defaults(func=cmd_export)

    snap = sub.add_parser("snapshot", help="Export vanilla and materialize editable src/*.as")
    snap.add_argument("names", nargs="*", help="Class ids (default: all)")
    snap.set_defaults(func=cmd_snapshot)

    show = sub.add_parser("show", help="Paths and role of one class")
    show.add_argument("name")
    show.set_defaults(func=cmd_show)

    search = sub.add_parser("search", help="Search src (fallback vanilla) ActionScript")
    search.add_argument("pattern")
    search.add_argument("name", nargs="?", help="Optional class id")
    search.add_argument("--limit", type=int, default=50)
    search.set_defaults(func=cmd_search)

    apply = sub.add_parser("apply", help="Inject src AS into the live SWF")
    apply.add_argument("names", nargs="+", help="Class ids")
    apply.set_defaults(func=cmd_apply)

    sub.add_parser("rebuild", help="Rebuild live SWF from original + every src class").set_defaults(func=cmd_rebuild)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
