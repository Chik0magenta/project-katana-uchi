// 탐험 규칙 [확정]: 인접 노드 한 구간만 선택 / 하루 단위 이동 / 매일 사건 1회('아무 일 없음' 포함)
// / 사건 해결 후 진행·노숙·되돌아가기 선택 / 전체 루트 자동 예약 없음.
//
// journey = {
//   edgeId, from, to, length(D), pos(x: 출발점으로부터 일수),
//   heading: 'to' | 'from',     // 지금 향하는 쪽
//   phase: 'event' | 'choose' | 'arrive',
//   event: 현재 사건(해결 전/후), dayInfo: 오늘 한 행동과 소비,
//   history: [{day, action, pos, eventTitle}]
// }
// Godot 이식: Travel 클래스(정적 함수)로 옮기고, 화면은 phase만 보고 그린다.

import { BALANCE } from '../data/balance.js';
import { MAP, TERRAIN_NAMES } from '../data/map.js';
import { EVENTS } from '../data/events.js';
import {
  withRng, eat, clampStats, addLog, snapshotStats, diffStats, makeRaw, hearRumor,
} from './state.js';

export function neighbors(nodeId) {
  return MAP.edges
    .filter((e) => e.a === nodeId || e.b === nodeId)
    .map((e) => ({ edge: e, node: e.a === nodeId ? e.b : e.a }));
}

export function findEdge(a, b) {
  return MAP.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null;
}

// 출발 전 확인: 인접 여부와 예상 소비 (편도·왕복)
export function departPreview(state, to) {
  const from = state.location;
  const edge = from ? findEdge(from, to) : null;
  if (!from) return { ok: false, reason: '길 위에서는 새 목적지를 고를 수 없습니다.' };
  if (from === to) return { ok: false, reason: '지금 있는 장소입니다.' };
  if (!edge) return { ok: false, reason: '직접 연결된 장소만 목적지로 고를 수 있습니다.' };
  const D = edge.days;
  const t = BALANCE.travel;
  const oneWayFood = D * t.foodPerDay;
  const roundFood = oneWayFood * 2;
  const fatigueOneWay = D * t.fatiguePerDay;
  const warnings = [];
  if (state.food < oneWayFood) warnings.push(`식량이 편도(${oneWayFood})에도 모자랍니다. 굶으면 피로가 크게 오릅니다.`);
  else if (state.food < roundFood) warnings.push(`왕복 식량(${roundFood})에는 모자랍니다. 도중 보급을 생각해 두세요.`);
  if (state.fatigue + fatigueOneWay >= BALANCE.fatigue.max) warnings.push('이대로 가면 도착 전에 탈진할 수 있습니다. 노숙이나 휴식을 고려하세요.');
  return {
    ok: true, edge, days: D, terrain: edge.terrain, terrainName: TERRAIN_NAMES[edge.terrain],
    oneWayFood, roundFood, fatigueOneWay, warnings,
  };
}

// 출발 = 첫 하루 이동까지 처리한다 (GDD 3.3).
export function depart(state, to) {
  const p = departPreview(state, to);
  if (!p.ok) return p;
  state.journey = {
    edgeId: p.edge.id, from: state.location, to, length: p.days, pos: 0,
    heading: 'to', phase: 'choose', event: null, dayInfo: null, history: [],
  };
  state.location = null;
  addLog(state, `${MAP.nodes[state.journey.from].name}에서 ${MAP.nodes[to].name}(으)로 출발`);
  return { ok: true, day: travelDay(state, 'depart') };
}

// 행동 선택 단계에서 고를 수 있는 행동과 표시 이름
export function dayActions(state) {
  const j = state.journey;
  if (!j || j.phase !== 'choose') return [];
  const going = j.heading === 'to';
  return [
    { id: 'continue', label: going ? '진행하기' : '귀환 계속' },
    { id: 'camp', label: '노숙하기' },
    { id: 'reverse', label: going ? '되돌아가기' : '목적지로 다시 향하기' },
  ];
}

