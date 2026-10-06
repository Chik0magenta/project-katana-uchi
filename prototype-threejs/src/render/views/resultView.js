// 결과 화면 그림: 완성 도신(하몬·결함 표시)과 반짝임.
import { P } from '../palette.js';
import { drawResultBg, drawRecordBlade } from '../art/backgrounds.js';
import { PixelCanvas } from '../pixel.js';
import { dispose } from './common.js';

const BW = 300; const BH = 34;

export class ResultView {
  constructor(record) { this.record = record; this.t = 0; }

  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.night);
    stage.sprite(drawResultBg().tex(), 320, 180, 0, 0, 0);
    const r = this.record;
    const pc = new PixelCanvas(BW, BH, 5);
    drawRecordBlade(pc, r);
    if (r.soundness.label === '파단') {
      pc.ctx.clearRect(118, 0, 4, BH);
      pc.line(117, 6, 117, 26, P.ink); pc.line(122, 6, 122, 26, P.ink);
    }
    this.blade = stage.sprite(pc.tex(), BW, BH, 10, 30, 2);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.t > 0.15) {
      this.t = 0;
      if (this.record.soundness.label !== '파단') this.stage.fx.emit('star', 20 + Math.random() * 240, 40 + Math.random() * 14, 1, { colors: [P.white, P.steelH] });
    }
  }

  dispose() { dispose(this.stage.scene); }
}
