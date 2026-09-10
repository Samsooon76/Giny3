"""Audit an exported UI cache for anything the extractor left unresolved.

The cache is a migration source: a hole in it is invisible until a screen is
mounted, and by then it looks like a client bug. Every check below is therefore
phrased as a count that must stay at zero, over the whole catalog rather than
over a sample:

``missing_files``
    a tree points at an image, font or cursor no exported file backs.
``unresolved_sprites``
    an ``icon=``/``sprite=`` name that matched nothing in the sprite catalog.
``unresolved_assets``
    a style value still holding a Unity PPtr, so the asset was never followed.
``dropped_no_file`` / ``dropped_unresolved_pptr``
    a declaration the exporter removed because it could not back it: a name no
    exported file matches, or a pointer none of the opened bundles contains.
    Removing it is right — painting a broken URL is worse — but it is a hole in
    the screen either way, so it is counted rather than forgotten.
``unresolved_variables``
    a style value still holding a ``--token``, so the design value is unknown.
``unknown_properties`` / ``unknown_keywords`` / ``unknown_functions``
    a serialized StylePropertyId, StyleValueKeyword or StyleValueFunction the
    decoder has no name for, which means the declaration cannot be applied.
``unexpanded_templates``
    a ``<Instance template=...>`` whose body was never inlined: a missing window.
``missing_trees`` / ``orphan_relations``
    the manifest and the files on disk disagree.

This audit only walks what the exporter already published. Collections that
were never selected (DofusContent pictos, unread bundle objects) and the
pixel fidelity of the React renderer are out of scope: a clean report means
the cache is internally consistent, not that every screen is pixel-perfect.

The report is embedded in the manifest so a client can refuse a cache that is
not clean, and :func:`format_report` prints it for a human.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

REPORT_FORMAT = "giny.dofus3.ui-integrity.v1"

#: Style properties whose value is a path to an exported file.
ASSET_PROPERTIES = ("background-image", "cursor", "unity-font", "unity-font-definition")

#: Counters that must be zero for the cache to be considered clean.
BLOCKING = (
    "missing_files",
    "unresolved_sprites",
    "unresolved_assets",
    "dropped_no_file",
    "dropped_unresolved_pptr",
    "unresolved_variables",
    "unknown_properties",
    "unknown_keywords",
    "unknown_functions",
    "unexpanded_templates",
    "missing_trees",
    "orphan_relations",
)


def audit_cache(cache_dir: Path, manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    """Walk every exported tree and stylesheet and count what stayed unresolved."""
    cache_dir = Path(cache_dir)
    if manifest is None:
        manifest = json.loads((cache_dir / "manifest.json").read_text(encoding="utf-8"))
    counts: Counter[str] = Counter()
    samples: dict[str, list[str]] = {}

    def note(kind: str, detail: str) -> None:
        counts[kind] += 1
        bucket = samples.setdefault(kind, [])
        if detail not in bucket and len(bucket) < 10:
            bucket.append(detail)

    trees = manifest.get("trees") or {}
    for asset, relative in trees.items():
        path = cache_dir / str(relative)
        if not path.is_file():
            note("missing_trees", f"{asset}: {relative}")
            continue
        counts["trees"] += 1
        for node in _walk(json.loads(path.read_text(encoding="utf-8"))):
            _audit_node(node, asset, cache_dir, counts, note)

    for name, relative in (manifest.get("styles") or {}).items():
        path = cache_dir / str(relative)
        if not path.is_file():
            note("missing_styles", f"{name}: {relative}")
            continue
        counts["styles"] += 1
        _audit_sheet(json.loads(path.read_text(encoding="utf-8")), name, counts, note)
    for name, relative in (manifest.get("theme_sheets") or {}).items():
        path = cache_dir / str(relative)
        if path.is_file():
            _audit_sheet(json.loads(path.read_text(encoding="utf-8")), name, counts, note)

    relations = read_document(cache_dir, manifest.get("relations"))
    for asset in relations:
        if asset not in trees:
            note("orphan_relations", asset)
    for asset in trees:
        if asset not in relations:
            note("orphan_relations", asset)

    return {
        "format": REPORT_FORMAT,
        "counts": dict(sorted(counts.items())),
        "samples": {key: samples[key] for key in sorted(samples)},
        "clean": not any(counts.get(key) for key in BLOCKING),
    }


def read_document(cache_dir: Path, reference: Any) -> dict[str, Any]:
    """A manifest entry that is either the table itself or the file holding it.

    ``relations`` and ``tokens`` are documents of their own: the manifest is
    read at every boot and neither is needed to mount a screen.
    """
    if isinstance(reference, dict):
        return reference
    if not isinstance(reference, str) or not reference:
        return {}
    path = Path(cache_dir) / reference
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}


def _walk(node: dict[str, Any]) -> Iterator[dict[str, Any]]:
    stack = [node]
    while stack:
        current = stack.pop()
        yield current
        stack.extend(child for child in current.get("children") or [] if isinstance(child, dict))


def _styles(node: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for style in (node.get("style"), *(node.get("states") or {}).values()):
        if isinstance(style, dict):
            yield style
    for entry in node.get("ancestor_states") or []:
        if isinstance(entry, dict) and isinstance(entry.get("style"), dict):
            yield entry["style"]


def _audit_node(node, asset, cache_dir, counts, note) -> None:
    counts["nodes"] += 1
    if node.get("template_alias") and node.get("children") is None:
        note("unexpanded_templates", f"{asset}: {node['template_alias']}")
    if node.get("sprite_unresolved"):
        note("unresolved_sprites", f"{asset}: {node['sprite_unresolved']}")
    if node.get("style_variants"):
        counts["deferred_variants"] += 1
    for entry in node.get("dropped_assets") or []:
        kind = (
            "dropped_no_file"
            if entry.get("reason") == "no-exported-file"
            else "dropped_unresolved_pptr"
        )
        note(kind, f"{asset}: {entry.get('property')} [{entry.get('state')}] {entry.get('reference')}")
    sprite = node.get("sprite")
    if isinstance(sprite, str) and sprite and not (cache_dir / sprite.lstrip("/")).is_file():
        note("missing_files", f"{asset}: sprite {sprite}")
    if node.get("text"):
        counts["texts"] += 1
    if node.get("placeholder_text"):
        counts["placeholder_texts"] += 1
    if node.get("states"):
        counts["nodes_with_states"] += 1
    if node.get("ancestor_states"):
        counts["nodes_with_ancestor_states"] += 1
    for style in _styles(node):
        for key, value in style.items():
            if key.startswith("prop_"):
                note("unknown_properties", f"{asset}: {key}")
            for item in value if isinstance(value, list) else [value]:
                if isinstance(item, dict) and item.get("type") != "missing-asset" and (
                    "path_id" in item or "m_PathID" in item
                ):
                    note("unresolved_assets", f"{asset}: {key}")
                elif isinstance(item, str):
                    _audit_value(asset, key, item, cache_dir, note)


def _audit_value(asset, key, value, cache_dir, note) -> None:
    if value.startswith("--"):
        note("unresolved_variables", f"{asset}: {key}={value}")
    elif value.startswith("keyword_"):
        note("unknown_keywords", f"{asset}: {key}={value}")
    elif value.startswith("fn_"):
        note("unknown_functions", f"{asset}: {key}={value}")
    elif (
        key in ASSET_PROPERTIES
        and "/" in value
        and not value.startswith("project://")
        and not (cache_dir / value.lstrip("/")).is_file()
    ):
        note("missing_files", f"{asset}: {key} {value}")


def _audit_sheet(sheet: dict[str, Any], name: str, counts, note) -> None:
    for rule in sheet.get("rules") or []:
        counts["rules"] += 1
        for prop in rule.get("properties") or []:
            property_name = str(prop.get("name") or "")
            if property_name.startswith("prop_"):
                note("unknown_properties", f"{name}: {property_name}")
            for value in prop.get("values") or []:
                if not isinstance(value, dict):
                    continue
                if value.get("type") == "unknown":
                    note("unknown_value_types", f"{name}: {property_name}")
                payload = value.get("value")
                if isinstance(payload, str):
                    if payload.startswith("keyword_"):
                        note("unknown_keywords", f"{name}: {property_name}={payload}")
                    elif payload.startswith("fn_"):
                        note("unknown_functions", f"{name}: {property_name}={payload}")


def format_report(report: dict[str, Any]) -> str:
    lines = ["clean" if report.get("clean") else "DEFECTS"]
    for key, value in (report.get("counts") or {}).items():
        marker = "!" if key in BLOCKING and value else " "
        lines.append(f"{marker} {key:28} {value}")
    for key, values in (report.get("samples") or {}).items():
        if key not in BLOCKING:
            continue
        lines.append(f"-- {key}")
        lines.extend(f"     {item}" for item in values)
    return "\n".join(lines)
