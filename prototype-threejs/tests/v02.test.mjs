// v0.2 규칙 테스트: 돈·상점·행상인, 카타나 수치와 코시라에, 장비, 전투, 연마, 예전 저장 불러오기.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, migrateState, makeRaw } from '../src/core/state.js';
import { depart, forceEvent, resolveEvent, checkRequires } from '../src/core/travel.js';
import { activitiesAt, doActivity } from '../src/core/location.js';
import { computeResult } from '../src/core/forge/result.js';
import {
  katanaStats, weaponPower, unitPower, mountPreview, mountKatana, equip, holderOf, partyView,
  applyBattleWear, polishWeapon, polishQuote,
} from '../src/core/weapons.js';
import { townShop, makePeddler, buy, sell, sellOffers, bladeValue } from '../src/core/economy.js';
import { previewBattle, fight, simulate, alliesOf, enemiesOf } from '../src/core/battle.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { KOSHIRAE, UNITS, BASE_WEAPONS } from '../src/data/gear.js';

const GOOD = { skin: { carbon: 0.72, uniformity: 80, impurity: 10 }, core: { carbon: 0.25, uniformity: 70, impurity: 20 } };
const SHAPING = { quality: 90, deviation: 4, overSections: [], coldHits: 0 };

// 공방을 거치지 않고 도신 기록을 만들어 소지품에 넣는다
function addBlade(s, { skin = GOOD.skin, core = GOOD.core, shaping = SHAPING, temp = 800 } = {}) {
  const res = computeResult({ skin, core, shaping, quench: { temp, evenness: 0.9 } });
  const record = { no: s.results.length + 1, day: s.day, ...res, skin, core, shaping };
  s.results.push(record);
  const blade = { uid: s.nextUid++, no: record.no };
  s.blades.push(blade);
  return { record, uid: blade.uid };
}

function katanaFor(s, opts, kosh = 'plain') {
  s.money += KOSHIRAE[kosh].cost;
  const { uid } = addBlade(s, opts);
  const r = mountKatana(s, uid, kosh);
  assert.ok(r.ok, r.reason);
  return r.weapon;
}

// ── 카타나 수치 ─────────────────────────────
test('카타나 네 수치는 도신 결과에서 나오고, 좋은 도신이 더 날카롭고 날이 오래 간다', () => {
  const s = createGame(1);
  const good = addBlade(s).record;
  const lowC = addBlade(s, { skin: { carbon: 0.3, uniformity: 80, impurity: 10 } }).record;
  const a = katanaStats(good, 'plain');
  const b = katanaStats(lowC, 'plain');
  for (const k of ['sharpness', 'retention', 'durability']) assert.ok(a[k] >= 5 && a[k] <= 100, k);
  assert.ok(a.sharpness > b.sharpness);
  assert.ok(a.retention > b.retention);
  assert.ok(a.weight > 1 && a.weight < 1.4);
  for (const k of ['sharpness', 'retention', 'durability', 'weight']) assert.ok(a.why[k].length > 0, `${k} 근거`);
});

test('좋은 코시라에는 정성 연마로 날카로움을 더하고 조금 더 무겁다', () => {
  const s = createGame(2);
  const rec = addBlade(s).record;
  const plain = katanaStats(rec, 'plain');
  const fine = katanaStats(rec, 'fine');
  assert.equal(fine.sharpness - plain.sharpness, Math.min(KOSHIRAE.fine.polish, 100 - plain.sharpness));
  assert.ok(fine.weight > plain.weight);
  assert.equal(fine.retention, plain.retention);
  assert.equal(fine.durability, plain.durability);
});

test('무기 성능은 날카로움이 크게, 무게가 작게 반영되고 휜 칼은 약해진다', () => {
  const base = { sharpness: 80, weight: 1.2, koshirae: 'plain', condition: 'ok' };
  const p0 = weaponPower(base);
  const sharper = weaponPower({ ...base, sharpness: 90 }) - p0;
  const heavier = weaponPower({ ...base, weight: 1.3 }) - p0;
  assert.ok(sharper > 0 && heavier > 0);
  assert.ok(sharper > heavier * 2, `날카로움 +10 → ${sharper}, 무게 +0.1kg → ${heavier}`);
  assert.ok(weaponPower({ ...base, condition: 'bent' }) < p0 * 0.7);
});

