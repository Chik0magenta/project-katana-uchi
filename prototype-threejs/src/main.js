// 진입점: 화면 전환(라우터), 상단 정보 막대, 저장, 개발 수치 토글.
// Godot 이식: Main 씬이 화면 씬을 교체하고, GameState 오토로드가 state를 가진다.
import { Stage } from './render/stage.js';
import { createGame, migrateState } from './core/state.js';
import { BALANCE } from './data/balance.js';
import { MAP } from './data/map.js';
import { h, clear, bar } from './ui/dom.js';
import { mountTitle } from './ui/screens/title.js';
import { mountMap } from './ui/screens/map.js';
import { mountTravel } from './ui/screens/travel.js';
import { mountLocation } from './ui/screens/location.js';
import { mountWorkshop } from './ui/screens/workshop.js';
import { mountResult } from './ui/screens/result.js';
import { mountDev } from './ui/screens/dev.js';
import { mountBattle } from './ui/screens/battle.js';
import { openInventory } from './ui/screens/inventory.js';

const SAVE_KEY = 'katana-uchi-threejs-v01';

const SCREENS = {
  title: mountTitle, map: mountMap, travel: mountTravel, location: mountLocation,
  workshop: mountWorkshop, result: mountResult, dev: mountDev, battle: mountBattle,
};

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.ui = document.getElementById('ui');
    this.stage = new Stage(document.getElementById('stage'));
    this.state = null;
    this.devNumbers = false;
    this.current = null;
    this.screenName = null;
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2' || e.key === '`') { e.preventDefault(); this.toggleDevNumbers(); }
      if (e.key === 'Escape' && this.modal) { e.preventDefault(); this.modal.close(); }
      if ((e.key === 'i' || e.key === 'I') && this.hudEl?.isConnected) {
        if (this.modal) this.modal.close(); else this.openInventory();
      }
    });
    this.modal = null;
    this.fit();
    // 자동 검증 도구가 상태를 읽을 수 있도록 노출 (일반 플레이에는 영향 없음)
    window.__katana = this;
  }

  fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    this.root.style.transform = `translate(${(window.innerWidth - 1280 * s) / 2}px, ${(window.innerHeight - 720 * s) / 2}px) scale(${s})`;
  }

  newGame(seed) {
    // ?seed=123 으로 시작하면 같은 사건·재료가 나온다 (검증·재현용)
    const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
    this.state = createGame(seed ?? (urlSeed || Math.floor(Math.random() * 1e6)));
    this.go('location');
  }

  go(name, params = {}) {
    // 아직 보지 않은 전투가 있으면 이동 화면 대신 전투 화면을 먼저 연다 (새로고침·이어하기에도 안전)
    const ev = this.state?.journey?.event;
    if (name === 'travel' && ev?.battle && !ev.battleShown) { name = 'battle'; params = { back: 'travel' }; }
    this.modal?.close();
    if (this.current?.unmount) this.current.unmount();
    clear(this.ui);
    this.screenName = name;
    this.current = SCREENS[name](this, params) || {};
    if (this.state && !['title', 'dev'].includes(name)) this.save();
  }

  // 화면 다시 그리기(같은 화면 유지)
  refresh() { this.current?.refresh?.(); this.renderHud(); }

  hud() {
    this.hudEl = h('div', { class: 'hud' });
    this.ui.append(this.hudEl);
    this.renderHud();
    this.syncDevBadge();
    return this.hudEl;
  }

  renderHud() {
    const el = this.hudEl; const s = this.state;
    if (!el || !s || !el.isConnected) return;
    clear(el);
    const tired = s.fatigue >= BALANCE.fatigue.tired;
    const where = s.location ? MAP.nodes[s.location].name : '길 위';
    el.append(...[
      h('span', { class: 'logo', text: 'KATANA-UCHI' }),
      h('span', { class: 'item' }, h('b', { text: `${s.day}일차` }), h('span', { class: 'muted small', text: where })),
      h('span', { class: 'item', title: '상점에서 쓰고, 도신·카타나를 팔아 번다' }, h('span', { class: 'label', text: '돈' }), h('b', { 'data-testid': 'hud-money', text: `${s.money}문` })),
      h('span', { class: 'item', title: '이동·노숙·채집하는 날마다 줄어든다' }, h('span', { class: 'label', text: '식량' }), bar(s.food, BALANCE.food.max), h('b', { text: `${s.food}/${BALANCE.food.max}` })),
      h('span', { class: 'item', title: `${BALANCE.fatigue.tired} 이상이면 지침, ${BALANCE.fatigue.max}이면 탈진` }, h('span', { class: 'label', text: '피로' }), bar(s.fatigue, BALANCE.fatigue.max, tired ? 'tired' : 'fatigue'), h('b', { text: `${s.fatigue}/${BALANCE.fatigue.max}` }), tired ? h('span', { class: 'tag', text: '지침' }) : null),
      h('span', { class: 'item', title: '좋은 숯: 제철할 때 강재를 깨끗하게 한다' }, h('span', { class: 'label', text: '숯' }), h('b', { text: s.charcoal })),
      h('span', { class: 'item', title: s.raw.map((r) => `${r.name} (${r.origin})`).join('\n') || '원료 없음' }, h('span', { class: 'label', text: '원료' }), h('b', { text: s.raw.length })),
      Object.keys(s.companions).length ? h('span', { class: 'item' }, h('span', { class: 'label', text: '동행' }), h('b', { text: '벤케이' })) : null,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn inv-btn', onClick: () => this.openInventory(), 'data-testid': 'open-inventory', title: 'I 키' }, `소지품 · 도신 ${s.blades.length} · 칼 ${s.weapons.length}`),
      h('button', { class: 'btn', onClick: () => this.go('title'), text: '제목으로' }),
    ].filter(Boolean));
  }

  openInventory() { if (this.state) openInventory(this); }

  toast(msg, ms = 2200) {
    const t = h('div', { class: 'toast', text: msg, 'data-testid': 'toast' });
    this.root.append(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, ms);
  }

  syncDevBadge() {
    this.ui.querySelector('.dev-badge')?.remove();
    if (this.devNumbers && this.hudEl?.isConnected) this.ui.append(h('div', { class: 'dev-badge', text: '개발 수치 표시 중 (F2)' }));
  }

  toggleDevNumbers() {
    this.devNumbers = !this.devNumbers;
    this.syncDevBadge();
    this.toast(this.devNumbers ? '개발 수치 표시: 켬 (F2)' : '개발 수치 표시: 끔 (F2)', 1200);
    if (this.screenName && this.screenName !== 'title') {
      // 공방은 진행 중인 세션을 잃지 않게 화면만 다시 그린다
      if (this.current?.refresh) { this.current.refresh(); }
    }
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state: this.state, screen: this.screenName === 'travel' ? 'travel' : this.state.location ? 'location' : 'travel' })); } catch { /* 저장 불가 환경 */ }
  }

  loadSave() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  continueGame() {
    const sv = this.loadSave();
    if (!sv) return;
    this.state = migrateState(sv.state);
    this.go(this.state.journey ? 'travel' : 'location');
  }
}


const app = new App();
app.go('title');
