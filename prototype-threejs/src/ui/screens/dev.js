// 개발용 메뉴: 시안 검수를 위해 주요 화면으로 바로 들어간다. 일반 플레이(새로 시작하기)와 분리되어 있다.
import { h, button } from '../dom.js';
import { TitleView } from '../../render/views/titleView.js';
import { createGame, makeRaw } from '../../core/state.js';
import { depart, arriveAt } from '../../core/travel.js';
import { ForgeSession } from '../../core/forge/session.js';

function sampleGame() {
  const s = createGame(12345);
  s.food = 10; s.charcoal = 3;
  for (const [k, o] of [['satetsu', '사철 강변 · 5일차'], ['satetsu', '사철 강변 · 6일차'], ['ore', '철광 산지 · 9일차'], ['roadsand', '강둑 길 · 4일차']]) s.raw.push(makeRaw(s, k, o));
  return s;
}

function sampleSession(s, until) {
  const f = new ForgeSession(s);
  f.togglePick(s.raw[0].uid); f.togglePick(s.raw[2].uid);
  f.startRefining();
  for (let k = 0; k < 2; k++) {
    const r = f.refine; r.fuel = 80;
    for (let t = 0; t < 120; t++) r.tick(0.05);
    r.takeOut();
    for (let n = 0; n < 4; n++) { r.steelT = 1000; r.knockScale(); r.fold(); }
    f.finishRefine();
  }
  if (until === 'assign') return f;
  f.assign(0);
  if (until === 'join') return f;
  f.finishJoin();
  if (until === 'shape') return f;
  for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) f.shaping.hit(i);
  f.finishShaping();
  if (until === 'clay') return f;
  f.applyClay(); f.finishClay();
  return f;
}

export function mountDev(app) {
  app.stage.setView(new TitleView());
  const go = (fn) => () => { app.state = sampleGame(); fn(app.state); };
  app.ui.append(h('div', { class: 'panel dev-panel' },
    h('h2', { text: '개발용 메뉴 (검수용)' }),
    h('div', { class: 'small muted', text: '샘플 상태(식량 10, 좋은 숯 3, 사철 2·철광석 1·모래쇠 1)로 각 화면에 바로 들어갑니다. 일반 플레이와 저장은 분리되지 않으니 검수 후에는 새로 시작하세요.' }),
    h('div', { class: 'dev-grid' },
      button('지도 (공방 마을)', go(() => app.go('map')), { testid: 'dev-map' }),
      button('이동 중 — 강둑 길 첫날', go((s) => { arriveAt(s, 'inn'); depart(s, 'river'); app.go('travel', { justMoved: true }); }), { testid: 'dev-travel' }),
      button('장소 — 사철 강변', go((s) => { arriveAt(s, 'river'); app.go('location'); }), { testid: 'dev-river' }),
      button('장소 — 철광 산지', go((s) => { arriveAt(s, 'mountain'); app.go('location'); }), { testid: 'dev-mountain' }),
      button('장소 — 숯가마 숲', go((s) => { arriveAt(s, 'forest'); app.go('location'); }), { testid: 'dev-forest' }),
      button('장소 — 갈림길 찻집', go((s) => { arriveAt(s, 'inn'); app.go('location'); }), { testid: 'dev-inn' }),
      button('공방 — 재료 고르기부터', go(() => app.go('workshop')), { testid: 'dev-workshop' }),
      button('공방 — 배정 단계', go((s) => app.go('workshop', { session: sampleSession(s, 'assign') })), { testid: 'dev-assign' }),
      button('공방 — 성형 단계', go((s) => app.go('workshop', { session: sampleSession(s, 'shape') })), { testid: 'dev-shape' }),
      button('공방 — 담금질 단계', go((s) => app.go('workshop', { session: sampleSession(s, 'quench') })), { testid: 'dev-quench' }),
      button('결과 — 샘플 도신', go((s) => {
        const f = sampleSession(s, 'quench');
        for (let t = 0; t < 120; t++) f.quench.tick(0.1);
        const o = f.doQuench();
        app.go('result', { record: o.record });
      }), { testid: 'dev-result' }),
      button(`개발 수치 표시 ${app.devNumbers ? '끄기' : '켜기'} (F2)`, () => { app.toggleDevNumbers(); app.go('dev'); }, { testid: 'dev-numbers' }),
    ),
    h('div', { class: 'grow' }),
    button('제목으로', () => app.go('title'), { cls: 'center' }),
  ));
}
