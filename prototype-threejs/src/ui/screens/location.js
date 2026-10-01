// 장소: 채집·보급·휴식·소문·공방. 떠날 때는 지도에서 다음 구간을 고른다.
import { h, button, changeChips } from '../dom.js';
import { LocationView } from '../../render/views/locationView.js';
import { MAP } from '../../data/map.js';
import { LOCATIONS } from '../../data/locations.js';
import { activitiesAt, doActivity } from '../../core/location.js';
import { collapse } from '../../core/travel.js';

export function mountLocation(app) {
  const s = app.state;
  const node = MAP.nodes[s.location];
  const view = new LocationView(s.location, !!s.companions.benkei);
  app.stage.setView(view);
  app.hud();
  app.ui.append(h('div', { class: 'loc-name passthrough', text: node.name }));
  const panel = h('div', { class: 'panel loc-panel' });
  app.ui.append(panel);
  let last = null;

  function render() {
    const left = h('div', { class: 'left' },
      h('h2', { text: node.name }),
      h('div', { text: LOCATIONS[s.location].intro }),
      h('div', { class: 'msg', 'data-testid': 'loc-msg', text: last ? last.text : '' }),
      last?.changes?.length ? changeChips(last.changes) : null,
      h('div', { class: 'grow' }),
      rawList(),
    );
    const right = h('div', { class: 'right' });
    for (const a of activitiesAt(s)) {
      const used = a.limit ? ` (${a.used}/${a.limit})` : '';
      const b = button(`${a.label}${used}`, () => act(a), { disabled: !a.enabled, why: a.why, cls: a.special ? 'primary' : '', testid: `act-${a.id}` });
      b.append(h('span', { class: 'muted small', text: a.desc }));
      right.append(b);
    }
    right.append(button('지도 열기 — 다음 목적지 고르기', () => app.go('map'), { cls: 'center wide', testid: 'open-map' }));
    panel.replaceChildren(left, right);
    app.renderHud();
  }

  function rawList() {
    if (!s.raw.length) return h('div', { class: 'muted small', text: '가진 원료 없음 — 강변(사철)·산지(철광석)에서 구할 수 있다.' });
    return h('div', { class: 'small' }, h('span', { class: 'muted', text: '가진 원료: ' }), s.raw.map((r) => `${r.name}(${r.origin})`).join(', '));
  }

  function act(a) {
    const r = doActivity(s, a.id);
    if (!r.ok) { app.toast(r.reason); return; }
    if (r.special === 'workshop') { app.go('workshop'); return; }
    view.playActivity(a.id);
    last = r;
    if (r.collapsed) {
      const info = collapse(s);
      app.toast(`탈진해 마을로 실려 왔다. 잃은 원료 ${info.lostRaw.length}개, 식량 ${info.lostFood}`, 3500);
      app.go('location');
      return;
    }
    app.save();
    render();
  }

  render();
  return { refresh: render };
}