// 하루 행동: continue(지금 방향으로 1일 이동) / camp(제자리 1일) / reverse(방향을 바꿔 1일 이동)
export function takeDayAction(state, action) {
  const j = state.journey;
  if (!j || j.phase !== 'choose') return { ok: false, reason: '지금은 행동을 고를 수 없습니다.' };
  if (!['continue', 'camp', 'reverse'].includes(action)) return { ok: false, reason: '알 수 없는 행동' };
  return { ok: true, day: travelDay(state, action) };
}

function travelDay(state, action) {
  const j = state.journey;
  const before = snapshotStats(state);
  if (action === 'reverse') j.heading = j.heading === 'to' ? 'from' : 'to';
  const moving = action !== 'camp';
  state.day += 1;
  let starving;
  if (moving) {
    const dir = j.heading === 'to' ? 1 : -1;
    j.pos = Math.max(0, Math.min(j.length, j.pos + dir));
    starving = eat(state, BALANCE.travel.foodPerDay).starving;
    state.fatigue += BALANCE.travel.fatiguePerDay;
  } else {
    starving = eat(state, BALANCE.camp.foodPerDay).starving;
    state.fatigue -= BALANCE.camp.fatigueRecover;
  }
  clampStats(state);
  const reached = moving && ((j.heading === 'to' && j.pos === j.length) || (j.heading === 'from' && j.pos === 0));
  j.dayInfo = {
    action, moving, starving, reached,
    changes: diffStats(before, snapshotStats(state)),
  };

  // 그날의 사건은 정확히 한 번
  const ev = rollEvent(state, moving ? 'travel' : 'camp');
  j.event = buildEventInstance(state, ev);
  j.history.push({ day: state.day, action, pos: j.pos, eventTitle: ev.title });
  state.lastEventId = ev.id;

  // 대응이 필요 없는 사건(아무 일 없음, 야영 등)은 바로 적용·해결
  if (!ev.choices.length) {
    const before2 = snapshotStats(state);
    if (ev.effects) applyEffects(state, ev.effects, j.event);
    clampStats(state);
    j.event.resolved = true;
    j.event.changes = diffStats(before2, snapshotStats(state));
    afterEvent(state);
  } else {
    j.phase = 'event';
  }
  return j.dayInfo;
}

export function rollEvent(state, kind) {
  const terrain = edgeOf(state.journey).terrain;
  const cands = EVENTS.filter((e) => e.kind === kind
    && (e.terrains === 'any' || e.terrains.includes(terrain))
    && (!e.minDay || state.day >= e.minDay)
    && !(e.unique && state.flags[e.id])
    && !(e.choices.some((c) => c.effects?.companion) && Object.keys(state.companions).length));
  return withRng(state, (rng) => rng.pickWeighted(cands, (e) => (e.id === state.lastEventId && e.id !== 'nothing' ? e.weight * 0.2 : e.weight)));
}

function buildEventInstance(state, ev) {
  const terrain = edgeOf(state.journey).terrain;
  const text = ev.textByTerrain ? ev.textByTerrain[terrain] : ev.text;
  return {
    id: ev.id, title: ev.title, text, art: ev.art, weather: ev.weather || null,
    choices: ev.choices.map((c, i) => ({ index: i, label: c.label, ...checkRequires(state, c.requires) })),
    resolved: false, resultText: null, changes: [],
  };
}

export function checkRequires(state, req) {
  if (!req) return { enabled: true, why: null };
  if (req.companion && !state.companions[req.companion]) return { enabled: false, why: '동행자가 없습니다' };
  if (req.food && state.food < req.food) return { enabled: false, why: `식량 ${req.food} 필요` };
  if (req.charcoal && state.charcoal < req.charcoal) return { enabled: false, why: `숯 ${req.charcoal} 필요` };
  if (req.raw && state.raw.length < req.raw) return { enabled: false, why: `원료 ${req.raw}개 필요` };
  return { enabled: true, why: null };
}

