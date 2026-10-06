// 배경 그림: 지도, 이동 화면 레이어, 장소 삽화, 공방, 결과, 타이틀.
// 모두 실행 시 코드로 그린다(외부 아트 없음). 기준 해상도 320x180.
import { P } from '../palette.js';
import { PixelCanvas } from '../pixel.js';
import { MAP } from '../../data/map.js';

// ── 공용 소품 ─────────────────────────────────
export function cedar(pc, x, base, h, dark = P.grassD, mid = P.grass, light = P.grassL) {
  pc.rect(x - 1, base - 3, 2, 3, P.woodD);
  const layers = Math.max(2, Math.floor(h / 4));
  for (let i = 0; i < layers; i++) {
    const y = base - 3 - i * (h / layers) - h / layers;
    const w = Math.round((layers - i) * 2.2 + 1);
    pc.poly([[x, y - 2], [x - w, y + h / layers + 1], [x + w, y + h / layers + 1]], dark);
    pc.poly([[x, y - 1], [x - w + 1, y + h / layers], [x, y + h / layers]], mid);
    pc.px(x - 1, y + 1, light);
  }
}

export function pine(pc, x, base, h) {
  pc.rect(x, base - h, 1, h, P.woodD);
  for (let i = 0; i < 3; i++) {
    const y = base - h + i * (h / 3);
    pc.ellipse(x + (i % 2 ? 2 : -2), Math.round(y), 4 - i, 1, P.grassD);
    pc.hline(x + (i % 2 ? 0 : -4), Math.round(y) - 1, 4, P.grass);
  }
}

export function house(pc, x, y, w, h, roof = P.slate, wall = P.paperD, opts = {}) {
  // 벽
  pc.rect(x, y, w, h, wall);
  pc.rect(x, y + h - 1, w, 1, P.woodD);
  for (let i = x + 2; i < x + w - 1; i += 5) pc.vline(i, y, h, P.wood);
  // 지붕
  const oh = 3; const rh = Math.round(h * 0.7) + 2;
  pc.poly([[x - oh, y], [x + w / 2, y - rh], [x + w + oh, y]], roof);
  pc.hline(x - oh, y, w + oh * 2, P.ink);
  pc.line(x - oh, y, x + w / 2, y - rh, P.ink);
  pc.line(x + w + oh, y, x + w / 2, y - rh, P.ink);
  // 문
  if (opts.door !== false) pc.rect(x + Math.floor(w / 2) - 2, y + h - 6, 4, 5, P.woodD);
  if (opts.window) pc.rect(x + 2, y + 2, 3, 2, opts.window);
}

export function mountain(pc, cx, base, w, h, body = P.stone, shade = P.slate, snow = null) {
  pc.poly([[cx, base - h], [cx - w / 2, base], [cx + w / 2, base]], body);
  pc.poly([[cx, base - h], [cx + w / 2, base], [cx + w * 0.1, base]], shade);
  if (snow) pc.poly([[cx, base - h], [cx - w * 0.12, base - h * 0.75], [cx + w * 0.04, base - h * 0.8], [cx + w * 0.12, base - h * 0.74]], snow);
}

function cloud(pc, x, y, w, c = P.white) {
  pc.ellipse(x, y, w, 3, c);
  pc.ellipse(x - w / 2, y + 1, w / 2, 2, c);
  pc.ellipse(x + w / 2, y + 1, w / 2, 2, c);
}

// 천수각: 흰 벽과 어두운 기와 지붕이 겹친 성 (cx: 가운데, base: 돌담 위 y)
export function castleKeep(pc, cx, base, sc = 1) {
  const tiers = [[34, 9], [26, 8], [18, 7]];
  let y = base;
  for (const [w0, h0] of tiers) {
    const w = Math.round(w0 * sc); const hh = Math.round(h0 * sc);
    pc.rect(cx - w / 2, y - hh, w, hh, P.white);
    for (let x = cx - w / 2 + 3; x < cx + w / 2 - 2; x += 5) pc.rect(x, y - hh + 2, 2, 2, P.ink);
    const ry = y - hh;
    pc.poly([[cx - w / 2 - 4, ry + 1], [cx + w / 2 + 4, ry + 1], [cx + w / 2 - 1, ry - 3], [cx - w / 2 + 1, ry - 3]], P.slate);
    pc.hline(cx - w / 2 - 4, ry + 1, w + 8, P.ink);
    pc.px(cx - w / 2 - 5, ry, P.slate); pc.px(cx + w / 2 + 4, ry, P.slate);
    y = ry - 3;
  }
  pc.poly([[cx - 6, y + 1], [cx + 6, y + 1], [cx, y - 4]], P.slate);
  pc.px(cx - 4, y - 3, P.ink); pc.px(cx + 4, y - 3, P.ink);
}

// ── 지도 (216x169) ────────────────────────────
export const MAP_W = 216;
export const MAP_H = 169;

