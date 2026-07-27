// views/people.js
const ViewPeople = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'alpha';
  let viewMode = 'month'; // 'month' | 'total'

  function modeToggle(onChange) {
    return el('div', { class: 'segmented', style: 'max-width:220px' }, [
      el('button', { type: 'button', class: viewMode === 'month' ? 'active' : '', onclick: (e) => { viewMode = 'month'; onChange(e); } }, 'Este mês'),
      el('button', { type: 'button', class: viewMode === 'total' ? 'active' : '', onclick: (e) => { viewMode = 'total'; onChange(e); } }, 'Total geral'),
    ]);
  }

  function renderList(container) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'flex justify-between items-center' }, [
      el('div', {}, [el('div', { class: 'page-title' }, 'Pessoas'), el('div', { class: 'page-subtitle' }, 'Controle de compras feitas para terceiros')]),
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => Forms.openPersonForm(null, () => App.rerender()) }, '+ Pessoa'),
    ]));

    if (!Store.cache.people.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '👥'),
        el('div', { class: 'es-title' }, 'Nenhuma pessoa cadastrada'),
        el('div', {}, 'Adicione pessoas para dividir compras com elas.'),
      ]));
      return;
    }

    container.appendChild(el('div', { class: 'filter-bar' }, [
      UI.buildSortControl(sortKey, (v) => { sortKey = v; renderList(container); }, UI.SORT_OPTIONS_SIMPLE),
      modeToggle(() => renderList(container)),
    ]));

    const month = App.state.currentMonth;
    const list = el('div', { class: 'list' });
    const items = Store.cache.people.map((p) => {
      const ps = Calc.computePersonSummary(p.id, Store.cache, month);
      const value = viewMode === 'month' ? ps.monthDue : ps.totalDue;
      return { person: p, title: p.name, value };
    }).sort(UI.sortComparator(sortKey));
    items.forEach(({ person: p, value }) => {
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => App.navigate('personDetail', { id: p.id }) }, [
        UI.iconChip('🏷', p.color || '#7b8cde'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, p.name),
          el('div', { class: 'li-sub' }, viewMode === 'month' ? `Devido em ${Calc.monthLabel(month)}` : 'Devido no total'),
        ]),
        el('div', { class: 'li-value', style: `color:${value > 0 ? 'var(--amber)' : 'var(--ink-500)'}` }, fmtMoney(value)),
      ]));
    });
    container.appendChild(list);
  }

  function renderDetail(container, params) {
    container.innerHTML = '';
    const person = Store.cache.people.find((p) => p.id === params.id);
    if (!person) { container.appendChild(el('div', { class: 'empty-state glass' }, 'Pessoa não encontrada.')); return; }
    const month = App.state.currentMonth;
    const ps = Calc.computePersonSummary(person.id, Store.cache, month);
    const value = viewMode === 'month' ? ps.monthDue : ps.totalDue;

    container.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => App.navigate('people') }, '← Voltar para pessoas'));

    container.appendChild(el('div', { class: 'hero-balance glass-strong mt-14' }, [
      el('div', { class: 'flex justify-between items-center' }, [
        el('div', { class: 'hb-month' }, person.name.toUpperCase()),
        el('div', { class: 'flex gap-8' }, [
          el('button', { class: 'icon-btn', onclick: () => Forms.openPersonForm(person, () => App.rerender()) }, '✎'),
          el('button', { class: 'icon-btn', onclick: async () => {
            const ok = await UI.confirmDialog({ title: 'Excluir pessoa', message: `Excluir "${person.name}"? O vínculo em compras já feitas será mantido, mas a pessoa não aparecerá mais na lista.`, choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
            if (!ok) return;
            await Store.deletePerson(person.id);
            UI.toast('Pessoa excluída.', 'success');
            App.navigate('people');
          } }, '🗑'),
        ]),
      ]),
      el('div', { class: 'hb-label' }, viewMode === 'month' ? `Devido em ${Calc.monthLabel(month)}` : 'Devido no total'),
      el('div', { class: 'hb-value', style: `color:${value > 0 ? 'var(--amber)' : 'var(--ink-500)'}` }, fmtMoney(value)),
    ]));

    container.appendChild(modeToggle(() => renderDetail(container, params)));

    container.appendChild(el('div', { class: 'section-title' }, 'Compras vinculadas'));
    const list = el('div', { class: 'list' });
    const related = viewMode === 'month'
      ? ps.relatedInstallments.filter(({ inst }) => inst.invoiceMonth === month)
      : ps.relatedInstallments;
    if (!related.length) list.appendChild(el('div', { class: 'empty-state glass' }, viewMode === 'month' ? 'Nenhuma compra vinculada a esta pessoa neste mês.' : 'Nenhuma compra vinculada a esta pessoa.'));
    related.sort((a, b) => a.inst.invoiceMonth > b.inst.invoiceMonth ? 1 : -1).forEach(({ inst, amount }) => {
      const purchase = Store.cache.purchases.find((p) => p.id === inst.purchaseId);
      const card = Store.cache.cards.find((c) => c.id === inst.cardId);
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => Details.openInstallmentDetail(inst, () => App.rerender()) }, [
        UI.iconChip('💳', card?.color || '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, purchase?.description || '—'),
          el('div', { class: 'li-sub' }, `${card?.name || ''} · ${Calc.monthLabel(inst.invoiceMonth)}`),
        ]),
        el('div', { class: 'li-value' }, fmtMoney(amount)),
      ]));
    });
    container.appendChild(list);
  }

  return { renderList, renderDetail };
})();
window.ViewPeople = ViewPeople;
