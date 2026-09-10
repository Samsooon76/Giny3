"""Reader for Dofus 3 `I18n/*.bin` (`Core.Localization.LocalizationTable`).

The on-disk layout is what `LocalizationTableHeader.ReadFrom` reads, proved
against `fr.bin` rather than guessed:

* a Unity 7-bit-length UTF-8 language code (`fr`);
* the integer table: `u32 count` then `(u32 key, u32 offset) * count`, sorted
  by key — DataRoot `nameId` / `descriptionId` land here;
* the string table: `u32 count` then `(u64 fnv1a, u32 offset) * count` —
  named UI keys (`ui.common.level`) land here;
* each offset points at a 7-bit-length UTF-8 payload.

`StringToHash` is FNV-1a 64 (`0xcbf29ce484222325` / `0x100000001b3`), matching
the constants `LocalizationTableHeader.StringToHash` materialises.
"""

from __future__ import annotations

import gzip
import json
import re
import struct
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT

I18N_RELATIVE = Path("DofusContent") / "Content" / "I18n"

FNV_OFFSET = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3

_PASCAL = re.compile(r"[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z][a-z0-9]*|[0-9]+")

#: Keys the web client already looks up. Recovered from GeneratedTexts when
#: possible; these are always hashed against the file so acronyms like
#: `ui.stats.PAAttack` still resolve.
SEED_KEYS = (
    "ui.common.level",
    "ui.common.inventory",
    "ui.common.recipes",
    "ui.common.filter",
    "ui.common.allCategories",
    "ui.common.none",
    "ui.common.quantity",
    "ui.common.search",
    "ui.common.cancel",
    "ui.common.validation",
    "ui.common.hideNames",
    "ui.common.weight",
    "ui.common.experience",
    "ui.common.energy",
    "ui.widgetMinimap",
    "ui.preset.equipPreset",
    "ui.preset.myPresets",
    "ui.preset.lastPresets",
    "ui.preset.showPresetList",
    "ui.stats.actionPoints",
    "ui.stats.movementPoints",
    "ui.stats.range",
    "ui.stats.criticalHit",
    "ui.stats.damagesBonusPercent",
    "ui.stats.summonableCreatures",
    "ui.stats.prospecting",
    "ui.stats.initiative",
    "ui.stats.healBonus",
    "ui.stats.dodgeAP",
    "ui.stats.dodgeMP",
    "ui.stats.takleBlock",
    "ui.stats.takleEvade",
    "ui.stats.PAAttack",
    "ui.stats.PMAttack",
    "ui.stats.return",
    "ui.stats.lifePoints",
    "ui.characterInformations.currentHp",
    "ui.characterInformations.currentAndTotalHp",
    "ui.characterInformations.Pi",
    "ui.charaSheet.pointsRemaining",
    "ui.charaSheet.distributeMyPoints",
    "ui.grimoire.quest.objectives",
    "ui.grimoire.quest.searchQuest",
    "ui.grimoire.pendingQuests",
    "ui.grimoire.completedQuests",
    "ui.grimoire.hiddenQuests",
    "ui.social.ankamaFriends",
    "ui.social.contactsInGame",
    "ui.social.contactInGameBlocked",
    "ui.social.addContact",
    "ui.social.noFriends",
    "ui.social.noInGameContacts",
    "ui.social.displayOfflineGuildMembers",
    "ui.social.warnWhenGuildMembersComeOnline",
    "ui.guild.contribute",
    "ui.charcrea.faces",
    "ui.charcrea.body",
    "ui.charcrea.idle",
    "ui.charcrea.colors",
    "ui.cosmetic.hideUnavailableFaces",
    "ui.cosmetic.notObtained",
    "ui.craft.conditionalRecipes",
    "ui.craft.possibleRecipes",
    "ui.craft.allJobs",
)


