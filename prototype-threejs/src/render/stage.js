// three.js 픽셀 무대. 320x180 버퍼에 그리고 CSS로 4배 확대(pixelated)해 번짐 없이 보인다.
// 좌표계: 화면 왼쪽 위가 (0,0), 아래로 갈수록 y 증가 (픽셀 그림 좌표와 같다).
// Godot 이식: SubViewport(320x180) + TextureRect(정수 배율), 또는 project 설정 viewport 320x180 + stretch 'viewport'.
import * as THREE from 'three';
import { Particles } from './fx.js';

export const W = 320;
export const H = 180;
export const SCALE = 4;

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(0, W, 0, -H, -100, 100);
    this.scene = new THREE.Scene();
    this.view = null;
    this.shake = 0;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.listeners = [];
    this.canvas = canvas;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setView(view) {
    if (this.view) this.view.dispose?.();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000');
    this.view = view;
    this.fx = new Particles(this.scene, 900);
    view.build(this);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    for (const fn of this.listeners) fn(dt);
    if (this.view) this.view.update?.(dt, this.time);
    this.fx?.update(dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 10);
      const s = Math.round(this.shake * ((this.time * 60) % 2 < 1 ? 1 : -1));
      this.camera.position.set(s, Math.round(this.shake * 0.5) * ((this.time * 45) % 2 < 1 ? 1 : -1), 0);
    } else this.camera.position.set(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // 화면 좌표(clientX/Y) → 픽셀 무대 좌표
  toPixel(ev) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  // 텍스처 한 장을 왼쪽 위 기준 (x,y)에 놓는 평면
  sprite(texture, w, h, x = 0, y = 0, z = 0, opts = {}) {
    const mat = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      color: opts.color ?? 0xffffff, opacity: opts.opacity ?? 1,
    });
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(geo, mat);
    m.userData.w = w; m.userData.h = h;
    m.renderOrder = z;
    place(m, x, y);
    this.scene.add(m);
    return m;
  }

  // 단색 사각형 (빛·그림자 등)
  quad(w, h, x, y, z, color, opacity = 1, additive = false) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthTest: false, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.userData.w = w; m.userData.h = h;
    m.renderOrder = z;
    place(m, x, y);
    this.scene.add(m);
    return m;
  }

  addShake(amount) { this.shake = Math.max(this.shake, amount); }

  snapshot() { return this.canvas.toDataURL('image/png'); }
}

// 왼쪽 위 기준 배치. 픽셀 경계에 맞춰 반올림한다.
export function place(m, x, y) {
  const w = m.userData.w * Math.abs(m.scale.x); const h = m.userData.h * Math.abs(m.scale.y);
  m.userData.x = x; m.userData.y = y;
  m.position.x = Math.round(x) + w / 2;
  m.position.y = -(Math.round(y) + h / 2);
}

// 아래쪽 가운데(발밑) 기준 배치
export function placeFoot(m, x, y) {
  const w = m.userData.w; const h = m.userData.h;
  m.position.x = Math.round(x - w / 2) + w / 2;
  m.position.y = -(Math.round(y - h) + h / 2);
}
