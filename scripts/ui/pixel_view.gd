extends Control
## 저해상도 픽셀 그림을 정수 배율로 번짐 없이 그리고, 같은 격자 위에 짧은 효과를 그린다.
## fx_drawer(view, t)가 있으면 매 프레임 호출된다. 좌표는 모두 저해상도 픽셀 단위.

var texture: Texture2D
var pscale: int = 4
var fx_drawer: Callable
var time: float = 0.0
var tint: Color = Color(1, 1, 1, 1)


func _init() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func setup(tex: Texture2D, scale_v: int = 4) -> void:
	texture = tex
	pscale = scale_v
	if tex:
		custom_minimum_size = Vector2(tex.get_width() * pscale, tex.get_height() * pscale)
		size = custom_minimum_size


func _process(delta: float) -> void:
	time += delta
	queue_redraw()


func _draw() -> void:
	if texture:
		draw_texture_rect(texture, Rect2(Vector2.ZERO, Vector2(texture.get_width(), texture.get_height()) * pscale), false, tint)
	if fx_drawer.is_valid():
		fx_drawer.call(self, time)


## 저해상도 좌표의 사각형 (격자에 맞춘다)
func px(x: float, y: float, w: float, h: float, col: Color) -> void:
	draw_rect(Rect2(floorf(x) * pscale, floorf(y) * pscale, maxf(1.0, floorf(w)) * pscale, maxf(1.0, floorf(h)) * pscale), col)


## 화면 전체 덮개 (밤·비 분위기)
func overlay(col: Color) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), col)