export function drawMap() {
  const pc = new PixelCanvas(MAP_W, MAP_H, 11);
  pc.fill(P.grass);
  pc.dither(0, 0, MAP_W, MAP_H, P.grassL, 0.18);
  pc.speckle(0, 0, MAP_W, MAP_H, P.grassD, 0.05);

  // 논밭 (마을 주변)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = 10 + i * 13; const y = 140 + j * 9;
    pc.rect(x, y, 11, 7, P.leaf); pc.dither(x, y, 11, 7, P.grassL, 0.4); pc.rect(x, y + 6, 11, 1, P.earthL);
  }

  // 강 (오른쪽 위에서 아래로)
  const river = [[216, 70], [200, 92], [184, 110], [170, 124], [160, 134], [146, 150], [136, 169]];
  for (let i = 0; i < river.length - 1; i++) {
    const [x0, y0] = river[i]; const [x1, y1] = river[i + 1];
    pc.thickLine(x0, y0, x1, y1, 9, P.water);
  }
  for (let i = 0; i < river.length - 1; i++) {
    const [x0, y0] = river[i]; const [x1, y1] = river[i + 1];
    pc.thickLine(x0 - 2, y0, x1 - 2, y1, 2, P.waterL);
  }
  pc.speckle(130, 70, 86, 99, P.foam, 0.0);
  // 사철 모래톱
  pc.ellipse(140, 141, 7, 2, P.sand); pc.speckle(133, 139, 14, 5, P.ink, 0.3);

  // 산맥 (오른쪽 위)
  mountain(pc, 196, 50, 50, 40, P.stone, P.slate, P.white);
  mountain(pc, 164, 46, 46, 34, P.stoneL, P.stone, P.white);
  mountain(pc, 208, 64, 34, 22, P.stone, P.slate);
  mountain(pc, 140, 52, 30, 18, P.stone, P.slate);
  mountain(pc, 120, 34, 34, 22, P.stoneL, P.stone);

  // 숲 (왼쪽 위)
  for (let k = 0; k < 40; k++) {
    const x = 14 + ((k * 37) % 80); const y = 22 + ((k * 23) % 50);
    if (Math.hypot(x - 50, y - 50) < 9) continue;
    cedar(pc, x, y + 8, 9 + (k % 4));
  }
  // 작은 숲 덤불
  for (let k = 0; k < 14; k++) cedar(pc, 72 + ((k * 13) % 30), 120 + ((k * 7) % 14), 6);

  // 길
  for (const e of MAP.edges) {
    const a = MAP.nodes[e.a]; const b = MAP.nodes[e.b];
    pc.thickLine(a.x, a.y, b.x, b.y, 3, P.earth);
    pc.line(a.x, a.y, b.x, b.y, P.earthL);
    // 하루 구간 눈금
    for (let d = 1; d < e.days; d++) {
      const x = a.x + (b.x - a.x) * d / e.days; const y = a.y + (b.y - a.y) * d / e.days;
      pc.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, P.paper);
      pc.px(Math.round(x), Math.round(y), P.earthD);
    }
  }

  // 장소 아이콘
  const n = MAP.nodes;
  // 마을
  house(pc, n.village.x - 12, n.village.y - 2, 9, 6, P.slate, P.paperD, { door: false });
  house(pc, n.village.x + 2, n.village.y - 4, 10, 7, P.woodD, P.paperD, { door: false });
  pc.rect(n.village.x + 8, n.village.y - 14, 2, 6, P.stone); // 굴뚝
  house(pc, n.village.x - 4, n.village.y + 6, 8, 5, P.slate, P.paperD, { door: false });
  // 찻집
  house(pc, n.inn.x - 6, n.inn.y - 2, 12, 7, P.red, P.paper, { door: false });
  pc.rect(n.inn.x + 7, n.inn.y - 1, 2, 3, P.redL);
  // 숯가마
  pc.ellipse(n.forest.x, n.forest.y + 2, 6, 4, P.earth); pc.ellipse(n.forest.x, n.forest.y + 1, 4, 2, P.earthL);
  pc.rect(n.forest.x - 1, n.forest.y + 3, 3, 3, P.ink);
  // 사철 홈통
  pc.rect(n.river.x - 6, n.river.y - 3, 12, 3, P.woodL); pc.hline(n.river.x - 6, n.river.y, 12, P.woodD);
  pc.speckle(n.river.x - 5, n.river.y - 3, 10, 2, P.ink, 0.4);
  // 광산 입구
  pc.ellipse(n.mountain.x, n.mountain.y + 4, 7, 5, P.stone);
  pc.rect(n.mountain.x - 3, n.mountain.y + 2, 6, 6, P.ink);
  pc.hline(n.mountain.x - 4, n.mountain.y + 1, 8, P.woodL);
  pc.vline(n.mountain.x - 4, n.mountain.y + 1, 7, P.woodL); pc.vline(n.mountain.x + 3, n.mountain.y + 1, 7, P.woodL);
  pc.speckle(n.mountain.x - 9, n.mountain.y + 5, 18, 6, P.orange, 0.08);
  // 성하 마을: 작은 성과 집들
  house(pc, n.castle.x - 16, n.castle.y + 2, 8, 5, P.slate, P.paperD, { door: false });
  house(pc, n.castle.x + 8, n.castle.y + 3, 9, 5, P.woodD, P.paperD, { door: false });
  pc.poly([[n.castle.x - 7, n.castle.y + 4], [n.castle.x + 7, n.castle.y + 4], [n.castle.x + 5, n.castle.y], [n.castle.x - 5, n.castle.y]], P.stone);
  castleKeep(pc, n.castle.x, n.castle.y, 0.32);

  // 테두리
  pc.rect(0, 0, MAP_W, 1, P.woodD); pc.rect(0, MAP_H - 1, MAP_W, 1, P.woodD);
  pc.rect(0, 0, 1, MAP_H, P.woodD); pc.rect(MAP_W - 1, 0, 1, MAP_H, P.woodD);
  // 나침반
  pc.circle(14, 14, 6, P.paperD); pc.circle(14, 14, 5, P.paper);
  pc.vline(14, 9, 10, P.ink); pc.hline(9, 14, 11, P.stone); pc.rect(13, 9, 3, 2, P.red);
  return pc;
}

export function ringSprite(color, r = 7) {
  const pc = new PixelCanvas(r * 2 + 3, r * 2 + 3);
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    pc.px(Math.round(r + 1 + Math.cos(t) * r), Math.round(r + 1 + Math.sin(t) * r), color);
  }
  return pc;
}

