extends Control
## 장소 화면: 장소 그림과 가능한 활동. 도착일에는 별도의 장소 사건을 굴리지 않는다.

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")
const Hud = preload("res://scripts/ui/hud.gd")

var main
var pv
var act_box: VBoxContainer
var msg_label: RichTextLabel
var inv_label: RichTextLabel
var flash_text: String = ""
var flash_t: float = -10.0
var node_def: Dictionary


func setup(m, params: Dictionary) -> void:
	main = m
	node_def = DB.node(GameState.location)
	pv = PixelView.new()
	pv.setup(Art.tex("loc:" + String(node_def["kind"])), 4)
	pv.position = Vector2(0, 40)
	pv.fx_drawer = _fx
	add_child(pv)

	var right := UI.panel()
	right.position = Vector2(808, 48)
	right.custom_minimum_size = Vector2(464, 664)
	right.size = Vector2(464, 664)
	add_child(right)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 8)
	right.add_child(rv)
	rv.add_child(UI.label(node_def["name"], 28, UI.COL_ACCENT, true))
	rv.add_child(UI.label(node_def["desc"], 16, UI.COL_DIM))
	rv.add_child(HSeparator.new())
	act_box = VBoxContainer.new()
	act_box.add_theme_constant_override("separation", 4)
	act_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rv.add_child(act_box)
	rv.add_child(UI.button("지도 펼치기 (다음 목적지 고르기)", _to_map, 52))

	var bottom := UI.panel()
	bottom.position = Vector2(8, 528)
	bottom.custom_minimum_size = Vector2(792, 184)
	bottom.size = Vector2(792, 184)
	add_child(bottom)
	var bh := HBoxContainer.new()
	bh.add_theme_constant_override("separation", 16)
	bottom.add_child(bh)
	msg_label = UI.rich("", 17)
	msg_label.custom_minimum_size = Vector2(380, 0)
	msg_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bh.add_child(msg_label)
	bh.add_child(VSeparator.new())
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(350, 160)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	bh.add_child(scroll)
	inv_label = UI.rich("", 15)
	inv_label.custom_minimum_size = Vector2(330, 0)
	scroll.add_child(inv_label)

	add_child(Hud.new())
	if params.get("arrived", false):
		msg_label.text = "[b]%s에 도착했다.[/b]\n할 일을 고르세요." % node_def["name"]
	else:
		msg_label.text = "[b]%s[/b]\n할 일을 고르세요." % node_def["name"]
	_refresh()


func _refresh() -> void:
	for c in act_box.get_children():
		act_box.remove_child(c)
		c.queue_free()
	for act_id in node_def["activities"]:
		var a: Dictionary = DB.activities[act_id]
		var st := GameState.activity_status(act_id)
		var b := UI.button(a["label"], _on_act.bind(act_id), 44)
		b.disabled = not st["ok"]
		act_box.add_child(b)
		var d := String(a["desc"])
		if not st["ok"]:
			d += "  — " + String(st["reason"])
		var l := UI.label(d, 14, UI.COL_DIM)
		act_box.add_child(l)
	_refresh_inventory()


func _refresh_inventory() -> void:
	var lines: Array = ["[b]짐[/b]"]
	var coals := GameState.items_of("charcoal")
	var good := coals.filter(func(it): return it["type"] == "good").size()
	lines.append("숯 %d개 (숯가마 숲 숯 %d)" % [coals.size(), good])
	for it in GameState.items_of("ore"):
		lines.append("· %s — %s, %d일차" % [it["name"], it["source"], it["day"]])
	for it in GameState.items_of("steel"):
		lines.append("· [color=#b9bec8]%s[/color] — %s" % [it["name"], it["source"]])
	if GameState.items_of("ore").is_empty() and GameState.items_of("steel").is_empty():
		lines.append("원료 없음")
	inv_label.text = "\n".join(lines)


func _on_act(act_id: String) -> void:
	if act_id == "workshop":
		main.go("workshop")
		return
	var res := GameState.do_activity(act_id)
	if res == "":
		return
	msg_label.text = res
	flash_t = pv.time
	match act_id:
		"gather_satetsu": flash_text = "사철 +1"
		"mine_ore": flash_text = "철광석 +1"
		"charcoal": flash_text = "숯 +2"
		"rest", "camp_here": flash_text = "휴식"
		"resupply", "resupply_inn": flash_text = "식량 보충"
		_: flash_text = ""
	_refresh.call_deferred()


func _to_map() -> void:
	main.go("map")


func _fx(v, t: float) -> void:
	match String(node_def["kind"]):
		"village":
			_smoke(v, 114, 44, t, 6)
			var f := 0.5 + 0.5 * sin(t * 8.0) * sin(t * 2.3)
			v.px(95, 75, 10, 9, Color(1, 0.85, 0.4, 0.2 + 0.4 * f))
			for i in 3:
				var k := fmod(t * 0.3 + i * 0.33, 1.0)
				v.px(34 + k * 12, 102, 2, 1, Color(0.8, 0.9, 1, 1.0 - k))
		"forest":
			_smoke(v, 99, 64, t, 8)
			var f2 := int(t * 9.0) % 3
			v.px(95, 96 - f2, 10, 6 + f2, Art.c("fire_o"))
			v.px(98, 98, 4, 4, Art.c("fire_y"))
		"inn":
			var f3 := 0.5 + 0.5 * sin(t * 5.0)
			v.px(38, 70, 9, 9, Color(1, 0.7, 0.3, 0.25 + 0.4 * f3))
			v.px(60, 72, 18, 12, Color(1, 0.9, 0.5, 0.15 * f3))
			v.px(122, 72, 18, 12, Color(1, 0.9, 0.5, 0.15 * (1.0 - f3)))
		"river":
			for i in 14:
				var k := fmod(t * 0.3 + i * 0.07, 1.0)
				v.px(fmod(i * 41.0 + k * 30.0, 200.0), 54 + (i * 7) % 32, 5, 1, Color(0.85, 0.95, 1, 0.8 * (1.0 - k)))
			if int(t * 3.0) % 2 == 0:
				v.px(150, 96, 2, 2, Color(1, 1, 1, 0.8))
		"mountain":
			for i in 3:
				var k := fmod(t * 0.5 + i * 0.33, 1.0)
				v.px(110 + i * 20, 20 + k * 50, 1, 1, Art.c("stone_l"))
			v.px(98, 74, 4, 4, Color(1, 0.7, 0.3, 0.3 + 0.2 * sin(t * 6.0)))
	# 활동 결과 떠오르는 표시
	var age: float = t - flash_t
	if age >= 0.0 and age < 1.6 and flash_text != "":
		var a := 1.0 - age / 1.6
		for i in 8:
			var ang := i * TAU / 8.0 + age * 2.0
			v.px(100 + cos(ang) * (10 + age * 20), 60 + sin(ang) * (6 + age * 12), 2, 2, Color(1, 0.9, 0.4, a))
		v.draw_string(UI.font(true), Vector2(340, 220 - age * 60), flash_text, HORIZONTAL_ALIGNMENT_CENTER, 120, 28, Color(1, 0.95, 0.7, a))


func _smoke(v, x: float, y: float, t: float, n: int) -> void:
	for i in n:
		var k := fmod(t * 0.3 + i / float(n), 1.0)
		var s := 2 + int(k * 4.0)
		v.px(x + sin(k * 5.0 + i) * 4.0, y - k * 40.0, s, s, Color(0.72, 0.7, 0.76, 0.6 * (1.0 - k)))
