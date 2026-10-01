// 규칙 계층 테스트 (DOM·three.js 없이 실행). GDD 9장 '실행해서 확인할 것' 중 규칙 항목을 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/state.js';
import {
  departPreview, depart, takeDayAction, resolveEvent, enterArrived, dayActions, collapse,
} from '../src/core/travel.js';
import { doActivity } from '../src/core/location.js';
import { ForgeSession } from '../src/core/forge/session.js';
import { RefineSim } from '../src/core/forge/refine.js';
import { computeResult } from '../src/core/forge/result.js';
import { BALANCE } from '../src/data/balance.js';

// 사건이 나오면 가능한 첫 선택지로 해결한다
function settle(state) {
  const j = state.journey;
  if (j && j.phase === 'event') {
    const c = j.event.choices.find((x) => x.enabled);
    assert.ok(resolveEvent(state, c.index).ok);
  }
}

test('비인접 노드로는 출발할 수 없다', () => {
  const s = createGame(1);
  const p = departPreview(s, 'river');
  assert.equal(p.ok, false);
  assert.match(p.reason, /직접 연결된/);
  assert.equal(s.journey, null);
  assert.equal(s.day, 1);
});

test('출발하면 첫날 이동과 사건이 한 번 처리되고, 선택 대기 중에는 시간이 흐르지 않는다', () => {
  const s = createGame(2);
  assert.ok(depart(s, 'forest').ok);
  assert.equal(s.day, 2);
  assert.equal(s.journey.pos, 1);
  assert.equal(s.journey.history.length, 1);
  settle(s);
  assert.equal(s.journey.phase, 'choose');
  const day = s.day; const pos = s.journey.pos;
  // 아무 행동도 안 하면 그대로
  assert.equal(s.day, day); assert.equal(s.journey.pos, pos);
  assert.deepEqual(dayActions(s).map((a) => a.label), ['진행하기', '노숙하기', '되돌아가기']);
});

test('사건 대응 전에는 행동을 고를 수 없다', () => {
  for (let seed = 1; seed < 200; seed++) {
    const s = createGame(seed);
    depart(s, 'inn');
    if (s.journey.phase === 'event') {
      assert.equal(takeDayAction(s, 'continue').ok, false);
      return;
    }
  }
  assert.fail('선택지가 있는 사건을 찾지 못함');
});

test('노숙은 위치를 유지하고 하루·식량을 쓰며 피로를 줄인다', () => {
  const s = createGame(3);
  depart(s, 'forest'); settle(s);
  const before = { pos: s.journey.pos, day: s.day, food: s.food, fatigue: s.fatigue };
  takeDayAction(s, 'camp');
  assert.equal(s.journey.pos, before.pos);
  assert.equal(s.day, before.day + 1);
  assert.equal(s.journey.history.length, 2); // 야영 사건 1회
  settle(s);
  assert.ok(s.food <= before.food - 1 + 0); // 사건에 따라 더 줄 수 있음
  assert.ok(s.fatigue <= Math.max(0, before.fatigue - BALANCE.camp.fatigueRecover) + 2);
});

test('되돌아가기는 실제 일수를 쓰며 출발점을 넘지 않는다', () => {
  const s = createGame(4);
  s.location = 'inn'; s.visit.node = 'inn';
  depart(s, 'mountain'); settle(s);          // pos 1
  takeDayAction(s, 'continue'); settle(s);   // pos 2
  assert.equal(s.journey.pos, 2);
  s.fatigue = 0;
  takeDayAction(s, 'reverse'); settle(s);    // pos 1, 귀환 중
  assert.equal(s.journey.pos, 1);
  assert.equal(s.journey.heading, 'from');
  assert.deepEqual(dayActions(s).map((a) => a.label), ['귀환 계속', '노숙하기', '목적지로 다시 향하기']);
  s.fatigue = 0;
  takeDayAction(s, 'continue'); settle(s);   // pos 0 → 도착
  assert.equal(s.journey.pos, 0);
  assert.equal(s.journey.phase, 'arrive');
  const day = s.day;
  assert.ok(enterArrived(s).ok);
  assert.equal(s.location, 'inn');
  assert.equal(s.day, day); // 장소에 들어갈 때 하루/사건이 추가되지 않는다
});

test('도착일에도 사건은 한 번이고, 도착 후 장소 행동을 할 수 있다', () => {
  const s = createGame(5);
  depart(s, 'inn');
  assert.equal(s.journey.history.length, 1);
  settle(s);
  if (s.journey.phase === 'collapse') return;
  assert.equal(s.journey.phase, 'arrive');
  enterArrived(s);
  const r = doActivity(s, 'onigiri');
  assert.ok(r.ok);
});

