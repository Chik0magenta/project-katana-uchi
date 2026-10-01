// 결과 계산. 피철·심철의 세 변수, 성형, 담금질 시점이 누적되어 결과가 정해진다.
// 무작위 성공/실패가 아니라, 균일도가 낮을 때만 작은 흔들림(±)이 생긴다.
// 원인 목록은 실제로 계산에 들어간 항목만 크기 순으로 보여 준다.
// Godot 이식: 정적 함수 compute_blade_result(skin, core, shaping, quench, rng).

import { BALANCE } from '../../data/balance.js';
import { clamp } from '../state.js';

const pct = (c) => `${c.toFixed(2)}%`;

export function computeResult({ skin, core, shaping, quench, rng }) {
  const causes = []; // { text, impact(+좋음/-나쁨), axis }
  const add = (axis, impact, text) => { if (Math.abs(impact) >= 0.02) causes.push({ axis, impact, text }); };
  const [lo, hi] = BALANCE.quench.ideal;
  const T = quench.temp;
  const even = quench.evenness;

  // 균일도가 낮을수록 결과가 흔들린다 (최대 ±0.12)
  const unsteady = clamp((70 - (skin.uniformity + core.uniformity) / 2) / 70, 0, 1);
  const jitter = (rng ? rng.range(-1, 1) : 0) * 0.12 * unsteady;

  // ── 경화 ─────────────────────────────
  const carbonHard = clamp((skin.carbon - 0.3) / 0.4, 0, 1);       // 0.7% 이상이면 충분
  let tempHard;
  if (T < 700) tempHard = 0.15;
  else if (T < lo) tempHard = 0.15 + 0.75 * (T - 700) / (lo - 700);
  else if (T <= hi) tempHard = 1;
  else tempHard = Math.max(0.85, 1 - (T - hi) / 600);
  // 피철 균일도가 낮으면 굳은 정도도 고르지 않다
  const hardening = clamp(carbonHard * tempHard * (0.6 + 0.4 * skin.uniformity / 100) + jitter * 0.5, 0, 1);
  const localUneven = skin.uniformity < 65 || even < 0.55;

  if (skin.carbon < 0.5) add('경화', -(0.5 - skin.carbon) * 2.5, `피철의 탄소가 ${pct(skin.carbon)}로 적어 날이 충분히 굳지 않았다`);
  else if (skin.carbon >= 0.6) add('경화', 0.3, `피철 탄소 ${pct(skin.carbon)} — 날이 단단히 굳을 만큼 탄소가 있었다`);
  if (T < lo) add('경화', -(lo - T) / 120, `담금질 온도 ${T}°C가 낮아 경화가 덜 되었다 (적정 ${lo}~${hi}°C)`);
  else if (T <= hi) add('경화', 0.35, `담금질 온도 ${T}°C — 적정 범위(${lo}~${hi}°C)에서 물에 넣었다`);
  if (skin.uniformity < 65) add('경화', -(65 - skin.uniformity) / 50, `피철 균일도가 낮아(${skin.uniformity}) 날의 굳기가 고르지 않다 — 더 접었다면 고와졌을 것`);
  else if (skin.uniformity >= 80) add('경화', 0.2, `피철 균일도 ${skin.uniformity} — 잘 접어 날이 고르게 굳었다`);
  if (even < 0.55) add('경화', -(0.55 - even), `화덕에서 고르게 달구지 못해(고름 ${Math.round(even * 100)}%) 굳은 자리가 들쭉날쭉하다`);

  // ── 건전성 (균열·파단 / 휨) ───────────
  let crack = 0;
  const crackParts = [];
  const pushCrack = (v, text) => { if (v > 0.01) { crack += v; crackParts.push({ v, text }); } };
  pushCrack(Math.max(0, skin.carbon - 0.85) * 3.5, `피철 탄소가 ${pct(skin.carbon)}로 지나치게 많아 날이 깨지기 쉬웠다`);
  pushCrack(Math.max(0, T - hi) / 110, `담금질 온도 ${T}°C가 너무 높아 급랭 응력이 컸다`);
  pushCrack(skin.impurity / 100 * 1.2, `피철 불순도 ${skin.impurity} — 개재물이 금의 씨앗이 되었다`);
  pushCrack(core.impurity / 100 * 0.9, `심철 불순도 ${core.impurity} — 속심의 개재물이 약한 고리가 되었다`);
  pushCrack(Math.max(0, 70 - skin.uniformity) / 100 * 0.6, `피철 균일도 ${skin.uniformity} — 고르지 않은 조직에 응력이 몰렸다`);
  pushCrack(shaping.coldHits * 0.05, `식은 쇠를 ${shaping.coldHits}번 두드려 잔금이 생겼다`);
  pushCrack(Math.max(0, core.carbon - 0.35) * 2.0, `심철 탄소가 ${pct(core.carbon)}로 많아 속심이 질기지 못했다`);
  crack = Math.max(0, crack + jitter);

  let warp = (1 - even) * 0.7 + shaping.deviation / 45 + (T > hi + 40 ? 0.15 : 0);
  if (core.carbon > skin.carbon - 0.1) warp += 0.2;
  if (core.uniformity < 50) warp += (50 - core.uniformity) / 100;
  warp = Math.max(0, warp + jitter * 0.5);

  let soundness;
  if (crack >= 1.25) soundness = '파단';
  else if (crack >= 0.8) soundness = '균열';
  else if (warp >= 0.62) soundness = '휨';
  else soundness = '정상';

  crackParts.sort((a, b) => b.v - a.v);
  if (soundness === '파단' || soundness === '균열') crackParts.slice(0, 3).forEach((p) => add('건전성', -p.v, p.text));
  else if (crack < 0.45) add('건전성', 0.3, `불순물과 무리한 작업이 적어 금이 가지 않았다`);
  else crackParts.slice(0, 2).forEach((p) => add('건전성', -p.v * 0.5, `${p.text} (금은 가지 않았지만 위험했다)`));
  if (soundness !== '휨' && core.uniformity < 50) add('건전성', -(50 - core.uniformity) / 100, `심철 균일도가 낮아(${core.uniformity}) 휨 위험이 있었다`);
  if (soundness === '휨') {
    if (core.uniformity < 50) add('건전성', -(50 - core.uniformity) / 100, `심철 균일도가 낮아(${core.uniformity}) 도신이 고르게 버티지 못했다`);
    if (even < 0.7) add('건전성', -(1 - even) * 0.7, `고르게 달구지 못한 채 물에 넣어 도신이 휘었다`);
    if (shaping.deviation > 10) add('건전성', -shaping.deviation / 45, `성형 두께가 고르지 않아(편차 ${shaping.deviation}) 휘었다`);
    if (core.carbon > skin.carbon - 0.1) add('건전성', -0.2, `피철과 심철의 탄소 차가 작아 휨을 잡지 못했다`);
  }
  if (core.carbon <= 0.4 && skin.carbon - core.carbon >= 0.25) add('건전성', 0.25, `심철 탄소 ${pct(core.carbon)} — 질긴 속심이 충격을 받아냈다`);

  // ── 형상 ─────────────────────────────
  const shapeQ = shaping.quality;
  let shapeLabel = shapeQ >= 85 ? '고른 형상' : shapeQ >= 65 ? '보통 형상' : '거친 형상';
  const shapeDefects = [];
  if (shaping.overSections.length) shapeDefects.push(`과타격으로 얇아진 곳: ${shaping.overSections.join(', ')}`);
  if (shaping.deviation > 10) shapeDefects.push(`구간 두께 편차 ${shaping.deviation}`);
  if (shaping.coldHits > 0) shapeDefects.push(`냉간 타격 ${shaping.coldHits}회`);
  if (shapeQ >= 85) add('형상', 0.25, `성형 품질 ${shapeQ} — 도신을 고르게 펴냈다`);
  else if (shapeQ < 65) add('형상', -(65 - shapeQ) / 60, `성형 품질 ${shapeQ} — 두께와 선이 거칠다`);
  if (shaping.overSections.length) add('형상', -0.1 * shaping.overSections.length, `${shaping.overSections.join(', ')} 구간을 지나치게 두드렸다`);

  // ── 종합 ─────────────────────────────
  const hardLabel = hardening >= 0.75 ? (localUneven ? '경화됨 · 국소 불균일' : '충분한 경화')
    : hardening >= 0.45 ? (localUneven ? '부분 경화 · 국소 불균일' : '부분 경화') : '경화 부족';
  // 같은 '정상'이어도 균열·휨 위험이 높았으면 점수를 덜 준다
  const soundScore = { 정상: 1, 휨: 0.55, 균열: 0.2, 파단: 0 }[soundness] * (1 - clamp(crack - 0.2, 0, 0.6) * 0.5 - clamp(warp - 0.2, 0, 0.4) * 0.5);
  const score = Math.round(hardening * 35 * (localUneven ? 0.85 : 1) + soundScore * 40 + clamp(shapeQ, 0, 100) / 100 * 25);
  let grade;
  if (soundness === '파단') grade = '부러진 도신';
  else if (score >= 90) grade = '명도의 기미';
  else if (score >= 70) grade = '쓸 만한 도신';
  else if (score >= 50) grade = '아쉬운 도신';
  else grade = '실패작';

  if (unsteady > 0.3 && Math.abs(jitter) > 0.03) add('건전성', -Math.abs(jitter), `재료 균일도가 낮아 결과가 예상에서 흔들렸다`);

  causes.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return {
    grade, score,
    hardening: { value: Math.round(hardening * 100), label: hardLabel, localUneven },
    soundness: { label: soundness, crack: Math.round(crack * 100) / 100, warp: Math.round(warp * 100) / 100 },
    shape: { quality: shapeQ, label: shapeLabel, defects: shapeDefects },
    quench: { temp: T, evenness: even },
    causes: causes.slice(0, 6),
  };
}
