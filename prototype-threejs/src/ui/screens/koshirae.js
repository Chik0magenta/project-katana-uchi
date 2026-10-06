// 성하 마을의 칼집장이(코시라에)와 연마소 창.
// 코시라에: 도신 하나와 등급을 고르면 완성될 카타나의 네 수치와 근거, 일행 전투력 변화를 미리 보여 주고 맞춘다(1일).
// 연마소: 무뎌진 날을 세우고, 이 빠진 날을 갈고, 휜 도신을 바로잡는다(시간 없음).
import { h, button, openModal, pixImg, statBar, changeChips } from '../dom.js';
import { KOSHIRAE } from '../../data/gear.js';
import { UNITS } from '../../data/gear.js';
import {
  mountableBlades, mountPreview, mountKatana, unitPower, partyView, equip, polishQuote, polishWeapon, weaponPower, CONDITION_NAMES,
} from '../../core/weapons.js';
import { recordOf } from '../../core/state.js';
import { bladeThumb } from '../../render/art/backgrounds.js';

export function openKoshirae(app, { onDone } = {}) {
  const s = app.state;
  const m = openModal(app, { title: '칼집장이 — 코시라에 맞추기', testid: 'koshirae', cls: 'kosh-modal', onClose: onDone });
  let bladeUid = mountableBlades(s)[0]?.uid ?? null;
  let kosh = 'plain';
  let made = null;

  function render() {
    m.setSub(`가진 돈 ${s.money}문`);
    if (made) { renderDone(); return; }
    const blades = mountableBlades(s);
    if (!blades.length) {
      m.body.replaceChildren(h('div', { class: 'msg', text: '"맞출 도신이 없구먼. 공방 마을에서 도신을 만들어 오시게." — 부러진 도신에는 맞출 수 없습니다.' }));
      return;
    }
    const left = h('section', { class: 'kosh-col' }, h('h3', { text: '1. 도신 고르기' }),
      h('div', { class: 'kosh-list scroll-ok' }, blades.map(({ uid, record: r }) => h('div', {
        class: `pick ${uid === bladeUid ? 'picked' : ''}`, 'data-testid': `kosh-blade-${uid}`, onClick: () => { bladeUid = uid; render(); },
      }, pixImg(bladeThumb(r), 2), h('div', {}, h('b', { text: `${r.no}번 도신 — ${r.grade}` }), h('span', { class: 'muted small', text: ` ${r.score}점 · 경화 ${r.hardening.label} · ${r.soundness.label}` }))))),
      h('h3', { text: '2. 코시라에 등급' }),
      h('div', { class: 'kosh-opts' }, Object.values(KOSHIRAE).map((k) => h('div', {
        class: `pick ${k.id === kosh ? 'picked' : ''}`, 'data-testid': `kosh-opt-${k.id}`, onClick: () => { kosh = k.id; render(); },
      }, h('b', { text: `${k.name} — ${k.cost}문` }), h('div', { class: 'small muted', text: k.desc })))));

    const p = mountPreview(s, bladeUid, kosh);
    const right = h('section', { class: 'kosh-col' }, h('h3', { text: '3. 완성 예상' }));
    if (p.stats) {
      right.append(
        pixImg(bladeThumb(p.record, kosh), 3, 'kosh-preview'),
        h('div', { class: 'stat-grid wide' },
          why(statBar('날카로움', p.stats.sharpness), p.stats.why.sharpness, '전투력에 크게 반영'),
          why(statBar('날 유지력', p.stats.retention), p.stats.why.retention, '높을수록 싸울 때 덜 무뎌진다'),
          why(statBar('도신 내구력', p.stats.durability), p.stats.why.durability, '싸움의 충격이 이보다 크면 이가 빠지거나 휜다'),
          why(h('div', { class: 'stat-row' }, h('span', { class: 'k', text: '무게' }), h('b', { text: `${p.stats.weight.toFixed(2)}kg` })), p.stats.why.weight, '전투력에 작게 반영'),
        ),
        h('div', { class: 'row' }, h('b', { class: 'power', text: `무기 성능 ${p.power}` }), h('span', { class: 'small muted', text: compareText(s, p.power) })),
      );
    }
    right.append(
      h('div', { class: 'grow' }),
      ...(p.warnings?.length ? [h('div', { class: 'warn small', text: `⚠ ${p.warnings.join(' · ')}` })] : []),
      button(`맞추기 — ${KOSHIRAE[kosh].cost}문 · ${p.days || 1}일 (식량 1)`, () => {
        const r = mountKatana(s, bladeUid, kosh);
        if (!r.ok) { app.toast(r.reason); return; }
        made = r; app.save(); render();
      }, { cls: 'primary center', disabled: !p.ok, why: p.ok ? null : p.reason, testid: 'kosh-confirm' }),
    );
    m.body.replaceChildren(h('div', { class: 'kosh-grid' }, left, right));
    app.renderHud();
  }

  function renderDone() {
    app.renderHud();
    const w = made.weapon;
    const r = recordOf(s, w.bladeNo);
    m.body.replaceChildren(h('div', { class: 'kosh-done' },
      h('h3', { text: `${w.name}이(가) 완성되었다` }),
      pixImg(bladeThumb(r, w.koshirae), 3, 'kosh-preview'),
      h('div', { class: 'stat-grid wide' },
        statBar('날카로움', w.sharpness), statBar('날 유지력', w.retention), statBar('도신 내구력', w.durability),
        h('div', { class: 'stat-row' }, h('span', { class: 'k', text: '무게' }), h('b', { text: `${w.weight.toFixed(2)}kg` }))),
      h('div', { class: 'row' }, h('b', { class: 'power', text: `무기 성능 ${weaponPower(w)}` }), changeChips(made.changes)),
      h('div', { class: 'row' },
        button('도공에게 쥐여 주기', () => { equip(s, 'smith', w.uid); app.save(); app.toast('도공이 새 카타나를 허리에 찼다.'); m.close(); }, { cls: 'primary', testid: 'kosh-equip-smith' }),
        s.companions.benkei ? button('벤케이에게 쥐여 주기', () => { equip(s, 'benkei', w.uid); app.save(); app.toast('벤케이가 카타나를 받아 들었다.'); m.close(); }, { testid: 'kosh-equip-benkei' }) : null,
        button('소지품에 넣어 두기', () => m.close(), { testid: 'kosh-keep' }))));
  }

  render();
  return m;
}