def fnv1a64(text: str) -> int:
    """FNV-1a 64, the hash `LocalizationTableHeader.StringToHash` computes."""
    value = FNV_OFFSET
    for byte in text.encode("utf-8"):
        value ^= byte
        value = (value * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
    return value


def read_7bit_string(data: bytes, at: int) -> tuple[str, int]:
    """Unity `BinaryReader.ReadString`: 7-bit length, then UTF-8."""
    length = shift = 0
    while True:
        if at >= len(data):
            raise ValueError("truncated 7-bit length")
        byte = data[at]
        at += 1
        length |= (byte & 0x7F) << shift
        if not byte & 0x80:
            break
        shift += 7
        if shift > 35:
            raise ValueError("7-bit length overflow")
    end = at + length
    if end > len(data):
        raise ValueError(f"string at {at} overruns the file")
    return data[at:end].decode("utf-8"), end


def _pascal_tokens(name: str) -> list[str]:
    return _PASCAL.findall(name)


def _camel(tokens: list[str]) -> str:
    if not tokens:
        return ""
    head, *rest = tokens
    head = head if head.isupper() and len(head) > 1 else head.lower()
    tail = "".join(
        token if token.isupper() and len(token) > 1 else token[:1].upper() + token[1:]
        for token in rest
    )
    return head + tail


def _key_candidates(field: str, type_name: str) -> list[str]:
    """PascalCase GeneratedTexts field → possible `ui.*` keys.

    The file only stores FNV-1a hashes, so the original key is recovered from
    the unobfuscated field name. Several layouts exist (`ui.common.level`,
    `ui.widgetMinimap`, `ui.alert.event.1`); each candidate is checked against
    the hash table, and against the field's stored length when present.
    """
    body = field[2:] if field.startswith("Ui") else field
    tokens = _pascal_tokens(body)
    out: list[str] = []
    if tokens:
        out.append("ui." + _camel(tokens))
    if len(tokens) >= 2:
        out.append(f"ui.{tokens[0].lower()}.{_camel(tokens[1:])}")
    if type_name.startswith("ui_") and type_name.endswith("TextEntries"):
        category = type_name[3:-12]
        prefix = "Ui" + category[:1].upper() + category[1:]
        rest = field[len(prefix) :] if field.startswith(prefix) else body
        rest_tokens = _pascal_tokens(rest)
        if rest_tokens:
            out.append(f"ui.{category}.{_camel(rest_tokens)}")
    if len(tokens) >= 3 and tokens[-1].isdigit():
        out.append(f"ui.{tokens[0].lower()}.{_camel(tokens[1:-1])}.{tokens[-1]}")
    # Unique, stable order.
    seen: set[str] = set()
    unique: list[str] = []
    for key in out:
        if key not in seen:
            seen.add(key)
            unique.append(key)
    return unique


class LocalizationTable:
    """Random-access reader over one `I18n/{lang}.bin`."""

    def __init__(self, data: bytes):
        self.data = data
        self.language, cursor = read_7bit_string(data, 0)
        int_count = struct.unpack_from("<I", data, cursor)[0]
        cursor += 4
        self._int_at = cursor
        self.int_count = int_count
        cursor += int_count * 8
        str_count = struct.unpack_from("<I", data, cursor)[0]
        cursor += 4
        self._hash_at = cursor
        self.string_count = str_count
        self._hash_index: dict[int, int] | None = None

    @classmethod
    def open(cls, path: Path) -> "LocalizationTable":
        return cls(Path(path).read_bytes())

    @classmethod
    def from_client(cls, client_root: Path = DEFAULT_CLIENT, language: str = "fr") -> "LocalizationTable":
        path = Path(client_root) / I18N_RELATIVE / f"{language}.bin"
        if not path.exists():
            raise FileNotFoundError(f"I18n table missing: {path}")
        return cls.open(path)

    def _int_pair(self, index: int) -> tuple[int, int]:
        return struct.unpack_from("<II", self.data, self._int_at + index * 8)

    def lookup_id(self, key: int) -> str | None:
        """The string for a DataRoot `nameId`, or None when the id is absent."""
        lo, hi = 0, self.int_count - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            found, offset = self._int_pair(mid)
            if found == key:
                text, _ = read_7bit_string(self.data, offset)
                return text
            if found < key:
                lo = mid + 1
            else:
                hi = mid - 1
        return None

    def _hashes(self) -> dict[int, int]:
        if self._hash_index is None:
            index: dict[int, int] = {}
            at = self._hash_at
            for _ in range(self.string_count):
                digest, offset = struct.unpack_from("<QI", self.data, at)
                index[digest] = offset
                at += 12
            self._hash_index = index
        return self._hash_index

    def lookup_key(self, key: str) -> str | None:
        """The string for a named UI key (`ui.common.level`), or None."""
        offset = self._hashes().get(fnv1a64(key))
        if offset is None:
            return None
        text, _ = read_7bit_string(self.data, offset)
        return text

    def iter_ids(self):
        """Yield `(nameId, text)` for every integer-keyed entry."""
        for i in range(self.int_count):
            key, offset = self._int_pair(i)
            text, _ = read_7bit_string(self.data, offset)
            yield key, text

    def named_strings(self, extra_keys: tuple[str, ...] = SEED_KEYS) -> dict[str, str]:
        """Recover `ui.*` keys from GeneratedTexts and resolve them.

        Hashes without a recovered name are omitted: the integer table is the
        complete set, the named table is a convenience for UI keys."""
        keys = set(extra_keys)
        try:
            keys.update(_generated_text_keys())
        except FileNotFoundError:
            pass
        out: dict[str, str] = {}
        for key in sorted(keys):
            text = self.lookup_key(key)
            if text is not None:
                out[key] = text
        return out


def _generated_text_keys(client_root: Path = DEFAULT_CLIENT) -> set[str]:
    """Unobfuscated GeneratedTexts field names folded into `ui.*` keys."""
    from extractor.il2cpp.metadata import Metadata

    md = Metadata(client_root)
    keys: set[str] = set()
    for index in range(md.type_count):
        typedef = md.type_def(index)
        if typedef.namespace != "Core.Localization.GeneratedTexts":
            continue
        for field, _length in typedef.enum_members():
            keys.update(_key_candidates(field, typedef.name))
    return keys


def extract_i18n(client_root: Path = DEFAULT_CLIENT, language: str = "fr") -> dict:
    table = LocalizationTable.from_client(client_root, language)
    return {
        "format": "giny.dofus3.i18n.v1",
        "language": table.language,
        "strings": table.named_strings(),
        "by_id": {str(key): text for key, text in table.iter_ids()},
    }


def write_i18n(
    dest_dir: Path,
    client_root: Path = DEFAULT_CLIENT,
    language: str = "fr",
) -> Path:
    """Write `i18n.json.gz` next to the other extracted client tables."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    payload = extract_i18n(client_root, language)
    gz_path = dest_dir / "i18n.json.gz"
    with gzip.open(gz_path, "wt", compresslevel=6, encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    plain = dest_dir / "i18n.json"
    if plain.exists():
        plain.unlink()
    return gz_path
