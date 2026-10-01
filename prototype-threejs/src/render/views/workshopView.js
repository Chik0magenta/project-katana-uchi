// 공방 화면 그림: 화덕·풀무·모루·물통·강재·도신·망치와 공정별 피드백.
// 화면 상태는 매 프레임 규칙 객체(RefineSim 등)를 읽어 맞춘다 → 규칙과 그림이 분리되어 있다.
import * as THREE from 'three';
import { P } from '../palette.js';
import {
  drawWorkshop, drawFurnace, drawBellows, drawBellowsHandle, drawAnvil, drawTub, drawClayPot,
  drawBillet, drawScale, drawBladeShape,
} from '../art/backgrounds.js';
import { PixelCanvas } from '../pixel.js';
import { heatColor } from '../../core/forge/heat.js';
import { Tweens, glowTexture, dispose, easeIn, easeOut } from './common.js';
import { place } from '../stage.js';

const MOUTH = { x: 34, y: 60, w: 34, h: 26 };
const ANVIL = { x: 140, y: 78 };
const BILLET_ANVIL = { x: 164, y: 71 };
const BILLET_FURNACE = { x: 43, y: 74 };
const BLADE = { x: 62, y: 63, w: 184, h: 28, len: 150, x0: 2 };
const TROUGH = { x: 34, y: 104, w: 120, h: 10 };
const WATER = { x: 176, y: 100, w: 132, h: 20 };
const QBLADE = { w: 132, h: 22, len: 100, x0: 2, ts: 0.75 };
const TUB = { x: 236, y: 92 };

function hammerTexture() {
  const pc = new PixelCanvas(28, 12);
  pc.rect(8, 5, 19, 3, P.woodL); pc.hline(8, 5, 19, P.strawL); pc.hline(8, 7, 19, P.wood);
  pc.rect(25, 4, 3, 5, P.woodD);
  pc.rect(0, 0, 9, 12, P.steelD); pc.rect(1, 0, 7, 11, P.steel); pc.rect(1, 0, 2, 11, P.steelL); pc.hline(0, 11, 9, P.ink);
  return pc.tex();
}

function waterTroughTexture() {
  const pc = new PixelCanvas(WATER.w, WATER.h, 83);
  pc.rect(0, 3, WATER.w, WATER.h - 3, P.woodL);
  for (let x = 3; x < WATER.w; x += 9) pc.vline(x, 3, WATER.h - 3, P.wood);
  pc.hline(0, 3, WATER.w, P.strawL); pc.hline(0, WATER.h - 1, WATER.w, P.woodD);
  pc.rect(2, 0, WATER.w - 4, 3, P.waterD); pc.hline(10, 1, 30, P.waterL); pc.hline(70, 1, 24, P.waterL);
  return pc.tex();
}

function troughTexture() {
  const pc = new PixelCanvas(TROUGH.w, TROUGH.h + 6, 81);
  pc.rect(0, 4, TROUGH.w, TROUGH.h + 2, P.earthD); pc.rect(0, 4, TROUGH.w, 1, P.earthL);
  pc.rect(2, 2, TROUGH.w - 4, 4, P.ink);
  for (let x = 2; x < TROUGH.w - 2; x += 3) pc.rect(x, 1 + (x % 2), 3, 3, x % 6 ? P.red : P.orange);
  pc.speckle(2, 1, TROUGH.w - 4, 4, P.yellow, 0.15);
  return pc.tex();
}

export class WorkshopView {
  constructor() {
    this.tweens = new Tweens();
    this.mode = 'select';
    this.busy = false;
    this.fuelVis = 0.3;
    this.airVis = 0;
    this.furnaceT = 700;
    this.hoverSection = -1;
  }

