// 강재 발열색과 상태 문구. 색만으로 읽지 않도록 항상 문구를 함께 보여 준다 (GDD 10장).
// Godot 이식: 같은 표를 Gradient 또는 배열로.

export const HEAT_BANDS = [
  { min: -Infinity, label: '식은 쇠', color: [0x3a, 0x3a, 0x42] },
  { min: 450, label: '검붉은 빛', color: [0x5a, 0x1c, 0x18] },
  { min: 600, label: '어두운 적색', color: [0x8c, 0x1e, 0x16] },
  { min: 700, label: '진홍', color: [0xc0, 0x2a, 0x18] },
  { min: 760, label: '주홍', color: [0xe8, 0x4a, 0x1a] },
  { min: 850, label: '주황', color: [0xf4, 0x7a, 0x1c] },
  { min: 1000, label: '노란 주황', color: [0xfa, 0xa8, 0x2a] },
  { min: 1150, label: '노란빛', color: [0xfc, 0xd6, 0x4a] },
  { min: 1280, label: '과열 · 연노랑', color: [0xfe, 0xf0, 0x90] },
  { min: 1380, label: '백열 · 타는 중', color: [0xff, 0xff, 0xf0] },
];

export function heatBand(temp) {
  let b = HEAT_BANDS[0];
  for (const band of HEAT_BANDS) if (temp >= band.min) b = band;
  return b;
}

// 띠 사이를 부드럽게 보간한 RGB (0~1)
export function heatColor(temp) {
  const bands = HEAT_BANDS;
  if (temp <= bands[1].min) {
    const t = Math.max(0, (temp - 20) / (bands[1].min - 20));
    return mix(bands[0].color, bands[1].color, t * t);
  }
  for (let i = 1; i < bands.length - 1; i++) {
    if (temp < bands[i + 1].min) {
      const t = (temp - bands[i].min) / (bands[i + 1].min - bands[i].min);
      return mix(bands[i].color, bands[i + 1].color, t);
    }
  }
  return mix(bands[bands.length - 1].color, bands[bands.length - 1].color, 0);
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => (a[i] + (b[i] - a[i]) * t) / 255);
}
