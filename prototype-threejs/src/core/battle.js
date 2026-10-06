// 간단한 전투: 도공과 동행자의 전투력을 상대와 비교해 합(round) 단위로 자동 진행한다.
// 유닛 전투력 = 기본 실력 × 0.6 + 무기 성능 × 0.4 (core/weapons.js).
// 한 합마다 살아 있는 유닛이 전투력 높은 순으로 한 번씩 공격하고, 피해 = 전투력 × 0.35 × (1 ± 0.3).
// 우리 편은 가장 많이 다친 상대부터 노리고, 상대는 무작위로 노린다.
// 결과는 고를 때 바로 계산해 상태에 반영하고, 전투 화면은 기록(log)을 재생만 한다(저장·새로고침에 안전).
// Godot 이식: Battle 정적 함수. simulate()는 그대로 옮기고, 화면은 rounds 배열을 차례로 연출한다.

import { BALANCE } from '../data/balance.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { Rng } from './rng.js';
import { withRng, clampStats, addLog, snapshotStats, diffStats } from './state.js';
import { partyView, applyBattleWear } from './weapons.js';

export function alliesOf(state) {
  return partyView(state).map((u) => ({
    id: u.id, side: 'ally', name: u.name, power: u.power, hp: u.hp, maxHp: u.hp,
    skill: u.skill, weaponName: u.weapon.name, weaponPower: u.weapon.power, katanaUid: u.weapon.katana?.uid ?? null,
  }));
}

export function enemiesOf(encId) {
  return ENCOUNTERS[encId].enemies.map((e, i) => ({
    id: `e${i}`, side: 'enemy', name: e.name, art: e.art, power: e.power, hp: e.hp, maxHp: e.hp,
  }));
}

// rng가 없으면 흔들림 없이 가장 약한 상대부터 노리는 '기댓값' 전투가 된다.
export function simulate(allies, enemies, rng) {
  const C = BALANCE.combat;
  const A = allies.map((u) => ({ ...u }));
  const E = enemies.map((u) => ({ ...u }));
  const all = [...A, ...E];
  const rounds = [];
  for (let r = 0; r < C.maxRounds; r++) {
    const order = all.filter((u) => u.hp > 0).sort((a, b) => b.power - a.power || (a.side === 'ally' ? -1 : 1));
    const acts = [];
    for (const u of order) {
      if (u.hp <= 0) continue;
      const foes = (u.side === 'ally' ? E : A).filter((f) => f.hp > 0);
      if (!foes.length) break;
      // 우리 편은 가장 많이 다친 상대를 노리고, 상대는 아무나 노린다 (기댓값 계산에서는 상대도 가장 약한 쪽을 노린다)
      const weakest = foes.reduce((m, f) => (f.hp < m.hp ? f : m));
      const target = u.side === 'ally' || !rng ? weakest : foes[Math.floor(rng.next() * foes.length)];
      const j = rng ? rng.range(-C.damageJitter, C.damageJitter) : 0;
      const dmg = Math.max(1, Math.round(u.power * C.damageRate * (1 + j)));
      target.hp = Math.max(0, target.hp - dmg);
      acts.push({ actor: u.id, target: target.id, dmg, ko: target.hp === 0, hp: target.hp });
    }
    rounds.push(acts);
    if (!A.some((u) => u.hp > 0) || !E.some((u) => u.hp > 0)) break;
  }
  const left = (list) => list.reduce((s, u) => s + u.hp, 0) / list.reduce((s, u) => s + u.maxHp, 0);
  const allyLeft = left(A); const enemyLeft = left(E);
  const wiped = !E.some((u) => u.hp > 0) || !A.some((u) => u.hp > 0);
  const win = !E.some((u) => u.hp > 0) ? true : !A.some((u) => u.hp > 0) ? false : allyLeft > enemyLeft;
  return { win, timeout: !wiped, rounds, allies: A, enemies: E, allyLeft, enemyLeft };
}

// 싸우기 전 비교: 양쪽 전투력 합과 승산(같은 조건으로 40번 겨뤄 본 비율). 상태의 난수는 건드리지 않는다.
export function previewBattle(state, encId) {
  const allies = alliesOf(state);
  const enemies = enemiesOf(encId);
  const rng = new Rng((state.rngState ^ 0x9e3779b9) >>> 0);
  let wins = 0;
  for (let i = 0; i < 40; i++) if (simulate(allies, enemies, rng).win) wins++;
  const winRate = wins / 40;
  const odds = winRate >= 0.7 ? '우세' : winRate >= 0.35 ? '호각' : '열세';
  const sum = (l) => l.reduce((s, u) => s + u.power, 0);
  return { allies, enemies, allyPower: sum(allies), enemyPower: sum(enemies), winRate, odds };
}

// 싸운다: 결과를 계산해 돈·식량·피로·칼 상태에 반영하고 기록을 남긴다.
export function fight(state, encId) {
  const enc = ENCOUNTERS[encId];
  const C = BALANCE.combat;
  const preview = previewBattle(state, encId);
  const { allies, enemies } = preview;
  const before = snapshotStats(state);
  const sim = withRng(state, (rng) => simulate(allies, enemies, rng));

  state.fatigue += C.fightFatigue;
  const smithDown = sim.allies.find((u) => u.id === 'smith')?.hp === 0;
  if (smithDown) state.fatigue += C.downFatigue;

  let reward = 0; let lostMoney = 0; let text;
  if (sim.win) {
    if (enc.win.money) { reward = withRng(state, (rng) => rng.int(enc.win.money[0], enc.win.money[1])); state.money += reward; }
    text = enc.win.text;
  } else {
    const L = enc.lose;
    if (L.moneyRatio) { lostMoney = Math.ceil(state.money * L.moneyRatio); state.money -= lostMoney; }
    if (L.food) state.food -= L.food;
    if (L.fatigue) state.fatigue += L.fatigue;
    text = L.text;
  }

  // 싸움에 쓴 카타나는 무뎌지고, 충격이 내구력을 넘으면 이가 빠지거나 휜다.
  const wear = [];
  for (const a of allies) {
    if (a.katanaUid === null) continue;
    const w = state.weapons.find((x) => x.uid === a.katanaUid);
    if (w) wear.push({ unit: a.name, ...applyBattleWear(w, enc.stress) });
  }
  clampStats(state);

  const record = {
    encId, name: enc.name, nonLethal: !!enc.nonLethal, win: sim.win, timeout: sim.timeout,
    allies, enemies, rounds: sim.rounds,
    finalHp: Object.fromEntries([...sim.allies, ...sim.enemies].map((u) => [u.id, u.hp])),
    odds: preview.odds, winRate: preview.winRate, allyPower: preview.allyPower, enemyPower: preview.enemyPower,
    reward, lostMoney, smithDown, wear, text, wearText: wearText(wear),
    changes: diffStats(before, snapshotStats(state)),
  };
  state.lastBattle = record;
  addLog(state, `전투(${enc.name}): ${sim.win ? '승리' : '패배'}`);
  return record;
}

export function wearText(wear) {
  return wear.map((w) => {
    const dmg = w.damage === 'bent' ? ' 충격을 못 이겨 도신이 휘었다.' : w.damage === 'chipped' ? ' 충격에 날이 이가 빠졌다.' : '';
    return `${w.unit}의 ${w.name}: 날카로움 ${w.before}→${w.after}.${dmg}`;
  }).join(' ');
}
