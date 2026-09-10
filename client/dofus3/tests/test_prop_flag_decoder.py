import struct
import json
import pytest
from extractor.animations.prop_decoder import decode_prop_frames
from extractor.animations.decoder import DecodeError
from extractor.maps.export_map import resolve_interactive_props, resolve_particles


def animation(records):
    header = struct.pack('<4H', len(records), 1, 0, 0)
    start = 8 + len(records) * 4
    offsets = []
    for record in records:
        offsets.append(start)
        start += len(record)
    return header + struct.pack('<' + 'I' * len(offsets), *offsets) + b''.join(records)


def test_flags_preserve_alpha_additive_color_and_affine_across_frames():
    first = struct.pack('<HBBhhII6f', 0, 0x19, 0, 2, -1, 0, 0x606, 1, 0, 3, 0, 1, 4)
    second = struct.pack('<HBB', 0, 2, 128)
    metadata, frames = decode_prop_frames(animation([first, second]))
    assert metadata['frame_count'] == 2
    assert frames[1][0].graphic == '2'
    assert frames[1][0].color['additive'] == [6/128, 6/128, 0, 0]
    assert frames[1][0].color['alpha'] == 128/255
    assert frames[1][0].transform == [1, 0, 3, 0, 1, 4]


def test_flag_reader_rejects_truncated_frames():
    with pytest.raises(DecodeError):
        decode_prop_frames(animation([struct.pack('<HBB', 0, 16, 0)]))


def test_direct_ambient_elements_do_not_become_static_or_interactive():
    props = resolve_interactive_props({'mapData': {'animatedElements': [
        {'gfxId': 3318, 'cellId': 319, 'playAnimation': 1, 'minDelay': 7, 'maxDelay': 15}
    ]}}, [3318])
    assert props[0]['ambient'] and not props[0]['static']
    assert props[0]['min_delay'] == 7 and props[0]['interaction_id'] == 0


def test_particle_materials_resolve_in_their_own_layer():
    tree = {'mapData': {'particlesParameters': [{'layer': 6, 'materialIndex': 0}],
        'foregroundMaterialData': {'shaderData': [{'rid': 1}]}}, 'references': {'RefIds': [
        {'rid': 1, 'type': {'class': 'ParticlesShaderData'}, 'data': {'gfxId': 2123, 'shaderParameters': [{'rid': 2}]}},
        {'rid': 2, 'type': {'class': 'ShaderBlendingParameters'}, 'data': {'sourceFactor': 1, 'destinationFactor': 1}}
    ]}}
    particle = resolve_particles(tree)[0]
    assert particle['hostLayer'] == 'foreground'
    assert particle['material']['gfxId'] == 2123
    assert particle['material']['parameters']['ShaderBlendingParameters']['destinationFactor'] == 1


def test_background_effect_layers_and_step_curves_are_safe_json():
    tree = {'mapData': {'particlesParameters': [{'layer': 4, 'curve': {'keys': [
        {'time': 0, 'value': 1, 'outTangent': float('inf')}
    ]}}]}}
    particle = resolve_particles(tree)[0]
    assert particle['hostLayer'] == 'background'
    assert particle['curve']['keys'][0]['outTangent'] == 'Infinity'
    json.dumps(particle, allow_nan=False)
