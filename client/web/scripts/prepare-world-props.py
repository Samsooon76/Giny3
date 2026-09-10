#!/usr/bin/env python3
"""Prepare clips for the props in the whole-world staging directory."""
import importlib.util
from pathlib import Path
import sys, json, shutil
spec=importlib.util.spec_from_file_location('entities',Path(__file__).with_name('prepare-entities.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
root=e.BASE/'.cache/dofus3/world'
e.ROOTS=[root];e.TARGET=root
# No positional filters: build a complete manifest for the staged world props.
sys.argv=[sys.argv[0]]
e.main()

# Keep original animation bytes for decoder variants the current preparer cannot draw.
manifest=json.loads((root/'optimized/entities-manifest.json').read_bytes())
state=json.loads((root/'extraction-state.json').read_bytes())
source=Path(state.get('client_root','/Applications/Ankama/Dofus-dofus3'))/'DofusContent/Content/Animations/Props'
unsupported={}
for p in (root/'entities').glob('prop_*.json.gz'):
    relative='entities/'+p.name.removesuffix('.gz')
    if relative in manifest['entities']:continue
    pid=p.name.split('_')[1].split('.')[0]
    doc=e.assets.read_doc(p)
    unsupported[pid]={'skipped_animations':doc.get('skipped_animations',[]),'decoded_clips':len(doc.get('animations',{}))}
    original=source/f'props_assets_prop_{pid}.bundle'
    if original.exists():
        dest=root/'unsupported/props'/original.name;dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists():shutil.copy2(original,dest)
e.assets.atomic(root/'unsupported-props.json',e.assets.compact(unsupported))
