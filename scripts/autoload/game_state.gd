extends Node
## 진행 중인 게임의 영구 상태(일차·자원·인벤토리·위치)와 탐험 규칙.
## 공방 공정의 임시 상태는 scripts/core/forge.gd 세션 객체가 따로 가진다.

signal state_changed

var rng := RandomNumberGenerator.new()

var day: int = 1
var food: int = 6
var fatigue: int = 0
var location: String = "village"
var inventory: Array = []          # 아이템 딕셔너리 배열
var companions: Array = []         # 예: ["benkei"]
var flags: Dictionary = {}         # 고유 이벤트 완료 기록 등
var visit_uses: Dictionary = {}    # 이번 방문에서 활동별 사용 횟수
var results: Array = []            # 완성 도신 기록 (최근이 뒤)
var next_uid: int = 1
var dev_numbers: bool = false      # 개발용: 실제 수치 표시

## 이동 중 상태. 비어 있으면 장소에 머무는 중.
## {from, to, days, terrain, x, dir, phase, event, result_text, changes, log}
## phase: "event"(사건 대응 대기) / "choose"(행동 선택 대기) / "arrived" / "returned" / "collapsed"
var travel: Dictionary = {}


func _ready() -> void:
	rng.randomize()
	new_game()


func new_game(seed_value: int = -1) -> void:
	if seed_value >= 0:
		rng.seed = seed_value
	day = int(DB.b("start_day"))
	food = int(DB.b("food_start"))
	fatigue = 0
	location = DB.map["start"]
	inventory = []
	companions = []
	flags = {}
	visit_uses = {}
	results = []
	travel = {}
	next_uid = 1
	for i in int(DB.b("start_charcoal")):
		add_charcoal("normal", "공방 마을 창고")
	for i in int(DB.b("start_scrap_steel")):
		add_scrap_steel()
	state_changed.emit()


# ------------------------------------------------------------------ 인벤토리

func _uid() -> int:
	next_uid += 1
	return next_uid


func items_of(kind: String) -> Array:
	return inventory.filter(func(it): return it["kind"] == kind)


func count_of(kind: String) -> int:
	return items_of(kind).size()


func find_item(uid: int) -> Dictionary:
	for it in inventory:
		if it["uid"] == uid:
			return it
	return {}


func remove_item(uid: int) -> void:
	for i in inventory.size():
		if inventory[i]["uid"] == uid:
			inventory.remove_at(i)
			return


func add_charcoal(type_id: String, source: String) -> Dictionary:
	var c: Dictionary = DB.materials["charcoal"][type_id]
	var it := {"uid": _uid(), "kind": "charcoal", "type": type_id, "name": c["name"],
		"source": source, "day": day}
	inventory.append(it)
	return it


func add_ore(type_id: String, source: String, extra_impurity: float = 0.0) -> Dictionary:
	var o: Dictionary = DB.materials["ores"][type_id]
	var it := {"uid": _uid(), "kind": "ore", "type": type_id, "name": o["name"],
		"source": source, "day": day,
		"carbon": snappedf(rng.randf_range(o["carbon"][0], o["carbon"][1]), 0.01),
		"uniformity": roundf(rng.randf_range(o["uniformity"][0], o["uniformity"][1])),
		"impurity": roundf(clampf(rng.randf_range(o["impurity"][0], o["impurity"][1]) + extra_impurity, 0, 100))}
	inventory.append(it)
	return it


func add_scrap_steel() -> Dictionary:
	var s: Dictionary = DB.materials["scrap"]
	var it := {"uid": _uid(), "kind": "steel", "type": "scrap", "name": s["name"],
		"source": "공방 마을 창고", "day": day,
		"carbon": snappedf(rng.randf_range(s["carbon"][0], s["carbon"][1]), 0.01),
		"uniformity": roundf(rng.randf_range(s["uniformity"][0], s["uniformity"][1])),
		"impurity": roundf(rng.randf_range(s["impurity"][0], s["impurity"][1]))}
	inventory.append(it)
	return it


