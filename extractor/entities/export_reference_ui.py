"""Export reusable catalogue illustrations; no screenshots are used as UI assets."""
from pathlib import Path
from extractor.unity_loader import content_root, load_bundle


def export_reference_ui(client_root: Path, output_dir: Path):
    source = content_root(client_root) / 'Picto/UI'
    for category, bundle in [('companions', 'companion_assets_.bundle'), ('calendar', 'calendar_assets_.bundle'), ('guide', 'guidebook_assets_all.bundle')]:
        destination = output_dir / 'client/illustrations' / category
        destination.mkdir(parents=True, exist_ok=True)
        for obj in load_bundle(source / bundle).objects:
            if obj.type.name != 'Sprite':
                continue
            sprite = obj.read()
            sprite.image.save(destination / f'{sprite.m_Name}.png')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    export_reference_ui(args.client, args.out)
