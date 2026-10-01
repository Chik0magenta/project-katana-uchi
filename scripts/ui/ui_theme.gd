extends RefCounted
## 공용 UI 테마. 글자는 가독성을 위해 일반 폰트(나눔고딕)를 쓰고, 픽셀 느낌은 각진 테두리로만 낸다.

const FONT_REG := "res://assets/fonts/NanumGothic-Regular.ttf"
const FONT_BOLD := "res://assets/fonts/NanumGothic-Bold.ttf"

const COL_TEXT := Color8(238, 228, 204)
const COL_DIM := Color8(170, 160, 150)
const COL_ACCENT := Color8(255, 209, 102)
const COL_GOOD := Color8(150, 210, 130)
const COL_BAD := Color8(240, 120, 100)
const COL_PANEL := Color(0.09, 0.07, 0.11, 0.93)
const COL_BORDER := Color8(156, 123, 69)

static var _font_reg: Font
static var _font_bold: Font


static func font(bold: bool = false) -> Font:
	if bold:
		if _font_bold == null:
			_font_bold = _load_font(FONT_BOLD)
		return _font_bold
	if _font_reg == null:
		_font_reg = _load_font(FONT_REG)
	return _font_reg


static func _load_font(path: String) -> Font:
	# 프로젝트 폴더에서 실행할 때는 원본 ttf를 직접 읽는다 (임포트 전에도 동작).
	if FileAccess.file_exists(path):
		var ff := FontFile.new()
		if ff.load_dynamic_font(path) == OK:
			return ff
	# 내보낸 빌드: 임포트된 리소스를 쓴다
	if ResourceLoader.exists(path):
		var f = load(path)
		if f is Font:
			return f
	var sf := SystemFont.new()
	sf.font_names = PackedStringArray(["NanumGothic", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"])
	return sf


static func _box(bg: Color, border: Color, bw: int = 2, margin: int = 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(0)
	s.content_margin_left = margin + 4
	s.content_margin_right = margin + 4
	s.content_margin_top = margin
	s.content_margin_bottom = margin
	return s


static func build() -> Theme:
	var t := Theme.new()
	t.default_font = font()
	t.default_font_size = 19
	t.set_color("font_color", "Label", COL_TEXT)
	t.set_color("default_color", "RichTextLabel", COL_TEXT)
	t.set_font("bold_font", "RichTextLabel", font(true))
	t.set_font("normal_font", "RichTextLabel", font())
	t.set_constant("line_separation", "Label", 3)
	t.set_constant("line_separation", "RichTextLabel", 3)

	t.set_stylebox("normal", "Button", _box(Color8(62, 46, 40), COL_BORDER, 2, 7))
	t.set_stylebox("hover", "Button", _box(Color8(92, 64, 48), COL_ACCENT, 2, 7))
	t.set_stylebox("pressed", "Button", _box(Color8(140, 60, 40), COL_ACCENT, 2, 7))
	t.set_stylebox("focus", "Button", _box(Color(0, 0, 0, 0), COL_ACCENT, 2, 7))
	t.set_stylebox("disabled", "Button", _box(Color8(40, 36, 40), Color8(80, 74, 70), 2, 7))
	t.set_color("font_color", "Button", COL_TEXT)
	t.set_color("font_hover_color", "Button", Color8(255, 240, 210))
	t.set_color("font_pressed_color", "Button", Color8(255, 255, 255))
	t.set_color("font_disabled_color", "Button", Color8(120, 112, 108))
	t.set_font_size("font_size", "Button", 19)

	t.set_stylebox("panel", "PanelContainer", _box(COL_PANEL, COL_BORDER, 2, 10))
	t.set_stylebox("panel", "Panel", _box(COL_PANEL, COL_BORDER, 2, 10))

	var bg := StyleBoxFlat.new()
	bg.bg_color = Color8(40, 34, 40)
	bg.set_border_width_all(1)
	bg.border_color = Color8(90, 80, 70)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color8(214, 120, 60)
	t.set_stylebox("background", "ProgressBar", bg)
	t.set_stylebox("fill", "ProgressBar", fill)
	t.set_font_size("font_size", "ProgressBar", 14)

	t.set_stylebox("panel", "TooltipPanel", _box(Color8(30, 24, 30), COL_BORDER, 1, 6))
	t.set_color("font_color", "TooltipLabel", COL_TEXT)
	return t


## 자주 쓰는 위젯 생성 도우미
static func label(text: String, size: int = 19, col: Color = COL_TEXT, bold: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if bold:
		l.add_theme_font_override("font", font(true))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func button(text: String, cb: Callable, min_h: int = 46) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	b.pressed.connect(cb)
	return b


static func panel() -> PanelContainer:
	return PanelContainer.new()


static func rich(bb: String, size: int = 18) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_font_size_override("bold_font_size", size)
	r.text = bb
	return r
