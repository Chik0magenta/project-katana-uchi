extends Node
## 자체 제작 픽셀 그림. 외부 에셋 없이 실행 시 코드로 그려 ImageTexture로 캐시한다.
## 기준: 모든 그림은 저해상도로 그리고 정수 배율 SCALE(=4)로 번짐 없이 표시한다.
## 팔레트는 아래 P 하나만 쓴다 (31색).

const SCALE := 4

const P := {
	"ink": Color8(27, 21, 32), "night": Color8(42, 34, 54), "dusk": Color8(61, 49, 80),
	"stone_d": Color8(74, 74, 88), "stone": Color8(111, 109, 122), "stone_l": Color8(163, 161, 171),
	"paper": Color8(232, 220, 192), "sand": Color8(201, 169, 107), "sand_d": Color8(156, 123, 69),
	"soil": Color8(107, 74, 47), "soil_d": Color8(69, 48, 31),
	"grass_d": Color8(47, 90, 58), "grass": Color8(79, 127, 67), "grass_l": Color8(134, 168, 90),
	"leaf_d": Color8(31, 61, 43),
	"water_d": Color8(36, 69, 107), "water": Color8(59, 111, 156), "water_l": Color8(127, 178, 201),
	"sky": Color8(156, 195, 213), "sky_l": Color8(207, 227, 224),
	"fire_r": Color8(200, 64, 44), "fire_o": Color8(238, 138, 44), "fire_y": Color8(255, 209, 102),
	"wood": Color8(138, 90, 58), "wood_d": Color8(92, 58, 38),
	"iron_d": Color8(58, 58, 68), "iron": Color8(109, 114, 128), "iron_l": Color8(185, 190, 200),
	"smoke": Color8(140, 135, 148), "snow": Color8(242, 239, 230), "rock_r": Color8(150, 78, 58),
}

var _cache: Dictionary = {}
var _rng := RandomNumberGenerator.new()


func c(name: String) -> Color:
	return P[name]


func tex(key: String) -> ImageTexture:
	if _cache.has(key):
		return _cache[key]
	var im: Image
	var parts := key.split(":")
	match parts[0]:
		"map": im = _map()
		"travel": im = _travel(parts[1])
		"loc": im = _location(parts[1])
		"workshop": im = _workshop()
		"portrait": im = _portrait(parts[1])
		"title": im = _title()
		_: im = _img(8, 8, P["ink"])
	var t := ImageTexture.create_from_image(im)
	_cache[key] = t
	return t


# ================================================================ 기본 도구

func _img(w: int, h: int, fill: Color) -> Image:
	var im := Image.create(w, h, false, Image.FORMAT_RGBA8)
	im.fill(fill)
	return im


func _px(im: Image, x: int, y: int, col: Color) -> void:
	if x >= 0 and y >= 0 and x < im.get_width() and y < im.get_height():
		im.set_pixel(x, y, col)


func _rect(im: Image, x: int, y: int, w: int, h: int, col: Color) -> void:
	var r := Rect2i(x, y, w, h).intersection(Rect2i(0, 0, im.get_width(), im.get_height()))
	if r.size.x > 0 and r.size.y > 0:
		im.fill_rect(r, col)


func _line(im: Image, x0: int, y0: int, x1: int, y1: int, col: Color, thick: int = 1) -> void:
	var dx := absi(x1 - x0)
	var dy := -absi(y1 - y0)
	var sx := 1 if x0 < x1 else -1
	var sy := 1 if y0 < y1 else -1
	var err := dx + dy
	while true:
		_rect(im, x0, y0, thick, thick, col)
		if x0 == x1 and y0 == y1:
			break
		var e2 := 2 * err
		if e2 >= dy:
			err += dy
			x0 += sx
		if e2 <= dx:
			err += dx
			y0 += sy


func _disc(im: Image, cx: int, cy: int, r: int, col: Color) -> void:
	for y in range(-r, r + 1):
		for x in range(-r, r + 1):
			if x * x + y * y <= r * r + r:
				_px(im, cx + x, cy + y, col)


