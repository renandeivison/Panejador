// views/reports.js
const ViewReports = (() => {
  const { el, fmtMoney } = UI;
  let activeTab = 'category';

  function render(container) {
    container.innerHTML = '';
    const month = App.state.currentMonth;
    container.appendChild(UI.pageHeader({ title: 'Relatórios', subtitle: `Análises interativas · ${Calc.monthLabel(month)}`, onBack: () => App.navigate('more') }));

    const tabs = [
      ['category', 'Por categoria'], ['card', 'Por cartão'], ['people', 'Por pessoa'],
    ];
    const tabsEl = el('div', { class: 'tabs' }, tabs.map(([k, label]) =>
      el('button', { class: activeTab === k ? 'active' : '', onclick: () => { activeTab = k; render(container); } }, label)
    ));
    container.appendChild(tabsEl);

    const body = el('div', {});
    container.appendChild(body);

    if (activeTab === 'category') renderByCategory(body, month);
    else if (activeTab === 'card') renderByCard(body, month);
    else if (activeTab === 'people') renderByPeople(body, month);
  }

  function renderByCategory(body, month) {
    const summary = Calc.computeMonthSummary(month, Store.cache);
    const totals = {};
    summary.expenseTxs.forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    summary.cardInstallments.filter((i) => i.amount > 0).forEach((i) => {
      const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
      const cat = purchase?.category || 'sem-categoria';
      totals[cat] = (totals[cat] || 0) + i.amount;
    });
    const data = Object.entries(totals).map(([catId, value]) => {
      const cat = Store.cache.categories.find((c) => c.id === catId);
      return { label: cat ? cat.name : 'Sem categoria', value: Calc.round2(value), color: cat?.color || '#8d99ae', catId };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

    body.appendChild(el('div', { class: 'section-title' }, 'Despesas por categoria (próprias + cartão)'));
    if (!data.length) { body.appendChild(emptyChart()); return; }
    body.appendChild(Charts.donutChart({ data, onSliceClick: (d) => App.navigate('transactions', { category: d.catId }) }));
  }

  function renderByCard(body, month) {
    const summary = Calc.computeMonthSummary(month, Store.cache);
    const data = Store.cache.cards.map((c) => ({ label: c.name, value: summary.byCard[c.id]?.total || 0, color: c.color || '#3f6fe0', cardId: c.id })).filter((d) => d.value !== 0);
    body.appendChild(el('div', { class: 'section-title' }, 'Gastos por cartão neste mês'));
    if (!data.length) { body.appendChild(emptyChart()); return; }
    body.appendChild(Charts.donutChart({ data, onSliceClick: (d) => App.navigate('cardDetail', { id: d.cardId }) }));

    body.appendChild(el('div', { class: 'section-title' }, 'Evolução das parcelas futuras'));
    const months = [];
    for (let i = 0; i < 6; i++) months.push(Calc.addMonths(month, i));
    const totalsByMonth = months.map((m) => ({
      label: m.slice(5) + '/' + m.slice(2, 4),
      value: Calc.round2(Store.cache.installments.filter((ins) => ins.invoiceMonth === m).reduce((a, i) => a + i.amount, 0)),
    }));
    body.appendChild(Charts.barChart({ data: totalsByMonth, formatValue: (v) => fmtMoney(v).replace('R$', '').trim() }));
  }

  function renderByPeople(body, month) {
    const summary = Calc.computeMonthSummary(month, Store.cache);
    const data = Store.cache.people.map((p) => ({
      label: p.name, value: summary.receivableByPerson[p.id] || 0, color: p.color || '#7b8cde', personId: p.id,
    })).filter((d) => d.value > 0);
    body.appendChild(el('div', { class: 'section-title' }, `Valores devidos por pessoa em ${Calc.monthLabel(month)}`));
    if (!data.length) { body.appendChild(emptyChart('Nenhum valor devido de terceiros neste mês.')); return; }
    body.appendChild(Charts.donutChart({ data, onSliceClick: (d) => App.navigate('personDetail', { id: d.personId }) }));
  }

  function emptyChart(text = 'Sem dados suficientes neste mês.') {
    return el('div', { class: 'empty-state glass' }, [el('div', { class: 'es-icon' }, '📊'), el('div', {}, text)]);
  }

  return { render };
})();
window.ViewReports = ViewReports;
