// forms.js — Modais de cadastro/edição para todas as entidades do sistema.
const Forms = (() => {
  const { el, fmtMoney } = UI;

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function categoryOptions(selected, includeBlank = true) {
    const blank = includeBlank ? [el('option', { value: '', selected: !selected ? 'selected' : undefined }, '— Selecionar categoria —')] : [];
    return blank.concat(Store.cache.categories.map((c) =>
      el('option', { value: c.id, selected: c.id === selected ? 'selected' : undefined }, `${c.icon} ${c.name}`)
    ));
  }
  function personOptions(selected, includeNone = true) {
    const opts = includeNone ? [el('option', { value: '' }, '— Nenhuma —')] : [];
    return opts.concat(Store.cache.people.map((p) =>
      el('option', { value: p.id, selected: p.id === selected ? 'selected' : undefined }, p.name)
    ));
  }
  function cardOptions(selected) {
    return Store.cache.cards.filter((c) => c.active !== false).map((c) =>
      el('option', { value: c.id, selected: c.id === selected ? 'selected' : undefined }, `${c.name} — ${c.institution || ''}`)
    );
  }

  // ---------------- Receita / Despesa ----------------
  function openTransactionForm(type, existing = null, onSaved) {
    const isIncome = type === 'income';
    const title = existing ? `Editar ${isIncome ? 'receita' : 'despesa'}` : `Nova ${isIncome ? 'receita' : 'despesa'}`;

    const descInput = el('input', { type: 'text', placeholder: isIncome ? 'Ex: Salário' : 'Ex: Conta de energia', value: existing?.description || '' });
    const amountInput = el('input', { type: 'number', step: '0.01', min: '0', placeholder: '0,00', value: existing?.amount ?? '' });
    const dateInput = el('input', { type: 'date', value: existing?.date || todayISO() });
    const catSelect = el('select', {}, categoryOptions(existing?.category));
    attachInlineCategoryCreate(catSelect);
    const personSelect = el('select', {}, personOptions(existing?.person));
    const statusSelect = el('select', {}, [
      el('option', { value: 'planned', selected: (!existing || existing.status === 'planned') ? 'selected' : undefined }, 'Planejado'),
      el('option', { value: 'confirmed', selected: existing?.status === 'confirmed' ? 'selected' : undefined }, 'Confirmado'),
    ]);
    const noteInput = el('textarea', { placeholder: 'Observação (opcional)' }, existing?.note || '');

    let recurrenceMode = existing?.recurrence?.mode || 'none';
    const recurrenceSeg = el('div', { class: 'segmented' }, [
      el('button', { type: 'button', class: recurrenceMode === 'none' ? 'active' : '', onclick: (e) => setRecurrence('none', e) }, 'Única'),
      el('button', { type: 'button', class: recurrenceMode === 'recurring' ? 'active' : '', onclick: (e) => setRecurrence('recurring', e) }, 'Recorrente'),
      el('button', { type: 'button', class: recurrenceMode === 'fixed_period' ? 'active' : '', onclick: (e) => setRecurrence('fixed_period', e) }, 'Por período'),
    ]);
    const endDateField = el('div', { class: 'field', style: recurrenceMode === 'fixed_period' ? '' : 'display:none' }, [
      el('label', {}, 'Repetir até (mês final)'),
      el('input', { type: 'date', id: 'rec-end-date' }),
    ]);
    function setRecurrence(mode, e) {
      recurrenceMode = mode;
      recurrenceSeg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      endDateField.style.display = mode === 'fixed_period' ? '' : 'none';
    }

    let moreOptionsOpen = existing?.status === 'confirmed';
    const moreOptionsBody = el('div', { style: moreOptionsOpen ? '' : 'display:none' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Status'), statusSelect]),
    ]);
    const moreOptionsToggle = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', style: 'margin-bottom:14px',
      onclick: (e) => {
        moreOptionsOpen = !moreOptionsOpen;
        moreOptionsBody.style.display = moreOptionsOpen ? '' : 'none';
        e.target.textContent = moreOptionsOpen ? '▾ Menos opções' : '▸ Mais opções';
      },
    }, moreOptionsOpen ? '▾ Menos opções' : '▸ Mais opções');

    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Descrição'), descInput]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Valor (R$)'), amountInput]),
        el('div', { class: 'field' }, [el('label', {}, isIncome ? 'Data prevista' : 'Data de vencimento'), dateInput]),
      ]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Categoria'), catSelect]),
        el('div', { class: 'field' }, [el('label', {}, 'Pessoa relacionada'), personSelect]),
      ]),
      !existing ? el('div', { class: 'field' }, [el('label', {}, 'Recorrência'), recurrenceSeg]) : null,
      !existing ? endDateField : null,
      el('div', { class: 'field' }, [el('label', {}, 'Observação'), noteInput]),
      moreOptionsToggle,
      moreOptionsBody,
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, existing ? 'Salvar alterações' : 'Adicionar'),
    ]);

    const modal = UI.openModal({ title, content: body });

    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(amountInput.value);
      if (!descInput.value.trim() || !amount || amount <= 0 || !dateInput.value) {
        UI.toast('Preencha descrição, valor e data corretamente.', 'error');
        return;
      }
      const payload = {
        type,
        description: descInput.value.trim(),
        amount,
        date: dateInput.value,
        category: catSelect.value || null,
        person: personSelect.value || null,
        status: statusSelect.value,
        note: noteInput.value.trim(),
        tags: [],
      };
      try {
        if (existing) {
          await Store.updateTransaction({ ...existing, ...payload });
          UI.toast('Atualizado com sucesso.', 'success');
        } else {
          const recurrence = { mode: recurrenceMode, endDate: document.getElementById('rec-end-date')?.value };
          await Store.createTransaction({ ...payload, recurrence });
          UI.toast('Adicionado com sucesso.', 'success');
        }
        modal.close();
        onSaved && onSaved();
      } catch (err) {
        UI.toast('Erro ao salvar: ' + err.message, 'error');
      }
    });
  }

  // ---------------- Compra no cartão ----------------
  // pivotMonth: quando a edição parte de uma parcela específica (ex: tela de detalhe de
  // uma parcela), define a partir de qual mês a opção "esta e as próximas" se aplica.
  // pivotInstallmentNumber: o número daquela parcela específica que foi clicada — usado
  // para pré-preencher "já estou na parcela nº" corretamente (em vez de sempre voltar a 1).
  function openCardPurchaseForm(existing = null, onSaved, pivotMonth = null, pivotInstallmentNumber = null, defaultCardId = null) {
    if (Store.cache.cards.length === 0) {
      UI.toast('Cadastre um cartão antes de lançar uma compra.', 'error');
      openCardForm(null, () => openCardPurchaseForm(existing, onSaved, pivotMonth, pivotInstallmentNumber, defaultCardId));
      return;
    }
    const title = existing ? 'Editar compra no cartão' : 'Nova compra no cartão';
    const cardSelect = el('select', {}, cardOptions(existing?.cardId || defaultCardId));
    const descInput = el('input', { type: 'text', placeholder: 'Ex: Notebook', value: existing?.description || '' });
    const amountInput = el('input', { type: 'number', step: '0.01', placeholder: '0,00', value: existing?.amount ?? '' });
    const amountHint = el('div', { class: 'hint', style: 'display:none' });
    const dateInput = el('input', { type: 'date', value: existing?.purchaseDate || todayISO() });
    const catSelect = el('select', {}, categoryOptions(existing?.category));
    attachInlineCategoryCreate(catSelect);
    const noteInput = el('textarea', { placeholder: 'Observação (opcional)' }, existing?.note || '');

    // Pessoa responsável: atribuição simples e rápida da compra inteira a uma pessoa,
    // sem precisar abrir "dividir compra". Se a divisão detalhada for ativada, ela tem prioridade.
    let responsibleDefault = '';
    if (existing?.splits?.length === 1 && existing.splits[0].personId && Calc.round2(existing.splits[0].amount) === Calc.round2(existing.amount)) {
      responsibleDefault = existing.splits[0].personId;
    }
    const responsibleSelect = el('select', {}, [el('option', { value: '' }, 'Eu (compra própria)')].concat(personOptions(responsibleDefault, false)));
    const responsibleField = el('div', { class: 'field' }, [
      el('label', {}, 'Pessoa responsável por esta compra'),
      responsibleSelect,
      el('div', { class: 'hint' }, 'Use isto quando a compra inteira for de outra pessoa. Para dividir entre várias pessoas, use "Dividir compra" abaixo.'),
    ]);

    // Mês de vencimento da fatura: por padrão, calculado automaticamente pelo dia de
    // fechamento do cartão. Pode ser definido manualmente quando necessário. Quando a
    // edição parte de uma parcela específica, ancoramos automaticamente nela — assim
    // editar não desloca a série (e "já estou na parcela" não volta pra 1).
    let overrideEnabled = !!existing?.invoiceMonthOverride || !!(pivotMonth && pivotInstallmentNumber);
    const todayD = new Date();
    const ovBase = pivotMonth || existing?.invoiceMonthOverride || `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}`;
    const [ovY, ovM] = ovBase.split('-').map(Number);
    const monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const ovMonthSelect = el('select', {}, monthNamesFull.map((n, i) => el('option', { value: i + 1, selected: (i + 1) === ovM ? 'selected' : undefined }, n)));
    const ovYearSelect = el('select', {}, [-1, 0, 1, 2].map((d) => el('option', { value: ovY + d, selected: d === 0 ? 'selected' : undefined }, `${ovY + d}`)));
    const ovFieldsWrap = el('div', { class: 'form-row', style: overrideEnabled ? '' : 'display:none' }, [ovMonthSelect, ovYearSelect]);
    const overrideToggle = el('input', { type: 'checkbox', checked: overrideEnabled ? 'checked' : undefined, onchange: (e) => {
      overrideEnabled = e.target.checked;
      ovFieldsWrap.style.display = overrideEnabled ? '' : 'none';
    } });
    const overrideField = el('div', { class: 'field' }, [
      el('label', { class: 'flex items-center gap-8' }, [overrideToggle, 'Definir manualmente o mês de vencimento da fatura']),
      el('div', { class: 'hint mb-8' }, 'Por padrão, o app calcula automaticamente com base no dia de fechamento do cartão. Use isto para corrigir um caso específico.'),
      ovFieldsWrap,
    ]);

    let paymentType = existing?.paymentType || 'single';
    const paySeg = el('div', { class: 'segmented' }, [
      el('button', { type: 'button', class: paymentType === 'single' ? 'active' : '', onclick: (e) => setPay('single', e) }, 'Única'),
      el('button', { type: 'button', class: paymentType === 'installments' ? 'active' : '', onclick: (e) => setPay('installments', e) }, 'Parcelada'),
      el('button', { type: 'button', class: paymentType === 'subscription' ? 'active' : '', onclick: (e) => setPay('subscription', e) }, 'Assinatura'),
    ]);

    const installmentsCountInput = el('input', { type: 'number', min: '2', max: '48', value: existing?.installmentsCount || 2, id: 'installments-count', onchange: () => { startInstallmentInput.max = installmentsCountInput.value; } });
    const startInstallmentDefault = pivotInstallmentNumber || existing?.startInstallmentNumber || 1;
    const startInstallmentInput = el('input', { type: 'number', min: '1', max: existing?.installmentsCount || 2, value: startInstallmentDefault, id: 'start-installment-number' });
    const installmentsField = el('div', { style: paymentType === 'installments' ? '' : 'display:none' }, [
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Número de parcelas'), installmentsCountInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Já estou na parcela nº'), startInstallmentInput]),
      ]),
      el('div', { class: 'hint', style: 'margin:-6px 0 14px' }, 'Lançando uma compra atrasada? Informe em qual parcela você já está — a data acima deve ser a data de vencimento desta parcela específica.'),
    ]);

    let subEndless = existing ? !existing.subscriptionEndDate : true;
    const subEndDateInput = el('input', { type: 'date', value: existing?.subscriptionEndDate || '', disabled: subEndless ? 'disabled' : undefined });
    const subEndlessCheck = el('input', { type: 'checkbox', checked: subEndless ? 'checked' : undefined, onchange: (e) => {
      subEndless = e.target.checked;
      subEndDateInput.disabled = subEndless;
      subFixedTermFields.style.display = subEndless ? 'none' : '';
    } });
    const subInstallmentsCountInput = el('input', { type: 'number', min: '2', max: '120', value: existing?.installmentsCount || '', id: 'sub-installments-count', onchange: () => { subStartInstallmentInput.max = subInstallmentsCountInput.value; } });
    const subStartInstallmentInput = el('input', { type: 'number', min: '1', max: existing?.installmentsCount || '', value: (pivotInstallmentNumber && existing?.paymentType === 'subscription') ? pivotInstallmentNumber : (existing?.startInstallmentNumber || 1), id: 'sub-start-installment-number' });
    const subFixedTermFields = el('div', { style: subEndless ? 'display:none' : '' }, [
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Quantidade de parcelas'), subInstallmentsCountInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Já estou na parcela nº'), subStartInstallmentInput]),
      ]),
      el('div', { class: 'hint', style: 'margin:-6px 0 14px' }, 'Preencha se souber quantas cobranças a assinatura terá ao todo — útil para cadastrar uma assinatura que já está em andamento. Se deixar em branco, o app calcula pelo período entre a data acima e a data final.'),
    ]);
    const subscriptionField = el('div', { style: paymentType === 'subscription' ? '' : 'display:none' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'flex items-center gap-8' }, [subEndlessCheck, 'Assinatura indefinida (sem data de término)']),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Data final (se aplicável)'), subEndDateInput]),
      subFixedTermFields,
    ]);

    function setPay(mode, e) {
      paymentType = mode;
      paySeg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      installmentsField.style.display = mode === 'installments' ? '' : 'none';
      subscriptionField.style.display = mode === 'subscription' ? '' : 'none';
    }

    // Valor negativo é tratado automaticamente como ESTORNO (reduz o valor de uma
    // fatura) — não é preciso um fluxo separado para isso. Nesse caso a compra é
    // sempre única, então travamos as outras opções de pagamento.
    function updateReversalDetection() {
      const val = parseFloat(amountInput.value);
      const isNeg = !isNaN(val) && val < 0;
      amountHint.style.display = isNeg ? '' : 'none';
      amountHint.textContent = isNeg ? '↩️ Valor negativo — este lançamento será registrado como ESTORNO.' : '';
      amountHint.style.color = isNeg ? 'var(--red)' : '';
      paySeg.querySelectorAll('button').forEach((b, idx) => { b.disabled = isNeg && idx > 0; });
      if (isNeg && paymentType !== 'single') {
        paymentType = 'single';
        paySeg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        paySeg.querySelector('button').classList.add('active');
        installmentsField.style.display = 'none';
        subscriptionField.style.display = 'none';
      }
    }
    amountInput.addEventListener('input', updateReversalDetection);
    updateReversalDetection();

    // divisão de compra
    let splitEnabled = existing?.splits && existing.splits.length > 1;
    responsibleField.style.display = splitEnabled ? 'none' : '';
    const splitRowsWrap = el('div', { class: 'flex-col', style: 'margin-top:8px' });
    const splitParticipants = []; // {personId, input}

    function renderSplitRows() {
      splitRowsWrap.innerHTML = '';
      splitParticipants.length = 0;
      const totalVal = parseFloat(amountInput.value) || 0;
      const existingSplitsMap = {};
      (existing?.splits || []).forEach((s) => { existingSplitsMap[s.personId || 'self'] = s.amount; });

      const addRow = (personId, label, defaultVal) => {
        const input = el('input', { type: 'number', step: '0.01', min: '0', value: defaultVal ?? '' });
        splitParticipants.push({ personId, input });
        splitRowsWrap.appendChild(el('div', { class: 'split-row' }, [
          el('span', { class: 'split-name' }, label),
          input,
        ]));
      };
      addRow(null, 'Eu (própria parte)', existingSplitsMap.self ?? totalVal);
      Store.cache.people.forEach((p) => addRow(p.id, p.name, existingSplitsMap[p.id]));
      splitRowsWrap.appendChild(el('div', { class: 'text-xs text-muted', id: 'split-sum-hint' }, ''));
      updateSplitHint();
    }
    function updateSplitHint() {
      const totalVal = parseFloat(amountInput.value) || 0;
      const sum = Calc.round2(splitParticipants.reduce((a, p) => a + (parseFloat(p.input.value) || 0), 0));
      const hint = splitRowsWrap.querySelector('#split-sum-hint');
      if (hint) {
        const ok = Calc.round2(sum) === Calc.round2(totalVal);
        hint.textContent = `Soma: ${fmtMoney(sum)} de ${fmtMoney(totalVal)} ${ok ? '✓' : '— deve ser igual ao valor total'}`;
        hint.style.color = ok ? 'var(--green)' : 'var(--red)';
      }
    }
    const splitToggle = el('input', { type: 'checkbox', checked: splitEnabled ? 'checked' : undefined, onchange: (e) => {
      splitEnabled = e.target.checked;
      splitSection.style.display = splitEnabled ? '' : 'none';
      responsibleField.style.display = splitEnabled ? 'none' : '';
      if (splitEnabled) renderSplitRows();
    } });
    const splitSection = el('div', { style: splitEnabled ? '' : 'display:none' }, [splitRowsWrap]);
    if (splitEnabled) renderSplitRows();
    amountInput.addEventListener('input', updateSplitHint);
    splitRowsWrap.addEventListener('input', updateSplitHint);

    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Cartão'), cardSelect]),
      el('div', { class: 'field' }, [el('label', {}, 'Descrição da compra'), descInput]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Valor total (R$)'), amountInput, amountHint]),
        el('div', { class: 'field' }, [el('label', {}, 'Data da compra'), dateInput]),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Categoria'), catSelect]),
      responsibleField,
      el('div', { class: 'field' }, [el('label', {}, 'Forma de pagamento'), paySeg]),
      installmentsField,
      subscriptionField,
      overrideField,
      el('div', { class: 'field' }, [
        el('label', { class: 'flex items-center gap-8' }, [splitToggle, 'Dividir compra com outras pessoas']),
      ]),
      splitSection,
      el('div', { class: 'field' }, [el('label', {}, 'Observação'), noteInput]),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, existing ? 'Salvar alterações' : 'Adicionar compra'),
    ]);

    const modal = UI.openModal({ title, content: body, size: 'md' });

    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(amountInput.value);
      if (!descInput.value.trim() || !amount || !dateInput.value || !cardSelect.value) {
        UI.toast('Preencha cartão, descrição, valor e data.', 'error');
        return;
      }
      const isReversal = amount < 0;
      let splits = [];
      if (splitEnabled) {
        splits = splitParticipants
          .map((p) => ({ personId: p.personId, amount: parseFloat(p.input.value) || 0 }))
          .filter((s) => s.amount !== 0);
        const sum = Calc.round2(splits.reduce((a, s) => a + s.amount, 0));
        if (Calc.round2(sum) !== Calc.round2(amount)) {
          UI.toast('A soma da divisão precisa ser igual ao valor total da compra.', 'error');
          return;
        }
      } else if (responsibleSelect.value) {
        // compra inteira atribuída a uma única pessoa (sem divisão detalhada)
        splits = [{ personId: responsibleSelect.value, amount }];
      }
      const payload = {
        cardId: cardSelect.value,
        description: descInput.value.trim(),
        amount,
        purchaseDate: dateInput.value,
        category: catSelect.value || null,
        note: noteInput.value.trim(),
        paymentType: isReversal ? 'single' : paymentType,
        isReversal,
        splits,
        active: true,
        invoiceMonthOverride: overrideEnabled ? `${ovYearSelect.value}-${String(ovMonthSelect.value).padStart(2, '0')}` : null,
      };
      if (paymentType === 'installments') {
        payload.installmentsCount = parseInt(document.getElementById('installments-count').value, 10) || 2;
        payload.startInstallmentNumber = Math.min(
          Math.max(1, parseInt(document.getElementById('start-installment-number').value, 10) || 1),
          payload.installmentsCount
        );
      }
      if (paymentType === 'subscription') {
        const hasFixedTermCount = !subEndless && subInstallmentsCountInput.value;
        if (hasFixedTermCount) {
          const n = parseInt(subInstallmentsCountInput.value, 10) || null;
          const startAt = n ? Math.min(Math.max(1, parseInt(subStartInstallmentInput.value, 10) || 1), n) : null;
          payload.installmentsCount = n;
          payload.startInstallmentNumber = startAt;
          if (subEndDateInput.value) {
            payload.subscriptionEndDate = subEndDateInput.value;
          } else if (n && startAt && dateInput.value) {
            // usuário preencheu quantidade/parcela mas não a data final — deriva
            // automaticamente a partir da data informada + parcelas restantes
            const remainingMonths = n - startAt;
            const endMonth = Calc.addMonths(Calc.monthRefOf(dateInput.value), remainingMonths);
            const day = dateInput.value.slice(8, 10);
            payload.subscriptionEndDate = `${endMonth}-${day}`;
          } else {
            payload.subscriptionEndDate = null;
          }
        } else {
          payload.subscriptionEndDate = subEndless ? null : (subEndDateInput.value || null);
          payload.installmentsCount = null;
          payload.startInstallmentNumber = null;
        }
      }
      try {
        if (existing) {
          let scope = 'series';
          if (existing.paymentType === 'installments' || existing.paymentType === 'subscription') {
            const monthLabel = pivotMonth ? Calc.monthLabel(pivotMonth) : 'a partir de agora';
            scope = await UI.confirmDialog({
              title: 'Atualizar parcelas',
              message: `Deseja aplicar a alteração a partir de ${monthLabel} (mantendo os meses anteriores como estavam) ou refazer toda a série desde o início?`,
              choices: [
                { label: 'Cancelar', value: null },
                { label: `A partir de ${monthLabel}`, value: 'future' },
                { label: 'Toda a série', value: 'series', primary: true },
              ],
            });
            if (!scope) return;
          }
          await Store.updateCardPurchase({ ...existing, ...payload }, scope, pivotMonth);
          UI.toast('Compra atualizada.', 'success');
        } else {
          await Store.createCardPurchase(payload);
          UI.toast('Compra adicionada.', 'success');
        }
        modal.close();
        onSaved && onSaved();
      } catch (err) {
        UI.toast('Erro ao salvar: ' + err.message, 'error');
      }
    });
  }

  // ---------------- Editar apenas uma parcela específica ----------------
  // Ao contrário de editar a compra inteira, aqui só o valor/observação daquele mês
  // específico mudam — as demais parcelas da série permanecem intactas.
  function openSingleInstallmentEditForm(inst, onSaved) {
    const amountInput = el('input', { type: 'number', step: '0.01', value: inst.amount });
    const noteInput = el('textarea', { placeholder: 'Observação (opcional)' }, inst.note || '');
    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, `Valor apenas em ${Calc.monthLabel(inst.invoiceMonth)}`), amountInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Observação'), noteInput]),
      el('div', { class: 'text-xs text-muted mb-8' }, 'As demais parcelas desta compra não serão alteradas.'),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Salvar apenas esta parcela'),
    ]);
    const modal = UI.openModal({ title: 'Editar apenas esta parcela', content: body, size: 'sm' });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(amountInput.value);
      if (isNaN(amount)) { UI.toast('Informe um valor válido.', 'error'); return; }
      const signedAmount = inst.amount < 0 ? -Math.abs(amount) : Math.abs(amount);
      await Store.updateSingleInstallment({ ...inst, amount: signedAmount, note: noteInput.value.trim() });
      UI.toast('Parcela atualizada.', 'success');
      modal.close();
      onSaved && onSaved();
    });
  }

  // ---------------- Cartão ----------------
  function openCardForm(existing = null, onSaved) {
    const nameInput = el('input', { type: 'text', placeholder: 'Ex: Nubank', value: existing?.name || '' });
    const instInput = el('input', { type: 'text', placeholder: 'Ex: Nu Pagamentos', value: existing?.institution || '' });
    const limitInput = el('input', { type: 'number', step: '0.01', min: '0', placeholder: '0,00', value: existing?.limit ?? '' });
    const closingInput = el('input', { type: 'number', min: '1', max: '31', value: existing?.closingDay || 10 });
    const dueInput = el('input', { type: 'number', min: '1', max: '31', value: existing?.dueDay || 17 });
    const colorInput = el('input', { type: 'color', value: existing?.color || '#3f6fe0' });
    const activeCheck = el('input', { type: 'checkbox', checked: existing ? (existing.active !== false) : true });

    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Nome do cartão'), nameInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Instituição/banco'), instInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Limite (R$)'), limitInput]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Dia de fechamento'), closingInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Dia de vencimento'), dueInput]),
      ]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Cor'), colorInput]),
        el('div', { class: 'field' }, [el('label', { class: 'flex items-center gap-8', style: 'margin-top:10px' }, [activeCheck, 'Cartão ativo'])]),
      ]),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, existing ? 'Salvar alterações' : 'Adicionar cartão'),
    ]);
    const modal = UI.openModal({ title: existing ? 'Editar cartão' : 'Novo cartão', content: body, size: 'sm' });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nameInput.value.trim()) { UI.toast('Informe o nome do cartão.', 'error'); return; }
      await Store.upsertCard({
        ...(existing || {}),
        name: nameInput.value.trim(),
        institution: instInput.value.trim(),
        limit: parseFloat(limitInput.value) || 0,
        closingDay: parseInt(closingInput.value, 10) || 10,
        dueDay: parseInt(dueInput.value, 10) || 17,
        color: colorInput.value,
        active: activeCheck.checked,
      });
      UI.toast('Cartão salvo.', 'success');
      modal.close();
      onSaved && onSaved();
    });
  }

  // ---------------- Pessoa ----------------
  function openPersonForm(existing = null, onSaved) {
    const nameInput = el('input', { type: 'text', placeholder: 'Ex: Mãe', value: existing?.name || '' });
    const colorInput = el('input', { type: 'color', value: existing?.color || '#7b8cde' });
    const noteInput = el('textarea', { placeholder: 'Observação (opcional)' }, existing?.note || '');
    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Nome'), nameInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Cor da tag'), colorInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Observação'), noteInput]),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, existing ? 'Salvar alterações' : 'Adicionar pessoa'),
    ]);
    const modal = UI.openModal({ title: existing ? 'Editar pessoa' : 'Nova pessoa', content: body, size: 'sm' });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nameInput.value.trim()) { UI.toast('Informe o nome.', 'error'); return; }
      await Store.upsertPerson({ ...(existing || {}), name: nameInput.value.trim(), color: colorInput.value, note: noteInput.value.trim() });
      UI.toast('Pessoa salva.', 'success');
      modal.close();
      onSaved && onSaved();
    });
  }

  // ---------------- Categoria ----------------
  function openCategoryForm(existing = null, onSaved) {
    const nameInput = el('input', { type: 'text', placeholder: 'Ex: Alimentação', value: existing?.name || '' });
    const iconInput = el('input', { type: 'text', placeholder: '🍽️', value: existing?.icon || '📦', maxlength: 4 });
    const colorInput = el('input', { type: 'color', value: existing?.color || '#8d99ae' });
    const body = el('form', { class: 'flex-col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Nome'), nameInput]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Ícone (emoji)'), iconInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Cor'), colorInput]),
      ]),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, existing ? 'Salvar alterações' : 'Adicionar categoria'),
    ]);
    const modal = UI.openModal({ title: existing ? 'Editar categoria' : 'Nova categoria', content: body, size: 'sm' });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nameInput.value.trim()) { UI.toast('Informe o nome.', 'error'); return; }
      const obj = { ...(existing || {}), name: nameInput.value.trim(), icon: iconInput.value || '📦', color: colorInput.value };
      await Store.upsertCategory(obj);
      UI.toast('Categoria salva.', 'success');
      modal.close();
      onSaved && onSaved(obj);
    });
  }

  // Adiciona a opção "+ Criar nova categoria" a um <select> de categoria já existente,
  // permitindo criar uma categoria sem sair do formulário atual (ex: receita, despesa,
  // compra no cartão). Ao criar, a nova categoria já fica selecionada automaticamente.
  function attachInlineCategoryCreate(catSelect) {
    catSelect.dataset.prevValue = catSelect.value;
    catSelect.appendChild(el('option', { value: '__new__' }, '+ Criar nova categoria...'));
    catSelect.addEventListener('change', (e) => {
      if (e.target.value !== '__new__') return;
      const previousValue = catSelect.dataset.prevValue || '';
      catSelect.value = previousValue;
      openCategoryForm(null, (newCat) => {
        const opt = el('option', { value: newCat.id, selected: 'selected' }, `${newCat.icon} ${newCat.name}`);
        catSelect.insertBefore(opt, catSelect.lastElementChild);
        catSelect.value = newCat.id;
        catSelect.dataset.prevValue = newCat.id;
      });
    });
    catSelect.addEventListener('change', () => { if (catSelect.value !== '__new__') catSelect.dataset.prevValue = catSelect.value; });
  }

  // ---------------- Importar fatura via CSV ----------------
  function openImportInvoiceForm(defaultCardId, onSaved) {
    if (Store.cache.cards.length === 0) {
      UI.toast('Cadastre um cartão antes de importar uma fatura.', 'error');
      openCardForm(null, () => openImportInvoiceForm(defaultCardId, onSaved));
      return;
    }
    const fileInput = el('input', { type: 'file', accept: '.csv,text/csv' });
    const dropZone = el('div', {
      class: 'glass-soft', style: 'padding:22px;text-align:center;border-radius:14px;border:1.5px dashed rgba(63,111,224,0.35);cursor:pointer',
      onclick: () => fileInput.click(),
    }, [
      el('div', { style: 'font-size:26px' }, '📄'),
      el('div', { class: 'text-xs mt-8', style: 'font-weight:700' }, 'Selecione o arquivo CSV da fatura'),
      el('div', { class: 'text-xs text-muted mt-8' }, 'Formato esperado: date, title, amount (exportação do Nubank)'),
    ]);
    const resultWrap = el('div', {});
    const body = el('div', { class: 'flex-col' }, [dropZone, fileInput, resultWrap]);
    fileInput.style.display = 'none';

    const modal = UI.openModal({ title: 'Importar fatura (CSV)', content: body, size: 'md' });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      let text, parsed;
      try {
        text = await file.text();
        parsed = CSVImport.parseNubankCSV(text);
      } catch (err) {
        UI.toast('Erro ao ler CSV: ' + err.message, 'error');
        return;
      }
      if (!parsed.rows.length) {
        UI.toast('Nenhum lançamento válido encontrado no arquivo.', 'error');
        return;
      }
      renderPreview(file.name, parsed);
    });

    function renderPreview(filename, parsed) {
      resultWrap.innerHTML = '';
      const guessedDate = CSVImport.guessDateFromFilename(filename);
      const guessedMonth = guessedDate ? Calc.monthRefOf(guessedDate) : App.state.currentMonth;

      const cardSelect = el('select', {}, cardOptions(defaultCardId));
      const [gy, gm] = guessedMonth.split('-').map(Number);
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const monthSel = el('select', {}, monthNames.map((n, i) => el('option', { value: i + 1, selected: (i + 1) === gm ? 'selected' : undefined }, n)));
      const yearSel = el('select', {}, [-1, 0, 1].map((d) => el('option', { value: gy + d, selected: d === 0 ? 'selected' : undefined }, `${gy + d}`)));
      const catSelect = el('select', {}, [el('option', { value: '' }, '— Sem categoria (definir depois) —')].concat(categoryOptions(null, false)));
      const ignoreDupCheck = el('input', { type: 'checkbox', checked: 'checked' });
      const ignorePaymentCheck = el('input', { type: 'checkbox', checked: 'checked' });

      let rows = [];
      function recomputeDuplicates() {
        rows = CSVImport.findDuplicates(cardSelect.value, parsed.rows);
        renderSummary();
      }

      function activeFilter(r) {
        if (ignoreDupCheck.checked && r.duplicate) return false;
        if (ignorePaymentCheck.checked && r.isPayment) return false;
        return true;
      }

      const summaryWrap = el('div');
      function renderSummary() {
        summaryWrap.innerHTML = '';
        const dupCount = rows.filter((r) => r.duplicate).length;
        const paymentCount = rows.filter((r) => r.isPayment).length;
        const toImport = rows.filter(activeFilter);
        const total = Calc.round2(toImport.reduce((a, r) => a + r.amount, 0));

        summaryWrap.appendChild(el('div', { class: 'glass', style: 'padding:12px 14px;margin-top:6px' }, [
          el('div', { class: 'flex justify-between text-xs' }, [el('span', {}, `${parsed.rows.length} lançamento(s) encontrados`), el('span', {}, parsed.skipped ? `${parsed.skipped} ignorado(s) (formato inválido)` : '')]),
          dupCount ? el('div', { class: 'text-xs text-amber mt-8' }, `⚠ ${dupCount} possível(is) duplicata(s) já lançada(s) neste cartão`) : null,
          paymentCount ? el('div', { class: 'text-xs text-blue mt-8' }, `ℹ ${paymentCount} pagamento(s) de fatura identificado(s) — não são compras e não entram no total`) : null,
          el('div', { class: 'flex justify-between mt-8', style: 'font-weight:700' }, [el('span', {}, `${toImport.length} serão importados`), el('span', { class: 'money-sm' }, fmtMoney(total))]),
        ]));

        const list = el('div', { class: 'list mt-8', style: 'max-height:220px;overflow-y:auto' });
        rows.slice(0, 40).forEach((r) => {
          const excluded = !activeFilter(r);
          const isInstallmentRow = r.installmentNumber && r.installmentTotal;
          list.appendChild(el('div', { class: 'list-item glass-soft', style: excluded ? 'opacity:.45' : '' }, [
            UI.iconChip(r.isPayment ? '💵' : isInstallmentRow ? '📅' : (r.amount < 0 ? '↩️' : '🧾'), r.isPayment ? '#3f6fe0' : (r.amount < 0 ? '#17a06b' : '#3f6fe0')),
            el('div', { class: 'li-main' }, [
              el('div', { class: 'li-title' }, isInstallmentRow ? r.baseTitle : r.title),
              el('div', { class: 'li-sub' }, [
                UI.fmtDate(r.date),
                isInstallmentRow ? el('span', { class: 'tag', style: '--tag-color:#3f6fe0' }, `PARCELA ${r.installmentNumber}/${r.installmentTotal}`) : null,
                r.duplicate ? el('span', { class: 'tag tag-reversal' }, 'DUPLICATA') : null,
                r.isPayment ? el('span', { class: 'tag', style: '--tag-color:#3f6fe0' }, 'PAGAMENTO') : null,
              ]),
            ]),
            el('div', { class: 'li-value' }, fmtMoney(r.amount)),
          ]));
        });
        if (rows.length > 40) list.appendChild(el('div', { class: 'text-xs text-muted', style: 'text-align:center;padding:8px' }, `+ ${rows.length - 40} outro(s) lançamento(s)`));
        summaryWrap.appendChild(list);
      }

      cardSelect.addEventListener('change', recomputeDuplicates);
      ignoreDupCheck.addEventListener('change', renderSummary);
      ignorePaymentCheck.addEventListener('change', renderSummary);
      recomputeDuplicates();

      resultWrap.appendChild(el('div', { class: 'field mt-14' }, [el('label', {}, 'Cartão'), cardSelect]));
      resultWrap.appendChild(el('div', { class: 'field' }, [
        el('label', {}, 'Fatura de referência (mês em que esta fatura vence)'),
        el('div', { class: 'form-row' }, [monthSel, yearSel]),
      ]));
      resultWrap.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Categoria padrão para os lançamentos importados'), catSelect]));
      resultWrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'flex items-center gap-8' }, [ignoreDupCheck, 'Ignorar possíveis duplicatas'])]));
      resultWrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'flex items-center gap-8' }, [ignorePaymentCheck, 'Ignorar pagamentos de fatura (não são compras)'])]));
      resultWrap.appendChild(el('div', { class: 'text-xs text-muted mb-8' }, 'Linhas com "Parcela N/M" são reconhecidas automaticamente como compras parceladas: o nome fica sem o sufixo e as demais parcelas são geradas/vinculadas à série.'));
      resultWrap.appendChild(summaryWrap);
      resultWrap.appendChild(el('button', {
        class: 'btn btn-primary btn-block mt-14',
        onclick: async () => {
          const invoiceMonth = `${yearSel.value}-${String(monthSel.value).padStart(2, '0')}`;
          const toImport = rows.filter(activeFilter);
          if (!toImport.length) { UI.toast('Nada para importar.', 'error'); return; }
          try {
            const res = await Store.importCardStatement({ cardId: cardSelect.value, invoiceMonth, rows: toImport, defaultCategory: catSelect.value || null });
            const parts = [];
            if (res.seriesCreated) parts.push(`${res.seriesCreated} série(s) parcelada(s) criada(s)`);
            if (res.seriesLinked) parts.push(`${res.seriesLinked} parcela(s) vinculada(s) a séries existentes`);
            if (res.singleCount) parts.push(`${res.singleCount} lançamento(s) avulso(s)`);
            UI.toast(`Importado na fatura de ${Calc.monthLabel(invoiceMonth)}: ${parts.join(', ')}.`, 'success');
            modal.close();
            // navega para o mês/cartão da fatura importada — senão o usuário continuaria
            // vendo o mês selecionado anteriormente e pareceria que nada aconteceu.
            App.state.currentMonth = invoiceMonth;
            App.navigate('cardDetail', { id: cardSelect.value });
          } catch (err) {
            UI.toast('Erro ao importar: ' + err.message, 'error');
          }
        },
      }, 'Importar lançamentos'));
    }
  }

  // ---------------- Menu de ação rápida (FAB) ----------------
  function openQuickAddMenu(onSaved) {
    const body = el('div', { class: 'flex-col gap-8' }, [
      el('button', { class: 'list-item glass-soft', onclick: () => { UI.closeTopModal(); openTransactionForm('income', null, onSaved); } }, [
        UI.iconChip('💰', '#17a06b'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, 'Nova receita'), el('div', { class: 'li-sub' }, 'Salário, rendimento, aluguel recebido...')]),
      ]),
      el('button', { class: 'list-item glass-soft', onclick: () => { UI.closeTopModal(); openTransactionForm('expense', null, onSaved); } }, [
        UI.iconChip('🧾', '#e0393e'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, 'Nova despesa'), el('div', { class: 'li-sub' }, 'Contas, aluguel, escola...')]),
      ]),
      el('button', { class: 'list-item glass-soft', onclick: () => { UI.closeTopModal(); openCardPurchaseForm(null, onSaved); } }, [
        UI.iconChip('💳', '#3f6fe0'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, 'Nova compra no cartão'), el('div', { class: 'li-sub' }, 'Única, parcelada, assinatura ou estorno (valor negativo)')]),
      ]),
      el('button', { class: 'list-item glass-soft', onclick: () => { UI.closeTopModal(); openImportInvoiceForm(null, onSaved); } }, [
        UI.iconChip('📄', '#17a06b'),
        el('div', { class: 'li-main' }, [el('div', { class: 'li-title' }, 'Importar fatura (CSV)'), el('div', { class: 'li-sub' }, 'Lança todos os itens de um extrato de cartão')]),
      ]),
    ]);
    UI.openModal({ title: 'Nova movimentação', content: body, size: 'sm' });
  }

  // ---------------- Repetir lançamentos ----------------
  // Lista receitas/despesas de meses anteriores (a mais recente ocorrência de cada
  // descrição), excluindo o que já existe no mês atual, para o usuário selecionar em
  // lote o que deseja relançar neste mês.
  function openRepeatTransactionsForm(type, onSaved) {
    const month = App.state.currentMonth;
    const label = type === 'income' ? 'receitas' : 'despesas';

    const currentDescriptions = new Set(
      Store.cache.transactions.filter((t) => t.type === type && t.monthRef === month).map((t) => t.description.trim().toLowerCase())
    );
    const byDesc = new Map();
    Store.cache.transactions.filter((t) => t.type === type && t.monthRef !== month).forEach((t) => {
      const key = t.description.trim().toLowerCase();
      const prev = byDesc.get(key);
      if (!prev || t.date > prev.date) byDesc.set(key, t);
    });
    const candidates = [...byDesc.values()]
      .filter((t) => !currentDescriptions.has(t.description.trim().toLowerCase()))
      .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'));

    if (!candidates.length) {
      UI.toast(`Nenhuma ${type === 'income' ? 'receita' : 'despesa'} anterior disponível para repetir.`, 'info');
      return;
    }

    const checkboxRefs = [];
    const listWrap = el('div', { class: 'list', style: 'max-height:360px;overflow-y:auto' });
    candidates.forEach((t) => {
      const cat = Store.cache.categories.find((c) => c.id === t.category);
      const cb = el('input', { type: 'checkbox' });
      checkboxRefs.push({ cb, t });
      listWrap.appendChild(el('div', { class: 'list-item glass-soft' }, [
        cb,
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, t.description),
          el('div', { class: 'li-sub' }, [cat ? `${cat.icon} ${cat.name}` : 'Sem categoria', ` · última vez em ${Calc.monthLabel(t.monthRef)}`]),
        ]),
        el('div', { class: 'li-value' }, fmtMoney(t.amount)),
      ]));
    });

    const selectAll = el('input', { type: 'checkbox', onchange: (e) => { checkboxRefs.forEach((r) => { r.cb.checked = e.target.checked; }); } });

    const body = el('div', { class: 'flex-col' }, [
      el('div', { class: 'text-xs text-muted mb-8' }, `Selecione quais ${label} de meses anteriores você quer repetir em ${Calc.monthLabel(month)}.`),
      el('div', { class: 'list-item glass-soft', style: 'margin-bottom:8px' }, [selectAll, el('div', { class: 'li-main' }, el('div', { class: 'li-title' }, 'Selecionar todos'))]),
      listWrap,
      el('button', {
        class: 'btn btn-primary btn-block mt-14',
        onclick: async () => {
          const selected = checkboxRefs.filter((r) => r.cb.checked).map((r) => r.t);
          if (!selected.length) { UI.toast('Selecione ao menos um lançamento.', 'error'); return; }
          const [y, m] = month.split('-').map(Number);
          const maxDay = new Date(y, m, 0).getDate();
          for (const t of selected) {
            const originalDay = parseInt(t.date.slice(8, 10), 10);
            const useDay = Math.min(originalDay, maxDay);
            await Store.createTransaction({
              type, description: t.description, amount: t.amount, date: `${month}-${String(useDay).padStart(2, '0')}`,
              category: t.category, person: t.person, status: 'planned', note: t.note || '', tags: [],
              recurrence: { mode: 'none' },
            });
          }
          UI.toast(`${selected.length} lançamento(s) repetido(s) em ${Calc.monthLabel(month)}.`, 'success');
          modal.close();
          onSaved && onSaved();
        },
      }, 'Repetir selecionados'),
    ]);
    const modal = UI.openModal({ title: `Repetir ${label}`, content: body, size: 'md' });
  }

  return {
    openTransactionForm, openCardPurchaseForm, openSingleInstallmentEditForm,
    openCardForm, openPersonForm, openCategoryForm, openImportInvoiceForm, openQuickAddMenu, openRepeatTransactionsForm,
  };
})();

window.Forms = Forms;