## 제철: 원료 1 + 숯 1 → 강괴 조각. 좋은 숯이 있으면 먼저 쓴다.
func smelt(ore_uid: int) -> Dictionary:
	var ore := find_item(ore_uid)
	if ore.is_empty() or ore["kind"] != "ore":
		return {}
	var coals := items_of("charcoal")
	if coals.is_empty():
		return {}
	coals.sort_custom(func(a, b2): return a["type"] == "good" and b2["type"] != "good")
	var coal: Dictionary = coals[0]
	var cdef: Dictionary = DB.materials["charcoal"][coal["type"]]
	var odef: Dictionary = DB.materials["ores"][ore["type"]]
	var steel := {"uid": _uid(), "kind": "steel", "type": ore["type"], "name": odef["steel_name"],
		"source": "%s · %d일차 확보" % [ore["source"], ore["day"]], "day": day,
		"carbon": snappedf(ore["carbon"] + float(cdef["carbon_bonus"]), 0.01),
		"uniformity": ore["uniformity"],
		"impurity": clampf(ore["impurity"] + float(cdef["impurity_bonus"]), 0, 100),
		"charcoal": cdef["name"]}
	remove_item(ore_uid)
	remove_item(coal["uid"])
	inventory.append(steel)
	state_changed.emit()
	return steel


func inventory_summary() -> String:
	return "숯 %d · 원료 %d · 강괴 %d" % [count_of("charcoal"), count_of("ore"), count_of("steel")]


# ------------------------------------------------------------------ 자원

func food_max() -> int:
	return int(DB.b("food_max"))


func fatigue_max() -> int:
	return int(DB.b("fatigue_max"))


func is_tired() -> bool:
	return fatigue >= int(DB.b("tired_threshold"))


## 식량 소비. 모자라면 굶주림으로 피로가 오른다. 변화 문구를 changes에 덧붙인다.
func _eat(amount: int, changes: Array) -> void:
	if amount <= 0:
		return
	if food >= amount:
		food -= amount
		changes.append("식량 -%d" % amount)
	else:
		var starve := int(DB.b("starving_fatigue"))
		food = 0
		fatigue = mini(fatigue + starve, fatigue_max())
		changes.append("식량 부족! 굶주림으로 피로 +%d" % starve)


func _add_fatigue(amount: int, changes: Array) -> void:
	if amount == 0:
		return
	var before := fatigue
	fatigue = clampi(fatigue + amount, 0, fatigue_max())
	var d := fatigue - before
	if d != 0:
		changes.append("피로 %+d" % d)


# ------------------------------------------------------------------ 탐험: 출발

## 현재 위치에서 dest로 직접 출발할 수 있는가. 인접 노드만 허용한다(경로 예약 없음).
func can_depart(dest: String) -> Dictionary:
	if not travel.is_empty():
		return {"ok": false, "reason": "이미 이동 중입니다."}
	if dest == location:
		return {"ok": false, "reason": "지금 있는 곳입니다."}
	if not DB.map["nodes"].has(dest):
		return {"ok": false, "reason": "알 수 없는 장소입니다."}
	if DB.edge(location, dest).is_empty():
		return {"ok": false, "reason": "직접 연결된 장소만 목적지로 고를 수 있습니다. 한 구간씩 이동하세요."}
	return {"ok": true, "reason": ""}


## 출발: 구간을 설정하고 첫날 이동을 바로 처리한다.
func depart(dest: String) -> bool:
	if not can_depart(dest)["ok"]:
		return false
	var e := DB.edge(location, dest)
	travel = {"from": location, "to": dest, "days": e["days"], "terrain": e["terrain"],
		"x": 0, "dir": 1, "phase": "", "event": {}, "result_text": "", "changes": [],
		"log": [], "today": "", "fx": ""}
	visit_uses = {}
	_travel_log("%d일차: %s → %s 출발 (%d일 거리)" % [day, DB.node_name(location), DB.node_name(dest), e["days"]])
	_day_move(1)
	return true


