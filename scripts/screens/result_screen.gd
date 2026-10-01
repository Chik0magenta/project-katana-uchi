extends Control
## 결과: 완성 도신의 그림, 경화·건전성·형상, 원인 피드백, 재료 출처, 이전 결과와 비교, 재시도.

const UI = preload("res://scripts/ui/ui_theme.gd")
const PixelView = preload("res://scripts/ui/pixel_view.gd")
const Hud = preload("res://scripts/ui/hud.gd")

var main
var res: Dictionary
var pv


func setup(m, params: Dictionary) -> void:
	main = m
	res = params.get("result", {})
	if res.is_empty() and not GameState.results.is_empty():
		res = GameState.results[-1]
	pv = PixelView.new()
	pv.pscale = 4
	pv.custom_minimum_size = Vector2(1280, 176)
	pv.size = Vector2(1280, 176)
	pv.position = Vector2(0, 40)
	pv.fx_drawer = _fx
	add_child(pv)

	var grade := UI.label("%s  —  %s" % [res.get("grade", "?"), _summary()], 26, _grade_col(), true)
	grade.position = Vector2(24, 220)
	grade.size = Vector2(1232, 40)
	add_child(grade)

	# 세 결과 축 카드
	var cards := HBoxContainer.new()
	cards.position = Vector2(8, 264)
	cards.size = Vector2(1264, 96)
	cards.add_theme_constant_override("separation", 8)
	add_child(cards)
	cards.add_child(_card("경화", res["hardening"], res["hardening"] == "충분한 경화"))
	cards.add_child(_card("건전성", res["soundness"], res["soundness"] == "정상"))
	var shape_txt: String = res["shape"]
	if not res["shape_defects"].is_empty():
		shape_txt += "\n" + ", ".join(res["shape_defects"])
	cards.add_child(_card("형상 (품질 %d)" % int(res["shape_quality"]), shape_txt, res["shape"] == "고른 형상"))

	# 원인 / 재료·비교
	var lp := UI.panel()
	lp.position = Vector2(8, 368)
	lp.custom_minimum_size = Vector2(700, 280)
	lp.size = Vector2(700, 280)
	add_child(lp)
	var lv := VBoxContainer.new()
	lv.add_theme_constant_override("separation", 4)
	lp.add_child(lv)
	lv.add_child(UI.label("왜 이런 결과가 나왔나", 19, UI.COL_ACCENT, true))
	var lines: Array = []
	for c in res["bad_causes"]:
		lines.append("[color=#f07864]▼[/color] " + c)
	for c in res["good_causes"]:
		lines.append("[color=#96d282]▲[/color] " + c)
	if lines.is_empty():
		lines.append("특별한 문제 없이 완성되었습니다.")
	lv.add_child(UI.rich("\n".join(lines), 15))

	var rp := UI.panel()
	rp.position = Vector2(716, 368)
	rp.custom_minimum_size = Vector2(556, 280)
	rp.size = Vector2(556, 280)
	add_child(rp)
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 4)
	rp.add_child(rv)
	rv.add_child(UI.label("사용한 재료", 19, UI.COL_ACCENT, true))
	rv.add_child(UI.rich("피철: [b]%s[/b] — %s\n  %s\n심철: [b]%s[/b] — %s\n  %s\n담금질: %s" % [
		res["edge"]["name"], res["edge"]["source"], _stat(res["edge"]),
		res["core"]["name"], res["core"]["source"], _stat(res["core"]), res["quench_text"]], 14))
	rv.add_child(UI.label("지난 결과와 비교", 17, UI.COL_ACCENT, true))
	var hist: Array = []
	var n: int = GameState.results.size()
	for i in range(maxi(0, n - 4), n):
		var r: Dictionary = GameState.results[i]
		hist.append("%d번째 (%d일차): %s · %s · %s · %s%s" % [i + 1, r.get("day", 0), r["grade"], r["hardening"], r["soundness"], r["shape"],
			"  ← 이번" if i == n - 1 else ""])
	rv.add_child(UI.rich("\n".join(hist) if not hist.is_empty() else "첫 작품입니다.", 14))

	var bh := HBoxContainer.new()
	bh.position = Vector2(8, 656)
	bh.size = Vector2(1264, 56)
	bh.add_theme_constant_override("separation", 10)
	add_child(bh)
	var steel_n := GameState.count_of("steel") + mini(GameState.count_of("ore"), GameState.count_of("charcoal"))
	var b1 := UI.button("공방에서 다시 만들기 (남은 강괴·원료 %d)" % steel_n, _retry, 52)
	b1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bh.add_child(b1)
	var b2 := UI.button("지도로 (다음 탐험)", _to_map, 52)
	b2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bh.add_child(b2)
	var b3 := UI.button("타이틀로", func(): main.go("title"), 52)
	b3.custom_minimum_size = Vector2(160, 52)
	bh.add_child(b3)
	add_child(Hud.new())


