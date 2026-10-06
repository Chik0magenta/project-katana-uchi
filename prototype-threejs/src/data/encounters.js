// 전투 상대 묶음. 사건 선택지나 장소 활동의 effects.battle / gives.battle 로 부른다.
// enemies: { name, art(스프라이트 키), power(전투력), hp }
// stress: 이 싸움이 칼에 주는 충격. 카타나의 도신 내구력보다 크면 이가 빠지거나 휜다.
// win/lose: 이겼을 때·졌을 때 결과 (money: [최소, 최대] 문 / moneyRatio: 잃는 돈 비율 / food, fatigue)
// 모든 값은 v0.2 임시안이다. Godot 이식: data/encounters.json

export const ENCOUNTERS = {
  bandits: {
    id: 'bandits', name: '산적 둘',
    enemies: [
      { name: '산적', art: 'bandit', power: 26, hp: 38 },
      { name: '산적', art: 'bandit', power: 26, hp: 38 },
    ],
    stress: 45,
    win: { money: [12, 28], text: '산적들이 칼을 놓고 달아났다. 떨어뜨린 엽전 꾸러미를 주웠다.' },
    lose: { moneyRatio: 0.4, food: 2, fatigue: 3, text: '힘이 모자랐다. 산적들이 돈주머니와 보따리를 털어 갔다.' },
  },
  wolves: {
    id: 'wolves', name: '늑대 무리',
    enemies: [
      { name: '늑대', art: 'wolf', power: 17, hp: 22 },
      { name: '늑대', art: 'wolf', power: 17, hp: 22 },
      { name: '늑대', art: 'wolf', power: 17, hp: 22 },
    ],
    stress: 25,
    win: { text: '늑대들이 깨갱거리며 숲으로 흩어졌다.' },
    lose: { food: 2, fatigue: 3, text: '늑대들에게 쫓겨 짐 일부를 버리고 겨우 빠져나왔다.' },
  },
  ronin: {
    id: 'ronin', name: '떠돌이 낭인',
    enemies: [{ name: '낭인', art: 'ronin', power: 80, hp: 150 }],
    stress: 60,
    win: { money: [30, 30], text: '"좋은 칼이군." 낭인이 칼을 거두고 겨룸 값으로 은전을 내밀었다.' },
    lose: { fatigue: 3, text: '"칼이 사람을 따라오지 못하는군." 낭인은 웃으며 떠났다.' },
  },
  dojo: {
    id: 'dojo', name: '도장 문하생', nonLethal: true,
    enemies: [
      { name: '문하생', art: 'pupil', power: 25, hp: 35 },
      { name: '문하생', art: 'pupil', power: 25, hp: 35 },
    ],
    stress: 15,
    win: { money: [12, 12], text: '사범이 고개를 끄덕이며 사례금을 건넸다.' },
    lose: { fatigue: 2, text: '문하생들에게 졌다. 사범이 "칼보다 팔을 먼저 단련하시오"라고 했다.' },
  },
};
