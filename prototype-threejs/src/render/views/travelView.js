// 이동 화면 그림: 지형별 길 풍경(가로 스크롤 레이어), 걷는 도공, 동행자, 사건 삽화, 비·야영.
import * as THREE from 'three';
import { P } from '../palette.js';
import { drawSky, drawFar, drawMid, drawGround } from '../art/backgrounds.js';
import { SMITH_FRAMES, SMITH_SIT, BENKEI, CAMPFIRE, ART, FACES_LEFT } from '../art/sprites.js';
import { gridTex, setTexture, Tweens, glowTexture, dispose } from './common.js';
import { placeFoot } from '../stage.js';

const ROAD_Y = 104;     // 인물 발밑 y
const SMITH_X = 130;

export class TravelView {
  constructor(terrain) {
    this.terrain = terrain;
    this.night = false;
    this.walking = 0;
    this.dir = 1;
    this.weather = null;
    this.tweens = new Tweens();
  }

  build(stage) {
    this.stage = stage;
    stage.scene.background.set(P.ink);
    this.layers = [];
    this.makeLayers();
    const s0 = gridTex(SMITH_FRAMES[0]);
    this.smith = stage.sprite(s0.tex(), s0.w, s0.h, 0, 0, 20);
    this.benkei = stage.sprite(gridTex(BENKEI).tex(), BENKEI[0].length, BENKEI.length, 0, 0, 19);
    this.benkei.visible = false;
    this.actor = null;
    this.fire = stage.sprite(gridTex(CAMPFIRE[0]).tex(), 10, 7, 0, 0, 18);
    this.fire.visible = false;
    this.fireGlow = stage.sprite(glowTexture(26, '#f08a2a'), 52, 52, 0, 0, 17, { additive: true, opacity: 0.6 });
    this.fireGlow.visible = false;
    this.nightTint = stage.quad(320, 180, 0, 0, 16, 0x1d1a2c, 0);
    this.rainT = 0;
    this.layoutCharacters();
  }

  makeLayers() {
    const st = this.stage;
    for (const l of this.layers) st.scene.remove(l.mesh);
    const defs = [
      { pc: drawSky(this.night), y: 11, speed: 2, z: 0 },
      { pc: drawFar(this.terrain, this.night), y: 41, speed: 6, z: 1 },
      { pc: drawMid(this.terrain, this.night), y: 54, speed: 18, z: 2 },
      { pc: drawGround(this.terrain, this.night), y: 92, speed: 40, z: 3 },
    ];
    this.layers = defs.map((d) => {
      const tex = d.pc.tex();
      tex.wrapS = THREE.RepeatWrapping;
      const mesh = st.sprite(tex, 320, d.pc.h, 0, d.y, d.z);
      return { mesh, tex, speed: d.speed, offset: 0 };
    });
  }

  setNight(night) {
    if (this.night === night) return;
    this.night = night;
    this.makeLayers();
    this.layoutCharacters();
  }

  setCompanion(on) { this.benkei.visible = on; this.layoutCharacters(); }

  layoutCharacters() {
    const camp = this.night;
    if (camp) {
      setTexture(this.smith, gridTex(SMITH_SIT).tex());
      this.smith.userData.w = 12; this.smith.userData.h = SMITH_SIT.length;
      this.smith.geometry.dispose(); this.smith.geometry = new THREE.PlaneGeometry(12, SMITH_SIT.length);
      placeFoot(this.smith, SMITH_X - 16, ROAD_Y);
      this.fire.visible = true; this.fireGlow.visible = true;
      placeFoot(this.fire, SMITH_X + 2, ROAD_Y);
      placeFoot(this.fireGlow, SMITH_X + 2, ROAD_Y + 22);
      placeFoot(this.benkei, SMITH_X + 24, ROAD_Y);
      this.benkei.scale.x = -1;
    } else {
      setTexture(this.smith, gridTex(SMITH_FRAMES[0], this.dir < 0).tex());
      this.smith.geometry.dispose(); this.smith.geometry = new THREE.PlaneGeometry(12, 20);
      this.smith.userData.w = 12; this.smith.userData.h = 20;
      placeFoot(this.smith, SMITH_X, ROAD_Y);
      this.fire.visible = false; this.fireGlow.visible = false;
      placeFoot(this.benkei, SMITH_X - 22 * this.dir, ROAD_Y + 1);
      this.benkei.scale.x = this.dir < 0 ? -1 : 1;
    }
  }