func _ellipse(im: Image, cx: int, cy: int, rx: int, ry: int, col: Color) -> void:
	for y in range(-ry, ry + 1):
		for x in range(-rx, rx + 1):
			if float(x * x) / float(rx * rx) + float(y * y) / float(ry * ry) <= 1.0:
				_px(im, cx + x, cy + y, col)


## 아래가 넓은 삼각형 (산). 꼭대기 (cx, top), 바닥 y=base, 반폭 half
func _peak(im: Image, cx: int, top: int, base: int, half: int, col: Color, shade: Color, snow: Variant = null) -> void:
	var h := base - top
	for y in range(top, base + 1):
		var k := float(y - top) / maxf(1.0, float(h))
		var w := int(round(half * k))
		for x in range(cx - w, cx + w + 1):
			_px(im, x, y, shade if x > cx else col)
		if snow != null and k < 0.28:
			for x in range(cx - w, cx + w + 1):
				_px(im, x, y, snow)


## 두 색 체커 디더 (배경 띠 전환용)
func _dither(im: Image, x: int, y: int, w: int, h: int, a: Color, b: Color) -> void:
	for yy in range(y, y + h):
		for xx in range(x, x + w):
			_px(im, xx, yy, a if (xx + yy) % 2 == 0 else b)


func _speckle(im: Image, x: int, y: int, w: int, h: int, col: Color, density: float, seed_v: int) -> void:
	_rng.seed = seed_v
	for yy in range(y, y + h):
		for xx in range(x, x + w):
			if _rng.randf() < density:
				_px(im, xx, yy, col)


func _sky(im: Image, h: int, top: Color, bottom: Color) -> void:
	var bands := 6
	for i in bands:
		var y0 := int(h * i / float(bands))
		var y1 := int(h * (i + 1) / float(bands))
		_rect(im, 0, y0, im.get_width(), y1 - y0, top.lerp(bottom, i / float(bands - 1)))


func _tree(im: Image, x: int, y: int, s: int = 1) -> void:
	# 소나무 모양 작은 나무. (x,y)=밑동
	_rect(im, x, y - 2 * s, s, 2 * s, P["wood_d"])
	for i in 3:
		var w := (3 - i) * s + s
		_rect(im, x - w + s / 2, y - 2 * s - (i + 1) * 2 * s, w * 2, 2 * s, P["leaf_d"] if i % 2 == 0 else P["grass_d"])


func _round_tree(im: Image, x: int, y: int, r: int) -> void:
	_rect(im, x, y - r, 2, r, P["wood_d"])
	_disc(im, x + 1, y - r - r / 2, r, P["grass_d"])
	_disc(im, x, y - r - r / 2 - 1, r - 1, P["grass"])
	_px(im, x - 1, y - r - r, P["grass_l"])


func _house(im: Image, x: int, y: int, w: int, h: int, roof: Color) -> void:
	# (x,y)=왼쪽 아래
	_rect(im, x, y - h, w, h, P["paper"])
	_rect(im, x, y - h, 1, h, P["sand_d"])
	_rect(im, x + w - 1, y - h, 1, h, P["sand_d"])
	for i in range(0, h / 2 + 2):
		_rect(im, x - 2 + i, y - h - i, w + 4 - 2 * i, 1, roof)
	_rect(im, x + w / 2 - 1, y - 3, 2, 3, P["wood_d"])


# ================================================================ 타이틀

func _title() -> Image:
	var im := _img(320, 180, P["night"])
	_sky(im, 140, P["night"], P["dusk"])
	_speckle(im, 0, 0, 320, 80, P["sky_l"], 0.006, 7)
	_peak(im, 60, 60, 140, 80, P["stone_d"], P["iron_d"])
	_peak(im, 250, 50, 140, 90, P["stone_d"], P["iron_d"], P["stone_l"])
	_rect(im, 0, 140, 320, 40, P["soil_d"])
	_speckle(im, 0, 140, 320, 40, P["soil"], 0.1, 8)
	# 공방 건물과 불빛 (아래쪽, 글자와 겹치지 않게)
	_house(im, 128, 172, 64, 22, P["wood_d"])
	_rect(im, 150, 158, 20, 14, P["fire_o"])
	_rect(im, 154, 161, 12, 11, P["fire_y"])
	_rect(im, 178, 132, 6, 16, P["stone_d"])
	return im


