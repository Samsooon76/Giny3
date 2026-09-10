from pathlib import Path
from extractor.maps.export_map import build_map_document

def test_bulk_document_reuses_catalog_and_preloaded_tree(tmp_path, monkeypatch):
    import importlib
    module=importlib.import_module('extractor.maps.export_map')
    def unexpected(*args): raise AssertionError('Bulk must not rescan Unity bundles')
    monkeypatch.setattr(module,'_locate_map',unexpected)
    monkeypatch.setattr(module,'_export_sprites',unexpected)
    tree={'mapData':{'cellsData':[{'cellNumber':i,'mov':1,'visible':1} for i in range(560)]}}
    doc=build_map_document(Path('/unused'),42,tmp_path,source=(Path('test.bundle'),tree),sprite_catalog={})
    assert doc['format']=='giny.dofus3.map.v3'
    assert doc['id']==42 and len(doc['cells'])==560
    assert doc['source_bundle']=='test.bundle'
    assert doc['walkable_cells']==list(range(560))
    assert not (tmp_path/'maps').exists()
