// details.js — modais de detalhe para movimentações (receita/despesa) e lançamentos de cartão.
const Details = (() => {
  const { el, fmtMoney, fmtDate } = UI;

  function row(label, value) {
    return el('div', { class: 'flex justify-between', style: 'padding:7px 0;border-bottom:1px solid rgba(0,0,0,0.05)' }, [
      el('span', { class: 'text-xs text-muted' }, label),
      el('span', { class: 'text-xs', style: 'font-weight:600' }, value),
    ]);
  }

  function openTransactionDetail(t, refresh) {
    const cat = Store.cache.categories.find((c) => c.id === t.category);
    const person = Store.cache.people.find((p) => p.id === t.person);
    const body = el('div', { class: 'flex-col' }, [
      el('div', { class: 'money money-lg', style: `color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'}` }, fmtMoney(t.amount)),
      el('div', { class: 'mt-8' }, [
        row('Descrição', t.description),
        row('Data', fmtDate(t.date)),
        row('Categoria', cat ? `${cat.icon} ${cat.name}` : '—'),
        row('Pessoa', person ? person.name : '—'),
        row('Status', t.status === 'confirmed' ? 'Confirmado' : 'Planejado'),
        row('Tipo', t.seriesId ? 'Recorrente' : 'Único'),
      ]),
      t.note ? el('div', { class: 'mt-8 text-xs text-muted' }, t.note) : null,
      el('div', { class: 'flex gap-8 mt-14' }, [
        el('button', { class: 'btn btn-ghost', style: 'flex:1', onclick: () => { UI.closeTopModal(); Forms.openTransactionForm(t.type, t, refresh); } }, 'Editar'),
        el('button', { class: 'btn btn-ghost', style: 'flex:1', onclick: async () => {
          UI.closeTopModal();
          const clone = { ...t, id: undefined, description: t.description + ' (cópia)', seriesId: null };
          await Store.createTransaction({ ...clone, recurrence: { mode: 'none' } });
          UI.toast('Movimentação duplicada.', 'success');
          refresh && refresh();
        } }, 'Duplicar'),
        el('button', { class: 'btn btn-danger', style: 'flex:1', onclick: async () => {
          let scope = 'only';
          if (t.seriesId) {
            scope = await UI.confirmDialog({
              title: 'Excluir movimentação recorrente',
              message: 'Esta movimentação faz parte de uma série recorrente. O que deseja excluir?',
              choices: [
                { label: 'Cancelar', value: null },
                { label: 'Somente esta', value: 'only' },
                { label: 'Esta e as futuras', value: 'future' },
                { label: 'Toda a série', value: 'all', danger: true },
              ],
            });
            if (!scope) return;
          } else {
            const ok = await UI.confirmDialog({ title: 'Excluir', message: 'Tem certeza que deseja excluir esta movimentação?', choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
            if (!ok) return;
          }
          UI.closeTopModal();
          await Store.deleteTransaction(t.id, scope);
          UI.toast('Movimentação excluída.', 'success');
          refresh && refresh();
        } }, 'Excluir'),
      ]),
    ]);
    UI.openModal({ title: t.type === 'income' ? 'Receita' : 'Despesa', content: body, size: 'sm' });
  }

  function openInstallmentDetail(inst, refresh) {
    const purchase = Store.cache.purchases.find((p) => p.id === inst.purchaseId);
    const card = Store.cache.cards.find((c) => c.id === inst.cardId);
    const cat = purchase ? Store.cache.categories.find((c) => c.id === purchase.category) : null;

    const splitsList = el('div', { class: 'flex-col mt-8' },
      inst.splits.map((s) => {
        const person = s.personId ? Store.cache.people.find((p) => p.id === s.personId) : null;
        return row(person ? `Responsabilidade — ${person.name}` : 'Minha responsabilidade', fmtMoney(s.amount));
      })
    );

    const body = el('div', { class: 'flex-col' }, [
      inst.kind === 'reversal' ? el('span', { class: 'tag tag-reversal' }, 'ESTORNO') : null,
      el('div', { class: 'money money-lg', style: `color:${inst.amount < 0 ? 'var(--red)' : 'var(--ink-900)'}` }, fmtMoney(inst.amount)),
      el('div', { class: 'mt-8' }, [
        row('Compra', purchase?.description || '—'),
        row('Cartão', card?.name || '—'),
        row('Categoria', cat ? `${cat.icon} ${cat.name}` : '—'),
        row('Data da compra', fmtDate(inst.purchaseDate)),
        row('Fatura (mês)', Calc.monthLabel(inst.invoiceMonth)),
        row('Vencimento da fatura', fmtDate(inst.invoiceDueDate)),
        inst.kind === 'installment' ? row('Parcela', `${inst.number}/${inst.totalInstallments}`) : null,
        inst.kind === 'subscription' ? row('Tipo', 'Assinatura recorrente') : null,
      ]),
      splitsList,
      purchase?.note ? el('div', { class: 'mt-8 text-xs text-muted' }, purchase.note) : null,
      inst.note ? el('div', { class: 'mt-8 text-xs text-blue' }, `Nota desta parcela: ${inst.note}`) : null,
      (inst.kind === 'installment' || inst.kind === 'subscription')
        ? el('button', { class: 'btn btn-ghost btn-block mt-8', onclick: () => { UI.closeTopModal(); Forms.openSingleInstallmentEditForm(inst, refresh); } }, `✎ Editar apenas ${Calc.monthLabel(inst.invoiceMonth)}`)
        : null,
      el('div', { class: 'flex gap-8 mt-8' }, [
        purchase ? el('button', { class: 'btn btn-ghost', style: 'flex:1', onclick: () => { UI.closeTopModal(); Forms.openCardPurchaseForm(purchase, refresh, inst.invoiceMonth); } }, 'Editar compra') : null,
        purchase ? el('button', { class: 'btn btn-danger', style: 'flex:1', onclick: async () => {
          const scope = await UI.confirmDialog({
            title: 'Excluir',
            message: (purchase.paymentType === 'installments' || purchase.paymentType === 'subscription')
              ? 'Deseja excluir somente esta parcela ou toda a compra/série?'
              : 'Tem certeza que deseja excluir esta compra?',
            choices: (purchase.paymentType === 'installments' || purchase.paymentType === 'subscription')
              ? [{ label: 'Cancelar', value: null }, { label: 'Somente esta parcela', value: 'installment' }, { label: 'Compra inteira', value: 'series', danger: true }]
              : [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: 'series', danger: true }],
          });
          if (!scope) return;
          UI.closeTopModal();
          await Store.deletePurchase(purchase.id, scope, scope === 'installment' ? inst.id : null);
          UI.toast('Excluído com sucesso.', 'success');
          refresh && refresh();
        } }, 'Excluir') : null,
      ]),
      purchase && purchase.paymentType === 'subscription' && purchase.active !== false
        ? el('button', { class: 'btn btn-ghost btn-block mt-8', onclick: async () => {
            const ok = await UI.confirmDialog({ title: 'Cancelar assinatura', message: 'As cobranças futuras a partir deste mês serão removidas. O histórico é mantido. Confirmar?', choices: [{ label: 'Voltar', value: null }, { label: 'Cancelar assinatura', value: true, danger: true }] });
            if (!ok) return;
            UI.closeTopModal();
            await Store.cancelSubscription(purchase.id, inst.invoiceMonth);
            UI.toast('Assinatura cancelada a partir deste mês.', 'success');
            refresh && refresh();
          } }, 'Cancelar assinatura a partir deste mês')
        : null,
    ]);
    UI.openModal({ title: 'Lançamento no cartão', content: body, size: 'sm' });
  }

  return { openTransactionDetail, openInstallmentDetail };
})();

window.Details = Details;