# ================================================================ 지도 (220x170)

func _map() -> Image:
	var im := _img(220, 170, P["grass"])
	_speckle(im, 0, 0, 220, 170, P["grass_l"], 0.05, 1)
	_speckle(im, 0, 0, 220, 170, P["grass_d"], 0.04, 2)
	# 논밭 (마을 남쪽)
	for i in 4:
		_rect(im, 10 + i * 14, 150, 12, 8, P["grass_l"] if i % 2 == 0 else P["sand"])
		_rect(im, 10 + i * 14, 160, 12, 8, P["sand"] if i % 2 == 0 else P["grass_l"])
	# 숲 (북서)
	_rng.seed = 11
	for i in 70:
		var tx := _rng.randi_range(2, 82)
		var ty := _rng.randi_range(14, 78)
		if Vector2(tx, ty).distance_to(Vector2(40, 52)) < 9:
			continue
		_tree(im, tx, ty)
	# 산 (동쪽)
	_peak(im, 196, 26, 70, 26, P["stone"], P["stone_d"], P["snow"])
	_peak(im, 168, 44, 82, 22, P["stone"], P["stone_d"])
	_peak(im, 210, 62, 110, 28, P["stone"], P["stone_d"], P["snow"])
	_peak(im, 178, 92, 128, 24, P["rock_r"], P["soil"])
	_peak(im, 204, 108, 150, 22, P["stone"], P["stone_d"])
	# 강: 북쪽 위에서 남서쪽으로
	var river_pts := [Vector2i(160, 0), Vector2i(146, 22), Vector2i(132, 44), Vector2i(104, 60),
		Vector2i(80, 76), Vector2i(66, 98), Vector2i(30, 112), Vector2i(0, 120)]
	for i in river_pts.size() - 1:
		_line(im, river_pts[i].x, river_pts[i].y, river_pts[i + 1].x, river_pts[i + 1].y, P["water"], 5)
	for i in river_pts.size() - 1:
		_line(im, river_pts[i].x + 1, river_pts[i].y + 1, river_pts[i + 1].x + 1, river_pts[i + 1].y + 1, P["water_l"], 1)
	# 모래톱 (사철터)
	_ellipse(im, 124, 42, 8, 3, P["sand"])
	_speckle(im, 117, 40, 15, 5, P["ink"], 0.25, 3)
	# 길
	var nodes: Dictionary = DB.map["nodes"]
	for e in DB.map["edges"]:
		var a: Array = nodes[e[0]]["pos"]
		var b: Array = nodes[e[1]]["pos"]
		_road(im, int(a[0]), int(a[1]), int(b[0]), int(b[1]))
	# 장소 아이콘
	for id in nodes:
		var n: Dictionary = nodes[id]
		_map_icon(im, String(n["kind"]), int(n["pos"][0]), int(n["pos"][1]))
	return im


func _road(im: Image, x0: int, y0: int, x1: int, y1: int) -> void:
	var steps := maxi(absi(x1 - x0), absi(y1 - y0))
	for i in steps + 1:
		var t := i / float(maxi(1, steps))
		var x := int(round(lerpf(x0, x1, t)))
		var y := int(round(lerpf(y0, y1, t)))
		var under := im.get_pixel(clampi(x, 0, 219), clampi(y, 0, 169))
		var on_water := under.is_equal_approx(P["water"]) or under.is_equal_approx(P["water_l"]) \
			or under.is_equal_approx(P["wood"])
		if on_water:
			_rect(im, x - 1, y - 1, 3, 3, P["wood"])
		elif i % 4 != 3:
			_rect(im, x, y, 2, 2, P["sand_d"])


