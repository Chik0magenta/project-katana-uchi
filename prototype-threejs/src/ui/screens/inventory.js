// 소지품: 돈·식량·숯·원료, 완성한 도신, 카타나(수치·상태·장비), 일행의 전투력.
// 어느 화면에서든 상단 막대의 '소지품' 버튼(또는 I 키)으로 겹쳐 연다. 장비 바꾸기는 시간을 쓰지 않는다.
import { h, button, openModal, pixImg, statBar } from '../dom.js';
import { appraise } from '../../core/state.js';
import { BALANCE } from '../../data/balance.js';
import { KOSHIRAE } from '../../data/gear.js';
import {
  ownedBlades, isBroken, weaponPower, partyView, partyIds, holderOf, equip, CONDITION_NAMES,
} from '../../core/weapons.js';
import { bladeValue, katanaValue } from '../../core/economy.js';
import { recordOf } from '../../core/state.js';
import { bladeThumb } from '../../render/art/backgrounds.js';

export function openInventory(app) {
  const s = app.state;
  if (!s) return null;
  const m = openModal(app, { title: '소지품', testid: 'inventory', cls: 'inv-modal' });

  function render() {
    m.setSub(`${s.day}일차 · 돈 ${s.money}문`);
    m.body.replaceChildren(
      h('div', { class: 'inv-grid' },
        h('section', { class: 'inv-col' }, h('h3', { text: '물자' }), supplies()),
        h('section', { class: 'inv-col' }, h('h3', { text: `도신 (${s.blades.length})` }), blades()),
        h('section', { class: 'inv-col wide' }, h('h3', { text: `카타나 (${s.weapons.length})` }), katanas(), h('h3', { text: '일행' }), party()),
      ),
    );
    app.renderHud();
  }

  function supplies() {
    const raw = s.raw.length
      ? s.raw.map((r) => h('div', { class: 'inv-item', 'data-testid': `inv-raw-${r.uid}` },
        h('b', { text: r.name }), h('div', { class: 'muted small', text: `출처 ${r.origin}${r.tired ? ' · 지친 채 채집' : ''}` }),
        h('div', { class: 'small' }, `탄소 ${appraise('carbon', r.carbon)} · 균일도 ${appraise('uniformity', r.uniformity)} · 불순도 ${appraise('impurity', r.impurity)}`,
          app.devNumbers ? h('span', { class: 'devnum', text: ` (${r.carbon.toFixed(2)}% / ${r.uniformity} / ${r.impurity})` }) : null)))
      : [h('div', { class: 'muted small', text: '원료 없음 — 강변(사철)·산지(철광석)에서 구하거나 상점에서 산다.' })];
    return h('div', { class: 'inv-list scroll-ok' },
      h('div', { class: 'inv-money', 'data-testid': 'inv-money' }, h('span', { class: 'muted', text: '돈 ' }), h('b', { text: `${s.money}문` })),
      h('div', { class: 'small' }, `식량 ${s.food}/${BALANCE.food.max} · 좋은 숯 ${s.charcoal}자루`),
      h('div', { class: 'muted small', text: `원료 ${s.raw.length}개` }),
      raw);
  }

  function blades() {
    const list = ownedBlades(s);
    if (!list.length) return h('div', { class: 'muted small', text: '가진 도신이 없습니다. 공방 마을 공방에서 만들 수 있습니다.' });
    return h('div', { class: 'inv-list scroll-ok' }, list.map(({ uid, record: r }) => h('div', { class: 'inv-item', 'data-testid': `inv-blade-${uid}` },
      pixImg(bladeThumb(r), 2),
      h('div', {}, h('b', { text: `${r.no}번 도신 — ${r.grade}` }), h('span', { class: 'muted small', text: ` ${r.score}점 · ${r.day}일차` })),
      h('div', { class: 'small', text: `경화 ${r.hardening.label} · 건전성 ${r.soundness.label} · 형상 ${r.shape.label}` }),
      h('div', { class: 'small muted', text: isBroken(r) ? '부러져서 코시라에를 맞출 수 없다. 고철 값만 받는다.' : `성하 마을에서 코시라에를 맞추면 카타나가 된다 · 감정가 ${bladeValue(r)}문` }))));
  }

  function katanas() {
    if (!s.weapons.length) return h('div', { class: 'muted small', text: '카타나가 없습니다. 성하 마을의 칼집장이에게 도신을 가져가 코시라에를 맞추세요.' });
    return h('div', { class: 'inv-list scroll-ok' }, s.weapons.map((w) => katanaCard(w)));
  }

  function katanaCard(w) {
    const r = recordOf(s, w.bladeNo);
    const who = holderOf(s, w.uid);
    const btns = h('div', { class: 'row wrap' });
    for (const id of partyIds(s)) {
      if (who === id) continue;
      const name = id === 'smith' ? '도공' : '벤케이';
      btns.append(button(`${name}에게 쥐여 주기`, () => { equip(s, id, w.uid); app.save(); render(); }, { cls: 'small-btn', testid: `equip-${id}-${w.uid}` }));
    }
    if (who) btns.append(button('내려놓기', () => { equip(s, who, null); app.save(); render(); }, { cls: 'small-btn', testid: `unequip-${w.uid}` }));
    return h('div', { class: 'inv-item katana', 'data-testid': `inv-katana-${w.uid}` },
      r ? pixImg(bladeThumb(r, w.koshirae), 2) : null,
      h('div', { class: 'row' }, h('b', { class: 'grow', text: `${w.name} · ${KOSHIRAE[w.koshirae].name}` }), h('span', { class: 'power', text: `무기 성능 ${weaponPower(w)}` })),
      h('div', { class: 'stat-grid' },
        statBar('날카로움', w.sharpness, 100, { text: `${w.sharpness}/${w.sharpMax}` }),
        statBar('날 유지력', w.retention),
        statBar('도신 내구력', w.durability),
        h('div', { class: 'stat-row' }, h('span', { class: 'k', text: '무게' }), h('b', { text: `${w.weight.toFixed(2)}kg` }), h('span', { class: `cond ${w.condition}`, text: ` · ${CONDITION_NAMES[w.condition]}` })),
      ),
      h('div', { class: 'row' }, h('span', { class: 'small muted grow', text: who ? `${who === 'smith' ? '도공' : '벤케이'}이(가) 쥐고 있다 · 싸움 ${w.battles}번 · 감정가 ${katanaValue(s, w)}문` : `싸움 ${w.battles}번 · 감정가 ${katanaValue(s, w)}문` }), btns));
  }

  function party() {
    return h('div', { class: 'party' }, partyView(s).map((u) => h('div', { class: 'party-row', 'data-testid': `party-${u.id}` },
      h('b', { text: u.name }),
      h('span', { class: 'small', text: `기본 실력 ${u.skill} · ${u.weapon.name} (성능 ${u.weapon.power})` }),
      h('span', { class: 'power', text: `전투력 ${u.power}` }))),
    h('div', { class: 'muted small', text: `전투력 = 기본 실력 × ${BALANCE.combat.skillWeight} + 무기 성능 × ${BALANCE.combat.weaponWeight}` }));
  }

  render();
  return m;
}
