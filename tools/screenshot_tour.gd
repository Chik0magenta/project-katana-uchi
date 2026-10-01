extends Node
## 주요 화면을 차례로 띄워 캡처한다 (검수용). 화면이 있는 환경에서 실행:
##   godot --path . res://tools/screenshot_tour.tscn
## 결과: docs/screenshots/*.png

var main
var out_dir := "res://docs/screenshots/"


func _ready() -> void:
	_run.call_deferred()


func shot(name: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	var path := ProjectSettings.globalize_path(out_dir + name + ".png")
	img.save_png(path)
	print("saved ", path, " ", img.get_size())


func wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_dir))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await wait(0.5)
	await shot("01_title")

	GameState.new_game(3)
	main.go("map", {"intro": true})
	await wait(0.3)
	await shot("02_map")
	main.current._on_node("river")
	await wait(0.1)
	await shot("03_map_not_adjacent")
	main.current._on_node("inn")
	await wait(0.3)
	await shot("04_map_selected")

	# 이동: 공방 마을 → 주막 (1일), 도착
	GameState.depart("inn")
	main.go("travel")
	await wait(0.4)
	await shot("05_travel_event")
	main.current._on_choice(0)
	await wait(0.3)
	await shot("06_travel_arrived")
	main.current._enter_place()
	await wait(0.4)
	await shot("07_location_inn")

	# 주막 → 산지 (3일): 산적 사건, 노숙, 비
	GameState.depart("mountain")
	GameState.travel["event"] = _ev("bandit")
	GameState.travel["fx"] = ""
	main.go("travel")
	await wait(0.4)
	await shot("08_travel_bandit")
	main.current._on_choice(2)
	await wait(0.3)
	await shot("09_travel_choose")
	main.current._act("camp")
	await wait(0.2)
	GameState.travel["event"] = _ev("camp_rain")
	GameState.travel["fx"] = "rain"
	main.current._refresh()
	await wait(0.5)
	await shot("10_travel_camp_rain")
	main.current._on_choice(0)
	GameState.fatigue = 2
	main.current._act("back")
	await wait(0.2)
	main.current._on_choice(0)
	await wait(0.3)
	await shot("11_travel_returned")

	GameState.location = "river"
	main.go("location", {"arrived": true})
	await wait(0.3)
	main.current._on_act("gather_satetsu")
	await wait(0.4)
	await shot("12_location_river_gather")

	GameState.location = "mountain"
	main.go("location")
	await wait(0.3)
	await shot("13_location_mountain")
	GameState.location = "forest"
	main.go("location")
	await wait(0.3)
	await shot("14_location_forest")
	GameState.location = "village"
	main.go("location")
	await wait(0.3)
	await shot("15_location_village")

	# 공방
	GameState.add_ore("mountain_ore", "철광 산지")
	GameState.add_charcoal("good", "숯가마 숲")
	main.go("workshop")
	await wait(0.3)
	var ws = main.current
	for it in GameState.items_of("ore"):
		ws._on_smelt(it["uid"])
		await wait(0.1)
	var steels := GameState.items_of("steel")
	ws._on_pick(true, steels[0]["uid"])
	ws._on_pick(true, steels[-1]["uid"])
	await wait(0.3)
	await shot("16_workshop_select")
	ws._on_start()
	await wait(0.3)
	ws._on_air()
	await wait(2.5)
	await shot("17_workshop_refine_fire")
	ws.refine.temp = 1100.0
	ws.refine.scale = 40.0
	ws._on_take_out()
	await wait(0.3)
	await shot("18_workshop_refine_anvil")
	ws._on_scale()
	await wait(0.15)
	ws._on_fold()
	await wait(0.15)
	await shot("19_workshop_fold")
	ws._on_refine_done()
	await wait(0.2)
	ws.refine.temp = 1100.0
	ws.refine.in_fire = false
	ws._on_fold()
	ws._on_refine_done()
	await wait(0.3)
	await shot("20_workshop_assign")
	ws._on_assign(0)
	await wait(0.3)
	ws._on_join()
	await wait(0.8)
	await shot("21_workshop_join")
	await wait(1.4)
	for k in 14:
		ws._on_hit(k % 6)
	await wait(0.12)
	await shot("22_workshop_shape")
	for k in 22:
		ws._on_hit(k % 6)
		if ws.shaping.temp < 820:
			ws._on_reheat()
			await wait(1.4)
	await wait(0.2)
	await shot("23_workshop_shape_done")
	ws._on_shape_done()
	await wait(0.3)
	ws._on_clay()
	await wait(0.8)
	await shot("24_workshop_clay")
	await wait(1.0)
	ws.quench.temp = 790.0
	await wait(0.3)
	await shot("25_workshop_quench_heat")
	ws._on_quench()
	await wait(0.7)
	await shot("26_workshop_quench_steam")
	await wait(1.8)
	ws._finish()
	await wait(0.6)
	await shot("27_result")

	main.go("dev")
	await wait(0.3)
	await shot("28_dev_menu")
	GameState.dev_numbers = true
	main.current._go_result()
	await wait(0.6)
	await shot("29_dev_sample_result")
	main.go("workshop")
	await wait(0.3)
	await shot("30_workshop_dev_numbers")
	get_tree().quit()


func _ev(id: String) -> Dictionary:
	for e in DB.events:
		if e["id"] == id:
			return e
	return {}