  build(stage) {
    this.stage = stage;
    const st = stage;
    st.scene.background.set(P.ink);
    st.sprite(drawWorkshop().tex(), 320, 169, 0, 11, 0);
    // 화덕
    this.fire = st.quad(MOUTH.w, MOUTH.h, MOUTH.x, MOUTH.y, 1, 0xf08a2a);
    this.flames = [];
    for (let i = 0; i < 6; i++) this.flames.push(st.quad(3, 6, MOUTH.x + 3 + i * 5, MOUTH.y + 14, 1.5, 0xf8d050, 0.9));
    this.coals = st.quad(MOUTH.w, 6, MOUTH.x, MOUTH.y + MOUTH.h - 6, 1.6, 0xa8282a);
    st.sprite(drawFurnace().tex(), 74, 80, 14, 26, 3);
    this.fireGlow = st.sprite(glowTexture(30, '#f08a2a'), 60, 60, MOUTH.x - 13, MOUTH.y - 17, 4, { additive: true, opacity: 0.5 });
    // 풀무
    st.sprite(drawBellows().tex(), 30, 26, 88, 80, 3);
    this.handle = st.sprite(drawBellowsHandle().tex(), 20, 4, 116, 90, 3);
    // 모루·물통·점토
    this.anvil = st.sprite(drawAnvil().tex(), 64, 34, ANVIL.x, ANVIL.y, 3);
    this.tub = st.sprite(drawTub().tex(), 56, 30, TUB.x, TUB.y, 3);
    this.clayPot = st.sprite(drawClayPot().tex(), 22, 16, 208, 106, 3);
    // 담금질용 긴 숯불
    this.trough = st.sprite(troughTexture(), TROUGH.w, TROUGH.h + 6, TROUGH.x, TROUGH.y, 3);
    this.trough.visible = false;
    this.troughGlow = st.sprite(glowTexture(20, '#f08a2a'), TROUGH.w + 24, 34, TROUGH.x - 12, TROUGH.y - 22, 4, { additive: true, opacity: 0 });
    this.water = st.sprite(waterTroughTexture(), WATER.w, WATER.h, WATER.x, WATER.y, 3);
    this.water.visible = false;
    // 담금질용 작은 도신 (긴 숯불과 물통에 들어가는 크기)
    this.qPc = new PixelCanvas(QBLADE.w, QBLADE.h, 93);
    this.qBlade = st.sprite(this.qPc.tex(), QBLADE.w, QBLADE.h, 0, 0, 5);
    this.qBlade.visible = false;

    // 강재 (두 개: 접합 연출용)
    this.billetTex = drawBillet().tex();
    this.scaleTex = drawScale().tex();
    this.billet = st.sprite(this.billetTex, 16, 7, BILLET_FURNACE.x, BILLET_FURNACE.y, 2);
    this.scale = st.sprite(this.scaleTex, 16, 7, BILLET_FURNACE.x, BILLET_FURNACE.y, 2.1);
    this.billet2 = st.sprite(this.billetTex, 12, 5, 0, 0, 5.5);
    this.billet2.visible = false;
    this.billetGlow = st.sprite(glowTexture(16, '#ffffff'), 32, 32, 0, 0, 7, { additive: true, opacity: 0 });

    // 도신
    this.bladePc = new PixelCanvas(BLADE.w, BLADE.h, 91);
    this.blade = st.sprite(this.bladePc.tex(), BLADE.w, BLADE.h, BLADE.x, BLADE.y, 5);
    this.blade.visible = false;
    this.bladeGlow = st.sprite(glowTexture(24, '#ffffff'), BLADE.len + 20, 40, BLADE.x - 8, BLADE.y - 8, 4, { additive: true, opacity: 0 });

    // 망치 (자루 오른쪽 끝을 축으로 회전)
    this.hammerPivot = new THREE.Group();
    const hm = new THREE.Mesh(new THREE.PlaneGeometry(28, 12), new THREE.MeshBasicMaterial({ map: hammerTexture(), transparent: true, depthTest: false }));
    hm.position.set(-12.5, 0, 0); // 피벗이 자루 끝(오른쪽)에 오도록
    hm.renderOrder = 8;
    this.hammerPivot.add(hm);
    st.scene.add(this.hammerPivot);
    this.hammerRest = { x: 194, y: 50, rot: -0.9 };
    this.setHammer(this.hammerRest.x, this.hammerRest.y, this.hammerRest.rot);

    this.flash = st.quad(10, 10, 0, 0, 9, 0xfff8c0, 0, true);
    this.smokeT = 0;
  }

