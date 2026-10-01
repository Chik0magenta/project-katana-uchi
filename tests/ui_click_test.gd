extends Node
## 실제 마우스 클릭 이벤트로 버튼을 눌러 전체 흐름을 진행하는 UI 테스트.
## 실행 (실제 창 필요. 리눅스 서버에서는 xvfb-run 사용):
##   godot --path . res://tests/ui_click_test.tscn
## 버튼이 다른 요소에 가려져 눌리지 않거나, 화면 밖에 있으면 실패한다.

var main
var fails := 0


func _ready() -> void:
	_run.call_deferred()


func wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout


func find_buttons(node: Node, prefix: String, out: Array) -> void:
	if node is BaseButton and node.is_visible_in_tree():
		var t: String = node.text if "text" in node else ""
		if t.begins_with(prefix):
			out.append(node)
	for c in node.get_children():
		find_buttons(c, prefix, out)


func click(prefix: String, required: bool = true) -> bool:
	await get_tree().process_frame
	var found: Array = []
	find_buttons(main.current, prefix, found)
	found = found.filter(func(b): return not b.disabled)
	if found.is_empty():
		if required:
			fails += 1
			print("  FAIL 버튼 없음/비활성: ", prefix, "  (화면: ", main.current_name, ")")
		return false
	var b: BaseButton = found[0]
	var r: Rect2 = b.get_global_rect()
	if not Rect2(0, 0, 1280, 720).encloses(r):
		fails += 1
		print("  FAIL 화면 밖 버튼: ", prefix, " ", r)
	var pos := r.get_center()
	var pressed_flag := [false]
	var cb := func(): pressed_flag[0] = true
	if b is Button or b is CheckBox:
		if b.toggle_mode:
			b.toggled.connect(func(_on): pressed_flag[0] = true, CONNECT_ONE_SHOT)
		else:
			b.pressed.connect(cb, CONNECT_ONE_SHOT)
	for down in [true, false]:
		var ev := InputEventMouseButton.new()
		ev.button_index = MOUSE_BUTTON_LEFT
		ev.pressed = down
		ev.position = pos
		ev.global_position = pos
		get_viewport().push_input(ev)
		await get_tree().process_frame
	await get_tree().process_frame
	if not pressed_flag[0]:
		fails += 1
		print("  FAIL 클릭이 전달되지 않음 (가려짐?): ", prefix, " at ", pos)
		return false
	print("  click ", prefix, "  [", main.current_name, "]")
	await get_tree().process_frame
	check_layout()
	return true


var reported := {}


## 화면 밖으로 나가거나, 고정 크기 패널이 내용 때문에 늘어난 경우(잘림·겹침 원인)를 보고한다.
func check_layout() -> void:
	_check_node(main.current)


func _check_node(n: Node) -> void:
	if n is ScrollContainer:
		return
	if n is Control and n.is_visible_in_tree():
		var r: Rect2 = n.get_global_rect()
		var key := "%s:%s" % [main.current_name, n.get_path()]
		if not Rect2(-1, -1, 1282, 722).encloses(r) and not reported.has(key):
			reported[key] = true
			fails += 1
			var t: String = n.text if "text" in n else n.get_class()
			print("  FAIL 화면 밖으로 나감 [%s] %s %s" % [main.current_name, t.left(30), r])
		if n is PanelContainer and n.custom_minimum_size.y > 0 and n.size.y > n.custom_minimum_size.y + 1 and not reported.has(key):
			reported[key] = true
			fails += 1
			print("  FAIL 패널 내용이 넘침 [%s] %s: %d > %d" % [main.current_name, n.name, n.size.y, n.custom_minimum_size.y])
	for c in n.get_children():
		_check_node(c)


func click_node(id: String) -> void:
	# 지도 노드 버튼은 글자가 없으므로 tooltip(장소 이름)으로 찾는다
	var name: String = DB.node_name(id)
	for c in main.current.get_children():
		if c is Button and c.tooltip_text == name:
			var pos: Vector2 = c.get_global_rect().get_center()
			for down in [true, false]:
				var ev := InputEventMouseButton.new()
				ev.button_index = MOUSE_BUTTON_LEFT
				ev.pressed = down
				ev.position = pos
				ev.global_position = pos
				get_viewport().push_input(ev)
				await get_tree().process_frame
			print("  click 지도 노드 ", name)
			return
	fails += 1
	print("  FAIL 지도 노드 없음 ", id)


func expect_screen(n: String) -> void:
	await wait(0.15)
	if main.current_name != n:
		fails += 1
		print("  FAIL 화면 기대 %s, 실제 %s" % [n, main.current_name])


