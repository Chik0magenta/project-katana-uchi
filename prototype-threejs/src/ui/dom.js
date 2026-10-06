// 아주 작은 DOM 도우미. Godot 이식 시 Control 노드(Label/Button/PanelContainer)에 대응한다.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'disabled') el.disabled = !!v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function button(label, onClick, { cls = '', disabled = false, why = null, testid = null } = {}) {
  const b = h('button', { class: `btn ${cls}`, onClick: (e) => { if (!b.disabled) onClick(e); }, disabled, title: why || null, 'data-testid': testid });
  b.append(h('span', { class: 'btn-label', text: label }));
  if (disabled && why) b.append(h('span', { class: 'btn-why', text: why }));
  return b;
}

export function bar(value, max, cls = '') {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return h('span', { class: `bar ${cls}` }, h('span', { class: 'bar-fill', style: { width: `${pct}%` } }));
}

export function changesText(changes) {
  return changes.map((c) => `${c.label} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(' · ');
}

export function changeChips(changes) {
  return h('div', { class: 'chips' }, changes.map((c) => {
    const good = (c.key === 'fatigue' ? -c.delta : c.delta) > 0;
    return h('span', { class: `chip ${good ? 'good' : 'bad'}`, text: `${c.label} ${c.delta > 0 ? '+' : ''}${c.delta}` });
  }));
}

// 픽셀 그림(PixelCanvas)을 확대한 <img>로 (소지품·상점 등 DOM 화면에서 쓰는 작은 그림)
export function pixImg(pc, scale = 2, cls = '') {
  return h('img', { class: `pix ${cls}`, src: pc.canvas.toDataURL(), width: pc.w * scale, height: pc.h * scale, alt: '' });
}

export function statBar(label, value, max = 100, opts = {}) {
  return h('div', { class: 'stat-row' },
    h('span', { class: 'k', text: label }),
    bar(value, max, opts.cls || 'stat'),
    h('b', { text: opts.text ?? String(value) }));
}

// 화면 위에 겹쳐 여는 창 (소지품·상점·코시라에·연마소). 길 위·장소 화면 상태를 그대로 둔 채 열고 닫는다.
export function openModal(app, { title, testid = 'modal', cls = '', onClose } = {}) {
  app.modal?.close();
  const body = h('div', { class: 'modal-body' });
  const sub = h('span', { class: 'modal-sub' });
  const back = h('div', { class: 'modal-back' });
  function close() {
    back.remove();
    if (app.modal === handle) app.modal = null;
    onClose?.();
    app.renderHud();
  }
  const box = h('div', { class: `panel modal ${cls}`, 'data-testid': testid },
    h('div', { class: 'modal-head' }, h('h2', { text: title }), sub, h('span', { class: 'grow' }), button('닫기 (Esc)', close, { cls: 'small-btn center', testid: 'modal-close' })),
    body);
  back.append(box);
  app.ui.append(back);
  const handle = { body, box, close, setSub: (t) => { sub.textContent = t; } };
  app.modal = handle;
  return handle;
}