export function markerSprite() {
  // 현재 위치 깃발
  const pc = new PixelCanvas(9, 14);
  pc.vline(1, 0, 14, P.woodD);
  pc.rect(2, 0, 6, 5, P.red); pc.rect(2, 0, 6, 1, P.redL);
  pc.rect(4, 1, 2, 2, P.white);
  return pc;
}

// ── 이동 화면 레이어 (가로 반복, 320 폭) ─────────────
const SKY_DAY = [P.sky, P.sky, P.skyL, P.skyL, P.paper];
const SKY_NIGHT = [P.night, P.night, P.deep, P.deep, P.slate];

export function drawSky(night) {
  const pc = new PixelCanvas(320, 70, 3);
  pc.bands(0, 0, 320, 70, night ? SKY_NIGHT : SKY_DAY);
  if (night) {
    pc.speckle(0, 0, 320, 40, P.white, 0.012);
    pc.circle(250, 16, 5, P.paper); pc.circle(252, 15, 4, P.deep);
  } else {
    cloud(pc, 60, 14, 10); cloud(pc, 180, 22, 14); cloud(pc, 280, 10, 8);
  }
  return pc;
}

export function drawFar(terrain, night) {
  const pc = new PixelCanvas(320, 40, 5);
  const body = night ? P.slate : terrain === 'mountain' ? P.stone : P.stoneL;
  const shade = night ? P.deep : P.stone;
  const peaks = terrain === 'mountain' ? [[30, 34], [90, 38], [150, 30], [210, 39], [270, 33], [330, 34], [-30, 34]]
    : [[40, 16], [120, 22], [200, 14], [280, 20], [360, 16], [-40, 20]];
  for (const [x, h] of peaks) mountain(pc, x, 40, h * 2.6, h, body, shade, terrain === 'mountain' && !night ? P.white : null);
  return pc;
}

export function drawMid(terrain, night) {
  const pc = new PixelCanvas(320, 44, 9);
  const g = night ? P.grassD : P.grass;
  if (terrain === 'plain') {
    pc.rect(0, 24, 320, 20, night ? P.grassD : P.grassL);
    for (let x = 0; x < 320; x += 22) { pc.rect(x, 28, 20, 7, night ? P.grass : P.leaf); pc.hline(x, 35, 20, P.earthL); pc.dither(x, 28, 20, 7, g, 0.3); }
    house(pc, 70, 18, 10, 6, P.slate, night ? P.stone : P.paperD, { window: night ? P.yellow : null });
    house(pc, 230, 20, 8, 5, P.woodD, night ? P.stone : P.paperD, { window: night ? P.yellow : null });
    for (let x = 10; x < 320; x += 64) pine(pc, x, 26, 10);
  } else if (terrain === 'forest') {
    pc.rect(0, 30, 320, 14, g);
    for (let x = 0; x < 330; x += 11) cedar(pc, x, 40 + (x % 3), 22 + ((x * 7) % 10), P.grassD, night ? P.grassD : P.grass, night ? P.grass : P.grassL);
  } else if (terrain === 'river') {
    pc.rect(0, 16, 320, 28, night ? P.waterD : P.water);
    pc.dither(0, 16, 320, 4, night ? P.water : P.waterL, 0.5);
    for (let x = 0; x < 320; x += 9) pc.hline(x, 22 + (x % 5) * 3, 4, night ? P.water : P.waterL);
    pc.rect(0, 38, 320, 6, P.sand); pc.dither(0, 36, 320, 2, P.sand, 0.5); pc.speckle(0, 38, 320, 6, P.ink, 0.08);
    for (let x = 30; x < 320; x += 80) { pc.vline(x, 8, 12, P.grassD); pc.vline(x + 2, 10, 10, P.grass); }
  } else {
    pc.rect(0, 26, 320, 18, night ? P.slate : P.stone);
    for (let x = 0; x < 320; x += 26) { pc.poly([[x, 30], [x + 14, 14 + (x % 7)], [x + 28, 30]], night ? P.deep : P.stoneL); }
    pc.speckle(0, 26, 320, 18, P.slate, 0.15);
    for (let x = 8; x < 320; x += 46) pine(pc, x, 28, 12);
  }
  return pc;
}

export function drawGround(terrain, night) {
  const pc = new PixelCanvas(320, 40, 13);
  const grass = night ? P.grassD : P.grass;
  pc.rect(0, 0, 320, 40, grass);
  pc.dither(0, 0, 320, 40, night ? P.grass : P.grassL, 0.12);
  // 길
  const road = terrain === 'mountain' ? P.stone : P.earth;
  pc.rect(0, 8, 320, 12, night ? P.earthD : road);
  pc.dither(0, 8, 320, 2, grass, 0.5);
  pc.dither(0, 18, 320, 2, grass, 0.5);
  pc.speckle(0, 9, 320, 10, night ? P.earth : P.earthL, 0.06);
  if (terrain === 'mountain') pc.speckle(0, 9, 320, 10, P.stoneL, 0.08);
  // 풀 포기
  for (let x = 3; x < 320; x += 13) {
    pc.vline(x, 22 + (x % 4), 3, night ? P.grassD : P.grassD);
    pc.vline(x + 1, 21 + (x % 4), 4, night ? P.grass : P.leaf);
  }
  pc.rect(0, 30, 320, 10, P.ink);
  pc.dither(0, 28, 320, 2, P.ink, 0.5);
  return pc;
}

// ── 장소 삽화 (320x104) ─────────────────────────
export const LOC_H = 104;

