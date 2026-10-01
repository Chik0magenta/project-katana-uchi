// 픽셀 입자: 불꽃·산화물 조각·증기·비·연기·불티. 1px/2px 점으로 그린다.
// Godot 이식: CPUParticles2D (같은 프리셋 값을 쓰면 된다).
import * as THREE from 'three';
import { hexToRgb } from './palette.js';

const PRESETS = {
  spark: { colors: ['#fff8c0', '#f8d050', '#f08a2a', '#a8282a'], life: [0.25, 0.6], speed: [40, 110], spread: Math.PI * 0.9, angle: -Math.PI / 2, gravity: 160, size: 1 },
  scale: { colors: ['#5a4a40', '#3a2e2a', '#2a2020'], life: [0.5, 0.9], speed: [20, 60], spread: Math.PI * 0.8, angle: -Math.PI / 2, gravity: 200, size: 1 },
  steam: { colors: ['#ffffff', '#e8eef4', '#c8d0dc', '#9aa4b4'], life: [0.9, 1.8], speed: [10, 34], spread: Math.PI * 0.5, angle: -Math.PI / 2, gravity: -18, drag: 1.4, size: 2, alpha: 0.85 },
  smoke: { colors: ['#8a84a0', '#6a6480', '#5a5470'], life: [1.8, 3.2], speed: [4, 9], spread: 0.5, angle: -Math.PI / 2, gravity: -4, drag: 0.3, size: 2, alpha: 0.55, wind: 6 },
  ember: { colors: ['#f8d050', '#f08a2a', '#a8282a'], life: [0.8, 1.6], speed: [8, 22], spread: 0.8, angle: -Math.PI / 2, gravity: -6, size: 1, wind: 3 },
  rain: { colors: ['#e8f0ff', '#c8d8f0'], life: [0.5, 0.7], speed: [150, 180], spread: 0.05, angle: Math.PI * 0.58, gravity: 0, size: 1, alpha: 0.7 },
  splash: { colors: ['#bfe8f0', '#5aa8c8'], life: [0.2, 0.4], speed: [15, 40], spread: Math.PI * 0.7, angle: -Math.PI / 2, gravity: 200, size: 1 },
  firefly: { colors: ['#f8f080', '#c8e060'], life: [2, 4], speed: [2, 6], spread: Math.PI * 2, angle: 0, gravity: 0, size: 1, alpha: 0.9 },
  dust: { colors: ['#c8a878', '#9a7048'], life: [0.3, 0.6], speed: [10, 30], spread: Math.PI * 0.6, angle: -Math.PI / 2, gravity: 60, size: 1 },
  star: { colors: ['#fff8e8', '#c8c4d8'], life: [0.6, 1.2], speed: [0, 2], spread: Math.PI * 2, angle: 0, gravity: 0, size: 1 },
};

class Pool {
  constructor(scene, n, size) {
    this.n = n;
    this.items = [];
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthTest: false, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.renderOrder = 50;
    this.points.frustumCulled = false;
    geo.setDrawRange(0, 0);
    scene.add(this.points);
  }
}

export class Particles {
  constructor(scene, capacity = 800) {
    this.pools = { 1: new Pool(scene, capacity, 1), 2: new Pool(scene, Math.floor(capacity / 2), 2) };
    this.rgbCache = {};
  }

  rgb(hex) { return (this.rgbCache[hex] ||= hexToRgb(hex).map((v) => v / 255)); }

  emit(type, x, y, count = 10, opts = {}) {
    const p = { ...PRESETS[type], ...opts };
    const pool = this.pools[p.size >= 2 ? 2 : 1];
    for (let i = 0; i < count; i++) {
      if (pool.items.length >= pool.n) pool.items.shift();
      const a = p.angle + (Math.random() - 0.5) * p.spread;
      const sp = p.speed[0] + Math.random() * (p.speed[1] - p.speed[0]);
      const life = p.life[0] + Math.random() * (p.life[1] - p.life[0]);
      pool.items.push({
        x: x + (opts.jitterX ? (Math.random() - 0.5) * opts.jitterX : 0),
        y: y + (opts.jitterY ? (Math.random() - 0.5) * opts.jitterY : 0),
        vx: Math.cos(a) * sp + (p.wind || 0), vy: Math.sin(a) * sp,
        g: p.gravity, drag: p.drag || 0, life, max: life, colors: p.colors, alpha: p.alpha ?? 1,
        z: opts.z ?? 0,
      });
    }
  }

  update(dt) {
    for (const pool of Object.values(this.pools)) {
      const items = pool.items;
      let w = 0;
      for (let i = 0; i < items.length; i++) {
        const q = items[i];
        q.life -= dt;
        if (q.life <= 0) continue;
        q.vy += q.g * dt;
        if (q.drag) { q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        items[w++] = q;
      }
      items.length = w;
      for (let i = 0; i < w; i++) {
        const q = items[i];
        const t = 1 - q.life / q.max;
        const ci = Math.min(q.colors.length - 1, Math.floor(t * q.colors.length));
        const c = this.rgb(q.colors[ci]);
        pool.pos[i * 3] = Math.round(q.x) + 0.5;
        pool.pos[i * 3 + 1] = -(Math.round(q.y) + 0.5);
        pool.pos[i * 3 + 2] = 0;
        pool.col[i * 4] = c[0]; pool.col[i * 4 + 1] = c[1]; pool.col[i * 4 + 2] = c[2];
        pool.col[i * 4 + 3] = q.alpha * Math.min(1, q.life / (q.max * 0.35));
      }
      pool.points.geometry.setDrawRange(0, w);
      pool.points.geometry.attributes.position.needsUpdate = true;
      pool.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
