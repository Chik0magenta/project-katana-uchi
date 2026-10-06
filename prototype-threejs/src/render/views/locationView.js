// 장소 화면 그림: 장소 삽화 + 반복 효과(연기·물빛·등불) + 활동 피드백.
import { P } from '../palette.js';
import { drawLocation, LOC_H } from '../art/backgrounds.js';
import { SMITH_FRAMES, BENKEI } from '../art/sprites.js';
import { gridTex, glowTexture, Tweens, dispose } from './common.js';
import { placeFoot } from '../stage.js';

const Y0 = 11;

export class LocationView {
  constructor(id, companion) { this.id = id; this.companion = companion; this.tweens = new Tweens(); this.t = 0; }

  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.ink);
    stage.sprite(drawLocation(this.id).tex(), 320, LOC_H, 0, Y0, 0);
    const footY = { village: 100, inn: 100, forest: 100, river: 104, mountain: 104, castle: 100 }[this.id] + Y0 - 6;
    const smithX = { village: 92, inn: 150, forest: 120, river: 70, mountain: 120, castle: 216 }[this.id];
    this.smith = stage.sprite(gridTex(SMITH_FRAMES[0]).tex(), 12, 20, 0, 0, 10);
    placeFoot(this.smith, smithX, footY);
    this.smithPos = { x: smithX, y: footY };
    if (this.companion) {
      const b = stage.sprite(gridTex(BENKEI).tex(), 16, 25, 0, 0, 9);
      placeFoot(b, smithX - 20, footY);
    }
    this.glows = [];
    if (this.id === 'inn') {
      for (const x of [184, 248]) {
        stage.quad(3, 4, x, Y0 + 52, 5, 0xe04a3a, 1);
        this.glows.push(stage.sprite(glowTexture(12, '#f08a2a'), 24, 24, x - 11, Y0 + 42, 6, { additive: true, opacity: 0.5 }));
      }
    }
    if (this.id === 'forest') this.glows.push(stage.sprite(glowTexture(16, '#f08a2a'), 32, 32, 141, Y0 + 72, 6, { additive: true, opacity: 0.5 }));
    if (this.id === 'castle') for (const x of [113, 161]) this.glows.push(stage.sprite(glowTexture(10, '#f08a2a'), 20, 20, x - 9, Y0 + 52, 6, { additive: true, opacity: 0.45 }));
    if (this.id === 'village') this.glows.push(stage.sprite(glowTexture(12, '#f8d050'), 24, 24, 117, Y0 + 56, 6, { additive: true, opacity: 0.35 }));
  }

  // 활동 피드백 연출
  playActivity(id) {
    const fx = this.stage.fx; const { x, y } = this.smithPos;
    if (id === 'satetsu') { fx.emit('splash', x + 10, y - 2, 18); fx.emit('scale', x + 10, y - 4, 8); }
    else if (id === 'ore') { fx.emit('dust', x + 10, y - 6, 16); fx.emit('spark', x + 10, y - 8, 6); this.stage.addShake(1.5); }
    else if (id === 'charcoal') { fx.emit('smoke', 160, Y0 + 60, 10, { jitterX: 10 }); fx.emit('ember', 158, Y0 + 84, 10); }
    else if (id === 'supply' || id === 'onigiri') fx.emit('star', x, y - 22, 8, { colors: [P.white, P.strawL] });
    else if (id === 'buy' || id === 'sell') fx.emit('star', x, y - 22, 6, { colors: [P.yellow, P.strawL] });
    else if (id === 'polish') { fx.emit('splash', 196, Y0 + 72, 8); fx.emit('star', 176, Y0 + 70, 6, { colors: [P.white, P.steelH] }); }
    else if (id === 'koshirae') fx.emit('star', 137, Y0 + 70, 10, { colors: [P.white, P.steelH, P.strawL] });
    else fx.emit('star', x, y - 22, 6, { colors: [P.skyL, P.white] });
  }

  update(dt, t) {
    this.tweens.update(dt);
    this.t -= dt;
    for (const g of this.glows) g.material.opacity = 0.4 + Math.sin(t * 7 + g.position.x) * 0.08 + Math.random() * 0.06;
    if (this.t > 0) return;
    this.t = 0.12;
    const fx = this.stage.fx;
    if (this.id === 'village' && Math.random() < 0.6) fx.emit('smoke', 155, Y0 + 24, 1);
    if (this.id === 'forest') { fx.emit('smoke', 188, Y0 + 60, 1); if (Math.random() < 0.3) fx.emit('ember', 158, Y0 + 86, 1); }
    if (this.id === 'river') fx.emit('star', Math.random() * 320, Y0 + 58 + Math.random() * 24, 1, { colors: [P.foam, P.waterL] });
    if (this.id === 'mountain' && Math.random() < 0.1) fx.emit('dust', 160 + Math.random() * 20, Y0 + 88, 2);
    if (this.id === 'castle' && Math.random() < 0.15) fx.emit('smoke', 30 + Math.random() * 10, Y0 + 44, 1);
    if (this.id === 'inn' && Math.random() < 0.2) fx.emit('firefly', 40 + Math.random() * 80, Y0 + 70 + Math.random() * 20, 1);
  }

  dispose() { dispose(this.stage.scene); }
}
