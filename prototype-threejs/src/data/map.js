// 지도 데이터: 노드(장소)와 간선(길).
// 좌표는 지도 픽셀 캔버스(216x169, 1픽셀 = 화면 4px) 기준.
// Godot 이식: data/map.json 으로 그대로 옮긴다.

export const MAP = {
  base: 'village',
  nodes: {
    village: {
      id: 'village', name: '공방 마을', terrain: 'village', x: 44, y: 128,
      desc: '대장간이 있는 거점. 보급과 휴식, 칼 제작을 할 수 있다.',
    },
    inn: {
      id: 'inn', name: '갈림길 찻집', terrain: 'inn', x: 104, y: 98,
      desc: '세 갈래 길이 만나는 곳. 쉬어 가며 소문을 들을 수 있다.',
    },
    forest: {
      id: 'forest', name: '숯가마 숲', terrain: 'forest', x: 50, y: 50,
      desc: '숯 굽는 연기가 오르는 삼나무 숲. 좋은 숯을 구할 수 있다.',
    },
    river: {
      id: 'river', name: '사철 강변', terrain: 'river', x: 150, y: 138,
      desc: '검은 모래가 쌓이는 여울. 탄소가 많은 사철을 일 수 있다.',
    },
    mountain: {
      id: 'mountain', name: '철광 산지', terrain: 'mountain', x: 176, y: 40,
      desc: '바위산의 노천 광맥. 탄소가 적은 철광석을 캘 수 있다.',
    },
    castle: {
      id: 'castle', name: '성하 마을', terrain: 'town', x: 190, y: 150,
      desc: '성 아래 상가 마을. 코시라에를 맞춰 도신을 카타나로 만들고, 칼을 비싸게 판다.',
    },
  },
  // terrain: 이동 중 배경과 사건 후보를 정한다.
  edges: [
    { id: 'v-i', a: 'village', b: 'inn', days: 1, terrain: 'plain', name: '들판 길' },
    { id: 'v-f', a: 'village', b: 'forest', days: 2, terrain: 'forest', name: '삼나무 길' },
    { id: 'i-f', a: 'inn', b: 'forest', days: 1, terrain: 'forest', name: '숲 어귀 길' },
    { id: 'i-r', a: 'inn', b: 'river', days: 2, terrain: 'river', name: '강둑 길' },
    { id: 'i-m', a: 'inn', b: 'mountain', days: 3, terrain: 'mountain', name: '고갯길' },
    { id: 'r-m', a: 'river', b: 'mountain', days: 2, terrain: 'mountain', name: '골짜기 길' },
    { id: 'r-c', a: 'river', b: 'castle', days: 2, terrain: 'river', name: '나루 길' },
    { id: 'i-c', a: 'inn', b: 'castle', days: 3, terrain: 'plain', name: '성하 큰길' },
  ],
};

export const TERRAIN_NAMES = {
  plain: '들판', forest: '숲', river: '강변', mountain: '산길',
};