export function drawLocation(id) {
  const pc = new PixelCanvas(320, LOC_H, 17);
  const sky = (cols) => pc.bands(0, 0, 320, 56, cols);
  if (id === 'village') {
    sky([P.sky, P.skyL, P.skyL, P.paper]);
    cloud(pc, 70, 12, 12); cloud(pc, 240, 18, 9);
    mountain(pc, 60, 56, 120, 26, P.stoneL, P.stone); mountain(pc, 250, 56, 150, 30, P.stoneL, P.stone, P.white);
    pc.rect(0, 56, 320, 48, P.grass); pc.dither(0, 56, 320, 48, P.grassL, 0.2);
    pc.rect(0, 80, 320, 10, P.earth); pc.speckle(0, 80, 320, 10, P.earthL, 0.08);
    house(pc, 24, 62, 30, 18, P.slate, P.paperD, { window: P.woodD });
    house(pc, 200, 60, 34, 20, P.slate, P.paperD, { window: P.woodD });
    // 공방 (가운데, 굴뚝)
    house(pc, 110, 54, 60, 26, P.woodD, P.paperD, {});
    pc.rect(152, 26, 6, 18, P.stone); pc.rect(151, 25, 8, 2, P.slate);
    pc.rect(124, 64, 10, 8, P.orange); pc.dither(124, 64, 10, 8, P.yellow, 0.3); // 화덕 불빛 창
    pc.rect(272, 66, 12, 12, P.stone); pc.rect(271, 64, 14, 2, P.woodD); pc.rect(275, 60, 2, 6, P.woodD); // 우물
    for (let x = 0; x < 320; x += 40) cedar(pc, x + 5, 58, 12);
    pc.rect(0, 90, 320, 14, P.grassD); pc.dither(0, 88, 320, 2, P.grassD, 0.5);
  } else if (id === 'inn') {
    sky([P.dusk, P.dusk, P.paper, P.paperD]);
    mountain(pc, 90, 56, 160, 26, P.stone, P.slate); mountain(pc, 260, 56, 140, 22, P.stone, P.slate);
    pc.rect(0, 56, 320, 48, P.grass); pc.dither(0, 56, 320, 48, P.grassL, 0.15);
    // 세 갈래 길
    pc.poly([[130, 104], [190, 104], [168, 66], [152, 66]], P.earth);
    pc.poly([[152, 66], [168, 66], [60, 58], [40, 60]], P.earth);
    pc.poly([[152, 66], [168, 66], [300, 58], [282, 56]], P.earth);
    // 찻집
    house(pc, 180, 48, 70, 28, P.slate, P.paper, { window: P.yellow });
    pc.rect(186, 62, 58, 6, P.indigo); for (let x = 188; x < 244; x += 8) pc.vline(x, 62, 6, P.indigoL); // 노렌
    pc.rect(186, 76, 30, 3, P.red); pc.rect(186, 79, 2, 6, P.woodD); pc.rect(214, 79, 2, 6, P.woodD); // 평상
    pc.rect(178, 50, 3, 6, P.woodD);
    // 이정표
    pc.rect(120, 60, 2, 20, P.woodD); pc.rect(112, 60, 18, 4, P.woodL); pc.rect(116, 66, 14, 3, P.woodL);
    for (let x = 0; x < 120; x += 20) cedar(pc, x + 8, 64, 14);
  } else if (id === 'forest') {
    sky([P.skyL, P.skyL, P.paper, P.paper]);
    pc.rect(0, 40, 320, 64, P.grassD);
    for (let x = -4; x < 330; x += 9) cedar(pc, x, 70 + (x % 5), 40 + ((x * 13) % 16), P.grassD, P.grass, P.grassL);
    pc.rect(0, 74, 320, 30, P.earthD); pc.dither(0, 72, 320, 3, P.earthD, 0.5); pc.speckle(0, 74, 320, 30, P.earth, 0.15);
    // 숯가마 (흙 돔)
    pc.ellipse(160, 80, 34, 16, P.earth); pc.ellipse(158, 77, 28, 11, P.earthL); pc.dither(132, 70, 60, 10, P.earth, 0.3);
    pc.rect(150, 82, 14, 12, P.ink); pc.rect(152, 86, 10, 8, P.red); pc.dither(152, 86, 10, 8, P.orange, 0.5);
    pc.rect(186, 62, 4, 10, P.earthD);
    // 숯 더미
    for (let k = 0; k < 12; k++) pc.rect(220 + (k % 6) * 5, 86 - Math.floor(k / 6) * 3, 4, 3, k % 2 ? P.ink : P.night);
    pc.rect(60, 84, 22, 3, P.woodL); pc.rect(62, 81, 18, 3, P.wood); // 장작
  } else if (id === 'river') {
    sky([P.sky, P.skyL, P.skyL, P.paper]);
    cloud(pc, 100, 14, 12);
    mountain(pc, 40, 50, 120, 30, P.stoneL, P.stone); mountain(pc, 230, 50, 180, 34, P.stoneL, P.stone, P.white);
    pc.rect(0, 46, 320, 10, P.grass);
    for (let x = 0; x < 320; x += 30) cedar(pc, x + 10, 52, 10);
    pc.rect(0, 56, 320, 30, P.water); pc.dither(0, 56, 320, 30, P.waterD, 0.15);
    for (let k = 0; k < 40; k++) pc.hline((k * 53) % 320, 58 + (k * 7) % 26, 5, P.waterL);
    pc.rect(0, 84, 320, 20, P.sand); pc.dither(0, 82, 320, 3, P.sand, 0.5);
    pc.speckle(0, 84, 320, 20, P.ink, 0.05); pc.speckle(0, 84, 320, 20, P.earthL, 0.05);
    // 홈통(사철 고르는 나무 틀)
    pc.poly([[90, 76], [210, 84], [210, 88], [90, 80]], P.woodL);
    pc.line(90, 80, 210, 88, P.woodD);
    pc.speckle(100, 78, 100, 6, P.ink, 0.25);
    pc.rect(208, 86, 3, 12, P.woodD); pc.rect(92, 80, 3, 14, P.woodD);
    pc.rect(240, 88, 18, 8, P.woodL); pc.rect(240, 88, 18, 2, P.wood); // 바구니
    pc.speckle(242, 90, 14, 5, P.ink, 0.6);
  } else if (id === 'castle') {
    sky([P.skyL, P.skyL, P.paper, P.paperD]);
    cloud(pc, 60, 12, 10); cloud(pc, 150, 20, 7);
    mountain(pc, 70, 58, 170, 22, P.stoneL, P.stone);
    // 성이 선 언덕과 돌담
    pc.ellipse(256, 60, 70, 14, P.grassD); pc.dither(186, 46, 140, 14, P.grass, 0.3);
    pc.poly([[222, 54], [292, 54], [284, 40], [230, 40]], P.stone); pc.speckle(222, 40, 70, 14, P.slate, 0.25);
    for (let x = 226; x < 290; x += 6) pc.vline(x, 41, 13, P.stoneL);
    castleKeep(pc, 257, 40, 1);
    pc.rect(0, 56, 320, 48, P.grass); pc.dither(0, 56, 320, 48, P.grassL, 0.12);
    // 상가 거리
    pc.rect(0, 80, 320, 12, P.earth); pc.speckle(0, 80, 320, 12, P.earthL, 0.08); pc.dither(0, 79, 320, 2, P.earth, 0.5);
    house(pc, 8, 62, 40, 18, P.slate, P.paperD, { window: P.woodD });
    house(pc, 56, 60, 52, 20, P.ink, P.paper, { door: false });          // 도검상
    pc.rect(60, 68, 44, 6, P.indigo); for (let x = 62; x < 104; x += 7) pc.vline(x, 68, 6, P.indigoL); // 노렌
    pc.rect(74, 52, 16, 6, P.woodD); pc.rect(75, 53, 14, 4, P.paperD); pc.rect(79, 54, 6, 2, P.ink); // 간판
    // 칼 진열대
    pc.rect(60, 76, 2, 6, P.woodD); pc.rect(102, 76, 2, 6, P.woodD); pc.hline(60, 76, 44, P.woodL); pc.hline(60, 79, 44, P.woodL);
    for (const yy of [75, 78]) { pc.line(64, yy, 99, yy - 1, P.ink); pc.line(64, yy - 1, 70, yy - 1, P.red); }
    house(pc, 120, 62, 36, 18, P.slate, P.paperD, { window: P.woodD });   // 칼집장이
    pc.rect(126, 74, 22, 2, P.ink); pc.rect(126, 72, 2, 2, P.ink);
    // 연마소: 숫돌 받침
    pc.rect(166, 74, 20, 4, P.woodL); pc.rect(168, 72, 8, 2, P.stoneL); pc.rect(178, 72, 6, 2, P.stone);
    pc.rect(167, 78, 2, 4, P.woodD); pc.rect(183, 78, 2, 4, P.woodD);
    pc.ellipse(196, 76, 5, 3, P.waterD); pc.ellipse(196, 75, 4, 2, P.water); // 물통
    // 등롱 기둥
    for (const x of [112, 160]) { pc.rect(x, 64, 2, 16, P.woodD); pc.rect(x - 2, 60, 6, 5, P.redL); pc.hline(x - 2, 60, 6, P.ink); }
    pc.rect(0, 92, 320, 12, P.grassD); pc.dither(0, 90, 320, 2, P.grassD, 0.5);
    for (let x = 206; x < 320; x += 36) cedar(pc, x + 8, 92, 12);
  } else if (id === 'mountain') {
    sky([P.skyL, P.skyL, P.paper, P.mist]);
    mountain(pc, 160, 70, 360, 64, P.stone, P.slate, P.white);
    mountain(pc, 40, 70, 120, 40, P.stoneL, P.stone);
    pc.rect(0, 70, 320, 34, P.stone); pc.speckle(0, 70, 320, 34, P.slate, 0.2); pc.speckle(0, 70, 320, 34, P.stoneL, 0.08);
    // 광맥 (녹슨 빛 띠)
    pc.poly([[90, 60], [230, 52], [236, 58], [96, 68]], P.earth);
    pc.speckle(92, 54, 144, 14, P.orange, 0.2); pc.speckle(92, 54, 144, 14, P.redL, 0.06);
    // 갱도 입구
    pc.rect(150, 66, 26, 22, P.ink); pc.rect(148, 64, 30, 3, P.woodL); pc.rect(148, 64, 3, 24, P.woodL); pc.rect(175, 64, 3, 24, P.woodL);
    // 광석 수레
    pc.rect(196, 82, 22, 8, P.woodL); pc.rect(196, 82, 22, 2, P.wood); pc.speckle(197, 79, 20, 4, P.earthL, 0.6);
    pc.circle(201, 91, 2, P.ink); pc.circle(213, 91, 2, P.ink);
    for (let x = 0; x < 320; x += 70) pine(pc, x + 20, 72, 14);
  }
  return pc;
}

