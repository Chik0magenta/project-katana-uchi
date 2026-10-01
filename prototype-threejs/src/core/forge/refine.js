// 단련(가열·접쇠) 시뮬레이션. 공방 안에서만 흐르는 짧은 실시간 구간.
// UI는 매 프레임 tick(dt)을 부르고, 버튼은 행동 함수를 부른다.
// Godot 이식: RefCounted 클래스 RefineSim, _process(delta)에서 tick(delta).

import { BALANCE } from '../../data/balance.js';
import { clamp, round2 } from '../state.js';
import { heatBand } from './heat.js';

export class RefineSim {
  constructor(ingot) {
    const R = BALANCE.refine;
    this.R = R;
    this.steel = {
      name: ingot.name, kind: ingot.kind, origin: ingot.origin,
      carbon: ingot.carbon, uniformity: ingot.uniformity, impurity: ingot.impurity,
      start: { carbon: ingot.carbon, uniformity: ingot.uniformity, impurity: ingot.impurity },
    };
    this.fuel = R.startFuel;
    this.air = 0;
    this.furnaceT = 700;
    this.steelT = 20;
    this.inFurnace = true;
    this.scale = 0;           // 표면 산화물 0~1
    this.folds = 0;
    this.knocks = 0;
    this.time = 0;
    // 결과 설명용 기록
    this.notes = { carburized: 0, decarb: 0, burnSec: 0, overheatSec: 0, scaleFolded: 0, coolFolds: 0 };
  }

  get furnaceTarget() {
    const R = this.R;
    return R.furnaceBase + this.fuel * R.furnacePerFuel + this.air * R.furnacePerAir;
  }

  tick(dt) {
    const R = this.R;
    this.time += dt;
    this.fuel = Math.max(0, this.fuel - R.fuelBurn * dt * (1 + this.air / 100));
    this.air = Math.max(0, this.air - R.airDecay * dt);
    this.furnaceT += (this.furnaceTarget - this.furnaceT) * Math.min(1, R.furnaceFollow * dt);

    const s = this.steel;
    if (this.inFurnace) {
      this.steelT += (this.furnaceT - this.steelT) * Math.min(1, R.steelFollow * dt);
      const c = R.carburize;
      if (this.steelT >= c.min && this.steelT <= c.max && this.fuel >= c.minFuel && s.carbon < c.cap) {
        const d = c.rate * dt;
        s.carbon += d; this.notes.carburized += d;
      }
      if (this.steelT > 900) this.scale = Math.min(1, this.scale + (this.steelT > R.overheat.decarbAt ? R.scaleRateHot : R.scaleRate) * dt);
    } else {
      this.steelT -= ((this.steelT - 20) * R.coolRate + R.coolFlat) * dt;
      this.steelT = Math.max(20, this.steelT);
    }
    const o = R.overheat;
    if (this.steelT > o.decarbAt) {
      const d = Math.min(s.carbon - 0.05, o.decarbRate * dt);
      s.carbon -= Math.max(0, d); this.notes.decarb += Math.max(0, d);
      this.notes.overheatSec += dt;
    }
    if (this.steelT > o.burnAt) {
      s.impurity = clamp(s.impurity + o.burnImpurity * dt, 0, 100);
      s.uniformity = clamp(s.uniformity - o.burnUniformity * dt, 0, 100);
      this.notes.burnSec += dt;
    }
  }

  addFuel() {
    this.fuel = Math.min(this.R.fuelMax, this.fuel + this.R.fuelAdd);
    return { ok: true };
  }

  pump() {
    this.air = Math.min(this.R.airMax, this.air + this.R.airAdd);
    return { ok: true };
  }

  takeOut() {
    if (!this.inFurnace) return { ok: false, reason: '이미 모루 위에 있습니다.' };
    this.inFurnace = false;
    return { ok: true };
  }

  putIn() {
    if (this.inFurnace) return { ok: false, reason: '이미 화덕 안에 있습니다.' };
    this.inFurnace = true;
    return { ok: true };
  }

  knockScale() {
    if (this.inFurnace) return { ok: false, reason: '먼저 꺼내서 모루에 올리세요.' };
    const k = this.R.knockScale;
    const removed = this.scale * k.remove;
    this.scale -= removed;
    this.steelT -= k.tempDrop;
    this.knocks++;
    return { ok: true, removed };
  }

  foldCheck() {
    const F = this.R.fold;
    if (this.inFurnace) return { ok: false, reason: '먼저 꺼내서 모루에 올리세요.' };
    if (this.folds >= F.max) return { ok: false, reason: `접기는 ${F.max}번까지입니다.` };
    if (this.steelT < F.minTemp) return { ok: false, reason: `너무 식었습니다. (${F.minTemp}°C 이상에서 접기)` };
    return { ok: true };
  }

  fold() {
    const chk = this.foldCheck();
    if (!chk.ok) return chk;
    const F = this.R.fold;
    const s = this.steel;
    const cool = this.steelT < F.goodTemp;
    let eff = Math.pow(F.diminish, this.folds) * (1 - this.scale * F.scalePenalty);
    if (cool) { eff *= F.coolEffect; this.notes.coolFolds++; }
    const before = { carbon: s.carbon, uniformity: s.uniformity, impurity: s.impurity };
    s.uniformity = clamp(s.uniformity + (100 - s.uniformity) * F.uniformityGain * eff, 0, 100);
    s.impurity = clamp(s.impurity - s.impurity * F.impurityLoss * eff + this.scale * F.scaleToImpurity, 0, 100);
    s.carbon = Math.max(0.05, s.carbon - F.carbonLoss - (this.steelT > 1250 ? F.hotCarbonLoss : 0));
    this.notes.scaleFolded += this.scale;
    this.folds++;
    this.steelT -= F.tempDrop;
    this.scale = Math.min(this.scale, 0.1);
    return {
      ok: true, eff,
      delta: {
        carbon: s.carbon - before.carbon,
        uniformity: s.uniformity - before.uniformity,
        impurity: s.impurity - before.impurity,
      },
    };
  }

  canFinish() {
    if (this.folds < this.R.fold.minFolds) return { ok: false, reason: '한 번 이상 접어야 마칠 수 있습니다.' };
    return { ok: true };
  }

  // 다음 접기의 예상 효율 (화면 안내용)
  nextFoldEfficiency() {
    const F = this.R.fold;
    let eff = Math.pow(F.diminish, this.folds) * (1 - this.scale * F.scalePenalty);
    if (this.steelT < F.goodTemp) eff *= F.coolEffect;
    return eff;
  }

  get band() { return heatBand(this.steelT); }

  result() {
    const s = this.steel;
    return {
      name: s.name, kind: s.kind, origin: s.origin,
      carbon: round2(s.carbon), uniformity: Math.round(s.uniformity), impurity: Math.round(s.impurity),
      start: s.start, folds: this.folds, notes: { ...this.notes },
    };
  }
}