  setHammer(x, y, rot) {
    this.hammerPivot.position.set(x, -y, 0);
    this.hammerPivot.rotation.z = rot;
  }

  // 망치 한 번: (tx, ty) = 타격 지점(머리 아랫면 가운데)
  async strike(tx, ty, { sparks = 8, shake = 1.5, color = null } = {}) {
    const px = tx + 21; const py = ty - 6;
    const up = -1.0;
    const sx = this.hammerPivot.position.x; const sy = -this.hammerPivot.position.y; const sr = this.hammerPivot.rotation.z;
    await this.tweens.add(0.1, (k) => { const e = easeOut(k); this.setHammer(sx + (px - sx) * e, sy + (py - sy) * e, sr + (up - sr) * e); });
    // 내려치기
    await this.tweens.add(0.07, (k) => this.setHammer(px, py, up * (1 - easeIn(k))));
    this.stage.fx.emit('spark', tx, ty, sparks, color ? { colors: color } : {});
    this.stage.addShake(shake);
    place(this.flash, tx - 5, ty - 5);
    this.flash.material.opacity = 0.9;
    this.tweens.add(0.12, (k) => { this.flash.material.opacity = 0.9 * (1 - k); });
    await this.tweens.add(0.1, (k) => this.setHammer(px, py, up * 0.6 * easeOut(k)));
  }

  restHammer() {
    const sx = this.hammerPivot.position.x; const sy = -this.hammerPivot.position.y; const sr = this.hammerPivot.rotation.z;
    const r = this.hammerRest;
    return this.tweens.add(0.18, (k) => { const e = easeOut(k); this.setHammer(sx + (r.x - sx) * e, sy + (r.y - sy) * e, sr + (r.rot - sr) * e); });
  }

  setMode(mode) {
    this.mode = mode;
    const refineLike = mode === 'select' || mode === 'refine';
    this.billet.visible = refineLike || mode === 'assign' || mode === 'join';
    this.scale.visible = mode === 'refine';
    const q = mode === 'quench' || mode === 'done';
    this.blade.visible = ['shape', 'clay'].includes(mode);
    this.qBlade.visible = q;
    this.trough.visible = q; this.water.visible = q;
    this.tub.visible = !q;
    this.anvil.visible = !q;
    this.billet2.visible = false;
    this.billetGlow.material.opacity = 0;
    this.bladeGlow.material.opacity = 0;
    this.troughGlow.material.opacity = mode === 'quench' ? 0.25 : 0;
    if (mode === 'select') { this.setBilletPos(BILLET_ANVIL); this.billet.material.color.setRGB(0.35, 0.36, 0.4); }
    if (mode === 'assign') { this.setBilletPos(BILLET_ANVIL); }
    if (mode === 'shape' || mode === 'clay') place(this.blade, BLADE.x, BLADE.y);
    if (q) place(this.qBlade, TROUGH.x + 4, TROUGH.y - 14);
  }

  setBilletPos(p) {
    place(this.billet, p.x, p.y);
    place(this.scale, p.x, p.y);
    this.billet.renderOrder = p === BILLET_FURNACE ? 2 : 5;
    this.scale.renderOrder = p === BILLET_FURNACE ? 2.1 : 5.1;
  }

