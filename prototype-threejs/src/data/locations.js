// 장소별 활동. 활동은 길 위 사건을 일으키지 않는다.
// cost: { days, food, fatigue, money } / gives: { raw, charcoal, food(최대치까지), fatigueTo, hint, battle }
// special: 화면이 따로 여는 활동 (workshop 공방 / shop 상점 / koshirae 코시라에 / polish 연마소)
// limit: 한 번 방문해 할 수 있는 횟수 (다시 들어오면 초기화)
// Godot 이식: data/locations.json

export const LOCATIONS = {
  village: {
    scene: 'village',
    intro: '화덕 연기가 오르는 공방 마을. 여정을 준비하고 칼을 만든다.',
    activities: [
      { id: 'workshop', label: '공방에 들어가기', desc: '모은 재료로 칼을 만든다.', special: 'workshop' },
      { id: 'supply', label: '보급하기', desc: '식량을 가득 채운다. (마을 창고, 무료)', gives: { foodFill: true } },
      { id: 'rest', label: '집에서 쉬기 (1일)', desc: '하루를 쉬어 피로를 모두 푼다.', cost: { days: 1 }, gives: { fatigueTo: 0 } },
      { id: 'shop', label: '마을 상점', desc: '숯·원료 사기, 원료·도신 팔기', special: 'shop' },
    ],
  },
  inn: {
    scene: 'inn',
    intro: '처마 끝에 등롱이 흔들리는 찻집. 오가는 사람들이 쉬어 간다.',
    activities: [
      { id: 'onigiri', label: '주먹밥 얻기', desc: '식량 +3 (방문당 1회)', gives: { food: 3 }, limit: 1 },
      { id: 'inn_rest', label: '방에서 하룻밤 묵기 (1일)', desc: '피로를 모두 푼다. 식사가 나와 식량을 쓰지 않는다.', cost: { days: 1 }, gives: { fatigueTo: 0 }, limit: 1 },
      { id: 'rumor', label: '소문 듣기', desc: '제작에 도움이 될 이야기를 듣는다.', gives: { hint: 'rumor' } },
    ],
  },
  forest: {
    scene: 'forest',
    intro: '숯가마 연기가 삼나무 사이로 피어오른다. 숯꾼이 남는 숯을 나눠 준다.',
    activities: [
      { id: 'charcoal', label: '숯 굽기 돕기 (1일)', desc: '좋은 숯 +2. 제철할 때 쇠를 깨끗하게 한다.', cost: { days: 1, food: 1, fatigue: 1 }, gives: { charcoal: 2 }, limit: 2 },
      { id: 'camp_here', label: '근처에서 야영 (1일)', desc: '식량 -1, 피로 -4', cost: { days: 1, food: 1 }, gives: { fatigue: -4 } },
    ],
  },
  river: {
    scene: 'river',
    intro: '여울 바닥에 검은 사철이 띠를 이룬다. 홈통에 흘려 모래를 고른다.',
    activities: [
      { id: 'satetsu', label: '사철 일기 (1일)', desc: '강변 사철 +1 (탄소 많음 · 날용)', cost: { days: 1, food: 1, fatigue: 1 }, gives: { raw: 'satetsu' }, limit: 2 },
      { id: 'camp_here', label: '근처에서 야영 (1일)', desc: '식량 -1, 피로 -4', cost: { days: 1, food: 1 }, gives: { fatigue: -4 } },
    ],
  },
  mountain: {
    scene: 'mountain',
    intro: '바위산 중턱에 녹슨 빛 광맥이 드러나 있다.',
    activities: [
      { id: 'ore', label: '철광석 캐기 (1일)', desc: '산 철광석 +1 (탄소 적음 · 속심용)', cost: { days: 1, food: 1, fatigue: 1 }, gives: { raw: 'ore' }, limit: 2 },
      { id: 'camp_here', label: '근처에서 야영 (1일)', desc: '식량 -1, 피로 -4', cost: { days: 1, food: 1 }, gives: { fatigue: -4 } },
    ],
  },
  castle: {
    scene: 'castle',
    intro: '성 아래로 상가가 늘어선 마을. 칼집장이와 연마사, 도검상이 모여 산다.',
    activities: [
      { id: 'shop', label: '도검상', desc: '도신·카타나를 제값에 판다', special: 'shop' },
      { id: 'koshirae', label: '코시라에 맞추기', desc: '도신을 카타나로 만든다', special: 'koshirae' },
      { id: 'polish', label: '연마소', desc: '날 세우기 · 이 빠짐·휨 고치기', special: 'polish' },
      { id: 'inn_stay', label: '여관에서 묵기 (1일 · 8문)', desc: '피로를 모두 푼다', cost: { days: 1, money: 8 }, gives: { fatigueTo: 0 } },
      { id: 'dojo', label: '도장 대련', desc: '문하생 둘과 겨룬다 · 이기면 12문', gives: { battle: 'dojo' }, limit: 1 },
    ],
  },
};
