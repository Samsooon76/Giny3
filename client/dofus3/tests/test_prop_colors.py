import importlib.util
from pathlib import Path
from extractor.animations.decoder import prop_node_color


def test_additive_wheat_color_does_not_blacken_the_multiplier():
    # Real node 30, prop 660 / AnimState0_0. 0x19 carries ADD only.
    color = prop_node_color(None, 0x19, 0, [0x00000606])
    assert color['multiplicative'] == [1, 1, 1, 1]
    assert color['additive'] == [6 / 128, 6 / 128, 0, 0]
    assert color['alpha'] == 1


def test_rgba_signed_channels_and_independent_opacity_updates():
    color = prop_node_color(None, 0x15, 0, [0x7f102030])
    assert color['multiplicative'][:3] == [48 / 128, 32 / 128, 16 / 128]
    next_color = prop_node_color(color, 0x0a, 0, [0x00fe0406])
    assert next_color['alpha'] == 0
    assert next_color['additive'] == [6 / 128, 4 / 128, -2 / 128, 0]
    assert next_color['multiplicative'] == color['multiplicative']
    assert color['alpha'] == 1
    assert prop_node_color(next_color, 0x10, 0, None) == next_color


def test_offline_repair_is_idempotent_and_keeps_channel_history():
    script = Path(__file__).resolve().parents[2] / 'web/scripts/repair-prop-colors.py'
    spec = importlib.util.spec_from_file_location('repair_props', script)
    repair = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(repair)
    doc = {'animations': {'idle': {'frames': [
        [{'node': 1, 'tag': 0x15, 'extra': 0, 'color_u32': [0x7f102030]}],
        [{'node': 1, 'tag': 0x19, 'extra': 0, 'color_u32': [0x606]}],
        [{'node': 1, 'tag': 0x10, 'extra': 0, 'color_u32': [0x606]}],
    ]}}}
    assert repair.repair(doc)
    frames = doc['animations']['idle']['frames']
    assert frames[2][0]['color'] == frames[1][0]['color']
    assert frames[2][0]['color']['multiplicative'] == frames[0][0]['color']['multiplicative']
    assert not repair.repair(doc)
    # A legacy snapshot inherited color_u32 from ADD, but its next record
    # contains no decoded colour. Do not treat that inherited ADD as MUL.
    doc = {'animations': {'transition': {'frames': [
        [{'node': 1, 'tag': 0x19, 'extra': 0, 'color_u32': [0x606]}],
        [{'node': 1, 'tag': 0x17, 'extra': 128, 'color_u32': [0x606], 'payload_hex': '00' * 36}],
    ]}}}
    assert repair.repair(doc)
    color = doc['animations']['transition']['frames'][1][0]['color']
    assert color['multiplicative'] == [1, 1, 1, 1]
    assert color['additive'] == [6 / 128, 6 / 128, 0, 0]
    assert color['alpha'] == 128 / 255