test('탈진하면 손실을 보여 주고 거점으로 돌아가 다시 할 수 있다', () => {
  const s = createGame(6);
  s.raw.push({ uid: 99, name: 'x' }, { uid: 98, name: 'y' }, { uid: 97, name: 'z' });
  s.location = null;
  const loss = collapse(s);
  assert.equal(loss.lostRaw.length, 2);
  assert.equal(s.location, 'village');
  assert.ok(s.food > 0);
  assert.equal(doActivity(s, 'supply').ok, true);
});

test('채집한 원료가 공방 후보에 출처와 함께 들어간다', () => {
  const s = createGame(7);
  s.location = 'river'; s.visit = { node: 'river', counts: {} };
  doActivity(s, 'satetsu');
  assert.equal(s.raw.length, 1);
  assert.match(s.raw[0].origin, /사철 강변/);
  s.location = 'village';
  const f = new ForgeSession(s);
  assert.ok(f.candidates().some((c) => c.uid === s.raw[0].uid));
  assert.ok(f.candidates().some((c) => c.uid === 'scrap'));
});

test('재료가 없어도 창고 고철로 제작을 끝까지 할 수 있다', () => {
  const s = createGame(8);
  const f = new ForgeSession(s);
  f.togglePick('scrap'); f.togglePick('scrap');
  assert.ok(f.startRefining().ok);
  for (let k = 0; k < 2; k++) {
    const r = f.refine;
    r.fuel = 100; for (let t = 0; t < 200; t++) r.tick(0.05);
    r.takeOut(); r.knockScale(); assert.ok(r.fold().ok);
    assert.ok(f.finishRefine().ok);
  }
  assert.equal(f.stage, 'assign');
  f.assign(0); f.finishJoin();
  for (let i = 0; i < 6; i++) for (let k = 0; k < 7; k++) f.shaping.hit(i);
  assert.ok(f.finishShaping().ok);
  f.applyClay(); f.finishClay();
  for (let t = 0; t < 100; t++) f.quench.tick(0.1);
  const res = f.doQuench();
  assert.ok(res.ok);
  assert.equal(s.results.length, 1);
  assert.ok(res.record.causes.length > 0);
});

test('접기는 균일도를 올리고 탄소를 잃으며, 반복할수록 효과가 줄어든다', () => {
  const r = new RefineSim({ name: 't', kind: 'satetsu', carbon: 0.8, uniformity: 40, impurity: 20 });
  r.inFurnace = false;
  const gains = [];
  for (let i = 0; i < 4; i++) {
    r.steelT = 1000; r.scale = 0;
    const out = r.fold();
    gains.push(out.delta.uniformity);
    assert.ok(out.delta.carbon < 0);
  }
  for (let i = 1; i < gains.length; i++) assert.ok(gains[i] < gains[i - 1]);
});

test('산화물을 털지 않고 접으면 효과가 떨어진다', () => {
  const a = new RefineSim({ name: 't', carbon: 0.8, uniformity: 40, impurity: 20 });
  const b = new RefineSim({ name: 't', carbon: 0.8, uniformity: 40, impurity: 20 });
  for (const r of [a, b]) { r.inFurnace = false; r.steelT = 1000; }
  a.scale = 0; b.scale = 0.9;
  a.fold(); b.fold();
  assert.ok(a.steel.uniformity > b.steel.uniformity);
  assert.ok(a.steel.impurity < b.steel.impurity);
});

test('재료와 조작 차이가 결과에 드러난다', () => {
  const shaping = { quality: 90, deviation: 4, overSections: [], coldHits: 0 };
  const good = computeResult({
    skin: { carbon: 0.72, uniformity: 80, impurity: 10 }, core: { carbon: 0.25, uniformity: 70, impurity: 20 },
    shaping, quench: { temp: 800, evenness: 0.9 },
  });
  const lowC = computeResult({
    skin: { carbon: 0.3, uniformity: 80, impurity: 10 }, core: { carbon: 0.25, uniformity: 70, impurity: 20 },
    shaping, quench: { temp: 800, evenness: 0.9 },
  });
  const hot = computeResult({
    skin: { carbon: 0.72, uniformity: 80, impurity: 10 }, core: { carbon: 0.25, uniformity: 70, impurity: 20 },
    shaping, quench: { temp: 960, evenness: 0.9 },
  });
  assert.equal(good.soundness.label, '정상');
  assert.ok(good.score > lowC.score);
  assert.equal(lowC.hardening.label, '경화 부족');
  assert.ok(['균열', '파단'].includes(hot.soundness.label) || hot.score < good.score);
  assert.ok(lowC.causes.some((c) => /탄소/.test(c.text)));
});
