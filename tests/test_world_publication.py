"""A release must never become active before its dependency closure is complete."""
import argparse, gzip, importlib.util, json
from pathlib import Path
import pytest

@pytest.fixture
def publication(tmp_path, monkeypatch):
    script=Path(__file__).resolve().parents[2]/'web/scripts/publish-world.py'
    spec=importlib.util.spec_from_file_location('publish_world',script)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    world=tmp_path/'world';runtime=tmp_path/'runtime';old=tmp_path/'old'
    for name,value in [('WORLD',world),('RUNTIME',runtime),('OLD',old),('ROOTS',[world,runtime,old])]:monkeypatch.setattr(module,name,value)
    def write(root,relative,doc):
        p=root/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(doc))
    write(world,'inventory.json',{'version':'test','maps':{'1':'source.bundle'}})
    write(world,'maps-report.json',{'1':{'props':[],'missing_gfx':[]}})
    write(world,'texture-variants.json',{'7':{'fallback':True}})
    write(world,'gfx/_catalog.json',{'7':{'texture':'gfx/7.png'}})
    write(world,'unsupported-props.json',{})
    for root in (world,runtime):write(root,'optimized/entities-manifest.json',{'entities':{},'previews':{}})
    write(runtime,'optimized/manifest.json',{'maps':{}})
    doc={'format':'giny.dofus3.map.v3','id':1,'cells':[{'id':i} for i in range(560)],'props':[],
         'elements':[{'gfx_id':7,'layer':'background','blend':'normal'}],'gfx':{'7':{'texture':'gfx/7.png'}}}
    p=world/'maps/1.json.gz';p.parent.mkdir();p.write_bytes(gzip.compress(json.dumps(doc).encode()))
    (world/'gfx/7.png').write_bytes(b'test resource')
    return module,world,tmp_path/'game-data'

def test_publication_has_local_hashed_map_and_dependencies(publication):
    module,world,dest=publication;module.main(argparse.Namespace(output=dest))
    manifest=json.loads((dest/'optimized/manifest.json').read_bytes())
    assert (dest/(manifest['maps']['1']['path']+'.gz')).exists()
    assert (dest/'gfx/7.png').read_bytes()==b'test resource'
    assert json.loads((dest/'release-report.json').read_bytes())['missing_files']==[]

def test_missing_texture_prevents_publication(publication):
    module,world,dest=publication;(world/'gfx/7.png').unlink()
    with pytest.raises(RuntimeError,match='Release incomplete'):module.main(argparse.Namespace(output=dest))
    assert not dest.exists()
    stage=dest.with_name(dest.name+'.staging')
    assert not (stage/'optimized/manifest.json').exists()
    assert 'gfx/7.png' in json.loads((stage/'release-report.json').read_bytes())['missing_files']

def test_unfinished_compression_prevents_publication(publication):
    module,world,dest=publication;(world/'texture-variants.json').write_text('{}')
    with pytest.raises(RuntimeError,match='still incomplete'):module.main(argparse.Namespace(output=dest))
    assert not dest.exists()

def test_atlas_reuse_requires_exact_pixels_and_keeps_fresh_map_data(tmp_path):
    from PIL import Image
    script=Path(__file__).resolve().parents[2]/'web/scripts/prepare-assets.py'
    spec=importlib.util.spec_from_file_location('assets_reuse',script)
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    source=tmp_path/'source';atlas=tmp_path/'atlas';source.mkdir();atlas.mkdir()
    Image.new('RGBA',(2,2),(20,50,70,255)).save(source/'sprite.png')
    page=Image.new('RGBA',(4,4));page.paste((20,50,70,255),(1,1,3,3));page.save(atlas/'page.png')
    metadata={'width':2,'height':2,'pivot':[.5,.5],'offset':[0,0],'pixels_per_unit':100}
    previous={'gfx':{'7':{**metadata,'texture':'page.png','frame':[1,1,2,2]}}}
    doc={'cells':[{'fresh':True}],'gfx':{'7':{**metadata,'texture':'sprite.png'}}}
    assert a.reuse_atlas_frames(doc,previous,source,atlas)==1
    assert doc['gfx']['7']['frame']==[1,1,2,2]
    assert doc['cells']==[{'fresh':True}]
    Image.new('RGBA',(2,2),(200,50,70,255)).save(source/'sprite.png')
    changed={'gfx':{'7':{**metadata,'texture':'sprite.png'}}}
    assert a.reuse_atlas_frames(changed,previous,source,atlas)==0
    assert changed['gfx']['7']['texture']=='sprite.png'


