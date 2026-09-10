"""Extract Bubble's native spell planner and trail geometry, checking ASAR integrity."""
import hashlib, json, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DEST=ROOT/'client/web/src/game/combat'
with (ROOT/'resources/app.asar').open('rb') as f:
 h=struct.unpack('<4I',f.read(16));entries=json.loads(f.read(h[3]))['files']['dist']['files']['assets']['files']
 def read(name):
  e=entries[name];f.seek(8+h[1]+int(e['offset']));raw=f.read(e['size'])
  assert hashlib.sha256(raw).hexdigest()==e['integrity']['hash']
  return raw.decode()
 source=read('game-entry-D5YuSIvZ.js');utils=read('data-loader-utils-Btf16hSR.js')
 def function(s,name):
  start=s.index('function '+name+'(');end=s.index('function ',start+9)
  return s[start:end]
 constants='const CXe="wait-for-all",'+source[source.index('Lr={casterAnimation:'):source.index(';function GR(')]+ ';\n'
 native=source[source.index('function tZe('):source.index('function dZe(')]
 trails=source[source.index('function Rce('):source.index('function vZe(')]
 helpers=''.join(function(source,n) for n in ['Nk','Gf','V5','Ro','Ece','SZe','Cet','KH','dZe','uZe','eh','Qv','Rd','$f','th','wZe','Xv','Zv','Jv'])
 validators=''.join(function(utils,n) for n in ['we','ge','de','he','pe'])+'const Sy=we,Gr=ge,Ct=de,An=he,Kr=pe;\n'
 header='''/* Generated from local Bubble, SHA-256 verified. Regenerate with scripts/import-bubble-spell-sequences.py. */
import { cellPoint as Bi, pointCell as Is, parseZone as Bd } from './bubbleSpellGeometry.js';
const IXe=51,Mce=e=>e.portalCells??[];
const jm=e=>Number.isInteger(e)&&e>=0&&e<560,Tc=e=>e!=null&&(e.l&1)!==0&&(e.l&16)===0;
'''
 wrapper='''\nexport function nativeSpellPlan(context) {
 const e={sourceId:0,steps:[],latestStep:null,frontIndex:0,cellsData:[],spellLevelDef:{effects:[]},...context};
 tZe(e);return e.steps;
}
export function legacySpellPlan(context) {
 const e={sourceId:0,steps:[],latestStep:null,frontIndex:0,portalAnimationAnchor:{},spellLevelDef:{effects:[]},...context};
 if(context.scriptData.type===1)dZe(e);else if(context.scriptData.type===2)uZe(e);else throw new Error('Unsupported legacy script '+context.scriptData.type);
 return e.steps;
}
export { mZe as trailLineCells, Cet as missileDuration, KH as missileRotation };
'''
 (DEST/'bubbleSpellSequences.js').write_text(header+constants+validators+native+trails+helpers+wrapper)
 (ROOT/'client/web/public/combat-assets/spell-sequences-provenance.json').write_text(json.dumps({n:entries[n]['integrity'] for n in ['game-entry-D5YuSIvZ.js','data-loader-utils-Btf16hSR.js']},indent=2))
print('Imported Bubble native spell sequences and trail geometry (SHA-256 verified).')
