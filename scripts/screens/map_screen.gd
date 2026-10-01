extends Control
## 지도: 장소 노드와 길(간선). 현재 노드와 직접 연결된 인접 노드 하나만 목적지로 고른다.
## 여러 구간을 잇는 경로 예약·자동 경로 탐색은 없다.

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")
const Hud = preload("res://scripts/ui/hud.gd")

const MAP_X := 0
const MAP_Y := 40
const S := 4

var main
var selected: String = ""
var pv
var info_box: VBoxContainer
var depart_btn: Button
var msg_label: Label


func setup(m, params: Dictionary) -> void:
	main = m
	pv = PixelView.new()
	pv.setup(Art.tex("map"), S)
	pv.position = Vector2(MAP_X, MAP_Y)
	pv.fx_drawer = _fx
	add_child(pv)

	# 노드 버튼과 이름표
	for id in DB.map["nodes"]:
		var n: Dictionary = DB.map["nodes"][id]
		var p := Vector2(n["pos"][0], n["pos"][1]) * S + Vector2(MAP_X, MAP_Y)
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		b.position = p - Vector2(34, 30)
		b.size = Vector2(68, 56)
		b.tooltip_text = n["name"]
		var empty := StyleBoxEmpty.new()
		for st in ["normal", "hover", "pressed", "focus", "disabled"]:
			b.add_theme_stylebox_override(st, empty)
		b.pressed.connect(_on_node.bind(id))
		add_child(b)
		var tag := _name_tag(n["name"], id)
		tag.position = p + Vector2(-tag.size.x / 2.0, 30)
		add_child(tag)

	_build_panel(params.get("intro", false))
	add_child(Hud.new())
	_refresh()


func _name_tag(text: String, id: String) -> PanelContainer:
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	var here: bool = id == GameState.location
	sb.bg_color = Color(0.08, 0.06, 0.09, 0.85)
	sb.border_color = UI.COL_ACCENT if here else Color(0, 0, 0, 0)
	sb.set_border_width_all(2 if here else 0)
	sb.content_margin_left = 6
	sb.content_margin_right = 6
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	pc.add_theme_stylebox_override("panel", sb)
	pc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := UI.label(text, 16, UI.COL_ACCENT if here else UI.COL_TEXT, here)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	pc.add_child(l)
	pc.size = pc.get_combined_minimum_size()
	return pc


func _build_panel(intro: bool) -> void:
	var panel := UI.panel()
	panel.position = Vector2(888, 48)
	panel.size = Vector2(384, 664)
	panel.custom_minimum_size = Vector2(384, 664)
	add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	panel.add_child(v)
	v.add_child(UI.label("지도", 26, UI.COL_ACCENT, true))
	v.add_child(UI.label("현재 위치: %s" % DB.node_name(GameState.location), 19, UI.COL_TEXT, true))
	if intro:
		v.add_child(UI.label("도공이 되어 재료를 구해 오고, 공방에서 칼을 만들어 봅시다. 사철(날용)과 철광석(속심용), 숯을 모아 공방 마을로 돌아오세요.", 16, UI.COL_DIM))
	v.add_child(UI.label("빛나는 테두리의 장소는 지금 위치와 길로 바로 이어진 곳입니다. 한 번에 한 구간만 출발할 수 있습니다.", 16, UI.COL_DIM))
	info_box = VBoxContainer.new()
	info_box.add_theme_constant_override("separation", 6)
	info_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(info_box)
	msg_label = UI.label("", 16, UI.COL_BAD)
	v.add_child(msg_label)
	depart_btn = UI.button("출발하기 (첫날 이동)", _on_depart, 52)
	v.add_child(depart_btn)
	v.add_child(UI.button("%s 둘러보기" % DB.node_name(GameState.location), _on_enter_here))


func _on_node(id: String) -> void:
	if id == GameState.location:
		selected = ""
		msg_label.text = "지금 있는 곳입니다. 아래 '둘러보기'로 장소 활동을 할 수 있습니다."
		_refresh()
		return
	var chk := GameState.can_depart(id)
	if not chk["ok"]:
		selected = ""
		msg_label.text = "%s: %s" % [DB.node_name(id), chk["reason"]]
		_refresh()
		return
	selected = id
	msg_label.text = ""
	_refresh()