test('코시라에를 맞추면 돈·하루·식량을 쓰고 도신이 카타나가 된다', () => {
  const s = createGame(3);
  s.money = 100;
  const { uid } = addBlade(s);
  const day = s.day; const food = s.food;
  const p = mountPreview(s, uid, 'fine');
  assert.ok(p.ok);
  const r = mountKatana(s, uid, 'fine');
  assert.ok(r.ok);
  assert.equal(s.money, 100 - KOSHIRAE.fine.cost);
  assert.equal(s.day, day + 1);
  assert.equal(s.food, food - 1);
  assert.equal(s.blades.length, 0);
  assert.equal(s.weapons.length, 1);
  assert.equal(r.weapon.sharpness, p.stats.sharpness);
  assert.equal(weaponPower(r.weapon), p.power);
});

test('돈이 모자라거나 부러진 도신이면 코시라에를 맞출 수 없다', () => {
  const s = createGame(4);
  s.money = 10;
  const { uid } = addBlade(s);
  const r = mountKatana(s, uid, 'plain');
  assert.equal(r.ok, false);
  assert.match(r.reason, /돈이 모자랍니다/);
  assert.equal(s.blades.length, 1);
  assert.equal(s.money, 10);
  // 파단 도신
  const broken = addBlade(s);
  broken.record.soundness = { ...broken.record.soundness, label: '파단' };
  s.money = 500;
  const r2 = mountKatana(s, broken.uid, 'plain');
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /부러진/);
});

// ── 장비와 전투력 ───────────────────────────
test('카타나 한 자루는 한 사람만 쥐고, 내려놓으면 기본 무기로 돌아간다', () => {
  const s = createGame(5);
  s.companions.benkei = true;
  const w = katanaFor(s);
  assert.ok(equip(s, 'smith', w.uid).ok);
  assert.ok(equip(s, 'benkei', w.uid).ok);
  assert.equal(holderOf(s, w.uid), 'benkei');
  assert.equal(s.equip.smith, undefined);
  const smith = partyView(s).find((u) => u.id === 'smith');
  assert.equal(smith.weapon.name, BASE_WEAPONS.hammer.name);
  equip(s, 'benkei', null);
  assert.equal(holderOf(s, w.uid), null);
  assert.equal(equip(createGame(6), 'benkei', w.uid).ok, false);
});

test('기본 실력이 가장 크게 반영된다: 도공이 좋은 카타나를 쥐어도 기본 무기의 벤케이를 넘지 못한다', () => {
  const s = createGame(7);
  s.companions.benkei = true;
  const w = katanaFor(s, {}, 'fine');
  equip(s, 'smith', w.uid);
  const [smith, benkei] = partyView(s);
  assert.ok(weaponPower(w) > 85, `무기 성능 ${weaponPower(w)}`);
  assert.ok(benkei.power > smith.power);
  // 같은 폭이면 실력이 무기보다 더 크게 움직인다
  assert.ok(unitPower(35, 50) - unitPower(25, 50) > unitPower(25, 60) - unitPower(25, 50));
});

test('무기 성능도 적지 않게 반영된다: 같은 도공이라도 카타나가 늑대 무리 승산을 바꾼다', () => {
  const s = createGame(8);
  const bare = previewBattle(s, 'wolves');
  const w = katanaFor(s, {}, 'fine');
  equip(s, 'smith', w.uid);
  const armed = previewBattle(s, 'wolves');
  assert.ok(armed.allyPower > bare.allyPower + 20);
  assert.ok(armed.winRate - bare.winRate >= 0.5, `${bare.winRate} → ${armed.winRate}`);
});

test('미리 보기는 상태의 난수를 건드리지 않고, 같은 시드의 전투는 같은 결과를 낸다', () => {
  const a = createGame(9); const b = createGame(9);
  const rng = a.rngState;
  previewBattle(a, 'bandits');
  assert.equal(a.rngState, rng);
  const ra = fight(a, 'bandits'); const rb = fight(b, 'bandits');
  assert.deepEqual(ra.rounds, rb.rounds);
  assert.equal(ra.win, rb.win);
  assert.equal(a.money, b.money);
});

