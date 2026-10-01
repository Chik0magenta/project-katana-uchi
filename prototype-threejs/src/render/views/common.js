// 여러 화면이 함께 쓰는 연출 도우미.
import * as THREE from 'three';
import { PixelCanvas } from '../pixel.js';
import { fromGrid } from '../art/sprites.js';

// 디더링한 둥근 빛 (가산 혼합용)
export function glowTexture(r = 24, color = '#ffb050') {
  const pc = new PixelCanvas(r * 2, r * 2);
  for (let i = 4; i >= 1; i--) {
    const rr = Math.round((r * i) / 4);
    const tmp = new PixelCanvas(r * 2, r * 2);
    tmp.circle(r, r, rr - 1, color);
    pc.ctx.globalAlpha = 0.18;
    pc.ctx.drawImage(tmp.canvas, 0, 0);
  }
  pc.ctx.globalAlpha = 1;
  return pc.tex();
}

const cache = new Map();
export function gridTex(grid, flip = false) {
  const key = grid;
  const k2 = flip ? 'f' : 'n';
  if (!cache.has(key)) cache.set(key, {});
  const c = cache.get(key);
  if (!c[k2]) c[k2] = fromGrid(grid, undefined, flip);
  return c[k2];
}

// 간단한 트윈 목록 (시간 기반)
export class Tweens {
  constructor() { this.list = []; }
  add(duration, fn, done) {
    return new Promise((resolve) => {
      this.list.push({ t: 0, d: duration, fn, done: () => { done?.(); resolve(); } });
    });
  }
  wait(d) { return this.add(d, () => {}); }
  update(dt) {
    const keep = [];
    for (const tw of this.list) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.d);
      tw.fn(k);
      if (k >= 1) tw.done(); else keep.push(tw);
    }
    this.list = keep;
  }
  get busy() { return this.list.length > 0; }
}

export function setTexture(mesh, tex) {
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

export function dispose(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export const easeOut = (k) => 1 - (1 - k) * (1 - k);
export const easeIn = (k) => k * k;
export { THREE };
