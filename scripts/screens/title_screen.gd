extends Control

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")

var main


func setup(m, _params: Dictionary) -> void:
	main = m
	var pv := PixelView.new()
	pv.setup(Art.tex("title"), 4)
	pv.fx_drawer = _fx
	add_child(pv)

	var box := VBoxContainer.new()
	box.position = Vector2(390, 110)
	box.size = Vector2(500, 420)
	box.add_theme_constant_override("separation", 14)
	add_child(box)
	var t := UI.label("KATANA-UCHI", 64, UI.COL_ACCENT, true)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(t)
	var st := UI.label("카타나우치 · v0.1 픽셀아트 플레이 시안", 22, UI.COL_TEXT)
	st.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(st)
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 40)
	box.add_child(sp)
	box.add_child(UI.button("새로 시작하기", _on_new, 54))
	box.add_child(UI.button("개발용 메뉴 (화면 바로 가기)", func(): main.go("dev"), 46))
	var hint := UI.label("마우스로 진행합니다. F12: 개발용 실제 수치 표시", 16, UI.COL_DIM)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(hint)


func _on_new() -> void:
	GameState.new_game()
	main.go("map", {"intro": true})


func _fx(v, t: float) -> void:
	# 공방 창의 불빛 깜빡임과 굴뚝 연기
	var f := 0.5 + 0.5 * sin(t * 7.0) * sin(t * 3.1)
	v.px(154, 161, 12, 11, Color(1.0, 0.82, 0.4, 0.25 + 0.35 * f))
	for i in 5:
		var k := fmod(t * 0.35 + i * 0.2, 1.0)
		v.px(179 + sin(k * 6.0 + i) * 3.0, 130 - k * 24.0, 4, 3, Color(0.55, 0.53, 0.58, 0.6 * (1.0 - k)))
