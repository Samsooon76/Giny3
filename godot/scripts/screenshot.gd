extends SceneTree
## Headless screenshot: godot --headless --path godot --script res://scripts/screenshot.gd


func _init() -> void:
	call_deferred("_go")


func _go() -> void:
	var packed := load("res://scenes/main.tscn")
	var scene: Node = packed.instantiate()
	root.add_child(scene)
	await process_frame
	await create_timer(1.6).timeout
	var vp := root.get_viewport()
	if vp == null or vp.get_texture() == null:
		push_error("no viewport texture (headless dummy renderer?)")
		quit(1)
		return
	var img := vp.get_texture().get_image()
	if img == null:
		push_error("viewport image is null")
		quit(1)
		return
	var dest := ProjectSettings.globalize_path("res://").path_join("../output/godot_preview.png")
	img.save_png(dest)
	print("wrote ", dest)
	quit()
