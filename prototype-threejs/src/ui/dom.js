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
