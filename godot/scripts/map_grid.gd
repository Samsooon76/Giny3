extends Node2D

const Formats := preload("res://scripts/formats.gd")

var map: Dictionary = {}
var show_grid := true


func _draw() -> void:
	if not show_grid:
		return
	var cells: Array = map.get("cells", [])
	for c in cells:
		var p: Vector2 = Formats.unity_point_to_godot(float(c["x"]), float(c["y"]))
		var walkable := int(c.get("mov", 0)) == 1 and int(c.get("non_walkable_during_rp", 0)) == 0
		var col := Color(0.2, 0.9, 0.3, 0.22) if walkable else Color(0.9, 0.2, 0.2, 0.12)
		_draw_cell_diamond(p, col)


func _draw_cell_diamond(center: Vector2, col: Color) -> void:
	# Visual approximation of the isometric cell (86 x 43).
	var hw := 43.0
	var hh := 21.5
	var pts := PackedVector2Array([
		center + Vector2(0, -hh),
		center + Vector2(hw, 0),
		center + Vector2(0, hh),
		center + Vector2(-hw, 0),
	])
	draw_colored_polygon(pts, col)
	draw_polyline(pts + PackedVector2Array([pts[0]]), Color(0, 0, 0, 0.35), 1.0)
