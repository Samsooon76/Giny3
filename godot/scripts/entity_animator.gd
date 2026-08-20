extends Node2D

const Formats := preload("res://scripts/formats.gd")
## Native mesh animator: SkinAsset chunks as ArrayMesh, dataBytes as node xforms.

signal animation_finished(name: String)

var bone_id := 563
var look_scale := 1.05
var frame_rate := 25.0
var entity: Dictionary = {}
var texture: Texture2D
var current_animation := "AnimStatique_1"
var looping := true
var _frame := 0
var _accum := 0.0
var _playing := false
var _part_meshes: Dictionary = {} # graphic name -> ArrayMesh
var _node_instances: Dictionary = {} # node id -> MeshInstance2D


func load_entity(path: String) -> void:
	var raw := FileAccess.get_file_as_string(path)
	entity = JSON.parse_string(raw)
	bone_id = int(entity.get("bone_id", bone_id))
	look_scale = float(entity.get("scale", look_scale))
	frame_rate = float(entity.get("frame_rate", 25))
	scale = Vector2(look_scale, look_scale)
	var tex_rel: String = entity.get("texture", "")
	var tex_path := ProjectSettings.globalize_path("res://data/%s" % tex_rel)
	var img := Image.load_from_file(tex_path)
	if img == null or img.is_empty():
		push_error("entity texture missing %s" % tex_path)
		return
	texture = ImageTexture.create_from_image(img)
	_build_part_meshes()
	print("entity parts ", _part_meshes.size(), " tex ", tex_path)


func _build_part_meshes() -> void:
	_part_meshes.clear()
	var parts: Dictionary = entity.get("parts", {})
	for graphic in parts.keys():
		var part: Dictionary = parts[graphic]
		var verts3 := PackedVector3Array()
		var uvs := PackedVector2Array()
		var cols := PackedColorArray()
		var idx := PackedInt32Array()
		for chunk in part.get("chunks", []):
			var base := verts3.size()
			var verts: Array = chunk.get("vertices", [])
			for v in verts:
				verts3.append(Vector3(float(v["x"]), -float(v["y"]), 0.0))
				uvs.append(Vector2(float(v["u"]), 1.0 - float(v["v"])))
				var mul: Array = v.get("mul", [1, 1, 1, 1])
				cols.append(Color(float(mul[0]), float(mul[1]), float(mul[2]), clampf(float(mul[3]), 0.4, 1.0)))
			var indices: Array = chunk.get("indices", [])
			for i in indices:
				idx.append(base + int(i))
		if verts3.is_empty() or idx.is_empty():
			continue
		var arrays: Array = []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = verts3
		arrays[Mesh.ARRAY_TEX_UV] = uvs
		arrays[Mesh.ARRAY_COLOR] = cols
		arrays[Mesh.ARRAY_INDEX] = idx
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		_part_meshes[graphic] = mesh


func play(anim_name: String, loop: bool = true, reset: bool = true) -> void:
	if not entity.get("animations", {}).has(anim_name):
		push_warning("missing animation %s" % anim_name)
		return
	current_animation = anim_name
	looping = loop
	if reset:
		_frame = 0
		_accum = 0.0
	_playing = true
	_apply_frame(_frame)


func stop() -> void:
	_playing = false


func _process(delta: float) -> void:
	if not _playing:
		return
	var anim: Dictionary = entity["animations"][current_animation]
	var count := int(anim.get("frame_count", 1))
	if count <= 1:
		return
	_accum += delta
	var frame_time: float = 1.0 / maxf(frame_rate, 1.0)
	while _accum >= frame_time:
		_accum -= frame_time
		_frame += 1
		if _frame >= count:
			if looping:
				_frame = 0
			else:
				_frame = count - 1
				_playing = false
				animation_finished.emit(current_animation)
				break
		_apply_frame(_frame)


func _apply_frame(index: int) -> void:
	var anim: Dictionary = entity["animations"][current_animation]
	var frames: Array = anim.get("frames", [])
	if index < 0 or index >= frames.size():
		return
	var nodes: Array = frames[index]
	var seen: Dictionary = {}
	for node in nodes:
		var nid := int(node.get("node", -1))
		var graphic := str(node.get("graphic", ""))
		if graphic == "" or not _part_meshes.has(graphic):
			continue
		if not node.has("transform"):
			continue
		# Node 0 / 0x17 is stored on the entity JSON but not composed here.
		var xf := Formats.unity_affine_to_godot(node["transform"])
		var inst: MeshInstance2D = _node_instances.get(nid)
		if inst == null:
			inst = MeshInstance2D.new()
			inst.texture = texture
			add_child(inst)
			_node_instances[nid] = inst
		inst.mesh = _part_meshes[graphic]
		inst.transform = xf
		inst.z_index = nid
		seen[nid] = true
	for nid in _node_instances.keys():
		if not seen.has(nid):
			(_node_instances[nid] as MeshInstance2D).visible = false
		else:
			(_node_instances[nid] as MeshInstance2D).visible = true
