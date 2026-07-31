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
  let lockedScrollY = 0;

  function lockBodyScroll() {
    if (modalStack.length > 0) return; // já travado por outro modal na pilha
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('scroll-locked');
    document.body.style.top = `-${lockedScrollY}px`;
  }

  function unlockBodyScroll() {
    if (modalStack.length > 0) return; // ainda há modal(is) na pilha
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

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
      unlockBodyScroll();
      if (onClose) onClose();
    }
    if (modalStack.length === 0) lockBodyScroll();
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

  function sortComparator(key, desc = false) {
    const base = (a, b) => {
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
          // compras únicas (totalInstallments === 1) não são "parcelamentos em andamento" —
          // devem sempre ficar depois de qualquer compra realmente parcelada, não misturadas
          // no ranking por proximidade de término.
          const remA = (a.totalInstallments && a.totalInstallments > 1) ? a.totalInstallments - (a.installmentNumber || 0) : Infinity;
          const remB = (b.totalInstallments && b.totalInstallments > 1) ? b.totalInstallments - (b.installmentNumber || 0) : Infinity;
          return remA - remB;
        }
        case 'person':
          return (a.personName || '').localeCompare(b.personName || '', 'pt-BR');
        default:
          return 0;
      }
    };
    return desc ? (a, b) => -base(a, b) : base;
  }

  // control + botão de inverter direção (↑ crescente / ↓ decrescente), lado a lado.
  function buildSortControl(current, onChange, options, desc = false, onToggleDesc = null) {
    const opts = options || SORT_OPTIONS_FULL;
    const select = el('select', { class: 'sort-select', style: 'flex:1;width:auto', onchange: (e) => onChange(e.target.value) },
      opts.map((o) => el('option', { value: o.key, selected: o.key === current ? 'selected' : undefined }, o.label)));
    if (!onToggleDesc) return select;
    const dirBtn = el('button', {
      type: 'button', class: 'icon-btn', style: 'flex-shrink:0', 'aria-label': desc ? 'Ordem decrescente (clique para inverter)' : 'Ordem crescente (clique para inverter)',
      onclick: onToggleDesc,
    }, desc ? '↓' : '↑');
    return el('div', { class: 'flex gap-8 items-center' }, [select, dirBtn]);
  }

  function iconChip(icon, color) {
    return el('span', { class: 'icon-chip', style: `background:${color}22;color:${color}` }, icon);
  }

  function iconChipSvg(svgHtml, color) {
    return el('span', { class: 'icon-chip icon-chip-svg', style: `background:${color}22;color:${color}`, html: svgHtml });
  }

  // ---------- Cabeçalho compacto de página ----------
  // Substitui o padrão antigo de "botão Voltar" + botões de ação empilhados por uma
  // única linha: ‹ voltar | título (+ subtítulo) | ação(ões) à direita.
  function pageHeader({ title, subtitle, onBack, actions = [] }) {
    const left = onBack ? el('button', { class: 'icon-btn ph-back', onclick: onBack, 'aria-label': 'Voltar' }, '‹') : null;
    const titleBlock = el('div', { class: 'ph-title-block' }, [
      el('div', { class: 'page-title', style: 'margin-bottom:0' }, title),
      subtitle ? el('div', { class: 'page-subtitle', style: 'margin-bottom:0' }, subtitle) : null,
    ]);
    let actionsEl = null;
    if (actions.length === 1) {
      const a = actions[0];
      actionsEl = el('button', { class: 'icon-btn ph-action', onclick: a.onClick, 'aria-label': a.label, title: a.label }, a.icon);
    } else if (actions.length > 1) {
      actionsEl = el('button', { class: 'icon-btn ph-action', onclick: () => openActionMenu(actions), 'aria-label': 'Mais ações' }, '⋯');
    }
    return el('div', { class: 'page-header-row' }, [left, titleBlock, actionsEl].filter(Boolean));
  }

  function openActionMenu(actions) {
    const body = el('div', { class: 'flex-col gap-8' }, actions.map((a) =>
      el('button', { class: 'list-item glass-soft', onclick: () => { closeTopModal(); a.onClick(); } }, [
        iconChip(a.icon, '#3f6fe0'),
        el('div', { class: 'li-main' }, el('div', { class: 'li-title' }, a.label)),
      ])
    ));
    openModal({ title: 'Ações', content: body, size: 'sm' });
  }

  // ---------- Folha de filtros ----------
  // Agrupa vários controles de filtro/ordenação/agrupamento (que antes ficavam
  // empilhados na tela) atrás de um único botão, abertos numa folha modal.
  function filterSheet(items, opts = {}) {
    const btn = el('button', { class: 'btn btn-ghost btn-sm ph-filters-btn' }, opts.label || '⚙ Filtros e ordenação');
    btn.addEventListener('click', () => {
      const body = el('div', { class: 'flex-col' }, items.map((it) =>
        it.label
          ? el('div', { class: 'field' }, [el('label', {}, it.label), it.control])
          : el('div', { class: 'field' }, it.control)
      ));
      openModal({ title: opts.title || 'Filtros', content: body, size: 'sm' });
    });
    return btn;
  }

  // Controle segmentado (grupo de botões tipo toggle). Atualiza a classe "active" dos
  // próprios botões no clique — não depende do re-render da tela por trás do popup de
  // filtros, que continuaria mostrando o estado antigo até o popup ser reaberto.
  function segmented(options, current, onSelect, opts = {}) {
    const btns = [];
    const wrap = el('div', { class: `segmented ${opts.small ? 'segmented-sm' : ''}`.trim() },
      options.map((o) => {
        const b = el('button', {
          type: 'button',
          class: o.key === current ? 'active' : '',
          onclick: () => {
            btns.forEach((r) => r.el.classList.toggle('active', r.key === o.key));
            onSelect(o.key);
          },
        }, o.label);
        btns.push({ key: o.key, el: b });
        return b;
      }));
    return wrap;
  }

  function personTag(person, onClick) {
    if (!person) return null;
    return el('button', { class: 'tag tag-person', style: `--tag-color:${person.color || '#7b8cde'}`, onclick: onClick }, `🏷 ${person.name}`);
  }

  // Dado o array `splits` de um lançamento de cartão (sempre tem ao menos 1 item):
  // - 1 item com personId => atribuída inteiramente a essa pessoa: mostra o nome dela.
  // - 1 item sem personId => 100% própria: mostra a tag "Eu" (sem vínculo com a pessoa
  //   "Eu" cadastrada — é só rótulo visual, não gera cobrança/divisão de verdade).
  // - 2+ itens => dividida entre múltiplas partes: mostra uma tag genérica "Dividida",
  //   em vez de destacar arbitrariamente o nome da primeira pessoa da lista.
  function splitTag(splits, onPersonClick) {
    if (!splits || splits.length === 0) return null;
    if (splits.length >= 2) {
      return el('span', { class: 'tag tag-neutral' }, '🔀 Dividida');
    }
    const only = splits[0];
    if (!only.personId) {
      const eu = Store.euPerson();
      return el('button', { class: 'tag tag-person', style: '--tag-color:#3f6fe0', onclick: (eu && onPersonClick) ? (e) => onPersonClick(e, eu) : undefined }, '🏷 Eu');
    }
    const person = Store.cache.people.find((p) => p.id === only.personId);
    return person ? personTag(person, onPersonClick ? (e) => onPersonClick(e, person) : undefined) : null;
  }

  function categoryTag(cat, onClick) {
    if (!cat) return null;
    return el('button', { class: 'tag tag-category', style: `--tag-color:${cat.color || '#8d99ae'}`, onclick: onClick }, `${cat.icon || ''} ${cat.name}`);
  }

  return {
    fmtMoney, fmtDate, fmtDateShort, el, toast, openModal, closeTopModal, confirmDialog, iconChip, iconChipSvg, personTag, categoryTag, splitTag,
    SORT_OPTIONS_FULL, SORT_OPTIONS_SIMPLE, sortComparator, buildSortControl, pageHeader, filterSheet, segmented,
  };
})();

window.UI = UI;
