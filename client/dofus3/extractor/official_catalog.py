"""Versioned local DataRoot -> SQL archive -> client JSON pipeline.

The archive is deliberately separate from Giny's runtime schema: a Unity
catalogue is not an implementation of the official server's mechanics.
No game/player table is updated by this command.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone


FORMAT = "giny.official-catalog.v1"


def canonical(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(value) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def read_json(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as stream:
        return json.load(stream)


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = canonical(value)
    path.write_bytes(gzip.compress(payload, mtime=0) if path.suffix == ".gz" else payload)


def unresolved_refs(value, at=""):
    if isinstance(value, dict):
        if set(value) == {"rid"} and value["rid"] not in (-2, -1, 0):
            yield {"path": at, "rid": value["rid"]}
        for key, child in value.items():
            yield from unresolved_refs(child, f"{at}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from unresolved_refs(child, f"{at}/{index}")


def decode_trees(trees):
    from extractor.extract_all import inline_rids
    records, types = {}, {}
    roots = 0
    for tree in trees:
        if "objectsById" not in tree:
            continue
        roots += 1
        collection = tree["objectsById"]
        keys, values = collection.get("m_keys", []), collection.get("m_values", [])
        if len(keys) != len(values):
            raise ValueError("objectsById key/value lengths differ")
        refs, ref_types = {}, {}
        for ref in (tree.get("references") or {}).get("RefIds", []):
            rid = ref["rid"]
            if rid in refs:
                raise ValueError(f"Duplicate managed reference {rid}")
            refs[rid] = ref.get("data")
            ref_types[rid] = ref.get("type")
        for key, value in zip(keys, values):
            key = str(key)
            if key in records:
                raise ValueError(f"Duplicate record ID {key}")
            rid = (value or {}).get("rid")
            if rid not in refs or refs[rid] is None:
                raise ValueError(f"Missing record reference {key}: {rid}")
            records[key] = inline_rids(refs[rid], refs)
            types[key] = ref_types.get(rid)
    if roots == 0:
        raise ValueError("No objectsById root found in bundle")
    return records, types


def extract(client: Path, output: Path):
    from extractor.unity_loader import content_root, load_bundle, iter_monobehaviours, client_version
    from extractor.i18n import LocalizationTable, I18N_RELATIVE, SEED_KEYS, read_7bit_string, _generated_text_keys

    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    bundles = sorted((content_root(client) / "Data").glob("data_assets_*dataroot.asset.bundle"))
    if not bundles:
        raise ValueError("No official DataRoot bundles found")
    locales = sorted((client / I18N_RELATIVE).glob("*.bin"))
    if not locales:
        raise ValueError("No localization tables found")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".extract-", dir=output.parent))
    sources, datasets, documents, issues = {}, {}, {}, {}
    try:
        for bundle in bundles:
            domain = bundle.name.removeprefix("data_assets_").removesuffix("dataroot.asset.bundle")
            if not re.fullmatch(r"[a-z0-9_]+", domain):
                raise ValueError(f"Invalid domain name: {domain}")
            # Retain the complete type trees as well as the expanded client projection.
            before = hashlib.sha256(bundle.read_bytes()).hexdigest()
            trees = [tree for _, tree in iter_monobehaviours(load_bundle(bundle))]
            if hashlib.sha256(bundle.read_bytes()).hexdigest() != before:
                raise ValueError(f"Source changed during extraction: {bundle}")
            records, types = decode_trees(trees)
            data_path = f"data/{domain}.json.gz"
            write_json(stage / data_path, records)
            datasets[domain] = {"path": data_path, "count": len(records), "sha256": digest(records)}
            for path, payload in [(f"raw/{domain}.json.gz", trees),
                                  (f"types/{domain}.json.gz", types)]:
                write_json(stage / path, payload)
                documents[path] = {"sha256": digest(payload), "public": False}
            sources[str(bundle.relative_to(client))] = before
            unresolved = list(unresolved_refs(records))
            if unresolved:
                issues[domain] = {"count": len(unresolved), "examples": unresolved[:20]}
            print(f"extract {domain}: {len(records)} records", flush=True)
        try:
            named_keys = set(SEED_KEYS) | _generated_text_keys(client)
        except FileNotFoundError:
            named_keys = set(SEED_KEYS)
        for source in locales:
            raw = source.read_bytes()
            table = LocalizationTable(raw)
            payload = {
                "format": "giny.dofus3.i18n.v1", "language": table.language,
                "by_id": {str(key): text for key, text in table.iter_ids()},
                # Retain even the strings whose original textual key is unknown.
                "by_hash": {str(key): read_7bit_string(raw, offset)[0]
                            for key, offset in table._hashes().items()},
                "strings": {key: text for key in sorted(named_keys)
                            if (text := table.lookup_key(key)) is not None},
            }
            path = f"i18n/{source.stem}.json.gz"
            write_json(stage / path, payload)
            documents[path] = {"sha256": digest(payload), "public": True,
                               "id_count": len(payload["by_id"]),
                               "hash_count": len(payload["by_hash"])}
            sources[str(source.relative_to(client))] = hashlib.sha256(raw).hexdigest()
            print(f"extract language {source.stem}: {len(payload['by_id'])} IDs", flush=True)
        # A source update halfway through the run must never yield a mixed release.
        for relative, expected in sources.items():
            if hashlib.sha256((client / relative).read_bytes()).hexdigest() != expected:
                raise ValueError(f"Source changed during extraction: {relative}")
        identity = {"format": FORMAT, "clientVersion": client_version(client),
                    "sources": sources, "datasets": datasets, "documents": documents}
        manifest = {**identity, "snapshot": digest(identity),
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "recordCount": sum(d["count"] for d in datasets.values()),
                    "unresolvedReferences": issues,
                    "runtimeCompatible": False}
        write_json(stage / "manifest.json", manifest)
        stage.rename(output)
        return manifest
    except BaseException:
        shutil.rmtree(stage)
        raise


SCHEMA = [
    """CREATE TABLE IF NOT EXISTS catalog_builds (
       snapshot CHAR(64) CHARACTER SET ascii PRIMARY KEY,
       manifest LONGTEXT NOT NULL CHECK(JSON_VALID(manifest)),
       status VARCHAR(16) NOT NULL, imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS catalog_datasets (
       snapshot CHAR(64) CHARACTER SET ascii NOT NULL,
       domain VARCHAR(128) CHARACTER SET ascii NOT NULL,
       record_count INT NOT NULL, sha256 CHAR(64) CHARACTER SET ascii NOT NULL,
       PRIMARY KEY(snapshot, domain),
       FOREIGN KEY(snapshot) REFERENCES catalog_builds(snapshot)
       ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS catalog_records (
       snapshot CHAR(64) CHARACTER SET ascii NOT NULL,
       domain VARCHAR(128) CHARACTER SET ascii NOT NULL,
       record_id VARCHAR(128) CHARACTER SET ascii NOT NULL,
       payload LONGTEXT NOT NULL CHECK(JSON_VALID(payload)),
       PRIMARY KEY(snapshot, domain, record_id),
       FOREIGN KEY(snapshot, domain) REFERENCES catalog_datasets(snapshot, domain)
       ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS catalog_documents (
       snapshot CHAR(64) CHARACTER SET ascii NOT NULL,
       path VARCHAR(255) CHARACTER SET ascii NOT NULL,
       sha256 CHAR(64) CHARACTER SET ascii NOT NULL, is_public BOOLEAN NOT NULL,
       payload LONGBLOB NOT NULL,
       PRIMARY KEY(snapshot, path),
       FOREIGN KEY(snapshot) REFERENCES catalog_builds(snapshot)
       ) ENGINE=InnoDB""",
]


def connect(args, create=False):
    # This tool cannot accidentally be pointed at giny_world or giny_auth.
    if not re.fullmatch(r"giny_catalog(?:_[a-z0-9_]+)?", args.database):
        raise ValueError("Archive database must be named giny_catalog or giny_catalog_<suffix>")
    import pymysql
    options = dict(user=args.user, password=os.environ.get("GINY_CATALOG_DB_PASSWORD", ""),
                   charset="utf8mb4", autocommit=False)
    if args.socket:
        options["unix_socket"] = str(args.socket.resolve())
    else:
        options.update(host=args.host, port=args.port)
    connection = pymysql.connect(**options)
    if create:
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{args.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin")
    connection.select_db(args.database)
    if create:
        with connection.cursor() as cursor:
            for statement in SCHEMA:
                cursor.execute(statement)
        connection.commit()
    return connection


def checked_path(root, path):
    candidate = (root / path).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise ValueError(f"Path outside snapshot: {path}")
    return candidate


def checked_manifest(root):
    manifest = read_json(root / "manifest.json")
    identity = {key: manifest[key] for key in ("format", "clientVersion", "sources", "datasets", "documents")}
    if manifest["format"] != FORMAT or digest(identity) != manifest["snapshot"]:
        raise ValueError("Invalid manifest identity")
    for info in manifest["datasets"].values():
        records = read_json(checked_path(root, info["path"]))
        if len(records) != info["count"] or digest(records) != info["sha256"]:
            raise ValueError(f"Dataset checksum mismatch: {info['path']}")
    for path, info in manifest["documents"].items():
        if digest(read_json(checked_path(root, path))) != info["sha256"]:
            raise ValueError(f"Document checksum mismatch: {path}")
    return manifest


def import_sql(connection, root):
    manifest = checked_manifest(root)
    snapshot = manifest["snapshot"]
    with connection.cursor() as cursor:
        cursor.execute("SELECT status, manifest FROM catalog_builds WHERE snapshot=%s", (snapshot,))
        existing = cursor.fetchone()
        if existing:
            if existing[0] != "ready":
                raise ValueError("Snapshot exists but is incomplete")
            verify_sql(connection, snapshot)
            print(f"Already imported and verified: {snapshot}", flush=True)
            return snapshot
        try:
            cursor.execute("INSERT INTO catalog_builds(snapshot,manifest,status) VALUES (%s,%s,'loading')",
                           (snapshot, canonical(manifest).decode()))
            for domain, info in manifest["datasets"].items():
                records = read_json(root / info["path"])
                cursor.execute("INSERT INTO catalog_datasets VALUES (%s,%s,%s,%s)",
                               (snapshot, domain, len(records), info["sha256"]))
                rows = [(snapshot, domain, key, canonical(value).decode()) for key, value in records.items()]
                for start in range(0, len(rows), 500):
                    cursor.executemany("INSERT INTO catalog_records VALUES (%s,%s,%s,%s)", rows[start:start+500])
                print(f"SQL {domain}: {len(rows)} records", flush=True)
            for path, info in manifest["documents"].items():
                payload = gzip.compress(canonical(read_json(root / path)), mtime=0)
                cursor.execute("INSERT INTO catalog_documents VALUES (%s,%s,%s,%s,%s)",
                               (snapshot, path, info["sha256"], info["public"], payload))
            verify_sql(connection, snapshot, require_ready=False)
            cursor.execute("UPDATE catalog_builds SET status='ready' WHERE snapshot=%s", (snapshot,))
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
    return snapshot


def sql_manifest(connection, snapshot, require_ready=True):
    with connection.cursor() as cursor:
        cursor.execute("SELECT manifest,status FROM catalog_builds WHERE snapshot=%s", (snapshot,))
        row = cursor.fetchone()
    if not row or (require_ready and row[1] != "ready"):
        raise ValueError(f"No ready snapshot: {snapshot}")
    manifest = json.loads(row[0])
    identity = {key: manifest[key] for key in ("format", "clientVersion", "sources", "datasets", "documents")}
    if manifest["format"] != FORMAT or manifest["snapshot"] != snapshot or digest(identity) != snapshot:
        raise ValueError("SQL manifest identity mismatch")
    return manifest


def sql_records(connection, snapshot, domain):
    with connection.cursor() as cursor:
        cursor.execute("SELECT record_id,payload FROM catalog_records WHERE snapshot=%s AND domain=%s",
                       (snapshot, domain))
        return {key: json.loads(payload) for key, payload in cursor}


def sql_document(connection, snapshot, path):
    with connection.cursor() as cursor:
        cursor.execute("SELECT payload FROM catalog_documents WHERE snapshot=%s AND path=%s", (snapshot, path))
        row = cursor.fetchone()
    if not row:
        raise ValueError(f"Missing SQL document: {path}")
    return json.loads(gzip.decompress(row[0]))


def verify_sql(connection, snapshot, require_ready=True):
    manifest = sql_manifest(connection, snapshot, require_ready)
    with connection.cursor() as cursor:
        cursor.execute("SELECT domain,record_count,sha256 FROM catalog_datasets WHERE snapshot=%s", (snapshot,))
        actual = {domain: (count, sha) for domain, count, sha in cursor}
        expected = {domain: (info["count"], info["sha256"]) for domain, info in manifest["datasets"].items()}
        if actual != expected:
            raise ValueError("SQL dataset index mismatch")
        cursor.execute("SELECT path,sha256,is_public FROM catalog_documents WHERE snapshot=%s", (snapshot,))
        actual = {path: (sha, bool(public)) for path, sha, public in cursor}
        expected = {path: (info["sha256"], info["public"]) for path, info in manifest["documents"].items()}
        if actual != expected:
            raise ValueError("SQL document index mismatch")
    for domain, info in manifest["datasets"].items():
        records = sql_records(connection, snapshot, domain)
        if len(records) != info["count"] or digest(records) != info["sha256"]:
            raise ValueError(f"SQL round-trip mismatch: {domain}")
    for path, info in manifest["documents"].items():
        if digest(sql_document(connection, snapshot, path)) != info["sha256"]:
            raise ValueError(f"SQL document mismatch: {path}")
    return manifest


def export_sql(connection, snapshot, output, language="fr"):
    if output.exists():
        raise ValueError(f"Export directory already exists: {output}")
    manifest = sql_manifest(connection, snapshot)
    locale_path = f"i18n/{language}.json.gz"
    if locale_path not in manifest["documents"]:
        raise ValueError(f"Language not available: {language}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".export-", dir=output.parent))
    try:
        for domain, info in manifest["datasets"].items():
            records = sql_records(connection, snapshot, domain)
            if digest(records) != info["sha256"] or len(records) != info["count"]:
                raise ValueError(f"SQL dataset changed: {domain}")
            write_json(checked_path(stage, info["path"]), records)
        for path, info in manifest["documents"].items():
            if not info["public"]:
                continue
            payload = sql_document(connection, snapshot, path)
            if digest(payload) != info["sha256"]:
                raise ValueError(f"SQL document changed: {path}")
            write_json(checked_path(stage, path), payload)
            if path == locale_path:
                write_json(stage / "client/i18n.json.gz", payload)
        public_manifest = {key: manifest[key] for key in (
            "format", "snapshot", "clientVersion", "generatedAt", "recordCount",
            "datasets", "runtimeCompatible", "unresolvedReferences")}
        public_manifest.update(origin="sql", language=language,
                               documents={p: d for p, d in manifest["documents"].items() if d["public"]})
        write_json(stage / "manifest.json", public_manifest)
        stage.rename(output)
    except BaseException:
        shutil.rmtree(stage)
        raise
    return public_manifest


def verify_export(output, manifest, language="fr"):
    published = read_json(output / "manifest.json")
    if published["snapshot"] != manifest["snapshot"] or published.get("origin") != "sql" or published.get("language") != language:
        raise ValueError("Client export manifest mismatch")
    for info in manifest["datasets"].values():
        payload = read_json(checked_path(output, info["path"]))
        if digest(payload) != info["sha256"] or len(payload) != info["count"]:
            raise ValueError(f"Client export mismatch: {info['path']}")
    for path, info in manifest["documents"].items():
        if info["public"] and digest(read_json(checked_path(output, path))) != info["sha256"]:
            raise ValueError(f"Client export mismatch: {path}")
    if digest(read_json(output / "client/i18n.json.gz")) != manifest["documents"][f"i18n/{language}.json.gz"]["sha256"]:
        raise ValueError("Client default localization mismatch")


def sync(args):
    args.archive_root.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".sync-", dir=args.archive_root))
    try:
        manifest = extract(args.client, temporary / "snapshot")
        snapshot = manifest["snapshot"]
        archive = args.archive_root / snapshot
        if archive.exists():
            manifest = checked_manifest(archive)
        else:
            (temporary / "snapshot").rename(archive)
    finally:
        shutil.rmtree(temporary)
    with connect(args, create=True) as connection:
        import_sql(connection, archive)
        manifest = sql_manifest(connection, snapshot)
        destination = args.output_root / snapshot
        if not destination.exists():
            export_sql(connection, snapshot, destination, args.language)
        verify_export(destination, manifest, args.language)
    report = {"snapshot": snapshot, "clientVersion": manifest["clientVersion"],
              "archive": str(archive.resolve()), "clientExport": str(destination.resolve()),
              "database": args.database, "runtimeCompatible": False}
    args.output_root.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=args.output_root, prefix=".latest-", delete=False) as stream:
        stream.write(canonical(report))
        pointer = Path(stream.name)
    pointer.replace(args.output_root / "latest-prepared.json")
    print(json.dumps(report), flush=True)
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    extraction = sub.add_parser("extract")
    extraction.add_argument("--client", type=Path, default=Path("/Applications/Ankama/Dofus-dofus3"))
    extraction.add_argument("--output", type=Path, required=True)
    for action in ("import", "export", "verify", "sync"):
        command = sub.add_parser(action)
        command.add_argument("--database", default="giny_catalog")
        command.add_argument("--socket", type=Path)
        command.add_argument("--host", default="127.0.0.1")
        command.add_argument("--port", type=int, default=3307)
        command.add_argument("--user", default="root")
        if action == "import":
            command.add_argument("--input", type=Path, required=True)
        elif action != "sync":
            command.add_argument("--snapshot", required=True)
        if action == "export":
            command.add_argument("--output", type=Path, required=True)
        if action in ("export", "sync"):
            command.add_argument("--language", default="fr")
        if action == "sync":
            command.add_argument("--client", type=Path, default=Path("/Applications/Ankama/Dofus-dofus3"))
            command.add_argument("--archive-root", type=Path, required=True)
            command.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.command == "extract":
        manifest = extract(args.client, args.output)
    elif args.command == "sync":
        manifest = sync(args)
    else:
        with connect(args, create=args.command == "import") as connection:
            if args.command == "import":
                snapshot = import_sql(connection, args.input)
                manifest = sql_manifest(connection, snapshot)
            elif args.command == "export":
                manifest = export_sql(connection, args.snapshot, args.output, args.language)
            else:
                manifest = verify_sql(connection, args.snapshot)
    print(json.dumps({"snapshot": manifest["snapshot"], "clientVersion": manifest["clientVersion"],
                      "datasets": len(manifest["datasets"]), "records": manifest["recordCount"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
