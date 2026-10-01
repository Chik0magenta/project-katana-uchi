extends Control
## 화면 전환 관리. 각 화면은 scripts/screens/*.gd 의 Control이다.

const UI = preload("res://scripts/ui/ui_theme.gd")

const SCREENS := {
	"title": preload("res://scripts/screens/title_screen.gd"),
	"map": preload("res://scripts/screens/map_screen.gd"),
	"travel": preload("res://scripts/screens/travel_screen.gd"),
	"location": preload("res://scripts/screens/location_screen.gd"),
	"workshop": preload("res://scripts/screens/workshop_screen.gd"),
	"result": preload("res://scripts/screens/result_screen.gd"),
	"dev": preload("res://scripts/screens/dev_menu.gd"),
}

var current: Control
var current_name: String = ""


func _ready() -> void:
	theme = UI.build()
	var bg := ColorRect.new()
	bg.color = Color8(20, 16, 22)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	go("title")


func go(screen_name: String, params: Dictionary = {}) -> void:
	if current:
		current.queue_free()
		remove_child(current)
	var s: Control = SCREENS[screen_name].new()
	s.set_anchors_preset(Control.PRESET_FULL_RECT)
	current = s
	current_name = screen_name
	add_child(s)
	if s.has_method("setup"):
		s.setup(self, params)


func _unhandled_input(event: InputEvent) -> void:
	# F12: 개발용 실제 수치 표시 전환 (일반 플레이와 분리된 검수 기능)
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F12:
		GameState.dev_numbers = not GameState.dev_numbers
		GameState.state_changed.emit()
