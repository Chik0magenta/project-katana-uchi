extends Control
## 공방: 강괴 감정·선택 → 강재 두 개 단련(가열·접쇠) → 피철/심철 배정 → 츠쿠리코미(자동)
## → 성형 → 다듬기·점토(기본 패턴) → 담금질 → 결과.
## 공방의 짧은 실시간 가열은 탐험의 일일 진행과 별개의 시간이다.

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")
const Hud = preload("res://scripts/ui/hud.gd")
const Heat = preload("res://scripts/core/heat.gd")
const RefineSession = preload("res://scripts/core/refine_session.gd")
const ShapingSession = preload("res://scripts/core/shaping_session.gd")
const QuenchSession = preload("res://scripts/core/quench_session.gd")
const BladeResult = preload("res://scripts/core/blade_result.gd")

const STEPS := [["select", "① 재료 감정"], ["refine", "② 단련 (강재 2개)"], ["assign", "③ 피철·심철 배정"],
	["join", "④ 접합"], ["shape", "⑤ 성형"], ["clay", "⑥ 다듬기·점토"], ["quench", "⑦ 담금질"]]

# 저해상도 그림 좌표
const FORGE_MOUTH := Rect2(30, 46, 60, 16)
const ANVIL_TOP := 54.0
const BLADE_X0 := 118.0
const BLADE_LEN := 120.0

var main
var pv
var step_box: HBoxContainer
var left_box: VBoxContainer
var right_box: VBoxContainer

var phase: String = "select"
var selected_uids: Array = []
var chosen: Array = []          # 단련할 강괴 아이템 2개
var refined: Array = []         # 단련 끝난 강재 2개
var refine_idx: int = 0
var refine
var edge: Dictionary = {}
var core: Dictionary = {}
var shaping
var quench
var anim: Dictionary = {}       # {kind, t0, dur, ...}
var parts: Array = []           # 불꽃·증기·산화물 입자
var clay_k: float = 0.0
var last_msg: String = ""

# 실시간 갱신용 참조
var status_rich: RichTextLabel
var dyn_buttons: Dictionary = {}
var seg_bars: Array = []


func setup(m, params: Dictionary) -> void:
	main = m
	pv = PixelView.new()
	pv.setup(Art.tex("workshop"), 4)
	pv.position = Vector2(0, 76)
	pv.fx_drawer = _fx
	add_child(pv)

	var strip := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.08, 0.95)
	sb.content_margin_left = 12
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	strip.add_theme_stylebox_override("panel", sb)
	strip.position = Vector2(0, 40)
	strip.custom_minimum_size = Vector2(1280, 36)
	strip.size = Vector2(1280, 36)
	add_child(strip)
	step_box = HBoxContainer.new()
	step_box.add_theme_constant_override("separation", 18)
	strip.add_child(step_box)

	var lp := UI.panel()
	lp.position = Vector2(8, 482)
	lp.custom_minimum_size = Vector2(760, 232)
	lp.size = Vector2(760, 232)
	add_child(lp)
	left_box = VBoxContainer.new()
	left_box.add_theme_constant_override("separation", 6)
	lp.add_child(left_box)
	var rp := UI.panel()
	rp.position = Vector2(776, 482)
	rp.custom_minimum_size = Vector2(496, 232)
	rp.size = Vector2(496, 232)
	add_child(rp)
	right_box = VBoxContainer.new()
	right_box.add_theme_constant_override("separation", 6)
	rp.add_child(right_box)

	add_child(Hud.new())
	if params.get("auto_result", false):
		_auto_play()
		return
	_build()


# ================================================================ 공통

func _clear() -> void:
	for box in [left_box, right_box]:
		for c in box.get_children():
			box.remove_child(c)
			c.queue_free()
	dyn_buttons = {}
	seg_bars = []
	status_rich = null


func _set_phase(p: String) -> void:
	phase = p
	_build.call_deferred()


func _build() -> void:
	_clear()
	for c in step_box.get_children():
		step_box.remove_child(c)
		c.queue_free()
	var cur := 0
	for i in STEPS.size():
		if STEPS[i][0] == phase:
			cur = i
	for i in STEPS.size():
		var col := UI.COL_ACCENT if i == cur else (UI.COL_TEXT if i < cur else UI.COL_DIM)
		var l := UI.label(STEPS[i][1], 16, col, i == cur)
		l.autowrap_mode = TextServer.AUTOWRAP_OFF
		step_box.add_child(l)
	match phase:
		"select": _build_select()
		"refine": _build_refine()
		"assign": _build_assign()
		"join": _build_join()
		"shape": _build_shape()
		"clay": _build_clay()
		"quench": _build_quench()


