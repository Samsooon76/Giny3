extends Node2D
## POC scene: one real Dofus 3 map + Bouftou mesh + idle/walk + cell path.

const MapRendererScript := preload("res://scripts/map_renderer.gd")
const EntityAnimatorScript := preload("res://scripts/entity_animator.gd")
const MapGridScript := preload("res://scripts/map_grid.gd")

const DATA := "res://data"
const ENTITY_PATH := DATA + "/entities/563.json"
const MAP_PATH := DATA + "/maps/154644.json"
const POC_PATH := DATA + "/poc.json"

@onready var world: Node2D = $World
@onready var camera: Camera2D = $Camera2D
@onready var hud: Label = $CanvasLayer/Hud

var map_renderer: Node2D
var entity: Node2D
var path: Array[int] = []
var path_index := 0
var from_cell := 0
var to_cell := 0
var travel := 0.0
var travel_time := 0.4
var moving := false
var cycle := 0


func _ready() -> void:
	map_renderer = MapRendererScript.new()
	map_renderer.name = "Map"
	world.add_child(map_renderer)
	if FileAccess.file_exists(MAP_PATH):
		map_renderer.load_map(MAP_PATH)
	else:
		hud.text = "Missing %s — run: python -m extractor poc" % MAP_PATH
		return

	entity = EntityAnimatorScript.new()
	entity.name = "Bouftou"
	world.add_child(entity)
	if FileAccess.file_exists(ENTITY_PATH):
		entity.load_entity(ENTITY_PATH)
		entity.play("AnimStatique_1", true)
	else:
		hud.text = "Missing %s" % ENTITY_PATH
		return

	var start := _first_walkable()
	entity.position = map_renderer.cell_position(start)
	entity.z_as_relative = false
	entity.z_index = 850
	_build_tour(start)
	_focus_camera(entity.position)
	hud.text = "Bouftou bone 563 on map 154644 — idle/walk native mesh"
	print("entity at ", entity.position, " path ", path)
	get_tree().create_timer(1.4).timeout.connect(_save_preview)


func _process(delta: float) -> void:
	if entity == null or path.is_empty():
		return
	if not moving:
		_start_next_leg()
		return
	travel += delta / travel_time
	var a: Vector2 = map_renderer.cell_position(from_cell)
	var b: Vector2 = map_renderer.cell_position(to_cell)
	if travel >= 1.0:
		entity.position = b
		entity.z_index = 850
		moving = false
		path_index += 1
		if path_index >= path.size():
			cycle += 1
			path_index = 0
			if (cycle % 2) == 1:
				path.reverse()
		entity.play(_idle_name(to_cell, path[path_index] if path_index < path.size() else to_cell), true)
		return
	entity.position = a.lerp(b, travel)
	camera.position = entity.position


func _start_next_leg() -> void:
	if path.size() < 2:
		return
	from_cell = path[path_index]
	var nxt := path_index + 1
	if nxt >= path.size():
		path.reverse()
		path_index = 0
		from_cell = path[0]
		nxt = 1
	to_cell = path[nxt]
	var a: Vector2 = map_renderer.cell_position(from_cell)
	var b: Vector2 = map_renderer.cell_position(to_cell)
	entity.play(_walk_name(a, b), true)
	travel = 0.0
	moving = true


func _walk_name(a: Vector2, b: Vector2) -> String:
	# _1 ≈ facing +X (dir 1), _5 ≈ facing -X. Hypothesis, see docs/HYPOTHESES.md.
	if b.x >= a.x:
		return "AnimMarche_1" if entity.entity["animations"].has("AnimMarche_1") else "AnimMarche_5"
	return "AnimMarche_5" if entity.entity["animations"].has("AnimMarche_5") else "AnimMarche_1"


func _idle_name(from_id: int, to_id: int) -> String:
	var a: Vector2 = map_renderer.cell_position(from_id)
	var b: Vector2 = map_renderer.cell_position(to_id)
	if b.x >= a.x:
		return "AnimStatique_1"
	return "AnimStatique_5"


func _first_walkable() -> int:
	var walkable: Array = map_renderer.map.get("walkable_cells", [])
	if walkable.is_empty():
		return 280
	return int(walkable[walkable.size() / 2])


func _build_tour(start: int) -> void:
	path = [start]
	var cells: Array = map_renderer.map.get("cells", [])
	var current := start
	# Neighbours on the 14×40 grid: even/odd rows are offset but cell ids
	# still neighbour as ±1 (same row) and ±14 (next row).
	var deltas := [1, 14, -1, -14, 15, 13, -13, -15]
	var used: Dictionary = {start: true}
	while path.size() < 8:
		var found := false
		for d in deltas:
			var n: int = current + d
			if n < 0 or n >= cells.size():
				continue
			if used.has(n):
				continue
			if not map_renderer.is_walkable(n):
				continue
			path.append(n)
			used[n] = true
			current = n
			found = true
			break
		if not found:
			break
	if path.size() == 1:
		path.append(start)


func _focus_camera(target: Vector2) -> void:
	camera.make_current()
	camera.position = target
	camera.zoom = Vector2(1.35, 1.35)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			camera.zoom *= 1.1
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			camera.zoom *= 0.9
	if event is InputEventKey and event.pressed and event.keycode == KEY_G:
		for child in map_renderer.get_children():
			if child.get_script() == MapGridScript:
				child.show_grid = not child.show_grid
				child.queue_redraw()
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
		camera.position -= event.relative / camera.zoom


func _save_preview() -> void:
	var vp := get_viewport()
	if vp == null or vp.get_texture() == null:
		return
	var img := vp.get_texture().get_image()
	if img == null:
		return
	var dest := ProjectSettings.globalize_path("res://").path_join("../output/godot_preview.png")
	img.save_png(dest)
	print("wrote ", dest)
