#!/usr/bin/env python3
"""Prepare neighbourhood atlases in bounded batches, preserving unchanged batches."""
import argparse, hashlib, importlib.util, json, shutil, zlib
from pathlib import Path
from types import SimpleNamespace
spec = importlib.util.spec_from_file_location("assets", Path(__file__).with_name("prepare-assets.py"))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
def output_fingerprint(output, batch):
    """Fingerprint the published batch and its pages, not unrelated batches."""
    try:
        manifest = json.loads((output / "optimized/manifest.json").read_bytes())
        signature = hashlib.sha256()
        files = set()
        for mid in batch:
            entry = manifest["maps"][mid]
            path = a.source_file([output], entry["path"])
            if path is None: return None
            doc = a.read_doc(path)
            if str(doc["id"]) != mid: return None
            if hashlib.sha256(a.compact(doc)).hexdigest() != entry["hash"]: return None
            signature.update(a.compact(entry))
            files.add(path)
            for gfx in doc["gfx"].values():
                for key in ("texture", "bc7_texture"):
                    relative = gfx.get(key)
                    if relative and relative.startswith("optimized/pages/"):
                        page = output / relative
                        if not page.is_file(): return None
                        files.add(page)
        for path in sorted(files):
            signature.update(str(path.relative_to(output)).encode())
            with path.open("rb") as stream:
                while chunk := stream.read(1024 * 1024): signature.update(chunk)
        return signature.hexdigest()
    except (OSError, EOFError, zlib.error, ValueError, KeyError, TypeError):
        return None

BASE = Path(__file__).resolve().parents[2] / "dofus3/.cache/dofus3"

def main(args):
    source, output = args.source.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    ids = sorted(args.maps.split(",") if args.maps else json.loads((source / "inventory.json").read_bytes())["maps"], key=int)
    checkpoint = output / "atlas-batches.json"
    done = json.loads(checkpoint.read_bytes()) if checkpoint.exists() else {}
    for offset in range(0, len(ids), args.batch_size):
        batch = ids[offset:offset + args.batch_size]
        signature = hashlib.sha256(b"giny.world-atlases.v2")
        signature.update(Path(__file__).read_bytes())
        signature.update(Path(a.__file__).read_bytes())
        dependencies = set()
        for mid in batch:
            path = a.source_file([source], f"maps/{mid}.json")
            if not path: raise FileNotFoundError(f"Map {mid}")
            signature.update(path.read_bytes())
            doc = a.read_doc(path)
            for gid in a.eligible(doc):
                gfx = doc["gfx"].get(gid)
                if gfx: dependencies.add(gfx["texture"])
        for name in sorted(dependencies):
            path = a.source_file([source], name)
            if not path: raise FileNotFoundError(name)
            signature.update(name.encode())
            signature.update(str((path.stat().st_size, path.stat().st_mtime_ns)).encode())
        key = ",".join(batch)
        digest = signature.hexdigest()
        previous = done.get(key)
        if isinstance(previous, dict) and previous.get("source") == digest:
            fingerprint = output_fingerprint(output, batch)
            if fingerprint is not None and previous.get("output") == fingerprint:
                print(f"verified {offset + len(batch)}/{len(ids)} maps (cached)", flush=True)
                continue
        if shutil.disk_usage(output).free < 4 * 1024**3: raise RuntimeError("Less than 4 GiB disk reserve")
        a.prepare(SimpleNamespace(source=str(source), output=str(output), maps=key, bc7=True, extract=False))
        fingerprint = output_fingerprint(output, batch)
        if fingerprint is None: raise RuntimeError(f"Incomplete atlas batch: {key}")
        done[key] = {"source": digest, "output": fingerprint}
        a.atomic(checkpoint, a.compact(done))
        print(f"verified {offset + len(batch)}/{len(ids)} maps", flush=True)
    print(json.dumps({"maps": len(ids), "batches": len(done), "output": str(output)}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=BASE / "world")
    parser.add_argument("--output", type=Path, default=BASE / "world-atlases")
    parser.add_argument("--maps")
    parser.add_argument("--batch-size", type=int, choices=range(1, 129), default=32)
    main(parser.parse_args())