func _appraise(s: Dictionary) -> String:
	var t := "탄소 %s · 균일도 %s · 불순도 %s" % [DB.level_text("carbon", s["carbon"]),
		DB.level_text("uniformity", s["uniformity"]), DB.level_text("impurity", s["impurity"])]
	if GameState.dev_numbers:
		t += "  [color=#9c7b45](C %.2f%% / U %d / I %d)[/color]" % [s["carbon"], int(s["uniformity"]), int(s["impurity"])]
	return t


func _dyn(key: String, text: String, cb: Callable, h: int = 44, parent: Container = null) -> Button:
	var b := UI.button(text, cb, h)
	dyn_buttons[key] = b
	if parent == null:
		parent = right_box
	if parent is GridContainer:
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(b)
	return b


func _temp_line(t: float) -> String:
	var col := Heat.color(t)
	var s := "[color=#%s]■■[/color] [b]%s[/b]" % [col.to_html(false), Heat.text(t)]
	if GameState.dev_numbers:
		s += " [color=#9c7b45](%d°C)[/color]" % int(t)
	return s


# ================================================================ ① 재료 감정·선택

func _build_select() -> void:
	left_box.add_child(UI.label("강괴를 감정하고 단련할 두 개를 고르세요", 19, UI.COL_ACCENT, true))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(730, 172)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left_box.add_child(scroll)
	var list := VBoxContainer.new()
	list.custom_minimum_size = Vector2(710, 0)
	list.add_theme_constant_override("separation", 4)
	scroll.add_child(list)
	var steels := GameState.items_of("steel")
	for it in steels:
		var row := HBoxContainer.new()
		var cb := CheckBox.new()
		cb.button_pressed = it["uid"] in selected_uids
		cb.toggled.connect(_on_pick.bind(it["uid"]))
		row.add_child(cb)
		var r := UI.rich("[b]%s[/b] — %s\n%s" % [it["name"], it["source"], _appraise(it)], 15)
		r.custom_minimum_size = Vector2(660, 0)
		row.add_child(r)
		list.add_child(row)
	var ores := GameState.items_of("ore")
	var coal_n := GameState.count_of("charcoal")
	for it in ores:
		var row2 := HBoxContainer.new()
		var b := UI.button("제철", _on_smelt.bind(it["uid"]), 36)
		b.custom_minimum_size = Vector2(70, 36)
		b.disabled = coal_n == 0
		row2.add_child(b)
		var r2 := UI.rich("원료: [b]%s[/b] — %s, %d일차  [color=#aaa096](제철: 원료 1 + 숯 1 → 강괴)[/color]" % [it["name"], it["source"], it["day"]], 15)
		r2.custom_minimum_size = Vector2(620, 0)
		row2.add_child(r2)
		list.add_child(row2)
	if steels.is_empty() and ores.is_empty():
		list.add_child(UI.label("강괴도 원료도 없습니다. 탐험에서 원료를 구해 오거나 창고의 고철을 쓰세요.", 16, UI.COL_DIM))

	right_box.add_child(UI.label("하나는 피철(날·바깥층), 하나는 심철(속심)이 됩니다. 탄소가 높은 강재는 날에, 낮은 강재는 속심에 어울립니다.", 15, UI.COL_DIM))
	right_box.add_child(UI.label("숯 %d개 보유 (제철에 1개씩 사용)" % coal_n, 15, UI.COL_TEXT))
	var start := UI.button("선택한 두 강재로 단련 시작 (%d/2)" % selected_uids.size(), _on_start, 48)
	start.disabled = selected_uids.size() != 2
	right_box.add_child(start)
	if steels.size() + (ores.size() if coal_n > 0 else 0) < 2:
		right_box.add_child(UI.button("창고의 고철 강괴 받기 (재료가 모자랄 때)", _on_scrap, 40))
	right_box.add_child(UI.button("공방 나가기", func(): main.go("location"), 40))
	if last_msg != "":
		right_box.add_child(UI.label(last_msg, 14, UI.COL_GOOD))


func _on_pick(on: bool, uid: int) -> void:
	if on and not (uid in selected_uids):
		selected_uids.append(uid)
		if selected_uids.size() > 2:
			selected_uids.pop_front()
	elif not on:
		selected_uids.erase(uid)
	_build.call_deferred()


