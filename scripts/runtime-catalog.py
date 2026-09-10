#!/usr/bin/env python3
"""Prepare, publish and roll back the local Giny runtime catalogue.

Run with .local/catalog-venv/bin/python. Publication requires both World
instances stopped; it never moves player, spawn or module tables.
"""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
from datetime import datetime, timezone

import pymysql

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local/catalog'
POINTER = LOCAL / 'active-runtime.json'
TABLES = set('effects items weapons item_sets spell_states spell_levels spells spell_variants spell_bombs monsters recipes breeds heads npcs emotes quests quest_steps quest_objectives quest_step_rewards achievements achievement_objectives achievement_rewards ornaments titles catalog_runtime_status catalog_runtime_release'.split())
STATIC = TABLES - {'catalog_runtime_status', 'catalog_runtime_release'}


def connect():
    return pymysql.connect(unix_socket=str(ROOT / '.local/mariadb.sock'), user='root',
                           password=os.environ.get('GINY_CATALOG_DB_PASSWORD', ''), autocommit=True)


def identifier(value):
    if not re.fullmatch(r'[a-z][a-z0-9_]{0,63}', value):
        raise ValueError('Invalid SQL identifier')
    return '`' + value + '`'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def tables(cursor, database):
    cursor.execute('SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=%s', (database,))
    return {row[0] for row in cursor.fetchall()}


def checksums(cursor, database, names):
    result = {}
    for name in sorted(names):
        cursor.execute(f'CHECKSUM TABLE {identifier(database)}.{identifier(name)}')
        checksum = cursor.fetchone()[1]
        if checksum is None:
            raise ValueError(f'Cannot checksum {database}.{name}')
        result[name] = str(checksum)
    return result


def offline(cursor, databases):
    for port in (5555, 9000, 25555, 29000):
        with socket.socket() as probe:
            probe.settimeout(.2)
            if probe.connect_ex(('127.0.0.1', port)) == 0:
                raise ValueError(f'Stop World on port {port} before publication')
    cursor.execute('SHOW PROCESSLIST')
    for row in cursor.fetchall():
        if row[3] in databases:
            raise ValueError(f'A SQL client is still using {row[3]}; stop it first')


def publication_moves(source, target, backup, existing):
    moves = []
    for name in sorted(TABLES):
        if name in existing:
            moves.append(f'{identifier(target)}.{identifier(name)} TO {identifier(backup)}.{identifier(name)}')
        moves.append(f'{identifier(source)}.{identifier(name)} TO {identifier(target)}.{identifier(name)}')
    return 'RENAME TABLE ' + ', '.join(moves)


def recovery_moves(active, stage, backup, previous):
    moves = []
    for name in sorted(TABLES):
        moves.append(f'{identifier(active)}.{identifier(name)} TO {identifier(stage)}.{identifier(name)}')
        if name in previous:
            moves.append(f'{identifier(backup)}.{identifier(name)} TO {identifier(active)}.{identifier(name)}')
    return 'RENAME TABLE ' + ', '.join(moves)


def release(path):
    path = path.resolve()
    manifest = json.loads((path / 'manifest.json').read_text())
    if manifest.get('format') != 'giny.runtime-catalog.v1' or manifest.get('origin') != 'giny-sql':
        raise ValueError('Not an adapted Giny release')
    if set(manifest['tables']) != TABLES:
        raise ValueError('Runtime table allowlist mismatch')
    for name, expected in manifest['files'].items():
        file = (path / name).resolve()
        if not file.is_relative_to(path) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Invalid release file {name}')
    return manifest


def prepare(args):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    database = 'giny_catalog_stage_' + stamp
    output = ROOT / 'output/catalogs' / ('runtime-' + stamp)
    pointer = json.loads((ROOT / 'output/catalogs/releases/latest-prepared.json').read_text())
    dotnet = os.environ.get('GINY_DOTNET', '/opt/homebrew/opt/dotnet@6/libexec/dotnet')
    mysql = Path(os.environ.get('GINY_MARIADB_BIN', '/opt/homebrew/opt/mariadb@11.4/bin'))
    environment = dict(os.environ, PYTHONPATH=str(ROOT / 'client/dofus3'))
    flags = LOCAL / ('flags-' + stamp + '.json')
    LOCAL.mkdir(parents=True, exist_ok=True)
    import sys
    subprocess.run([sys.executable, '-m', 'extractor.runtime_flags', '--client', str(args.client), '--output', str(flags)], env=environment, check=True)
    subprocess.run([dotnet, 'build', str(ROOT / 'server/Servers/Giny.World/Giny.World.csproj'), '-c', 'Release', '--no-restore', '-v:q', '-nr:false', '-p:UseSharedCompilation=false'], check=True)
    backup = ROOT / '.local/backups' / ('before-catalog-' + stamp + '.sql.gz')
    backup.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection, connection.cursor() as cursor:
        baseline = checksums(cursor, 'giny_world', tables(cursor, 'giny_world') & TABLES)
        cursor.execute(f'CREATE DATABASE {identifier(database)} CHARACTER SET utf8mb4')
    # Credentials stay outside argv. The existing local setup normally has no password.
    environment = dict(os.environ, MYSQL_PWD=os.environ.get('GINY_CATALOG_DB_PASSWORD', ''))
    with backup.open('xb') as raw:
        os.chmod(backup, 0o600)
        with gzip.GzipFile(fileobj=raw, mode='wb') as compressed:
            process = subprocess.Popen([str(mysql / 'mariadb-dump'), '--no-defaults', '--socket=' + str(ROOT / '.local/mariadb.sock'), '-uroot', '--lock-all-tables', '--hex-blob', 'giny_world'], stdout=subprocess.PIPE, env=environment)
            shutil.copyfileobj(process.stdout, compressed)
            if process.wait() != 0:
                raise RuntimeError('Backup failed')
    with connect() as connection, connection.cursor() as cursor:
        if checksums(cursor, 'giny_world', baseline) != baseline:
            raise ValueError('Active catalogue changed during backup; retry preparation')
    with gzip.open(backup, 'rb') as source:
        process = subprocess.Popen([str(mysql / 'mariadb'), '--no-defaults', '--socket=' + str(ROOT / '.local/mariadb.sock'), '-uroot', database], stdin=subprocess.PIPE, env=environment)
        shutil.copyfileobj(source, process.stdin)
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('Staging restore failed')
    subprocess.run([dotnet, str(ROOT / 'server/Servers/Giny.World/bin/Release/net6.0/Giny.World.dll'), '--catalog-prepare', '--database', database, '--snapshot', pointer['snapshot'], '--flags', str(flags), '--output', str(output)], check=True)
    write_json(output / 'baseline.json', {'database': 'giny_world', 'checksums': baseline, 'backup': str(backup)})
    print(json.dumps({'database': database, 'release': str(output), 'next': 'Validate this copy with isolated Auth/World, then stop both World instances and publish.'}))