  // ── 단련 ──────────────────────────────
  syncRefine(sim) {
    this.furnaceT = sim.furnaceT;
    this.fuelVis = sim.fuel / 100;
    this.airVis = sim.air / 100;
    if (!this.billetMoving) this.setBilletPos(sim.inFurnace ? BILLET_FURNACE : BILLET_ANVIL);
    const c = heatColor(sim.steelT);
    this.billet.material.color.setRGB(c[0], c[1], c[2]);
    this.scale.material.opacity = Math.min(1, sim.scale * 1.2);
    const glow = Math.max(0, Math.min(1, (sim.steelT - 550) / 700));
    this.billetGlow.material.color.setRGB(c[0], c[1], c[2]);
    this.billetGlow.material.opacity = sim.inFurnace ? 0 : glow * 0.7;
    const bp = sim.inFurnace ? BILLET_FURNACE : BILLET_ANVIL;
    place(this.billetGlow, bp.x - 8, bp.y - 13);
  }

  async moveBillet(toFurnace) {
    this.billetMoving = true;
    const a = toFurnace ? BILLET_ANVIL : BILLET_FURNACE; const b = toFurnace ? BILLET_FURNACE : BILLET_ANVIL;
    this.billet.renderOrder = 5; this.scale.renderOrder = 5.1;
    await this.tweens.add(0.35, (k) => {
      const e = easeOut(k);
      const x = a.x + (b.x - a.x) * e; const y = a.y + (b.y - a.y) * e - Math.sin(k * Math.PI) * 14;
      place(this.billet, x, y); place(this.scale, x, y);
    });
    this.billetMoving = false;
  }

  pumpAnim() {
    this.tweens.add(0.3, (k) => place(this.handle, 116 - Math.sin(k * Math.PI) * 10, 90));
    this.stage.fx.emit('ember', MOUTH.x + 17, MOUTH.y + 10, 8, { jitterX: 20 });
  }

  fuelAnim() {
    this.stage.fx.emit('scale', MOUTH.x + 17, MOUTH.y - 2, 10, { colors: [P.ink, P.night], angle: Math.PI / 2, speed: [10, 30], gravity: 120 });
    this.stage.fx.emit('smoke', 50, 26, 4, { jitterX: 10 });
  }

  async knockAnim() {
    const { x, y } = BILLET_ANVIL;
    await this.strike(x + 8, y, { sparks: 3, shake: 1 });
    this.stage.fx.emit('scale', x + 8, y, 18, { jitterX: 14 });
    await this.restHammer();
  }

  async foldAnim(c) {
    const { x, y } = BILLET_ANVIL;
    // 늘이기: 두 번 쳐서 길게
    for (let i = 0; i < 2; i++) {
      await this.strike(x + 8 + (i ? 6 : -4), y, { sparks: 10 });
      const sx = 1 + 0.4 * (i + 1);
      this.billet.scale.x = sx; this.scale.scale.x = sx;
      place(this.billet, x - (16 * sx - 16) / 2, y); place(this.scale, x - (16 * sx - 16) / 2, y);
    }
    // 접기: 반으로 접히며 두꺼워짐
    await this.tweens.add(0.18, (k) => {
      const sx = 1.8 - 0.8 * k; const sy = 1 + 0.4 * Math.sin(k * Math.PI);
      this.billet.scale.set(sx, sy, 1); this.scale.scale.set(sx, sy, 1);
      place(this.billet, x - (16 * sx - 16) / 2, y - (7 * sy - 7)); place(this.scale, x - (16 * sx - 16) / 2, y - (7 * sy - 7));
    });
    this.billet.scale.set(1, 1, 1); this.scale.scale.set(1, 1, 1);
    await this.strike(x + 8, y, { sparks: 14, shake: 2.2, color: c });
    await this.restHammer();
  }

