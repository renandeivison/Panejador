// views/subscriptions.js
const ViewSubscriptions = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'value';

  function render(container) {
    container.innerHTML = '';
    container.appendChild(UI.pageHeader({ title: 'Assinaturas', subtitle: 'Cobranças recorrentes por cartão — indefinidas ou por tempo determinado' }));

    const month = App.state.currentMonth;
    // considera assinaturas ativas: qualquer lançamento de assinatura neste mês ou futuro
    const activeSubs = Store.cache.installments.filter((i) => i.kind === 'subscription' && i.invoiceMonth >= month && i.status !== 'cancelled');
    const monthlyTotal = Calc.round2(
      activeSubs.filter((i) => i.invoiceMonth === month).reduce((a, i) => a + i.amount, 0)
    );

    container.appendChild(el('div', { class: 'hero-balance glass-strong' }, [
      el('div', { class: 'hb-label' }, `Total de assinaturas em ${Calc.monthLabel(month)}`),
      el('div', { class: 'hb-value text-blue' }, fmtMoney(monthlyTotal)),
    ]));

    if (!Store.cache.cards.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhum cartão cadastrado.'));
      return;
    }

    container.appendChild(UI.filterSheet([{ label: 'Ordenar por', control: UI.buildSortControl(sortKey, (v) => { sortKey = v; render(container); }) }]));

    // agrupa por compra (purchaseId) — cada assinatura é uma "linha", mostrando a cobrança deste mês (se houver)
    const purchaseIds = [...new Set(activeSubs.map((i) => i.purchaseId))];
    const rows = purchaseIds.map((pid) => {
      const purchase = Store.cache.purchases.find((p) => p.id === pid);
      const thisMonthInst = activeSubs.find((i) => i.purchaseId === pid && i.invoiceMonth === month);
      const nextInst = activeSubs.filter((i) => i.purchaseId === pid).sort((a, b) => a.invoiceMonth > b.invoiceMonth ? 1 : -1)[0];
      const inst = thisMonthInst || nextInst;
      const card = Store.cache.cards.find((c) => c.id === inst.cardId);
      const isDivided = inst.splits.length >= 2;
      const responsiblePersonId = !isDivided ? inst.splits.find((s) => s.personId)?.personId : null;
      const person = responsiblePersonId ? Store.cache.people.find((p) => p.id === responsiblePersonId) : null;
      return {
        inst, purchase, card, person,
        title: purchase?.description || '—', date: inst.invoiceDueDate, value: inst.amount,
        totalInstallments: inst.totalInstallments || null, installmentNumber: inst.number || null,
        personName: isDivided ? 'Dividida' : (person?.name || ''), splits: inst.splits,
        billedThisMonth: !!thisMonthInst,
      };
    }).sort(UI.sortComparator(sortKey));

    if (!rows.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '🔁'),
        el('div', { class: 'es-title' }, 'Nenhuma assinatura cadastrada'),
        el('div', {}, 'Cadastre uma compra no cartão do tipo "Assinatura" para vê-la aqui.'),
      ]));
      return;
    }

    const list = el('div', { class: 'list' });
    rows.forEach((r) => {
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => Details.openInstallmentDetail(r.inst, () => App.rerender()) }, [
        UI.iconChip('🔁', r.card?.color || '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, r.title),
          el('div', { class: 'li-sub' }, [
            r.card?.name || '',
            r.totalInstallments ? el('span', {}, `· ${r.installmentNumber}/${r.totalInstallments}`) : el('span', {}, '· indefinida'),
            !r.billedThisMonth ? el('span', { class: 'tag tag-neutral' }, `A partir de ${Calc.monthLabel(r.inst.invoiceMonth)}`) : null,
            UI.splitTag(r.splits, (e, p) => { e.stopPropagation(); App.navigate('personDetail', { id: p.id }); }),
          ]),
        ]),
        el('div', { class: 'li-value' }, fmtMoney(r.value)),
      ]));
    });
    container.appendChild(list);
  }

  return { render };
})();
window.ViewSubscriptions = ViewSubscriptions;
