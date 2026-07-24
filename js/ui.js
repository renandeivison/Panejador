// ui.js — utilidades de interface: formatação, modais, toasts, confirmações.

const UI = (() => {
  const fmtMoney = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const fmtDateShort = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function toast(message, kind = 'info') {
    const host = document.getElementById('toast-host');
    const t = el('div', { class: `toast toast-${kind}` }, message);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  let modalStack = [];

  function openModal({ title, content, size = 'md', onClose }) {
    const overlay = el('div', { class: 'modal-overlay' });
    const modal = el('div', { class: `modal-panel modal-${size}` });
    const header = el('div', { class: 'modal-header' }, [
      el('h3', {}, title),
      el('button', { class: 'icon-btn modal-close', 'aria-label': 'Fechar', onclick: () => close() }, '✕'),
    ]);
    const body = el('div', { class: 'modal-body' });
    if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    function close() {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 220);
      modalStack = modalStack.filter((m) => m !== close);
      if (onClose) onClose();
    }
    modalStack.push(close);
    return { close, body, overlay };
  }

  function closeTopModal() {
    const fn = modalStack[modalStack.length - 1];
    if (fn) fn();
  }

  function confirmDialog({ title = 'Confirmar', message, choices }) {
    // choices: [{label, value, danger}] — retorna Promise<value|null>
    return new Promise((resolve) => {
      const wrap = el('div', { class: 'confirm-body' });
      wrap.appendChild(el('p', { class: 'confirm-message' }, message));
      const btnRow = el('div', { class: 'confirm-actions' });
      const opts = choices || [
        { label: 'Cancelar', value: null },
        { label: 'Confirmar', value: true, danger: false },
      ];
      let modalRef;
      opts.forEach((opt) => {
        btnRow.appendChild(el('button', {
          class: `btn ${opt.danger ? 'btn-danger' : opt.primary ? 'btn-primary' : 'btn-ghost'}`,
          onclick: () => { resolve(opt.value); modalRef.close(); },
        }, opt.label));
      });
      wrap.appendChild(btnRow);
      modalRef = openModal({ title, content: wrap, size: 'sm', onClose: () => resolve(null) });
    });
  }

  // ---------- Ordenação (compartilhada entre as listas) ----------
  const SORT_OPTIONS_FULL = [
    { key: 'date', label: 'Data da movimentação' },
    { key: 'value', label: 'Valor' },
    { key: 'alpha', label: 'Alfabético' },
    { key: 'installments', label: 'Quantidade de parcelas' },
    { key: 'finishing', label: 'Mais perto de terminar' },
    { key: 'person', label: 'Pessoa responsável' },
  ];
  const SORT_OPTIONS_SIMPLE = [
    { key: 'alpha', label: 'Alfabético' },
    { key: 'value', label: 'Valor' },
  ];

  function sortComparator(key) {
    return (a, b) => {
      switch (key) {
        case 'value':
          return Math.abs(b.value || 0) - Math.abs(a.value || 0);
        case 'alpha':
          return (a.title || '').localeCompare(b.title || '', 'pt-BR');
        case 'date': {
          const ad = a.date || '', bd = b.date || '';
          return ad > bd ? 1 : ad < bd ? -1 : 0;
        }
        case 'installments':
          return (b.totalInstallments || 0) - (a.totalInstallments || 0);
        case 'finishing': {
          const remA = a.totalInstallments ? a.totalInstallments - (a.installmentNumber || 0) : Infinity;
          const remB = b.totalInstallments ? b.totalInstallments - (b.installmentNumber || 0) : Infinity;
          return remA - remB;
        }
        case 'person':
          return (a.personName || '').localeCompare(b.personName || '', 'pt-BR');
        default:
          return 0;
      }
    };
  }

  function buildSortControl(current, onChange, options) {
    const opts = options || SORT_OPTIONS_FULL;
    return el('select', { class: 'sort-select', onchange: (e) => onChange(e.target.value) },
      opts.map((o) => el('option', { value: o.key, selected: o.key === current ? 'selected' : undefined }, `↕ ${o.label}`)));
  }

  function iconChip(icon, color) {
    return el('span', { class: 'icon-chip', style: `background:${color}22;color:${color}` }, icon);
  }

  function iconChipSvg(svgHtml, color) {
    return el('span', { class: 'icon-chip icon-chip-svg', style: `background:${color}22;color:${color}`, html: svgHtml });
  }

  function personTag(person, onClick) {
    if (!person) return null;
    return el('button', { class: 'tag tag-person', style: `--tag-color:${person.color || '#7b8cde'}`, onclick: onClick }, `🏷 ${person.name}`);
  }

  function categoryTag(cat, onClick) {
    if (!cat) return null;
    return el('button', { class: 'tag tag-category', style: `--tag-color:${cat.color || '#8d99ae'}`, onclick: onClick }, `${cat.icon || ''} ${cat.name}`);
  }

  return {
    fmtMoney, fmtDate, fmtDateShort, el, toast, openModal, closeTopModal, confirmDialog, iconChip, iconChipSvg, personTag, categoryTag,
    SORT_OPTIONS_FULL, SORT_OPTIONS_SIMPLE, sortComparator, buildSortControl,
  };
})();

window.UI = UI;
