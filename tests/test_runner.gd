extends Node
## 규칙 검증 테스트. 실행: godot --headless --path . res://tests/test_runner.tscn
## GDD 9장 '실행해서 확인할 것' 항목을 로직 수준에서 확인한다.

const RefineSession = preload("res://scripts/core/refine_session.gd")
const ShapingSession = preload("res://scripts/core/shaping_session.gd")
const QuenchSession = preload("res://scripts/core/quench_session.gd")
const BladeResult = preload("res://scripts/core/blade_result.gd")

var fails: int = 0
var passes: int = 0


func _ready() -> void:
	_run.call_deferred()


func check(cond: bool, what: String) -> void:
	if cond:
		passes += 1
		print("  ok   ", what)
	else:
		fails += 1
		print("  FAIL ", what)


func resolve_any() -> void:
	var ev: Dictionary = GameState.travel["event"]
	var choices: Array = ev["choices"]
	for i in choices.size():
		if GameState.choice_status(choices[i])["ok"]:
			GameState.resolve_event(i)
			return


func _run() -> void:
	var gs := GameState
	print("== 지도와 출발")
	gs.new_game(42)
	check(gs.location == "village", "거점(공방 마을)에서 시작")
	check(not gs.can_depart("river")["ok"], "비인접 노드(강변 사철터)로 직접 출발 불가")
	check(not gs.depart("mountain"), "비인접 노드(철광 산지) depart 거부")
	check(gs.travel.is_empty() and gs.day == 1, "거부 시 시간·상태 변화 없음")
	check(gs.can_depart("inn")["ok"], "인접 노드(갈림길 주막) 출발 가능")

	print("== 하루 이동과 사건")
	var d0 := gs.day
	gs.depart("inn")
	check(gs.day == d0 + 1 and gs.travel["x"] == 1, "출발 시 첫 하루 이동 처리")
	check(gs.travel["phase"] == "event" and not gs.travel["event"].is_empty(), "하루 이동마다 사건 1회 발생")
	check(not gs.action_forward(), "사건 대응 전에는 다음 행동 불가")
	var d1 := gs.day
	resolve_any()
	check(gs.day == d1, "사건 대응은 하루를 소비하지 않음")
	check(gs.travel["phase"] == "arrived", "끝점 도달 시 도착 상태")
	check(not gs.action_forward() and not gs.action_camp(), "도착일에는 길 위 행동 대신 장소 행동")
	var d2 := gs.day
	gs.finish_travel()
	check(gs.location == "inn" and gs.day == d2 and gs.travel.is_empty(), "도착 처리 시 추가 사건·추가 일수 없음")
	check(gs.travel.is_empty(), "목적지 도착 전후로 다음 구간이 예약되지 않음")

	print("== 노숙·되돌아가기 (3일 구간)")
	gs.fatigue = 0
	gs.food = 10
	gs.depart("mountain")
	resolve_any()
	gs.fatigue = 6
	check(gs.travel["phase"] == "choose", "아무 일 없는 날에도 행동 선택 단계")
	var x_before: int = gs.travel["x"]
	var day_before := gs.day
	var food_before := gs.food
	# 선택 대기 중에는 아무 것도 진행되지 않는다 (프레임이 흘러도)
	await get_tree().create_timer(0.3).timeout
	check(gs.day == day_before and gs.travel["x"] == x_before, "선택 대기 중 시간·거리 자동 진행 없음")
	gs.action_camp()
	check(gs.travel["x"] == x_before, "노숙: 위치 유지")
	check(gs.day == day_before + 1, "노숙: 하루 소비")
	check(gs.food == food_before - int(DB.b("camp_food")), "노숙: 식량 소비")
	check(gs.fatigue <= 6 - int(DB.b("camp_fatigue_recover")) + 2, "노숙: 피로 회복 (야영 사건 보정 포함)")
	check(gs.travel["phase"] == "event", "노숙한 날에도 야영 사건 1회")
	resolve_any()
	gs.fatigue = 0
	gs.action_forward()
	resolve_any()
	check(gs.travel["x"] == 2, "진행하기: 목적지 방향 1 이동")
	gs.fatigue = 0
	var day_b := gs.day
	gs.action_back()
	check(gs.travel["x"] == 1 and gs.travel["dir"] == -1, "되돌아가기: 출발점 방향으로 실제 1일 이동 (순간 귀환 없음)")
	resolve_any()
	check(gs.is_returning() and gs.travel["phase"] == "choose", "귀환 중에도 같은 일일 선택 구조")
	gs.fatigue = 0
	gs.action_forward()
	resolve_any()
	check(gs.travel["x"] == 2 and gs.travel["dir"] == 1, "목적지로 다시 향하기")
	gs.fatigue = 0
	gs.action_back()
	resolve_any()
	gs.fatigue = 0
	gs.action_back()
	resolve_any()
	check(gs.travel["x"] == 0 and gs.travel["phase"] == "returned", "귀환은 이동한 거리만큼 일수 소요, 노드 경계(0)에서 멈춤")
	check(gs.day == day_b + 4, "되돌아가기 2일 + 재전진 1일 + 귀환 1일 = 4일")
	gs.finish_travel()
	check(gs.location == "inn", "출발지로 귀환")

	print("== 자원 고갈 (임시 실패 처리)")
	gs.food = 0
	gs.fatigue = 9
	gs.add_ore("satetsu", "테스트")
	gs.add_ore("satetsu", "테스트")
	gs.depart("village")
	var guard := 0
	while gs.travel["phase"] == "event" and guard < 5:
		resolve_any()
		guard += 1
	check(gs.travel["phase"] == "collapsed", "굶주림·피로 한계 → 탈진")
	var losses := gs.collapse_and_rescue()
	check(gs.location == DB.map["base"] and gs.travel.is_empty() and gs.food > 0, "탈진 후 거점 복귀, 플레이 계속 가능")
	check(not losses.is_empty(), "손실 내역 제공: " + ", ".join(losses))

	print("== 장소 활동과 재료")
	gs.new_game(7)
	gs.location = "river"
	var n_ore := gs.count_of("ore")
	gs.do_activity("gather_satetsu")
	check(gs.count_of("ore") == n_ore + 1, "사철 채집 → 원료 +1")
	var ore: Dictionary = gs.items_of("ore")[0]
	check(String(ore["source"]).contains("강변 사철터"), "원료에 출처 이름 기록")
	gs.do_activity("gather_satetsu")
	check(not gs.activity_status("gather_satetsu")["ok"], "방문당 채집 횟수 제한")
	gs.location = "village"
	var st := gs.smelt(ore["uid"])
	check(not st.is_empty() and String(st["source"]).contains("강변 사철터"), "제철 후 강괴에도 출처 유지")

	print("== 공방 결과: 재료·조작 차이가 결과에 드러남")
	var hi := {"name": "고탄소", "source": "t", "carbon": 0.78, "uniformity": 45, "impurity": 18}
	var lo := {"name": "저탄소", "source": "t", "carbon": 0.25, "uniformity": 35, "impurity": 40}
	var good := _make_blade(hi, lo, 4, 800.0, false)
	var swapped := _make_blade(lo, hi, 4, 800.0, false)
	var cold_q := _make_blade(hi, lo, 4, 700.0, false)
	var hot_q := _make_blade(hi, lo, 4, 920.0, true)
	var no_fold := _make_blade(hi, lo, 0, 800.0, false)
	print("    좋은 조합: ", good["grade"], " / ", good["hardening"], " / ", good["soundness"])
	print("    피철·심철 반대: ", swapped["grade"], " / ", swapped["hardening"], " / ", swapped["soundness"])
	print("    이른 담금질: ", cold_q["grade"], " / ", cold_q["hardening"])
	print("    과열 담금질+냉간타격: ", hot_q["grade"], " / ", hot_q["soundness"])
	print("    접쇠 없음: ", no_fold["grade"], " / ", no_fold["hardening"], " / ", no_fold["soundness"])
	check(good["hardening"] == "충분한 경화" and good["soundness"] == "정상", "적절한 재료·공정 → 충분한 경화·정상")
	check(swapped["hardening"] == "경화 부족", "피철에 저탄소 → 경화 부족")
	check(cold_q["hardening"] == "경화 부족", "낮은 온도 담금질 → 경화 부족")
	check(hot_q["soundness"] != "정상", "과열 담금질·냉간 타격 → 건전성 결함")
	check(no_fold["score"] < good["score"], "접쇠 생략 시 점수 하락")
	check(not swapped["bad_causes"].is_empty(), "결과에 원인 설명 포함")
	var again := _make_blade(hi, lo, 4, 800.0, false)
	check(again["score"] == good["score"], "같은 입력 → 같은 결과 (무작위 판정 아님)")

	print("== 침탄·과열")
	var r = RefineSession.new(hi, DB.b("forge"))
	var c0: float = r.carbon
	r.add_fuel()
	check(is_equal_approx(r.carbon, c0), "숯 보충 즉시 탄소가 오르지 않음")
	for i in 400:
		r.tick(0.05)
	check(r.carbon > c0, "숯과 적정 온도를 유지하면 서서히 침탄")

	print("== 연결된 흐름: 지도 → 이동 → 재료 확보 → 귀환 → 공방 → 결과 → 재시도")
	gs.new_game(11)
	gs.do_activity("resupply")
	check(gs.food == gs.food_max(), "출발 전 마을에서 보급")
	check(travel_to("forest"), "공방 마을 → 숯가마 숲 도착")
	gs.do_activity("charcoal")
	check(travel_to("village"), "숯을 들고 공방 마을로 귀환")
	check(travel_to("inn"), "공방 마을 → 갈림길 주막")
	gs.do_activity("rest")
	check(travel_to("river"), "주막 → 강변 사철터 (2일 구간)")
	gs.do_activity("gather_satetsu")
	check(travel_to("inn"), "강변 사철터 → 주막 귀환")
	gs.do_activity("resupply_inn")
	gs.do_activity("rest")
	check(travel_to("village"), "공방 마을로 귀환")
	check(gs.count_of("ore") >= 1 and gs.count_of("charcoal") >= 1, "확보한 원료·숯이 공방에 전달됨")
	var ore2: Dictionary = gs.items_of("ore")[0]
	var steel2 := gs.smelt(ore2["uid"])
	var scrap: Dictionary = gs.items_of("steel").filter(func(it): return it["type"] == "scrap")[0]
	gs.remove_item(steel2["uid"])
	gs.remove_item(scrap["uid"])
	var res := _make_blade(steel2, scrap, 3, 800.0, false)
	gs.record_result(res)
	check(gs.results.size() == 1 and String(res["edge"]["source"]).contains("강변 사철터"), "결과에 탐험에서 얻은 재료 출처 표시")
	check(gs.count_of("steel") == 0, "제작에 쓴 강괴는 소모됨")
	gs.add_scrap_steel()
	check(gs.count_of("steel") >= 1, "재료가 없어도 창고 고철로 재시도 가능 (막히지 않음)")
	print("    흐름 종료: %d일차, 결과 %s" % [gs.day, res["grade"]])

	print("\n결과: %d 통과, %d 실패" % [passes, fails])
	get_tree().quit(1 if fails > 0 else 0)


