extends RefCounted
## 가열·접쇠(단련) 한 강재분의 임시 상태. 공방 화면에서만 실시간으로 흐른다.

var cfg: Dictionary
var steel: Dictionary          # 원본 강괴 아이템 (출처 보존)
var carbon: float
var uniformity: float
var impurity: float

var fuel: float
var air: float = 0.0
var fire_temp: float
var temp: float = 300.0
var in_fire: bool = true
var scale: float = 0.0         # 표면 산화물 0~100
var folds: int = 0
var max_temp: float = 0.0
var overheat_time: float = 0.0
var burn_time: float = 0.0
var carb_gain: float = 0.0     # 가열 중 침탄으로 얻은 탄소 누계
var fold_log: Array = []


func _init(steel_item: Dictionary, config: Dictionary) -> void:
	cfg = config
	steel = steel_item
	carbon = float(steel_item["carbon"])
	uniformity = float(steel_item["uniformity"])
	impurity = float(steel_item["impurity"])
	fuel = float(cfg["fuel_start"])
	fire_temp = _fire_target()
	temp = 300.0


func _fire_target() -> float:
	return float(cfg["base_temp"]) + fuel * float(cfg["temp_per_fuel"]) + air * float(cfg["temp_per_air"])


func tick(dt: float) -> void:
	fuel = maxf(0.0, fuel - float(cfg["fuel_burn_per_sec"]) * dt)
	air = maxf(0.0, air - float(cfg["bellows_decay_per_sec"]) * dt)
	fire_temp += (_fire_target() - fire_temp) * minf(1.0, float(cfg["fire_follow_rate"]) * dt)
	if in_fire:
		temp += (fire_temp - temp) * minf(1.0, float(cfg["steel_follow_rate"]) * dt)
		_chemistry(dt)
	else:
		temp = maxf(20.0, temp - float(cfg["anvil_cool_per_sec"]) * dt)
	max_temp = maxf(max_temp, temp)


## 숯·온도·시간이 침탄에, 과열이 산화·탈탄에 영향을 준다.
func _chemistry(dt: float) -> void:
	if temp >= float(cfg["carburize_min_temp"]) and temp <= float(cfg["carburize_max_temp"]) \
			and fuel >= float(cfg["carburize_min_fuel"]):
		var g := float(cfg["carburize_per_sec"]) * dt
		carbon += g
		carb_gain += g
	if temp > 800.0:
		scale += float(cfg["scale_per_sec_hot"]) * dt
	if temp > float(cfg["overheat_temp"]):
		carbon -= float(cfg["decarb_per_sec"]) * dt
		scale += float(cfg["scale_per_sec_overheat"]) * dt
		overheat_time += dt
	if temp > float(cfg["burn_temp"]):
		impurity += float(cfg["burn_impurity_per_sec"]) * dt
		uniformity -= float(cfg["burn_uniformity_per_sec"]) * dt
		burn_time += dt
	carbon = clampf(carbon, 0.05, 2.0)
	scale = clampf(scale, 0.0, 100.0)
	impurity = clampf(impurity, 0.0, 100.0)
	uniformity = clampf(uniformity, 0.0, 100.0)


func add_fuel() -> void:
	fuel = minf(100.0, fuel + float(cfg["fuel_add"]))
	# 새 숯은 잠시 불을 덮는다. 탄소는 즉시 오르지 않는다.
	fire_temp -= float(cfg["fuel_add_temp_drop"])


func bellows() -> void:
	air = minf(100.0, air + float(cfg["bellows_add"]))


func take_out() -> void:
	in_fire = false


func put_in() -> void:
	in_fire = true


func remove_scale() -> bool:
	if in_fire or scale <= 0.5:
		return false
	scale = 0.0
	return true


func can_fold() -> Dictionary:
	if in_fire:
		return {"ok": false, "reason": "먼저 화덕에서 꺼내 모루에 올리세요."}
	if folds >= int(cfg["max_folds"]):
		return {"ok": false, "reason": "더 접어도 나아지지 않습니다 (최대 %d회)." % int(cfg["max_folds"])}
	if temp < float(cfg["fold_min_temp"]):
		return {"ok": false, "reason": "너무 식었습니다. 화덕에 다시 넣어 달구세요."}
	return {"ok": true, "reason": ""}


## 늘이고 접기. 탄소를 조금 잃고 균일도↑, 불순도↓. 반복할수록 개선 폭이 준다.
func fold() -> Dictionary:
	if not can_fold()["ok"]:
		return {}
	var eff := pow(float(cfg["fold_diminish"]), folds)
	var scale_left := scale
	eff *= 1.0 - scale_left / 100.0 * float(cfg["fold_scale_penalty"])
	var cold := temp < float(cfg["fold_good_temp"])
	if cold:
		eff *= 0.6
	var du := (100.0 - uniformity) * float(cfg["fold_uniformity_gain"]) * eff
	var di := impurity * float(cfg["fold_impurity_cut"]) * eff
	var add_imp := scale_left * float(cfg["fold_scale_to_impurity"])
	if cold:
		add_imp += float(cfg["fold_cold_impurity"])
	var dc := float(cfg["fold_carbon_loss"])
	if temp > 1200.0:
		dc += float(cfg["fold_carbon_loss_hot_extra"])
	uniformity = clampf(uniformity + du, 0, 100)
	impurity = clampf(impurity - di + add_imp, 0, 100)
	carbon = maxf(0.05, carbon - dc)
	temp -= float(cfg["fold_temp_drop"])
	scale = 0.0
	folds += 1
	var notes: Array = []
	if scale_left > 10.0:
		notes.append("산화물을 함께 접어 넣음")
	if cold:
		notes.append("식은 채 접어 효과 감소")
	var rec := {"fold": folds, "du": du, "di": di - add_imp, "dc": dc, "notes": notes}
	fold_log.append(rec)
	return rec


func result_steel() -> Dictionary:
	var s := steel.duplicate()
	s["carbon"] = snappedf(carbon, 0.01)
	s["uniformity"] = roundf(uniformity)
	s["impurity"] = roundf(impurity)
	s["folds"] = folds
	s["overheat_time"] = overheat_time
	s["burn_time"] = burn_time
	return s
