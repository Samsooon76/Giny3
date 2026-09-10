"""Export the actual class symbols used by character creation/selection."""
from pathlib import Path
from extractor.unity_loader import content_root, load_bundle


def export_class_ui(client_root: Path, output_dir: Path) -> Path:
    bundle = content_root(client_root) / "Picto/UI/class_assets_.bundle"
    destination = output_dir / "client/class-icons"
    destination.mkdir(parents=True, exist_ok=True)
    for obj in load_bundle(bundle).objects:
        if obj.type.name != "Sprite":
            continue
        sprite = obj.read()
        if sprite.m_Name.startswith(("symbol_", "logo_transparent_")):
            sprite.image.save(destination / f"{sprite.m_Name}.png")
    return destination
