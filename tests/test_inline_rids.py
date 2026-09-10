from extractor.extract_all import inline_rids


def test_inline_rids_replaces_a_bare_rid_with_the_referenced_data():
    refs = {7: {"effectId": 100, "diceNum": 8, "diceSide": 10}}
    item = {"id": 44, "possibleEffects": [{"rid": 7}]}
    out = inline_rids(item, refs)
    assert out["possibleEffects"][0]["effectId"] == 100
    assert out["possibleEffects"][0]["diceNum"] == 8


def test_inline_rids_leaves_unknown_rids_alone():
    out = inline_rids({"possibleEffects": [{"rid": 1}]}, {})
    assert out["possibleEffects"] == [{"rid": 1}]


def test_shared_effect_is_expanded_for_every_occurrence():
    effect = {"effectId": 100, "diceNum": 8}
    out = inline_rids([{"rid": 7}, {"rid": 7}], {7: effect})
    assert out == [effect, effect]


def test_recursive_reference_stops_only_on_the_current_branch():
    refs = {1: {"child": {"rid": 2}}, 2: {"parent": {"rid": 1}}}
    out = inline_rids([{"rid": 1}, {"rid": 2}], refs)
    assert out == [
        {"child": {"parent": {"rid": 1}}},
        {"parent": {"child": {"rid": 2}}},
    ]
