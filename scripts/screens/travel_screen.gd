extends Control
## 이동/사건 화면. 하루 이동 → 그날의 사건 → 사건 대응 → 다음 행동 선택.
## 선택을 기다리는 동안 시간과 거리는 진행되지 않는다.

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")
const Hud = preload("res://scripts/ui/hud.gd")

var main
var pv
var track: Control
var track_label: Label
var event_box: VBoxContainer
var action_box: VBoxContainer
var log_label: Label
var collapse_losses: Array = []


func setup(m, _params: Dictionary) -> void:
	main = m
	if GameState.travel.is_empty():
		main.go.call_deferred("map")
		return
	pv = PixelView.new()
	pv.setup(Art.tex("travel:" + String(GameState.travel["terrain"])), 4)
	pv.position = Vector2(0, 40)
	pv.fx_drawer = _fx
	add_child(pv)

	# 여정 기록 (그림 위 왼쪽)
	var log_panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.04, 0.06, 0.62)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	log_panel.add_theme_stylebox_override("panel", sb)
	log_panel.position = Vector2(8, 48)
	log_panel.custom_minimum_size = Vector2(470, 0)
	log_label = UI.label("", 14, Color8(230, 222, 205))
	log_panel.add_child(log_label)
	add_child(log_panel)

	# 진행 위치 띠
	var strip := UI.panel()
	strip.position = Vector2(8, 402)
	strip.custom_minimum_size = Vector2(1264, 84)
	strip.size = Vector2(1264, 84)
	add_child(strip)
	track = Control.new()
	track.custom_minimum_size = Vector2(1230, 62)
	track.draw.connect(_draw_track)
	strip.add_child(track)

	var ev_panel := UI.panel()
	ev_panel.position = Vector2(8, 490)
	ev_panel.custom_minimum_size = Vector2(784, 224)
	ev_panel.size = Vector2(784, 224)
	add_child(ev_panel)
	event_box = VBoxContainer.new()
	event_box.add_theme_constant_override("separation", 6)
	ev_panel.add_child(event_box)

	var act_panel := UI.panel()
	act_panel.position = Vector2(800, 490)
	act_panel.custom_minimum_size = Vector2(472, 224)
	act_panel.size = Vector2(472, 224)
	add_child(act_panel)
	action_box = VBoxContainer.new()
	action_box.add_theme_constant_override("separation", 6)
	act_panel.add_child(action_box)

	add_child(Hud.new())
	_refresh()


func _clear(box: Container) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()