func _summary() -> String:
	return "%s, %s, %s" % [res["hardening"], res["soundness"], res["shape"]]


func _grade_col() -> Color:
	match res.get("grade", ""):
		"명품", "양품": return UI.COL_GOOD
		"실패작", "불량품": return UI.COL_BAD
	return UI.COL_ACCENT


func _stat(s: Dictionary) -> String:
	var t := "탄소 %s · 균일도 %s · 불순도 %s · 접쇠 %d회" % [DB.level_text("carbon", s["carbon"]),
		DB.level_text("uniformity", s["uniformity"]), DB.level_text("impurity", s["impurity"]), int(s.get("folds", 0))]
	if GameState.dev_numbers:
		t += " [color=#9c7b45](C %.2f / U %d / I %d)[/color]" % [s["carbon"], int(s["uniformity"]), int(s["impurity"])]
	return t


func _card(title: String, value: String, good: bool) -> PanelContainer:
	var p := UI.panel()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.custom_minimum_size = Vector2(0, 96)
	var v := VBoxContainer.new()
	p.add_child(v)
	v.add_child(UI.label(title, 15, UI.COL_DIM))
	v.add_child(UI.label(value, 19, UI.COL_GOOD if good else UI.COL_BAD, true))
	return p


func _retry() -> void:
	GameState.location = DB.map["base"]
	main.go("workshop")


func _to_map() -> void:
	GameState.location = DB.map["base"]
	main.go("map")


## 완성 도신 그림: 경화되면 하몬, 휨이면 휜 모양, 균열·파단은 금과 틈으로 보여 준다
func _fx(v, t: float) -> void:
	v.px(0, 0, 320, 44, Color8(40, 30, 28))
	for i in 20:
		v.px(i * 16, 0, 1, 44, Color8(30, 22, 20))
	v.px(0, 34, 320, 10, Color8(70, 48, 32))
	v.px(30, 30, 260, 2, Color8(120, 30, 30))          # 칼 받침 천
	var sound: String = res.get("soundness", "정상")
	var hard: String = res.get("hardening", "")
	var x0 := 60.0
	var length := 210.0
	var y0 := 22.0
	var curve := 3.0
	if sound == "휨":
		curve = 10.0
	var steel := Art.c("iron_l")
	var spine := Art.c("iron")
	# 손잡이(나카고)와 칼날받이
	v.px(x0 - 34, y0 + 1, 34, 3, Art.c("soil_d"))
	v.px(x0 - 30, y0 + 2, 2, 1, Art.c("stone_l"))
	v.px(x0 - 3, y0 - 2, 3, 9, Art.c("iron_d"))
	var gap_x := x0 + length * 0.55
	for i in int(length):
		var k := i / length
		var x := x0 + i
		if sound == "파단" and absf(x - gap_x) < 3:
			continue
		var bend := curve * k * k
		var h := 5.0 if k < 0.9 else roundf(lerpf(5.0, 1.0, (k - 0.9) / 0.1))
		var top := y0 - roundf(bend) + (5.0 - h)
		v.px(x, top, 1, 1, spine)
		v.px(x, top + 1, 1, h - 1, steel)
		# 하몬(경화선)
		if hard in ["충분한 경화", "다소 약한 경화", "국소 불균일"] and h >= 3:
			var wave := 0.0
			if hard == "국소 불균일":
				wave = 1.0 if int(i / 9) % 3 == 0 else 0.0
			else:
				wave = 1.0 if int(i / 6) % 2 == 0 else 0.0
			v.px(x, top + h - 1 - wave, 1, 1, Art.c("snow"))
	if sound in ["균열", "미세 균열"]:
		var cx := x0 + length * 0.4
		for j in 4:
			v.px(cx + j, y0 + 1 + j % 2 - curve * 0.16, 1, 1, Art.c("ink"))
		if sound == "균열":
			for j in 5:
				v.px(cx + 40 + j, y0 + 1 + (j % 3) - curve * 0.4, 1, 1, Art.c("ink"))
	# 빛 반사
	var sx := fmod(t * 60.0, 400.0) - 40.0
	if sx > x0 and sx < x0 + length:
		var k2 := (sx - x0) / length
		v.px(sx, y0 + 1 - curve * k2 * k2, 2, 2, Color(1, 1, 1, 0.7))
