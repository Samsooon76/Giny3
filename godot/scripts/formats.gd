extends RefCounted
## Unity Y-up affine [a, b, tx, c, d, ty] → Godot 2D Y-down Transform2D.


static func unity_affine_to_godot(tr: Array) -> Transform2D:
	var a := float(tr[0])
	var b := float(tr[1])
	var tx := float(tr[2])
	var c := float(tr[3])
	var d := float(tr[4])
	var ty := float(tr[5])
	# Vertices are stored as (x, -y). See entity_animator.gd.
	return Transform2D(Vector2(a, -c), Vector2(-b, d), Vector2(tx, -ty))


static func unity_point_to_godot(x: float, y: float) -> Vector2:
	return Vector2(x, -y)


static func color_u32(value: int) -> Color:
	var a := float((value >> 24) & 0xFF) / 255.0
	var r := float((value >> 16) & 0xFF) / 255.0
	var g := float((value >> 8) & 0xFF) / 255.0
	var b := float(value & 0xFF) / 255.0
	if a <= 0.0:
		a = 1.0
	return Color(r, g, b, a)
