// views/reports.js
const ViewReports = (() => {
  const { el, fmtMoney } = UI;
  let activeTab = 'category';

  function render(container) {
    container.innerHTML = '';
    const month = App.state.currentMonth;
    container.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => App.navigate('more') }, '← Voltar para Mais'));
    container.appendChild(el('div', { class: 'page-title mt-14' }, 'Relatórios'));
    container.appendChild(el('div', { class: 'page-subtitle' }, `Análises interativas · ${Calc.monthLabel(month)}`));

    const tabs = [
      ['category', 'Por categoria'], ['card', 'Por cartão'], ['people', 'Terceiros'],
      ['flow', 'Receitas x despesas'], ['projection', 'Projeção'],
    ];
    const tabsEl = el('div', { class: 'tabs' }, tabs.map(([k, label]) =>
      el('button', { class: activeTab === k ? 'active' : '', onclick: () => { activeTab = k; render(container); } }, label)
    ));
    container.appendChild(tabsEl);

    const body = el('div', {});
    container.appendChild(body);

    if (activeTab === 'category') renderByCategory(body, month);
    else if (activeTab === 'card') renderByCard(body, month);
    else if (activeTab === 'people') renderByPeople(body);
    else if (activeTab === 'flow') renderFlow(body);
    else if (activeTab === 'projection') renderProjection(body, month);
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

  function renderByPeople(body) {
    const data = Store.cache.people.map((p) => {
      const ps = Calc.computePersonSummary(p.id, Store.cache);
      return { label: p.name, value: ps.totalDue, color: p.color || '#7b8cde', personId: p.id };
    }).filter((d) => d.value > 0);
    body.appendChild(el('div', { class: 'section-title' }, 'Valores devidos por pessoa (total)'));
    if (!data.length) { body.appendChild(emptyChart('Nenhum valor devido de terceiros.')); return; }
    body.appendChild(Charts.donutChart({ data, onSliceClick: (d) => App.navigate('personDetail', { id: d.personId }) }));
  }

  function renderFlow(body) {
    const month = App.state.currentMonth;
    const months = [];
    for (let i = -2; i <= 3; i++) {
      const m = Calc.addMonths(month, i);
      if (App.state.startMonth && m < App.state.startMonth) continue;
      months.push(m);
    }
    body.appendChild(el('div', { class: 'section-title' }, 'Receitas x compromissos (6 meses)'));
    const incomeData = months.map((m) => ({ label: m.slice(5), value: Calc.computeMonthSummary(m, Store.cache).incomeTotal }));
    const commitData = months.map((m) => ({ label: m.slice(5), value: Calc.computeMonthSummary(m, Store.cache).committed }));
    body.appendChild(el('div', { class: 'text-xs text-muted mb-8' }, 'Verde: receitas · Vermelho: comprometido (despesas + faturas)'));
    body.appendChild(Charts.barChart({ data: incomeData, color: '#17a06b', formatValue: (v) => fmtMoney(v).replace('R$', '').trim() }));
    body.appendChild(Charts.barChart({ data: commitData, color: '#e0393e', formatValue: (v) => fmtMoney(v).replace('R$', '').trim() }));
  }

  function renderProjection(body, month) {
    const proj = Calc.computeProjection(month, 6, Store.cache);
    body.appendChild(el('div', { class: 'section-title' }, 'Evolução do saldo projetado (próximos 6 meses)'));
    body.appendChild(Charts.lineChart({
      data: proj.map((p) => ({ label: p.monthRef.slice(5), value: p.projectedBalance })),
      onPointClick: (d) => {},
      formatValue: (v) => fmtMoney(v),
    }));
    const list = el('div', { class: 'list mt-14' });
    proj.forEach((p) => {
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => { App.state.currentMonth = p.monthRef; App.navigate('dashboard'); } }, [
        UI.iconChip('📈', p.projectedBalance >= 0 ? '#17a06b' : '#e0393e'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, Calc.monthLabel(p.monthRef))]),
        el('div', { class: 'li-value', style: `color:${p.projectedBalance >= 0 ? 'var(--green)' : 'var(--red)'}` }, fmtMoney(p.projectedBalance)),
      ]));
    });
    body.appendChild(list);
  }

  function emptyChart(text = 'Sem dados suficientes neste mês.') {
    return el('div', { class: 'empty-state glass' }, [el('div', { class: 'es-icon' }, '📊'), el('div', {}, text)]);
  }

  return { render };
})();
window.ViewReports = ViewReports;
