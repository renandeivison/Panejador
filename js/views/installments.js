// views/installments.js
const ViewInstallments = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'date';
  let sortDesc = false;
  let groupBy = 'card'; // 'card' | 'person'
  let scope = 'thisMonth'; // 'all' | 'thisMonth'

  function buildRow(i) {
    const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
    const isDivided = i.splits.length >= 2;
    const responsiblePersonId = !isDivided ? i.splits.find((s) => s.personId)?.personId : null;
    const person = responsiblePersonId ? Store.cache.people.find((p) => p.id === responsiblePersonId) : null;
    const card = Store.cache.cards.find((c) => c.id === i.cardId);
    return {
      inst: i, card, title: purchase?.description || '—', date: i.invoiceDueDate, value: i.amount,
      totalInstallments: i.totalInstallments || null, installmentNumber: i.number || null,
      personName: isDivided ? 'Dividida' : (person?.name || ''), person, isDivided, splits: i.splits,
    };
  }

  function renderGroupHeader(icon, color, label, total) {
    return el('div', { class: 'flex justify-between items-center', style: 'margin:18px 4px 8px' }, [
      el('div', { class: 'flex items-center gap-8' }, [UI.iconChip(icon, color), el('span', { style: 'font-weight:700;font-size:14px' }, label)]),
      el('span', { class: 'money money-sm text-blue' }, fmtMoney(total)),
    ]);
  }

  function renderRowList(items) {
    const list = el('div', { class: 'list' });
    items.forEach((it) => {
      const i = it.inst;
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => Details.openInstallmentDetail(i, () => App.rerender()) }, [
        UI.iconChip('📅', it.card?.color || '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, it.title),
          el('div', { class: 'li-sub' }, [
            groupBy === 'person' ? (it.card?.name || '') : Calc.monthLabel(i.invoiceMonth),
            el('span', {}, `· ${i.number}/${i.totalInstallments}`),
            UI.splitTag(it.splits, (e, p) => { e.stopPropagation(); App.navigate('personDetail', { id: p.id }); }),
          ]),
        ]),
        el('div', { class: 'li-value' }, fmtMoney(it.value)),
      ]));
    });
    return list;
  }

  function render(container) {
    container.innerHTML = '';
    container.appendChild(UI.pageHeader({ title: 'Parcelas futuras', subtitle: 'Compras parceladas a partir do mês atual' }));

    const fromMonth = App.state.currentMonth;
    let future = Store.cache.installments.filter((i) => i.invoiceMonth >= fromMonth && i.status !== 'cancelled' && i.kind === 'installment');
    if (scope === 'thisMonth') {
      future = future.filter((i) => i.invoiceMonth === fromMonth);
    }
    const totalFuture = Calc.round2(future.reduce((a, i) => a + i.amount, 0));

    container.appendChild(el('div', { class: 'hero-balance glass-strong' }, [
      el('div', { class: 'hb-label' }, scope === 'thisMonth' ? `Total de parcelas em ${Calc.monthLabel(fromMonth)}` : 'Total de parcelas futuras em todos os cartões'),
      el('div', { class: 'hb-value text-blue' }, fmtMoney(totalFuture)),
    ]));

    if (!Store.cache.cards.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhum cartão cadastrado.'));
      return;
    }

    container.appendChild(UI.filterSheet([
      { label: 'Ordenar por', control: UI.buildSortControl(sortKey, (v) => { sortKey = v; render(container); }, undefined, sortDesc, () => { sortDesc = !sortDesc; render(container); }) },
      { label: 'Agrupar por', control: UI.segmented([
        { key: 'card', label: 'Por cartão' },
        { key: 'person', label: 'Por pessoa' },
      ], groupBy, (v) => { groupBy = v; render(container); }) },
      { label: 'Período', control: UI.segmented([
        { key: 'all', label: 'Todas as parcelas' },
        { key: 'thisMonth', label: 'Este mês' },
      ], scope, (v) => { scope = v; render(container); }, { small: true }) },
    ]));

    if (!future.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '📆'),
        el('div', { class: 'es-title' }, 'Nenhuma parcela encontrada'),
        el('div', {}, 'Compras parceladas aparecerão aqui.'),
      ]));
      return;
    }

    if (groupBy === 'card') {
      Store.cache.cards.forEach((card) => {
        const items = future.filter((i) => i.cardId === card.id).map(buildRow).sort(UI.sortComparator(sortKey, sortDesc));
        if (!items.length) return;
        const cardTotal = Calc.round2(items.reduce((a, it) => a + it.value, 0));
        container.appendChild(renderGroupHeader('💳', card.color || '#3f6fe0', card.name, cardTotal));
        container.appendChild(renderRowList(items));
      });
    } else {
      const rows = future.map(buildRow);
      const selfRows = rows.filter((r) => !r.person && !r.isDivided);
      const dividedRows = rows.filter((r) => r.isDivided);
      const peopleIds = [...new Set(rows.filter((r) => r.person).map((r) => r.person.id))]
        .sort((a, b) => {
          const pa = Store.cache.people.find((p) => p.id === a)?.name || '';
          const pb = Store.cache.people.find((p) => p.id === b)?.name || '';
          return pa.localeCompare(pb, 'pt-BR');
        });

      if (selfRows.length) {
        const items = selfRows.sort(UI.sortComparator(sortKey, sortDesc));
        container.appendChild(renderGroupHeader('🏠', '#3f6fe0', 'Minhas parcelas', Calc.round2(items.reduce((a, it) => a + it.value, 0))));
        container.appendChild(renderRowList(items));
      }
      peopleIds.forEach((pid) => {
        const person = Store.cache.people.find((p) => p.id === pid);
        const items = rows.filter((r) => r.person?.id === pid).sort(UI.sortComparator(sortKey, sortDesc));
        container.appendChild(renderGroupHeader('🏷', person?.color || '#7b8cde', person?.name || '—', Calc.round2(items.reduce((a, it) => a + it.value, 0))));
        container.appendChild(renderRowList(items));
      });
      if (dividedRows.length) {
        const items = dividedRows.sort(UI.sortComparator(sortKey, sortDesc));
        container.appendChild(renderGroupHeader('🔀', '#3f6fe0', 'Divididas', Calc.round2(items.reduce((a, it) => a + it.value, 0))));
        container.appendChild(renderRowList(items));
      }
    }
  }

  return { render };
})();
window.ViewInstallments = ViewInstallments;