func _on_smelt(uid: int) -> void:
	var s := GameState.smelt(uid)
	if not s.is_empty():
		last_msg = "제철 완료: %s (%s 사용)" % [s["name"], s["charcoal"]]
		_spawn_sparks(60, 52, 18, Art.c("fire_y"))
	_build.call_deferred()


func _on_scrap() -> void:
	GameState.add_scrap_steel()
	GameState.state_changed.emit()
	last_msg = "창고에서 낡은 고철 강괴를 꺼냈다."
	_build.call_deferred()


func _on_start() -> void:
	if selected_uids.size() != 2:
		return
	chosen = []
	for uid in selected_uids:
		chosen.append(GameState.find_item(uid))
		GameState.remove_item(uid)
	GameState.state_changed.emit()
	refine_idx = 0
	refine = RefineSession.new(chosen[0], DB.b("forge"))
	_set_phase("refine")


# ================================================================ ② 단련

func _build_refine() -> void:
	var st: Dictionary = refine.steel
	left_box.add_child(UI.label("강재 %d/2 단련: %s (%s)" % [refine_idx + 1, st["name"], st["source"]], 18, UI.COL_ACCENT, true))
	status_rich = UI.rich("", 16)
	left_box.add_child(status_rich)
	left_box.add_child(UI.label("주황~노란 주황일 때 꺼내 산화물을 털고 접으세요. 노란빛을 넘기면 탄소가 빠지고 산화물이 빠르게 쌓입니다. 숯을 넣고 오래 달구면 탄소가 서서히 붙습니다.", 14, UI.COL_DIM))
	var g1 := GridContainer.new()
	g1.columns = 2
	right_box.add_child(g1)
	_dyn("fuel", "숯 보충", _on_fuel, 42, g1)
	_dyn("air", "풀무질", _on_air, 42, g1)
	_dyn("out", "꺼내서 모루에 올리기", _on_take_out, 42, g1)
	_dyn("in", "화덕에 다시 넣기", _on_put_in, 42, g1)
	var g2 := GridContainer.new()
	g2.columns = 2
	right_box.add_child(g2)
	_dyn("scale", "산화물 털기", _on_scale, 42, g2)
	_dyn("fold", "늘이고 접기", _on_fold, 42, g2)
	_dyn("done", "이 강재 단련 마치기", _on_refine_done, 38)


func _update_refine() -> void:
	if status_rich == null:
		return
	var r = refine
	var cur := {"carbon": r.carbon, "uniformity": r.uniformity, "impurity": r.impurity}
	var fl := ""
	if not r.fold_log.is_empty():
		var lr: Dictionary = r.fold_log[-1]
		fl = "\n최근 접쇠 %d회차: 균일도 +%.0f, 불순도 %+.1f, 탄소 -%.3f%s" % [lr["fold"], lr["du"], -lr["di"], lr["dc"],
			("  (" + ", ".join(lr["notes"]) + ")") if not lr["notes"].is_empty() else ""]
		if not GameState.dev_numbers:
			fl = "\n최근 접쇠 %d회차%s" % [lr["fold"], ("  (" + ", ".join(lr["notes"]) + ")") if not lr["notes"].is_empty() else ""]
	var where := "화덕 안" if r.in_fire else "모루 위"
	status_rich.text = "온도: %s · %s\n숯 %s · 풀무 %s · 산화물 %s · 접쇠 %d/%d회\n현재 감정: %s%s" % [
		_temp_line(r.temp), where, _bar(r.fuel), _bar(r.air), _bar(r.scale), r.folds, int(DB.b("forge")["max_folds"]),
		_appraise(cur), fl]
	dyn_buttons["fuel"].disabled = not r.in_fire
	dyn_buttons["air"].disabled = not r.in_fire
	dyn_buttons["out"].disabled = not r.in_fire
	dyn_buttons["in"].disabled = r.in_fire
	dyn_buttons["scale"].disabled = r.in_fire or r.scale < 1.0
	var cf: Dictionary = r.can_fold()
	dyn_buttons["fold"].disabled = not cf["ok"]
	dyn_buttons["fold"].text = "늘이고 접기 (%d/%d)" % [r.folds, int(DB.b("forge")["max_folds"])]
	dyn_buttons["fold"].tooltip_text = cf["reason"]
	if not r.in_fire and not cf["ok"]:
		status_rich.text += "\n[color=#f07864]%s[/color]" % cf["reason"]
	dyn_buttons["done"].text = "이 강재 단련 마치기" if r.folds > 0 else "이 강재 단련 마치기 (접쇠 없이)"


