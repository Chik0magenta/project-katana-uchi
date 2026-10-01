// 시안 전체가 공유하는 팔레트 (42색). 강재 발열색만 core/forge/heat.js의 띠를 따로 쓴다.
// 기준 해상도 320x180, 화면 표시 4배 (1280x720), 최근접 필터.
export const P = {
  ink: '#14101a', night: '#1d1a2c', deep: '#2a2440', slate: '#3b3654', stone: '#5a5470', stoneL: '#8a84a0', mist: '#c8c4d8',
  paper: '#f0e6d0', paperD: '#d8c8a8',
  woodD: '#3a2418', wood: '#5c3a22', woodL: '#8a5a32', straw: '#c89a50', strawL: '#e8c878',
  grassD: '#24402a', grass: '#3a6a3a', grassL: '#5a9a4a', leaf: '#8ac25a',
  waterD: '#1a3a5a', water: '#2a6a8a', waterL: '#5aa8c8', foam: '#bfe8f0',
  earthD: '#4a3224', earth: '#6a4a32', earthL: '#9a7048', sand: '#c8a878',
  red: '#a8282a', redL: '#e04a3a', orange: '#f08a2a', yellow: '#f8d050', white: '#fff8e8',
  steelD: '#2e3440', steel: '#5a6474', steelL: '#9aa4b4', steelH: '#dce4ec',
  indigo: '#2c3e6a', indigoL: '#4a62a0', sky: '#7ab0d8', skyL: '#b8daf0', dusk: '#e89a6a', skin: '#e8b890', skinD: '#b87a58',
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
