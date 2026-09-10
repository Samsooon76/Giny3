"""Read-only structural comparison of an extracted release with Giny records.

This finds migration work; it never declares combat behavior compatible.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re

from extractor.official_catalog import checked_manifest, connect, read_json, write_json


def strip_comments(source):
    # The inspected attributes contain only simple string literals. Avoid
    # counting commented registrations as implemented effect handlers.
    return re.sub(r"/\*.*?\*/|//[^\n]*", "", source, flags=re.S)


def audit(root, server, connection, runtime_database="giny_world"):
    if not re.fullmatch(r"[a-zA-Z0-9_]+", runtime_database):
        raise ValueError("Invalid runtime database identifier")
    manifest = checked_manifest(root)
    tables = {domain: read_json(root / info["path"]) for domain, info in manifest["datasets"].items()}
    class_domains = {}
    for domain in tables:
        types = read_json(root / f"types/{domain}.json.gz")
        for record_id, info in types.items():
            if info:
                class_domains.setdefault(info["class"].removesuffix("Data"), {}).setdefault(domain, set()).add(record_id)
    comparisons = []
    with connection.cursor() as cursor:
        cursor.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s", (runtime_database,))
        available = {row[0] for row in cursor}
        for path in sorted((server / "Servers/Giny.World/Records").rglob("*.cs")):
            code = strip_comments(path.read_text(encoding="utf-8-sig"))
            cls = re.search(r'\[D2OClass\("([^"\n]+)"\)\]', code)
            table = re.search(r'\[Table\("([a-zA-Z0-9_]+)"', code)
            if not cls or not table:
                continue
            fields = set(re.findall(r'\[D2OField\("([^"\n]+)"\)\]', code))
            matching = class_domains.get(cls[1], {})
            row = {"record": str(path.relative_to(server)), "class": cls[1],
                   "sqlTable": table[1], "domains": sorted(matching)}
            source_records = {key: tables[domain][key] for domain, keys in matching.items() for key in keys}
            source_ids = set(source_records)
            all_fields = set().union(*(set(r) for r in source_records.values())) if source_records else set()
            row.update(officialCount=len(source_ids),
                       expectedFieldsAbsentFromOfficial=sorted(fields - all_fields),
                       officialFieldsWithoutDirectD2OMapping=sorted(all_fields - fields))
            if table[1] in available:
                cursor.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s",
                               (runtime_database, table[1]))
                columns = {c[0] for c in cursor}
                if "Id" in columns:
                    cursor.execute(f"SELECT Id FROM `{runtime_database}`.`{table[1]}`")
                    sql_ids = {str(r[0]) for r in cursor}
                    row.update(sqlCount=len(sql_ids), commonIds=len(source_ids & sql_ids),
                               onlyOfficial=len(source_ids - sql_ids), onlyRuntime=len(sql_ids - source_ids))
            comparisons.append(row)

    enums_code = strip_comments((server / "Giny.Protocol/Custom/Enums/EffectsEnum.cs").read_text(encoding="utf-8-sig"))
    enums = {name: int(value) for name, value in re.findall(r"\b(Effect_\w+)\s*=\s*(\d+)", enums_code)}
    handlers = set()
    for base in [server / "Servers/Giny.World", server / "Modules"]:
        for path in base.rglob("*.cs"):
            if "obj" in path.parts or "bin" in path.parts:
                continue
            code = strip_comments(path.read_text(encoding="utf-8-sig"))
            for name in re.findall(r"\[SpellEffectHandler\(EffectsEnum\.(\w+)\)\]", code):
                if name in enums:
                    handlers.add(enums[name])
    effect_usage = Counter()
    affected_levels = {}
    for level_id, level in tables.get("spelllevels", {}).items():
        ids = {int(effect["effectId"]) for field in ["effects", "criticalEffect"]
               for effect in level.get(field, []) if "effectId" in effect}
        effect_usage.update(ids)
        missing = sorted(ids - handlers)
        if missing:
            affected_levels[level_id] = missing

    links = []
    def check(source, field, target, multiple=False, ignored=()):
        missing = []
        for record_id, record in tables.get(source, {}).items():
            values = record.get(field, []) if multiple else [record.get(field)]
            for value in values:
                if value is not None and value not in ignored and str(value) not in tables.get(target, {}):
                    missing.append({"recordId": record_id, "targetId": value})
        links.append({"source": source, "field": field, "target": target,
                      "missingCount": len(missing), "examples": missing[:20]})
    check("spells", "spellLevels", "spelllevels", multiple=True)
    check("spelllevels", "spellId", "spells")
    check("items", "itemSetId", "itemsets", ignored=(-1, 0))
    check("items", "typeId", "itemtypes")
    check("monsters", "spells", "spells", multiple=True)
    check("recipes", "resultId", "items")
    check("recipes", "ingredientIds", "items", multiple=True)
    check("quests", "stepIds", "queststeps", multiple=True)
    check("queststeps", "objectiveIds", "questobjectives", multiple=True)
    check("queststeps", "rewardsIds", "queststeprewards", multiple=True)
    return {
        "snapshot": manifest["snapshot"], "clientVersion": manifest["clientVersion"],
        "runtimeDatabase": runtime_database, "runtimeCompatible": False,
        "recordMappings": comparisons,
        "domainsWithoutD2ORecordMatch": sorted(set(tables) - {domain for r in comparisons for domain in r["domains"]}),
        "spellEffects": {
            "usedDistinctIds": len(effect_usage), "sourceRegisteredHandlerIds": len(handlers),
            "usedIdsWithoutSourceHandler": sorted(set(effect_usage) - handlers),
            "usedIdsAbsentFromEnum": sorted(set(effect_usage) - set(enums.values())),
            "levelsWithAtLeastOneMissingHandler": len(affected_levels),
            "missingHandlerLevelExamples": dict(list(affected_levels.items())[:30]),
            "caveat": "Static source registrations only; presence does not prove correct implementation or runtime registration.",
        },
        "referenceChecks": links,
        "limits": [
            "Only client-side DataRoot catalogues and localization are extracted; official server code and live world state are absent.",
            "Unity m_flags, changed zones/criteria, numeric limits and serialized Giny BLOBs require explicit adapters.",
            "Unmatched fields or domains are retained in SQL; no default gameplay values are invented.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--server", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--socket", type=Path)
    parser.add_argument("--database", default="giny_catalog")
    parser.add_argument("--runtime-database", default="giny_world")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3307)
    parser.add_argument("--user", default="root")
    args = parser.parse_args()
    with connect(args) as connection:
        report = audit(args.input, args.server, connection, args.runtime_database)
    write_json(args.output, report)
    print(json.dumps({"recordMappings": len(report["recordMappings"]),
                      "spellEffects": report["spellEffects"],
                      "referenceChecks": report["referenceChecks"]}))


if __name__ == "__main__":
    main()