func _refresh() -> void:
	var tr: Dictionary = GameState.travel
	_clear(event_box)
	_clear(action_box)
	if tr.is_empty():
		_show_collapse_result()
		return
	var lines: Array = tr["log"]
	log_label.text = "\n".join(lines.slice(maxi(0, lines.size() - 5)))
	track.queue_redraw()

	var ev: Dictionary = tr["event"]
	var phase: String = tr["phase"]
	var day_kind := "노숙" if tr["today"] == "camp" else "이동"
	# ---- 사건 패널
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	event_box.add_child(head)
	if ev.has("portrait"):
		var tr_rect := TextureRect.new()
		tr_rect.texture = Art.tex("portrait:" + String(ev["portrait"]))
		tr_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tr_rect.custom_minimum_size = Vector2(72, 72)
		tr_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
		head.add_child(tr_rect)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(hv)
	hv.add_child(UI.label("%d일차 (%s) · 오늘의 사건: %s" % [GameState.day, day_kind, ev.get("title", "")], 21, UI.COL_ACCENT, true))
	hv.add_child(UI.label(GameState.event_text(ev), 17, UI.COL_TEXT))
	var changes: Array = tr["changes"]
	if phase == "event":
		if not changes.is_empty():
			event_box.add_child(UI.label("하루 경과: " + ", ".join(changes), 15, UI.COL_DIM))
		var row := HFlowContainer.new()
		row.add_theme_constant_override("h_separation", 8)
		row.add_theme_constant_override("v_separation", 6)
		event_box.add_child(row)
		var choices: Array = ev.get("choices", [])
		for i in choices.size():
			var ch: Dictionary = choices[i]
			var st := GameState.choice_status(ch)
			var txt: String = ch["label"]
			if not st["ok"]:
				txt += "  [%s]" % st["reason"]
			var b := UI.button(txt, _on_choice.bind(i), 42)
			b.disabled = not st["ok"]
			row.add_child(b)
	else:
		event_box.add_child(UI.label("→ " + String(tr["result_text"]), 17, UI.COL_GOOD))
		if not changes.is_empty():
			event_box.add_child(UI.label("변화: " + ", ".join(changes), 15, UI.COL_DIM))

	# ---- 행동 패널
	var going: bool = int(tr["dir"]) > 0
	match phase:
		"event":
			action_box.add_child(UI.label("먼저 오늘의 사건에 대응하세요.", 17, UI.COL_DIM))
			for t in _action_names(going):
				var b := UI.button(t, _noop, 44)
				b.disabled = true
				action_box.add_child(b)
		"choose":
			action_box.add_child(UI.label("다음 행동을 고르세요. (고를 때까지 시간이 흐르지 않습니다)", 16, UI.COL_DIM))
			var names := _action_names(going)
			action_box.add_child(UI.button(names[0], _act.bind("forward" if going else "back"), 46))
			action_box.add_child(UI.button(names[1], _act.bind("camp"), 46))
			action_box.add_child(UI.button(names[2], _act.bind("back" if going else "forward"), 46))
		"arrived":
			action_box.add_child(UI.label("%s에 도착했습니다." % DB.node_name(tr["to"]), 20, UI.COL_ACCENT, true))
			action_box.add_child(UI.label("도착한 날은 길 위 행동 대신 장소에서 할 일을 고릅니다.", 16, UI.COL_DIM))
			action_box.add_child(UI.button("%s에 들어가기" % DB.node_name(tr["to"]), _enter_place, 52))
		"returned":
			action_box.add_child(UI.label("출발했던 %s(으)로 돌아왔습니다." % DB.node_name(tr["from"]), 20, UI.COL_ACCENT, true))
			action_box.add_child(UI.button("%s에 들어가기" % DB.node_name(tr["from"]), _enter_place, 52))
		"collapsed":
			action_box.add_child(UI.label("피로가 한계에 달해 쓰러졌습니다.", 20, UI.COL_BAD, true))
			action_box.add_child(UI.label("(v0.1 임시 처리) 지나가던 짐꾼이 공방 마을로 데려다줍니다. 일부 원료와 식량을 잃습니다.", 16, UI.COL_DIM))
			action_box.add_child(UI.button("정신을 차린다", _on_collapse, 52))


func _action_names(going: bool) -> Array:
	var tr: Dictionary = GameState.travel
	var to_dest := GameState.days_to_dest()
	var to_origin := GameState.days_to_origin()
	var camp := "노숙하기 (제자리, 식량 -%d, 피로 -%d)" % [int(DB.b("camp_food")), int(DB.b("camp_fatigue_recover"))]
	if going:
		return ["진행하기 → %s (남은 %d일)" % [DB.node_name(tr["to"]), to_dest], camp,
			"되돌아가기 ← %s (%d일)" % [DB.node_name(tr["from"]), to_origin]]
	return ["귀환 계속 ← %s (남은 %d일)" % [DB.node_name(tr["from"]), to_origin], camp,
		"목적지로 다시 향하기 → %s (%d일)" % [DB.node_name(tr["to"]), to_dest]]


func _noop() -> void:
	pass


func _on_choice(i: int) -> void:
	GameState.resolve_event(i)
	_refresh.call_deferred()


func _act(kind: String) -> void:
	match kind:
		"forward": GameState.action_forward()
		"back": GameState.action_back()
		"camp": GameState.action_camp()
	_refresh.call_deferred()