func _bar(v: float) -> String:
	var n := int(round(v / 20.0))
	return "[color=#ffd166]" + "▮".repeat(n) + "[/color][color=#555]" + "▮".repeat(5 - n) + "[/color]"


func _on_fuel() -> void:
	refine.add_fuel()
	_spawn_sparks(60, 50, 6, Art.c("fire_o"))


func _on_air() -> void:
	refine.bellows()
	_spawn_sparks(60, 48, 10, Art.c("fire_y"))


func _on_take_out() -> void:
	refine.take_out()


func _on_put_in() -> void:
	refine.put_in()


func _on_scale() -> void:
	if refine.remove_scale():
		for i in 14:
			parts.append({"x": randf_range(156, 186), "y": ANVIL_TOP - 4, "vx": randf_range(-12, 12), "vy": randf_range(-20, 0),
				"life": 1.0, "max": 1.0, "col": Art.c("iron_d"), "g": 60.0, "s": 1})


func _on_fold() -> void:
	var rec: Dictionary = refine.fold()
	if rec.is_empty():
		return
	anim = {"kind": "hammer", "t0": pv.time, "dur": 0.45, "x": 170.0}
	_spawn_sparks(170, ANVIL_TOP - 4, 22, Art.c("fire_y"))


func _on_refine_done() -> void:
	refined.append(refine.result_steel())
	if refine_idx == 0:
		refine_idx = 1
		refine = RefineSession.new(chosen[1], DB.b("forge"))
		_set_phase("refine")
	else:
		refine = null
		_set_phase("assign")


# ================================================================ ③ 배정

func _build_assign() -> void:
	left_box.add_child(UI.label("단련을 마친 두 강재", 19, UI.COL_ACCENT, true))
	for i in 2:
		var s: Dictionary = refined[i]
		left_box.add_child(UI.rich("[b]강재 %d: %s[/b] — %s, 접쇠 %d회\n%s" % [i + 1, s["name"], s["source"], s["folds"], _appraise(s)], 16))
	left_box.add_child(UI.label("두 강재의 성질은 평균내지 않고 각각 유지됩니다. 날은 피철의, 속심의 질김은 심철의 성질을 따릅니다.", 14, UI.COL_DIM))
	right_box.add_child(UI.label("어느 쪽을 피철(날·바깥층)로 쓸까요?", 18, UI.COL_TEXT, true))
	right_box.add_child(UI.button("강재 1 → 피철 / 강재 2 → 심철", _on_assign.bind(0), 50))
	right_box.add_child(UI.button("강재 2 → 피철 / 강재 1 → 심철", _on_assign.bind(1), 50))


func _on_assign(edge_i: int) -> void:
	edge = refined[edge_i]
	core = refined[1 - edge_i]
	_set_phase("join")


# ================================================================ ④ 츠쿠리코미 (자동)

func _build_join() -> void:
	left_box.add_child(UI.label("츠쿠리코미 (접합)", 19, UI.COL_ACCENT, true))
	left_box.add_child(UI.rich("피철 [b]%s[/b]이(가) 심철 [b]%s[/b]을(를) U자로 감싸는 고정 구조로 자동 접합합니다.\n[color=#aaa096]v0.1 단순화: 구조 선택 없이 한 가지 구조만 사용합니다.[/color]" % [edge["name"], core["name"]], 16))
	_dyn("join", "두드려 합치기", _on_join, 52)


func _on_join() -> void:
	dyn_buttons["join"].disabled = true
	anim = {"kind": "join", "t0": pv.time, "dur": 1.6, "x": 170.0}
	for i in 4:
		get_tree().create_timer(0.2 + i * 0.35).timeout.connect(_spawn_sparks.bind(170, ANVIL_TOP - 4, 14, Art.c("fire_y")))
	get_tree().create_timer(1.7).timeout.connect(_after_join)


func _after_join() -> void:
	if not is_inside_tree():
		return
	shaping = ShapingSession.new(DB.b("shaping"))
	_set_phase("shape")


# ================================================================ ⑤ 성형

