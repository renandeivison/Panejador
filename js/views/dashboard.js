// views/dashboard.js
const ViewDashboard = (() => {
  const { el, fmtMoney } = UI;

  function render(container) {
    container.innerHTML = '';
    const month = App.state.currentMonth;
    const summary = Calc.computeMonthSummary(month, Store.cache);

    const hero = el('div', { class: 'hero-balance glass-strong' }, [
      el('div', { class: 'hb-month' }, Calc.monthLabel(month).toUpperCase()),
      el('div', { class: 'hb-label' }, 'Saldo projetado'),
      el('div', { class: 'hb-value', style: `color:${summary.projectedBalance >= 0 ? 'var(--green)' : 'var(--red)'}` }, fmtMoney(summary.projectedBalance)),
      el('div', { class: 'hb-row' }, [
        el('div', { class: 'hb-mini' }, ['Receitas', el('b', { class: 'text-green' }, fmtMoney(summary.incomeTotal))]),
        el('div', { class: 'hb-mini' }, ['+ A receber', el('b', { class: 'text-amber' }, fmtMoney(summary.receivableThisMonth))]),
        el('div', { class: 'hb-mini' }, ['− Comprometido', el('b', { class: 'text-red' }, fmtMoney(summary.committed))]),
      ]),
    ]);
    container.appendChild(hero);

    const grid = el('div', { class: 'grid grid-4' }, [
      statCardWithRepeat('💰', 'Receitas previstas', summary.incomeTotal, 'var(--green)', 'income', () => App.navigate('transactions', { type: 'income' })),
      statCardWithRepeat('🧾', 'Despesas previstas', summary.expenseTotal, 'var(--red)', 'expense', () => App.navigate('transactions', { type: 'expense' })),
      statCard('💳', 'Faturas dos cartões', summary.cardInvoiceTotal, 'var(--blue)', () => App.navigate('installments')),
      statCard('👥', 'A receber neste mês', summary.receivableThisMonth, 'var(--amber)', () => App.navigate('transactions', { type: 'card' })),
    ]);
    container.appendChild(grid);

    // Fluxo financeiro simplificado
    container.appendChild(el('div', { class: 'section-title' }, 'Fluxo do mês'));
    container.appendChild(Charts.barChart({
      data: [
        { label: 'Receitas', value: summary.incomeTotal, color: '#17a06b' },
        { label: 'Despesas', value: summary.expenseTotal, color: '#e0393e' },
        { label: 'Cartões', value: summary.cardInvoiceTotal, color: '#3f6fe0' },
        { label: 'Saldo', value: summary.projectedBalance, color: summary.projectedBalance >= 0 ? '#17a06b' : '#e0393e' },
      ],
      formatValue: (v) => fmtMoney(v).replace('R$', '').trim(),
    }));

    // Próximas faturas por cartão
    if (Store.cache.cards.length) {
      container.appendChild(el('div', { class: 'section-title' }, 'Faturas dos cartões'));
      const list = el('div', { class: 'list' });
      Store.cache.cards.filter((c) => c.active !== false).forEach((card) => {
        const cs = summary.byCard[card.id];
        if (!cs) return;
        list.appendChild(el('div', { class: 'list-item glass', onclick: () => App.navigate('cardDetail', { id: card.id }) }, [
          UI.iconChip('💳', card.color || '#3f6fe0'),
          el('div', { class: 'li-main' }, [
            el('div', { class: 'li-title' }, card.name),
            el('div', { class: 'li-sub' }, `${cs.items.length} lançamento(s) neste mês`),
          ]),
          el('div', { class: 'li-value' }, fmtMoney(cs.total)),
        ]));
      });
      container.appendChild(list);
    }

    // Valores a receber de pessoas — apenas o que se refere a compras deste mês
    if (Store.cache.people.length) {
      container.appendChild(el('div', { class: 'section-title' }, `A receber de pessoas em ${Calc.monthLabel(month)}`));
      const list = el('div', { class: 'list' });
      Store.cache.people.forEach((p) => {
        const amount = summary.receivableByPerson[p.id];
        if (!amount) return;
        list.appendChild(el('div', { class: 'list-item glass', onclick: () => App.navigate('personDetail', { id: p.id }) }, [
          UI.iconChip('🏷', p.color || '#7b8cde'),
          el('div', { class: 'li-main' }, [
            el('div', { class: 'li-title' }, p.name),
            el('div', { class: 'li-sub' }, `Referente a compras de ${Calc.monthLabel(month)}`),
          ]),
          el('div', { class: 'li-value text-amber' }, fmtMoney(amount)),
        ]));
      });
      if (!list.children.length) list.appendChild(emptyRow('Nenhum valor de terceiros neste mês.'));
      container.appendChild(list);
    }

    // Próximos compromissos (despesas + parcelas do mês, ordenado por data)
    container.appendChild(el('div', { class: 'section-title' }, 'Próximos compromissos'));
    const commitments = [
      ...summary.expenseTxs.map((t) => ({ date: t.date, title: t.description, value: t.amount, kind: 'expense', ref: t })),
      ...summary.cardInstallments.filter((i) => i.amount > 0).map((i) => {
        const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
        return { date: i.invoiceDueDate, title: purchase?.description || 'Compra no cartão', value: i.amount, kind: 'card', ref: i };
      }),
    ].sort((a, b) => (a.date > b.date ? 1 : -1)).slice(0, 8);

    const commitList = el('div', { class: 'list' });
    commitments.forEach((c) => {
      commitList.appendChild(el('div', {
        class: 'list-item glass',
        onclick: () => c.kind === 'expense' ? Details.openTransactionDetail(c.ref, () => App.rerender()) : Details.openInstallmentDetail(c.ref, () => App.rerender()),
      }, [
        UI.iconChip(c.kind === 'expense' ? '🧾' : '💳', c.kind === 'expense' ? '#e0393e' : '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, c.title),
          el('div', { class: 'li-sub' }, UI.fmtDate(c.date)),
        ]),
        el('div', { class: 'li-value' }, fmtMoney(c.value)),
      ]));
    });
    if (!commitList.children.length) commitList.appendChild(emptyRow('Nenhum compromisso planejado para este mês.'));
    container.appendChild(commitList);
  }

  function statCard(icon, label, value, color, onClick) {
    return el('div', { class: 'stat-card glass clickable', onclick: onClick }, [
      el('div', { class: 'stat-label' }, label),
      el('div', { class: 'stat-value', style: `color:${color}` }, fmtMoney(value)),
    ]);
  }

  function statCardWithRepeat(icon, label, value, color, type, onClick) {
    return el('div', { class: 'stat-card glass', style: 'position:relative' }, [
      el('div', { class: 'clickable', style: 'cursor:pointer', onclick: onClick }, [
        el('div', { class: 'stat-label' }, label),
        el('div', { class: 'stat-value', style: `color:${color}` }, fmtMoney(value)),
      ]),
      el('button', {
        class: 'btn btn-ghost btn-sm', style: 'margin-top:8px;padding:5px 10px;font-size:11px',
        onclick: (e) => { e.stopPropagation(); Forms.openRepeatTransactionsForm(type, () => App.rerender()); },
      }, '↻ Repetir lançamentos'),
    ]);
  }

  function emptyRow(text) {
    return el('div', { class: 'empty-state glass' }, [el('div', { class: 'es-icon' }, '✨'), el('div', {}, text)]);
  }

  return { render };
})();
window.ViewDashboard = ViewDashboard;
