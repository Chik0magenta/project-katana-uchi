// 지도: 인접 노드 하나를 목적지로 고르고 출발한다. 여러 구간 예약·자동 경로는 없다.
import { h, button } from '../dom.js';
import { MapView, MAP_X, MAP_Y } from '../../render/views/mapView.js';
import { MAP } from '../../data/map.js';
import { neighbors, departPreview, depart } from '../../core/travel.js';

export function mountMap(app) {
  const s = app.state;
  const view = new MapView();
  app.stage.setView(view);
  app.hud();
  const adjacent = neighbors(s.location).map((n) => n.node);
  let selected = null; let hover = null;

  // 노드·길 이름표 (글자는 일반 폰트로 선명하게)
  for (const n of Object.values(MAP.nodes)) {
    const cls = n.id === s.location ? 'cur' : adjacent.includes(n.id) ? 'adj' : '';
    app.ui.append(h('div', { class: `node-label passthrough ${cls}`, text: n.name, style: { left: `${(MAP_X + n.x) * 4}px`, top: `${(MAP_Y + n.y + 9) * 4}px` } }));
  }
  for (const e of MAP.edges) {
    const a = MAP.nodes[e.a]; const b = MAP.nodes[e.b];
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    app.ui.append(h('div', { class: 'edge-label passthrough', text: `${e.days}일`, style: { left: `${(MAP_X + mx) * 4}px`, top: `${(MAP_Y + my) * 4 - 14}px` } }));
  }

  const panel = h('div', { class: 'panel map-panel' });
  app.ui.append(panel);

  function sync() { view.setState({ current: s.location, adjacent, selected, hover }); }

  function render() {
    panel.replaceChildren();
    const here = MAP.nodes[s.location];
    panel.append(
      h('div', { class: 'row' }, h('h2', { class: 'grow', text: '지도' }), button(`${here.name}(으)로 돌아가기`, () => app.go('location'), { cls: 'small-btn', testid: 'back-location' })),
      h('div', {}, h('span', { class: 'muted', text: '지금 있는 곳 ' }), h('b', { text: here.name })),
      h('div', { class: 'muted small', text: '연결된 장소 하나를 골라 한 구간씩 이동합니다. 여러 구간을 한 번에 예약할 수 없습니다.' }),
      h('div', { class: 'dest-list' }, neighbors(s.location).map(({ node, edge }) => button(`${MAP.nodes[node].name} — ${edge.name}, ${edge.days}일`, () => select(node), { cls: `dest ${selected === node ? 'selected' : ''}`, testid: `dest-${node}` }))),
    );
    if (selected) {
      const p = departPreview(s, selected);
      const dest = MAP.nodes[selected];
      panel.append(
        h('h3', { style: { marginBottom: '0' }, text: `${dest.name}(으)로` }),
        h('div', { class: 'small', text: dest.desc }),
        h('div', { class: 'info-grid' },
          h('span', { class: 'k', text: '길' }), h('span', { text: `${p.edge.name} (${p.terrainName})` }),
          h('span', { class: 'k', text: '거리' }), h('span', { text: `편도 ${p.days}일 · 왕복 ${p.days * 2}일` }),
          h('span', { class: 'k', text: '식량 예상' }), h('span', { text: `편도 ${p.oneWayFood} · 왕복 ${p.roundFood} (지금 ${s.food})` }),
          h('span', { class: 'k', text: '피로 예상' }), h('span', { text: `편도 +${p.fatigueOneWay} (지금 ${s.fatigue})` }),
        ),
        p.warnings.map((w) => h('div', { class: 'warn small', text: `⚠ ${w}` })),
        button(`출발하기 — 첫날 이동`, () => go(), { cls: 'primary center', testid: 'depart' }),
      );
    } else {
      panel.append(h('div', { class: 'hint', text: '지도에서 노랗게 깜빡이는 장소를 누르거나 위 목록에서 고르세요.' }));
    }
    sync();
  }

  function select(id) {
    const p = departPreview(s, id);
    if (!p.ok) { app.toast(p.reason); return; }
    selected = id;
    render();
  }

  function go() {
    const r = depart(s, selected);
    if (!r.ok) { app.toast(r.reason); return; }
    app.go('travel', { justMoved: true });
  }

  const canvas = app.stage.canvas;
  const onClick = (e) => {
    const p = app.stage.toPixel(e); const id = view.pick(p.x, p.y);
    if (!id) return;
    if (id === s.location) { app.toast('지금 있는 장소입니다.'); return; }
    select(id);
  };
  const onMove = (e) => {
    const p = app.stage.toPixel(e); const id = view.pick(p.x, p.y);
    if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : 'default'; sync(); }
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);
  render();
  return {
    refresh: render,
    unmount() { canvas.removeEventListener('click', onClick); canvas.removeEventListener('mousemove', onMove); canvas.style.cursor = 'default'; },
  };
}