func _enter_place() -> void:
	var loc := GameState.finish_travel()
	if loc != "":
		main.go("location", {"arrived": true})


func _on_collapse() -> void:
	collapse_losses = GameState.collapse_and_rescue()
	_refresh.call_deferred()


func _show_collapse_result() -> void:
	event_box.add_child(UI.label("공방 마을에서 깨어났다", 22, UI.COL_ACCENT, true))
	event_box.add_child(UI.label("손실 내역\n· " + "\n· ".join(collapse_losses), 17, UI.COL_TEXT))
	action_box.add_child(UI.label("식량 %d, 피로 %d로 다시 시작합니다." % [GameState.food, GameState.fatigue], 17, UI.COL_DIM))
	action_box.add_child(UI.button("공방 마을로", func(): main.go("location"), 52))


# ------------------------------------------------------------------ 진행 위치 띠

func _draw_track() -> void:
	var tr: Dictionary = GameState.travel
	if tr.is_empty():
		return
	var f := UI.font(true)
	var fr := UI.font()
	var x0 := 250.0
	var x1 := 960.0
	var y := 34.0
	var d: int = tr["days"]
	var dir: int = tr["dir"]
	var info := "목적지까지 %d일 · 출발지까지 %d일 · 진행 방향: %s" % [
		GameState.days_to_dest(), GameState.days_to_origin(), "목적지 쪽 →" if dir > 0 else "← 출발지 쪽 (귀환 중)"]
	track.draw_string(fr, Vector2(x0, 12), info, HORIZONTAL_ALIGNMENT_CENTER, x1 - x0, 16, UI.COL_TEXT)
	track.draw_string(f, Vector2(0, y + 7), "출발: " + DB.node_name(tr["from"]), HORIZONTAL_ALIGNMENT_LEFT, 230, 18, UI.COL_TEXT)
	track.draw_string(f, Vector2(x1 + 40, y + 7), "목적지: " + DB.node_name(tr["to"]), HORIZONTAL_ALIGNMENT_LEFT, 230, 18, UI.COL_ACCENT)
	track.draw_rect(Rect2(x0, y - 2, x1 - x0, 4), Color8(156, 123, 69))
	for i in d + 1:
		var tx := lerpf(x0, x1, i / float(d))
		track.draw_rect(Rect2(tx - 4, y - 8, 8, 16), Color8(201, 169, 107) if (i == 0 or i == d) else Color8(110, 90, 60))
		if i > 0 and i < d:
			track.draw_string(fr, Vector2(tx - 45, y + 26), "%d일째 지점" % i, HORIZONTAL_ALIGNMENT_CENTER, 90, 13, UI.COL_DIM)
	var mx := lerpf(x0, x1, int(tr["x"]) / float(d))
	track.draw_rect(Rect2(mx - 10, y - 14, 20, 28), Color8(200, 64, 44))
	track.draw_rect(Rect2(mx - 6, y - 10, 12, 20), Color8(255, 209, 102))
	var ax := mx + 14.0 * dir
	var pts := PackedVector2Array([Vector2(ax, y - 8), Vector2(ax, y + 8), Vector2(ax + 12 * dir, y)])
	track.draw_colored_polygon(pts, Color8(255, 209, 102))


# ------------------------------------------------------------------ 그림 효과