// ── 공방 (320x169, 화면 y=11부터) ──────────────────
export function drawWorkshop() {
  const pc = new PixelCanvas(320, 169, 23);
  // 뒷벽 (나무 판자)
  pc.fill(P.woodD);
  for (let x = 0; x < 320; x += 12) { pc.vline(x, 0, 120, P.ink); pc.dither(x + 1, 0, 11, 120, P.wood, 0.12); }
  pc.rect(0, 0, 320, 3, P.ink);
  // 창 (빛)
  pc.rect(234, 34, 40, 24, P.ink); pc.rect(236, 36, 36, 20, P.deep);
  for (let x = 236; x < 272; x += 6) pc.vline(x, 36, 20, P.woodD);
  // 공구 걸이
  pc.rect(110, 18, 70, 3, P.woodL);
  for (let i = 0; i < 6; i++) { const x = 116 + i * 11; pc.vline(x, 21, 14 + (i % 3) * 3, P.steelD); pc.rect(x - 1, 33 + (i % 3) * 3, 3, 3, P.steel); }
  // 시메나와 (금줄)
  for (let x = 196; x < 320; x++) pc.px(x, 16 + Math.round(Math.sin(x / 16) * 2), P.strawL);
  for (let x = 204; x < 320; x += 24) { pc.rect(x, 18, 3, 6, P.white); pc.rect(x + 1, 24, 2, 3, P.white); }
  // 바닥 (흙바닥)
  pc.rect(0, 104, 320, 65, P.earthD);
  pc.dither(0, 100, 320, 4, P.earthD, 0.5);
  pc.speckle(0, 104, 320, 65, P.earth, 0.1);
  pc.speckle(0, 104, 320, 65, P.ink, 0.04);
  return pc;
}

