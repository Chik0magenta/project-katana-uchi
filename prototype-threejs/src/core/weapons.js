// 무기: 도신 + 코시라에 → 카타나. 네 수치(날카로움·날 유지력·도신 내구력·무게)와
// 전투에 쓰는 '무기 성능', 장비, 연마, 전투 뒤 칼 상태 변화를 다룬다.
// 수치는 모두 도신 결과 기록(core/forge/result.js)에서 나온다. 무작위 없음.
// Godot 이식: Weapons 정적 함수 + Katana(Resource 또는 Dictionary).
//
// katana = {
//   uid, name, bladeNo, grade, koshirae,
//   sharpMax, sharpness(지금 날카로움), retention, durability, weight(kg),
//   condition: 'ok' | 'chipped'(이 빠짐) | 'bent'(휨), battles
// }

import { BALANCE } from '../data/balance.js';
import { KOSHIRAE, KOSHIRAE_DAYS, UNITS, BASE_WEAPONS } from '../data/gear.js';
import { clamp, eat, clampStats, addLog, snapshotStats, diffStats, recordOf } from './state.js';

const pctC = (c) => `${c.toFixed(2)}%`;

// 도신 기록 + 코시라에 등급 → 카타나 수치와 그 근거
export function katanaStats(record, koshiraeId) {
  const k = KOSHIRAE[koshiraeId];
  const W = BALANCE.weapon;
  const H = record.hardening.value;
  const { skin, core } = record;
  const shapeQ = record.shape.quality;
  const sound = record.soundness.label;
  const { crack, warp } = record.soundness;
  const over = record.shaping?.overSections?.length || 0;

  // 날카로움: 경화가 가장 크고, 형상과 피철 균일도가 뒤따른다. 금이 간 칼은 날이 서지 않는다.
  const soundSharp = { 정상: 1, 휨: 0.9, 균열: 0.75, 파단: 0 }[sound];
  const sharpBase = 0.5 * H + 0.3 * shapeQ + 0.2 * skin.uniformity - (record.hardening.localUneven ? 5 : 0);
  const sharpness = Math.round(clamp(sharpBase * soundSharp + k.polish, 5, 100));

  // 날 유지력: 단단히 굳고 탄소가 넉넉하며 깨끗한 피철일수록 오래 간다.
  const carbonPart = clamp((skin.carbon - 0.45) / 0.4, 0, 1) * 40;
  const retention = Math.round(clamp(0.35 * H + carbonPart + 0.25 * skin.uniformity - 0.35 * skin.impurity + 10, 5, 100));

  // 도신 내구력: 질긴 속심(탄소 적은 심철)과 피철·심철 탄소 차가 버팀목, 금·휨 위험과 불순물이 약점.
  const toughCore = clamp((0.6 - core.carbon) / 0.4, 0, 1) * 25;
  const diff = clamp((skin.carbon - core.carbon) / 0.5, 0, 1) * 15;
  const soundDur = { 정상: 0, 휨: -10, 균열: -20, 파단: -40 }[sound];
  const durability = Math.round(clamp(
    30 + toughCore + diff + 0.2 * core.uniformity - 0.25 * (skin.impurity + core.impurity) / 2
    - crack * 30 - warp * 15 + (shapeQ - 70) * 0.2 - 4 * over + soundDur, 5, 100));

  // 무게: 기본 도신 무게에서 지나치게 두드린 구간만큼 가볍고, 덜 편 도신은 무겁다. 코시라에 무게를 더한다.
  const bladeW = W.bladeWeight - W.overThin * over + W.roughThick * Math.max(0, 70 - shapeQ);
  const weight = Math.round((bladeW + k.weight) * 100) / 100;

  const why = {
    sharpness: `경화 ${H} · 형상 ${shapeQ} · 피철 균일도 ${skin.uniformity}${sound !== '정상' ? ` · ${sound}` : ''}${k.polish ? ` · 정성 연마 +${k.polish}` : ''}`,
    retention: `경화 ${H} · 피철 탄소 ${pctC(skin.carbon)} · 피철 불순도 ${skin.impurity}`,
    durability: `심철 탄소 ${pctC(core.carbon)} · 탄소 차 ${pctC(Math.max(0, skin.carbon - core.carbon))} · 균열 위험 ${crack} · 휨 위험 ${warp}`,
    weight: `도신 ${bladeW.toFixed(2)}kg + 코시라에 ${k.weight.toFixed(2)}kg${over ? ` · 과타격 ${over}구간` : ''}`,
  };
  return { sharpness, retention, durability, weight, why };
}

