// 결과: 완성 도신의 그림, 경화·건전성·형상, 실제 계산에 들어간 원인, 재료 출처, 지난 결과와 비교.
import { h, button } from '../dom.js';
import { ResultView } from '../../render/views/resultView.js';
import { appraise } from '../../core/state.js';

export function mountResult(app, params) {
  const s = app.state;
  const r = params.record || s.results[s.results.length - 1];
  app.stage.setView(new ResultView(r));
  app.hud();
  const prev = s.results.length >= 2 ? s.results[s.results.length - 2] : null;

  const steelLine = (label, st) => h('div', { class: 'small', style: { marginBottom: '6px' } },
    h('b', { text: `${label}: ${st.name}` }), h('div', { class: 'muted', text: `출처 ${st.origin} · 제철 ${st.charcoal || '-'} · 접기 ${st.folds}회` }),
    h('div', {}, `탄소 ${appraise('carbon', st.carbon)} · 균일도 ${appraise('uniformity', st.uniformity)} · 불순도 ${appraise('impurity', st.impurity)}`,
      app.devNumbers ? h('span', { class: 'devnum', text: ` (${st.carbon.toFixed(2)}% / ${st.uniformity} / ${st.impurity})` }) : null));

  const soundCls = r.soundness.label === '정상' ? 'good-text' : 'bad-text';
  const hardCls = r.hardening.value >= 75 && !r.hardening.localUneven ? 'good-text' : r.hardening.value < 45 ? 'bad-text' : 'warn';

  app.ui.append(
    h('div', { class: 'res-title passthrough', 'data-testid': 'grade', text: `${r.no}번째 도신 — ${r.grade}` }),
    h('div', { class: 'res-sub passthrough', text: `종합 ${r.score}점 · ${r.day}일차 완성 (제작에 2일 소요) · ${r.soundness.label === '파단' ? '부러진 도신은 소지품에 고철로 남았다' : '소지품에 넣었다 — 성하 마을에서 코시라에를 맞추면 카타나가 된다'}` }),
    h('div', { class: 'panel res-panel' },
      h('div', {},
        h('h2', { text: '도신의 성질' }),
        axis('경화', r.hardening.label, hardCls, app.devNumbers ? `경화도 ${r.hardening.value}` : null),
        axis('건전성', r.soundness.label, soundCls, app.devNumbers ? `균열 위험 ${r.soundness.crack} · 휨 위험 ${r.soundness.warp}` : null),
        axis('형상', `${r.shape.label}`, r.shape.quality >= 85 ? 'good-text' : r.shape.quality < 65 ? 'bad-text' : 'warn', r.shape.defects.join(' · ') || '눈에 띄는 결함 없음'),
        axis('담금질', `${r.quench.temp}°C에서 · 고름 ${Math.round(r.quench.evenness * 100)}%`, '', null),
      ),
      h('div', {},
        h('h2', { text: '왜 이렇게 되었나' }),
        r.causes.map((c) => h('div', { class: `cause ${c.impact > 0 ? 'plus' : 'minus'}` }, h('span', { class: 'mark', text: c.impact > 0 ? '+' : '−' }), h('span', {}, h('span', { class: 'muted', text: `[${c.axis}] ` }), c.text))),
        prev ? compare(prev, r) : null,
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('h2', { text: '쓰인 재료' }),
        steelLine('피철 (날·바깥)', r.skin),
        steelLine('심철 (속심)', r.core),
        h('div', { class: 'grow' }),
        h('div', { class: 'res-buttons', style: { flexDirection: 'column' } },
          button('다시 제작하기 — 공방으로', () => app.go('workshop'), { cls: 'primary', testid: 'retry-forge' }),
          button('재료를 구하러 — 지도로', () => app.go('map'), { testid: 'to-map' }),
        ),
      ),
    ),
  );
}

function axis(k, v, cls, sub) {
  return h('div', { class: 'axis' }, h('div', { class: 'k', text: k }), h('div', { class: `v ${cls}`, text: v }), sub ? h('div', { class: 'small muted', text: sub }) : null);
}

function compare(prev, cur) {
  const d = cur.score - prev.score;
  const diffs = [];
  if (Math.abs(cur.skin.carbon - prev.skin.carbon) >= 0.05) diffs.push(`피철 탄소 ${prev.skin.carbon.toFixed(2)}→${cur.skin.carbon.toFixed(2)}%`);
  if (Math.abs(cur.quench.temp - prev.quench.temp) >= 20) diffs.push(`담금질 ${prev.quench.temp}→${cur.quench.temp}°C`);
  if (Math.abs(cur.shape.quality - prev.shape.quality) >= 5) diffs.push(`형상 ${prev.shape.quality}→${cur.shape.quality}`);
  return h('div', { class: 'small', style: { marginTop: '10px', borderTop: '1px solid #5a5470', paddingTop: '6px' } },
    h('b', { text: `지난 도신(${prev.grade}, ${prev.score}점)과 비교: ${d >= 0 ? '+' : ''}${d}점` }),
    diffs.length ? h('div', { class: 'muted', text: diffs.join(' · ') }) : null);
}
