// 지도 화면 그림: 그래프 지도, 인접 노드 표시, 선택 표시, 현재 위치 깃발, 연기·물빛.
import { P } from '../palette.js';
import { drawMap, ringSprite, markerSprite, MAP_W, MAP_H } from '../art/backgrounds.js';
import { MAP } from '../../data/map.js';
import { dispose } from './common.js';

export const MAP_X = 0;
export const MAP_Y = 11;

export class MapView {
  constructor() {
    this.adjacent = [];
    this.selected = null;
    this.hover = null;
    this.current = null;
  }

  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.ink);
    stage.sprite(drawMap().tex(), MAP_W, MAP_H, MAP_X, MAP_Y, 0);
    const ringAdj = ringSprite(P.yellow).tex();
    const ringSel = ringSprite(P.white, 9).tex();
    const ringHover = ringSprite(P.paper).tex();
    this.rings = {};
    for (const n of Object.values(MAP.nodes)) {
      const r = { adj: stage.sprite(ringAdj, 17, 17, MAP_X + n.x - 8, MAP_Y + n.y - 8, 5), sel: stage.sprite(ringSel, 21, 21, MAP_X + n.x - 10, MAP_Y + n.y - 10, 6), hov: stage.sprite(ringHover, 17, 17, MAP_X + n.x - 8, MAP_Y + n.y - 8, 4) };
      r.adj.visible = r.sel.visible = r.hov.visible = false;
      this.rings[n.id] = r;
    }
    this.marker = stage.sprite(markerSprite().tex(), 9, 14, 0, 0, 8);
    this.marker.visible = false;
    this.smokeT = 0;
  }

  setState({ current, adjacent, selected, hover }) {
    this.current = current; this.adjacent = adjacent; this.selected = selected; this.hover = hover;
    for (const [id, r] of Object.entries(this.rings)) {
      r.adj.visible = adjacent.includes(id);
      r.sel.visible = id === selected;
      r.hov.visible = id === hover && id !== selected;
    }
    if (current) {
      const n = MAP.nodes[current];
      this.marker.visible = true;
      this.markerBase = { x: MAP_X + n.x + 3, y: MAP_Y + n.y - 18 };
    }
  }

  // 화면 좌표 → 노드 id
  pick(px, py) {
    let best = null; let bd = 11;
    for (const n of Object.values(MAP.nodes)) {
      const d = Math.hypot(px - (MAP_X + n.x), py - (MAP_Y + n.y));
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  update(dt, t) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 5);
    for (const id of this.adjacent) this.rings[id].adj.material.opacity = pulse;
    if (this.marker.visible) {
      const bob = Math.round(Math.sin(t * 3) * 1);
      this.marker.position.x = Math.round(this.markerBase.x) + 4.5;
      this.marker.position.y = -(Math.round(this.markerBase.y + bob) + 7);
    }
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.35;
      const v = MAP.nodes.village; const f = MAP.nodes.forest;
      this.stage.fx.emit('smoke', MAP_X + v.x + 9, MAP_Y + v.y - 15, 1);
      this.stage.fx.emit('smoke', MAP_X + f.x + 1, MAP_Y + f.y - 2, 1);
      const u = Math.random();
      this.stage.fx.emit('star', MAP_X + 214 - 80 * u + (Math.random() - 0.5) * 5, MAP_Y + 72 + 96 * u, 1, { colors: [P.foam, P.waterL] });
    }
  }

  dispose() { dispose(this.stage.scene); }
}
