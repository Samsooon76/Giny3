"""Extract an Animator2D map prop (Animations/Props) as an entity document."""

from __future__ import annotations

from pathlib import Path

from extractor.entities.export_bone import export_animated_bundle
from extractor.unity_loader import content_root

# State clips + transitions (AnimState0_0 / AnimState1_0 / AnimState2_0 and
# AnimState*_to_AnimState*). Character idle/walk names are never kept.
PROP_ANIMATION_FILTER = {"AnimState*"}


def export_prop(
    client_root: Path,
    prop_id: int,
    output_dir: Path,
    scale: float = 1.0,
) -> Path:
    """Write ``entities/prop_<id>.json`` + texture from ``props_assets_prop_<id>``."""
    bundle = (
        content_root(client_root)
        / "Animations"
        / "Props"
        / f"props_assets_prop_{prop_id}.bundle"
    )
    return export_animated_bundle(
        bundle,
        output_dir,
        prop_id,
        dest_name=f"prop_{prop_id}.json",
        scale=scale,
        animation_filter=PROP_ANIMATION_FILTER,
        default_idle_walk=False,
        extra_fields={"prop_id": prop_id},
    )
