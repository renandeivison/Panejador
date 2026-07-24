// views/people.js
const ViewPeople = (() => {
  const { el, fmtMoney } = UI;
  let sortKey = 'alpha';

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
        el('div', {}, 'Adicione pessoas para dividir compras e controlar reembolsos.'),
      ]));
      return;
    }

    container.appendChild(el('div', { class: 'filter-bar' }, [UI.buildSortControl(sortKey, (v) => { sortKey = v; renderList(container); }, UI.SORT_OPTIONS_SIMPLE)]));

    const list = el('div', { class: 'list' });
    const items = Store.cache.people.map((p) => {
      const ps = Calc.computePersonSummary(p.id, Store.cache);
      return { person: p, title: p.name, value: ps.pending, ps };
    }).sort(UI.sortComparator(sortKey));
    items.forEach(({ person: p, ps }) => {
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => App.navigate('personDetail', { id: p.id }) }, [
        UI.iconChip('🏷', p.color || '#7b8cde'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, p.name),
          el('div', { class: 'li-sub' }, `Deve ${fmtMoney(ps.totalDue)} · Devolveu ${fmtMoney(ps.totalPaid)}`),
        ]),
        el('div', { class: 'li-value', style: `color:${ps.pending > 0 ? 'var(--amber)' : 'var(--green)'}` }, fmtMoney(ps.pending)),
      ]));
    });
    container.appendChild(list);
  }

  function renderDetail(container, params) {
    container.innerHTML = '';
    const person = Store.cache.people.find((p) => p.id === params.id);
    if (!person) { container.appendChild(el('div', { class: 'empty-state glass' }, 'Pessoa não encontrada.')); return; }
    const ps = Calc.computePersonSummary(person.id, Store.cache);

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
      el('div', { class: 'hb-label' }, 'Saldo pendente'),
      el('div', { class: 'hb-value', style: `color:${ps.pending > 0 ? 'var(--amber)' : 'var(--green)'}` }, fmtMoney(ps.pending)),
      el('div', { class: 'hb-row' }, [
        el('div', { class: 'hb-mini' }, ['Total devido', el('b', {}, fmtMoney(ps.totalDue))]),
        el('div', { class: 'hb-mini' }, ['Já devolveu', el('b', { class: 'text-green' }, fmtMoney(ps.totalPaid))]),
      ]),
    ]));

    container.appendChild(el('button', { class: 'btn btn-primary btn-block mt-8', onclick: () => Forms.openReimbursementForm(person.id, () => App.rerender()) }, '+ Registrar reembolso recebido'));

    container.appendChild(el('div', { class: 'section-title' }, 'Compras vinculadas'));
    const list = el('div', { class: 'list' });
    if (!ps.relatedInstallments.length) list.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhuma compra vinculada a esta pessoa.'));
    ps.relatedInstallments.sort((a, b) => a.inst.invoiceMonth > b.inst.invoiceMonth ? 1 : -1).forEach(({ inst, amount }) => {
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

    container.appendChild(el('div', { class: 'section-title' }, 'Histórico de reembolsos'));
    const rlist = el('div', { class: 'list' });
    if (!ps.reimbursements.length) rlist.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhum reembolso registrado.'));
    ps.reimbursements.sort((a, b) => a.date > b.date ? -1 : 1).forEach((r) => {
      rlist.appendChild(el('div', { class: 'list-item glass' }, [
        UI.iconChip('✅', '#17a06b'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, r.note || 'Reembolso'), el('div', { class: 'li-sub' }, UI.fmtDate(r.date))]),
        el('div', { class: 'flex items-center gap-8' }, [
          el('div', { class: 'li-value text-green' }, fmtMoney(r.amount)),
          el('button', { class: 'icon-btn', onclick: async (e) => {
            e.stopPropagation();
            const ok = await UI.confirmDialog({ title: 'Excluir reembolso', message: 'Remover este registro de reembolso?', choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
            if (!ok) return;
            await Store.deleteReimbursement(r.id);
            App.rerender();
          } }, '🗑'),
        ]),
      ]));
    });
    container.appendChild(rlist);
  }

  return { renderList, renderDetail };
})();
window.ViewPeople = ViewPeople;