func days_to_dest() -> int:
	return int(travel["days"]) - int(travel["x"])


func days_to_origin() -> int:
	return int(travel["x"])


func is_returning() -> bool:
	return not travel.is_empty() and int(travel["dir"]) < 0


# ------------------------------------------------------------------ 탐험: 하루 단위 행동

## 진행하기 / 목적지로 다시 향하기
func action_forward() -> bool:
	if not _can_act():
		return false
	_day_move(1)
	return true


## 되돌아가기 / 귀환 계속: 출발점 방향으로 실제 하루를 이동한다(순간 귀환 없음).
func action_back() -> bool:
	if not _can_act():
		return false
	_day_move(-1)
	return true


## 노숙하기: 이동 없이 하루를 소비하고 피로를 회복한다.
func action_camp() -> bool:
	if not _can_act():
		return false
	day += 1
	var changes: Array = []
	_eat(int(DB.b("camp_food")), changes)
	_add_fatigue(-int(DB.b("camp_fatigue_recover")), changes)
	travel["today"] = "camp"
	_travel_log("%d일차: 길 위에서 노숙 (위치 그대로)" % day)
	_start_event("camp", changes)
	return true


func _can_act() -> bool:
	return not travel.is_empty() and travel["phase"] == "choose"


func _day_move(dir: int) -> void:
	travel["dir"] = dir
	day += 1
	travel["x"] = clampi(int(travel["x"]) + dir, 0, int(travel["days"]))
	var changes: Array = []
	_eat(int(DB.b("move_food")), changes)
	_add_fatigue(int(DB.b("move_fatigue")), changes)
	travel["today"] = "move"
	var where := "목적지 방향" if dir > 0 else "출발지 방향"
	_travel_log("%d일차: %s으로 하루 이동 (위치 %d/%d)" % [day, where, travel["x"], travel["days"]])
	_start_event("move", changes)


func _start_event(context: String, changes: Array) -> void:
	travel["event"] = pick_event(context, travel["terrain"])
	travel["changes"] = changes
	travel["result_text"] = ""
	travel["fx"] = travel["event"].get("scene_fx", "")
	travel["phase"] = "event"
	if travel["event"].get("unique", false):
		flags["event_" + String(travel["event"]["id"])] = true
	state_changed.emit()


func pick_event(context: String, terrain: String) -> Dictionary:
	var cands: Array = []
	var total := 0.0
	for ev in DB.events:
		if ev.get("context", "move") != context:
			continue
		if ev.has("terrains") and not (terrain in ev["terrains"]):
			continue
		if ev.get("unique", false) and flags.has("event_" + String(ev["id"])):
			continue
		cands.append(ev)
		total += float(ev.get("weight", 1))
	if cands.is_empty():
		return {}
	var r := rng.randf() * total
	for ev in cands:
		r -= float(ev.get("weight", 1))
		if r <= 0.0:
			return ev
	return cands[-1]


func event_text(ev: Dictionary) -> String:
	if ev.has("text_by_terrain") and not travel.is_empty():
		return ev["text_by_terrain"].get(travel["terrain"], "")
	return ev.get("text", "")


## 선택지 사용 가능 여부와 이유
func choice_status(choice: Dictionary) -> Dictionary:
	var req: Dictionary = choice.get("requires", {})
	if req.has("food") and food < int(req["food"]):
		return {"ok": false, "reason": "식량 %d 이상 필요" % int(req["food"])}
	if req.has("charcoal") and count_of("charcoal") < int(req["charcoal"]):
		return {"ok": false, "reason": "숯 %d 이상 필요" % int(req["charcoal"])}
	if req.has("companion") and not (req["companion"] in companions):
		return {"ok": false, "reason": "동행자 필요"}
	return {"ok": true, "reason": ""}


