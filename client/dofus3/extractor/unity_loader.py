"""Thin UnityFS loader on top of UnityPy.

Dofus 3 bundles advertise unityVersion ``5.x.x`` / revision ``0.0.0``.
UnityPy therefore needs an explicit fallback. We do **not** reimplement
UnityFS/LZ4/LZMA: that already lives in doduda (Go) and UnityPy.
"""

from __future__ import annotations

import warnings
from pathlib import Path

from UnityPy import config
from UnityPy.environment import Environment

# Observed from Dofus.app (Unity 6 / IL2CPP). The bundle header is a stub.
FALLBACK_UNITY_VERSION = "2022.3.0f1"

DEFAULT_CLIENT = Path("/Applications/Ankama/Dofus-dofus3")


def content_root(client_root: Path) -> Path:
    return Path(client_root) / "DofusContent" / "Content"


def load_bundle(path: Path | str) -> Environment:
    config.FALLBACK_UNITY_VERSION = FALLBACK_UNITY_VERSION
    warnings.filterwarnings("ignore", message="No valid Unity version found")
    return Environment(str(path))


def iter_monobehaviours(env: Environment):
    for obj in env.objects:
        if obj.type.name == "MonoBehaviour":
            yield obj, obj.read_typetree()


def iter_typed(env: Environment, type_name: str):
    for obj in env.objects:
        if obj.type.name == type_name:
            yield obj


PLAYER_DATA_RELATIVE = Path("Dofus.app") / "Contents" / "Resources" / "Data"


def player_data_root(client_root: Path) -> Path:
    return Path(client_root) / PLAYER_DATA_RELATIVE


def client_version(client_root: Path = DEFAULT_CLIENT) -> str | None:
    """`Version=` out of StreamingAssets/version, so a dump dates itself.

    Every table read off the build is only true for one build: the name of an
    obfuscated type is reshuffled by the next patch. Returns None rather than
    raising, because a missing version file must not fail an extraction."""
    path = player_data_root(client_root) / "StreamingAssets" / "version"
    if not path.exists():
        return None
    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("Version="):
            return line.split("=", 1)[1].strip()
    return None
