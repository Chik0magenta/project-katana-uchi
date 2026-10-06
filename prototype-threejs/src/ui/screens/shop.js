// 상점 창: 마을 상점과 길 위 행상인이 함께 쓴다. 사고팔기는 시간을 쓰지 않는다.
import { h, button, openModal } from '../dom.js';
import { buy, sell, sellOffers, canBuy, itemDesc } from '../../core/economy.js';

export function openShop(app, shop, { onChange } = {}) {
  const s = app.state;
  const m = openModal(app, { title: shop.name, testid: 'shop', cls: 'shop-modal', onClose: onChange });
  let msg = shop.greeting || '';

  function render() {
    m.setSub(`가진 돈 ${s.money}문`);
    const buyRows = shop.stock.map((it) => {
      const chk = canBuy(s, it);
      return h('div', { class: 'shop-row' },
        h('div', { class: 'grow' }, h('b', { text: it.name }), h('div', { class: 'muted small', text: itemDesc(it) })),
        h('span', { class: 'qty small muted', text: it.qty > 0 ? `남은 ${it.qty}` : '품절' }),
        h('span', { class: 'price', text: `${it.price}문` }),
        button('사기', () => act(buy(s, shop, it.key)), { cls: 'small-btn', disabled: !chk.ok, why: chk.ok ? null : chk.reason, testid: `buy-${it.key}` }));
    });
    const offers = sellOffers(s, shop);
    const sellRows = offers.length ? offers.map((o) => h('div', { class: 'shop-row' },
      h('div', { class: 'grow' }, h('b', { text: o.name }), h('div', { class: 'muted small', text: o.sub })),
      h('span', { class: 'price', text: `${o.price}문` }),
      button('팔기', () => act(sell(s, shop, o.key)), { cls: 'small-btn', testid: `sell-${o.key}` })))
      : [h('div', { class: 'muted small', text: '팔 물건이 없습니다. (식량은 팔지 않는다)' })];
    m.body.replaceChildren(
      h('div', { class: 'shop-msg', 'data-testid': 'shop-msg', text: msg }),
      h('div', { class: 'shop-grid' },
        h('section', { class: 'shop-col' }, h('h3', { text: '사기' }), h('div', { class: 'shop-list scroll-ok' }, buyRows)),
        h('section', { class: 'shop-col' }, h('h3', { text: '팔기' }), h('div', { class: 'muted small', text: rateText(shop) }), h('div', { class: 'shop-list scroll-ok' }, sellRows)),
      ),
    );
    app.renderHud();
  }

  function act(r) {
    if (!r.ok) { app.toast(r.reason); return; }
    msg = r.text;
    app.save();
    render();
  }

  render();
  return m;
}

function rateText(shop) {
  const b = shop.buy;
  const pct = (v) => `${Math.round(v * 100)}%`;
  return `감정가 대비: 도신·카타나 ${pct(b.blade)} · 원료 ${pct(b.raw)}`;
}