test('전투 결과는 돈·피로에 반영되고 기록이 남는다', () => {
  // 이기는 쪽: 벤케이 + 카타나 도공 vs 산적
  const s = createGame(10);
  s.companions.benkei = true;
  const w = katanaFor(s, {}, 'fine');
  equip(s, 'smith', w.uid);
  const money = s.money; const fat = s.fatigue;
  const r = fight(s, 'bandits');
  assert.ok(r.win);
  assert.ok(s.money >= money + 12 && s.money <= money + 28);
  assert.ok(s.fatigue >= fat + BALANCE.combat.fightFatigue);
  assert.equal(s.lastBattle, r);
  assert.ok(r.rounds.length > 0 && r.rounds.length <= BALANCE.combat.maxRounds);
  // 지는 쪽: 망치 든 도공 혼자 vs 낭인 → 돈은 그대로, 피로가 쌓인다
  const t = createGame(11);
  t.money = 50;
  const lost = fight(t, 'ronin');
  assert.equal(lost.win, false);
  assert.ok(t.fatigue >= 3);
});

test('simulate는 한쪽이 모두 쓰러지거나 정해진 합을 넘기면 끝난다', () => {
  const allies = alliesOf(createGame(12));
  const sim = simulate(allies, enemiesOf('dojo'), new Rng(5));
  const allDown = (l) => l.every((u) => u.hp === 0);
  assert.ok(allDown(sim.allies) || allDown(sim.enemies) || sim.rounds.length === BALANCE.combat.maxRounds);
  for (const round of sim.rounds) for (const act of round) assert.ok(act.dmg >= 1);
});

// ── 칼 상태와 연마 ──────────────────────────
test('날 유지력이 높을수록 싸울 때 덜 무뎌진다', () => {
  const hi = { uid: 1, name: 'a', sharpness: 90, sharpMax: 90, retention: 95, durability: 90, condition: 'ok', battles: 0 };
  const lo = { ...hi, uid: 2, retention: 30 };
  const a = applyBattleWear(hi, 10); const b = applyBattleWear(lo, 10);
  assert.ok(a.wear < b.wear, `${a.wear} < ${b.wear}`);
  assert.equal(hi.condition, 'ok');
  assert.equal(hi.battles, 1);
});

test('충격이 도신 내구력을 넘으면 이가 빠지고, 크게 넘으면 휜다', () => {
  const w = () => ({ uid: 1, name: 'a', sharpness: 90, sharpMax: 90, retention: 60, durability: 40, condition: 'ok', battles: 0 });
  const chip = w(); const r1 = applyBattleWear(chip, 50);
  assert.equal(r1.damage, 'chipped');
  assert.equal(chip.condition, 'chipped');
  assert.ok(chip.sharpness < 90 - r1.wear);
  const bend = w(); const r2 = applyBattleWear(bend, 40 + BALANCE.weapon.bendExcess);
  assert.equal(r2.damage, 'bent');
  assert.equal(bend.condition, 'bent');
  const ok = w(); assert.equal(applyBattleWear(ok, 30).damage, null);
});

test('연마소는 돈을 받고 날을 세우고 이 빠진 곳·휜 도신을 고친다', () => {
  const s = createGame(13);
  const w = katanaFor(s);
  assert.equal(polishQuote(w).sharpen, null);
  assert.equal(polishWeapon(s, w.uid, 'sharpen').ok, false);
  applyBattleWear(w, w.durability + 5);
  assert.equal(w.condition, 'chipped');
  const q = polishQuote(w);
  assert.equal(q.sharpen, BALANCE.weapon.polishCost + BALANCE.weapon.chipFixCost);
  s.money = q.sharpen - 1;
  assert.equal(polishWeapon(s, w.uid, 'sharpen').ok, false);
  s.money = q.sharpen;
  assert.ok(polishWeapon(s, w.uid, 'sharpen').ok);
  assert.equal(s.money, 0);
  assert.equal(w.sharpness, w.sharpMax);
  assert.equal(w.condition, 'ok');
  w.condition = 'bent';
  s.money = 50;
  assert.ok(polishWeapon(s, w.uid, 'straighten').ok);
  assert.equal(w.condition, 'ok');
  assert.equal(s.money, 50 - BALANCE.weapon.bendFixCost);
});

// ── 돈과 상점 ──────────────────────────────
test('마을 상점에서 사면 돈과 재고가 줄고, 산 원료에는 출처가 붙는다', () => {
  const s = createGame(14);
  const shop = townShop(s, 'village');
  const it = shop.stock.find((x) => x.item === 'raw');
  const money = s.money; const qty = it.qty;
  const r = buy(s, shop, it.key);
  assert.ok(r.ok);
  assert.equal(s.money, money - it.price);
  assert.equal(it.qty, qty - 1);
  assert.match(s.raw[0].origin, /마을 상점에서 구입/);
  assert.equal(s.raw[0].tired, false);
  // 같은 방문에서는 같은 재고
  assert.equal(townShop(s, 'village'), shop);
  s.money = 0;
  assert.equal(buy(s, shop, shop.stock[0].key).ok, false);
});

