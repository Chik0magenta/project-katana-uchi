// 타이틀 화면 그림: 밤의 대장간, 문 밖으로 튀는 불꽃과 굴뚝 연기.
import { P } from '../palette.js';
import { drawTitle } from '../art/backgrounds.js';
import { glowTexture, dispose } from './common.js';

export class TitleView {
  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.night);
    stage.sprite(drawTitle().tex(), 320, 180, 0, 0, 0);
    this.glow = stage.sprite(glowTexture(40, '#f08a2a'), 80, 80, 120, 96, 1, { additive: true, opacity: 0.5 });
    this.t = 0; this.burst = 1;
  }

  update(dt, t) {
    this.glow.material.opacity = 0.42 + Math.sin(t * 8) * 0.05 + Math.random() * 0.04;
    this.t -= dt; this.burst -= dt;
    if (this.t <= 0) {
      this.t = 0.2;
      this.stage.fx.emit('smoke', 194, 48, 1);
      this.stage.fx.emit('ember', 150 + Math.random() * 20, 126, 1);
    }
    if (this.burst <= 0) {
      this.burst = 0.9 + Math.random() * 0.6;
      this.stage.fx.emit('spark', 160, 138, 14, { speed: [30, 90] });
    }
  }

  dispose() { dispose(this.stage.scene); }
}
