// 사건 묶음. kind: travel(이동한 날) / camp(노숙한 날)
// terrains: 이 사건이 나올 수 있는 길의 지형 ('any' = 모든 지형)
// choices가 비어 있으면 대응 없이 바로 행동 선택으로 넘어간다('아무 일 없음' 등).
// requires: { food, charcoal, raw, companion } / effects: { food, fatigue, charcoal, addRaw, loseRaw, companion, flag, hint }
// art: 사건 삽화 키 (render/eventArt.js) / weather: 이동 화면 날씨 연출
// Godot 이식: data/events.json

export const EVENTS = [
  // ── 아무 일 없음 ─────────────────────────────
  {
    id: 'nothing', kind: 'travel', terrains: 'any', weight: 34, art: 'nothing',
    title: '아무 일 없음',
    textByTerrain: {
      plain: '바람에 벼 이삭이 흔들린다. 별일 없이 하루를 걸었다.',
      forest: '삼나무 사이로 새소리만 들린다. 조용한 하루였다.',
      river: '여울 소리를 들으며 강둑을 따라 걸었다. 별일 없었다.',
      mountain: '숨을 고르며 고갯길을 올랐다. 아무도 만나지 않았다.',
    },
    choices: [],
  },

  // ── 길가의 자원 ─────────────────────────────
  {
    id: 'charcoal_sack', kind: 'travel', terrains: ['forest', 'plain'], weight: 8, art: 'charcoal',
    title: '버려진 숯 자루',
    text: '길가 덤불에 숯 자루 하나가 걸려 있다. 숯꾼이 흘리고 간 듯하다.',
    choices: [
      { label: '숯을 챙긴다', effects: { charcoal: 1, fatigue: 1 }, result: '자루를 짊어졌다. 조금 무겁다.' },
      { label: '그냥 지나간다', effects: {}, result: '임자가 찾으러 오겠지. 발걸음을 옮겼다.' },
    ],
  },
  {
    id: 'black_sand', kind: 'travel', terrains: ['river', 'plain'], weight: 9, art: 'sand',
    title: '검게 반짝이는 모래',
    text: '빗물이 쓸고 간 웅덩이 바닥에 검은 모래가 띠를 이루고 있다.',
    choices: [
      { label: '모래를 퍼 담는다 (피로 +2)', effects: { addRaw: 'roadsand', fatigue: 2 }, result: '모래쇠 한 줌을 자루에 담았다. 성질은 써 봐야 안다.' },
      { label: '지나간다', effects: {}, result: '갈 길이 바쁘다.' },
    ],
  },
  {
    id: 'berries', kind: 'travel', terrains: ['forest', 'mountain'], weight: 7, art: 'berries',
    title: '산열매 덤불',
    text: '익은 산열매가 주렁주렁 달린 덤불을 발견했다.',
    choices: [
      { label: '따서 먹고 챙긴다', effects: { food: 2, fatigue: 1 }, result: '배를 채우고 남은 열매를 쌌다.' },
      { label: '지나간다', effects: {}, result: '열매를 뒤로하고 걸었다.' },
    ],
  },

  // ── 사람 ───────────────────────────────────
  {
    id: 'traveler', kind: 'travel', terrains: 'any', weight: 9, art: 'traveler',
    title: '지나가는 행인',
    text: '삿갓을 쓴 행인이 길을 묻는다. 대장간 소문을 아는 눈치다.',
    choices: [
      { label: '이야기를 나눈다', effects: { hint: 'rumor' }, result: '' },
      { label: '주먹밥을 나눠 준다 (식량 -1)', requires: { food: 1 }, effects: { food: -1, fatigue: -2, hint: 'rumor' }, result: '함께 쉬며 먹으니 몸이 가벼워졌다.' },
      { label: '인사만 하고 지나간다', effects: {}, result: '서로 고개를 숙이고 길을 갔다.' },
    ],
  },
  {
    id: 'merchant', kind: 'travel', terrains: ['plain', 'river', 'forest'], weight: 7, art: 'merchant',
    title: '떠돌이 상인',
    text: '등짐 가득 물건을 진 상인이 물물교환을 청한다.',
    choices: [
      { label: '숯 1 → 식량 3', requires: { charcoal: 1 }, effects: { charcoal: -1, food: 3 }, result: '숯 자루를 건네고 말린 밥을 받았다.' },
      { label: '식량 2 → 숯 1', requires: { food: 2 }, effects: { food: -2, charcoal: 1 }, result: '상인이 좋은 숯이라며 자루를 내밀었다.' },
      { label: '지나간다', effects: {}, result: '다음에 보자며 상인이 손을 흔들었다.' },
    ],
  },

  // ── 악천후·험로 ─────────────────────────────
  {
    id: 'rain', kind: 'travel', terrains: 'any', weight: 8, art: 'rain', weather: 'rain',
    title: '갑작스러운 비',
    text: '하늘이 어두워지더니 굵은 빗방울이 쏟아진다.',
    choices: [
      { label: '비를 맞으며 걷는다 (피로 +2)', effects: { fatigue: 2 }, result: '흠뻑 젖었지만 일정은 지켰다.' },
      { label: '나무 아래서 끼니를 때우며 기다린다 (식량 -1)', requires: { food: 1 }, effects: { food: -1 }, result: '비가 그친 뒤 다시 걸었다.' },
    ],
  },
  {
    id: 'rockfall', kind: 'travel', terrains: ['mountain', 'river'], weight: 7, art: 'rockfall',
    title: '무너진 길',
    text: '산비탈이 무너져 길이 막혔다. 돌아가거나 짐을 덜고 건너야 한다.',
    choices: [
      { label: '먼 길로 돌아 걷는다 (피로 +3)', effects: { fatigue: 3 }, result: '한참을 돌아 겨우 길에 다시 올랐다.' },
      { label: '짐을 덜고 건넌다 (원료 1개 버림)', requires: { raw: 1 }, effects: { loseRaw: 1 }, result: '자루 하나를 두고 바위를 넘었다.' },
      { label: '식량을 덜고 건넌다 (식량 -2)', requires: { food: 2 }, effects: { food: -2 }, result: '보따리를 가볍게 하고 바위를 넘었다.' },
    ],
  },

  // ── 위협 ───────────────────────────────────
  {
    id: 'bandit', kind: 'travel', terrains: ['plain', 'mountain', 'forest'], weight: 6, minDay: 3, art: 'bandit',
    title: '산적',
    text: '칼을 찬 사내 둘이 길을 막는다. "가진 걸 내놓고 가라."',
    choices: [
      { label: '벤케이가 앞으로 나선다', requires: { companion: 'benkei' }, effects: {}, result: '벤케이가 나기나타를 한 번 휘두르자 사내들이 달아났다.' },
      { label: '식량을 내준다 (식량 -2)', requires: { food: 2 }, effects: { food: -2 }, result: '보따리를 빼앗겼지만 다친 데는 없다.' },
      { label: '숯 자루를 내준다 (숯 -1)', requires: { charcoal: 1 }, effects: { charcoal: -1 }, result: '"숯이라니." 투덜거리며 사내들이 사라졌다.' },
      { label: '짐을 끌어안고 달아난다 (피로 +4)', effects: { fatigue: 4 }, result: '숨이 턱에 닿도록 뛰어 겨우 따돌렸다.' },
    ],
  },
  {
    id: 'benkei_bridge', kind: 'travel', terrains: ['river', 'plain', 'mountain'], weight: 10, minDay: 2, unique: true, art: 'benkei',
    title: '다리 위의 거구',
    text: '좁은 다리 한가운데 거구의 승병이 버티고 섰다. "지나가려면 허리의 칼을 두고 가라."',
    choices: [
      { label: '"나는 도공이오. 칼은 없지만, 만들어 보이겠소."', effects: { companion: 'benkei', flag: 'benkei_met' }, result: '승병이 껄껄 웃었다. "벤케이라 한다. 그 칼, 내 눈으로 보겠다." 벤케이가 동행한다.' },
      { label: '다른 길로 돌아 건넌다 (피로 +2)', effects: { fatigue: 2 }, result: '여울을 걸어서 건넜다. 등 뒤에서 승병이 지켜보았다.' },
    ],
  },
  {
    id: 'wolf_track', kind: 'travel', terrains: ['forest', 'mountain'], weight: 5, art: 'wolf',
    title: '늑대 발자국',
    text: '진흙에 큼직한 발자국이 이어져 있다. 근처에 무리가 있는 듯하다.',
    choices: [
      { label: '서둘러 지나간다 (피로 +2)', effects: { fatigue: 2 }, result: '뒤를 돌아보며 걸음을 재촉했다.' },
      { label: '벤케이와 함께 천천히 지나간다', requires: { companion: 'benkei' }, effects: {}, result: '벤케이가 앞장서자 마음이 놓였다.' },
      { label: '고기 한 덩이를 던져 두고 간다 (식량 -1)', requires: { food: 1 }, effects: { food: -1 }, result: '먹을 것을 두고 조용히 자리를 떴다.' },
    ],
  },

  // ── 노숙한 날 ──────────────────────────────
  {
    id: 'camp_quiet', kind: 'camp', terrains: 'any', weight: 50, art: 'camp',
    title: '조용한 야영',
    text: '모닥불을 피우고 하룻밤을 보냈다. 깊이 잠들었다.',
    choices: [],
  },
  {
    id: 'camp_stars', kind: 'camp', terrains: 'any', weight: 15, art: 'stars',
    title: '별이 쏟아지는 밤',
    text: '맑은 밤하늘에 별이 가득하다. 오랜만에 마음이 편하다. (피로 추가 -1)',
    effects: { fatigue: -1 },
    choices: [],
  },
  {
    id: 'camp_rain', kind: 'camp', terrains: 'any', weight: 15, art: 'rain', weather: 'rain',
    title: '밤비',
    text: '한밤중에 비가 내려 모닥불이 꺼졌다.',
    choices: [
      { label: '젖은 채로 버틴다 (피로 +2)', effects: { fatigue: 2 }, result: '선잠을 자다 깼다. 개운하지 않다.' },
      { label: '숯으로 불을 다시 지핀다 (숯 -1)', requires: { charcoal: 1 }, effects: { charcoal: -1 }, result: '숯불 곁에서 옷을 말리며 잤다.' },
    ],
  },
  {
    id: 'camp_wolves', kind: 'camp', terrains: ['forest', 'mountain'], weight: 15, art: 'wolf',
    title: '늑대 울음',
    text: '멀리서 늑대 울음이 들린다. 불가에서 잠들기가 쉽지 않다.',
    choices: [
      { label: '벤케이에게 불침번을 부탁한다', requires: { companion: 'benkei' }, effects: {}, result: '"맡겨 두라." 벤케이 곁에서 푹 잤다.' },
      { label: '뜬눈으로 불을 지킨다 (피로 +2)', effects: { fatigue: 2 }, result: '새벽까지 불을 지켰다.' },
    ],
  },
];

// 행인·찻집에서 듣는 제작 힌트(소문)
export const RUMORS = [
  '"강변 사철은 탄소가 많아 날에 쓰고, 산의 철광석은 질겨서 속심에 쓴다더군."',
  '"접기 전에 산화물을 털어 내지 않으면 접은 자리에 때가 낀다던데."',
  '"쇠가 노랗다 못해 하얗게 빛나면 늦은 거야. 탄소가 타서 날아가지."',
  '"담금질은 주홍빛일 때라네. 너무 뜨거우면 칼이 갈라져."',
  '"식은 쇠를 두드리면 눈에 안 보이는 금이 간다더라."',
  '"숯가마 숲의 숯은 불이 좋아 제철할 때 쇠를 깨끗하게 해 준다지."',
  '"너무 오래 접으면 쇠가 순해지기는 하는데, 탄소도 같이 빠져."',
];
