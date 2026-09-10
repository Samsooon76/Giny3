import argparse
import os
from pathlib import Path
import uuid

import pytest

from extractor.official_catalog import (
    FORMAT, checked_manifest, connect, decode_trees, digest, export_sql,
    import_sql, read_json, sync, verify_export, verify_sql, write_json,
)


def make_snapshot(root):
    records = {"1": {"id": 1, "name": "Épée\n'\\雪", "largeId": 2**60,
                     "effects": [{"effectId": 10, "diceNum": 42}], "unknown": None}}
    locale = {"language": "fr", "by_id": {"2": "Épée"}, "by_hash": {}, "strings": {}}
    raw = [{"references": {"RefIds": [{"rid": 4, "type": {"class": "Unknown"}}]}}]
    write_json(root / "data/items.json.gz", records)
    write_json(root / "i18n/fr.json.gz", locale)
    write_json(root / "raw/items.json.gz", raw)
    identity = {
        "format": FORMAT, "clientVersion": "fixture", "sources": {},
        "datasets": {"items": {"path": "data/items.json.gz", "count": 1, "sha256": digest(records)}},
        "documents": {"i18n/fr.json.gz": {"sha256": digest(locale), "public": True},
                      "raw/items.json.gz": {"sha256": digest(raw), "public": False}},
    }
    manifest = {**identity, "snapshot": digest(identity), "generatedAt": "2026-09-05T00:00:00Z",
                "recordCount": 1, "unresolvedReferences": {}, "runtimeCompatible": False}
    write_json(root / "manifest.json", manifest)
    return manifest


def test_extraction_rejects_missing_record_references():
    with pytest.raises(ValueError, match="Missing record reference"):
        decode_trees([{"objectsById": {"m_keys": [1], "m_values": [{"rid": 999}]}}])


def test_extraction_retains_managed_types_and_expands_shared_effects():
    records, types = decode_trees([{
        "objectsById": {"m_keys": [7], "m_values": [{"rid": 1}]},
        "references": {"RefIds": [
            {"rid": 1, "type": {"class": "WeaponData"},
             "data": {"id": 7, "effects": [{"rid": 2}, {"rid": 2}]}},
            {"rid": 2, "data": {"effectId": 5}},
        ]},
    }])
    assert records["7"]["effects"] == [{"effectId": 5}, {"effectId": 5}]
    assert types["7"] == {"class": "WeaponData"}


def test_snapshot_detects_corruption_before_import(tmp_path):
    make_snapshot(tmp_path)
    assert checked_manifest(tmp_path)["recordCount"] == 1
    write_json(tmp_path / "data/items.json.gz", {"1": {"id": 1, "name": "modified"}})
    with pytest.raises(ValueError, match="checksum mismatch"):
        checked_manifest(tmp_path)


def test_runtime_database_is_rejected():
    with pytest.raises(ValueError, match="Archive database"):
        connect(argparse.Namespace(database="giny_world"))


@pytest.fixture
def db():
    socket = os.environ.get("GINY_CATALOG_TEST_SOCKET")
    if not socket:
        pytest.skip("Set GINY_CATALOG_TEST_SOCKET to run real MariaDB integration tests")
    args = argparse.Namespace(database=f"giny_catalog_test_{uuid.uuid4().hex}",
                              user="root", socket=Path(socket))
    connection = connect(args, create=True)
    try:
        yield connection
    finally:
        connection.rollback()
        with connection.cursor() as cursor:
            cursor.execute(f"DROP DATABASE `{args.database}`")
        connection.close()


def test_sql_roundtrip_idempotency_and_client_export(db, tmp_path):
    root = tmp_path / "source"
    manifest = make_snapshot(root)
    snapshot = import_sql(db, root)
    assert import_sql(db, root) == snapshot
    assert verify_sql(db, snapshot) == manifest
    export = tmp_path / "client"
    exported = export_sql(db, snapshot, export)
    assert exported["origin"] == "sql"
    assert read_json(export / "data/items.json.gz") == read_json(root / "data/items.json.gz")
    assert read_json(export / "client/i18n.json.gz") == read_json(root / "i18n/fr.json.gz")
    assert not (export / "raw").exists()
    verify_export(export, manifest)
    with pytest.raises(ValueError, match="already exists"):
        export_sql(db, snapshot, export)


def test_failed_import_rolls_back_all_records(db, tmp_path):
    make_snapshot(tmp_path)
    with db.cursor() as cursor:
        cursor.execute("""CREATE TRIGGER fail_document BEFORE INSERT ON catalog_documents
                       FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected failure'""")
    with pytest.raises(Exception, match="injected failure"):
        import_sql(db, tmp_path)
    with db.cursor() as cursor:
        for table in ["catalog_builds", "catalog_datasets", "catalog_records", "catalog_documents"]:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            assert cursor.fetchone()[0] == 0


def test_tampered_sql_does_not_publish_partial_export(db, tmp_path):
    root = tmp_path / "source"
    make_snapshot(root)
    snapshot = import_sql(db, root)
    with db.cursor() as cursor:
        cursor.execute("UPDATE catalog_records SET payload='{}' WHERE snapshot=%s", (snapshot,))
    db.commit()
    output = tmp_path / "export"
    with pytest.raises(ValueError, match="SQL dataset changed"):
        export_sql(db, snapshot, output)
    assert not output.exists()
    assert not list(tmp_path.glob(".export-*"))


def test_sync_is_repeatable_and_keeps_published_snapshot(db, tmp_path, monkeypatch):
    import extractor.official_catalog as catalog
    def fake_extract(_client, output):
        return make_snapshot(output)
    monkeypatch.setattr(catalog, "extract", fake_extract)
    # A real independent connection each time, to the fixture's isolated DB.
    with db.cursor() as cursor:
        cursor.execute("SELECT DATABASE()")
        db_name = cursor.fetchone()[0]
    args = argparse.Namespace(
        archive_root=tmp_path / "archive", output_root=tmp_path / "exports",
        client=tmp_path / "official", database=db_name, user="root",
        socket=Path(os.environ["GINY_CATALOG_TEST_SOCKET"]), language="fr",
    )
    first = sync(args)
    second = sync(args)
    assert first == second
    pointer = read_json(args.output_root / "latest-prepared.json")
    verify_export(Path(pointer["clientExport"]), first)
    assert len(list(args.archive_root.iterdir())) == 1