  // 하루 이동 연출 (dir: +1 목적지 쪽, -1 출발점 쪽)
  walk(dir, seconds = 1.6) {
    this.dir = dir;
    this.setNight(false);
    this.clearActor();
    this.layoutCharacters();
    this.walking = seconds;
    return this.tweens.wait(seconds);
  }

  camp(seconds = 1.2) {
    this.clearActor();
    this.setNight(true);
    return this.tweens.wait(seconds);
  }

  setWeather(w) { this.weather = w; }

  showActor(art) {
    this.clearActor();
    if (!art || !ART[art]) return;
    const grid = ART[art];
    // 사람은 오른쪽, 늑대는 왼쪽을 보도록 그려져 있다 → 도공을 마주 보게 뒤집는다
    const pc = gridTex(grid, FACES_LEFT.has(art) ? this.dir < 0 : this.dir > 0);
    const ax = SMITH_X + 56 * this.dir;
    const props = ['charcoal', 'berries', 'sand', 'rockfall'];
    const footY = props.includes(art) ? ROAD_Y + 2 : ROAD_Y;
    const m = this.stage.sprite(pc.tex(), pc.w, pc.h, 0, 0, 18);
    placeFoot(m, ax, footY);
    m.material.opacity = 0;
    this.actor = m;
    if (art === 'bandit') {
      const m2 = this.stage.sprite(pc.tex(), pc.w, pc.h, 0, 0, 18);
      placeFoot(m2, ax + 16 * this.dir, footY);
      m2.material.opacity = 0;
      this.actor2 = m2;
    }
    this.tweens.add(0.5, (k) => { m.material.opacity = k; if (this.actor2) this.actor2.material.opacity = k; });
  }

  clearActor() {
    if (this.actor) { this.stage.scene.remove(this.actor); this.actor = null; }
    if (this.actor2) { this.stage.scene.remove(this.actor2); this.actor2 = null; }
  }

  update(dt, t) {
    this.tweens.update(dt);
    if (this.walking > 0) {
      this.walking -= dt;
      for (const l of this.layers) {
        l.offset += l.speed * dt * this.dir;
        l.tex.offset.x = Math.round(l.offset) / 320;
      }
      const frame = Math.floor(t * 6) % 2;
      setTexture(this.smith, gridTex(SMITH_FRAMES[frame], this.dir < 0).tex());
      if (Math.random() < 0.3) this.stage.fx.emit('dust', SMITH_X - 4 * this.dir, ROAD_Y, 1, { angle: Math.PI + (this.dir < 0 ? Math.PI : 0) - Math.PI / 2 });
      if (this.benkei.visible) {
        const bob = frame;
        placeFoot(this.benkei, SMITH_X - 22 * this.dir, ROAD_Y + 1 - bob);
      }
      if (this.walking <= 0) setTexture(this.smith, gridTex(SMITH_FRAMES[0], this.dir < 0).tex());
    }
    if (this.fire.visible) {
      const f = Math.floor(t * 8) % 2;
      setTexture(this.fire, gridTex(CAMPFIRE[f]).tex());
      this.fireGlow.material.opacity = 0.45 + Math.sin(t * 13) * 0.08 + Math.random() * 0.05;
      if (Math.random() < 0.15) this.stage.fx.emit('ember', SMITH_X + 2, ROAD_Y - 6, 1);
    }
    const rain = this.weather === 'rain';
    const tint = rain ? 0.35 : 0;
    this.nightTint.material.opacity += (tint - this.nightTint.material.opacity) * Math.min(1, dt * 3);
    if (rain) {
      this.nightTint.material.color.set(0x3b3654);
      this.rainT -= dt;
      while (this.rainT <= 0) {
        this.rainT += 0.01;
        const x = Math.random() * 380 - 20; const y = 8 + Math.random() * 30;
        this.stage.fx.emit('rain', x, y, 1);
        this.stage.fx.emit('rain', x - 1, y - 2, 1);
      }
      if (Math.random() < 0.4) this.stage.fx.emit('splash', Math.random() * 320, ROAD_Y - 6 + Math.random() * 8, 2);
    }
    // 강변 물빛
    if (this.terrain === 'river' && Math.random() < 0.3) this.stage.fx.emit('star', Math.random() * 320, 72 + Math.random() * 20, 1, { colors: [P.foam, P.waterL] });
  }

  dispose() { dispose(this.stage.scene); }
}
