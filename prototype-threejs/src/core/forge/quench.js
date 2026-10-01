// 담금질: 점토를 바른 도신을 화덕에서 달군다. 플레이어가 물에 넣는 순간을 고른다.
// 화덕 안에 오래 두면 도신 전체 온도가 고르게 되지만(고름) 너무 뜨거워질 수 있다.
// Godot 이식: RefCounted 클래스 QuenchSim.

import { BALANCE } from '../../data/balance.js';
import { heatBand } from './heat.js';

export class QuenchSim {
  constructor() {
    const Q = BALANCE.quench;
    this.Q = Q;
    this.temp = Q.startTemp;
    this.inFurnace = true;
    this.evenness = Q.evenStart;
    this.time = 0;
    this.done = false;
    this.final = null;
  }

  tick(dt) {
    if (this.done) return;
    const Q = this.Q;
    this.time += dt;
    if (this.inFurnace) {
      this.temp += (Q.furnaceTemp - this.temp) * Q.heatRate * dt;
      if (this.temp >= Q.evenMinTemp) this.evenness = Math.min(1, this.evenness + Q.evenRate * dt);
    } else {
      this.temp -= (this.temp - 20) * Q.coolRate * dt;
      // 공기 중에서는 칼끝부터 식어 고름이 조금씩 무너진다
      this.evenness = Math.max(0, this.evenness - 0.03 * dt);
    }
  }

  toggleFurnace() { this.inFurnace = !this.inFurnace; return { ok: true, inFurnace: this.inFurnace }; }

  quench() {
    if (this.done) return { ok: false };
    this.done = true;
    this.final = { temp: Math.round(this.temp), evenness: Math.round(this.evenness * 100) / 100 };
    return { ok: true, ...this.final };
  }

  get band() { return heatBand(this.temp); }
  get inIdeal() { return this.temp >= this.Q.ideal[0] && this.temp <= this.Q.ideal[1]; }
}