func _build_shape() -> void:
	status_rich = UI.rich("", 16)
	left_box.add_child(status_rich)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	left_box.add_child(row)
	var names := ["칼끝", "2구간", "3구간", "4구간", "5구간", "밑동"]
	for i in shaping.segments.size():
		var col := VBoxContainer.new()
		col.custom_minimum_size = Vector2(112, 0)
		var pb := ProgressBar.new()
		pb.max_value = 130
		pb.custom_minimum_size = Vector2(112, 18)
		pb.show_percentage = false
		col.add_child(pb)
		seg_bars.append(pb)
		var b := UI.button(names[i], _on_hit.bind(i), 40)
		b.tooltip_text = "%s 두드리기" % names[i]
		col.add_child(b)
		row.add_child(col)
	left_box.add_child(UI.label("구간 버튼을 눌러 망치로 두드립니다. 주홍빛 이상일 때 두드리세요. 막대가 표시선(100)에 닿으면 완성입니다. 너무 많이 두드리면 얇아지고, 어두운 적색 이하에서 두드리면 안쪽에 금이 갑니다.", 14, UI.COL_DIM))
	_dyn("reheat", "다시 달구기", _on_reheat, 48)
	_dyn("finish", "성형 마치기", _on_shape_done, 48)


func _update_shape() -> void:
	if status_rich == null:
		return
	var s = shaping
	var where := "화덕에서 달구는 중…" if s.is_reheating() else "모루 위"
	status_rich.text = "[b]성형[/b] — 온도: %s · %s\n타격 %d회 · 냉간 타격 %d · 과타격 %d · 형상 품질 %d" % [
		_temp_line(s.temp), where, s.hits, s.cold_hits, s.over_hits, int(s.quality())]
	for i in seg_bars.size():
		seg_bars[i].value = s.segments[i]
		var fill := StyleBoxFlat.new()
		var v: float = s.segments[i]
		fill.bg_color = Color8(150, 210, 130) if v >= 90 and v <= 120 else (Color8(240, 120, 100) if v > 120 else Color8(214, 120, 60))
		seg_bars[i].add_theme_stylebox_override("fill", fill)
	dyn_buttons["reheat"].disabled = s.is_reheating()
	dyn_buttons["finish"].disabled = not s.can_finish()
	dyn_buttons["finish"].text = "성형 마치기" if s.can_finish() else "성형 마치기 (모든 구간 %d 이상 필요)" % int(DB.b("shaping")["finish_min"])


func _on_hit(i: int) -> void:
	var kind: String = shaping.hit(i)
	if kind == "":
		return
	var seg_w: float = BLADE_LEN / shaping.segments.size()
	var x: float = BLADE_X0 + BLADE_LEN - (i + 0.5) * seg_w
	anim = {"kind": "hammer", "t0": pv.time, "dur": 0.3, "x": x}
	match kind:
		"hot": _spawn_sparks(x, ANVIL_TOP - 4, 12, Art.c("fire_y"))
		"warm": _spawn_sparks(x, ANVIL_TOP - 4, 6, Art.c("fire_o"))
		"cold": _spawn_sparks(x, ANVIL_TOP - 4, 3, Art.c("iron_l"))
		"over": _spawn_sparks(x, ANVIL_TOP - 4, 8, Art.c("fire_r"))


func _on_reheat() -> void:
	shaping.reheat()


func _on_shape_done() -> void:
	_set_phase("clay")


# ================================================================ ⑥ 다듬기·점토

func _build_clay() -> void:
	left_box.add_child(UI.label("다듬기와 점토 바르기", 19, UI.COL_ACCENT, true))
	left_box.add_child(UI.label("도신을 다듬고 기본 점토 패턴(등 쪽은 두껍게, 날 쪽은 얇게)을 바릅니다. 점토가 얇은 날 쪽만 빠르게 식어 단단해집니다.", 15, UI.COL_TEXT))
	left_box.add_child(UI.label("v0.1 단순화: 점토 패턴 선택은 생략하고 기본 패턴 하나만 사용합니다.", 14, UI.COL_DIM))
	_dyn("clay", "다듬고 점토 바르기", _on_clay, 52)


func _on_clay() -> void:
	dyn_buttons["clay"].disabled = true
	anim = {"kind": "clay", "t0": pv.time, "dur": 1.4}
	get_tree().create_timer(1.5).timeout.connect(_after_clay)


func _after_clay() -> void:
	if not is_inside_tree():
		return
	clay_k = 1.0
	quench = QuenchSession.new(DB.b("quench"))
	_set_phase("quench")


# ================================================================ ⑦ 담금질

