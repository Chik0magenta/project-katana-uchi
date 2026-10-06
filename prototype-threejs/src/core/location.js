// 장소 활동 (채집·보급·휴식·소문). 장소 활동은 길 위 사건을 일으키지 않는다.
// Godot 이식: Location 정적 함수.

import { BALANCE } from '../data/balance.js';
import { LOCATIONS } from '../data/locations.js';
import { MAP } from '../data/map.js';
import { MATERIALS } from '../data/materials.js';
import {
  eat, clampStats, addLog, snapshotStats, diffStats, makeRaw, hearRumor,
} from './state.js';
import { fight } from './battle.js';

export function activitiesAt(state) {
  const loc = LOCATIONS[state.location];
  if (!loc) return [];
  return loc.activities.map((a) => {
    const used = state.visit.counts[a.id] || 0;
    let enabled = true;
    let why = null;
    if (a.limit && used >= a.limit) { enabled = false; why = '이번 방문에서는 더 할 수 없습니다'; }
    if (a.gives?.foodFill && state.food >= BALANCE.food.max) { enabled = false; why = '식량이 이미 가득합니다'; }
    if (a.cost?.money && state.money < a.cost.money) { enabled = false; why = `돈 ${a.cost.money}문 필요`; }
    return { ...a, used, enabled, why };
  });
}

export function doActivity(state, id) {
  const act = activitiesAt(state).find((a) => a.id === id);
  if (!act) return { ok: false, reason: '없는 활동' };
  if (!act.enabled) return { ok: false, reason: act.why };
  if (act.special) return { ok: true, special: act.special };

  const before = snapshotStats(state);
  const cost = act.cost || {};
  let starving = false;
  if (cost.days) state.day += cost.days;
  if (cost.food) starving = eat(state, cost.food).starving;
  const tiredBefore = state.fatigue;
  if (cost.fatigue) state.fatigue += cost.fatigue;
  if (cost.money) state.money -= cost.money;

  const g = act.gives || {};
  let text = '';
  const node = MAP.nodes[state.location];
  if (g.raw) {
    // 채집 직전의 피로로 지침 여부를 판단한다
    const f = state.fatigue; state.fatigue = tiredBefore;
    const raw = makeRaw(state, g.raw, `${node.name} · ${state.day}일차`);
    state.fatigue = f;
    state.raw.push(raw);
    text = `${MATERIALS[g.raw].name}을(를) 얻었다.` + (raw.tired ? ' 지친 손으로 고르느라 잡물이 섞였다.' : '');
  }
  if (g.charcoal) { state.charcoal += g.charcoal; text = `좋은 숯 ${g.charcoal}자루를 얻었다.`; }
  if (g.food) { state.food += g.food; text = '따뜻한 주먹밥을 보따리에 넣었다.'; }
  if (g.foodFill) { state.food = BALANCE.food.max; text = '마을 창고에서 식량을 가득 채웠다.'; }
  if (g.fatigueTo !== undefined) { state.fatigue = g.fatigueTo; text = '푹 쉬었다. 몸이 가볍다.'; }
  if (g.fatigue) { state.fatigue += g.fatigue; text = '모닥불 곁에서 쉬었다.'; }
  if (g.hint === 'rumor') text = hearRumor(state);
  let battle = null;
  if (g.battle) { battle = fight(state, g.battle); text = [battle.text, battle.wearText].filter(Boolean).join(' '); }
  if (starving) text += ' 먹을 것이 없어 몹시 허기졌다.';
  clampStats(state);

  state.visit.counts[id] = (state.visit.counts[id] || 0) + 1;
  addLog(state, `${node.name}: ${act.label}`);
  const collapsed = state.fatigue >= BALANCE.fatigue.max;
  return { ok: true, text, changes: diffStats(before, snapshotStats(state)), collapsed, battle };
}
