// views/people.js
const ViewPeople = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'alpha';
  let viewMode = 'month'; // 'month' | 'total'

  function modeToggle(onChange) {
    return el('div', { class: 'segmented' }, [
      el('button', { type: 'button', class: viewMode === 'month' ? 'active' : '', onclick: (e) => { viewMode = 'month'; onChange(e); } }, 'Este mês'),
      el('button', { type: 'button', class: viewMode === 'total' ? 'active' : '', onclick: (e) => { viewMode = 'total'; onChange(e); } }, 'Total geral'),
    ]);
  }

  function renderList(container) {
    container.innerHTML = '';
    container.appendChild(UI.pageHeader({
      title: 'Pessoas', subtitle: 'Controle de compras feitas para terceiros',
      actions: [{ icon: '+', label: 'Nova pessoa', onClick: () => Forms.openPersonForm(null, () => App.rerender()) }],
    }));

    if (!Store.cache.people.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '👥'),
        el('div', { class: 'es-title' }, 'Nenhuma pessoa cadastrada'),
        el('div', {}, 'Adicione pessoas para dividir compras com elas.'),
      ]));
      return;
    }

    container.appendChild(UI.filterSheet([
      { label: 'Ordenar por', control: UI.buildSortControl(sortKey, (v) => { sortKey = v; renderList(container); }, UI.SORT_OPTIONS_SIMPLE) },
      { label: 'Período', control: modeToggle(() => renderList(container)) },
    ], { title: 'Filtros e ordenação' }));

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

    container.appendChild(UI.pageHeader({
      title: person.name, subtitle: 'Detalhe da pessoa',
      onBack: () => App.navigate('people'),
      actions: [
        { icon: '✎', label: 'Editar pessoa', onClick: () => Forms.openPersonForm(person, () => App.rerender()) },
        { icon: '🗑', label: 'Excluir pessoa', onClick: async () => {
          const ok = await UI.confirmDialog({ title: 'Excluir pessoa', message: `Excluir "${person.name}"? O vínculo em compras já feitas será mantido, mas a pessoa não aparecerá mais na lista.`, choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
          if (!ok) return;
          await Store.deletePerson(person.id);
          UI.toast('Pessoa excluída.', 'success');
          App.navigate('people');
        } },
      ],
    }));

    container.appendChild(el('div', { class: 'hero-balance glass-strong' }, [
      el('div', { class: 'hb-label' }, viewMode === 'month' ? `Devido em ${Calc.monthLabel(month)}` : 'Devido no total'),
      el('div', { class: 'hb-value', style: `color:${value > 0 ? 'var(--amber)' : 'var(--ink-500)'}` }, fmtMoney(value)),
    ]));

    container.appendChild(modeToggle(() => renderDetail(container, params)));

    container.appendChild(el('button', { class: 'btn btn-ghost btn-block mt-8', onclick: () => App.navigate('personStatement', { id: person.id }) }, '🧾 Ver recibo completo (todas as compras, todos os cartões)'));

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

  // Tela compacta, no estilo de recibo, com TODAS as movimentações da pessoa em
  // todos os cartões e todos os meses — pensada para tirar print/captura de tela.
  function renderStatement(container, params) {
    container.innerHTML = '';
    const person = Store.cache.people.find((p) => p.id === params.id);
    if (!person) { container.appendChild(el('div', { class: 'empty-state glass' }, 'Pessoa não encontrada.')); return; }

    container.appendChild(UI.pageHeader({ title: 'Recibo', subtitle: person.name, onBack: () => App.navigate('personDetail', { id: person.id }) }));

    const ps = Calc.computePersonSummary(person.id, Store.cache);
    const rows = ps.relatedInstallments.slice().sort((a, b) => a.inst.invoiceMonth > b.inst.invoiceMonth ? 1 : (a.inst.invoiceMonth < b.inst.invoiceMonth ? -1 : 0));

    const card = el('div', { class: 'glass receipt-card' }, [
      el('div', { class: 'receipt-header' }, [
        el('div', { class: 'rh-name' }, person.name),
        el('div', { class: 'rh-sub' }, `Extrato completo · todos os cartões e meses`),
      ]),
      el('hr', { class: 'receipt-divider' }),
    ]);

    if (!rows.length) {
      card.appendChild(el('div', { class: 'empty-state', style: 'padding:20px 0' }, 'Nenhuma compra vinculada a esta pessoa.'));
    } else {
      rows.forEach(({ inst, amount }) => {
        const purchase = Store.cache.purchases.find((p) => p.id === inst.purchaseId);
        const cardObj = Store.cache.cards.find((c) => c.id === inst.cardId);
        const parcelaTxt = inst.totalInstallments ? `${String(inst.number).padStart(2, '0')}/${String(inst.totalInstallments).padStart(2, '0')}` : null;
        card.appendChild(el('div', { class: 'receipt-row' }, [
          el('div', { class: 'rr-desc' }, [
            el('div', { class: 'rr-title' }, purchase?.description || '—'),
            el('div', { class: 'rr-meta' }, [cardObj?.name || '', parcelaTxt ? ` · ${parcelaTxt}` : '', ` · ${Calc.monthLabel(inst.invoiceMonth)}`].join('')),
          ]),
          el('div', { class: 'rr-value' }, fmtMoney(amount)),
        ]));
      });
    }

    card.appendChild(el('hr', { class: 'receipt-divider' }));
    card.appendChild(el('div', { class: 'receipt-total' }, [
      el('span', { class: 'rt-label' }, 'Total devido'),
      el('span', { class: 'rt-value' }, fmtMoney(ps.totalDue)),
    ]));
    card.appendChild(el('div', { class: 'receipt-footer' }, `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`));

    container.appendChild(card);
  }

  return { renderList, renderDetail, renderStatement };
})();
window.ViewPeople = ViewPeople;
