// views/transactions.js
const ViewTransactions = (() => {
  const { el, fmtMoney } = UI;
  let filters = { type: 'all', category: 'all', person: 'all', card: 'all', status: 'all', q: '' };
  let sortKey = 'date';

  function render(container, params = {}) {
    if (params.type) filters.type = params.type;
    container.innerHTML = '';
    const month = App.state.currentMonth;

    container.appendChild(UI.pageHeader({ title: 'Movimentações', subtitle: `Receitas, despesas e compras no cartão de ${Calc.monthLabel(month)}` }));

    // filtros
    const typeSelect = el('select', { onchange: (e) => { filters.type = e.target.value; renderList(); } },
      ['all', 'income', 'expense', 'card'].map((v) => el('option', { value: v, selected: filters.type === v ? 'selected' : undefined },
        { all: 'Todos os tipos', income: 'Receitas', expense: 'Despesas', card: 'Compras no cartão' }[v])));
    const catSelect = el('select', { onchange: (e) => { filters.category = e.target.value; renderList(); } },
      [el('option', { value: 'all' }, 'Todas categorias')].concat(Store.cache.categories.map((c) => el('option', { value: c.id, selected: filters.category === c.id ? 'selected' : undefined }, `${c.icon} ${c.name}`))));
    const personSelect = el('select', { onchange: (e) => { filters.person = e.target.value; renderList(); } },
      [el('option', { value: 'all' }, 'Todas pessoas')].concat(Store.cache.people.map((p) => el('option', { value: p.id, selected: filters.person === p.id ? 'selected' : undefined }, p.name))));
    const searchInput = el('input', { type: 'text', placeholder: 'Buscar por descrição...', value: filters.q, oninput: (e) => { filters.q = e.target.value; renderList(); } });
    const sortSelect = UI.buildSortControl(sortKey, (v) => { sortKey = v; renderList(); });

    container.appendChild(el('div', { class: 'field' }, searchInput));
    container.appendChild(UI.filterSheet([
      { label: 'Tipo', control: typeSelect },
      { label: 'Categoria', control: catSelect },
      { label: 'Pessoa', control: personSelect },
      { label: 'Ordenar por', control: sortSelect },
    ]));

    if (filters.type === 'income' || filters.type === 'expense') {
      container.appendChild(el('button', {
        class: 'btn btn-ghost btn-sm mb-8',
        onclick: () => Forms.openRepeatTransactionsForm(filters.type, () => App.rerender()),
      }, '↻ Repetir lançamentos'));
    }

    const listWrap = el('div', { class: 'list' });
    container.appendChild(listWrap);

    function renderList() {
      listWrap.innerHTML = '';
      const items = buildItems(month);
      const filtered = items.filter((it) => {
        if (filters.type !== 'all' && it.kind !== filters.type) return false;
        if (filters.category !== 'all' && it.categoryId !== filters.category) return false;
        if (filters.person !== 'all' && !(it.personIds || []).includes(filters.person)) return false;
        if (filters.q && !it.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
        return true;
      }).sort(UI.sortComparator(sortKey));

      if (!filtered.length) {
        listWrap.appendChild(el('div', { class: 'empty-state glass' }, [
          el('div', { class: 'es-icon' }, '📭'),
          el('div', { class: 'es-title' }, 'Nada por aqui'),
          el('div', {}, 'Nenhuma movimentação encontrada para os filtros selecionados.'),
        ]));
        return;
      }
      filtered.forEach((it) => {
        const cat = Store.cache.categories.find((c) => c.id === it.categoryId);
        listWrap.appendChild(el('div', { class: 'list-item glass', onclick: it.onClick }, [
          UI.iconChip(it.icon, it.color),
          el('div', { class: 'li-main' }, [
            el('div', { class: 'li-title' }, it.title),
            el('div', { class: 'li-sub' }, [
              UI.fmtDate(it.date),
              cat ? el('span', {}, `· ${cat.icon} ${cat.name}`) : null,
              it.badge ? el('span', { class: `tag ${it.badge === 'ESTORNO' ? 'tag-reversal' : 'tag-neutral'}` }, it.badge) : null,
              it.splits ? UI.splitTag(it.splits, (e, p) => { e.stopPropagation(); App.navigate('personDetail', { id: p.id }); }) : (it.person ? UI.personTag(it.person, (e) => { e.stopPropagation(); App.navigate('personDetail', { id: it.person.id }); }) : null),
            ]),
          ]),
          el('div', { class: 'li-value', style: `color:${it.color}` }, fmtMoney(it.value)),
        ]));
      });
    }

    function buildItems(month) {
      const out = [];
      Store.cache.transactions.filter((t) => t.monthRef === month).forEach((t) => {
        const person = t.person ? Store.cache.people.find((p) => p.id === t.person) : null;
        out.push({
          kind: t.type, title: t.description, date: t.date, value: t.amount,
          icon: t.type === 'income' ? '💰' : '🧾', color: t.type === 'income' ? 'var(--green)' : 'var(--red)',
          categoryId: t.category, personIds: t.person ? [t.person] : [], personName: person?.name || '', person,
          totalInstallments: null, installmentNumber: null,
          onClick: () => Details.openTransactionDetail(t, () => App.rerender()),
        });
      });
      Store.cache.installments.filter((i) => i.invoiceMonth === month).forEach((i) => {
        const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
        const isDivided = i.splits.length >= 2;
        const responsiblePersonId = !isDivided ? i.splits.find((s) => s.personId)?.personId : null;
        const person = responsiblePersonId ? Store.cache.people.find((p) => p.id === responsiblePersonId) : null;
        out.push({
          kind: 'card', title: purchase?.description || 'Compra no cartão', date: i.purchaseDate, value: i.amount,
          icon: i.kind === 'reversal' ? '↩️' : '💳', color: i.kind === 'reversal' ? 'var(--green)' : 'var(--blue)',
          categoryId: purchase?.category, personIds: i.splits.filter((s) => s.personId).map((s) => s.personId),
          personName: isDivided ? 'Dividida' : (person?.name || ''), person, splits: i.splits,
          totalInstallments: i.totalInstallments || null, installmentNumber: i.number || null,
          badge: i.kind === 'reversal' ? 'ESTORNO' : (i.kind === 'installment' ? `${i.number}/${i.totalInstallments}` : (i.kind === 'subscription' ? 'ASSINATURA' : null)),
          onClick: () => Details.openInstallmentDetail(i, () => App.rerender()),
        });
      });
      return out;
    }

    renderList();
  }

  return { render };
})();
window.ViewTransactions = ViewTransactions;