func _build_quench() -> void:
	status_rich = UI.rich("", 17)
	left_box.add_child(status_rich)
	var pb := ProgressBar.new()
	pb.min_value = 300
	pb.max_value = 1000
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(720, 20)
	seg_bars = [pb]
	left_box.add_child(pb)
	left_box.add_child(UI.label("앞에서 해 온 작업을 믿고, 색을 보며 물에 넣을 때를 고르세요. 너무 이르면 경화가 부족하고, 너무 늦으면 균열 위험이 커집니다.", 14, UI.COL_DIM))
	_dyn("quench", "담금질! (물에 넣기)", _on_quench, 56)
	_dyn("toggle", "화덕에서 잠시 꺼내 식히기", _on_toggle_fire, 42)


func _on_toggle_fire() -> void:
	quench.toggle_fire()


func _update_quench() -> void:
	if status_rich == null or quench == null:
		return
	var q = quench
	if q.done:
		status_rich.text = "[b]담금질 완료[/b] — %s에서 물에 넣었습니다." % Heat.text(q.quench_temp)
		return
	status_rich.text = "[b]담금질 가열[/b] — 온도: %s · %s\n[color=#aaa096]도공의 말: \"밝은 진홍빛일 때 물에 넣어라.\"[/color]" % [
		_temp_line(q.temp), "화덕 안" if q.in_fire else "화덕 밖 (식는 중)"]
	seg_bars[0].value = q.temp
	var fill := StyleBoxFlat.new()
	fill.bg_color = Heat.color(q.temp)
	seg_bars[0].add_theme_stylebox_override("fill", fill)
	dyn_buttons["toggle"].text = "화덕에서 잠시 꺼내 식히기" if q.in_fire else "화덕에 다시 넣기"


func _on_quench() -> void:
	if quench.done:
		return
	quench.quench()
	dyn_buttons["quench"].disabled = true
	dyn_buttons["toggle"].disabled = true
	anim = {"kind": "quench", "t0": pv.time, "dur": 2.2}
	for i in 40:
		_spawn_steam(randf_range(244, 292), 60, 1)
	get_tree().create_timer(0.6).timeout.connect(_more_steam)
	get_tree().create_timer(2.3).timeout.connect(_show_result_button)


func _more_steam() -> void:
	for i in 30:
		_spawn_steam(randf_range(244, 292), 60, 1)


func _show_result_button() -> void:
	if not is_inside_tree():
		return
	for c in right_box.get_children():
		right_box.remove_child(c)
		c.queue_free()
	right_box.add_child(UI.label("도신이 식었습니다. 결과를 확인하세요.", 16, UI.COL_TEXT))
	_dyn("result", "결과 보기", _finish, 56)


func _finish() -> void:
	var res := BladeResult.compute(edge, core, shaping, quench, DB.b("quench"))
	GameState.record_result(res)
	main.go("result", {"result": res})


# ================================================================ 개발용 자동 진행

func _auto_play() -> void:
	var steels := GameState.items_of("steel")
	steels.sort_custom(func(a, b): return a["carbon"] > b["carbon"])
	chosen = [steels[0], steels[-1]]
	for it in chosen:
		GameState.remove_item(it["uid"])
	refined = []
	for it in chosen:
		var r = RefineSession.new(it, DB.b("forge"))
		for f in 3:
			var guard := 0
			while r.temp < 1050.0 and guard < 2000:
				if r.fuel < 50:
					r.add_fuel()
				r.tick(0.05)
				guard += 1
			r.take_out()
			r.remove_scale()
			r.fold()
			r.put_in()
		refined.append(r.result_steel())
	edge = refined[0]
	core = refined[1]
	shaping = ShapingSession.new(DB.b("shaping"))
	var guard2 := 0
	while not shaping.can_finish() or shaping.unfinished_count() > 0:
		if shaping.temp < 820.0:
			shaping.reheat()
			while shaping.is_reheating():
				shaping.tick(0.05)
		var lowest := 0
		for i in shaping.segments.size():
			if shaping.segments[i] < shaping.segments[lowest]:
				lowest = i
		shaping.hit(lowest)
		shaping.tick(0.3)
		guard2 += 1
		if guard2 > 500:
			break
	quench = QuenchSession.new(DB.b("quench"))
	while quench.temp < 800.0:
		quench.tick(0.05)
	quench.quench()
	_finish.call_deferred()


# ================================================================ 프레임 갱신·효과

func _process(delta: float) -> void:
	match phase:
		"refine":
			if refine:
				refine.tick(delta)
				if refine.in_fire and refine.temp > float(DB.b("forge")["overheat_temp"]) and randf() < 0.5:
					_spawn_sparks(60, 52, 1, Art.c("snow"))
				_update_refine()
		"shape":
			if shaping:
				shaping.tick(delta)
				_update_shape()
		"quench":
			if quench:
				quench.tick(delta)
				_update_quench()
	for p in parts:
		p["life"] -= delta
		p["x"] += p["vx"] * delta
		p["y"] += p["vy"] * delta
		p["vy"] += p["g"] * delta
	parts = parts.filter(func(p): return p["life"] > 0.0)