func _map_icon(im: Image, kind: String, x: int, y: int) -> void:
	match kind:
		"village":
			_rect(im, x - 12, y - 2, 24, 10, P["soil"])
			_house(im, x - 10, y + 4, 8, 5, P["fire_r"])
			_house(im, x + 2, y + 4, 8, 5, P["wood_d"])
			_house(im, x - 4, y - 3, 8, 5, P["stone_d"])
			_rect(im, x + 7, y - 9, 2, 5, P["stone_d"])
		"forest":
			_rect(im, x - 9, y - 4, 18, 10, P["soil"])
			_ellipse(im, x, y + 1, 6, 4, P["stone"])
			_ellipse(im, x, y, 5, 3, P["stone_l"])
			_rect(im, x - 1, y - 4, 2, 2, P["ink"])
			_rect(im, x - 8, y + 3, 4, 2, P["wood"])
			_rect(im, x + 5, y + 3, 4, 2, P["wood"])
		"inn":
			_rect(im, x - 10, y - 4, 20, 10, P["sand"])
			_house(im, x - 6, y + 4, 12, 6, P["wood_d"])
			_rect(im, x + 7, y - 6, 1, 10, P["wood_d"])
			_rect(im, x + 8, y - 6, 4, 3, P["fire_r"])
		"river":
			_rect(im, x - 4, y - 3, 8, 2, P["wood"])
			_rect(im, x - 4, y - 1, 1, 3, P["wood_d"])
			_rect(im, x + 3, y - 1, 1, 3, P["wood_d"])
		"mountain":
			_ellipse(im, x, y + 2, 10, 5, P["rock_r"])
			_rect(im, x - 4, y - 3, 8, 7, P["wood_d"])
			_rect(im, x - 3, y - 2, 6, 6, P["ink"])
			_rect(im, x + 5, y + 3, 4, 3, P["iron"])


# ================================================================ 이동 배경 (320x90)

func _travel(terrain: String) -> Image:
	var im := _img(320, 90, P["sky"])
	match terrain:
		"plains":
			_sky(im, 50, P["sky"], P["sky_l"])
			_ellipse(im, 70, 58, 90, 18, P["grass_d"])
			_ellipse(im, 240, 60, 110, 20, P["grass"])
			_rect(im, 0, 58, 320, 32, P["grass"])
			_speckle(im, 0, 58, 320, 32, P["grass_l"], 0.12, 21)
			for i in 6:
				_rect(im, i * 56, 62, 40, 6, P["sand"])
				_speckle(im, i * 56, 62, 40, 6, P["sand_d"], 0.2, 22 + i)
			_road_band(im, 72, P["sand_d"], P["soil"])
			_round_tree(im, 40, 64, 6)
			_round_tree(im, 260, 66, 7)
		"forest":
			_sky(im, 30, P["sky_l"], P["grass_l"])
			_rect(im, 0, 20, 320, 70, P["leaf_d"])
			_rng.seed = 31
			for i in 26:
				var tx := _rng.randi_range(0, 318)
				var tw := _rng.randi_range(4, 9)
				_rect(im, tx, 10, tw, 66, P["wood_d"] if i % 3 else P["soil_d"])
				_rect(im, tx, 10, 1, 66, P["soil"])
			for i in 40:
				_disc(im, _rng.randi_range(0, 320), _rng.randi_range(0, 26), _rng.randi_range(6, 14), P["grass_d"] if i % 2 else P["leaf_d"])
			_rect(im, 0, 74, 320, 16, P["grass_d"])
			_speckle(im, 0, 74, 320, 16, P["grass"], 0.2, 32)
			_road_band(im, 78, P["soil"], P["soil_d"])
		"river":
			_sky(im, 40, P["sky"], P["sky_l"])
			_ellipse(im, 100, 44, 120, 12, P["grass_d"])
			_ellipse(im, 280, 42, 80, 10, P["stone"])
			_rect(im, 0, 44, 320, 22, P["water"])
			for i in 30:
				_rng.seed = 40 + i
				_rect(im, _rng.randi_range(0, 310), _rng.randi_range(46, 62), _rng.randi_range(4, 10), 1, P["water_l"])
			_rect(im, 0, 66, 320, 24, P["sand"])
			_speckle(im, 0, 66, 320, 24, P["stone"], 0.15, 41)
			_speckle(im, 0, 66, 320, 24, P["ink"], 0.04, 42)
			_road_band(im, 76, P["sand_d"], P["soil"])
		"mountain":
			_sky(im, 60, P["sky"], P["sky_l"])
			_peak(im, 60, 6, 70, 70, P["stone"], P["stone_d"], P["snow"])
			_peak(im, 180, 0, 70, 90, P["stone"], P["stone_d"], P["snow"])
			_peak(im, 290, 14, 70, 60, P["stone"], P["stone_d"], P["snow"])
			_rect(im, 0, 60, 320, 30, P["stone_d"])
			_speckle(im, 0, 60, 320, 30, P["rock_r"], 0.1, 51)
			_speckle(im, 0, 60, 320, 30, P["stone"], 0.15, 52)
			_road_band(im, 74, P["soil"], P["soil_d"])
	return im


