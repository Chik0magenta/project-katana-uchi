// 픽셀 드로잉 도우미. 2D 캔버스에 정수 좌표로 그리고 three.js 텍스처(최근접 필터)로 바꾼다.
// Godot 이식: 이 그림들은 PNG로 내보내거나(tools/export 참고) Image.set_pixel로 같은 방식으로 그린다.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export class PixelCanvas {
  constructor(w, h, seed = 7) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.rng = new Rng(seed);
    this.texture = null;
  }

  clear() { this.ctx.clearRect(0, 0, this.w, this.h); return this; }
  fill(c) { return this.rect(0, 0, this.w, this.h, c); }
  rect(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return this; }
  px(x, y, c) { return this.rect(x, y, 1, 1, c); }
  hline(x, y, w, c) { return this.rect(x, y, w, 1, c); }
  vline(x, y, h, c) { return this.rect(x, y, 1, h, c); }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  thickLine(x0, y0, x1, y1, w, c) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps; const y = y0 + (y1 - y0) * i / steps;
      this.rect(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c);
    }
    return this;
  }

  circle(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
      this.hline(cx - half, cy + y, half * 2 + 1, c);
    }
    return this;
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))));
      this.hline(cx - half, cy + y, half * 2 + 1, c);
    }
    return this;
  }

  // 채운 다각형 (스캔라인)
  poly(pts, c) {
    const ys = pts.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys)); const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i]; const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.hline(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]) + 1, c);
    }
    return this;
  }

  // 정해진 밀도(0~1)로 바이어 디더링
  dither(x, y, w, h, c, density) {
    const t = density * 16;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (BAYER[(y + j) & 3][(x + i) & 3] < t) this.px(x + i, y + j, c);
    }
    return this;
  }

  speckle(x, y, w, h, c, prob) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.rng.next() < prob) this.px(x + i, y + j, c);
    return this;
  }

  // 위→아래 계단식 그라데이션 (색 배열을 띠로 나누고 경계를 디더링)
  bands(x, y, w, h, colors) {
    const n = colors.length; const bh = h / n;
    for (let i = 0; i < n; i++) {
      this.rect(x, y + Math.round(i * bh), w, Math.ceil(bh) + 1, colors[i]);
      if (i > 0) this.dither(x, y + Math.round(i * bh) - 2, w, 2, colors[i], 0.5);
    }
    return this;
  }

  tex() {
    if (!this.texture) {
      const t = new THREE.CanvasTexture(this.canvas);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      this.texture = t;
    } else this.texture.needsUpdate = true;
    return this.texture;
  }

  update() { if (this.texture) this.texture.needsUpdate = true; }
}

export function pixelCanvas(w, h, draw, seed) {
  const pc = new PixelCanvas(w, h, seed);
  draw(pc);
  return pc;
}