export function resolveEvent(state, choiceIndex) {
  const j = state.journey;
  if (!j || j.phase !== 'event') return { ok: false, reason: '대응할 사건이 없습니다.' };
  const ev = EVENTS.find((e) => e.id === j.event.id);
  const choice = ev.choices[choiceIndex];
  if (!choice) return { ok: false, reason: '없는 선택지' };
  const req = checkRequires(state, choice.requires);
  if (!req.enabled) return { ok: false, reason: req.why };
  const before = snapshotStats(state);
  applyEffects(state, choice.effects || {}, j.event);
  clampStats(state);
  j.event.resolved = true;
  j.event.chosen = choiceIndex;
  j.event.resultText = [choice.result, j.event.rumor].filter(Boolean).join(' ');
  j.event.changes = diffStats(before, snapshotStats(state));
  if (ev.unique) state.flags[ev.id] = true;
  addLog(state, `${ev.title}: ${choice.label}`);
  afterEvent(state);
  return { ok: true };
}

function applyEffects(state, fx, evInst) {
  if (fx.food) state.food += fx.food;
  if (fx.fatigue) state.fatigue += fx.fatigue;
  if (fx.charcoal) state.charcoal += fx.charcoal;
  if (fx.addRaw) {
    const where = `${edgeOf(state.journey).name} · ${state.day}일차`;
    state.raw.push(makeRaw(state, fx.addRaw, where));
  }
  if (fx.loseRaw) state.raw.splice(-fx.loseRaw, fx.loseRaw);
  if (fx.companion) state.companions[fx.companion] = true;
  if (fx.flag) state.flags[fx.flag] = true;
  if (fx.hint === 'rumor' && evInst) evInst.rumor = hearRumor(state);
}

// 사건 해결 뒤: 탈진 확인 → 도착이면 'arrive', 아니면 행동 선택
function afterEvent(state) {
  const j = state.journey;
  if (state.fatigue >= BALANCE.fatigue.max) {
    j.phase = 'collapse';
    return;
  }
  j.phase = j.dayInfo.reached ? 'arrive' : 'choose';
}

// 도착일의 사건을 해결한 뒤 장소에 들어간다. 장소 진입 시 사건을 다시 굴리지 않는다.
export function enterArrived(state) {
  const j = state.journey;
  if (!j || j.phase !== 'arrive') return { ok: false };
  const node = j.heading === 'to' ? j.to : j.from;
  arriveAt(state, node);
  return { ok: true, node };
}

export function arriveAt(state, node) {
  state.location = node;
  state.journey = null;
  state.visit = { node, counts: {} };
  addLog(state, `${MAP.nodes[node].name} 도착`);
}

// 임시 실패 처리: 탈진하면 손실 내역을 보여 주고 거점으로 돌아간다.
export function collapse(state) {
  const c = BALANCE.collapse;
  const lostRaw = Math.ceil(state.raw.length * c.rawLossRatio);
  const lostItems = state.raw.splice(state.raw.length - lostRaw, lostRaw);
  const lostFood = state.food;
  state.day += c.daysLost;
  state.food = c.foodAfter;
  state.fatigue = c.fatigueAfter;
  state.collapses += 1;
  arriveAt(state, MAP.base);
  addLog(state, '탈진해 마을로 실려 왔다');
  return { lostRaw: lostItems.map((r) => r.name), lostFood, daysLost: c.daysLost };
}

export function edgeOf(j) { return MAP.edges.find((e) => e.id === j.edgeId); }

// 화면 표시용 정보
export function journeyView(state) {
  const j = state.journey;
  const edge = edgeOf(j);
  const target = j.heading === 'to' ? j.to : j.from;
  return {
    edge, from: MAP.nodes[j.from], to: MAP.nodes[j.to], pos: j.pos, length: j.length,
    heading: j.heading, target: MAP.nodes[target],
    daysToDest: j.length - j.pos, daysToOrigin: j.pos,
    terrainName: TERRAIN_NAMES[edge.terrain],
  };
}
