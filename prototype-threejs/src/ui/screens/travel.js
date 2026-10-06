// 이동: 하루 이동 → 그날의 사건 → 사건 해결 → 다음 행동 선택. 선택 전에는 시간이 흐르지 않는다.
import { h, button, changeChips } from '../dom.js';
import { TravelView } from '../../render/views/travelView.js';
import {
  dayActions, takeDayAction, resolveEvent, enterArrived, collapse, journeyView, edgeOf,
} from '../../core/travel.js';
import { previewBattle } from '../../core/battle.js';
import { openShop } from './shop.js';

const ACTION_NAMES = { depart: '출발 · 하루 이동', continue: '하루 이동', reverse: '방향을 바꿔 하루 이동', camp: '노숙' };

export function mountTravel(app, params) {
  const s = app.state;
  const view = new TravelView(edgeOf(s.journey).terrain);
  app.stage.setView(view);
  app.hud();
  const chip = h('div', { class: 'route-chip passthrough' });
  const panel = h('div', { class: 'panel travel-panel' });
  app.ui.append(chip, panel);
  let animating = false;
  let collapseInfo = null;

  function track() {
    const v = journeyView(s);
    const cells = h('div', { class: 'cells' });
    for (let i = 0; i < v.length; i++) cells.append(h('div', { class: `cell ${i < v.pos ? 'done' : ''}` }));
    const dot = h('div', { class: 'pos-dot', title: '현재 위치' });
    dot.style.left = `${(v.pos / v.length) * 100}%`;
    const wrap = h('div', { style: { position: 'relative', flex: '1', display: 'flex' } }, cells, dot);
    return h('div', { class: 'col', style: { gap: '4px' } },
      h('div', { class: 'track' },
        h('span', { class: 'end', text: `${v.from.name}` }),
        wrap,
        h('span', { class: 'end right', text: `${v.to.name}` })),
      h('div', { class: 'track-info', 'data-testid': 'track-info' },
        `${v.heading === 'to' ? '→ 목적지로 향하는 중' : '← 출발점으로 돌아가는 중'} · 위치 ${v.pos}/${v.length}일 · ${v.to.name}까지 ${v.daysToDest}일 · ${v.from.name}까지 ${v.daysToOrigin}일`),
    );
  }

  function render() {
    const j = s.journey;
    if (!j) return;
    const v = journeyView(s);
    chip.textContent = `${v.edge.name} (${v.terrainName}) · ${v.from.name} ↔ ${v.to.name}`;
    view.setCompanion(!!s.companions.benkei);
    view.setWeather(j.event?.weather || null);
    panel.replaceChildren(track());

    const left = h('div', { class: 'event-text', 'data-testid': 'event-text' });
    const right = h('div', { class: 'actions', 'data-testid': 'actions' });
    panel.append(h('div', { class: 'event-area' }, left, right));

    if (animating) {
      left.append(h('div', { class: 'title', text: j.dayInfo.action === 'camp' ? '야영 중…' : '걷는 중…' }));
      right.append(button('…', () => {}, { disabled: true }));
      return;
    }

    const di = j.dayInfo;
    left.append(
      h('div', { class: 'day', text: `${s.day}일차 · 오늘 한 일: ${ACTION_NAMES[di.action]}${di.changes.length ? ` (${di.changes.map((c) => `${c.label} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(', ')})` : ''}${di.starving ? ' · 식량이 없어 굶었다' : ''}` }),
      h('div', { class: 'title', text: j.event.title }),
      h('div', { class: 'body', text: j.event.text }),
    );
    if (j.event.resolved) {
      if (j.event.resultText) left.append(h('div', { class: 'result', text: j.event.resultText }));
      if (j.event.changes.length) left.append(changeChips(j.event.changes));
    }

    if (j.phase === 'event') {
      right.append(h('div', { class: 'muted small', text: '사건에 어떻게 대응할까?' }));
      // 고를 것이 넷 이상이면 두 줄로 놓아 패널 안에 다 보이게 한다 (싸움 선택지는 한 줄을 다 쓴다)
      if (j.event.choices.length >= 4) right.classList.add('grid2');
      j.event.choices.forEach((c) => {
        const b = button(c.label, () => choose(c.index), { cls: c.battle ? 'wide fight' : '', disabled: !c.enabled, why: c.why, testid: `choice-${c.index}` });
        if (c.battle) {
          // 싸우기 전에 양쪽 전투력과 승산을 보여 준다 (소지품에서 칼을 바꾸면 바로 반영)
          const p = previewBattle(s, c.battle);
          b.append(h('span', { class: `small ${p.odds === '우세' ? 'good-text' : p.odds === '열세' ? 'bad-text' : 'warn'}`, 'data-testid': `odds-${c.index}`, text: `우리 ${p.allyPower} : 상대 ${p.enemyPower} · 승산 ${p.odds} (${Math.round(p.winRate * 100)}%)` }));
        }
        right.append(b);
      });
    }
    if (j.event.shop && j.event.resolved && (j.phase === 'choose' || j.phase === 'arrive')) {
      left.append(button('행상인과 거래하기 (시간 들지 않음)', () => openShop(app, j.event.shop, { onChange: render }), { cls: 'small-btn inline', testid: 'open-peddler' }));
    }
    if (j.phase === 'choose') {
      right.append(h('div', { class: 'muted small', text: '다음 행동을 고르세요. 고르기 전에는 시간이 흐르지 않습니다.' }));
      for (const a of dayActions(s)) {
        const desc = a.id === 'camp' ? ' — 제자리에서 하루, 피로 회복' : a.id === 'continue' ? ` — ${v.target.name} 쪽으로 하루` : ` — ${(j.heading === 'to' ? v.from : v.to).name} 쪽으로 하루`;
        right.append(button(a.label + desc, () => act(a.id), { cls: a.id === 'continue' ? 'primary' : '', testid: `act-${a.id}` }));
      }
    } else if (j.phase === 'arrive') {
      const node = j.heading === 'to' ? v.to : v.from;
      right.append(
        h('div', { class: 'good-text', text: `${node.name}에 도착했다.` }),
        button(`${node.name}에 들어가기`, () => { enterArrived(s); app.go('location'); }, { cls: 'primary', testid: 'enter' }),
      );
    } else if (j.phase === 'collapse') {
      right.append(
        h('div', { class: 'bad-text', text: '피로가 한계에 닿았다. 눈앞이 캄캄해진다…' }),
        button('정신을 차린다', () => { collapseInfo = collapse(s); showCollapse(); }, { cls: 'danger', testid: 'collapse' }),
      );
    }
    app.renderHud();
  }

  function showCollapse() {
    panel.replaceChildren(
      h('h2', { text: '탈진 — 마을로 실려 왔다' }),
      h('div', { text: `지나가던 짐수레가 쓰러진 당신을 공방 마을까지 실어다 주었다. (${collapseInfo.daysLost}일 지남)` }),
      h('div', { class: 'chips' },
        h('span', { class: 'chip bad', text: `잃은 식량 ${collapseInfo.lostFood}` }),
        h('span', { class: 'chip bad', text: collapseInfo.lostRaw.length ? `잃은 원료: ${collapseInfo.lostRaw.join(', ')}` : '잃은 원료 없음' })),
      h('div', { class: 'muted small', text: '마을에서는 언제든 무료로 보급하고 쉴 수 있다. (임시 실패 규칙)' }),
      button('마을에서 정신을 차린다', () => app.go('location'), { cls: 'primary', testid: 'after-collapse' }),
    );
    app.renderHud();
  }

  async function playDay() {
    const j = s.journey;
    animating = true;
    render();
    if (j.dayInfo.action === 'camp') await view.camp(1.0);
    else await view.walk(j.heading === 'to' ? 1 : -1, 1.4);
    animating = false;
    view.showActor(j.event.art);
    render();
  }

  function choose(i) {
    const r = resolveEvent(s, i);
    if (!r.ok) { app.toast(r.reason); return; }
    app.save();
    if (s.journey?.event?.battle && !s.journey.event.battleShown) { app.go('battle', { back: 'travel' }); return; }
    render();
  }

  function act(id) {
    const r = takeDayAction(s, id);
    if (!r.ok) { app.toast(r.reason); return; }
    app.save();
    playDay();
  }

  if (params.justMoved) playDay();
  else {
    view.setNight(s.journey.dayInfo?.action === 'camp');
    view.dir = s.journey.heading === 'to' ? 1 : -1;
    view.layoutCharacters();
    view.showActor(s.journey.event?.art);
    render();
  }
  return { refresh: render };
}