// 화덕 (가로 74 x 세로 80): 흙벽 화덕, 앞쪽 불구멍
export function drawFurnace() {
  const pc = new PixelCanvas(74, 80, 31);
  pc.rect(6, 6, 62, 74, P.earth);
  pc.dither(6, 6, 62, 74, P.earthL, 0.18);
  pc.speckle(6, 6, 62, 74, P.earthD, 0.12);
  pc.rect(4, 0, 66, 8, P.earthD); pc.rect(4, 0, 66, 2, P.earthL);
  pc.rect(6, 76, 62, 4, P.earthD);
  // 불구멍(투명하게 비워 둔다 → 뒤의 불빛 사각형이 보인다)
  pc.ctx.clearRect(20, 34, 34, 26);
  pc.rect(18, 32, 38, 2, P.earthD); pc.rect(18, 60, 38, 2, P.earthD);
  pc.rect(18, 32, 2, 30, P.earthD); pc.rect(54, 32, 2, 30, P.earthD);
  return pc;
}

// 풀무 (상자형)
export function drawBellows() {
  const pc = new PixelCanvas(30, 26, 37);
  pc.rect(0, 6, 30, 20, P.wood); pc.rect(0, 6, 30, 2, P.woodL); pc.rect(0, 24, 30, 2, P.woodD);
  for (let x = 4; x < 30; x += 8) pc.vline(x, 8, 16, P.woodD);
  pc.rect(28, 12, 2, 6, P.steelD);
  return pc;
}

export function drawBellowsHandle() {
  const pc = new PixelCanvas(20, 4, 38);
  pc.rect(0, 1, 18, 2, P.woodL); pc.rect(16, 0, 4, 4, P.woodD);
  return pc;
}

// 모루 (64x34)
export function drawAnvil() {
  const pc = new PixelCanvas(64, 34, 41);
  pc.rect(6, 0, 52, 8, P.steel); pc.rect(6, 0, 52, 2, P.steelL); pc.hline(8, 0, 48, P.steelH);
  pc.poly([[0, 1], [6, 0], [6, 6], [2, 4]], P.steel);
  pc.rect(16, 8, 32, 6, P.steelD);
  pc.rect(20, 14, 24, 8, P.steelD); pc.rect(20, 14, 2, 8, P.steel);
  pc.rect(10, 22, 44, 12, P.woodL); pc.rect(10, 22, 44, 2, P.strawL); pc.dither(10, 24, 44, 10, P.wood, 0.4);
  return pc;
}

// 물통 (56x30)
export function drawTub() {
  const pc = new PixelCanvas(56, 30, 43);
  pc.rect(2, 6, 52, 24, P.woodL);
  for (let x = 4; x < 54; x += 6) pc.vline(x, 6, 24, P.wood);
  pc.rect(2, 10, 52, 2, P.steelD); pc.rect(2, 24, 52, 2, P.steelD);
  pc.ellipse(28, 6, 26, 4, P.woodD); pc.ellipse(28, 6, 23, 3, P.waterD); pc.hline(18, 5, 12, P.waterL);
  return pc;
}

// 점토 통 (20x14)
export function drawClayPot() {
  const pc = new PixelCanvas(22, 16, 47);
  pc.rect(2, 4, 18, 12, P.woodL);
  for (let x = 4; x < 20; x += 5) pc.vline(x, 4, 12, P.wood);
  pc.hline(2, 8, 18, P.steelD); pc.hline(2, 14, 18, P.steelD);
  pc.ellipse(11, 4, 9, 2, P.stone); pc.ellipse(11, 3, 7, 1, P.stoneL);
  pc.rect(14, 0, 2, 4, P.woodD); // 주걱
  return pc;
}

// 강괴(강재) 덩어리: 흰색 계열로 그리고 발열색을 곱해서 쓴다 (16x8)
export function drawBillet(w = 16, h = 7) {
  const pc = new PixelCanvas(w, h, 53);
  pc.rect(0, 1, w, h - 1, '#d8d8d8');
  pc.rect(1, 0, w - 2, 1, '#e8e8e8');
  pc.hline(1, 1, w - 2, '#ffffff');
  pc.rect(0, h - 1, w, 1, '#a0a0a0');
  pc.speckle(0, 1, w, h - 2, '#bcbcbc', 0.2);
  return pc;
}

// 산화물 얼룩 (강괴 위에 겹침, 투명도 = 산화물 양)
export function drawScale(w = 16, h = 7) {
  const pc = new PixelCanvas(w, h, 59);
  pc.speckle(0, 0, w, h, P.ink, 0.45);
  pc.speckle(0, 0, w, h, P.earthD, 0.3);
  return pc;
}

