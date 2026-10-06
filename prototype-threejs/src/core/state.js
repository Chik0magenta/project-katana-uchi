// 영구 게임 상태(탐험·인벤토리·결과 기록). 공방 공정의 임시 상태는 forge/*.js 세션 객체가 따로 가진다.
// 모든 규칙 함수는 DOM·three.js를 모른다. Godot 이식: GameState 오토로드 + 같은 이름의 함수.

import { BALANCE } from '../data/balance.js';
import { MAP } from '../data/map.js';
import { MATERIALS, APPRAISAL } from '../data/materials.js';
import { RUMORS } from '../data/events.js';
import { Rng } from './rng.js';

export function createGame(seed = Date.now() % 1000000) {
  const s = BALANCE.start;
  return {
    seed,
    rngState: seed >>> 0,
    day: s.day,
    food: s.food,
    fatigue: s.fatigue,
    charcoal: s.charcoal,       // 좋은 숯
    money: s.money,             // 돈 (문)
    raw: [],                    // 원료 [{uid, kind, name, carbon, uniformity, impurity, origin, tired}]
    blades: [],                 // 가진 도신 [{uid, no}] — no는 results 기록 번호
    weapons: [],                // 가진 카타나 (core/weapons.js 참고)
    equip: {},                  // { smith: 카타나 uid, benkei: 카타나 uid } — 없으면 기본 무기
    lastBattle: null,           // 마지막 전투 기록 (전투 화면이 재생한다)
    location: MAP.base,         // 장소에 있을 때 노드 id, 길 위면 null
    journey: null,              // travel.js 참고
    visit: { node: MAP.base, counts: {} },
    companions: {},             // { benkei: true }
    flags: {},                  // 고유 사건 완료 등
    rumorsHeard: [],
    lastEventId: null,
    results: [],                // 완성한 도신 기록
    log: [],                    // 최근 일지
    nextUid: 1,
    collapses: 0,
  };
}

// 예전 저장(v0.1)을 불러올 때 v0.2에서 늘어난 항목을 채운다.
export function migrateState(state) {
  if (state.money === undefined) state.money = BALANCE.start.money;
  if (!state.blades) state.blades = state.results.map((r) => ({ uid: state.nextUid++, no: r.no }));
  if (!state.weapons) state.weapons = [];
  if (!state.equip) state.equip = {};
  if (state.lastBattle === undefined) state.lastBattle = null;
  return state;
}

// 상태 안에 저장된 시드로 난수를 쓰고 다시 저장한다 (저장/불러오기 시 재현 가능).
export function withRng(state, fn) {
  const rng = new Rng(state.rngState);
  const out = fn(rng);
  state.rngState = rng.state;
  return out;
}

export function addLog(state, text) {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 30) state.log.length = 30;
}

export const isTired = (state) => state.fatigue >= BALANCE.fatigue.tired;

export function clampStats(state) {
  state.food = Math.max(0, Math.min(BALANCE.food.max, state.food));
  state.fatigue = Math.max(0, Math.min(BALANCE.fatigue.max, state.fatigue));
  state.charcoal = Math.max(0, state.charcoal);
  state.money = Math.max(0, Math.round(state.money));
}

// 하루치 식량을 먹는다. 모자라면 굶주려 피로가 더 오른다.
export function eat(state, amount) {
  if (amount <= 0) return { starving: false };
  if (state.food >= amount) { state.food -= amount; return { starving: false }; }
  state.food = 0;
  state.fatigue += BALANCE.travel.starvingFatigue;
  return { starving: true };
}

// opts.bought: 산 물건은 지친 채 고른 것이 아니므로 불순도 가산이 없다.
export function makeRaw(state, kind, originText, opts = {}) {
  const m = MATERIALS[kind];
  const tired = !opts.bought && isTired(state);
  return withRng(state, (rng) => {
    const raw = {
      uid: state.nextUid++,
      kind,
      name: m.name,
      carbon: round2(rng.range(m.carbon[0], m.carbon[1])),
      uniformity: Math.round(rng.range(m.uniformity[0], m.uniformity[1])),
      impurity: Math.round(rng.range(m.impurity[0], m.impurity[1])),
      origin: originText,
      tired,
    };
    if (tired) raw.impurity = Math.min(100, raw.impurity + BALANCE.gather.tiredImpurity);
    return raw;
  });
}

export function hearRumor(state) {
  const left = RUMORS.map((_, i) => i).filter((i) => !state.rumorsHeard.includes(i));
  const pool = left.length ? left : RUMORS.map((_, i) => i);
  const idx = withRng(state, (rng) => rng.pick(pool));
  if (!state.rumorsHeard.includes(idx)) state.rumorsHeard.push(idx);
  return RUMORS[idx];
}

export function appraise(stat, value) {
  for (const [limit, label] of APPRAISAL[stat]) if (value < limit) return label;
  return '';
}

export function snapshotStats(state) {
  return { food: state.food, fatigue: state.fatigue, charcoal: state.charcoal, raw: state.raw.length, day: state.day, money: state.money };
}

// 전후 상태를 비교해 "식량 -1 · 피로 +2" 같은 변화 목록을 만든다.
export function diffStats(before, after) {
  const names = { day: '일차', food: '식량', fatigue: '피로', charcoal: '숯', raw: '원료', money: '돈' };
  const out = [];
  for (const k of ['money', 'food', 'fatigue', 'charcoal', 'raw']) {
    const d = after[k] - before[k];
    if (d !== 0) out.push({ key: k, label: names[k], delta: d });
  }
  return out;
}

export function recordOf(state, no) { return state.results.find((r) => r.no === no) || null; }

export const round2 = (v) => Math.round(v * 100) / 100;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
