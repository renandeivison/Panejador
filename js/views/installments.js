// views/installments.js
const ViewInstallments = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'date';

  function render(container) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'page-title' }, 'Parcelas futuras'));
    container.appendChild(el('div', { class: 'page-subtitle' }, 'Parcelamentos e assinaturas agrupados por cartão, a partir do mês atual'));

    const fromMonth = App.state.currentMonth;
    const future = Store.cache.installments.filter((i) => i.invoiceMonth >= fromMonth && i.status !== 'cancelled' && (i.kind === 'installment' || i.kind === 'subscription'));
    const totalFuture = Calc.round2(future.reduce((a, i) => a + i.amount, 0));

    container.appendChild(el('div', { class: 'hero-balance glass-strong' }, [
      el('div', { class: 'hb-label' }, 'Total de parcelas futuras em todos os cartões'),
      el('div', { class: 'hb-value text-blue' }, fmtMoney(totalFuture)),
    ]));

    if (!Store.cache.cards.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhum cartão cadastrado.'));
      return;
    }

    container.appendChild(el('div', { class: 'filter-bar' }, [UI.buildSortControl(sortKey, (v) => { sortKey = v; render(container); })]));

    Store.cache.cards.forEach((card) => {
      const items = future.filter((i) => i.cardId === card.id).map((i) => {
        const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
        const responsiblePersonId = i.splits.find((s) => s.personId)?.personId;
        const person = responsiblePersonId ? Store.cache.people.find((p) => p.id === responsiblePersonId) : null;
        return {
          inst: i, title: purchase?.description || '—', date: i.invoiceDueDate, value: i.amount,
          totalInstallments: i.totalInstallments || null, installmentNumber: i.number || null, personName: person?.name || '',
        };
      }).sort(UI.sortComparator(sortKey));
      if (!items.length) return;
      const cardTotal = Calc.round2(items.reduce((a, it) => a + it.value, 0));

      container.appendChild(el('div', { class: 'flex justify-between items-center', style: 'margin:18px 4px 8px' }, [
        el('div', { class: 'flex items-center gap-8' }, [UI.iconChip('💳', card.color || '#3f6fe0'), el('span', { style: 'font-weight:700;font-size:14px' }, card.name)]),
        el('span', { class: 'money money-sm text-blue' }, fmtMoney(cardTotal)),
      ]));

      const list = el('div', { class: 'list' });
      items.forEach((it) => {
        const i = it.inst;
        list.appendChild(el('div', { class: 'list-item glass', onclick: () => Details.openInstallmentDetail(i, () => App.rerender()) }, [
          UI.iconChip(i.kind === 'subscription' ? '🔁' : '📅', card.color || '#3f6fe0'),
          el('div', { class: 'li-main' }, [
            el('div', { class: 'li-title' }, it.title),
            el('div', { class: 'li-sub' }, [
              Calc.monthLabel(i.invoiceMonth),
              i.kind === 'installment' ? el('span', {}, `· ${i.number}/${i.totalInstallments}`) : el('span', {}, '· assinatura'),
              it.personName ? el('span', {}, `· ${it.personName}`) : null,
            ]),
          ]),
          el('div', { class: 'li-value' }, fmtMoney(it.value)),
        ]));
      });
      container.appendChild(list);
    });

    if (!future.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '📆'),
        el('div', { class: 'es-title' }, 'Nenhuma parcela futura'),
        el('div', {}, 'Compras parceladas e assinaturas aparecerão aqui.'),
      ]));
    }
  }

  return { render };
})();
window.ViewInstallments = ViewInstallments;