## 인접 노드로 이동해 도착까지 진행한다. 지치면 노숙한다.
func travel_to(dest: String) -> bool:
	if not GameState.depart(dest):
		print("    (출발 불가: %s → %s)" % [GameState.location, dest])
		return false
	var guard := 0
	while guard < 50:
		guard += 1
		var ph: String = GameState.travel["phase"]
		match ph:
			"event":
				resolve_any()
			"choose":
				if GameState.fatigue >= 7:
					GameState.action_camp()
				else:
					GameState.action_forward()
			"arrived":
				GameState.finish_travel()
				return GameState.location == dest
			_:
				print("    (이동 실패: %s, 식량 %d, 피로 %d)" % [ph, GameState.food, GameState.fatigue])
				return false
	return false


func _make_blade(e: Dictionary, c: Dictionary, folds: int, quench_temp: float, cold_hits: bool) -> Dictionary:
	var steels: Array = []
	for s in [e, c]:
		var r = RefineSession.new(s, DB.b("forge"))
		r.temp = 1050.0
		r.in_fire = false
		for i in folds:
			r.temp = 1050.0
			r.fold()
		steels.append(r.result_steel())
	var sh = ShapingSession.new(DB.b("shaping"))
	for i in sh.segments.size():
		sh.segments[i] = 100.0
	if cold_hits:
		sh.cold_hits = 3
	var q = QuenchSession.new(DB.b("quench"))
	q.temp = quench_temp
	q.max_temp = quench_temp
	q.quench()
	return BladeResult.compute(steels[0], steels[1], sh, q, DB.b("quench"))