// 무기 성능: 날카로움이 크게, 무게가 작게 반영된다. 휜 칼은 제 힘을 못 쓴다.
export function weaponPower(w) {
  const W = BALANCE.weapon;
  const grip = KOSHIRAE[w.koshirae]?.grip || 0;
  const p = w.sharpness * W.powerSharp + (w.weight - W.weightBase) * W.powerWeight + grip;
  return Math.max(1, Math.round(p * (w.condition === 'bent' ? W.bentFactor : 1)));
}

// 유닛 전투력: 기본 실력이 가장 크게, 무기 성능이 그다음으로 반영된다.
export function unitPower(skill, power) {
  const C = BALANCE.combat;
  return Math.round(skill * C.skillWeight + power * C.weaponWeight);
}

export function isBroken(record) { return !record || record.soundness.label === '파단'; }

// 소지한 도신 목록 (기록과 함께)
export function ownedBlades(state) {
  return state.blades.map((b) => ({ ...b, record: recordOf(state, b.no) })).filter((b) => b.record);
}

export function mountableBlades(state) { return ownedBlades(state).filter((b) => !isBroken(b.record)); }

export function mountPreview(state, bladeUid, koshiraeId) {
  const b = ownedBlades(state).find((x) => x.uid === bladeUid);
  const k = KOSHIRAE[koshiraeId];
  if (!b || !k) return { ok: false, reason: '도신과 코시라에를 고르세요.' };
  if (isBroken(b.record)) return { ok: false, reason: '부러진 도신에는 코시라에를 맞출 수 없습니다.' };
  const stats = katanaStats(b.record, koshiraeId);
  const power = weaponPower({ ...stats, koshirae: koshiraeId, condition: 'ok' });
  const warnings = [];
  if (state.money < k.cost) warnings.push(`돈이 모자랍니다 (${k.cost}문 필요, 지금 ${state.money}문)`);
  return { ok: state.money >= k.cost, reason: warnings[0] || null, stats, power, cost: k.cost, days: KOSHIRAE_DAYS, record: b.record, warnings };
}

export function mountKatana(state, bladeUid, koshiraeId) {
  const p = mountPreview(state, bladeUid, koshiraeId);
  if (!p.ok) return p;
  const k = KOSHIRAE[koshiraeId];
  const before = snapshotStats(state);
  state.money -= k.cost;
  state.day += KOSHIRAE_DAYS;
  const { starving } = eat(state, KOSHIRAE_DAYS);
  state.blades.splice(state.blades.findIndex((x) => x.uid === bladeUid), 1);
  const rec = p.record;
  const w = {
    uid: state.nextUid++, name: `${rec.no}번 도신 카타나`, bladeNo: rec.no, grade: rec.grade, koshirae: koshiraeId,
    sharpMax: p.stats.sharpness, sharpness: p.stats.sharpness, retention: p.stats.retention,
    durability: p.stats.durability, weight: p.stats.weight, condition: 'ok', battles: 0,
  };
  state.weapons.push(w);
  clampStats(state);
  addLog(state, `코시라에: ${w.name} (${k.name})`);
  return { ok: true, weapon: w, changes: diffStats(before, snapshotStats(state)), starving };
}

// ── 장비 ─────────────────────────────────
export function partyIds(state) { return ['smith', ...(state.companions.benkei ? ['benkei'] : [])]; }

export function holderOf(state, weaponUid) {
  return Object.entries(state.equip).find(([, id]) => id === weaponUid)?.[0] || null;
}

