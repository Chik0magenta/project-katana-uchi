extends Control
## 개발용 메뉴: 주요 화면으로 바로 진입. 일반 플레이(타이틀 → 새로 시작)와 분리되어 있다.

const UI = preload("res://scripts/ui/ui_theme.gd")

var main


func setup(m, _params: Dictionary) -> void:
	main = m
	var box := VBoxContainer.new()
	box.position = Vector2(340, 40)
	box.size = Vector2(600, 640)
	box.add_theme_constant_override("separation", 10)
	add_child(box)
	box.add_child(UI.label("개발용 메뉴", 32, UI.COL_ACCENT, true))
	box.add_child(UI.label("검수용 바로 가기입니다. 각 항목은 새 게임 상태를 만든 뒤 해당 화면으로 이동합니다.", 17, UI.COL_DIM))
	box.add_child(UI.button("지도 화면", _go_map))
	box.add_child(UI.button("이동 화면 (공방 마을 → 갈림길 주막 출발)", _go_travel_short))
	box.add_child(UI.button("이동 화면 (주막 → 철광 산지, 3일 구간)", _go_travel_long))
	box.add_child(UI.button("장소 화면: 강변 사철터", _go_loc.bind("river")))
	box.add_child(UI.button("장소 화면: 숯가마 숲", _go_loc.bind("forest")))
	box.add_child(UI.button("공방 (견본 원료·강괴 지급)", _go_workshop))
	box.add_child(UI.button("결과 화면 (견본 결과)", _go_result))
	var cb := CheckButton.new()
	cb.text = "실제 수치 표시 (F12와 같음)"
	cb.button_pressed = GameState.dev_numbers
	cb.toggled.connect(_on_dev_toggle)
	box.add_child(cb)
	box.add_child(UI.button("타이틀로", func(): main.go("title")))


func _go_map() -> void:
	_fresh()
	main.go("map")


func _go_travel_short() -> void:
	_fresh()
	GameState.depart("inn")
	main.go("travel")


func _go_travel_long() -> void:
	_fresh()
	GameState.location = "inn"
	GameState.depart("mountain")
	main.go("travel")


func _go_loc(id: String) -> void:
	_fresh()
	GameState.location = id
	main.go("location")


func _go_workshop() -> void:
	_fresh()
	_sample_materials()
	main.go("workshop")


func _go_result() -> void:
	_fresh()
	_sample_materials()
	main.go("workshop", {"auto_result": true})


func _fresh() -> void:
	var keep := GameState.dev_numbers
	GameState.new_game()
	GameState.dev_numbers = keep


func _sample_materials() -> void:
	GameState.location = "village"
	GameState.add_ore("satetsu", "강변 사철터")
	GameState.add_ore("mountain_ore", "철광 산지")
	GameState.add_charcoal("good", "숯가마 숲")
	GameState.add_charcoal("good", "숯가마 숲")
	var s1 := GameState.add_ore("satetsu", "강변 사철터")
	GameState.smelt(s1["uid"])
	var s2 := GameState.add_ore("mountain_ore", "철광 산지")
	GameState.smelt(s2["uid"])


func _on_dev_toggle(on: bool) -> void:
	GameState.dev_numbers = on