## 사건 대응. 사건 대응 자체는 별도의 하루를 소비하지 않는다.
func resolve_event(index: int) -> bool:
	if travel.is_empty() or travel["phase"] != "event":
		return false
	var ev: Dictionary = travel["event"]
	var choices: Array = ev.get("choices", [])
	if index < 0 or index >= choices.size():
		return false
	var ch: Dictionary = choices[index]
	if not choice_status(ch)["ok"]:
		return false
	var changes: Array = travel["changes"]
	var text := apply_effects(ch.get("effects", {}), changes, DB.node_name(travel["to"]))
	travel["result_text"] = text if text != "" else String(ch.get("result", ""))
	_travel_log("  └ %s: %s" % [ev.get("title", ""), ch.get("label", "")])
	if fatigue >= fatigue_max():
		travel["phase"] = "collapsed"
	elif int(travel["x"]) >= int(travel["days"]):
		travel["phase"] = "arrived"
	elif int(travel["x"]) <= 0:
		travel["phase"] = "returned"
	else:
		travel["phase"] = "choose"
	state_changed.emit()
	return true


## 효과 적용. info 효과는 결과 문구를 돌려준다.
func apply_effects(fx: Dictionary, changes: Array, source_name: String) -> String:
	var text := ""
	if fx.has("food"):
		var before := food
		food = clampi(food + int(fx["food"]), 0, food_max())
		if food != before:
			changes.append("식량 %+d" % (food - before))
	if fx.has("fatigue"):
		_add_fatigue(int(fx["fatigue"]), changes)
	for add in fx.get("add", []):
		for i in int(add.get("count", 1)):
			if add["kind"] == "charcoal":
				add_charcoal(add["type"], "길 위 (%s 가는 길)" % source_name)
			elif add["kind"] == "ore":
				add_ore(add["type"], "길 위 (%s 가는 길)" % source_name,
					float(DB.b("tired_gather_impurity")) if is_tired() else 0.0)
		var nm: String = DB.materials["charcoal"][add["type"]]["name"] if add["kind"] == "charcoal" \
			else DB.materials["ores"][add["type"]]["name"]
		changes.append("%s +%d" % [nm, int(add.get("count", 1))])
	if fx.has("lose_charcoal"):
		for i in int(fx["lose_charcoal"]):
			var cs := items_of("charcoal")
			if cs.is_empty():
				break
			remove_item(cs[0]["uid"])
		changes.append("숯 -%d" % int(fx["lose_charcoal"]))
	if fx.has("companion") and not (fx["companion"] in companions):
		companions.append(fx["companion"])
		changes.append("동행자 합류: 벤케이")
	if fx.get("info", false):
		text = "행인이 말했다. " + random_info()
	return text


func random_info() -> String:
	if DB.infos.is_empty():
		return ""
	return DB.infos[rng.randi_range(0, DB.infos.size() - 1)]


func _travel_log(line: String) -> void:
	travel["log"].append(line)


## 도착/귀환 처리: 장소에 들어간다. 도착일에는 장소 사건을 따로 굴리지 않는다.
func finish_travel() -> String:
	if travel.is_empty():
		return location
	var phase: String = travel["phase"]
	if phase == "arrived":
		location = travel["to"]
	elif phase == "returned":
		location = travel["from"]
	else:
		return ""
	travel = {}
	visit_uses = {}
	state_changed.emit()
	return location


## 탈진(임시 실패 처리): 손실 내역을 돌려주고 거점으로 복귀시킨다.
func collapse_and_rescue() -> Array:
	var losses: Array = []
	var ores := items_of("ore")
	var lose_n := int(ceil(ores.size() / 2.0))
	for i in lose_n:
		remove_item(ores[i]["uid"])
		losses.append("원료 잃음: %s" % ores[i]["name"])
	if food > 0:
		losses.append("식량 %d 모두 잃음" % food)
	var wake := int(DB.b("collapse_wake_days"))
	day += wake
	losses.append("의식을 잃은 채 %d일이 지났다" % wake)
	food = int(DB.b("collapse_food_after"))
	fatigue = int(DB.b("collapse_fatigue_after"))
	location = DB.map["base"]
	travel = {}
	visit_uses = {}
	state_changed.emit()
	return losses


