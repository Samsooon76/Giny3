import json
import subprocess
import sys
from pathlib import Path

from extractor.maps.effects import FAMILIES, inventory_map

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "effects"
AUDIT = Path(__file__).resolve().parents[2] / "web" / "scripts" / "audit-world-effects.py"


def test_release_readiness_rejects_stale_support_and_missing_resources():
    import importlib.util
    spec = importlib.util.spec_from_file_location('verify_effects_release_test', AUDIT.with_name('verify-world-effects.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    coverage = {'maps_examined': 1, 'families': {name: {'active': 0, 'status': 'supported'} for name in FAMILIES}}
    assert module.effect_readiness(coverage, 1, True)['effects_complete']
    assert not module.effect_readiness(coverage, 1, False)['effects_complete']
    assert not module.effect_readiness(coverage, 2, True)['effects_complete']
    coverage['families']['pp_chromatic'] = {'active': 1, 'status': 'render_absent'}
    assert module.effect_readiness(coverage, 1, True)['effects_complete']
    coverage['families']['pp_chromatic']['status'] = 'source_missing'
    assert not module.effect_readiness(coverage, 1, True)['effects_complete']
    coverage['families']['pp_chromatic']['status'] = 'supported'
    coverage['families']['shader_outline']['active'] = 1
    result = module.effect_readiness(coverage, 1, True)
    assert not result['effects_complete']
    assert result['unsupported_effect_families']['shader_outline'] == 'render_absent'
    coverage['families']['shader_outline']['active'] = 0
    del coverage['families']['shader_outline']
    assert not module.effect_readiness(coverage, 1, True)['effects_complete']


def test_inventory_reports_active_wind_wave_and_bloom():
    tree = json.loads((FIXTURES / "wind-wave.json").read_text())
    info = inventory_map(tree, 154644)
    assert "wind_config" in info["families"]
    assert "wave_config" in info["families"]
    assert "pp_bloom" in info["families"]
    assert "shader_wind" in info["families"]
    assert info["active"]["wind_config"] is True
    assert info["active"]["wave_config"] is True
    assert info["active"]["postprocess_config"] is True
    assert "refraction" not in info["families"]


def test_inventory_reports_refraction_without_assuming_it_is_foreground_paint_only():
    tree = json.loads((FIXTURES / "refraction.json").read_text())
    info = inventory_map(tree, 54162245)
    assert "refraction" in info["families"]
    assert "shader_refraction" in info["families"]
    assert info["refraction_count"] == 1
    assert info["active"]["refraction"] is True
    deps = {(d["category"], d["id"]) for d in info["texture_refs"]}
    assert ("noises", 1) in deps


def test_neutral_map_is_present_in_the_denominator_with_no_silent_drop():
    tree = json.loads((FIXTURES / "neutral.json").read_text())
    info = inventory_map(tree, 1)
    assert info["families"] == []
    assert info["particle_count"] == 0
    assert info["coverage"]["families"] == []


def test_audit_script_emits_every_known_family_from_fixtures(tmp_path):
    output = tmp_path / "effects-coverage.json"
    docs = tmp_path / "report.md"
    tests = tmp_path / "test-maps.json"
    result = subprocess.run(
        [
            sys.executable,
            str(AUDIT),
            "--fixture-dir",
            str(FIXTURES),
            "--output",
            str(output),
            "--docs",
            str(docs),
            "--test-maps",
            str(tests),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    coverage = json.loads(output.read_text())
    assert coverage["maps_examined"] == 3
    assert coverage["effects_version"] == 1
    for family in FAMILIES:
        assert family in coverage["families"], family
    assert coverage["families"]["wind_config"]["occurrences"] == 1
    assert coverage["families"]["refraction"]["occurrences"] == 1
    assert coverage["families"]["particle_collision"]["occurrences"] == 0
    assert "Inventaire" in docs.read_text()
    assert json.loads(tests.read_text())
    assert "maps" in result.stdout
