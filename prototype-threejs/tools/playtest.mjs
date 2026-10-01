// 실제 브라우저에서 버튼을 눌러 전체 흐름을 한 바퀴 플레이하고, 주요 화면을 캡처한다.
// 지도 → 이동 사건 → 재료 확보 → 귀환 → 공방 제작 → 결과 → 재시도
// 각 화면에서 글자 잘림·겹침(넘침)과 콘솔 오류를 검사한다.
// 사용: npm run build && node tools/playtest.mjs [캡처 폴더]
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const OUT = process.argv[2] || 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
const url = `${pathToFileURL(resolve('dist/katana-uchi.html')).href}?seed=4242`;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const problems = [];
const log = (...a) => console.log(...a);
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

let shotNo = 0;
async function shot(name) {
  shotNo++;
  const file = `${OUT}/${String(shotNo).padStart(2, '0')}_${name}.png`;
  await page.screenshot({ path: file });
  await checkLayout(name);
}

// 화면 밖으로 나가거나, 상자보다 글자가 넘치는 요소 찾기
async function checkLayout(name) {
  const found = await page.evaluate(() => {
    const out = [];
    const app = document.getElementById('app').getBoundingClientRect();
    for (const el of document.querySelectorAll('#ui *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const txt = (el.innerText || '').trim().slice(0, 40);
      if (r.right > app.right + 1 || r.bottom > app.bottom + 1 || r.left < app.left - 1 || r.top < app.top - 1) out.push(`화면 밖: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
      const clip = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
      if (clip && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) out.push(`잘림: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}" (${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight})`);
      if (el.matches('.btn') && el.scrollWidth > el.clientWidth + 2) out.push(`버튼 글자 넘침: "${txt}"`);
      if (el.matches('.hud > *') && r.height > 40) out.push(`상단 막대 줄바꿈: "${txt}"`);
      if (el.matches('.hud') && el.scrollWidth > el.clientWidth + 2) out.push('상단 막대가 넘침');
      if (['auto', 'scroll'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 2) out.push(`스크롤 필요: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
    }
    return out;
  });
  for (const f of found) problems.push(`[${name}] ${f}`);
}

const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__katana.state)));
const click = async (id) => { await page.click(`[data-testid="${id}"]`); await page.waitForTimeout(120); };
const exists = async (id) => (await page.$(`[data-testid="${id}"]`)) !== null;
const enabled = async (id) => page.$eval(`[data-testid="${id}"]`, (b) => !b.disabled).catch(() => false);
const assert = (cond, msg) => { if (!cond) { problems.push(`규칙 위반: ${msg}`); log('  ✗', msg); } else log('  ✓', msg); };

// 길 위에서 하루를 마칠 때까지: 사건이 있으면 가능한 첫 선택지(벤케이 동행은 받아들인다)
async function settleDay(tag) {
  await page.waitForTimeout(1700); // 걷기 연출
  const st = await S();
  const j = st.journey;
  if (!j) return st;
  if (j.phase === 'event') {
    await shot(`${tag}_event`);
    const idx = j.event.choices.findIndex((c) => c.enabled);
    await click(`choice-${idx}`);
  }
  return S();
}

async function travelTo(dest, tag, { testCamp = false, testReverse = false } = {}) {
  await click('open-map');
  await click(`dest-${dest}`);
  await shot(`${tag}_map_selected`);
  const before = await S();
  await click('depart');
  let st = await settleDay(tag);
  assert(st.day === before.day + 1 && st.journey.pos === 1 && st.journey.history.length === 1, `출발하면 첫날 이동과 사건이 1회 처리된다 (${tag})`);
  const day0 = st.day; await page.waitForTimeout(700); st = await S();
  assert(st.day === day0, '행동을 고르기 전에는 날짜가 흐르지 않는다');
  let guard = 0;
  while (st.journey && guard++ < 20) {
    const j = st.journey;
    if (j.phase === 'collapse') { await shot(`${tag}_collapse`); await click('collapse'); await shot(`${tag}_collapse_loss`); await click('after-collapse'); return S(); }
    if (j.phase === 'arrive') { await shot(`${tag}_arrive`); await click('enter'); break; }
    if (testCamp && !st._camped) {
      const pos = j.pos; const day = st.day; const hist = j.history.length;
      await click('act-camp');
      const s2 = await settleDay(`${tag}_camp`);
      await shot(`${tag}_camp`);
      assert(s2.journey.pos === pos && s2.day === day + 1 && s2.journey.history.length === hist + 1, '노숙: 위치 유지, 하루 소비, 야영 사건 1회');
      testCamp = false; st = s2; continue;
    }
    if (testReverse) {
      const pos = j.pos;
      await click('act-reverse');
      const s2 = await settleDay(`${tag}_reverse`);
      await shot(`${tag}_returning`);
      assert(s2.journey.pos === pos - 1 && s2.journey.heading === 'from', '되돌아가기: 출발점 쪽으로 실제 하루 이동');
      const labels = await page.$$eval('[data-testid="actions"] .btn-label', (els) => els.map((e) => e.textContent));
      assert(labels.some((l) => l.startsWith('귀환 계속')) && labels.some((l) => l.startsWith('목적지로 다시 향하기')), '귀환 중 버튼: 귀환 계속 / 노숙하기 / 목적지로 다시 향하기');
      testReverse = false; st = s2;
      if (s2.journey?.phase === 'choose') { await click('act-reverse'); st = await settleDay(`${tag}_again`); }
      continue;
    }
    if (st.fatigue >= 7 && j.phase === 'choose') { await click('act-camp'); st = await settleDay(`${tag}_rest`); continue; }
    await click('act-continue');
    st = await settleDay(tag);
  }
  st = await S();
  return st;
}

log('▶ 타이틀');
await page.goto(url);
await page.waitForTimeout(700);
await shot('title');
await click('new-game');
await page.waitForTimeout(400);
await shot('village');

log('▶ 지도: 비인접 노드 클릭');
await click('open-map');
await shot('map');
// 사철 강변은 마을과 직접 연결되어 있지 않다 → 캔버스에서 직접 클릭
const river = await page.evaluate(() => ({ x: 150 * 4, y: (11 + 138) * 4 }));
await page.mouse.click(river.x, river.y);
await page.waitForTimeout(200);
const toast = await page.$eval('[data-testid="toast"]', (t) => t.textContent).catch(() => '');
await shot('map_not_adjacent');
assert(/직접 연결된/.test(toast) && !(await exists('depart')), '비인접 노드로는 출발할 수 없다');
await click('back-location');

log('▶ 마을 → 찻집 (1일)');
let st = await travelTo('inn', 'to_inn');
assert(st.location === 'inn' || st.location === 'village', `찻집 도착 (${st.location})`);
await shot('inn');
if (st.location === 'inn') { await click('act-onigiri'); await shot('inn_onigiri'); }

log('▶ 찻집 → 강변 (2일, 노숙 시험)');
st = await travelTo('river', 'to_river', { testCamp: true });
log('  위치:', st.location, '일차', st.day, '식량', st.food, '피로', st.fatigue);
if (st.location === 'river') {
  await shot('river');
  await click('act-satetsu'); await page.waitForTimeout(400); await shot('river_gather');
  if (await enabled('act-satetsu')) await click('act-satetsu');
  st = await S();
  assert(st.raw.filter((r) => r.kind === 'satetsu').length >= 1, '사철을 채집해 원료로 얻었다');
  if (st.fatigue >= 6) await click('act-camp_here');
  log('▶ 강변 → 찻집 → 마을 (귀환)');
  st = await travelTo('inn', 'back_inn');
  if (st.location === 'inn') { if (await enabled('act-inn_rest')) await click('act-inn_rest'); st = await travelTo('village', 'back_village'); }
}
st = await S();
assert(st.location === 'village', '공방 마을로 돌아왔다');
await shot('village_back');

log('▶ 공방');
await click('act-workshop');
await page.waitForTimeout(300);
st = await S();
const sat = st.raw.find((r) => r.kind === 'satetsu');
if (sat) await page.click(`[data-testid="mat-${sat.uid}"]`);
await page.click('[data-testid="mat-scrap"]');
if (!sat) await page.click('[data-testid="mat-scrap"]');
await shot('ws_select');
await click('start-refine');

async function refineOne(tag) {
  // 숯 넣고 풀무질 → 주황빛이 될 때까지 기다림
  for (let i = 0; i < 3; i++) await click('r-fuel');
  for (let i = 0; i < 3; i++) await click('r-pump');
  for (let k = 0; k < 60; k++) {
    const t = await page.evaluate(() => window.__katana.forge.refine.steelT);
    if (t > 1020) break;
    if (k % 6 === 0) await click('r-pump');
    await page.waitForTimeout(250);
  }
  await shot(`${tag}_furnace`);
  for (let fold = 0; fold < 3; fold++) {
    await click('r-out'); await page.waitForTimeout(450);
    if (fold === 0) await shot(`${tag}_anvil`);
    await click('r-knock'); await page.waitForTimeout(700);
    await click('r-fold'); await page.waitForTimeout(250);
    if (fold === 0) await shot(`${tag}_fold`);
    await page.waitForTimeout(1300);
    await click('r-in'); await page.waitForTimeout(500);
    for (let k = 0; k < 40; k++) {
      const t = await page.evaluate(() => window.__katana.forge.refine.steelT);
      if (t > 1000) break;
      if (k % 5 === 0) await click('r-pump');
      await page.waitForTimeout(250);
    }
  }
  await click('r-finish');
}
await refineOne('ws_refine1');
await refineOne('ws_refine2');
await shot('ws_assign');
await click('assign-0');
await page.waitForTimeout(2500);
await shot('ws_join');
await click('to-shape');

log('▶ 성형');
for (let round = 0; round < 12; round++) {
  const sh = await page.evaluate(() => { const s = window.__katana.forge.shaping; return { p: s.progress, t: s.temp, heating: s.heating }; });
  if (sh.p.every((p) => p >= 95)) break;
  if (sh.t < 820) { await click('s-reheat'); await page.waitForTimeout(1500); continue; }
  const i = sh.p.findIndex((p) => p < 95);
  // 도신 그림을 직접 클릭하는 방식과 구간 버튼을 번갈아 쓴다
  if (round % 2 === 0) await page.mouse.click((62 + 2 + 25 * i + 12) * 4, (63 + 10) * 4);
  else await click(`sec-${i}`);
  await page.waitForTimeout(450);
  if (round === 3) await shot('ws_shape');
}
for (let k = 0; k < 40; k++) {
  const sh = await page.evaluate(() => { const s = window.__katana.forge.shaping; return { p: s.progress, t: s.temp }; });
  if (sh.p.every((p) => p >= 92)) break;
  if (sh.t < 820) { await click('s-reheat'); await page.waitForTimeout(1500); continue; }
  await click(`sec-${sh.p.findIndex((p) => p < 92)}`); await page.waitForTimeout(400);
}
await shot('ws_shape_done');
await click('s-finish');
await click('apply-clay'); await page.waitForTimeout(900);
await shot('ws_clay');
await click('to-quench');

log('▶ 담금질');
await page.waitForTimeout(3000);
await shot('ws_quench_heat');
for (let k = 0; k < 80; k++) {
  const t = await page.evaluate(() => window.__katana.forge.quench.temp);
  if (t >= 790) break;
  await page.waitForTimeout(200);
}
await click('q-quench');
await page.waitForTimeout(1100);
await shot('ws_quench_steam');
await page.waitForTimeout(2500);

log('▶ 결과');
st = await S();
assert(st.results.length === 1, '결과가 기록되었다');
const res = st.results[0];
log('  결과:', res.grade, res.score, '/', res.hardening.label, res.soundness.label, res.shape.label);
assert(res.skin.origin && res.core.origin, `재료 출처가 결과까지 이어진다 (${res.skin.origin} / ${res.core.origin})`);
await shot('result');

log('▶ 재시도');
await click('retry-forge');
await page.waitForTimeout(300);
await shot('retry_workshop');
assert(await exists('mat-scrap'), '재시도: 재료가 없어도 창고 고철로 다시 만들 수 있다');
await click('leave-workshop');
await click('open-map');
await shot('retry_map');

log('▶ 되돌아가기·귀환 버튼 (새 게임: 마을 → 찻집 → 철광 산지 3일 구간)');
await page.evaluate(() => window.__katana.newGame(777));
await page.waitForTimeout(300);
st = await travelTo('inn', 'rev_inn');
if (st.location === 'inn') {
  if (await enabled('act-inn_rest')) await click('act-inn_rest');
  await click('open-map'); await click('dest-mountain'); await click('depart');
  st = await settleDay('rev_d1');
  if (st.journey?.phase === 'choose') { await click('act-continue'); st = await settleDay('rev_d2'); }
  if (st.journey?.phase === 'choose') {
    const pos = st.journey.pos;
    await click('act-reverse');
    st = await settleDay('rev_d3');
    await shot('returning');
    assert(st.journey.pos === pos - 1 && st.journey.heading === 'from', '되돌아가기: 출발점 쪽으로 실제 하루 이동 (순간 귀환 없음)');
    const labels = await page.$$eval('[data-testid="actions"] .btn-label', (els) => els.map((e) => e.textContent));
    assert(labels.some((l) => l.startsWith('귀환 계속')) && labels.some((l) => l.startsWith('노숙하기')) && labels.some((l) => l.startsWith('목적지로 다시 향하기')), '귀환 중 버튼: 귀환 계속 / 노숙하기 / 목적지로 다시 향하기');
    if (st.fatigue >= 7) { await click('act-camp'); st = await settleDay('rev_camp'); }
    await click('act-continue');
    st = await settleDay('rev_d4');
    assert(st.journey?.phase === 'arrive' && st.journey.pos === 0, '귀환은 출발점에서 멈춘다 (노드 경계를 넘지 않음)');
  }
}

log('▶ 개발 수치 표시');
await page.keyboard.press('F2');
await page.evaluate(() => window.__katana.go('dev'));
await click('dev-result');
await page.waitForTimeout(800);
await shot('dev_result_numbers');

console.log('\n── 요약 ──');
console.log(`캡처 ${shotNo}장 → ${OUT}`);
console.log(errors.length ? `콘솔 오류 ${errors.length}건:\n${errors.join('\n')}` : '콘솔 오류 없음');
console.log(problems.length ? `문제 ${problems.length}건:\n${problems.join('\n')}` : '잘림·넘침·규칙 위반 없음');
await browser.close();
process.exit(errors.length || problems.length ? 1 : 0);