func _refresh() -> void:
	for c in info_box.get_children():
		c.queue_free()
	if selected == "":
		info_box.add_child(UI.label("목적지를 고르세요.", 18, UI.COL_TEXT))
		var lines: Array = []
		for nb in DB.neighbors(GameState.location):
			var e := DB.edge(GameState.location, nb)
			lines.append("· %s — %d일 (%s)" % [DB.node_name(nb), e["days"], DB.terrain_name(e["terrain"])])
		info_box.add_child(UI.label("이어진 장소\n" + "\n".join(lines), 17, UI.COL_TEXT))
		depart_btn.disabled = true
		return
	var e := DB.edge(GameState.location, selected)
	var d: int = e["days"]
	var n: Dictionary = DB.node(selected)
	info_box.add_child(UI.label("목적지: %s" % n["name"], 21, UI.COL_ACCENT, true))
	info_box.add_child(UI.label(n["desc"], 16, UI.COL_DIM))
	var mf := int(DB.b("move_food"))
	var mt := int(DB.b("move_fatigue"))
	var txt := "구간: %s %d일\n편도 예상: 식량 -%d, 피로 +%d\n왕복 예상: 식량 -%d (노숙·사건 제외)\n현재: 식량 %d, 피로 %d/%d" % [
		DB.terrain_name(e["terrain"]), d, d * mf, d * mt, d * mf * 2, GameState.food, GameState.fatigue, GameState.fatigue_max()]
	info_box.add_child(UI.label(txt, 17, UI.COL_TEXT))
	if GameState.food < d * mf:
		info_box.add_child(UI.label("식량이 편도에도 모자랍니다. 굶으면 피로가 크게 오릅니다.", 16, UI.COL_BAD))
	elif GameState.food < d * mf * 2:
		info_box.add_child(UI.label("왕복하기에는 식량이 빠듯합니다.", 16, UI.COL_ACCENT))
	if GameState.fatigue + d * mt >= GameState.fatigue_max():
		info_box.add_child(UI.label("이대로면 도중에 탈진할 수 있습니다. 노숙으로 쉬어 가세요.", 16, UI.COL_BAD))
	depart_btn.disabled = false
	depart_btn.text = "%s(으)로 출발 (첫날 이동)" % n["name"]


func _on_depart() -> void:
	if selected == "" or not GameState.depart(selected):
		return
	main.go("travel")


func _on_enter_here() -> void:
	main.go("location")


func _fx(v, t: float) -> void:
	var nodes: Dictionary = DB.map["nodes"]
	var here: Array = nodes[GameState.location]["pos"]
	var pulse := 0.5 + 0.5 * sin(t * 4.0)
	# 선택 구간 강조
	if selected != "":
		var to: Array = nodes[selected]["pos"]
		var steps := 24
		for i in steps + 1:
			var k := i / float(steps)
			if int(i + t * 8.0) % 3 == 0:
				v.px(lerpf(here[0], to[0], k), lerpf(here[1], to[1], k), 2, 2, Color(1, 0.85, 0.4, 0.95))
	# 인접 노드 테두리
	for nb in DB.neighbors(GameState.location):
		var p: Array = nodes[nb]["pos"]
		var col := Color(1, 0.85, 0.4, 0.45 + 0.5 * pulse)
		if nb == selected:
			col = Color(1, 1, 1, 0.95)
		_ring(v, p[0], p[1], 11, 9, col)
	# 현재 위치 표시 (깃발)
	var by := sin(t * 3.0) * 1.0
	v.px(here[0] - 1, here[1] - 20 + by, 1, 9, Art.c("ink"))
	v.px(here[0], here[1] - 20 + by, 6, 4, Art.c("fire_r"))
	v.px(here[0], here[1] - 20 + by, 6, 1, Art.c("fire_y"))
	# 연기·물결 등 짧은 반복 효과
	var village: Array = nodes["village"]["pos"]
	_smoke(v, village[0] + 8, village[1] - 10, t)
	var forest: Array = nodes["forest"]["pos"]
	_smoke(v, forest[0], forest[1] - 5, t + 0.5)
	for i in 4:
		var k := fmod(t * 0.25 + i * 0.25, 1.0)
		v.px(120 + k * 14, 46 - k * 6, 2, 1, Color(0.8, 0.9, 1, 0.7 * (1.0 - k)))


func _ring(v, cx: float, cy: float, hw: int, hh: int, col: Color) -> void:
	v.px(cx - hw, cy - hh, hw * 2, 1, col)
	v.px(cx - hw, cy + hh, hw * 2 + 1, 1, col)
	v.px(cx - hw, cy - hh, 1, hh * 2, col)
	v.px(cx + hw, cy - hh, 1, hh * 2, col)


func _smoke(v, x: float, y: float, t: float) -> void:
	for i in 4:
		var k := fmod(t * 0.4 + i * 0.25, 1.0)
		v.px(x + sin(k * 5.0 + i) * 2.0, y - k * 14.0, 2, 2, Color(0.75, 0.73, 0.78, 0.7 * (1.0 - k)))