## 이동 화면에서 도착할 때까지 사건 대응 → 진행하기 (지치면 노숙)
func ride_to_arrival() -> void:
	for i in 30:
		await wait(0.05)
		var ph: String = GameState.travel.get("phase", "")
		if ph == "event":
			# 첫 번째 가능한 선택지
			var ev: Dictionary = GameState.travel["event"]
			for ch in ev["choices"]:
				if GameState.choice_status(ch)["ok"]:
					await click(ch["label"])
					break
		elif ph == "choose":
			if GameState.fatigue >= 7:
				await click("노숙하기")
			else:
				await click("진행하기")
		elif ph == "arrived":
			await click(DB.node_name(GameState.travel["to"]) + "에 들어가기")
			return
		else:
			fails += 1
			print("  FAIL 예상치 못한 이동 상태: ", ph)
			return


func _run() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await wait(0.3)
	print("== 타이틀 → 지도")
	await click("새로 시작하기")
	await expect_screen("map")
	await click_node("river")
	await wait(0.1)
	if GameState.travel.is_empty() and main.current.selected == "":
		print("  ok   비인접 노드 클릭 시 출발 대상이 되지 않음")
	else:
		fails += 1
		print("  FAIL 비인접 노드가 선택됨")
	await click("공방 마을 둘러보기")
	await expect_screen("location")
	await click("보급하기")
	await click("지도 펼치기")
	await click_node("forest")
	await click("숯가마 숲(으)로 출발")
	await expect_screen("travel")
	await ride_to_arrival()
	await expect_screen("location")
	await click("숯 확보")
	await click("지도 펼치기")
	await click_node("village")
	await click("공방 마을(으)로 출발")
	await ride_to_arrival()
	await expect_screen("location")
	print("== 공방")
	await click("공방에 들어가기")
	await expect_screen("workshop")
	# 원료가 있으면 먼저 제철, 그래도 모자라면 창고 고철
	for k in 4:
		if not await click("제철", false):
			break
	await click("창고의 고철 강괴 받기", false)
	await wait(0.1)
	var boxes: Array = []
	_find_checkboxes(main.current, boxes)
	for i in mini(2, boxes.size()):
		await _click_control(boxes[0])
		await wait(0.1)
		boxes = []
		_find_checkboxes(main.current, boxes)
	await click("선택한 두 강재로 단련 시작")
	for n in 2:
		for k in 6:
			await click("풀무질")
			await wait(0.35)
		await wait(1.5)
		await click("꺼내서 모루에 올리기")
		await click("산화물 털기", false)
		await click("늘이고 접기")
		await click("이 강재 단련 마치기")
		await wait(0.2)
	await click("강재 1 → 피철")
	await click("두드려 합치기")
	await wait(2.0)
	var names := ["칼끝", "2구간", "3구간", "4구간", "5구간", "밑동"]
	for k in 48:
		if main.current.shaping.temp < 830.0:
			await click("다시 달구기")
			await wait(1.4)
		var idx := 0
		for i in 6:
			if main.current.shaping.segments[i] < main.current.shaping.segments[idx]:
				idx = i
		if main.current.shaping.segments[idx] >= 95.0:
			break
		await click(names[idx])
	await click("성형 마치기")
	await click("다듬고 점토 바르기")
	await wait(1.7)
	var guard := 0
	while main.current.quench.temp < 785.0 and guard < 400:
		await wait(0.05)
		guard += 1
	await click("담금질!")
	await wait(2.6)
	await click("결과 보기")
	await expect_screen("result")
	var res: Dictionary = GameState.results[-1]
	print("  결과: %s / %s / %s / %s" % [res["grade"], res["hardening"], res["soundness"], res["shape"]])
	await click("공방에서 다시 만들기")
	await expect_screen("workshop")
	print("\nUI 클릭 테스트: %s (실패 %d)" % ["통과" if fails == 0 else "실패", fails])
	get_tree().quit(1 if fails > 0 else 0)


func _find_checkboxes(node: Node, out: Array) -> void:
	if node is CheckBox and not node.button_pressed:
		out.append(node)
	for c in node.get_children():
		_find_checkboxes(c, out)


func _click_control(c: Control) -> void:
	var pos := c.get_global_rect().get_center()
	for down in [true, false]:
		var ev := InputEventMouseButton.new()
		ev.button_index = MOUSE_BUTTON_LEFT
		ev.pressed = down
		ev.position = pos
		ev.global_position = pos
		get_viewport().push_input(ev)
		await get_tree().process_frame
