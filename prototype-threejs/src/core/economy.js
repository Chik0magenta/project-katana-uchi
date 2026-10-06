// 돈과 상점. 마을 상점 재고는 방문할 때마다 새로 채워지고(state.visit), 행상인 재고는 그날 사건에 붙는다.
// 사고팔기는 시간을 쓰지 않는다. Godot 이식: Economy 정적 함수 + Shop(Dictionary).
//
// shop = { id, name, greeting, buy: {raw, charcoal, blade, katana}, stock: [{ key, item, kind, name, price, qty }] }

import { BALANCE } from '../data/balance.js';
import { SHOPS, ITEM_VALUE } from '../data/shops.js';
import { MATERIALS } from '../data/materials.js';
import { KOSHIRAE } from '../data/gear.js';
import { withRng, makeRaw, addLog, recordOf } from './state.js';
import { holderOf, CONDITION_NAMES } from './weapons.js';

// ── 감정가 ────────────────────────────────
export function bladeValue(record) {
  if (!record) return 0;
  if (record.soundness.label === '파단') return 6;
  return Math.round(12 + record.score * 0.9);
}

export function katanaValue(state, w) {
  const base = bladeValue(recordOf(state, w.bladeNo)) * 1.2 + (KOSHIRAE[w.koshirae]?.value || 0);
  const edge = 0.6 + 0.4 * (w.sharpness / Math.max(1, w.sharpMax));
  return Math.round(base * edge * (w.condition === 'bent' ? 0.6 : 1));
}

// ── 상점 만들기 ───────────────────────────
export function itemName(it) {
  if (it.item === 'food') return '식량';
  if (it.item === 'charcoal') return '좋은 숯';
  return MATERIALS[it.kind].name;
}

export function itemDesc(it) {
  if (it.item === 'food') return '하루치 식량 1';
  if (it.item === 'charcoal') return '제철할 때 강재를 깨끗하게 한다';
  return MATERIALS[it.kind].note;
}

function stockOf(items) {
  return items.map((it) => ({
    key: it.kind ? `${it.item}:${it.kind}` : it.item, item: it.item, kind: it.kind || null,
    name: itemName(it), price: it.price, qty: it.qty,
  }));
}

function shell(def) {
  return { id: def.id, name: def.name, greeting: def.greeting, buy: { ...def.buy }, stock: [] };
}

// 마을 상점: 이번 방문 동안 같은 재고를 쓴다.
export function townShop(state, shopId) {
  if (!state.visit.shops) state.visit.shops = {};
  if (!state.visit.shops[shopId]) {
    const def = SHOPS[shopId];
    state.visit.shops[shopId] = { ...shell(def), stock: stockOf(def.sells) };
  }
  return state.visit.shops[shopId];
}

// 행상인: 물건 풀에서 몇 가지를 골라 값과 수량을 흔든다 (시드 난수).
export function makePeddler(state) {
  const def = SHOPS.peddler;
  return withRng(state, (rng) => {
    const pool = def.pool.slice();
    const picked = [];
    while (picked.length < def.picks && pool.length) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    const items = picked.map((p) => ({
      ...p, qty: rng.int(p.qty[0], p.qty[1]),
      price: Math.max(1, Math.round(p.price * (1 + rng.range(-def.priceJitter, def.priceJitter)))),
    }));
    return { ...shell(def), stock: stockOf(items) };
  });
}

// ── 사기 ──────────────────────────────────
export function canBuy(state, it) {
  if (it.qty <= 0) return { ok: false, reason: '다 팔렸습니다' };
  if (state.money < it.price) return { ok: false, reason: `돈 ${it.price}문 필요` };
  if (it.item === 'food' && state.food >= BALANCE.food.max) return { ok: false, reason: '식량을 더 들 수 없습니다' };
  return { ok: true };
}

export function buy(state, shop, key) {
  const it = shop.stock.find((x) => x.key === key);
  if (!it) return { ok: false, reason: '없는 물건' };
  const chk = canBuy(state, it);
  if (!chk.ok) return chk;
  state.money -= it.price;
  it.qty -= 1;
  if (it.item === 'food') state.food += 1;
  else if (it.item === 'charcoal') state.charcoal += 1;
  else state.raw.push(makeRaw(state, it.kind, `${shop.name}에서 구입 · ${state.day}일차`, { bought: true }));
  addLog(state, `${shop.name}: ${it.name} 구입 (${it.price}문)`);
  return { ok: true, text: `${it.name}을(를) ${it.price}문에 샀다.` };
}

// ── 팔기 ──────────────────────────────────
// 팔 수 있는 것: 원료, 좋은 숯, 도신, 카타나. 식량은 팔지 않는다.
export function sellOffers(state, shop) {
  const r = shop.buy;
  const out = [];
  for (const raw of state.raw) {
    out.push({ key: `raw:${raw.uid}`, type: 'raw', name: raw.name, sub: raw.origin, price: Math.max(1, Math.round((ITEM_VALUE.raw[raw.kind] || 1) * r.raw)) });
  }
  if (state.charcoal > 0) out.push({ key: 'charcoal', type: 'charcoal', name: '좋은 숯', sub: `${state.charcoal}자루 가짐`, price: Math.max(1, Math.round(ITEM_VALUE.charcoal * r.charcoal)) });
  for (const b of state.blades) {
    const rec = recordOf(state, b.no);
    if (!rec) continue;
    out.push({ key: `blade:${b.uid}`, type: 'blade', name: `${rec.no}번 도신 — ${rec.grade}`, sub: `${rec.score}점 · ${rec.soundness.label}`, price: Math.max(1, Math.round(bladeValue(rec) * r.blade)) });
  }
  for (const w of state.weapons) {
    const who = holderOf(state, w.uid);
    out.push({ key: `katana:${w.uid}`, type: 'katana', name: w.name, sub: `날카로움 ${w.sharpness}/${w.sharpMax} · ${CONDITION_NAMES[w.condition]}${who ? ' · 장비 중' : ''}`, price: Math.max(1, Math.round(katanaValue(state, w) * r.katana)) });
  }
  return out;
}

export function sell(state, shop, key) {
  const offer = sellOffers(state, shop).find((o) => o.key === key);
  if (!offer) return { ok: false, reason: '팔 물건이 없습니다' };
  const id = Number(key.split(':')[1]);
  if (offer.type === 'raw') state.raw.splice(state.raw.findIndex((x) => x.uid === id), 1);
  else if (offer.type === 'charcoal') state.charcoal -= 1;
  else if (offer.type === 'blade') state.blades.splice(state.blades.findIndex((x) => x.uid === id), 1);
  else {
    const who = holderOf(state, id);
    if (who) delete state.equip[who];
    state.weapons.splice(state.weapons.findIndex((x) => x.uid === id), 1);
  }
  state.money += offer.price;
  addLog(state, `${shop.name}: ${offer.name} 판매 (${offer.price}문)`);
  return { ok: true, text: `${offer.name}을(를) ${offer.price}문에 팔았다.` };
}
