// views/cards.js
const ViewCards = (() => {
  const { el, fmtMoney } = UI;
  let detailSortKey = 'date';
  let detailSortDesc = false;

  function renderList(container) {
    container.innerHTML = '';
    container.appendChild(UI.pageHeader({
      title: 'Cartões', subtitle: 'Gerencie seus cartões e acompanhe as faturas',
      actions: [{ icon: '+', label: 'Novo cartão', onClick: () => Forms.openCardForm(null, () => App.rerender()) }],
    }));

    if (!Store.cache.cards.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '💳'),
        el('div', { class: 'es-title' }, 'Nenhum cartão cadastrado'),
        el('div', {}, 'Adicione seu primeiro cartão para começar a lançar compras.'),
      ]));
      return;
    }

    const month = App.state.currentMonth;
    const grid = el('div', { class: 'grid-cards' });
    Store.cache.cards.forEach((card) => {
      const cs = Calc.computeCardSummary(card, Store.cache, month);
      const visual = el('div', {
        class: 'credit-card-visual',
        style: `background:linear-gradient(135deg, ${card.color || '#3f6fe0'}, ${shade(card.color || '#3f6fe0')});cursor:pointer;${card.active === false ? 'opacity:.5' : ''}`,
        onclick: () => App.navigate('cardDetail', { id: card.id }),
      }, [
        el('div', { class: 'cc-top' }, [
          el('div', {}, [el('div', { class: 'cc-name' }, card.name), el('div', { class: 'cc-inst' }, card.institution || '')]),
          el('div', { class: 'cc-inst' }, `Fecha ${card.closingDay} · Vence ${card.dueDay}`),
        ]),
        el('div', { class: 'cc-bottom' }, [
          el('div', { class: 'cc-invoice-label' }, 'Fatura deste mês'),
          el('div', { class: 'cc-invoice-value' }, fmtMoney(cs.currentInvoice)),
        ]),
      ]);
      grid.appendChild(visual);
    });
    container.appendChild(grid);
  }

  function shade(hex) {
    try {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const num = parseInt(c, 16);
      let r = Math.max(0, (num >> 16) - 40), g = Math.max(0, ((num >> 8) & 255) - 40), b = Math.max(0, (num & 255) - 40);
      return `rgb(${r},${g},${b})`;
    } catch { return hex; }
  }

  function renderDetail(container, params) {
    container.innerHTML = '';
    const card = Store.cache.cards.find((c) => c.id === params.id);
    if (!card) { container.appendChild(el('div', { class: 'empty-state glass' }, 'Cartão não encontrado.')); return; }
    const month = App.state.currentMonth;
    const cs = Calc.computeCardSummary(card, Store.cache, month);

    container.appendChild(UI.pageHeader({
      title: card.name, subtitle: card.institution || '',
      onBack: () => App.navigate('cards'),
      actions: [
        { icon: '+', label: 'Nova compra', onClick: () => Forms.openCardPurchaseForm(null, () => App.rerender(), null, null, card.id) },
        { icon: '📄', label: 'Importar fatura (CSV)', onClick: () => Forms.openImportInvoiceForm(card.id, () => App.rerender()) },
      ],
    }));

    container.appendChild(el('div', {
      class: 'credit-card-visual mt-14',
      style: `background:linear-gradient(135deg, ${card.color || '#3f6fe0'}, ${shade(card.color || '#3f6fe0')})`,
    }, [
      el('div', { class: 'cc-top' }, [
        el('div', {}, [el('div', { class: 'cc-name' }, card.name), el('div', { class: 'cc-inst' }, card.institution || '')]),
        el('div', { class: 'flex gap-8' }, [
          el('button', { class: 'icon-btn', style: 'background:rgba(255,255,255,0.25);color:#fff', 'aria-label': 'Editar cartão', onclick: () => Forms.openCardForm(card, () => App.rerender()) }, '✎'),
          el('button', { class: 'icon-btn', style: 'background:rgba(255,255,255,0.25);color:#fff', 'aria-label': 'Excluir cartão', onclick: async () => {
            const ok = await UI.confirmDialog({ title: 'Excluir cartão', message: `Excluir "${card.name}" também removerá todas as compras e parcelas vinculadas. Continuar?`, choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
            if (!ok) return;
            await Store.deleteCard(card.id);
            UI.toast('Cartão excluído.', 'success');
            App.navigate('cards');
          } }, '🗑'),
        ]),
      ]),
      el('div', { class: 'cc-bottom' }, [
        el('div', { class: 'cc-invoice-label' }, `Fatura de ${Calc.monthLabel(month)}`),
        el('div', { class: 'cc-invoice-value' }, fmtMoney(cs.currentInvoice)),
      ]),
    ]));

    // limite
    const usedPct = card.limit ? Math.min(100, (cs.used / card.limit) * 100) : 0;
    container.appendChild(el('div', { class: 'glass mt-14', style: 'padding:14px 16px' }, [
      el('div', { class: 'flex justify-between text-xs' }, [
        el('span', { class: 'text-muted' }, 'Limite utilizado (faturas em aberto)'),
        el('span', { style: 'font-weight:700' }, `${fmtMoney(cs.used)} / ${fmtMoney(card.limit || 0)}`),
      ]),
      el('div', { class: 'progress-track mt-8' }, [el('div', { class: 'progress-fill', style: `width:${usedPct}%;background:${usedPct > 85 ? 'var(--red)' : usedPct > 60 ? 'var(--amber)' : 'var(--green)'}` })]),
      el('div', { class: 'text-xs text-muted mt-8' }, `Disponível: ${fmtMoney(cs.available)}`),
    ]));

    container.appendChild(el('div', { class: 'grid grid-2 mt-14' }, [
      statBox('Fatura atual', cs.currentInvoice),
      statBox('Próxima fatura', cs.nextInvoice),
    ]));

    // evolução de faturas futuras
    const months = Object.keys(cs.byMonth).sort().slice(0, 6);
    if (months.length) {
      container.appendChild(el('div', { class: 'section-title' }, 'Faturas futuras'));
      container.appendChild(Charts.barChart({
        data: months.map((m) => ({ label: m.slice(5) + '/' + m.slice(2, 4), value: cs.byMonth[m] })),
        formatValue: (v) => fmtMoney(v).replace('R$', '').trim(),
        color: card.color || '#3f6fe0',
      }));
    }

    container.appendChild(el('div', { class: 'flex justify-between items-center', style: 'margin:20px 0 8px' }, [
      el('div', { class: 'section-title', style: 'margin:0' }, `Lançamentos de ${Calc.monthLabel(month)}`),
      UI.buildSortControl(detailSortKey, (v) => { detailSortKey = v; renderDetail(container, params); }, undefined, detailSortDesc, () => { detailSortDesc = !detailSortDesc; renderDetail(container, params); }),
    ]));
    const list = el('div', { class: 'list' });
    const items = cs.items.filter((i) => i.invoiceMonth === month).map((i) => {
      const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
      const isDivided = i.splits.length >= 2;
      const responsiblePersonId = !isDivided ? i.splits.find((s) => s.personId)?.personId : null;
      const person = responsiblePersonId ? Store.cache.people.find((p) => p.id === responsiblePersonId) : null;
      return {
        inst: i, purchase, title: purchase?.description || '—', date: i.purchaseDate, value: i.amount,
        totalInstallments: i.totalInstallments || null, installmentNumber: i.number || null,
        personName: isDivided ? 'Dividida' : (person?.name || ''), splits: i.splits,
      };
    }).sort(UI.sortComparator(detailSortKey, detailSortDesc));
    if (!items.length) list.appendChild(el('div', { class: 'empty-state glass' }, 'Nenhum lançamento neste mês.'));
    items.forEach((it) => {
      const i = it.inst, purchase = it.purchase;
      const cat = Store.cache.categories.find((c) => c.id === purchase?.category);
      list.appendChild(el('div', { class: 'list-item glass', onclick: () => Details.openInstallmentDetail(i, () => App.rerender()) }, [
        UI.iconChip(i.kind === 'reversal' ? '↩️' : (cat?.icon || '💳'), i.kind === 'reversal' ? '#17a06b' : (card.color || '#3f6fe0')),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, purchase?.description || '—'),
          el('div', { class: 'li-sub' }, [
            i.kind === 'installment' ? `Parcela ${i.number}/${i.totalInstallments}` : (i.kind === 'subscription' ? 'Assinatura' : (i.kind === 'reversal' ? 'Estorno' : 'Compra única')),
            UI.splitTag(it.splits, (e, p) => { e.stopPropagation(); App.navigate('personDetail', { id: p.id }); }),
          ]),
        ]),
        el('div', { class: 'li-value', style: `color:${i.kind === 'reversal' ? 'var(--green)' : 'var(--ink-900)'}` }, fmtMoney(i.amount)),
      ]));
    });
    container.appendChild(list);
  }

  function statBox(label, value) {
    return el('div', { class: 'stat-card glass' }, [el('div', { class: 'stat-label' }, label), el('div', { class: 'stat-value' }, fmtMoney(value))]);
  }

  return { renderList, renderDetail };
})();
window.ViewCards = ViewCards;
