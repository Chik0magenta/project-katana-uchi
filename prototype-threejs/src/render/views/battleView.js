// 전투 화면 그림: 길 위(지형 배경) 또는 도장 안에서 우리 편(왼쪽)과 상대(오른쪽)가 맞선다.
// 화면은 core/battle.js가 남긴 기록(rounds)을 한 동작씩 재생한다: 달려들기 → 베기 불꽃 → 맞은 쪽 흔들림 → 쓰러짐.
// Godot 이식: BattleScene + AnimationPlayer(또는 Tween). 동작 순서는 기록 배열을 그대로 따른다.
import { P } from '../palette.js';
import { drawSky, drawFar, drawMid, drawGround, drawDojo } from '../art/backgrounds.js';
import { SMITH_FRAMES, BENKEI, ART, FACES_LEFT } from '../art/sprites.js';
import { PixelCanvas } from '../pixel.js';
import { gridTex, Tweens, dispose, easeOut } from './common.js';
import { placeFoot } from '../stage.js';

export const FOOT_Y = 104;
const ALLY_X = { smith: 112, benkei: 84 };
const ENEMY_X = { 1: [214], 2: [208, 238], 3: [202, 228, 254] };

// 손에 든 카타나 (작은 사선)
function heldKatanaTex() {
  const pc = new PixelCanvas(14, 7);
  pc.line(4, 5, 13, 0, P.steelH); pc.line(4, 6, 12, 1, P.steel);
  pc.rect(3, 4, 1, 3, P.steelD);
  pc.line(0, 6, 2, 5, P.indigo);
  return pc.tex();
}

export class BattleView {
  constructor(battle, terrain) {
    this.battle = battle;
    this.terrain = terrain;
    this.tweens = new Tweens();
    this.units = {};
  }

  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.ink);
    if (this.terrain === 'dojo') {
      stage.sprite(drawDojo().tex(), 320, 180, 0, 0, 0);
    } else {
      const layers = [[drawSky(false), 11], [drawFar(this.terrain, false), 41], [drawMid(this.terrain, false), 54], [drawGround(this.terrain, false), 92]];
      layers.forEach(([pc, y], i) => stage.sprite(pc.tex(), 320, pc.h, 0, y, i));
    }
    const b = this.battle;
    for (const a of b.allies) {
      const grid = a.id === 'benkei' ? BENKEI : SMITH_FRAMES[0];
      this.addUnit(a, grid, false, ALLY_X[a.id] ?? 100, a.katanaUid !== null);
    }
    const xs = ENEMY_X[b.enemies.length] || ENEMY_X[3];
    b.enemies.forEach((e, i) => this.addUnit(e, ART[e.art], !FACES_LEFT.has(e.art), xs[i], false));
  }

  addUnit(u, grid, flip, x, katana) {
    const pc = gridTex(grid, flip);
    const m = this.stage.sprite(pc.tex(), pc.w, pc.h, 0, 0, 10);
    placeFoot(m, x, FOOT_Y);
    let held = null;
    if (katana) {
      held = this.stage.sprite(heldKatanaTex(), 14, 7, 0, 0, 11);
      placeFoot(held, x + 6, FOOT_Y - 8);
    }
    this.units[u.id] = { mesh: m, held, x, w: pc.w, h: pc.h, side: u.side };
  }

  // DOM 이름표를 놓을 자리 (무대 픽셀 좌표, 머리 위 가운데)
  headOf(id) {
    const u = this.units[id];
    return { x: u.x, y: FOOT_Y - u.h };
  }

  setX(u, x) {
    placeFoot(u.mesh, x, FOOT_Y);
    if (u.held) placeFoot(u.held, x + 6, FOOT_Y - 8);
  }

  // 한 동작: speed가 클수록 빠르다
  async playAction(act, speed = 1) {
    const a = this.units[act.actor]; const t = this.units[act.target];
    if (!a || !t) return;
    const dir = a.side === 'ally' ? 1 : -1;
    const reach = Math.max(6, Math.abs(t.x - a.x) - 18);
    await this.tweens.add(0.16 / speed, (k) => this.setX(a, a.x + dir * reach * easeOut(k)));
    const hx = t.x; const hy = FOOT_Y - Math.round(t.h * 0.55);
    this.stage.fx.emit('spark', hx, hy, act.ko ? 18 : 10, { speed: [30, 90] });
    this.stage.fx.emit('star', hx, hy, 5, { colors: [P.white, P.steelH] });
    if (act.ko) this.stage.addShake(1.5);
    const back = this.tweens.add(0.18 / speed, (k) => this.setX(a, a.x + dir * reach * (1 - k)));
    const shake = this.tweens.add(0.18 / speed, (k) => this.setX(t, t.x + Math.round(Math.sin(k * 30) * 2 * (1 - k))));
    await Promise.all([back, shake]);
    if (act.ko) await this.knockOut(act.target, speed);
    await this.tweens.wait(0.12 / speed);
  }

  async knockOut(id, speed = 1) {
    const u = this.units[id];
    await this.tweens.add(0.2 / speed, (k) => {
      u.mesh.material.opacity = 1 - 0.65 * k;
      if (u.held) u.held.material.opacity = 1 - k;
    });
  }

  // 빨리 보기: 남은 동작의 결과만 바로 반영
  applyFinal(finalHp) {
    for (const [id, hp] of Object.entries(finalHp)) {
      const u = this.units[id];
      if (!u) continue;
      this.setX(u, u.x);
      u.mesh.material.opacity = hp > 0 ? 1 : 0.35;
      if (u.held) u.held.material.opacity = hp > 0 ? 1 : 0;
    }
  }

  update(dt) { this.tweens.update(dt); }

  dispose() { dispose(this.stage.scene); }
}