func _spawn_sparks(x: float, y: float, n: int, col: Color) -> void:
	for i in n:
		parts.append({"x": x, "y": y, "vx": randf_range(-40, 40), "vy": randf_range(-45, -10),
			"life": randf_range(0.3, 0.7), "max": 0.7, "col": col, "g": 90.0, "s": 1})


func _spawn_steam(x: float, y: float, n: int) -> void:
	for i in n:
		parts.append({"x": x, "y": y, "vx": randf_range(-6, 6), "vy": randf_range(-26, -10),
			"life": randf_range(1.2, 2.4), "max": 2.4, "col": Color(0.92, 0.92, 0.95), "g": -2.0, "s": 3, "steam": true})


func _fx(v, t: float) -> void:
	# 화덕 불빛: 숯·풀무 상태를 반영
	var fire := 0.45
	if phase == "refine" and refine:
		fire = clampf((refine.fire_temp - 300.0) / 1000.0, 0.1, 1.2)
	var fl := 0.85 + 0.15 * sin(t * 11.0) * sin(t * 3.7)
	var m := FORGE_MOUTH
	v.px(m.position.x, m.position.y + 8, m.size.x, 8, Heat.color(500 + fire * 700).lerp(Color.BLACK, 0.2))
	for i in 10:
		var fx := m.position.x + 3 + i * 5.6
		var fh := (3.0 + fire * 9.0) * fl * (0.6 + 0.4 * sin(t * 7.0 + i * 1.3))
		v.px(fx, m.position.y + m.size.y - fh, 4, fh, Heat.color(800 + fire * 500))
	v.px(m.position.x - 6, m.position.y - 6, m.size.x + 12, m.size.y + 12, Color(1, 0.55, 0.2, 0.08 + 0.1 * fire * fl))
	# 굴뚝 연기
	for i in 5:
		var k := fmod(t * 0.35 + i * 0.2, 1.0)
		v.px(56 + sin(k * 6.0 + i) * 3, 2 - k * 6 + (1.0 - k) * 4, 6, 3, Color(0.6, 0.58, 0.62, 0.35 * (1.0 - k)))

	match phase:
		"select":
			for i in selected_uids.size():
				var it := GameState.find_item(selected_uids[i])
				var col := Art.c("iron") if it.is_empty() else Art.c("iron").lerp(Art.c("iron_d"), clampf(float(it["impurity"]) / 60.0, 0, 1))
				v.px(152 + i * 22, ANVIL_TOP - 5, 18, 5, col)
				v.px(152 + i * 22, ANVIL_TOP - 5, 18, 1, Art.c("iron_l"))
		"refine":
			if refine:
				_draw_bar(v, refine)
		"assign":
			v.px(150, ANVIL_TOP - 4, 22, 4, Art.c("iron_l"))
			v.px(176, ANVIL_TOP - 4, 22, 4, Art.c("iron"))
		"join":
			var k := 0.0
			if anim.get("kind", "") == "join":
				k = clampf((t - anim["t0"]) / anim["dur"], 0, 1)
			v.px(150, ANVIL_TOP - 6 + k * 2, 40, 2, Heat.color(1000))
			v.px(150, ANVIL_TOP - 4 + k * 1, 40, 2, Heat.color(950).darkened(0.2))
			v.px(150, ANVIL_TOP - 2, 40, 2, Heat.color(1000))
		"shape":
			if shaping:
				_draw_blade(v, shaping.temp, shaping.is_reheating(), t)
		"clay":
			var ck := clay_k
			if anim.get("kind", "") == "clay":
				ck = clampf((t - anim["t0"]) / anim["dur"], 0, 1)
			_draw_blade(v, 60.0, false, t, ck)
		"quench":
			if quench:
				_draw_quench_blade(v, t)
	# 망치
	if anim.get("kind", "") in ["hammer", "join"]:
		var a := clampf((t - anim["t0"]) / (anim["dur"] if anim["kind"] == "hammer" else 0.35), 0, 1)
		if anim["kind"] == "join":
			a = fmod((t - anim["t0"]) / 0.35, 1.0)
			if t - anim["t0"] > anim["dur"]:
				a = 1.0
		var lift := absf(sin(a * PI)) * 12.0
		var hx: float = anim.get("x", 170.0)
		if a < 1.0:
			v.px(hx - 4, ANVIL_TOP - 12 - lift, 9, 5, Art.c("iron_d"))
			v.px(hx - 4, ANVIL_TOP - 12 - lift, 9, 1, Art.c("iron_l"))
			v.px(hx + 4, ANVIL_TOP - 11 - lift, 14, 2, Art.c("wood"))
	# 입자
	for p in parts:
		var a2: float = clampf(p["life"] / p["max"], 0, 1)
		var c: Color = p["col"]
		c.a = a2 * (0.75 if p.has("steam") else 1.0)
		var s: int = p["s"]
		if p.has("steam"):
			s = int(2 + (1.0 - a2) * 6)
		v.px(p["x"], p["y"], s, s, c)


