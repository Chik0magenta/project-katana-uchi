// 유닛(도공·동행자)과 기본 무기, 코시라에(칼집·손잡이·코등이) 등급.
// 모든 값은 v0.2 임시안이다. Godot 이식: data/gear.json

// skill: 기본 전투 실력(전투력에 가장 크게 반영) / hp: 체력 / baseWeapon: 카타나를 쥐지 않았을 때 쓰는 무기
export const UNITS = {
  smith: { id: 'smith', name: '도공', skill: 25, hp: 60, baseWeapon: 'hammer' },
  benkei: { id: 'benkei', name: '벤케이', skill: 75, hp: 100, baseWeapon: 'naginata' },
};

// 기본 무기는 닳지 않는다. power는 카타나의 '무기 성능'과 같은 척도.
export const BASE_WEAPONS = {
  hammer: { id: 'hammer', name: '대장장이 망치', power: 18 },
  naginata: { id: 'naginata', name: '나기나타', power: 55 },
};

// 코시라에: 도신에 칼집·손잡이·코등이를 맞춰 카타나로 만든다 (성하 마을).
// cost 문 / weight kg(도신 무게에 더함) / grip: 무기 성능 가산 / polish: 날카로움 가산(정성 연마) / value: 팔 때 더해지는 값
export const KOSHIRAE = {
  plain: {
    id: 'plain', name: '간소한 코시라에', cost: 25, weight: 0.25, grip: 0, polish: 0, value: 15,
    desc: '백목 칼집, 무명 끈 손잡이, 쇠 코등이. 보통 연마.',
  },
  fine: {
    id: 'fine', name: '좋은 코시라에', cost: 70, weight: 0.32, grip: 4, polish: 5, value: 45,
    desc: '옻칠 칼집, 비단 끈 손잡이, 투각 코등이. 정성 연마(날카로움 +5), 손에 잘 붙는다(성능 +4).',
  },
};

export const KOSHIRAE_DAYS = 1;   // 맞추는 데 걸리는 날 (그날 식량 1)
