// 원료 프리셋. 채집 순간 범위 안에서 값을 정하고 출처를 남긴다.
// carbon: % / uniformity, impurity: 0~100
// Godot 이식: data/materials.json

export const MATERIALS = {
  satetsu: {
    id: 'satetsu', name: '강변 사철', short: '사철',
    carbon: [0.62, 0.90], uniformity: [38, 52], impurity: [12, 22],
    note: '탄소가 많고 깨끗하다. 날(피철)에 어울린다.',
  },
  ore: {
    id: 'ore', name: '산 철광석', short: '철광석',
    carbon: [0.14, 0.32], uniformity: [28, 42], impurity: [30, 44],
    note: '탄소가 적고 질기다. 속심(심철)에 어울린다.',
  },
  roadsand: {
    id: 'roadsand', name: '길가 모래쇠', short: '모래쇠',
    carbon: [0.40, 0.78], uniformity: [22, 36], impurity: [22, 34],
    note: '길에서 주운 사철. 성질이 들쭉날쭉하다.',
  },
  scrap: {
    id: 'scrap', name: '창고 고철', short: '고철',
    carbon: [0.32, 0.48], uniformity: [18, 28], impurity: [42, 54],
    note: '공방 창고의 헌 쇠. 재료가 모자랄 때 쓰는 최후 수단.',
  },
};

// 감정 단계 (일반 화면은 단계, 개발 화면은 실제 수치)
export const APPRAISAL = {
  carbon: [[0.35, '낮음'], [0.6, '보통'], [0.9, '높음'], [Infinity, '매우 높음']],
  uniformity: [[40, '낮음'], [65, '보통'], [Infinity, '높음']],
  impurity: [[18, '낮음'], [35, '보통'], [Infinity, '높음']],
};
