extends PanelContainer
## 상단 상태 표시줄: 일차·식량·피로·인벤토리·동행자

const UI = preload("res://scripts/ui/ui_theme.gd")

var _label: RichTextLabel


func _ready() -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.08, 0.95)
	sb.border_color = UI.COL_BORDER
	sb.border_width_bottom = 2
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	add_theme_stylebox_override("panel", sb)
	custom_minimum_size = Vector2(1280, 40)
	size = Vector2(1280, 40)
	_label = UI.rich("", 18)
	_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	add_child(_label)
	GameState.state_changed.connect(refresh)
	refresh()


func refresh() -> void:
	if not is_instance_valid(_label):
		return
	var gs := GameState
	var food_col := "#f07864" if gs.food <= 2 else "#eee4cc"
	var fat_col := "#f07864" if gs.is_tired() else "#eee4cc"
	var comp := "없음" if gs.companions.is_empty() else "벤케이"
	var dev := "   [color=#9c7b45][개발 수치 표시 중 · F12][/color]" if gs.dev_numbers else ""
	_label.text = "[b]%d일차[/b]    식량 [color=%s]%d/%d[/color]    피로 [color=%s]%d/%d[/color]%s    %s    동행: %s%s" % [
		gs.day, food_col, gs.food, gs.food_max(), fat_col, gs.fatigue, gs.fatigue_max(),
		" (지침)" if gs.is_tired() else "", gs.inventory_summary(), comp, dev]
