from extractor.ui.match_tiles import Match, format_matches, iou, tile_boxes


def test_tile_boxes_cover_the_grid_without_gaps():
    boxes = tile_boxes(80, 40, cols=2, rows=2)
    assert boxes == [(0, 0, 40, 20), (40, 0, 80, 20), (0, 20, 40, 40), (40, 20, 80, 40)]


def test_iou_is_one_on_identical_masks_and_zero_on_disjoint():
    a = [True, True, False, False]
    b = [False, False, True, True]
    assert iou(a, a) == 1.0
    assert iou(a, b) == 0.0


def test_iou_partial_overlap():
    a = [True, True, False, False]
    b = [True, False, True, False]
    assert iou(a, b) == 1 / 3


def test_match_confidence_needs_score_and_margin():
    weak = Match(0, "a", 0.50, "b", 0.40)
    close = Match(1, "a", 0.80, "b", 0.78)
    clear = Match(2, "a", 0.80, "b", 0.50)
    assert not weak.confident
    assert not close.confident
    assert clear.confident
    assert abs(clear.margin - 0.30) < 1e-9


def test_format_matches_names_the_runner_up():
    text = format_matches([Match(0, "map", 0.81, "world", 0.40)])
    assert "map" in text
    assert "world" in text
    assert "yes" in text
