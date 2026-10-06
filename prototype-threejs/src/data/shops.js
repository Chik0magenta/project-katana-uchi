// 상점과 행상인. 가격 단위는 문(文). 모든 값은 v0.2 임시안이다.
// sells: 파는 물건 (item: charcoal | food | raw, kind: 원료 종류) / qty: 한 번 방문했을 때의 재고
// buy: 사들이는 값 = 기준 값 × 비율 (원료·숯은 ITEM_VALUE, 도신·카타나는 core/economy.js의 감정가)
// Godot 이식: data/shops.json

export const ITEM_VALUE = {
  charcoal: 8,
  raw: { satetsu: 14, ore: 12, roadsand: 8, tamahagane: 40, scrap: 3 },
};

export const SHOPS = {
  village: {
    id: 'village', name: '공방 마을 상점',
    greeting: '"숯이며 쇠며, 원정 나가기 귀찮을 때 쓰시게. 칼은 성하 마을이 값을 더 쳐주지."',
    sells: [
      { item: 'charcoal', price: 9, qty: 3 },
      { item: 'raw', kind: 'satetsu', price: 20, qty: 1 },
      { item: 'raw', kind: 'ore', price: 16, qty: 1 },
    ],
    buy: { raw: 0.5, charcoal: 0.5, blade: 0.6, katana: 0.6 },
  },
  castle: {
    id: 'castle', name: '성하 마을 도검상',
    greeting: '"도신이든 카타나든 물건만 좋으면 제값을 쳐 드립니다."',
    sells: [
      { item: 'food', price: 4, qty: 10 },
      { item: 'charcoal', price: 10, qty: 2 },
      { item: 'raw', kind: 'roadsand', price: 12, qty: 2 },
      { item: 'raw', kind: 'tamahagane', price: 48, qty: 1 },
    ],
    buy: { raw: 0.5, charcoal: 0.5, blade: 1.0, katana: 1.0 },
  },
  // 길 위에서 만나는 행상인: pool에서 picks개를 골라 재고를 만들고, 가격이 ±priceJitter 흔들린다.
  peddler: {
    id: 'peddler', name: '떠돌이 행상인',
    greeting: '"오늘만 이 값이오. 내일이면 나는 저 고개 너머에 있소."',
    pool: [
      { item: 'food', price: 5, qty: [2, 4] },
      { item: 'charcoal', price: 11, qty: [1, 2] },
      { item: 'raw', kind: 'roadsand', price: 11, qty: [1, 2] },
      { item: 'raw', kind: 'satetsu', price: 19, qty: [1, 1] },
      { item: 'raw', kind: 'ore', price: 15, qty: [1, 1] },
    ],
    picks: 3, priceJitter: 0.2,
    buy: { raw: 0.6, charcoal: 0.6, blade: 0.45, katana: 0.45 },
  },
};
