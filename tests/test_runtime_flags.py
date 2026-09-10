from extractor.runtime_flags import decode_getter


def test_last_byte_bit_and_shifted_byte_are_recovered():
    assert decode_getter([("ldrb", "w8, [x0, #0x10]"), ("lsr", "w0, w8, #7"), ("ret", "")]) == 128
    assert decode_getter([("ldrb", "w8, [x0, #0x11]"), ("ubfx", "w0, w8, #4, #1"), ("ret", "")]) == 4096


def test_multi_bit_and_foreign_field_getters_are_not_assumed_flags():
    assert decode_getter([("ldrb", "w8, [x0, #0x10]"), ("lsr", "w0, w8, #3"), ("ret", "")]) is None
    assert decode_getter([("ldr", "w8, [x0, #0x24]"), ("and", "w0, w8, #1"), ("ret", "")]) is None
