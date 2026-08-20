extends Node2D

const Formats := preload("res://scripts/formats.gd")
const MapGridScript := preload("res://scripts/map_grid.gd")

var map: Dictionary = {}
var gfx_textures: Dictionary = {} # gfx_id int -> Texture2D


func load_map(path: String) -> void:
	var raw := FileAccess.get_file_as_string(path)
	map = JSON.parse_string(raw)
	_load_textures(path)
	_build_sprites()
	_build_grid()


func _load_textures(map_path: String) -> void:
	gfx_textures.clear()
	var gfx: Dictionary = map.get("gfx", {})
	for key in gfx.keys():
		var info: Dictionary = gfx[key]
		var rel := "res://data/%s" % str(info["texture"])
		var tex_path := ProjectSettings.globalize_path(rel)
		if not FileAccess.file_exists(tex_path):
			push_warning("missing gfx %s" % tex_path)
			continue
		var img := Image.load_from_file(tex_path)
		if img == null or img.is_empty():
			push_warning("failed image %s" % tex_path)
			continue
		var tex := ImageTexture.create_from_image(img)
		gfx_textures[int(key)] = tex
	print("map gfx loaded ", gfx_textures.size(), "/", gfx.size())


func _build_sprites() -> void:
	for child in get_children():
		child.queue_free()
	var elements: Array = map.get("elements", [])
	for el in elements:
		var gid := int(el.get("gfx_id", 0))
		if not gfx_textures.has(gid):
			continue
		var spr := Sprite2D.new()
		spr.texture = gfx_textures[gid]
		var info: Dictionary = map["gfx"][str(gid)]
		var pivot: Array = info.get("pivot", [0.5, 0.5])
		spr.centered = true
		# Unity pivot is normalized; Sprite2D centered == pivot (0.5, 0.5).
		# Offset in pixels from center for non-0.5 pivots.
		var w := float(info.get("width", spr.texture.get_width()))
		var h := float(info.get("height", spr.texture.get_height()))
		spr.offset = Vector2((0.5 - float(pivot[0])) * w, (float(pivot[1]) - 0.5) * h)
		var tr: Dictionary = el.get("transform", {})
		var m11 := float(tr.get("m11", 1))
		var m12 := float(tr.get("m12", 0))
		var m21 := float(tr.get("m21", 0))
		var m22 := float(tr.get("m22", 1))
		var m31 := float(tr.get("m31", 0))
		var m32 := float(tr.get("m32", 0))
		# x' = m11*x + m21*y + m31 ; y' = m12*x + m22*y + m32  (Unity Y-up)
		spr.transform = Transform2D(
			Vector2(m11, -m12),
			Vector2(-m21, m22),
			Vector2(m31, -m32)
		)
		var layer := str(el.get("layer", "background"))
		var cell_v = el.get("cell_id")
		var cell_id := int(cell_v) if cell_v != null else 0
		var inner_v = el.get("inner_cell_render_order")
		var inner := int(inner_v) if inner_v != null else 0
		var behaviour := int(el.get("display_behaviour", 0))
		# Huge almost-white fill sprites (display_behaviour 1) need the official
		# material/shader; without it they occlude the map. Skip for the POC.
		if behaviour == 1:
			continue
		spr.z_as_relative = false
		match layer:
			"background":
				spr.z_index = clampi(1 + int(el.get("order", 0)), 1, 99)
			"sortable":
				spr.z_index = clampi(100 + cell_id + inner, 100, 799)
			"foreground":
				spr.z_index = clampi(900 + int(el.get("order", 0)), 900, 1000)
			_:
				spr.z_index = 90
		var col_v = el.get("color_u32", 0xFFFFFFFF)
		spr.modulate = Formats.color_u32(int(col_v))
		spr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		add_child(spr)
	print("map sprites ", get_child_count())


func _build_grid() -> void:
	var grid := MapGridScript.new()
	grid.map = map
	grid.z_as_relative = false
	grid.z_index = 50
	add_child(grid)


func cell_position(cell_id: int) -> Vector2:
	var cells: Array = map.get("cells", [])
	if cell_id < 0 or cell_id >= cells.size():
		return Vector2.ZERO
	var c: Dictionary = cells[cell_id]
	return Formats.unity_point_to_godot(float(c["x"]), float(c["y"]))


func is_walkable(cell_id: int) -> bool:
	var cells: Array = map.get("cells", [])
	if cell_id < 0 or cell_id >= cells.size():
		return false
	var c: Dictionary = cells[cell_id]
	return int(c.get("mov", 0)) == 1 and int(c.get("non_walkable_during_rp", 0)) == 0