def publish(args):
    output = args.release.resolve()
    manifest = release(output)
    database = manifest['sourceDatabase']
    if not re.fullmatch(r'giny_catalog_stage_[a-z0-9_]+', database):
        raise ValueError('Only a staging database can be published')
    baseline = json.loads((output / 'baseline.json').read_text())
    rollback = 'giny_catalog_rollback_' + datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    receipt = LOCAL / (rollback + '.json')
    previous = json.loads(POINTER.read_text()) if POINTER.exists() else None
    with connect() as connection, connection.cursor() as cursor:
        offline(cursor, {'giny_world', database})
        if checksums(cursor, database, TABLES) != manifest['sqlChecksums']:
            raise ValueError('Staging SQL changed since export; regenerate the release')
        active = tables(cursor, 'giny_world')
        if checksums(cursor, 'giny_world', active & TABLES) != baseline['checksums']:
            raise ValueError('Active catalogue changed since cloning; prepare again to preserve those edits')
        untouched = checksums(cursor, 'giny_world', active - TABLES)
        cursor.execute(f'SELECT Snapshot,CatalogVersion FROM {identifier(database)}.catalog_runtime_release WHERE Id=1')
        if cursor.fetchone() != (manifest['snapshot'], manifest['catalogVersion']):
            raise ValueError('SQL/client version mismatch')
        cursor.execute(f'CREATE DATABASE {identifier(rollback)} CHARACTER SET utf8mb4')
        record = {'rollbackDatabase': rollback, 'stageDatabase': database, 'release': str(output),
                  'previousPointer': previous, 'oldTables': sorted(active & TABLES), 'untouchedChecksums': untouched,
                  'catalogVersion': manifest['catalogVersion'], 'state': 'prepared'}
        write_json(receipt, record)  # Recovery information exists before the single SQL rename.
        cursor.execute(publication_moves(database, 'giny_world', rollback, active))
        record['state'] = 'sql-published'
        write_json(receipt, record)
        if checksums(cursor, 'giny_world', active - TABLES) != untouched:
            raise RuntimeError(f'Player/module invariant failed; roll back using {receipt}')
        write_json(POINTER, {'clientExport': str(output), 'catalogVersion': manifest['catalogVersion'], 'snapshot': manifest['snapshot']})
        record['state'] = 'published'
        write_json(receipt, record)
    print(json.dumps({'published': manifest['catalogVersion'], 'rollbackReceipt': str(receipt)}))


def rollback(args):
    receipt = json.loads(args.receipt.read_text())
    old, stage = receipt['rollbackDatabase'], receipt['stageDatabase']
    if not old.startswith('giny_catalog_rollback_') or not stage.startswith('giny_catalog_stage_'):
        raise ValueError('Invalid recovery databases')
    with connect() as connection, connection.cursor() as cursor:
        offline(cursor, {'giny_world', stage, old})
        cursor.execute('SELECT CatalogVersion FROM giny_world.catalog_runtime_release WHERE Id=1')
        if cursor.fetchone()[0] != receipt['catalogVersion']:
            raise ValueError('Another release is active; do not roll it back with this receipt')
        cursor.execute(recovery_moves('giny_world', stage, old, receipt['oldTables']))
        if receipt['previousPointer'] is None:
            POINTER.unlink(missing_ok=True)
        else:
            write_json(POINTER, receipt['previousPointer'])
        receipt['state'] = 'rolled-back'
        write_json(args.receipt, receipt)
    print('Previous catalogue restored; player and module tables retained.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    command = commands.add_parser('prepare')
    command.add_argument('--client', type=Path, default=Path('/Applications/Ankama/Dofus-dofus3'))
    command = commands.add_parser('publish')
    command.add_argument('--release', type=Path, required=True)
    command = commands.add_parser('rollback')
    command.add_argument('--receipt', type=Path, required=True)
    arguments = parser.parse_args()
    globals()[arguments.command](arguments)