// ── 도신 (구간 진행도에 따라 모양이 잡힌다) ─────────────
// progress: 0~1.4 배열 (칼끝 → 밑동). 진행이 낮으면 두꺼운 막대, 1에 가까울수록 얇고 휜 도신.
// thickScale로 결과 화면처럼 크게 그릴 수 있다.
export function drawBladeShape(pc, progress, opts = {}) {
  const {
    x0 = 2, y0 = 4, len = 150, highlight = -1, base = '#d0d0d0', edge = '#ffffff', spine = '#9a9a9a',
    clay = false, hamon = null, curve = 3, thickScale = 1,
  } = opts;
  pc.clear();
  const n = progress.length;
  const segLen = len / n;
  const maxT = Math.round(14 * thickScale);
  const geom = (u) => {
    const i = Math.min(n - 1, Math.floor(u * n));
    const p = Math.min(1.4, progress[i]);
    const t = Math.min(1, p);
    const finished = (5 + 3 * u) * thickScale;
    const thick = Math.max(2, Math.round(maxT + (finished - maxT) * t) - (p > 1.15 ? Math.round(2 * thickScale) : 0));
    const bend = Math.round(Math.sin(u * Math.PI) * curve * t);
    // 일본도처럼 가운데가 아래로 처지는 휨(날 쪽이 볼록): 칼끝과 자루 쪽이 위로 올라간다
    const top = y0 + Math.round(((maxT - thick) / 2) * (1 - t)) + bend;
    return { i, t, thick, top };
  };
  for (let gx = x0; gx < x0 + len; gx++) {
    const u = (gx - x0) / len;
    const { t, thick, top } = geom(u);
    // 칼끝(키사키): 날 선이 등 쪽으로 올라가 만난다
    const tipK = u < 0.07 ? Math.sqrt(u / 0.07) : 1;
    const eff = Math.max(1, Math.round(thick * (1 - t * (1 - tipK))));
    const yBot = top + eff;
    pc.vline(gx, top, eff, base);
    pc.px(gx, top, spine);
    if (eff > 2) pc.px(gx, yBot - 1, edge);
    if (clay) {
      const ch = Math.max(1, Math.round(eff * 0.6));
      pc.vline(gx, top, ch, P.stoneL);
      if (gx % 3 === 0) pc.px(gx, top + ch, P.stoneL);
    }
    if (hamon && eff > 3) {
      const hy = yBot - 1 - Math.round(eff * 0.3 + (Math.sin(gx * 0.55) + 1) * hamon.wave);
      pc.vline(gx, hy, Math.max(1, yBot - 1 - hy), hamon.color);
      pc.px(gx, yBot - 1, P.white);
    }
  }
  const g = geom(0.999);
  const slope = (Math.PI * curve * g.t) / len;   // u=1에서 휨 곡선의 기울기(px/px)
  if (opts.mount) {
    // 카타나: 자루 대신 코등이와 감은 손잡이를 그린다
    drawMount(pc, { x: x0 + len, top: g.top, thick: g.thick, slope, scale: thickScale }, opts.mount);
  } else {
    // 자루(나카고): 하바키 없이 도신의 휨을 이어 위로 올라가며 끝으로 갈수록 가늘어진다
    const tangLen = Math.round(28 * thickScale);
    const th0 = Math.max(3, Math.round(g.thick * 0.6));
    const holeK = Math.round(tangLen * 0.55);
    for (let k = 0; k < tangLen; k++) {
      const gx = x0 + len + k;
      const tt = g.top - Math.round(k * slope);
      const th = Math.max(2, Math.round(th0 * (1 - 0.35 * (k / tangLen))));
      pc.vline(gx, tt, th, P.steelD);
      pc.px(gx, tt + th - 1, P.ink);
      if (k === holeK || k === holeK + 1) pc.px(gx, tt + Math.floor(th / 2), P.ink);
    }
  }
  if (highlight >= 0) {
    const sx = x0 + Math.round(highlight * segLen);
    pc.rect(sx, Math.max(0, y0 - 3), Math.ceil(segLen) - 1, 1, P.yellow);
    pc.rect(sx, y0 + maxT + 2, Math.ceil(segLen) - 1, 1, P.yellow);
  }
}

// 코시라에를 맞춘 손잡이 쪽: 코등이(쓰바) + 끈을 감은 손잡이(쓰카) + 끝 마개(가시라).
// plain: 무명 끈(갈색)과 쇠 코등이 / fine: 비단 끈(남색)과 테두리를 낸 코등이
export const MOUNT_LEN = 34;   // thickScale 1 기준 손잡이 쪽 길이(px)
function drawMount(pc, m, kosh) {
  const fine = kosh === 'fine';
  const wrap = fine ? P.indigo : P.wood;
  const wrapL = fine ? P.indigoL : P.woodL;
  const skin = fine ? P.white : P.paperD;
  const th = Math.max(5, Math.round(m.thick * 0.8 + 2 * m.scale));
  const cy0 = m.top + m.thick / 2;
  // 코등이: 세로로 긴 판
  const tH = Math.round(m.thick + 6 * m.scale);
  const tW = Math.max(2, Math.round(2 * m.scale));
  const ty = Math.round(cy0 - tH / 2);
  pc.rect(m.x, ty + 1, tW, tH - 2, P.steelD);
  pc.vline(m.x, ty + 1, tH - 2, fine ? P.steelL : P.steel);
  pc.px(m.x + tW - 1, ty, P.steelD); pc.px(m.x + tW - 1, ty + tH - 1, P.steelD);
  // 손잡이: 휨을 이어 위로, 마름모 무늬
  const L = Math.round((MOUNT_LEN - 6) * m.scale);
  for (let k = 0; k < L; k++) {
    const gx = m.x + tW + k;
    const cy = cy0 - k * m.slope;
    const top = Math.round(cy - th / 2);
    pc.vline(gx, top, th, wrap);
    pc.px(gx, top, P.ink); pc.px(gx, top + th - 1, P.ink);
    const w = [0, 1, 2, 2, 1, 0][k % 6] * Math.max(1, Math.round(m.scale * 0.8));
    if (w > 0 && k > 1 && k < L - 2) pc.rect(gx, Math.round(cy) - w, 1, w * 2, skin);
    else if (k % 6 === 0) pc.vline(gx, top + 1, th - 2, wrapL);
  }
  // 끝 마개
  const ex = m.x + tW + L;
  const ecy = cy0 - L * m.slope;
  pc.rect(ex, Math.round(ecy - th / 2), Math.max(2, Math.round(2 * m.scale)), th, P.steelD);
}

