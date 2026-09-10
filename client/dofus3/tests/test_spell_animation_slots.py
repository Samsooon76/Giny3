import struct
from extractor.animations.prop_decoder import decode_prop_frames
from extractor.entities.export_bone import _resolve_frame_nodes


def test_negative_sprite_is_a_customisable_actor_slot():
    # Animator2D: SLOT | INSTANCE | XFORM. Negative sprite id is not missing art:
    # the second signed short resolves the skin via exposedNodeNames.
    data = struct.pack('<4HIHBBhhHH6f', 1, 1, 0, 23, 12, 0, 49, 0,
                       -270, 1, 0, 0, 3, 0, 1, 0, 3, 2)
    _, frames = decode_prop_frames(data)
    assert frames[0][0].customisation == 1
    nodes = _resolve_frame_nodes(frames[0], [], ['empty', 'BrasD_1'])
    assert nodes[0]['part_ref'] == '@slot:BrasD_1'
    assert nodes[0]['drawable'] is True
    assert nodes[0]['transform'] == [3, 0, 1, 0, 3, 2]
    # Props without a skin resolver keep their original non-drawing behavior.
    assert _resolve_frame_nodes(frames[0], [])[0]['drawable'] is False


def test_shot_event_survives_native_decoding():
    # Header + SHOT label + aligned frame table + unchanged node.
    data = struct.pack('<4H', 1, 1, 1, 23) + struct.pack('<HB', 0, 4) + b'SHOT' + b'\0'
    data += struct.pack('<IHBB', 20, 0, 0, 0)
    metadata, _ = decode_prop_frames(data)
    assert metadata['events'] == [{'frame': 0, 'text': 'SHOT'}]