def test_atlas_resume_checks_actual_map_and_page_payloads(tmp_path):
    import hashlib
    script=Path(__file__).resolve().parents[2]/'web/scripts/prepare-world-atlases.py'
    spec=importlib.util.spec_from_file_location('world_atlas_resume',script)
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    root=tmp_path/'atlas';(root/'optimized/pages').mkdir(parents=True)
    (root/'optimized/maps').mkdir()
    page=root/'optimized/pages/a.webp';page.write_bytes(b'original pixels')
    doc={'id':1,'gfx':{'7':{'texture':'optimized/pages/a.webp'}}}
    raw=a.a.compact(doc)
    entry={'path':'optimized/maps/1.json','hash':hashlib.sha256(raw).hexdigest()}
    mp=root/'optimized/maps/1.json.gz';mp.write_bytes(gzip.compress(raw))
    manifest=root/'optimized/manifest.json';manifest.write_text(json.dumps({'maps':{'1':entry}}))
    initial=a.output_fingerprint(root,['1'])
    assert initial is not None
    assert a.output_fingerprint(root,['1'])==initial
    page.write_bytes(b'corrupt pixels')
    assert a.output_fingerprint(root,['1'])!=initial
    page.unlink()
    assert a.output_fingerprint(root,['1']) is None
    page.write_bytes(b'original pixels')
    mp.write_bytes(gzip.compress(b'{"id":1,"gfx":{}}'))
    assert a.output_fingerprint(root,['1']) is None
    mp.write_bytes(b"\x1f\x8b")
    assert a.output_fingerprint(root,['1']) is None
    mp.unlink()
    assert a.output_fingerprint(root,['1']) is None


def test_atlas_preparation_retains_standalone_compressed_pages(tmp_path):
    from PIL import Image
    from types import SimpleNamespace
    script=Path(__file__).resolve().parents[2]/'web/scripts/prepare-assets.py'
    spec=importlib.util.spec_from_file_location('atlas_retained_pages',script)
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    source=tmp_path/'source';target=tmp_path/'target'
    (source/'gfx').mkdir(parents=True);(source/'maps').mkdir()
    (source/'optimized/pages').mkdir(parents=True)
    Image.new('RGBA',(2,2),(20,50,70,255)).save(source/'gfx/7.png')
    retained=source/'optimized/pages/standalone.ktx2';retained.write_bytes(b'existing compressed payload')
    doc={'format':'giny.dofus3.map.v3','id':1,'cells':[{}]*560,
         'elements':[{'gfx_id':7,'layer':'animated'}],
         'gfx':{'7':{'texture':'gfx/7.png','bc7_texture':'optimized/pages/standalone.ktx2'}}}
    (source/'maps/1.json').write_text(json.dumps(doc))
    a.prepare(SimpleNamespace(source=str(source),output=str(target),maps='1',bc7=False,extract=False))
    assert (target/'optimized/pages/standalone.ktx2').read_bytes()==retained.read_bytes()
    manifest=json.loads((target/'optimized/manifest.json').read_bytes())
    output=a.read_doc(target/(manifest['maps']['1']['path']+'.gz'))
    assert output['gfx']['7']['bc7_texture']=='optimized/pages/standalone.ktx2'