// 도신 기록을 그대로 그린다 (결과 화면·소지품·코시라에 그림이 함께 쓴다). opts.mount: 코시라에 id
export function drawRecordBlade(pc, r, opts = {}) {
  const progress = r.shaping.progress.map((p) => p / 100);
  const warp = r.soundness.label === '휨';
  const hard = r.hardening.value / 100;
  drawBladeShape(pc, progress, {
    x0: 4, y0: 5, len: 250, thickScale: 1.6, base: P.steel, edge: P.steelH, spine: P.steelD, curve: warp ? 7 : 3,
    hamon: hard > 0.3 ? { color: r.hardening.localUneven ? P.stoneL : P.mist, wave: r.hardening.localUneven ? 2.5 : 1.2 } : null,
    ...opts,
  });
  if (r.soundness.label === '균열' || r.soundness.label === '파단') {
    const sc = (opts.len || 250) / 250;
    const y0 = (opts.y0 ?? 5) + Math.round(15 * (opts.thickScale ?? 1.6) / 1.6);
    for (const cx of [70, 140, 190]) {
      let y = y0; let x = Math.round((opts.x0 ?? 4) + (cx - 4) * sc);
      for (let k = 0; k < 6; k++) { pc.px(x, y, P.ink); y -= 1; x += k % 2 ? 1 : -1; }
    }
  }
}

// 소지품·코시라에 화면용 작은 그림 (DOM <img>로 쓴다)
export function bladeThumb(r, mount = null) {
  const pc = new PixelCanvas(150 + 4 + (mount ? MOUNT_LEN : 26), 22, 5);
  drawRecordBlade(pc, r, { x0: 2, y0: 3, len: 150, thickScale: 0.95, mount });
  return pc;
}

// ── 도장 (전투 화면 배경, 320x180) ─────────────────
export function drawDojo() {
  const pc = new PixelCanvas(320, 180, 29);
  pc.fill(P.wood);
  for (let x = 0; x < 320; x += 16) { pc.vline(x, 0, 104, P.woodD); pc.dither(x + 1, 0, 15, 104, P.woodL, 0.06); }
  pc.rect(0, 20, 320, 3, P.woodD); pc.rect(0, 70, 320, 3, P.woodD);
  // 족자와 이름판
  pc.rect(146, 26, 28, 40, P.paper); pc.rect(146, 26, 28, 2, P.woodD); pc.rect(146, 64, 28, 2, P.woodD);
  pc.rect(158, 32, 4, 26, P.ink); pc.rect(154, 40, 12, 3, P.ink);
  for (let i = 0; i < 8; i++) { pc.rect(20 + i * 14, 30, 10, 24, P.paperD); pc.rect(22 + i * 14, 34, 6, 2, P.ink); pc.rect(24 + i * 14, 38, 2, 12, P.ink); }
  // 목검 걸이
  pc.rect(220, 34, 70, 3, P.woodD); for (let i = 0; i < 5; i++) pc.line(226 + i * 13, 30, 232 + i * 13, 58, P.woodL);
  // 마루
  pc.rect(0, 96, 320, 84, P.woodL); for (let y = 96; y < 180; y += 6) pc.hline(0, y, 320, P.wood);
  pc.dither(0, 96, 320, 84, P.straw, 0.05); pc.rect(0, 94, 320, 2, P.woodD);
  return pc;
}

// ── 결과 화면 배경 ─────────────────────────────
export function drawResultBg() {
  const pc = new PixelCanvas(320, 180, 61);
  pc.fill(P.night);
  for (let y = 0; y < 180; y += 10) pc.hline(0, y, 320, P.deep);
  // 칼 받침천
  pc.rect(0, 22, 320, 54, P.indigo);
  pc.dither(0, 22, 320, 54, P.indigoL, 0.06);
  pc.hline(0, 22, 320, P.indigoL); pc.hline(0, 75, 320, P.ink);
  return pc;
}

// ── 타이틀 배경 (밤의 대장간) ─────────────────────
export function drawTitle() {
  const pc = new PixelCanvas(320, 180, 71);
  pc.bands(0, 0, 320, 120, [P.night, P.night, P.deep, P.deep, P.slate]);
  pc.speckle(0, 0, 320, 70, P.white, 0.01);
  pc.circle(262, 30, 9, P.paper); pc.circle(266, 28, 8, P.night);
  mountain(pc, 60, 120, 200, 50, P.slate, P.deep); mountain(pc, 240, 120, 240, 60, P.slate, P.deep);
  pc.rect(0, 118, 320, 62, P.grassD); pc.dither(0, 116, 320, 3, P.grassD, 0.5);
  for (let x = 0; x < 320; x += 13) cedar(pc, x, 124 + (x % 4), 20 + (x % 9), P.ink, P.grassD, P.grass);
  // 대장간 건물
  house(pc, 112, 108, 96, 40, P.ink, P.woodD, { door: false });
  pc.rect(190, 52, 8, 30, P.slate); pc.rect(188, 50, 12, 3, P.stone);
  pc.rect(140, 122, 40, 26, P.ink);
  pc.rect(144, 126, 32, 22, P.red); pc.dither(144, 126, 32, 22, P.orange, 0.45); pc.dither(150, 134, 20, 14, P.yellow, 0.35);
  pc.rect(0, 148, 320, 32, P.ink); pc.dither(0, 146, 320, 3, P.ink, 0.5);
  return pc;
}
