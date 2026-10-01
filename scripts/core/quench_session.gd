extends RefCounted
## 담금질 직전 가열. 플레이어가 색과 문구를 보고 담금질 시점을 고른다.

var cfg: Dictionary
var temp: float
var in_fire: bool = true
var max_temp: float = 0.0
var done: bool = false
var quench_temp: float = 0.0


func _init(config: Dictionary) -> void:
	cfg = config
	temp = float(cfg["start_temp"])


func tick(dt: float) -> void:
	if done:
		temp = maxf(20.0, temp - 300.0 * dt)
		return
	if in_fire:
		temp += (float(cfg["fire_temp"]) - temp) * minf(1.0, float(cfg["heat_rate"]) * dt)
	else:
		temp = maxf(20.0, temp - float(cfg["out_cool_per_sec"]) * dt)
	max_temp = maxf(max_temp, temp)


func toggle_fire() -> void:
	if not done:
		in_fire = not in_fire


func quench() -> void:
	if done:
		return
	done = true
	quench_temp = temp
