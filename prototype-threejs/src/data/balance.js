// 조정 가능한 수치 모음. 모든 값은 v0.1 임시안이며 본편 확정값이 아니다.
// Godot 이식: data/balance.json

export const BALANCE = {
  start: { food: 8, fatigue: 0, charcoal: 1, day: 1 },
  food: { max: 10 },
  fatigue: { max: 10, tired: 7 },

  travel: {
    foodPerDay: 1,          // 이동한 날 식량 소비
    fatiguePerDay: 2,       // 이동한 날 피로 증가
    starvingFatigue: 3,     // 식량이 없는 날 추가 피로
  },
  camp: {
    foodPerDay: 1,
    fatigueRecover: 4,
  },
  gather: {
    foodPerDay: 1,
    fatiguePerDay: 1,
    perVisit: 2,            // 한 번 방문해 같은 채집을 할 수 있는 횟수
    tiredImpurity: 6,       // 지친 채 채집한 원료의 불순도 증가
  },
  collapse: {
    // 피로가 최대치에 닿으면 탈진: 거점으로 실려 간다.
    daysLost: 2,
    rawLossRatio: 0.5,      // 원료 절반(올림)을 잃는다
    foodAfter: 3,
    fatigueAfter: 4,
  },

  // 제철: 원료 1 + 숯 → 강괴. 좋은 숯이 없으면 마을 숯(질 낮음)을 쓴다.
  smelt: {
    goodCharcoal: { carbon: 0.05, impurity: -4 },
    villageCharcoal: { carbon: 0.0, impurity: 5 },
  },

  // 제작 1회가 소비하는 달력 일수(고정).
  forgeDays: 2,

  // 단련(가열·접쇠). 시간 단위는 초(공방 안에서만 흐르는 실시간).
  refine: {
    startFuel: 35, fuelAdd: 22, fuelMax: 100, fuelBurn: 2.2,
    airAdd: 26, airMax: 100, airDecay: 20,
    furnaceBase: 520, furnacePerFuel: 6.0, furnacePerAir: 4.6,
    furnaceFollow: 1.2,      // 화덕 온도가 목표를 따라가는 속도
    steelFollow: 0.55,       // 화덕 안 강재가 화덕 온도를 따라가는 속도
    coolRate: 0.035,         // 모루 위 냉각 (온도차 비례)
    coolFlat: 12,
    carburize: { min: 950, max: 1250, minFuel: 50, rate: 0.004, cap: 1.25 },
    overheat: { decarbAt: 1280, decarbRate: 0.02, burnAt: 1380, burnImpurity: 1.6, burnUniformity: 1.2 },
    scaleRate: 0.018, scaleRateHot: 0.09,
    fold: {
      minTemp: 800, goodTemp: 900, coolEffect: 0.7,
      uniformityGain: 0.30, impurityLoss: 0.22, carbonLoss: 0.03, hotCarbonLoss: 0.02,
      diminish: 0.85, scalePenalty: 0.6, scaleToImpurity: 6,
      tempDrop: 110, max: 10, minFolds: 1,
    },
    knockScale: { remove: 0.65, tempDrop: 25 },
  },

  shaping: {
    sections: 6,
    startTemp: 1050, coolRate: 26, reheatTemp: 1050,
    hit: { hot: 14, warm: 8, cold: 4, hotAt: 800, warmAt: 650, neighbor: 2 },
    target: 100, overAt: 122, finishAt: 70,
  },

  quench: {
    startTemp: 420, furnaceTemp: 1010, heatRate: 0.10, coolRate: 0.25,
    evenRate: 0.07, evenStart: 0.35, evenMinTemp: 650,
    ideal: [760, 840],
  },
};
