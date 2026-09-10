"""Import pure spell geometry/LOS and the unmodified preview worker from local Bubble."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DEST=ROOT/'client/web/src/game/combat'
with (ROOT/'resources/app.asar').open('rb') as f:
    h=struct.unpack('<4I',f.read(16));tree=json.loads(f.read(h[3]));entries=tree['files']['dist']['files']['assets']['files']
    def read(name):
        e=entries[name];f.seek(8+h[1]+int(e['offset']));raw=f.read(e['size'])
        assert hashlib.sha256(raw).hexdigest()==e['integrity']['hash']
        return raw.decode()
    source=read('game-entry-D5YuSIvZ.js')
    worker=read('fight-damage-preview-worker-Cn1mce5-.js')
    los=worker[worker.index('const Zi=new Map,Pr=19;'):worker.index('class Lr{')]
    shapes=source[source.index('const ODe=Lt("SpellShapes"),'):source.index('const zn={EQUIPPED:')]
    shapes=shapes.replace('const ODe=Lt("SpellShapes"),','const ODe=console,')
    prelude='const Bi=Pi,Is=Ar,Tc=e=>e!=null&&(e.l&1)!==0&&(e.l&16)===0;\n'
    (DEST/'bubbleSpellGeometry.js').write_text('/* eslint-disable -- Generated pure Bubble spell geometry. */\n'+los+'\n'+prelude+shapes+'\nexport {Bd as parseZone,iPe as zoneCells,oPe as rangePoints,Pi as cellPoint,Ar as pointCell,wr as lineOfSight};\n')
    out=ROOT/'client/web/public/combat-assets'
    (out/'damage-preview-worker.js').write_text(worker)
    (out/'spell-preview-provenance.json').write_text(json.dumps({n:entries[n]['integrity'] for n in ['game-entry-D5YuSIvZ.js','fight-damage-preview-worker-Cn1mce5-.js']},indent=2))
print('Imported Bubble spell shapes, LOS and damage worker (SHA-256 verified).')
