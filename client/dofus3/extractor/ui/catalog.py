"""Locate the official Dofus 3 install and hash its Addressables catalogs."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT, content_root, load_bundle

ADDRESSABLES_RELATIVE = Path("Dofus.app") / "Contents" / "Resources" / "Data" / "StreamingAssets" / "aa"
STANDALONE_BUNDLE_DIR = ADDRESSABLES_RELATIVE / "StandaloneOSX"
PLAYER_DATA_RELATIVE = Path("Dofus.app") / "Contents" / "Resources" / "Data"

#: Serialized files of the player build itself. They are not Addressables, so
#: nothing in the bundle catalog points at them, but the sprites TextMeshPro
#: draws inside a localized string live there and nowhere else.
PLAYER_FILES = ("sharedassets0.assets",)

CORE_UI_BUNDLES = (
    "uielements_assets_all.bundle",
    "tss_assets_all.bundle",
    "uidarkstone_assets_all.bundle",
    "uiassets_assets_.bundle",
    "uiassets_assets_1x.bundle",
    "uiassets_assets_2x.bundle",
    "icons_assets_1x.bundle",
    "icons_assets_2x.bundle",
    "titlescreen_assets_all.bundle",
    "data_assets_all.bundle",
    # External PPtr targets referenced by UI stylesheets. They are part of the
    # visual source and must invalidate the cache when the official client
    # updates them.
    "figs_assets_.bundle",
    "figs_assets_1x.bundle",
    "figs_assets_2x.bundle",
    "icons_assets_.bundle",
    "spriteassets_assets_1x.bundle",
    "spriteassets_assets_2x.bundle",
    "dofus_unity_unitybuiltinassets.bundle",
    # Opened while enumerating VisualTreeAssets; omitting them from the
    # fingerprint lets a mobile/world bundle change without invalidating cache.
    "mobile_assets_all.bundle",
    "worldassets_assets_all.bundle",
)

# Empty means the whole official UI catalog. Keeping this as a tuple makes it
# possible for tooling/tests to opt back into a narrow fixture scope without
# changing the exporter. The production cache is a migration source, so it
# must not silently omit windows which are not mounted by today's client yet.
SCOPE_TREES: tuple[str, ...] = ()


def detect_install(client_root: Path | None = None) -> Path:
    root = Path(client_root) if client_root is not None else DEFAULT_CLIENT
    if not root.exists():
        raise FileNotFoundError(f"installation officielle introuvable: {root}")
    if not (root / "DofusContent" / "Content").exists():
        raise FileNotFoundError(f"DofusContent absent sous {root}")
    if not addressables_root(root).exists():
        raise FileNotFoundError(f"catalogues Addressables absents sous {root}")
    return root


def addressables_root(client_root: Path) -> Path:
    return Path(client_root) / ADDRESSABLES_RELATIVE


def standalone_dir(client_root: Path) -> Path:
    return Path(client_root) / STANDALONE_BUNDLE_DIR


def player_file(client_root: Path, name: str) -> Path:
    return Path(client_root) / PLAYER_DATA_RELATIVE / name


def bundle_path(client_root: Path, name: str) -> Path:
    path = standalone_dir(client_root) / name
    if not path.exists():
        raise FileNotFoundError(f"bundle Addressables manquant: {path}")
    return path


def catalog_hash_files(client_root: Path) -> list[Path]:
    root = Path(client_root)
    files = [
        addressables_root(root) / "catalog.hash",
        content_root(root) / "Picto" / "UI" / "catalog_1.0.hash",
    ]
    return [path for path in files if path.exists()]


def catalog_fingerprint(client_root: Path) -> str:
    """Stable hash of official UI catalogs and the core Addressable bundles."""
    digest = hashlib.sha256()
    for path in catalog_hash_files(client_root):
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    for name in CORE_UI_BUNDLES:
        path = standalone_dir(client_root) / name
        if not path.exists():
            continue
        stat = path.stat()
        digest.update(name.encode("utf-8"))
        digest.update(str(stat.st_size).encode("ascii"))
        digest.update(str(int(stat.st_mtime_ns)).encode("ascii"))
        digest.update(b"\0")
    for name in PLAYER_FILES:
        path = player_file(client_root, name)
        if not path.exists():
            continue
        stat = path.stat()
        digest.update(name.encode("utf-8"))
        digest.update(str(stat.st_size).encode("ascii"))
        digest.update(str(int(stat.st_mtime_ns)).encode("ascii"))
        digest.update(b"\0")
    return digest.hexdigest()


def catalog_state(client_root: Path) -> list[dict[str, object]]:
    """Cheap cache-validation data that clients can verify without Python."""
    root = Path(client_root)
    candidates = catalog_hash_files(root)
    candidates.extend(
        standalone_dir(root) / name
        for name in CORE_UI_BUNDLES
        if (standalone_dir(root) / name).exists()
    )
    state: list[dict[str, object]] = []
    for path in candidates:
        stat = path.stat()
        state.append(
            {
                "path": str(path.relative_to(root)),
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()
                if path.suffix == ".hash"
                else "",
            }
        )
    return state


def load_ui_elements(client_root: Path):
    return load_bundle(bundle_path(client_root, "uielements_assets_all.bundle"))


def load_theme_sheets(client_root: Path):
    return load_bundle(bundle_path(client_root, "tss_assets_all.bundle"))


def load_figma_data(client_root: Path):
    return load_bundle(bundle_path(client_root, "data_assets_all.bundle"))


def read_manifest(cache_dir: Path) -> dict | None:
    path = cache_dir / "manifest.json"
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def cache_is_current(cache_dir: Path, client_root: Path) -> bool:
    manifest = read_manifest(cache_dir)
    if not manifest:
        return False
    expected = catalog_fingerprint(client_root)
    return str(manifest.get("catalog_hash", "")) == expected