# ------------------------------------------------------------------ 장소 활동

func activity_status(act_id: String) -> Dictionary:
	var a: Dictionary = DB.activities.get(act_id, {})
	var limit := int(a.get("limit", 0))
	var used := int(visit_uses.get(act_id, 0))
	if limit > 0 and used >= limit:
		return {"ok": false, "reason": "이번 방문에서는 더 할 수 없습니다"}
	if act_id in ["charcoal", "gather_satetsu", "mine_ore"] and fatigue >= fatigue_max() - 1:
		return {"ok": false, "reason": "너무 지쳤습니다. 먼저 쉬세요"}
	if act_id == "resupply" and food >= food_max():
		return {"ok": false, "reason": "식량이 가득합니다"}
	if act_id == "resupply_inn" and food >= int(DB.b("inn_food_to")):
		return {"ok": false, "reason": "이미 충분합니다"}
	if act_id in ["rest", "camp_here"] and fatigue == 0:
		return {"ok": false, "reason": "피로가 없습니다"}
	return {"ok": true, "reason": ""}


## 활동 실행. 결과 문구를 돌려준다. workshop은 화면 전환을 호출자가 처리한다.
func do_activity(act_id: String) -> String:
	if not activity_status(act_id)["ok"]:
		return ""
	visit_uses[act_id] = int(visit_uses.get(act_id, 0)) + 1
	var nname := DB.node_name(location)
	var changes: Array = []
	var msg := ""
	match act_id:
		"resupply":
			changes.append("식량 %+d" % (food_max() - food))
			food = food_max()
			msg = "마을 곳간에서 식량을 채웠다."
		"resupply_inn":
			var to := int(DB.b("inn_food_to"))
			changes.append("식량 %+d" % (to - food))
			food = to
			msg = "주막 주인이 주먹밥을 넉넉히 싸 주었다."
		"rest":
			day += 1
			changes.append("피로 -%d" % fatigue)
			fatigue = 0
			msg = "하루를 묵으며 푹 쉬었다."
		"camp_here":
			day += 1
			_eat(int(DB.b("camp_food")), changes)
			_add_fatigue(-int(DB.b("camp_fatigue_recover")), changes)
			msg = "근처에 자리를 잡고 하루 쉬었다."
		"rumor":
			msg = "주막 손님이 말했다. " + random_info()
		"charcoal":
			_work_day(changes)
			for i in 2:
				add_charcoal("good", "%s · %d일차" % [nname, day])
			changes.append("숯가마 숲 숯 +2")
			msg = "숯가마 일을 거들고 단단하게 구운 숯을 받았다."
		"gather_satetsu":
			_work_day(changes)
			var o := add_ore("satetsu", nname, _tired_penalty())
			changes.append("%s +1" % o["name"])
			msg = "하루 종일 모래를 일어 사철을 모았다." + (" 지쳐서 고르는 손이 거칠었다." if _tired_penalty() > 0 else "")
		"mine_ore":
			_work_day(changes)
			var o2 := add_ore("mountain_ore", nname, _tired_penalty())
			changes.append("%s +1" % o2["name"])
			msg = "붉은 노두를 깨어 철광석을 캤다." + (" 지쳐서 잡석이 섞였다." if _tired_penalty() > 0 else "")
	state_changed.emit()
	if changes.is_empty():
		return msg
	return "%s\n(%s)" % [msg, ", ".join(changes)]


func _work_day(changes: Array) -> void:
	day += int(DB.b("gather_days"))
	_eat(int(DB.b("move_food")), changes)
	_add_fatigue(int(DB.b("gather_fatigue")), changes)


func _tired_penalty() -> float:
	return float(DB.b("tired_gather_impurity")) if is_tired() else 0.0


# ------------------------------------------------------------------ 공방 결과

func record_result(res: Dictionary) -> void:
	day += int(DB.b("workshop_days_per_blade"))
	res["day"] = day
	results.append(res)
	state_changed.emit()
