extends RefCounted
## 성형: 도신을 여러 타격 구간으로 나누어 두드린다. 식으면 재가열한다.
## 성형 이후 강재 세 변수는 고정되고, 형상 품질·결함만 따로 기록한다.

var cfg: Dictionary
var segments: Array = []
var temp: float
var reheat_left: float = 0.0
var reheats: int = 0
var hits: int = 0
var cold_hits: int = 0
var over_hits: int = 0


func _init(config: Dictionary) -> void:
	cfg = config
	temp = float(cfg["start_temp"])
	for i in int(cfg["segments"]):
		segments.append(0.0)


func is_reheating() -> bool:
	return reheat_left > 0.0


func tick(dt: float) -> void:
	if reheat_left > 0.0:
		reheat_left -= dt
		temp += (float(cfg["reheat_temp"]) - temp) * minf(1.0, 3.0 * dt)
		if reheat_left <= 0.0:
			temp = float(cfg["reheat_temp"])
	else:
		temp = maxf(20.0, temp - float(cfg["cool_per_sec"]) * dt)


func reheat() -> void:
	if reheat_left > 0.0:
		return
	reheat_left = float(cfg["reheat_seconds"])
	reheats += 1


## 한 구간 타격. 결과 종류("hot"/"warm"/"cold"/"over")를 돌려준다.
func hit(i: int) -> String:
	if reheat_left > 0.0 or i < 0 or i >= segments.size():
		return ""
	var kind := "hot"
	var gain := float(cfg["hit_hot"])
	if temp < float(cfg["cold_temp"]):
		kind = "cold"
		gain = float(cfg["hit_cold"])
		cold_hits += 1
	elif temp < float(cfg["hot_temp"]):
		kind = "warm"
		gain = float(cfg["hit_warm"])
	segments[i] = float(segments[i]) + gain
	if float(segments[i]) > float(cfg["over_limit"]):
		over_hits += 1
		kind = "over"
	temp -= float(cfg["hit_temp_drop"])
	hits += 1
	return kind


func can_finish() -> bool:
	for s in segments:
		if float(s) < float(cfg["finish_min"]):
			return false
	return true


func quality() -> float:
	var total := 0.0
	for s in segments:
		total += minf(float(s), 100.0)
	return clampf(total / segments.size() - over_hits * 3.0, 0.0, 100.0)


## 구간별 진행도의 표준편차 (고르지 않음)
func unevenness() -> float:
	var vals: Array = segments.map(func(s): return minf(float(s), 130.0))
	var mean := 0.0
	for v in vals:
		mean += v
	mean /= vals.size()
	var var_sum := 0.0
	for v in vals:
		var_sum += (v - mean) * (v - mean)
	return sqrt(var_sum / vals.size())


func unfinished_count() -> int:
	var n := 0
	for s in segments:
		if float(s) < 90.0:
			n += 1
	return n
