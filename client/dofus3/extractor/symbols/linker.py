"""`link.xml`: the types the build promises not to strip, in plain XML.

The IL2CPP build strips managed code, so anything reached only by reflection
has to be declared. Addressables writes that declaration next to the catalog,
and it is the one authoritative list the client ships as text: 19 assemblies,
295 types, full namespaces, no obfuscation and no parsing to invent.

Two things make it worth reading rather than skimming.

`preserve="nothing" serialized="true"` is a type Unity deserializes from an
asset. That is not a preference — it means an asset in some bundle holds a
blob shaped exactly like that type. Reading such a bundle without the name is
guesswork; with it, the shape is known before the first byte.

The `Foo/UxmlSerializedData` rows are UI Toolkit's per-element serialization
holders, one per custom element the UI declares. Stripped of that suffix they
are the **complete set of custom UXML tags** the official interface uses —
`DofusButton`, `Combobox`, `CircularGauge`, `ExtendedProgressBarLong`. A UXML
tree that mentions a tag absent from a reimplementation renders as nothing,
and that failure is silent, so the list is a parity checklist for the web
client rather than trivia.

A tag can be claimed twice: `RadioButton` is both Ankama's Figma component and
UI Toolkit's built-in, and a UXML file writes `<RadioButton>` for either — which
one it gets is decided by the document's xmlns. A reimplementation that maps the
tag to the built-in silently renders the wrong component inside a Figma tree, so
the collisions are reported as data instead of being deduplicated away.

`nested` is set for a `Outer/Inner` fullname: UI Toolkit's holders are always
nested, and Unity's `/` is not the CLR's `+`, so the distinction is kept
explicit rather than left to the reader.
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT, client_version, player_data_root

FORMAT = "giny.dofus3.link-preserved.v1"

LINK_RELATIVE = Path("StreamingAssets") / "aa" / "AddressablesLink" / "link.xml"

#: UI Toolkit names its generated serialization holder after the element.
UXML_HOLDER = "/UxmlSerializedData"


def source_path(client_root: Path = DEFAULT_CLIENT) -> Path:
    return player_data_root(client_root) / LINK_RELATIVE


def _assembly_name(fullname: str) -> str:
    """`Core, Version=0.0.0.0, Culture=neutral, …` -> `Core`."""
    return fullname.split(",", 1)[0].strip()


def collect(client_root: Path = DEFAULT_CLIENT) -> dict:
    """Parse `link.xml` into assemblies, types and the UXML tag list."""
    path = source_path(client_root)
    if not path.exists():
        raise FileNotFoundError(f"link.xml absent: {path}")
    root = ET.parse(path).getroot()

    assemblies: list[dict] = []
    types: list[dict] = []
    for node in root.findall("assembly"):
        fullname = node.get("fullname") or ""
        name = _assembly_name(fullname)
        rows = []
        for type_node in node.findall("type"):
            type_full = type_node.get("fullname") or ""
            row = {
                "assembly": name,
                "fullname": type_full,
                "preserve": type_node.get("preserve") or "",
                "serialized": (type_node.get("serialized") or "").lower() == "true",
                "nested": "/" in type_full,
            }
            rows.append(row)
            types.append(row)
        assemblies.append(
            {
                "name": name,
                "fullname": fullname,
                "preserve": node.get("preserve") or "",
                "types": len(rows),
                "serialized": sum(1 for r in rows if r["serialized"]),
            }
        )

    uxml = sorted(
        row["fullname"][: -len(UXML_HOLDER)]
        for row in types
        if row["fullname"].endswith(UXML_HOLDER)
    )
    collisions: dict[str, list[str]] = {}
    for full in uxml:
        collisions.setdefault(full.rsplit(".", 1)[-1], []).append(full)
    collisions = {tag: names for tag, names in collisions.items() if len(names) > 1}

    return {
        "format": FORMAT,
        "source": f"Dofus.app/Contents/Resources/Data/{LINK_RELATIVE.as_posix()}",
        "client_version": client_version(client_root),
        "counts": {
            "assemblies": len(assemblies),
            "types": len(types),
            "serialized": sum(1 for r in types if r["serialized"]),
            "nested": sum(1 for r in types if r["nested"]),
            "uxml_elements": len(uxml),
            "uxml_tag_collisions": len(collisions),
        },
        "assemblies": assemblies,
        "uxml_elements": uxml,
        "uxml_tag_collisions": collisions,
        "types": types,
    }


def uxml_tags(table: dict) -> list[str]:
    """The tag a UXML file writes for each custom element: its class name.

    Not a set: see `uxml_tag_collisions` for the tags two classes claim."""
    return [full.rsplit(".", 1)[-1] for full in table["uxml_elements"]]


def write_link_types(dest_root: Path, client_root: Path = DEFAULT_CLIENT) -> Path:
    """Write `linkTypes.json` — assemblies, preserved types, UXML elements."""
    table = collect(client_root)
    dest = Path(dest_root) / "linkTypes.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(table, indent=1) + "\n")
    return dest


def format_summary(table: dict) -> str:
    counts = table["counts"]
    lines = [
        f"link.xml: {counts['types']} types over {counts['assemblies']} assemblies,"
        f" client {table['client_version']}",
        f"  {counts['serialized']} deserialized from assets, {counts['uxml_elements']} custom UXML elements"
        + (f", {counts['uxml_tag_collisions']} tag collision(s): "
           + ", ".join(table["uxml_tag_collisions"]) if counts["uxml_tag_collisions"] else ""),
    ]
    for a in sorted(table["assemblies"], key=lambda a: -a["types"]):
        lines.append(f"    {a['types']:5d} {a['name']:44s} serialized={a['serialized']}")
    return "\n".join(lines)


def namespaces(table: dict) -> Counter:
    out: Counter = Counter()
    for full in table["uxml_elements"]:
        out[full.rsplit(".", 1)[0]] += 1
    return out