func _road_band(im: Image, y: int, col: Color, edge_col: Color) -> void:
	_rect(im, 0, y, 320, 8, col)
	_rect(im, 0, y, 320, 1, edge_col)
	_rect(im, 0, y + 7, 320, 1, edge_col)
	_speckle(im, 0, y + 1, 320, 6, edge_col, 0.08, y)


# ================================================================ 장소 배경 (200x120)

func _location(kind: String) -> Image:
	var im := _img(200, 120, P["sky"])
	match kind:
		"village":
			_sky(im, 60, P["sky"], P["sky_l"])
			_peak(im, 40, 20, 64, 50, P["stone"], P["stone_d"])
			_peak(im, 170, 28, 64, 50, P["grass_d"], P["leaf_d"])
			_rect(im, 0, 64, 200, 56, P["grass"])
			_speckle(im, 0, 64, 200, 56, P["grass_l"], 0.1, 61)
			_rect(im, 80, 92, 40, 28, P["sand_d"])
			_house(im, 16, 88, 30, 16, P["wood_d"])
			_house(im, 140, 90, 34, 18, P["fire_r"])
			# 공방: 굴뚝 있는 건물
			_house(im, 70, 84, 60, 22, P["stone_d"])
			_rect(im, 112, 46, 6, 22, P["stone_d"])
			_rect(im, 92, 72, 16, 12, P["ink"])
			_rect(im, 95, 75, 10, 9, P["fire_o"])
			_rect(im, 98, 78, 4, 6, P["fire_y"])
			_rect(im, 30, 100, 20, 6, P["water"])
		"forest":
			_sky(im, 40, P["sky_l"], P["grass_l"])
			_rect(im, 0, 30, 200, 90, P["leaf_d"])
			_rng.seed = 71
			for i in 16:
				var tx := _rng.randi_range(0, 196)
				_rect(im, tx, 8, _rng.randi_range(4, 8), 80, P["wood_d"])
			for i in 30:
				_disc(im, _rng.randi_range(0, 200), _rng.randi_range(0, 30), _rng.randi_range(8, 16), P["grass_d"] if i % 2 else P["leaf_d"])
			_rect(im, 0, 86, 200, 34, P["soil"])
			_speckle(im, 0, 86, 200, 34, P["soil_d"], 0.15, 72)
			# 숯가마
			_ellipse(im, 100, 88, 36, 22, P["stone_d"])
			_ellipse(im, 100, 86, 34, 20, P["stone"])
			_speckle(im, 66, 66, 68, 22, P["stone_l"], 0.1, 73)
			_rect(im, 92, 90, 16, 12, P["ink"])
			_rect(im, 95, 94, 10, 8, P["fire_r"])
			_rect(im, 98, 66, 4, 4, P["ink"])
			# 장작 더미
			for i in 4:
				_rect(im, 150, 104 - i * 4, 34, 3, P["wood"])
				_rect(im, 150, 104 - i * 4, 3, 3, P["sand"])
		"inn":
			_sky(im, 60, P["dusk"], P["fire_o"])
			_rect(im, 0, 70, 200, 50, P["sand_d"])
			_speckle(im, 0, 70, 200, 50, P["soil"], 0.15, 81)
			_house(im, 50, 96, 100, 34, P["wood_d"])
			_rect(im, 60, 72, 18, 12, P["fire_y"])
			_rect(im, 122, 72, 18, 12, P["fire_y"])
			_rect(im, 92, 80, 16, 16, P["soil_d"])
			_rect(im, 160, 50, 2, 46, P["wood_d"])
			_rect(im, 162, 52, 10, 16, P["paper"])
			_rect(im, 164, 55, 6, 2, P["ink"])
			_rect(im, 164, 60, 6, 2, P["ink"])
			_disc(im, 42, 74, 4, P["fire_r"])
			_rect(im, 0, 100, 200, 6, P["sand"])
		"river":
			_sky(im, 50, P["sky"], P["sky_l"])
			_ellipse(im, 40, 50, 70, 16, P["grass_d"])
			_ellipse(im, 160, 52, 70, 14, P["stone"])
			_rect(im, 0, 50, 200, 40, P["water"])
			_rng.seed = 91
			for i in 30:
				_rect(im, _rng.randi_range(0, 196), _rng.randi_range(52, 88), _rng.randi_range(4, 12), 1, P["water_l"])
			_ellipse(im, 70, 86, 60, 10, P["sand"])
			_speckle(im, 14, 78, 112, 18, P["ink"], 0.18, 92)
			_rect(im, 0, 96, 200, 24, P["sand"])
			_speckle(im, 0, 96, 200, 24, P["stone"], 0.1, 93)
			# 나무 홈통 (사철 거르기)
			_line(im, 120, 84, 170, 100, P["wood"], 3)
			_rect(im, 166, 98, 4, 10, P["wood_d"])
			_rect(im, 124, 86, 3, 12, P["wood_d"])
		"mountain":
			_sky(im, 40, P["sky"], P["sky_l"])
			_peak(im, 60, 0, 80, 80, P["stone"], P["stone_d"], P["snow"])
			_peak(im, 170, 6, 80, 70, P["rock_r"], P["soil"])
			_rect(im, 0, 76, 200, 44, P["stone_d"])
			_speckle(im, 0, 76, 200, 44, P["rock_r"], 0.15, 101)
			# 갱도 입구
			_rect(im, 80, 62, 40, 32, P["wood_d"])
			_rect(im, 85, 66, 30, 28, P["ink"])
			_rect(im, 78, 60, 44, 4, P["wood"])
			# 수레
			_rect(im, 136, 92, 24, 10, P["iron"])
			_rect(im, 136, 92, 24, 2, P["iron_l"])
			_disc(im, 141, 104, 3, P["iron_d"])
			_disc(im, 155, 104, 3, P["iron_d"])
			_speckle(im, 138, 88, 20, 4, P["rock_r"], 0.6, 102)
	return im


