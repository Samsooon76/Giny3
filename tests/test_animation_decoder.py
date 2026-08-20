"""Each decoded frame must consume exactly up to the next frame offset."""

from __future__ import annotations

import struct
from pathlib import Path

import pytest

from extractor.animations.decoder import DecodeError, decode_animation, expand_frames

FIXTURES = Path(__file__).parent / "fixtures"
BONE563 = FIXTURES / "bone563"


def pack_animation(records_per_frame: list[list[bytes]], events: list[tuple[int, str]] | None = None, flags: int = 0x0017) -> bytes:
    events = events or []
    record_count = len(records_per_frame[0]) if records_per_frame else 0
    for fr in records_per_frame:
        if len(fr) != record_count:
            raise ValueError("all frames must have the same record count")

    event_blob = b""
    for frame, text in events:
        raw = text.encode("ascii")
        event_blob += struct.pack("<HB", frame, len(raw)) + raw
        if len(event_blob) % 2:
            event_blob += b"\x00"

    header = struct.pack("<HHHH", len(records_per_frame), record_count, len(events), flags)
    after_events = len(header) + len(event_blob)
    pad = (4 - (after_events % 4)) % 4
    prefix_len = after_events + pad + 4 * len(records_per_frame)

    frame_blobs = [b"".join(recs) for recs in records_per_frame]
    offsets = []
    cursor = prefix_len
    for blob in frame_blobs:
        offsets.append(cursor)
        cursor += len(blob)

    out = header + event_blob + (b"\x00" * pad) + struct.pack("<" + "I" * len(offsets), *offsets)
    out += b"".join(frame_blobs)
    return out


def rec_00(node: int) -> bytes:
    return struct.pack("<HBB", node, 0x00, 0)


def rec_10(node: int, transform: list[float]) -> bytes:
    return struct.pack("<HBB" + "f" * 6, node, 0x10, 0, *transform)


def rec_11(node: int, graphic: int, transform: list[float]) -> bytes:
    return struct.pack(
        "<HBBHHHH" + "f" * 6,
        node,
        0x11,
        0,
        graphic,
        0xFFFF,
        0,
        0,
        *transform,
    )


def rec_17(node: int, extra_floats: list[float], transform: list[float]) -> bytes:
    return struct.pack(
        "<HBBHH" + "f" * 8,
        node,
        0x17,
        0x7F,
        0,
        0xFFFF,
        *extra_floats,
        *transform,
    )


def rec_31(node: int) -> bytes:
    identity = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    return struct.pack("<HBBHHHH" + "f" * 6, node, 0x31, 0, 65506, 7, 0, 0, *identity)


def test_synthetic_single_frame_exact_end():
    ident = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    raw = pack_animation(
        [
            [
                rec_17(0, [0.0, 4.0], ident),
                rec_11(1, 1, ident),
                rec_31(2),
            ]
        ],
        events=[(0, "END")],
    )
    anim = decode_animation(raw, "synthetic")
    assert anim.frame_count == 1
    assert anim.record_count == 3
    assert anim.frames[0].end_offset == len(raw)
    assert anim.frames[0].records[1].graphic_id == 1
    assert anim.events[0].text == "END"


def test_synthetic_noop_keeps_previous_transform():
    ident = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    moved = [1.0, 0.0, 10.0, 0.0, 1.0, 5.0]
    raw = pack_animation(
        [
            [rec_11(1, 3, moved)],
            [rec_00(1)],
        ]
    )
    anim = decode_animation(raw, "noop")
    assert anim.frames[0].end_offset == anim.frame_offsets[1]
    assert anim.frames[1].end_offset == len(raw)
    states = expand_frames(anim)
    assert states[1][0].transform == pytest.approx(moved)
    assert states[1][0].graphic == "3"
    assert states[1][0].drawable is True


def test_unknown_tag_raises():
    header = struct.pack("<HHHH", 1, 1, 0, 0)
    # offset table at 8, pad none, offset = 12, then bogus tag 0x99
    raw = header + struct.pack("<I", 12) + struct.pack("<HBB", 0, 0x99, 0)
    with pytest.raises(DecodeError, match="unknown tag"):
        decode_animation(raw, "bad")


def test_misaligned_frame_end_raises():
    ident = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]
    rec = rec_10(0, ident)
    # Claim two records but only provide one.
    header = struct.pack("<HHHH", 1, 2, 0, 0)
    offset = 8 + 4
    raw = header + struct.pack("<I", offset) + rec
    with pytest.raises(DecodeError):
        decode_animation(raw, "short")


@pytest.mark.parametrize(
    "name",
    ["AnimStatique_1", "AnimMarche_1", "AnimStatique_5", "AnimMarche_5"],
)
def test_real_poc_anims_frame_alignment(name: str):
    path = FIXTURES / f"{name}.bytes"
    raw = path.read_bytes()
    anim = decode_animation(raw, name)
    for i, fr in enumerate(anim.frames):
        expected = anim.frame_offsets[i + 1] if i + 1 < anim.frame_count else anim.file_length
        assert fr.end_offset == expected
        assert len(fr.records) == anim.record_count
    assert anim.frame_count >= 1


def test_all_bone563_anims_end_exactly_on_offset():
    files = sorted(BONE563.glob("*.bytes"))
    assert len(files) == 33
    for path in files:
        raw = path.read_bytes()
        anim = decode_animation(raw, path.stem)
        assert anim.frames[-1].end_offset == len(raw)
        for i, fr in enumerate(anim.frames[:-1]):
            assert fr.end_offset == anim.frame_offsets[i + 1]


def test_statique_1_root_and_graphics():
    anim = decode_animation((FIXTURES / "AnimStatique_1.bytes").read_bytes(), "AnimStatique_1")
    assert anim.frame_count == 1
    assert anim.record_count == 17
    recs = anim.frames[0].records
    assert recs[0].tag == 0x17
    assert recs[0].node == 0
    assert recs[1].tag == 0x11
    assert recs[1].graphic_id == 1
    assert recs[-1].tag == 0x31
    states = expand_frames(anim)[0]
    drawables = [s for s in states if s.drawable]
    assert {s.graphic for s in drawables} <= {str(i) for i in range(1, 200)}
    assert all(s.transform is not None for s in drawables)
