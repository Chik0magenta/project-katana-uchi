extends RefCounted
## 결과 계산. 피철·심철의 세 변수, 성형, 담금질 시점의 누적 결과이며 무작위 판정이 없다.
const Heat = preload("res://scripts/core/heat.gd")

## 원인 설명은 실제 계산에 들어간 항목에서 만든다.


static func compute(edge: Dictionary, core: Dictionary, shaping, quench, qcfg: Dictionary) -> Dictionary:
	var ce := float(edge["carbon"])
	var ue := float(edge["uniformity"])
	var ie := float(edge["impurity"])
	var cc := float(core["carbon"])
	var ic := float(core["impurity"])
	var tq: float = quench.quench_temp
	var tmax: float = quench.max_temp
	var ideal_min := float(qcfg["ideal_min"])
	var ideal_max := float(qcfg["ideal_max"])
	var too_cold := float(qcfg["too_cold"])

	var causes: Array = []     # {text, weight, good}

	# ---------------- 경화
	var hardening := "충분한 경화"
	var hard_score := 100.0
	if tq < too_cold:
		hardening = "경화 부족"
		hard_score = 25.0
		causes.append({"text": "담금질 온도가 낮았습니다 (%s에서 담금질). 날이 충분히 단단해지지 않았습니다." % Heat.text(tq), "weight": 30.0, "good": false})
	elif ce < 0.45:
		hardening = "경화 부족"
		hard_score = 30.0
		causes.append({"text": "피철 탄소가 낮아(%s) 담금질해도 날이 단단해지지 않았습니다." % DB.level_text("carbon", ce), "weight": 30.0, "good": false})
	elif ue < 55.0:
		hardening = "국소 불균일"
		hard_score = 55.0
		causes.append({"text": "피철 균일도가 낮아(%s) 날의 단단함이 곳곳에서 달랐습니다. 접쇠가 부족했습니다." % DB.level_text("uniformity", ue), "weight": 20.0, "good": false})
	elif tq < ideal_min or ce < 0.55:
		hardening = "다소 약한 경화"
		hard_score = 75.0
		if tq < ideal_min:
			causes.append({"text": "담금질이 조금 일렀습니다 (%s). 밝은 진홍빛까지 기다리면 더 단단해집니다." % Heat.text(tq), "weight": 10.0, "good": false})
		else:
			causes.append({"text": "피철 탄소가 다소 낮아 경화가 약했습니다.", "weight": 10.0, "good": false})
	else:
		causes.append({"text": "피철 탄소(%s)와 담금질 온도(%s)가 맞아 날이 잘 섰습니다." % [DB.level_text("carbon", ce), Heat.text(tq)], "weight": 0.0, "good": true})

	# ---------------- 건전성 (위험 점수 누적)
	var risk: Array = []   # [점수, 종류(warp/crack), 문구]
	_r(risk, maxf(0.0, tq - ideal_max) * 0.25, "crack", "담금질 온도가 너무 높았습니다 (%s)." % Heat.text(tq))
	_r(risk, maxf(0.0, tmax - 900.0) * 0.1, "crack", "담금질 가열 중 과열되어 조직이 거칠어졌습니다.")
	_r(risk, maxf(0.0, ce - 0.85) * 100.0, "crack", "피철 탄소가 너무 높아(%s) 날이 단단하지만 깨지기 쉬웠습니다." % DB.level_text("carbon", ce))
	_r(risk, ie * 0.4, "crack", "피철 불순물(%s)이 균열의 씨앗이 되었습니다." % DB.level_text("impurity", ie))
	_r(risk, ic * 0.15, "crack", "심철 불순물(%s)이 속을 약하게 했습니다." % DB.level_text("impurity", ic))
	_r(risk, shaping.cold_hits * 8.0, "crack", "식은 상태에서 %d번 두드려 안쪽에 금이 갔습니다." % shaping.cold_hits)
	_r(risk, maxf(0.0, cc - 0.5) * 80.0, "warp", "심철 탄소가 높아(%s) 속심이 충격을 받아 주지 못했습니다." % DB.level_text("carbon", cc))
	_r(risk, maxf(0.0, shaping.unevenness() - 10.0) * 0.8, "warp", "성형이 고르지 않아 담금질 때 도신이 뒤틀렸습니다.")
	_r(risk, maxf(0.0, 60.0 - ue) * 0.3, "warp", "피철 균일도가 낮아 식는 속도가 곳곳에서 달랐습니다.")
	var total := 0.0
	var warp_sum := 0.0
	var crack_sum := 0.0
	for r in risk:
		total += r[0]
		if r[1] == "warp":
			warp_sum += r[0]
		else:
			crack_sum += r[0]
	var soundness := "정상"
	if total >= 55.0:
		soundness = "파단"
	elif total >= 35.0:
		soundness = "균열"
	elif total >= 20.0:
		soundness = "휨" if warp_sum >= crack_sum else "미세 균열"
	risk.sort_custom(func(a, b): return a[0] > b[0])
	for r in risk:
		if r[0] >= 5.0:
			causes.append({"text": r[2], "weight": r[0], "good": false})
	if cc <= 0.4:
		causes.append({"text": "심철 탄소가 낮아 속심이 무르고 질겨 충격을 흡수했습니다.", "weight": 0.0, "good": true})
	if ie < 15.0:
		causes.append({"text": "피철이 깨끗했습니다 (불순도 %s)." % DB.level_text("impurity", ie), "weight": 0.0, "good": true})

	# ---------------- 형상
	var q: float = shaping.quality()
	var shape_defects: Array = []
	if shaping.unfinished_count() > 0:
		shape_defects.append("덜 두드린 구간 %d곳" % shaping.unfinished_count())
	if shaping.over_hits > 0:
		shape_defects.append("과타격으로 얇아진 곳 (%d회)" % shaping.over_hits)
	if shaping.cold_hits > 0:
		shape_defects.append("냉간 타격 흔적 (%d회)" % shaping.cold_hits)
	if shaping.unevenness() > 12.0:
		shape_defects.append("구간별 두께가 고르지 않음")
	var shape := "고른 형상"
	if q < 75.0:
		shape = "형상 불량"
	elif q < 90.0 or not shape_defects.is_empty():
		shape = "대체로 고름"

	# ---------------- 종합
	var sound_score := clampf(100.0 - total * 1.5, 0.0, 100.0)
	var score := hard_score * 0.4 + sound_score * 0.4 + q * 0.2
	var grade := "미흡"
	if soundness == "파단":
		grade = "실패작"
	elif soundness == "균열":
		grade = "불량품"
	elif hardening == "경화 부족":
		grade = "미흡"
	elif score >= 85.0:
		grade = "명품"
	elif score >= 70.0:
		grade = "양품"
	elif score >= 55.0:
		grade = "보통"

	var bad := causes.filter(func(c): return not c["good"])
	bad.sort_custom(func(a, b): return a["weight"] > b["weight"])
	var good := causes.filter(func(c): return c["good"])

	return {
		"grade": grade,
		"score": roundf(score),
		"hardening": hardening,
		"soundness": soundness,
		"shape": shape,
		"shape_quality": roundf(q),
		"shape_defects": shape_defects,
		"risk_total": snappedf(total, 0.1),
		"bad_causes": bad.slice(0, 4).map(func(c): return c["text"]),
		"good_causes": good.map(func(c): return c["text"]),
		"edge": edge,
		"core": core,
		"quench_temp": roundf(tq),
		"max_temp": roundf(tmax),
		"quench_text": Heat.text(tq),
		"cold_hits": shaping.cold_hits,
		"over_hits": shaping.over_hits,
	}


static func _r(arr: Array, v: float, kind: String, text: String) -> void:
	if v > 0.0:
		arr.append([v, kind, text])
