"""The interfaces the official client can open, read off its own input asset.

The `bannerMenu` UXML ships an empty SlotGrid: which tiles it holds is decided
by compiled C#. The metadata names the shape (`fmp` has 25 members plus a
sentinel, `lr` is one entry) but the sprite strings are encrypted, and the
persisted UI preset does not list them either. What *is* shipped as data is
`InputPreset1`, the client's InputActionAsset: its `Menu` action map enumerates
every openable interface with the default key Ankama binds to it.

So this reads the client's own list rather than inventing one. It is the set of
interfaces, in the asset's order, not a claim about which of them the banner
puts on a tile — `{{ui,bannerMenu,gd_btnUis|uriName|btn_idols}}` in the I18n
proves the banner also carries entries with no shortcut at all.
"""

from __future__ import annotations

import json
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT, load_bundle
from extractor.ui.catalog import STANDALONE_BUNDLE_DIR

INPUT_BUNDLE = "inputactionassets_assets_all.bundle"

#: Ankama's default preset. The others are alternate keyboard layouts.
PRESET = "InputPreset1"

#: A composite's own row carries its type here, not a control path.
COMPOSITES = frozenset({
    "ButtonWithOneModifier", "ButtonWithTwoModifiers", "OneModifier", "TwoModifiers",
})

#: The asset keeps every composite slot and blanks the unused ones with this
#: sentinel rather than dropping the row.
UNBOUND = "DontShowBinding"


def _key(path: str) -> str | None:
    """`<Keyboard>/semicolon` -> `semicolon`. `<Keyboard>/#(L)` -> `l`."""
    if not path or path == UNBOUND or path in COMPOSITES:
        return None
    control = path.rsplit("/", 1)[-1]
    if control.startswith("#(") and control.endswith(")"):
        control = control[2:-1]
    return control.lower() or None


def _bindings(rows: list[dict]) -> dict:
    """Fold one action's rows into `{key, modifiers}`.

    The plain default is the row with no `m_Name`; a composite contributes its
    `modifier*` rows plus a `button`. An action can ship only the composite
    (Apparence is shift+C and has no bare key)."""
    plain: str | None = None
    modifiers: list[str] = []
    button: str | None = None
    for row in rows:
        name = (row.get("m_Name") or "").lower()
        control = _key(row.get("m_Path") or "")
        if not name:
            plain = plain or control
        elif name.startswith("modifier"):
            if control:
                modifiers.append(control)
        elif name == "button" and control:
            button = button or control
    if plain:
        return {"key": plain, "modifiers": []}
    if button:
        return {"key": button, "modifiers": modifiers}
    return {"key": None, "modifiers": []}


def extract_menu_actions(client_root: Path = DEFAULT_CLIENT) -> list[dict]:
    """The `Menu` action map, in the order the asset declares it."""
    bundle = Path(client_root) / STANDALONE_BUNDLE_DIR / INPUT_BUNDLE
    env = load_bundle(bundle)
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        if tree.get("m_Name") != PRESET:
            continue
        for action_map in tree.get("m_ActionMaps") or []:
            if action_map.get("m_Name") != "Menu":
                continue
            rows: dict[str, list[dict]] = {}
            for binding in action_map.get("m_Bindings") or []:
                rows.setdefault(binding.get("m_Action") or "", []).append(binding)
            return [
                {"action": action["m_Name"], **_bindings(rows.get(action["m_Name"], []))}
                for action in action_map.get("m_Actions") or []
            ]
    raise LookupError(f"{PRESET} has no Menu action map in {bundle.name}")


def write_menu_actions(ui_root: Path, client_root: Path = DEFAULT_CLIENT) -> Path:
    """Write `menuActions.json` next to the other extracted UI tables."""
    actions = extract_menu_actions(client_root)
    dest = Path(ui_root) / "menuActions.json"
    dest.write_text(json.dumps({"preset": PRESET, "actions": actions}, indent=1) + "\n")
    return dest


#: The enum a C# caller passes when it sets an icon on a UITK element. Its
#: members are the icon namespace; the value is the declaration index.
ICON_ENUM = "FigmaIcons"


def extract_figma_icons(client_root: Path = DEFAULT_CLIENT) -> list[str]:
    """`FigmaIcons` members, in value order, so index == enum value.

    A neighbourhood read of the string table after the type name used to
    return 273 members and drop 60, including `none`, `alliance` and `zaap`.
    The type definition's field range plus the compressed default-value blob
    is the complete 0..332 run — see `docs/IL2CPP.md`."""
    from extractor.il2cpp.metadata import Metadata

    types = Metadata(client_root).types_named(ICON_ENUM)
    if not types:
        raise LookupError(f"{ICON_ENUM} is not in the IL2CPP metadata")
    enum = max(types, key=lambda item: len(item.field_range))
    ranked = sorted(
        ((value, name) for name, value in enum.enum_members() if value is not None),
        key=lambda item: item[0],
    )
    if not ranked or ranked[0][0] != 0:
        raise ValueError(f"{ICON_ENUM}: expected a 0-based contiguous enum")
    names: list[str] = []
    for expected, (value, name) in enumerate(ranked):
        if value != expected:
            raise ValueError(f"{ICON_ENUM}: gap at {expected}, next is {name}={value}")
        names.append(name)
    return names


def write_figma_icons(ui_root: Path, client_root: Path = DEFAULT_CLIENT) -> Path:
    """Write `figmaIcons.json`: the icon namespace C# can name, value-indexed."""
    members = extract_figma_icons(client_root)
    dest = Path(ui_root) / "figmaIcons.json"
    dest.write_text(json.dumps({"enum": ICON_ENUM, "members": members}, indent=1) + "\n")
    return dest
