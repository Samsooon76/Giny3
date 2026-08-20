"""Decoder for Ankama.Animations ``dataBytes``.

Binary layout (little-endian), validated on 33 Bouftou + extra fixtures:

    u16 frameCount
    u16 recordCount
    u16 eventCount
    u16 formatFlags

    events[eventCount]:
        u16 frame
        u8  length
        byte[length] text
        pad to 2-byte alignment between events
    pad to 4-byte alignment

    u32 frameOffsets[frameCount]

Each frame contains exactly ``recordCount`` variable-size records.
A frame is a state *update*: tag ``0x00`` means keep the previous record
for that slot. After decoding, ``end_offset`` of frame i MUST equal
``frameOffsets[i+1]`` (or ``len(data)`` for the last frame).

Record header (all known tags):

    u16 node
    u8  tag
    u8  extra     # kept raw — meaning not confirmed

Transform payload, when present, is six float32:

    [a, b, tx, c, d, ty]
    x' = a*x + b*y + tx
    y' = c*x + d*y + ty

Unknown tags raise ``DecodeError``. Unknown payload fields are stored raw.
``formatFlags`` is stored as-is (0x0017 and 0x001f seen; semantics unknown).
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Any

# Sizes include the 4-byte header. Source: reverse notes + exhaustive
# scan of bone_563 (33 animations, 0 failures on frame-end alignment).
RECORD_SIZES: dict[int, int] = {
    0x00: 4,
    0x06: 8,
    0x0c: 12,
    0x10: 28,
    0x11: 36,
    0x12: 28,
    0x14: 32,
    0x15: 40,
    0x16: 32,
    0x17: 40,
    0x1c: 36,
    0x1d: 44,
    0x21: 12,
    0x30: 36,
    0x31: 36,
    0x35: 40,
}

# Tags used by Bouftou idle/walk. Others are decoded but not required.
POC_TAGS = {0x00, 0x10, 0x11, 0x17, 0x31}


class DecodeError(Exception):
    pass


def _align(pos: int, n: int) -> int:
    rem = pos % n
    return pos if rem == 0 else pos + (n - rem)


def _u16s(payload: bytes, n: int) -> list[int]:
    return list(struct.unpack_from("<" + "H" * n, payload, 0))


def _f32s(payload: bytes, offset: int, n: int) -> list[float]:
    return list(struct.unpack_from("<" + "f" * n, payload, offset))


@dataclass
class Event:
    frame: int
    text: str


@dataclass
class Record:
    node: int
    tag: int
    extra: int
    size: int
    offset: int
    payload: bytes
    transform: list[float] | None = None
    meta_u16: list[int] | None = None
    color_u32: list[int] | None = None
    extra_floats: list[float] | None = None

    @property
    def graphic_id(self) -> int | None:
        """Hypothesis: 0x11 meta[0] is the SkinAsset part / symbol id.

        0xFFFF / values above 60000 are treated as "no graphic".
        """
        if self.tag not in (0x11, 0x15, 0x1d, 0x35):
            return None
        if not self.meta_u16:
            return None
        gid = self.meta_u16[0]
        if gid == 0xFFFF or gid > 60000:
            return None
        return gid

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "node": self.node,
            "tag": self.tag,
            "extra": self.extra,
            "payload_hex": self.payload.hex(),
        }
        if self.transform is not None:
            out["transform"] = self.transform
        if self.meta_u16 is not None:
            out["meta_u16"] = self.meta_u16
        if self.color_u32 is not None:
            out["color_u32"] = self.color_u32
        if self.extra_floats is not None:
            out["extra_floats"] = self.extra_floats
        gid = self.graphic_id
        if gid is not None:
            out["graphic"] = str(gid)
        return out


@dataclass
class Frame:
    index: int
    offset: int
    end_offset: int
    records: list[Record]


@dataclass
class Animation:
    name: str
    frame_count: int
    record_count: int
    event_count: int
    format_flags: int
    events: list[Event]
    frame_offsets: list[int]
    frames: list[Frame]
    file_length: int

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "frame_count": self.frame_count,
            "record_count": self.record_count,
            "event_count": self.event_count,
            "format_flags": self.format_flags,
            "events": [{"frame": e.frame, "text": e.text} for e in self.events],
            "frames": [
                {
                    "index": fr.index,
                    "records": [r.to_json() for r in fr.records],
                }
                for fr in self.frames
            ],
        }


def _parse_record(data: bytes, pos: int) -> Record:
    if pos + 4 > len(data):
        raise DecodeError(f"truncated record header at {pos}")
    node, tag, extra = struct.unpack_from("<HBB", data, pos)
    size = RECORD_SIZES.get(tag)
    if size is None:
        peek = data[pos : pos + 16].hex()
        raise DecodeError(f"unknown tag 0x{tag:02x} node={node} at {pos} peek={peek}")
    if pos + size > len(data):
        raise DecodeError(f"record 0x{tag:02x} at {pos} size {size} exceeds file")
    payload = data[pos + 4 : pos + size]
    rec = Record(node=node, tag=tag, extra=extra, size=size, offset=pos, payload=payload)

    if tag == 0x00:
        pass
    elif tag == 0x06 and len(payload) >= 4:
        rec.color_u32 = list(struct.unpack_from("<I", payload, 0))
    elif tag == 0x0c and len(payload) >= 8:
        rec.color_u32 = list(struct.unpack_from("<II", payload, 0))
    elif tag in (0x10, 0x12) and len(payload) >= 24:
        rec.transform = _f32s(payload, 0, 6)
    elif tag == 0x11 and len(payload) >= 32:
        rec.meta_u16 = _u16s(payload, 4)
        rec.transform = _f32s(payload, 8, 6)
    elif tag in (0x14, 0x16) and len(payload) >= 28:
        rec.color_u32 = list(struct.unpack_from("<I", payload, 0))
        rec.transform = _f32s(payload, 4, 6)
    elif tag == 0x15 and len(payload) >= 36:
        rec.meta_u16 = _u16s(payload, 4)
        rec.color_u32 = list(struct.unpack_from("<I", payload, 8))
        rec.transform = _f32s(payload, 12, 6)
    elif tag == 0x17 and len(payload) >= 36:
        # extra (u8) already in header. Next 4 bytes kept as meta, then 8 floats.
        # Hypothesis: last 6 floats are the affine transform (matches 0x10 on
        # the same node in later frames). First 2 floats are NOT interpreted.
        rec.meta_u16 = _u16s(payload, 2)
        rec.extra_floats = _f32s(payload, 4, 2)
        rec.transform = _f32s(payload, 12, 6)
    elif tag == 0x1c and len(payload) >= 32:
        rec.color_u32 = list(struct.unpack_from("<II", payload, 0))
        rec.transform = _f32s(payload, 8, 6)
    elif tag == 0x1d and len(payload) >= 40:
        rec.meta_u16 = _u16s(payload, 4)
        rec.color_u32 = list(struct.unpack_from("<II", payload, 8))
        rec.transform = _f32s(payload, 16, 6)
    elif tag == 0x21 and len(payload) >= 8:
        rec.meta_u16 = _u16s(payload, 4)
    elif tag in (0x30, 0x31) and len(payload) >= 32:
        rec.meta_u16 = _u16s(payload, 4)
        rec.transform = _f32s(payload, 8, 6)
    elif tag == 0x35 and len(payload) >= 36:
        rec.meta_u16 = _u16s(payload, 4)
        rec.color_u32 = list(struct.unpack_from("<I", payload, 8))
        rec.transform = _f32s(payload, 12, 6)
    return rec


def decode_animation(data: bytes, name: str = "") -> Animation:
    if len(data) < 8:
        raise DecodeError(f"{name}: file shorter than header")
    frame_count, record_count, event_count, format_flags = struct.unpack_from("<HHHH", data, 0)
    pos = 8
    events: list[Event] = []
    for i in range(event_count):
        if pos + 3 > len(data):
            raise DecodeError(f"{name}: truncated event {i} at {pos}")
        frame, length = struct.unpack_from("<HB", data, pos)
        pos += 3
        if pos + length > len(data):
            raise DecodeError(f"{name}: event {i} text truncated")
        text = data[pos : pos + length].decode("ascii", "replace")
        pos += length
        events.append(Event(frame=frame, text=text))
        pos = _align(pos, 2)
    pos = _align(pos, 4)
    if pos + 4 * frame_count > len(data):
        raise DecodeError(f"{name}: truncated frame offset table")
    offsets = list(struct.unpack_from("<" + "I" * frame_count, data, pos))

    frames: list[Frame] = []
    for fi, off in enumerate(offsets):
        expected_end = offsets[fi + 1] if fi + 1 < frame_count else len(data)
        p = off
        recs: list[Record] = []
        for ri in range(record_count):
            rec = _parse_record(data, p)
            recs.append(rec)
            p += rec.size
        if p != expected_end:
            raise DecodeError(
                f"{name}: frame {fi} ended at {p}, expected {expected_end} "
                f"(delta {p - expected_end})"
            )
        frames.append(Frame(index=fi, offset=off, end_offset=expected_end, records=recs))

    return Animation(
        name=name,
        frame_count=frame_count,
        record_count=record_count,
        event_count=event_count,
        format_flags=format_flags,
        events=events,
        frame_offsets=offsets,
        frames=frames,
        file_length=len(data),
    )


@dataclass
class NodeState:
    node: int
    tag: int
    extra: int
    transform: list[float] | None = None
    graphic: str | None = None
    color_u32: list[int] | None = None
    meta_u16: list[int] | None = None
    extra_floats: list[float] | None = None
    raw_payload_hex: str = ""
    drawable: bool = False

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "node": self.node,
            "tag": self.tag,
            "extra": self.extra,
            "drawable": self.drawable,
        }
        if self.transform is not None:
            out["transform"] = self.transform
        if self.graphic is not None:
            out["graphic"] = self.graphic
        if self.color_u32 is not None:
            out["color_u32"] = self.color_u32
        if self.meta_u16 is not None:
            out["meta_u16"] = self.meta_u16
        if self.extra_floats is not None:
            out["extra_floats"] = self.extra_floats
        if self.raw_payload_hex:
            out["payload_hex"] = self.raw_payload_hex
        return out


def _apply_record(state: NodeState | None, rec: Record) -> NodeState:
    if rec.tag == 0x00:
        if state is None:
            return NodeState(node=rec.node, tag=0x00, extra=rec.extra)
        return state

    st = NodeState(
        node=rec.node,
        tag=rec.tag,
        extra=rec.extra,
        transform=list(rec.transform) if rec.transform is not None else (None if state is None else state.transform),
        graphic=state.graphic if state is not None else None,
        color_u32=list(rec.color_u32) if rec.color_u32 is not None else (None if state is None else state.color_u32),
        meta_u16=list(rec.meta_u16) if rec.meta_u16 is not None else (None if state is None else state.meta_u16),
        extra_floats=list(rec.extra_floats) if rec.extra_floats is not None else (None if state is None else state.extra_floats),
        raw_payload_hex=rec.payload.hex(),
    )
    gid = rec.graphic_id
    if gid is not None:
        st.graphic = str(gid)

    # 0x31 on Bouftou is a trailing identity record with meta[0]=65506.
    # Hypothesis: not a drawable graphic. Keep raw, do not attach a part.
    if rec.tag == 0x31:
        st.drawable = False
        st.graphic = None
    elif rec.tag == 0x17:
        # Root / global node. Transform applies to the whole object.
        st.drawable = False
    elif st.graphic is not None and st.transform is not None:
        st.drawable = True
    elif state is not None:
        st.drawable = state.drawable
    return st


def expand_frames(anim: Animation) -> list[list[NodeState]]:
    """Fold per-frame updates into a full node-state snapshot per frame."""
    current: dict[int, NodeState] = {}
    out: list[list[NodeState]] = []
    for frame in anim.frames:
        for rec in frame.records:
            current[rec.node] = _apply_record(current.get(rec.node), rec)
        snapshot = [current[k] for k in sorted(current)]
        out.append(snapshot)
    return out
