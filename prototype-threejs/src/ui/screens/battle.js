// 전투 화면: 이미 계산된 전투 기록(state.lastBattle)을 한 동작씩 재생하고, 끝나면 결과를 보여 준다.
// 길 위 사건에서 왔으면 이동 화면으로, 도장 대련에서 왔으면 장소 화면으로 돌아간다.
import { h, button, bar, changeChips } from '../dom.js';
import { BattleView } from '../../render/views/battleView.js';
import { edgeOf } from '../../core/travel.js';

export function mountBattle(app, params = {}) {
  const s = app.state;
  const b = s.lastBattle;
  const back = params.back || 'travel';
  const terrain = back === 'travel' && s.journey ? edgeOf(s.journey).terrain : 'dojo';
  const view = new BattleView(b, terrain);
  app.stage.setView(view);
  app.hud();
  // 다시 열어도 같은 전투를 또 보지 않도록 먼저 표시해 둔다
  if (back === 'travel' && s.journey?.event?.battle) { s.journey.event.battleShown = true; app.save(); }

  const units = [...b.allies, ...b.enemies];
  const hp = Object.fromEntries(units.map((u) => [u.id, u.maxHp]));
  const nameOf = Object.fromEntries(units.map((u) => [u.id, u.name]));
  const tags = {};
  for (const u of units) {
    const head = view.headOf(u.id);
    const tag = h('div', { class: `unit-tag passthrough ${u.side}`, style: { left: `${head.x * 4 - 52}px`, top: `${(head.y - 11) * 4}px` } });
    tags[u.id] = tag;
    app.ui.append(tag);
  }
  const chip = h('div', { class: 'route-chip passthrough', text: `${b.name}${b.nonLethal ? ' (대련)' : ''} · 우리 전투력 ${b.allyPower} : 상대 ${b.enemyPower} · 승산 ${b.odds} (${Math.round(b.winRate * 100)}%)` });
  const log = h('div', { class: 'battle-log', 'data-testid': 'battle-log' });
  const side = h('div', { class: 'battle-side', 'data-testid': 'battle-side' });
  const panel = h('div', { class: 'panel battle-panel' }, log, side);
  app.ui.append(chip, panel);

  let fast = false;
  let done = false;

  function renderTags() {
    for (const u of units) {
      tags[u.id].replaceChildren(
        h('div', { class: 'nm', text: `${u.name} ${hp[u.id]}/${u.maxHp}` }),
        bar(hp[u.id], u.maxHp, hp[u.id] > 0 ? (u.side === 'ally' ? 'hp' : 'hp enemy') : 'hp down'));
    }
  }

  function addLog(text, cls = '') {
    log.append(h('div', { class: `ln ${cls}`, text }));
    while (log.children.length > 7) log.firstChild.remove();
  }

  function renderSide() {
    side.replaceChildren(
      h('div', { class: 'small muted', text: '전투력 = 기본 실력 × 0.6 + 무기 성능 × 0.4' }),
      ...b.allies.map((a) => h('div', { class: 'small' }, h('b', { text: `${a.name} ` }), `기본 실력 ${a.skill} · ${a.weaponName} (성능 ${a.weaponPower}) → 전투력 ${a.power}`)),
      h('div', { class: 'small' }, h('b', { text: '상대 ' }), b.enemies.map((e) => `${e.name} ${e.power}`).join(' · ')),
      h('div', { class: 'grow' }),
      button('빨리 보기', () => { fast = true; }, { cls: 'center', testid: 'battle-skip' }),
    );
  }

  function showFloat(id, text) {
    const head = view.headOf(id);
    const el = h('div', { class: 'dmg passthrough', text, style: { left: `${head.x * 4}px`, top: `${(head.y - 2) * 4}px` } });
    app.ui.append(el);
    setTimeout(() => el.remove(), 900);
  }

  async function play() {
    addLog(`${b.name}과(와) 맞섰다. 승산 ${b.odds}.`, 'muted');
    for (let r = 0; r < b.rounds.length && !fast; r++) {
      addLog(`— ${r + 1}합 —`, 'muted');
      for (const act of b.rounds[r]) {
        if (fast) break;
        await view.playAction(act, 1.6);
        hp[act.target] = act.hp;
        showFloat(act.target, `-${act.dmg}`);
        renderTags();
        addLog(`${nameOf[act.actor]} → ${nameOf[act.target]} ${act.dmg}${act.ko ? ' · 쓰러졌다' : ''}`, b.allies.some((a) => a.id === act.actor) ? 'ally' : 'enemy');
      }
    }
    finish();
  }

  function finish() {
    if (done) return;
    done = true;
    Object.assign(hp, b.finalHp);
    view.applyFinal(b.finalHp);
    renderTags();
    if (b.timeout) addLog(`${b.rounds.length}합 안에 승부가 나지 않아 남은 기운으로 판가름했다.`, 'muted');
    // replaceChildren은 null을 글자로 넣으므로 빈 항목은 배열에서 뺀다
    side.replaceChildren(...[
      h('div', { class: `battle-result ${b.win ? 'good-text' : 'bad-text'}`, 'data-testid': 'battle-result', text: b.win ? '승리' : '패배' }),
      h('div', { class: 'small', text: b.text }),
      b.wearText ? h('div', { class: 'small warn', text: b.wearText }) : null,
      b.changes.length ? changeChips(b.changes) : null,
      h('div', { class: 'grow' }),
      button('계속', () => {
        if (back === 'travel') app.go('travel');
        else app.go('location', { last: params.last });
      }, { cls: 'primary center', testid: 'battle-continue' }),
    ].filter(Boolean));
    app.renderHud();
  }

  renderTags();
  renderSide();
  play();
  return {
    refresh: renderTags,
    unmount() { fast = true; },
  };
}