test('도신은 성하 마을 도검상이 공방 마을보다 비싸게 사 준다', () => {
  const s = createGame(15);
  const { uid, record } = addBlade(s);
  const village = sellOffers(s, townShop(s, 'village')).find((o) => o.key === `blade:${uid}`);
  const castle = sellOffers(s, townShop(s, 'castle')).find((o) => o.key === `blade:${uid}`);
  assert.equal(castle.price, bladeValue(record));
  assert.ok(castle.price > village.price);
  const money = s.money;
  assert.ok(sell(s, townShop(s, 'castle'), `blade:${uid}`).ok);
  assert.equal(s.money, money + castle.price);
  assert.equal(s.blades.length, 0);
});

test('쥐고 있던 카타나를 팔면 장비에서 빠진다', () => {
  const s = createGame(16);
  const w = katanaFor(s);
  equip(s, 'smith', w.uid);
  assert.ok(sell(s, townShop(s, 'castle'), `katana:${w.uid}`).ok);
  assert.equal(s.weapons.length, 0);
  assert.equal(s.equip.smith, undefined);
  assert.equal(partyView(s)[0].weapon.name, BASE_WEAPONS.hammer.name);
});

test('행상인 재고는 시드로 정해지고, 길 위 사건에서 거래를 고르면 붙는다', () => {
  const a = makePeddler(createGame(17));
  const b = makePeddler(createGame(17));
  assert.deepEqual(a.stock, b.stock);
  assert.ok(a.stock.length > 0);
  const s = createGame(18);
  assert.ok(depart(s, 'forest').ok);
  assert.ok(forceEvent(s, 'merchant').ok);
  assert.ok(resolveEvent(s, 0).ok);
  assert.ok(s.journey.event.shop);
  assert.ok(buy(s, s.journey.event.shop, s.journey.event.shop.stock[0].key).ok || s.money < s.journey.event.shop.stock[0].price);
});

test('산적에게 돈을 내주려면 돈이 있어야 하고, 싸우면 전투 기록이 사건에 붙는다', () => {
  assert.equal(checkRequires({ money: 5 }, { money: 15 }).enabled, false);
  const s = createGame(19);
  assert.ok(depart(s, 'forest').ok);
  assert.ok(forceEvent(s, 'bandit').ok);
  assert.ok(resolveEvent(s, 0).ok);
  const ev = s.journey.event;
  assert.ok(ev.battle);
  assert.equal(ev.battleShown, false);
  assert.equal(s.lastBattle, ev.battle);
  assert.match(ev.resultText, new RegExp(ev.battle.text.slice(0, 6)));
});

test('성하 마을 여관은 돈이 들고, 도장 대련은 한 번만 할 수 있다', () => {
  const s = createGame(20);
  s.location = 'castle';
  s.visit = { node: 'castle', counts: {} };
  s.fatigue = 6;
  s.money = 5;
  assert.equal(activitiesAt(s).find((a) => a.id === 'inn_stay').enabled, false);
  s.money = 20;
  assert.ok(doActivity(s, 'inn_stay').ok);
  assert.equal(s.money, 12);
  assert.equal(s.fatigue, 0);
  const r = doActivity(s, 'dojo');
  assert.ok(r.ok && r.battle);
  assert.equal(doActivity(s, 'dojo').ok, false);
  assert.equal(doActivity(s, 'koshirae').special, 'koshirae');
});

test('예전(v0.1) 저장을 불러오면 돈과 도신 목록이 채워진다', () => {
  const s = createGame(21);
  const { record } = addBlade(s);
  delete s.money; delete s.blades; delete s.weapons; delete s.equip; delete s.lastBattle;
  migrateState(s);
  assert.equal(s.money, BALANCE.start.money);
  assert.deepEqual(s.blades.map((b) => b.no), [record.no]);
  assert.deepEqual(s.weapons, []);
  assert.deepEqual(s.equip, {});
});

test('산 원료는 지친 상태여도 잡물이 섞이지 않는다', () => {
  const s = createGame(22);
  s.fatigue = BALANCE.fatigue.max - 1;
  const bought = makeRaw(s, 'ore', '상점', { bought: true });
  assert.equal(bought.tired, false);
});