function why(row, text, role) {
  return h('div', { class: 'why' }, row, h('div', { class: 'small muted', text: `${role} · ${text}` }));
}

// 지금 장비와 비교: 이 칼을 쥐면 전투력이 어떻게 바뀌나
function compareText(s, power) {
  return partyView(s).map((u) => `${u.name} 전투력 ${u.power} → ${unitPower(UNITS[u.id].skill, power)}`).join(' · ');
}

export function openPolish(app, { onDone } = {}) {
  const s = app.state;
  const m = openModal(app, { title: '연마소', testid: 'polish', cls: 'polish-modal', onClose: onDone });
  let msg = '"칼은 쓰면 무뎌지는 법. 날이 상하면 가져오시오."';

  function render() {
    m.setSub(`가진 돈 ${s.money}문`);
    const rows = s.weapons.length ? s.weapons.map((w) => {
      const q = polishQuote(w);
      const r = recordOf(s, w.bladeNo);
      return h('div', { class: 'inv-item katana', 'data-testid': `polish-${w.uid}` },
        r ? pixImg(bladeThumb(r, w.koshirae), 2) : null,
        h('div', { class: 'row' }, h('b', { class: 'grow', text: w.name }), h('span', { class: `cond ${w.condition}`, text: CONDITION_NAMES[w.condition] })),
        statBar('날카로움', w.sharpness, 100, { text: `${w.sharpness}/${w.sharpMax}` }),
        h('div', { class: 'row' },
          button(q.sharpen === null ? '날이 서 있다' : `날 세우기 — ${q.sharpen}문${w.condition === 'chipped' ? ' (이 빠진 곳 포함)' : ''}`, () => act(polishWeapon(s, w.uid, 'sharpen')), { cls: 'small-btn', disabled: q.sharpen === null || s.money < q.sharpen, why: q.sharpen !== null && s.money < q.sharpen ? '돈이 모자랍니다' : null, testid: `polish-sharpen-${w.uid}` }),
          q.straighten !== null ? button(`휜 도신 바로잡기 — ${q.straighten}문`, () => act(polishWeapon(s, w.uid, 'straighten')), { cls: 'small-btn', disabled: s.money < q.straighten, testid: `polish-straighten-${w.uid}` }) : null));
    }) : [h('div', { class: 'muted small', text: '연마할 카타나가 없습니다.' })];
    m.body.replaceChildren(h('div', { class: 'shop-msg', 'data-testid': 'polish-msg', text: msg }), h('div', { class: 'polish-list scroll-ok' }, rows));
    app.renderHud();
  }

  function act(r) {
    if (!r.ok) { app.toast(r.reason); return; }
    msg = r.text; app.save(); render();
  }

  render();
  return m;
}
