import importlib.util
import json
import os
from pathlib import Path
import uuid

import pytest

spec = importlib.util.spec_from_file_location('runtime_catalog', Path(__file__).parents[1] / 'runtime-catalog.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def test_release_rejects_raw_or_altered_exports(tmp_path):
    manifest = {'format': 'official', 'origin': 'giny-sql'}
    (tmp_path / 'manifest.json').write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match='adapted'):
        runtime.release(tmp_path)
    manifest.update(format='giny.runtime-catalog.v1', tables=sorted(runtime.TABLES), files={'data/items.json.gz': 'wrong-hash'})
    (tmp_path / 'data').mkdir()
    (tmp_path / 'data/items.json.gz').write_bytes(b'changed')
    (tmp_path / 'manifest.json').write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match='Invalid release file'):
        runtime.release(tmp_path)


@pytest.mark.skipif(os.environ.get('GINY_ORM_INTEGRATION') != '1', reason='Local MariaDB integration is opt-in')
def test_actual_sql_publication_and_recovery_leave_player_tables_untouched():
    # Three disposable databases; never publish into the user's giny_world.
    prefix = 'giny_catalog_test_' + uuid.uuid4().hex[:12]
    active, stage, backup = [prefix + suffix for suffix in ('_active', '_stage', '_backup')]
    with runtime.connect() as connection, connection.cursor() as cursor:
        try:
            for database in (active, stage, backup):
                cursor.execute(f'CREATE DATABASE `{database}`')
            for database, names, value in ((active, runtime.STATIC, 'old'), (stage, runtime.TABLES, 'new')):
                for name in names:
                    cursor.execute(f'CREATE TABLE `{database}`.`{name}` (Id int PRIMARY KEY, Value text) ENGINE=InnoDB')
                    cursor.execute(f'INSERT INTO `{database}`.`{name}` VALUES (1,%s)', (value,))
            cursor.execute(f'CREATE TABLE `{active}`.characters (Id int PRIMARY KEY, Value text) ENGINE=InnoDB')
            cursor.execute(f"INSERT INTO `{active}`.characters VALUES (42,'player state')")
            before = runtime.checksums(cursor, active, runtime.STATIC | {'characters'})
            cursor.execute(runtime.publication_moves(stage, active, backup, runtime.STATIC | {'characters'}))
            cursor.execute(f'SELECT Value FROM `{active}`.items')
            assert cursor.fetchone()[0] == 'new'
            assert runtime.checksums(cursor, active, {'characters'})['characters'] == before['characters']
            cursor.execute(runtime.recovery_moves(active, stage, backup, runtime.STATIC))
            assert runtime.checksums(cursor, active, runtime.STATIC | {'characters'}) == before
            assert runtime.tables(cursor, stage) == runtime.TABLES
        finally:
            for database in (active, stage, backup):
                cursor.execute(f'DROP DATABASE IF EXISTS `{database}`')