  // ── 접합 (츠쿠리코미) ───────────────────
  async joinAnim(skinColor, coreColor) {
    this.billet.visible = true; this.billet2.visible = true;
    const { x, y } = BILLET_ANVIL;
    this.billet.material.color.setRGB(...skinColor);
    this.billet2.material.color.setRGB(...coreColor);
    this.billet.scale.set(1.4, 1.3, 1);
    place(this.billet, x - 3, y - 2);
    await this.tweens.add(0.6, (k) => place(this.billet2, x + 2 + (1 - easeOut(k)) * 60, y - 1 - (1 - k) * 20));
    for (let i = 0; i < 3; i++) await this.strike(x + 8, y - 2, { sparks: 12, shake: 2 });
    this.billet2.visible = false;
    this.billet.scale.set(1.6, 1, 1);
    place(this.billet, x - 5, y);
    await this.restHammer();
  }

  // ── 성형 ──────────────────────────────
  setBlade(progress, temp, opts = {}) {
    const c = heatColor(temp);
    drawBladeShape(this.bladePc, progress.map((p) => p / 100), { x0: BLADE.x0, len: BLADE.len, highlight: this.hoverSection, clay: opts.clay, hamon: opts.hamon, curve: opts.curve });
    this.bladePc.update();
    this.blade.material.color.setRGB(c[0], c[1], c[2]);
    const glow = Math.max(0, Math.min(1, (temp - 550) / 700));
    this.bladeGlow.material.color.setRGB(c[0], c[1], c[2]);
    this.bladeGlow.material.opacity = glow * 0.45;
    place(this.bladeGlow, this.blade.userData.x - 8, this.blade.userData.y - 8);
  }

  pickSection(px, py, sections = 6) {
    if (!this.blade.visible) return -1;
    const bx = this.blade.userData.x + BLADE.x0; const by = this.blade.userData.y;
    if (py < by - 6 || py > by + BLADE.h + 6) return -1;
    const i = Math.floor((px - bx) / (BLADE.len / sections));
    return i >= 0 && i < sections ? i : -1;
  }

  async shapeHit(i, quality, sections = 6) {
    const seg = BLADE.len / sections;
    const tx = this.blade.userData.x + BLADE.x0 + seg * (i + 0.5);
    const ty = this.blade.userData.y + 8;
    const cold = quality === 'cold';
    await this.strike(tx, ty, { sparks: cold ? 2 : quality === 'warm' ? 6 : 12, shake: cold ? 0.8 : 1.6, color: cold ? [P.steelL, P.steel] : null });
    if (cold) this.stage.fx.emit('scale', tx, ty, 4);
    this.restHammer();
  }

  async reheatAnim(seconds = 1.2) {
    const b = this.blade;
    const from = { x: BLADE.x, y: BLADE.y };
    await this.tweens.add(0.3, (k) => { place(b, from.x - 40 * k, from.y + 10 * k); });
    this.fireGlow.material.opacity = 0.9;
    this.stage.fx.emit('ember', MOUTH.x + 17, MOUTH.y + 6, 16, { jitterX: 24 });
    await this.tweens.wait(seconds - 0.6);
    await this.tweens.add(0.3, (k) => { place(b, from.x - 40 * (1 - k), from.y + 10 * (1 - k)); });
  }

  // ── 점토 ──────────────────────────────
  async clayAnim(progress) {
    for (let i = 0; i <= 10; i++) {
      await this.tweens.wait(0.05);
      this.stage.fx.emit('dust', BLADE.x + 2 + i * 15, BLADE.y + 6, 3, { colors: [P.stoneL, P.mist] });
    }
    this.setBlade(progress, 20, { clay: true });
  }

  // ── 담금질 ────────────────────────────
  setQBlade(progress, temp, opts = {}) {
    drawBladeShape(this.qPc, progress.map((p) => p / 100), { x0: QBLADE.x0, y0: 4, len: QBLADE.len, thickScale: QBLADE.ts, curve: 2, ...opts });
    this.qPc.update();
    const c = heatColor(temp);
    this.qBlade.material.color.setRGB(c[0], c[1], c[2]);
  }