# ================================================================ 공방 배경 (320x100)

func _workshop() -> Image:
	var im := _img(320, 100, P["wood_d"])
	# 벽 판자
	for i in 20:
		_rect(im, i * 16, 0, 1, 70, P["soil_d"])
	_speckle(im, 0, 0, 320, 70, P["soil_d"], 0.05, 111)
	# 바닥
	_rect(im, 0, 70, 320, 30, P["soil"])
	_speckle(im, 0, 70, 320, 30, P["soil_d"], 0.12, 112)
	_rect(im, 0, 70, 320, 1, P["soil_d"])
	# 화덕 (왼쪽): 흙벽 화로
	_rect(im, 14, 34, 92, 44, P["stone_d"])
	_rect(im, 16, 36, 88, 40, P["stone"])
	_speckle(im, 16, 36, 88, 40, P["stone_l"], 0.06, 113)
	_rect(im, 30, 46, 60, 16, P["ink"])       # 화구
	_rect(im, 50, 0, 20, 34, P["stone_d"])    # 굴뚝
	_rect(im, 52, 0, 16, 34, P["stone"])
	# 풀무 상자
	_rect(im, 0, 50, 14, 24, P["wood"])
	_rect(im, 0, 50, 14, 2, P["sand_d"])
	_rect(im, 6, 44, 2, 6, P["wood_d"])
	# 숯 바구니
	_rect(im, 96, 80, 16, 10, P["sand_d"])
	_speckle(im, 97, 78, 14, 4, P["ink"], 0.7, 114)
	# 모루 (가운데)
	_rect(im, 146, 54, 52, 8, P["iron_d"])
	_rect(im, 146, 54, 52, 2, P["iron"])
	_rect(im, 138, 56, 10, 4, P["iron_d"])
	_rect(im, 160, 62, 24, 10, P["iron_d"])
	_rect(im, 154, 72, 36, 10, P["wood_d"])
	_rect(im, 154, 72, 36, 2, P["wood"])
	# 망치 걸이
	_rect(im, 210, 14, 2, 20, P["wood"])
	_rect(im, 206, 12, 10, 4, P["iron"])
	# 물통 (오른쪽)
	_rect(im, 236, 58, 64, 26, P["wood"])
	_rect(im, 236, 58, 64, 2, P["sand_d"])
	_rect(im, 240, 60, 56, 6, P["water_d"])
	_rect(im, 240, 60, 56, 1, P["water_l"])
	for i in 4:
		_rect(im, 240 + i * 16, 66, 1, 18, P["wood_d"])
	# 선반의 칼
	_rect(im, 240, 20, 70, 2, P["wood"])
	_rect(im, 248, 14, 50, 2, P["iron_l"])
	_rect(im, 244, 14, 6, 2, P["wood_d"])
	return im