func _fx(v, t: float) -> void:
	var tr: Dictionary = GameState.travel
	if tr.is_empty():
		return
	var camp: bool = tr["today"] == "camp"
	var road_y := 80.0 if tr["terrain"] in ["forest", "river"] else 76.0
	if tr["terrain"] == "plains":
		road_y = 75.0
	# 구름
	if not camp:
		for i in 3:
			var cx := fmod(t * (4.0 + i) + i * 110.0, 360.0) - 30.0
			v.px(cx, 6 + i * 7, 22, 3, Color(1, 1, 1, 0.55))
			v.px(cx + 4, 4 + i * 7, 12, 2, Color(1, 1, 1, 0.55))
	if camp:
		v.overlay(Color(0.05, 0.05, 0.2, 0.55))
		for i in 18:
			var sx := fmod(i * 53.0, 320.0)
			var sy := fmod(i * 17.0, 40.0)
			if int(t * 2.0 + i) % 5 != 0:
				v.px(sx, sy, 1, 1, Color(1, 1, 0.9, 0.9))
	var px0 := 150.0
	var dir: int = tr["dir"]
	var walking: bool = not camp and tr["phase"] == "event"
	var bob := 0.0
	if walking:
		bob = 1.0 if int(t * 4.0) % 2 == 0 else 0.0
	if camp:
		_campfire(v, px0 + 14, road_y, t)
		_tent(v, px0 - 24, road_y)
	_traveler(v, px0, road_y - bob, dir, walking and int(t * 4.0) % 2 == 0)
	if "benkei" in GameState.companions:
		_benkei(v, px0 - 16 * dir, road_y, dir)
	if tr["fx"] == "rain":
		for i in 70:
			var rx := fmod(i * 37.0 + t * 60.0, 330.0) - 5.0
			var ry := fmod(i * 23.0 + t * 140.0, 95.0)
			v.px(rx, ry, 1, 3, Color(0.75, 0.85, 1.0, 0.55))
		v.overlay(Color(0.2, 0.25, 0.35, 0.18))


func _traveler(v, x: float, y: float, dir: int, step: bool) -> void:
	var skin := Color8(214, 168, 128)
	v.px(x - 2 * dir - (2 if dir > 0 else 0), y - 11, 3, 6, Art.c("wood"))      # 등짐
	v.px(x - 1, y - 10, 4, 6, Art.c("water_d"))       # 몸
	v.px(x - 1, y - 13, 4, 3, skin)                   # 얼굴
	v.px(x - 3, y - 14, 8, 1, Art.c("sand"))          # 삿갓
	v.px(x - 1, y - 15, 4, 1, Art.c("sand"))
	v.px(x - 1 + (1 if step else 0), y - 4, 1, 4, Art.c("ink"))
	v.px(x + 2 - (1 if step else 0), y - 4, 1, 4, Art.c("ink"))


func _benkei(v, x: float, y: float, _dir: int) -> void:
	v.px(x - 2, y - 15, 7, 11, Art.c("ink"))
	v.px(x - 2, y - 18, 7, 4, Art.c("paper"))
	v.px(x - 1, y - 17, 5, 3, Color8(214, 168, 128))
	v.px(x - 2, y - 4, 2, 4, Art.c("ink"))
	v.px(x + 3, y - 4, 2, 4, Art.c("ink"))
	v.px(x + 6, y - 22, 1, 20, Art.c("wood"))
	v.px(x + 5, y - 23, 3, 2, Art.c("iron_l"))


func _campfire(v, x: float, y: float, t: float) -> void:
	v.px(x - 3, y - 1, 7, 2, Art.c("wood_d"))
	var f := int(t * 10.0) % 3
	v.px(x - 2, y - 4, 5, 3, Art.c("fire_r"))
	v.px(x - 1, y - 6 - f, 3, 3 + f, Art.c("fire_o"))
	v.px(x, y - 7 - f, 1, 3, Art.c("fire_y"))
	var glow := 0.07 + 0.03 * sin(t * 9.0)
	for r in [14, 10, 6]:
		v.px(x - r, y - r, r * 2 + 1, r + 2, Color(1.0, 0.6, 0.2, glow))
	for i in 3:
		var k := fmod(t * 0.8 + i * 0.33, 1.0)
		v.px(x + sin(k * 7.0) * 2.0, y - 10 - k * 20.0, 1, 1, Color(1, 0.8, 0.3, 1.0 - k))


func _tent(v, x: float, y: float) -> void:
	for i in 8:
		v.px(x - i, y - 8 + i, i * 2 + 1, 1, Art.c("sand_d") if i % 3 else Art.c("sand"))
	v.px(x, y - 4, 1, 4, Art.c("ink"))