func _draw_bar(v, r) -> void:
	var col := Heat.color(r.temp)
	var x: float
	var y: float
	if r.in_fire:
		x = 46
		y = 52
	else:
		x = 154
		y = ANVIL_TOP - 4
	var w := 32.0
	v.px(x - 1, y - 1, w + 2, 6, Art.c("ink"))
	v.px(x, y, w, 4, col)
	v.px(x, y, w, 1, col.lightened(0.25))
	# 산화물 얼룩
	var n := int(r.scale / 6.0)
	for i in n:
		v.px(x + fmod(i * 7.3, w - 1), y + (i % 3), 1, 1, Art.c("ink"))
	# 집게
	if not r.in_fire:
		v.px(x + w, y + 1, 18, 1, Art.c("iron_d"))
	else:
		v.px(x + w, y + 1, 50, 1, Art.c("iron_d"))


## 성형 중 도신: 구간별 진행도에 따라 막대 → 칼 모양으로 변한다
func _draw_blade(v, temp: float, reheating: bool, t: float, clay: float = 0.0) -> void:
	var col := Heat.color(temp) if temp > 450.0 else Art.c("iron")
	var n: int = shaping.segments.size()
	var seg_w := BLADE_LEN / n
	var base_y := ANVIL_TOP
	var x0 := BLADE_X0
	if reheating:
		x0 = 40.0
		base_y = 60.0
	# 슴베
	v.px(x0 - 16, base_y - 3, 16, 2, Art.c("iron_d"))
	for i in n:
		var prog: float = clampf(shaping.segments[i] / 100.0, 0.0, 1.3)
		# 칼끝(0번)은 오른쪽 끝
		var sx := x0 + BLADE_LEN - (i + 1) * seg_w
		var h := int(round(lerpf(5.0, 4.0, minf(prog, 1.0))))
		var lift := int(round(minf(prog, 1.0) * (i * 0.35)))   # 휘어짐(소리)
		v.px(sx, base_y - h - lift, seg_w, h, col)
		v.px(sx, base_y - h - lift, seg_w, 1, col.lightened(0.2))
		if prog > 1.15:
			v.px(sx + 2, base_y - h - lift + 1, seg_w - 4, 1, Art.c("fire_r"))
		if i == 0 and prog >= 0.6:
			v.px(sx + seg_w, base_y - h - lift + 1, 3, h - 1, col)
		if clay > 0.0:
			var cw := seg_w * clampf(clay * n - (n - 1 - i), 0.0, 1.0)
			v.px(sx, base_y - h - lift, cw, 2, Art.c("stone_l"))
			if i % 2 == 0:
				v.px(sx + seg_w * 0.5, base_y - h - lift + 2, 1, 1, Art.c("stone_l") * Color(1, 1, 1, clay))


func _draw_quench_blade(v, t: float) -> void:
	var q = quench
	var col := Heat.color(q.temp) if q.temp > 450.0 else Art.c("iron")
	if q.done:
		var k := clampf((t - anim.get("t0", t)) / 0.6, 0, 1)
		var y := lerpf(48, 62, k)
		v.px(244, y, 50, 3, col)
		v.px(244, y, 50, 1, Art.c("stone_l"))
		v.px(240, 60, 56, 1, Art.c("water_l") if int(t * 12.0) % 2 == 0 else Art.c("snow"))
	elif q.in_fire:
		v.px(40, 54, 100, 3, col)
		v.px(40, 54, 100, 1, Art.c("stone_l"))
	else:
		v.px(150, ANVIL_TOP - 3, 100, 3, col)
		v.px(150, ANVIL_TOP - 3, 100, 1, Art.c("stone_l"))
