// 공방: 감정·제철 → 단련(강재 2개) → 배정 → 접합 → 성형 → 점토 → 담금질 → 결과.
// 규칙은 ForgeSession(core/forge)에, 그림은 WorkshopView에 있고, 이 파일은 둘을 버튼으로 잇는다.
import { h, button, bar } from '../dom.js';
import { WorkshopView } from '../../render/views/workshopView.js';
import { ForgeSession, STAGES } from '../../core/forge/session.js';
import { SECTION_NAMES } from '../../core/forge/shaping.js';
import { heatColor } from '../../core/forge/heat.js';
import { appraise } from '../../core/state.js';
import { BALANCE } from '../../data/balance.js';
import { P } from '../../render/palette.js';

const rgbCss = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;

export function mountWorkshop(app, params = {}) {
  const s = app.state;
  const session = params.session || new ForgeSession(s);
  const view = new WorkshopView();
  app.stage.setView(view);
  app.hud();
  const strip = h('div', { class: 'stages passthrough' });
  const panel = h('div', { class: 'panel ws-panel' });
  app.ui.append(strip, panel);
  let busy = false;
  let dyn = {};          // 매 프레임 갱신할 요소들
  let uiTimer = 0;
  let stageShown = null;
  app.forge = session;   // 개발용 메뉴·검증 도구에서 접근

  const dev = () => app.devNumbers;

  function renderStrip() {
    const idx = STAGES.findIndex((x) => x.id === session.stage);
    strip.replaceChildren(...STAGES.map((st, i) => h('div', { class: `st ${i < idx ? 'done' : ''} ${i === idx ? 'cur' : ''}`, text: `${i + 1}. ${st.label}` })));
  }

  function statLine(st, showStart = false) {
    const f = (k, v, fmt) => h('span', {}, `${{ carbon: '탄소', uniformity: '균일도', impurity: '불순도' }[k]} `, h('b', { text: appraise(k, v) }), dev() ? h('span', { class: 'devnum', text: ` ${fmt(v)}${showStart && st.start ? ` (시작 ${fmt(st.start[k])})` : ''}` }) : null);
    return h('div', { class: 'stat3' },
      f('carbon', st.carbon, (v) => `${v.toFixed(2)}%`), f('uniformity', st.uniformity, (v) => Math.round(v)), f('impurity', st.impurity, (v) => Math.round(v)));
  }

  function setBusy(b) { busy = b; panel.querySelectorAll('button[data-busy]').forEach((el) => { el.disabled = b || el.dataset.off === '1'; }); }

  async function run(anim) { setBusy(true); try { await anim; } finally { setBusy(false); render(); } }

  function bbtn(label, fn, opts = {}) {
    const b = button(label, () => { if (!busy) fn(); }, opts);
    b.dataset.busy = '1';
    if (opts.disabled) b.dataset.off = '1';
    if (busy) b.disabled = true;
    return b;
  }

  // ── 단계별 패널 ──────────────────────────
  function renderSelect() {
    panel.className = 'panel ws-panel tall';
    const cands = session.candidates();
    const list = h('div', { class: 'mat-list scroll-ok' });
    for (const c of cands) {
      const picked = session.picked.filter((u) => u === c.uid).length;
      const card = h('div', { class: `mat ${picked ? 'picked' : ''}`, 'data-testid': `mat-${c.uid}`, onClick: () => { const r = session.togglePick(c.uid); if (!r.ok && r.reason) app.toast(r.reason); render(); } },
        h('div', { class: 'nm', text: `${c.name}${picked ? `  ✔${picked > 1 ? `×${picked}` : ''}` : ''}` }),
        h('div', { class: 'og', text: c.source === 'storage' ? '공방 창고 · 언제나 있음' : `출처: ${c.origin}${c.tired ? ' · 지친 채 채집' : ''}` }),
        statLine(c));
      list.append(card);
    }
    const plan = session.smeltPreview();
    const slots = [0, 1].map((i) => {
      const uid = session.picked[i];
      if (uid === undefined) return h('div', { class: 'chip', text: `강재 ${i + 1}: (비어 있음)` });
      const c = cands.find((x) => x.uid === uid);
      return h('div', { class: 'chip good', text: `강재 ${i + 1}: ${c.name} · ${plan[i].useGood ? '좋은 숯으로 제철' : '마을 숯으로 제철(불순도↑)'}` });
    });
    const left = h('div', { class: 'left' },
      h('h2', { text: '감정과 제철 — 강재로 쓸 재료 두 개를 고르세요' }),
      h('div', { class: 'small muted', text: '탄소는 높을수록 좋은 것이 아닙니다. 날(피철)에는 탄소가 많은 쇠, 속심(심철)에는 적은 쇠가 어울립니다. 균일도는 높을수록, 불순도는 낮을수록 좋습니다.' }),
      list,
      h('div', { class: 'row' }, slots),
      h('div', { class: 'small', text: `좋은 숯 ${s.charcoal}자루 — 제철할 때 강재 하나에 한 자루씩 쓴다. 없으면 마을 숯을 쓴다.` }),
    );
    const right = h('div', { class: 'right', style: { gridTemplateColumns: '1fr' } },
      bbtn('제철하고 단련 시작', () => { const r = session.startRefining(); if (!r.ok) { app.toast(r.reason); return; } app.save(); render(); }, { cls: 'primary', disabled: session.picked.length !== 2, why: session.picked.length !== 2 ? '재료 두 개를 고르세요' : null, testid: 'start-refine' }),
      h('div', { class: 'small muted', text: '한 번 시작한 제작은 v0.1에서 중간에 그만둘 수 없습니다.' }),
      bbtn('공방 나가기', () => app.go('location'), { testid: 'leave-workshop' }),
    );
    panel.replaceChildren(left, right);
  }

  function renderRefine() {
    panel.className = 'panel ws-panel';
    const r = session.refine;
    const ing = session.ingots[session.refineIndex];
    dyn = {
      temp: h('span'), where: h('span'), fuel: h('span'), air: h('span'), scale: h('span'), stats: h('div'), folds: h('span'), hint: h('div', { class: 'hint' }),
    };
    const left = h('div', { class: 'left' },
      h('h2', {}, `단련 — 강재 ${session.refineIndex + 1}/2 · ${ing.name} `, h('span', { class: 'small muted', style: { fontWeight: 'normal' }, text: `출처 ${ing.origin} · ${ing.charcoal}으로 제철` })),
      h('div', { class: 'readout two' },
        h('span', { class: 'k', text: '강재 온도' }), dyn.temp,
        h('span', { class: 'k', text: '위치' }), dyn.where,
        h('span', { class: 'k', text: '화덕 숯·바람' }), h('span', {}, dyn.fuel, ' ', dyn.air),
        h('span', { class: 'k', text: '산화물' }), dyn.scale,
        h('span', { class: 'k', text: '성질' }), h('span', { class: 'span3' }, dyn.stats),
        h('span', { class: 'k', text: '접은 횟수' }), h('span', { class: 'span3' }, dyn.folds),
      ),
      dyn.hint,
    );
    const inF = r.inFurnace;
    const right = h('div', { class: 'right' },
      bbtn('숯 넣기', () => { r.addFuel(); view.fuelAnim(); }, { testid: 'r-fuel' }),
      bbtn('풀무질', () => { r.pump(); view.pumpAnim(); }, { testid: 'r-pump' }),
      inF ? bbtn('꺼내서 모루에 올리기', () => { r.takeOut(); run(view.moveBillet(false)); }, { testid: 'r-out' })
        : bbtn('화덕에 다시 넣기', () => { r.putIn(); run(view.moveBillet(true)); }, { testid: 'r-in' }),
      bbtn('산화물 털기', () => { const o = r.knockScale(); if (!o.ok) { app.toast(o.reason); return; } run(view.knockAnim()); }, { disabled: inF, why: inF ? '모루 위에서만' : null, testid: 'r-knock' }),
      bbtn('늘이고 접기', () => {
        const o = r.fold(); if (!o.ok) { app.toast(o.reason); return; }
        run(view.foldAnim());
      }, { disabled: inF, why: inF ? '모루 위에서만' : null, cls: inF ? '' : 'primary', testid: 'r-fold' }),
      bbtn(session.refineIndex === 0 ? '이 강재 단련 마치기 → 다음 강재' : '단련 마치기 → 배정', () => {
        const o = session.finishRefine(); if (!o.ok) { app.toast(o.reason); return; }
        app.save(); render();
      }, { disabled: r.folds < BALANCE.refine.fold.minFolds, why: r.folds < 1 ? '한 번 이상 접어야 함' : null, testid: 'r-finish' }),
    );
    panel.replaceChildren(left, right);
    tickRefineUI();
  }

  function tickRefineUI() {
    const r = session.refine; if (!r || !dyn.temp) return;
    const c = heatColor(r.steelT);
    dyn.temp.replaceChildren(h('span', { class: 'swatch', style: { background: rgbCss(c) } }), h('b', { text: r.band.label }), dev() ? h('span', { class: 'devnum', text: ` ${Math.round(r.steelT)}°C (화덕 ${Math.round(r.furnaceT)}°C)` }) : '');
    dyn.where.textContent = r.inFurnace ? '화덕 안 · 달구는 중' : '모루 위 · 식는 중';
    dyn.fuel.replaceChildren(bar(r.fuel, 100, 'heat short'));
    dyn.air.replaceChildren(bar(r.air, 100, 'short'));
    dyn.scale.replaceChildren(bar(r.scale, 1, 'tired'), h('span', { class: 'small muted', text: r.scale > 0.4 ? ' 두껍게 앉음' : r.scale > 0.15 ? ' 조금' : ' 깨끗함' }));
    dyn.stats.replaceChildren(statLine(r.steel, true));
    const eff = r.nextFoldEfficiency();
    dyn.folds.textContent = `${r.folds} / ${BALANCE.refine.fold.max} · 다음 접기 효과 ${eff > 0.7 ? '큼' : eff > 0.45 ? '보통' : '작음'}${dev() ? ` (${eff.toFixed(2)})` : ''}`;
    let hint;
    if (r.steelT > BALANCE.refine.overheat.burnAt) hint = '⚠ 쇠가 타고 있다! 바로 꺼내세요. (불순도↑ 균일도↓)';
    else if (r.steelT > BALANCE.refine.overheat.decarbAt) hint = '⚠ 과열 — 탄소가 빠르게 날아가고 산화물이 쌓인다.';
    else if (r.inFurnace && r.steelT >= 950 && r.fuel >= 50) hint = '숯불 속에서 쇠가 천천히 탄소를 머금고 있다.';
    else if (r.inFurnace && r.steelT >= BALANCE.refine.fold.goodTemp) hint = '접기 좋은 빛깔이다. 꺼내서 모루에 올려도 된다.';
    else if (r.inFurnace) hint = '아직 덜 달궈졌다. 숯을 넣고 풀무질하면 화덕이 뜨거워진다.';
    else if (r.steelT < BALANCE.refine.fold.minTemp) hint = '너무 식었다. 화덕에 다시 넣으세요.';
    else if (r.scale > 0.3) hint = '산화물이 앉았다. 털지 않고 접으면 효과가 떨어지고 때가 섞인다.';
    else hint = '두드려 늘이고 접을 수 있다. 접을 때마다 균일해지지만 탄소를 조금 잃는다.';
    dyn.hint.textContent = hint;
  }

  function renderAssign() {
    panel.className = 'panel ws-panel mid';
    const cards = session.steels.map((st, i) => h('div', { class: 'assign-card' },
      h('div', { class: 'nm', style: { fontWeight: '800', fontSize: '19px' }, text: `강재 ${i + 1}: ${st.name}` }),
      h('div', { class: 'small muted', text: `출처: ${st.origin} · 접기 ${st.folds}회` }),
      statLine(st, true),
      bbtn('이 강재를 피철(날·바깥)로', () => { session.assign(i); app.save(); render(); playJoin(); }, { cls: 'primary', testid: `assign-${i}` }),
    ));
    panel.replaceChildren(h('div', { class: 'left' },
      h('h2', { text: '배정 — 어느 강재를 피철로 쓸까?' }),
      h('div', { class: 'small', text: '피철은 바깥층과 날이 되어 단단하게 굳어야 하고, 심철은 속심이 되어 충격을 받아낸다. 두 강재의 성질은 섞지 않고 그대로 유지된다. 고르지 않은 쪽이 심철이 된다.' }),
      h('div', { class: 'assign-cards' }, cards),
    ));
  }

  async function playJoin() {
    const skin = session.skin; const core = session.core;
    void skin; void core;
    await run(view.joinAnim(heatColor(1050), heatColor(980)));
  }

  function renderJoin() {
    panel.className = 'panel ws-panel';
    panel.replaceChildren(
      h('div', { class: 'left' },
        h('h2', { text: '접합 (츠쿠리코미)' }),
        h('div', { text: `피철 「${session.skin.name}」이 심철 「${session.core.name}」을 감싸도록 붙인다. v0.1은 고정 구조 하나로 자동 처리한다.` }),
      ),
      h('div', { class: 'right', style: { gridTemplateColumns: '1fr' } },
        bbtn('성형으로', () => { session.finishJoin(); app.save(); render(); }, { cls: 'primary', testid: 'to-shape' })),
    );
  }

  function renderShape() {
    panel.className = 'panel ws-panel';
    const sh = session.shaping;
    dyn = { secs: [], temp: h('span'), hint: h('div', { class: 'hint' }), q: h('span', { class: 'devnum' }) };
    const secRow = h('div', { class: 'sections' });
    SECTION_NAMES.forEach((name, i) => {
      const b = h('div', { class: 'sec', 'data-testid': `sec-${i}`, onClick: () => hit(i), onMouseenter: () => { view.hoverSection = i; }, onMouseleave: () => { view.hoverSection = -1; } });
      dyn.secs.push(b);
      secRow.append(b);
      void name;
    });
    const left = h('div', { class: 'left' },
      h('h2', { text: '성형 — 도신을 구간별로 고르게 두드리세요' }),
      h('div', { class: 'small muted', text: '구간 버튼이나 도신 그림을 클릭해 두드린다. 식은 쇠를 치면 잔금이, 너무 치면 얇아진다.' }),
      secRow,
      h('div', { class: 'row' }, h('span', { class: 'muted', text: '도신 온도' }), dyn.temp, dyn.hint, dyn.q),
    );
    const right = h('div', { class: 'right', style: { gridTemplateColumns: '1fr' } },
      bbtn('다시 달구기', () => { sh.startReheat(); run(view.reheatAnim(1.2).then(() => sh.finishReheat())); }, { testid: 's-reheat' }),
      bbtn('성형 마치기 → 점토', () => { const o = session.finishShaping(); if (!o.ok) { app.toast(o.reason); return; } app.save(); render(); }, { cls: 'primary', testid: 's-finish' }),
    );
    panel.replaceChildren(left, right);
    tickShapeUI();
  }

  function hit(i) {
    if (busy || session.stage !== 'shape') return;
    const o = session.shaping.hit(i);
    if (!o.ok) { if (o.reason) app.toast(o.reason); return; }
    if (o.overNow) app.toast(`${SECTION_NAMES[i]} 구간이 너무 얇아졌다!`, 1400);
    view.shapeHit(i, o.quality);
    tickShapeUI();
  }

  function tickShapeUI() {
    const sh = session.shaping; if (!sh || !dyn.secs) return;
    const S = BALANCE.shaping;
    sh.progress.forEach((p, i) => {
      const b = dyn.secs[i];
      b.className = `sec ${sh.over[i] ? 'over' : ''}`;
      b.replaceChildren(h('div', { text: SECTION_NAMES[i] }), bar(Math.min(p, S.target), S.target, sh.over[i] ? 'tired' : p >= S.finishAt ? '' : 'heat'), h('div', { class: 'small', text: sh.over[i] ? '얇아짐' : p >= S.target ? '완성' : p >= S.finishAt ? '거의' : `${Math.round(p)}%` }));
    });
    const c = heatColor(sh.temp);
    dyn.temp.replaceChildren(h('span', { class: 'swatch', style: { background: rgbCss(c) } }), h('b', { text: sh.heating ? '화덕에서 달구는 중…' : sh.band.label }), dev() ? h('span', { class: 'devnum', text: ` ${Math.round(sh.temp)}°C · 냉간 타격 ${sh.coldHits}` }) : '');
    dyn.hint.textContent = sh.temp < S.hit.warmAt ? '쇠가 식었다. 다시 달구세요. (식은 쇠를 치면 잔금이 생긴다)' : sh.temp < S.hit.hotAt ? '조금 식었다. 덜 늘어난다.' : '두드리기 좋은 온도.';
    if (dev()) { const sm = sh.summary(); dyn.q.textContent = `형상 품질 ${sm.quality} · 편차 ${sm.deviation}`; } else dyn.q.textContent = '';
  }

  function renderClay() {
    panel.className = 'panel ws-panel';
    panel.replaceChildren(
      h('div', { class: 'left' },
        h('h2', { text: '다듬기와 점토' }),
        h('div', { text: '도신을 다듬고 점토를 바른다. 등 쪽은 두껍게, 날 쪽은 얇게 — v0.1은 기본 패턴 하나만 있다.' }),
        h('div', { class: 'hint', text: session.clay ? '점토를 발랐다. 이제 화덕에서 달궈 담금질한다.' : '' }),
      ),
      h('div', { class: 'right', style: { gridTemplateColumns: '1fr' } },
        session.clay
          ? bbtn('담금질로', () => { session.finishClay(); app.save(); render(); }, { cls: 'primary', testid: 'to-quench' })
          : bbtn('기본 패턴으로 점토 바르기', () => { session.applyClay(); run(view.clayAnim(session.shapingSummary.progress)); }, { cls: 'primary', testid: 'apply-clay' }),
      ),
    );
  }

  function renderQuench() {
    panel.className = 'panel ws-panel';
    const q = session.quench;
    dyn = { temp: h('span'), even: h('span'), where: h('span'), hint: h('div', { class: 'hint' }) };
    panel.replaceChildren(
      h('div', { class: 'left' },
        h('h2', { text: '담금질 — 언제 물에 넣을까?' }),
        h('div', { class: 'small muted', text: '긴 숯불 위에서 도신이 달궈진다. 오래 두면 전체가 고르게 달궈지지만 너무 뜨거워질 수 있다. 빛깔을 보고 물에 넣으세요.' }),
        h('div', { class: 'readout' },
          h('span', { class: 'k', text: '도신 빛깔' }), dyn.temp,
          h('span', { class: 'k', text: '고르게 달궈짐' }), dyn.even,
          h('span', { class: 'k', text: '위치' }), dyn.where),
        dyn.hint,
      ),
      h('div', { class: 'right', style: { gridTemplateColumns: '1fr' } },
        bbtn(q.inFurnace ? '숯불에서 잠시 들어 올려 식히기' : '숯불 위에 다시 올리기', () => { q.toggleFurnace(); render(); }, { testid: 'q-toggle' }),
        bbtn('물에 담그기!', () => doQuench(), { cls: 'primary', testid: 'q-quench' }),
      ),
    );
    tickQuenchUI();
  }

  function tickQuenchUI() {
    const q = session.quench; if (!q || !dyn.even) return;
    const c = heatColor(q.temp);
    dyn.temp.replaceChildren(h('span', { class: 'swatch', style: { background: rgbCss(c) } }), h('b', { text: q.band.label }), dev() ? h('span', { class: 'devnum', text: ` ${Math.round(q.temp)}°C` }) : '');
    dyn.even.replaceChildren(bar(q.evenness, 1), h('span', { class: 'small', text: ` ${Math.round(q.evenness * 100)}%` }));
    dyn.where.textContent = q.inFurnace ? '숯불 위 (달궈지는 중)' : '들어 올림 (식는 중)';
    dyn.hint.textContent = q.temp > 900 ? '⚠ 꽤 뜨겁다. 이대로 물에 넣으면 갈라질 수 있다.' : q.temp < 700 ? '아직 어둡다. 이대로는 잘 굳지 않는다.' : '물에 넣을 만한 빛깔이 되어 간다.';
  }

  async function doQuench() {
    const o = session.doQuench();
    if (!o.ok) return;
    app.save();
    const hamon = o.record.hardening.value > 30 ? (o.record.hardening.localUneven ? P.mist : P.white) : null;
    await run(view.quenchAnim(session.shapingSummary.progress, hamon));
    app.go('result', { record: o.record });
  }

  // ── 렌더·프레임 ───────────────────────────
  function render() {
    renderStrip();
    if (stageShown !== session.stage) { view.setMode(session.stage); stageShown = session.stage; }
    dyn = {};
    ({ select: renderSelect, refine: renderRefine, assign: renderAssign, join: renderJoin, shape: renderShape, clay: renderClay, quench: renderQuench, done: () => {} })[session.stage]();
    if (session.stage === 'shape' || session.stage === 'clay') view.setBlade(session.shaping.progress, session.stage === 'clay' ? 20 : session.shaping.temp, { clay: session.clay });
    app.renderHud();
  }

  const tick = (dt) => {
    if (session.stage === 'refine' && session.refine) { session.refine.tick(dt); view.syncRefine(session.refine); }
    if (session.stage === 'shape' && session.shaping) { session.shaping.tick(dt); view.setBlade(session.shaping.progress, session.shaping.temp); }
    if (session.stage === 'quench' && session.quench && !session.quench.done) { session.quench.tick(dt); view.syncQuench(session.quench, session.shapingSummary.progress); }
    uiTimer -= dt;
    if (uiTimer <= 0) {
      uiTimer = 0.1;
      if (session.stage === 'refine') { tickRefineUI(); refreshRefineButtons(); }
      if (session.stage === 'shape') tickShapeUI();
      if (session.stage === 'quench') tickQuenchUI();
    }
  };
  app.stage.listeners.push(tick);

  // 화덕 안/밖이 바뀌면 버튼 구성이 달라진다
  let lastIn = null;
  function refreshRefineButtons() {
    const r = session.refine; if (!r) return;
    if (lastIn !== null && lastIn !== r.inFurnace && !busy) renderRefine();
    lastIn = r.inFurnace;
  }

  // 도신 직접 클릭
  const canvas = app.stage.canvas;
  const onClick = (e) => {
    if (session.stage !== 'shape') return;
    const p = app.stage.toPixel(e);
    const i = view.pickSection(p.x, p.y);
    if (i >= 0) hit(i);
  };
  const onMove = (e) => {
    if (session.stage !== 'shape') return;
    const p = app.stage.toPixel(e);
    const i = view.pickSection(p.x, p.y);
    view.hoverSection = i;
    canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);

  render();
  if (session.stage === 'join') playJoin();
  return {
    refresh: render,
    unmount() {
      app.stage.listeners = app.stage.listeners.filter((f) => f !== tick);
      canvas.removeEventListener('click', onClick); canvas.removeEventListener('mousemove', onMove);
      canvas.style.cursor = 'default';
    },
  };
}
