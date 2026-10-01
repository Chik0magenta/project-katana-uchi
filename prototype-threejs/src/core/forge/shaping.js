// 성형: 도신을 구간으로 나눠 두드린다. 식으면 다시 달군다.
// 성형 이후 강재의 세 변수는 바뀌지 않고, 형상 품질과 제작 결함만 따로 기록한다 (GDD 7.3).
// Godot 이식: RefCounted 클래스 ShapingSim.

import { BALANCE } from '../../data/balance.js';
import { heatBand } from './heat.js';

export const SECTION_NAMES = ['칼끝', '앞날', '앞 중간', '뒤 중간', '밑날', '밑동'];

export class ShapingSim {
  constructor() {
    const S = BALANCE.shaping;
    this.S = S;
    this.progress = new Array(S.sections).fill(0);
    this.over = new Array(S.sections).fill(false);
    this.temp = S.startTemp;
    this.hits = 0;
    this.coldHits = 0;
    this.reheats = 0;
    this.heating = false;
  }

  tick(dt) {
    if (this.heating) return;
    this.temp = Math.max(20, this.temp - this.S.coolRate * dt);
  }

  hit(i) {
    const S = this.S;
    if (this.heating) return { ok: false, reason: '화덕에서 달구는 중입니다.' };
    if (i < 0 || i >= S.sections) return { ok: false };
    let gain; let quality;
    if (this.temp >= S.hit.hotAt) { gain = S.hit.hot; quality = 'hot'; }
    else if (this.temp >= S.hit.warmAt) { gain = S.hit.warm; quality = 'warm'; }
    else { gain = S.hit.cold; quality = 'cold'; this.coldHits++; }
    this.progress[i] += gain;
    for (const n of [i - 1, i + 1]) if (n >= 0 && n < S.sections) this.progress[n] += S.hit.neighbor;
    let overNow = false;
    for (let k = 0; k < S.sections; k++) {
      if (this.progress[k] > S.overAt && !this.over[k]) { this.over[k] = true; if (k === i) overNow = true; }
    }
    this.hits++;
    this.temp -= 6;
    return { ok: true, quality, gain, overNow };
  }

  startReheat() { this.heating = true; return { ok: true }; }
  finishReheat() { this.heating = false; this.temp = this.S.reheatTemp; this.reheats++; }

  canFinish() {
    const low = this.progress.findIndex((p) => p < this.S.finishAt);
    if (low >= 0) return { ok: false, reason: `${SECTION_NAMES[low]} 구간을 더 두드려야 합니다.` };
    return { ok: true };
  }

  get band() { return heatBand(this.temp); }

  summary() {
    const S = this.S;
    const capped = this.progress.map((p) => Math.min(p, S.target));
    const mean = capped.reduce((a, b) => a + b, 0) / capped.length;
    const dev = Math.sqrt(this.progress.reduce((a, p) => a + (Math.min(p, 140) - mean) ** 2, 0) / this.progress.length);
    const overCount = this.over.filter(Boolean).length;
    const quality = Math.max(0, Math.round(mean - dev * 0.6 - overCount * 6));
    return {
      quality, deviation: Math.round(dev), overSections: this.over.map((o, i) => (o ? SECTION_NAMES[i] : null)).filter(Boolean),
      coldHits: this.coldHits, hits: this.hits, reheats: this.reheats, progress: [...this.progress],
    };
  }
}