  syncQuench(sim, progress) {
    this.troughGlow.material.opacity = sim.inFurnace ? 0.3 + Math.random() * 0.05 : 0.1;
    if (!this.bladeMoving) place(this.qBlade, TROUGH.x + 4, sim.inFurnace ? TROUGH.y - 14 : TROUGH.y - 30);
    this.setQBlade(progress, sim.temp, { clay: true });
  }

  async quenchAnim(progress, hamonColor) {
    this.bladeMoving = true;
    const b = this.qBlade;
    const sx = b.userData.x; const sy = b.userData.y;
    const tx = WATER.x; const ty = WATER.y - 18;
    await this.tweens.add(0.45, (k) => place(b, sx + (tx - sx) * easeOut(k), sy + (ty - sy) * k - Math.sin(k * Math.PI) * 16));
    b.renderOrder = 2.5; // 물통 앞판 뒤로
    await this.tweens.add(0.12, (k) => place(b, tx, ty + 14 * k));
    for (let i = 0; i < 4; i++) this.stage.fx.emit('steam', WATER.x + 10 + Math.random() * 110, WATER.y, 40, { jitterX: 30, speed: [14, 46] });
    this.stage.fx.emit('splash', WATER.x + 60, WATER.y, 40, { jitterX: 100 });
    this.stage.addShake(2.5);
    this.setQBlade(progress, 20, { clay: true });
    this.qBlade.material.color.setRGB(0.55, 0.58, 0.64);
    await this.tweens.wait(0.8);
    for (let i = 0; i < 3; i++) { this.stage.fx.emit('steam', WATER.x + 10 + Math.random() * 110, WATER.y, 18, { jitterX: 30 }); await this.tweens.wait(0.22); }
    await this.tweens.add(0.3, (k) => place(b, tx, ty + 14 * (1 - k) - 8 * k));
    b.renderOrder = 5;
    this.setQBlade(progress, 20, { base: P.steelL, edge: P.steelH, spine: P.steel, hamon: hamonColor ? { color: hamonColor, wave: 1 } : null });
    this.qBlade.material.color.setRGB(1, 1, 1);
    this.bladeMoving = false;
  }

  update(dt, t) {
    this.tweens.update(dt);
    const T = this.mode === 'refine' ? this.furnaceT : this.mode === 'quench' ? 1000 : 820;
    const c = heatColor(T);
    this.fire.material.color.setRGB(c[0], c[1], c[2]);
    const intensity = Math.max(0.2, Math.min(1, (T - 500) / 900));
    this.flames.forEach((f, i) => {
      const h = 3 + Math.round((Math.sin(t * 11 + i * 1.7) + 1) * 3 * intensity + this.airVis * 4);
      f.scale.y = h / 6;
      f.position.y = -(MOUTH.y + MOUTH.h - 6 - h / 2);
      f.material.color.setRGB(1, 0.85 + 0.15 * intensity, 0.4 + 0.5 * this.airVis);
    });
    this.coals.material.color.setRGB(0.66 + 0.3 * intensity, 0.16 + 0.3 * this.fuelVis * intensity, 0.1);
    this.fireGlow.material.opacity = Math.max(0.25, this.fireGlow.material.opacity * 0.97, 0.3 + intensity * 0.35 + Math.sin(t * 9) * 0.04);
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.25;
      this.stage.fx.emit('smoke', 46 + Math.random() * 10, 24, 1);
      if (Math.random() < 0.3 + this.airVis) this.stage.fx.emit('ember', MOUTH.x + 8 + Math.random() * 20, MOUTH.y + 4, 1);
      if (this.mode === 'quench' && Math.random() < 0.5) this.stage.fx.emit('ember', TROUGH.x + Math.random() * TROUGH.w, TROUGH.y, 1);
    }
  }

  dispose() { dispose(this.stage.scene); }
}

export const WORKSHOP_LAYOUT = { MOUTH, ANVIL, BLADE, TUB, WATER };
