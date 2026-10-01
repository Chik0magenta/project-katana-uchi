// 공방 제작 한 번의 임시 상태. 영구 상태(GameState)와 분리되어 있고, 끝나면 결과만 GameState에 기록한다.
// 흐름: select(감정·제철) → refine(강재 2개 단련) → assign(피철·심철) → join(츠쿠리코미, 자동)
//      → shape(성형) → clay(다듬기·점토) → quench(담금질) → done(결과)
// Godot 이식: ForgeSession(RefCounted). stage 문자열로 공방 화면의 하위 패널을 바꾼다.

import { BALANCE } from '../../data/balance.js';
import { MATERIALS } from '../../data/materials.js';
import { round2, clamp, addLog, withRng } from '../state.js';
import { Rng } from '../rng.js';
import { RefineSim } from './refine.js';
import { ShapingSim } from './shaping.js';
import { QuenchSim } from './quench.js';
import { computeResult } from './result.js';

export const STAGES = [
  { id: 'select', label: '감정·제철' },
  { id: 'refine', label: '단련' },
  { id: 'assign', label: '배정' },
  { id: 'join', label: '접합' },
  { id: 'shape', label: '성형' },
  { id: 'clay', label: '점토' },
  { id: 'quench', label: '담금질' },
  { id: 'done', label: '결과' },
];

export class ForgeSession {
  constructor(state) {
    this.state = state;
    this.stage = 'select';
    this.picked = [];      // 고른 원료 uid 또는 'scrap'
    this.ingots = [];
    this.steels = [];      // 단련을 마친 강재
    this.refineIndex = 0;
    this.refine = null;
    this.skinIndex = null;
    this.shaping = null;
    this.clay = false;
    this.quench = null;
    this.result = null;
  }

  // 고를 수 있는 재료: 인벤토리 원료 + 창고 고철(항상 있음 → 재시도가 막히지 않는다)
  candidates() {
    const list = this.state.raw.map((r) => ({ ...r, source: 'raw' }));
    list.push({ uid: 'scrap', kind: 'scrap', name: MATERIALS.scrap.name, source: 'storage', origin: '공방 창고', carbon: avg(MATERIALS.scrap.carbon), uniformity: avg(MATERIALS.scrap.uniformity), impurity: avg(MATERIALS.scrap.impurity) });
    return list;
  }

  togglePick(uid) {
    if (this.stage !== 'select') return { ok: false };
    const i = this.picked.indexOf(uid);
    if (i >= 0 && uid !== 'scrap') { this.picked.splice(i, 1); return { ok: true }; }
    if (uid === 'scrap' && i >= 0 && this.picked.length >= 2) { this.picked.splice(i, 1); return { ok: true }; }
    if (this.picked.length >= 2) return { ok: false, reason: '강재는 두 개를 고릅니다. 먼저 하나를 빼세요.' };
    this.picked.push(uid);
    return { ok: true };
  }

  unpick(index) { this.picked.splice(index, 1); }

  // 제철: 원료 + 숯 → 강괴. 좋은 숯을 먼저 쓰고, 없으면 마을 숯(질 낮음).
  smeltPreview() {
    let good = this.state.charcoal;
    return this.picked.map((uid) => {
      const useGood = good > 0; if (useGood) good--;
      return { uid, useGood };
    });
  }

  startRefining() {
    if (this.picked.length !== 2) return { ok: false, reason: '강재로 쓸 재료를 두 개 고르세요.' };
    const plan = this.smeltPreview();
    const st = this.state;
    this.ingots = plan.map(({ uid, useGood }) => {
      let src;
      if (uid === 'scrap') {
        src = withRng(st, (rng) => ({
          kind: 'scrap', name: MATERIALS.scrap.name, origin: '공방 창고',
          carbon: rng.range(...MATERIALS.scrap.carbon), uniformity: rng.range(...MATERIALS.scrap.uniformity), impurity: rng.range(...MATERIALS.scrap.impurity),
        }));
      } else {
        const idx = st.raw.findIndex((r) => r.uid === uid);
        src = st.raw.splice(idx, 1)[0];
      }
      const c = useGood ? BALANCE.smelt.goodCharcoal : BALANCE.smelt.villageCharcoal;
      if (useGood) st.charcoal -= 1;
      return {
        name: src.name, kind: src.kind, origin: src.origin,
        carbon: round2(clamp(src.carbon + c.carbon, 0.05, 1.5)),
        uniformity: Math.round(src.uniformity),
        impurity: Math.round(clamp(src.impurity + c.impurity, 0, 100)),
        charcoal: useGood ? '좋은 숯' : '마을 숯',
      };
    });
    addLog(st, `제철: ${this.ingots.map((g) => g.name).join(', ')}`);
    this.stage = 'refine';
    this.refineIndex = 0;
    this.refine = new RefineSim(this.ingots[0]);
    return { ok: true, ingots: this.ingots };
  }

  finishRefine() {
    const chk = this.refine.canFinish();
    if (!chk.ok) return chk;
    this.steels.push({ ...this.refine.result(), charcoal: this.ingots[this.refineIndex].charcoal });
    if (this.refineIndex === 0) {
      this.refineIndex = 1;
      const prev = this.refine;
      this.refine = new RefineSim(this.ingots[1]);
      // 화덕은 이어서 쓴다
      this.refine.fuel = prev.fuel; this.refine.furnaceT = prev.furnaceT;
      return { ok: true, next: 'refine' };
    }
    this.refine = null;
    this.stage = 'assign';
    return { ok: true, next: 'assign' };
  }

  assign(skinIndex) {
    if (this.stage !== 'assign') return { ok: false };
    this.skinIndex = skinIndex;
    this.stage = 'join';
    return { ok: true };
  }

  get skin() { return this.steels[this.skinIndex]; }
  get core() { return this.steels[1 - this.skinIndex]; }

  finishJoin() { this.stage = 'shape'; this.shaping = new ShapingSim(); return { ok: true }; }

  finishShaping() {
    const chk = this.shaping.canFinish();
    if (!chk.ok) return chk;
    this.shapingSummary = this.shaping.summary();
    this.stage = 'clay';
    return { ok: true };
  }

  applyClay() { this.clay = true; return { ok: true }; }
  finishClay() {
    if (!this.clay) return { ok: false, reason: '점토를 먼저 바르세요.' };
    this.stage = 'quench'; this.quench = new QuenchSim(); return { ok: true };
  }

  doQuench() {
    const q = this.quench.quench();
    if (!q.ok) return q;
    const st = this.state;
    const rng = new Rng(st.rngState);
    this.result = computeResult({ skin: this.skin, core: this.core, shaping: this.shapingSummary, quench: q, rng });
    st.rngState = rng.state;
    st.day += BALANCE.forgeDays;
    const record = {
      no: st.results.length + 1, day: st.day,
      ...this.result,
      skin: this.skin, core: this.core, shaping: this.shapingSummary,
    };
    st.results.push(record);
    addLog(st, `도신 완성: ${this.result.grade}`);
    this.stage = 'done';
    return { ok: true, record };
  }
}

function avg([a, b]) { return (a + b) / 2; }