// 카타나 한 자루는 한 사람만 쥔다. weaponUid가 null이면 기본 무기로 돌아간다.
export function equip(state, unitId, weaponUid) {
  if (!partyIds(state).includes(unitId)) return { ok: false, reason: '함께 있지 않은 사람입니다.' };
  if (weaponUid === null || weaponUid === undefined) { delete state.equip[unitId]; return { ok: true }; }
  if (!state.weapons.some((w) => w.uid === weaponUid)) return { ok: false, reason: '없는 칼입니다.' };
  const other = holderOf(state, weaponUid);
  if (other) delete state.equip[other];
  state.equip[unitId] = weaponUid;
  return { ok: true };
}

export function heldWeapon(state, unitId) {
  const w = state.weapons.find((x) => x.uid === state.equip[unitId]);
  if (w) return { name: w.name, power: weaponPower(w), katana: w };
  const b = BASE_WEAPONS[UNITS[unitId].baseWeapon];
  return { name: b.name, power: b.power, katana: null };
}

export function partyView(state) {
  return partyIds(state).map((id) => {
    const u = UNITS[id];
    const weapon = heldWeapon(state, id);
    return { id, name: u.name, skill: u.skill, hp: u.hp, weapon, power: unitPower(u.skill, weapon.power) };
  });
}

// ── 연마소 ────────────────────────────────
export function polishQuote(w) {
  const W = BALANCE.weapon;
  return {
    sharpen: (w.sharpness < w.sharpMax || w.condition === 'chipped') ? W.polishCost + (w.condition === 'chipped' ? W.chipFixCost : 0) : null,
    straighten: w.condition === 'bent' ? W.bendFixCost : null,
  };
}

// kind: 'sharpen'(날 세우기, 이 빠진 곳 포함) | 'straighten'(휜 칼 바로잡기)
export function polishWeapon(state, weaponUid, kind) {
  const w = state.weapons.find((x) => x.uid === weaponUid);
  if (!w) return { ok: false, reason: '없는 칼입니다.' };
  const cost = polishQuote(w)[kind];
  if (cost === null || cost === undefined) return { ok: false, reason: kind === 'sharpen' ? '날이 이미 서 있습니다.' : '휘지 않았습니다.' };
  if (state.money < cost) return { ok: false, reason: `돈이 모자랍니다 (${cost}문 필요)` };
  state.money -= cost;
  let text;
  if (kind === 'sharpen') {
    text = `${w.name}의 날을 다시 세웠다. 날카로움 ${w.sharpness} → ${w.sharpMax}${w.condition === 'chipped' ? ' (이 빠진 곳도 갈아 냈다)' : ''}.`;
    w.sharpness = w.sharpMax;
    if (w.condition === 'chipped') w.condition = 'ok';
  } else {
    w.condition = 'ok';
    text = `${w.name}의 휜 도신을 바로잡았다.`;
  }
  addLog(state, `연마소: ${text}`);
  return { ok: true, text, cost };
}

// ── 전투 뒤 칼 상태 ───────────────────────
// 싸울 때마다 무뎌지고(날 유지력이 높을수록 덜), 충격(stress)이 도신 내구력을 넘으면 이가 빠지거나 휜다.
export function applyBattleWear(w, stress) {
  const W = BALANCE.weapon;
  const before = w.sharpness;
  const wear = Math.max(1, Math.round(W.wearBase * (1 - w.retention / W.wearRetention)));
  w.sharpness = Math.max(1, w.sharpness - wear);
  let damage = null;
  const excess = stress - w.durability;
  if (excess > 0) {
    if (excess >= W.bendExcess && w.condition !== 'bent') {
      w.condition = 'bent'; damage = 'bent';
    } else {
      w.sharpness = Math.max(1, w.sharpness - Math.round(W.chipBase + excess * W.chipPerExcess));
      if (w.condition === 'ok') w.condition = 'chipped';
      damage = 'chipped';
    }
  }
  w.battles += 1;
  return { uid: w.uid, name: w.name, before, after: w.sharpness, wear, damage, stress, durability: w.durability };
}

export const CONDITION_NAMES = { ok: '멀쩡함', chipped: '이 빠짐', bent: '휨' };
