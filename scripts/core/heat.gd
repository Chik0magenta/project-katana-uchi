extends RefCounted
## 강재 온도 → 색과 상태 문구. 색만으로 판단하지 않도록 항상 문구를 함께 쓴다.

const BANDS := [
	[550.0, "검은빛 (식었음)", Color8(70, 62, 60)],
	[700.0, "어두운 적색", Color8(110, 30, 26)],
	[760.0, "짙은 진홍", Color8(160, 34, 30)],
	[840.0, "밝은 진홍", Color8(214, 52, 38)],
	[950.0, "주홍", Color8(236, 96, 40)],
	[1100.0, "주황", Color8(250, 146, 44)],
	[1250.0, "노란 주황", Color8(255, 196, 70)],
	[1350.0, "노란빛 (과열)", Color8(255, 236, 140)],
	[99999.0, "백열 (타는 중!)", Color8(255, 252, 230)],
]


static func color(t: float) -> Color:
	# 띠 사이를 부드럽게 보간
	var prev_t := 20.0
	var prev_c := Color8(60, 56, 56)
	for band in BANDS:
		var bt: float = band[0]
		var bc: Color = band[2]
		if t < bt:
			var span := bt - prev_t
			var k := 0.0 if span <= 0.0 else clampf((t - prev_t) / span, 0.0, 1.0)
			return prev_c.lerp(bc, 0.4 + 0.6 * k)
		prev_t = bt
		prev_c = bc
	return BANDS[-1][2]


static func text(t: float) -> String:
	for band in BANDS:
		if t < band[0]:
			return band[1]
	return BANDS[-1][1]