# ================================================================ 초상 (24x24)

func _portrait(id: String) -> Image:
	var im := _img(24, 24, P["dusk"])
	var skin := Color8(214, 168, 128)
	match id:
		"traveler":
			_rect(im, 6, 12, 12, 12, P["sand_d"])
			_rect(im, 8, 8, 8, 7, skin)
			_rect(im, 9, 10, 2, 1, P["ink"])
			_rect(im, 13, 10, 2, 1, P["ink"])
			_rect(im, 2, 6, 20, 2, P["sand"])
			_rect(im, 6, 3, 12, 3, P["sand"])
			_rect(im, 10, 1, 4, 2, P["sand"])
		"merchant":
			_rect(im, 5, 13, 14, 11, P["water_d"])
			_rect(im, 15, 5, 8, 14, P["wood"])
			_rect(im, 7, 6, 9, 8, skin)
			_rect(im, 7, 5, 9, 2, P["paper"])
			_rect(im, 9, 9, 1, 1, P["ink"])
			_rect(im, 13, 9, 1, 1, P["ink"])
			_rect(im, 10, 12, 3, 1, P["soil_d"])
		"bandit":
			_rect(im, 5, 14, 14, 10, P["stone_d"])
			_rect(im, 7, 5, 10, 10, skin)
			_rect(im, 7, 4, 10, 3, P["ink"])
			_rect(im, 7, 10, 10, 5, P["night"])
			_rect(im, 9, 8, 2, 1, P["ink"])
			_rect(im, 13, 8, 2, 1, P["ink"])
			_line(im, 14, 5, 16, 9, P["fire_r"])
		"benkei":
			_rect(im, 2, 13, 20, 11, P["ink"])
			_rect(im, 4, 3, 16, 14, P["paper"])
			_rect(im, 7, 6, 10, 9, skin)
			_rect(im, 8, 8, 3, 1, P["ink"])
			_rect(im, 13, 8, 3, 1, P["ink"])
			_rect(im, 9, 12, 6, 1, P["soil_d"])
			_rect(im, 21, 0, 2, 24, P["wood"])
			_rect(im, 19, 0, 5, 3, P["iron_l"])
			_disc(im, 6, 17, 1, P["fire_r"])
			_disc(im, 10, 18, 1, P["fire_r"])
			_disc(im, 14, 18, 1, P["fire_r"])
	return im
