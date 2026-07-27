// store.js — Repositório de operações de negócio + cache em memória + pub/sub simples.

const Store = (() => {
  const cache = {
    categories: [], people: [], cards: [], transactions: [], purchases: [],
    installments: [], reimbursements: [],
  };
  const listeners = new Set();

  function notify() { listeners.forEach((fn) => fn(cache)); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  async function loadAll() {
    const [categories, people, cards, transactions, purchases, installments, reimbursements] = await Promise.all([
      DB.getAll('categories'), DB.getAll('people'), DB.getAll('cards'),
      DB.getAll('transactions'), DB.getAll('purchases'), DB.getAll('installments'),
      DB.getAll('reimbursements'),
    ]);
    categories.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    Object.assign(cache, { categories, people, cards, transactions, purchases, installments, reimbursements });
    notify();
    return cache;
  }

  async function seedDefaultsIfEmpty() {
    if (cache.categories.length > 0) return;
    const defaults = [
      { name: 'Alimentação', icon: '🍽️', color: '#e07a5f' },
      { name: 'Moradia', icon: '🏠', color: '#3d5a80' },
      { name: 'Transporte', icon: '🚗', color: '#6d597a' },
      { name: 'Saúde', icon: '💊', color: '#e56b6f' },
      { name: 'Educação', icon: '🎓', color: '#457b9d' },
      { name: 'Lazer', icon: '🎮', color: '#f2a541' },
      { name: 'Assinaturas', icon: '📱', color: '#7b8cde' },
      { name: 'Eletrônicos', icon: '💻', color: '#4a5568' },
      { name: 'Vestuário', icon: '👕', color: '#c17c74' },
      { name: 'Impostos', icon: '📋', color: '#b56576' },
      { name: 'Outros', icon: '📦', color: '#8d99ae' },
    ];
    for (const c of defaults) await DB.add('categories', c);
    await loadAll();
  }

  // ---------- Categorias ----------
  async function saveCategory(obj) { await DB.add('categories', obj.id ? obj : obj); await loadAll(); }
  async function upsertCategory(obj) {
    if (obj.id) await DB.put('categories', obj); else await DB.add('categories', obj);
    await loadAll();
  }
  async function deleteCategory(id) { await DB.delete('categories', id); await loadAll(); }

  // ---------- Pessoas ----------
  async function upsertPerson(obj) {
    if (obj.id) await DB.put('people', obj); else await DB.add('people', obj);
    await loadAll();
  }
  async function deletePerson(id) { await DB.delete('people', id); await loadAll(); }

  // ---------- Cartões ----------
  async function upsertCard(obj) {
    if (obj.id) await DB.put('cards', obj); else await DB.add('cards', obj);
    await loadAll();
  }
  async function deleteCard(id) {
    const purchases = cache.purchases.filter((p) => p.cardId === id);
    for (const p of purchases) await deletePurchase(p.id, 'series');
    await DB.delete('cards', id);
    await loadAll();
  }

  // ---------- Transações simples (receita/despesa) ----------
  // recurrence: { mode: 'none' | 'recurring' | 'fixed_period', endDate }
  async function createTransaction(obj) {
    const recurrence = obj.recurrence || { mode: 'none' };
    delete obj.recurrence;
    const seriesId = recurrence.mode === 'none' ? null : DB.uid();
    const baseMonth = Calc.monthRefOf(obj.date);

    const toCreate = [];
    if (recurrence.mode === 'none') {
      toCreate.push({ ...obj, monthRef: baseMonth, seriesId: null });
    } else if (recurrence.mode === 'recurring') {
      const horizon = 24;
      for (let i = 0; i < horizon; i++) {
        const m = Calc.addMonths(baseMonth, i);
        const day = obj.date.slice(8, 10);
        toCreate.push({ ...obj, date: `${m}-${day}`, monthRef: m, seriesId, seriesIndex: i });
      }
    } else if (recurrence.mode === 'fixed_period') {
      const endMonth = Calc.monthRefOf(recurrence.endDate);
      const [y1, m1] = baseMonth.split('-').map(Number);
      const [y2, m2] = endMonth.split('-').map(Number);
      const count = Math.max(0, (y2 * 12 + m2) - (y1 * 12 + m1)) + 1;
      const day = obj.date.slice(8, 10);
      for (let i = 0; i < count; i++) {
        const m = Calc.addMonths(baseMonth, i);
        toCreate.push({ ...obj, date: `${m}-${day}`, monthRef: m, seriesId, seriesIndex: i });
      }
    }
    for (const t of toCreate) await DB.add('transactions', t);
    await loadAll();
  }

  async function updateTransaction(obj, scope = 'only') {
    // scope: 'only' | 'future' | 'all' (para séries recorrentes)
    if (!obj.seriesId || scope === 'only') {
      await DB.put('transactions', obj);
    } else {
      const series = cache.transactions.filter((t) => t.seriesId === obj.seriesId);
      const targets = scope === 'future'
        ? series.filter((t) => t.seriesIndex >= obj.seriesIndex)
        : series;
      for (const t of targets) {
        await DB.put('transactions', { ...t, description: obj.description, amount: obj.amount, category: obj.category, person: obj.person, note: obj.note, tags: obj.tags });
      }
    }
    await loadAll();
  }

  async function deleteTransaction(id, scope = 'only') {
    const t = cache.transactions.find((x) => x.id === id);
    if (!t) return;
    if (!t.seriesId || scope === 'only') {
      await DB.delete('transactions', id);
    } else {
      const series = cache.transactions.filter((x) => x.seriesId === t.seriesId);
      const targets = scope === 'future' ? series.filter((x) => x.seriesIndex >= t.seriesIndex) : series;
      await DB.deleteMany('transactions', targets.map((x) => x.id));
    }
    await loadAll();
  }

  // ---------- Compras no cartão (única / parcelada / assinatura) ----------
  async function createCardPurchase(purchase) {
    const card = cache.cards.find((c) => c.id === purchase.cardId);
    if (!card) throw new Error('Cartão não encontrado');
    purchase.id = purchase.id || DB.uid();
    const installments = Calc.generateInstallments(purchase, card);
    await DB.add('purchases', purchase);
    await DB.putMany('installments', installments);
    await loadAll();
    return purchase;
  }

  // scope: 'series' (regenera tudo) | 'future' (mantém passado, regenera a partir de pivotMonth)
  // pivotMonth: mês (YYYY-MM) a partir do qual a edição se aplica — deve ser o mês da
  // parcela que o usuário estava vendo ao editar, não necessariamente o mês corrente real.
  async function updateCardPurchase(purchase, scope = 'series', pivotMonth = null) {
    const card = cache.cards.find((c) => c.id === purchase.cardId);
    if (!card) throw new Error('Cartão não encontrado');
    purchase.updatedAt = new Date().toISOString();
    await DB.put('purchases', purchase);

    const oldInstallments = cache.installments.filter((i) => i.purchaseId === purchase.id);

    if (scope === 'series') {
      await DB.deleteMany('installments', oldInstallments.map((i) => i.id));
      const fresh = Calc.generateInstallments(purchase, card);
      await DB.putMany('installments', fresh);
    } else if (scope === 'future') {
      const cutoff = pivotMonth || Calc.currentMonthRef();
      const toRemove = oldInstallments.filter((i) => i.invoiceMonth >= cutoff);
      await DB.deleteMany('installments', toRemove.map((i) => i.id));
      const fresh = Calc.generateInstallments(purchase, card).filter((i) => i.invoiceMonth >= cutoff);
      await DB.putMany('installments', fresh);
    }
    await loadAll();
  }

  async function updateSingleInstallment(installment) {
    await DB.put('installments', installment);
    await loadAll();
  }

  async function deletePurchase(purchaseId, scope = 'series', installmentId = null) {
    if (scope === 'installment' && installmentId) {
      await DB.delete('installments', installmentId);
    } else {
      const installments = cache.installments.filter((i) => i.purchaseId === purchaseId);
      await DB.deleteMany('installments', installments.map((i) => i.id));
      await DB.delete('purchases', purchaseId);
    }
    await loadAll();
  }

  // cancela assinatura: remove parcelas futuras (>= mês informado), preserva histórico
  async function cancelSubscription(purchaseId, fromMonthRef) {
    const purchase = cache.purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;
    purchase.active = false;
    purchase.subscriptionEndDate = `${fromMonthRef}-01`;
    await DB.put('purchases', purchase);
    const toRemove = cache.installments.filter((i) => i.purchaseId === purchaseId && i.invoiceMonth >= fromMonthRef);
    await DB.deleteMany('installments', toRemove.map((i) => i.id));
    await loadAll();
  }

  // ---------- Importação de fatura via CSV ----------
  // As linhas já pertencem a uma fatura conhecida (informada pelo usuário/arquivo),
  // então o mês/vencimento da fatura são atribuídos diretamente, sem recalcular
  // pelo motor de fechamento (que é usado para compras lançadas manualmente).
  // Importação de fatura via CSV: linhas que indicam "Parcela N/M" viram uma compra
  // parcelada de verdade (não uma compra avulsa) — a descrição é gravada sem o sufixo
  // de parcela, e o total/demais parcelas são estimados a partir do valor e posição
  // desta parcela. Se já existir uma série compatível no cartão, a parcela é apenas
  // vinculada a ela (evitando duplicar a série a cada fatura importada).
  async function importCardStatement({ cardId, invoiceMonth, rows, defaultCategory }) {
    const card = cache.cards.find((c) => c.id === cardId);
    if (!card) throw new Error('Cartão não encontrado.');
    const inv = Calc.invoiceDetailsForMonth(card, invoiceMonth);

    const newPurchases = [];
    const newInstallments = [];
    let seriesCreated = 0, seriesLinked = 0, singleCount = 0;

    // cartões locais (cache + recém-criados nesta importação) para detectar séries já existentes
    const purchasePool = [...cache.purchases];
    const installmentPool = [...cache.installments, ...newInstallments];

    // Encontra uma série compatível: mesma descrição-base + nº de parcelas E valor por
    // parcela compatível. Isso evita fundir duas compras diferentes que coincidentemente
    // têm o mesmo nome de estabelecimento e a mesma quantidade de parcelas (ex: duas
    // compras distintas na mesma loja, ambas parceladas em 4x).
    function findMatchingSeries(baseTitle, installmentTotal, rowAmount) {
      const candidates = purchasePool.filter((p) =>
        p.cardId === cardId && p.paymentType === 'installments' &&
        p.description === baseTitle && p.installmentsCount === installmentTotal);
      return candidates.find((p) => Math.abs(Calc.round2(p.amount) / installmentTotal - rowAmount) < 0.02);
    }

    for (const row of rows) {
      if (row.installmentNumber && row.installmentTotal) {
        const baseTitle = row.baseTitle || row.title;
        const existingSeries = findMatchingSeries(baseTitle, row.installmentTotal, row.amount);

        if (existingSeries) {
          // já existe a série (de uma importação/edição anterior) — só garante que esta
          // parcela específica exista, sem recriar a compra nem as demais parcelas.
          const already = cache.installments.some((i) => i.purchaseId === existingSeries.id && i.number === row.installmentNumber);
          if (!already) {
            const monthN = inv.invoiceMonth; // esta linha já nos diz exatamente o mês desta parcela
            const invN = Calc.invoiceDetailsForMonth(card, monthN);
            newInstallments.push({
              id: DB.uid(), purchaseId: existingSeries.id, cardId, number: row.installmentNumber,
              totalInstallments: row.installmentTotal, amount: row.amount, purchaseDate: row.date,
              invoiceMonth: invN.invoiceMonth, invoiceDueDate: invN.dueDate, kind: 'installment',
              splits: [{ personId: null, amount: row.amount }], status: 'planned',
            });
          }
          seriesLinked++;
          continue;
        }

        // cria a série inteira (N parcelas), ancorada nesta parcela específica: como
        // sabemos com certeza o mês de vencimento desta ocorrência (parcela row.installmentNumber),
        // as demais são posicionadas por deslocamento de meses a partir dela — sem depender
        // do motor de fechamento/data de compra (que não temos com exatidão).
        const totalEstimate = Calc.round2(row.amount * row.installmentTotal);
        const purchase = {
          id: DB.uid(),
          cardId,
          description: baseTitle,
          amount: totalEstimate,
          purchaseDate: row.date,
          category: defaultCategory || null,
          note: `Importado de fatura CSV — parcela ${row.installmentNumber}/${row.installmentTotal} confirmada; demais parcelas estimadas com o mesmo valor.`,
          paymentType: 'installments',
          installmentsCount: row.installmentTotal,
          splits: [],
          active: true,
          source: 'csv-import',
        };
        const firstInvoiceMonth = Calc.addMonths(inv.invoiceMonth, -(row.installmentNumber - 1));
        for (let n = 1; n <= row.installmentTotal; n++) {
          const monthN = Calc.addMonths(firstInvoiceMonth, n - 1);
          const invN = Calc.invoiceDetailsForMonth(card, monthN);
          newInstallments.push({
            id: DB.uid(), purchaseId: purchase.id, cardId, number: n,
            totalInstallments: row.installmentTotal, amount: row.amount,
            purchaseDate: n === row.installmentNumber ? row.date : monthN + '-01',
            invoiceMonth: invN.invoiceMonth, invoiceDueDate: invN.dueDate, kind: 'installment',
            splits: [{ personId: null, amount: row.amount }], status: 'planned',
          });
        }
        newPurchases.push(purchase);
        purchasePool.push(purchase);
        seriesCreated++;
      } else {
        // compra única, assinatura não identificável isoladamente, estorno ou pagamento —
        // tratada como lançamento avulso, como antes.
        const purchase = {
          id: DB.uid(),
          cardId,
          description: row.title,
          amount: Math.abs(row.amount),
          purchaseDate: row.date,
          category: defaultCategory || null,
          note: 'Importado de extrato/fatura CSV',
          paymentType: 'single',
          splits: [],
          active: true,
          isReversal: row.amount < 0,
          source: 'csv-import',
        };
        newPurchases.push(purchase);
        newInstallments.push({
          id: DB.uid(),
          purchaseId: purchase.id,
          cardId,
          number: 1,
          totalInstallments: 1,
          amount: row.amount,
          purchaseDate: row.date,
          invoiceMonth: inv.invoiceMonth,
          invoiceDueDate: inv.dueDate,
          kind: row.amount < 0 ? 'reversal' : 'single',
          splits: [{ personId: null, amount: row.amount }],
          status: 'planned',
        });
        singleCount++;
      }
    }

    await DB.putMany('purchases', newPurchases);
    await DB.putMany('installments', newInstallments);
    await loadAll();
    return { count: rows.length, seriesCreated, seriesLinked, singleCount };
  }

  // ---------- Reset de dados ----------
  // Reseta apenas um mês: remove receitas/despesas daquele mês, remove lançamentos de
  // cartão daquele mês (mantendo o resto da série de parcelas/assinaturas intacto —
  // só a compra "avulsa" cujo único lançamento é aquele mês é removida por completo)
  // e remove reembolsos registrados naquele mês.
  async function resetMonth(monthRef) {
    const txToRemove = cache.transactions.filter((t) => t.monthRef === monthRef);
    await DB.deleteMany('transactions', txToRemove.map((t) => t.id));

    const monthInstallments = cache.installments.filter((i) => i.invoiceMonth === monthRef);
    const purchasesToFullyDelete = new Set();
    const installmentsToRemoveOnly = [];
    for (const inst of monthInstallments) {
      const purchase = cache.purchases.find((p) => p.id === inst.purchaseId);
      if (!purchase || purchase.paymentType === 'single') {
        if (purchase) purchasesToFullyDelete.add(purchase.id);
        else installmentsToRemoveOnly.push(inst.id);
      } else {
        installmentsToRemoveOnly.push(inst.id);
      }
    }
    for (const purchaseId of purchasesToFullyDelete) {
      const relatedInstallments = cache.installments.filter((i) => i.purchaseId === purchaseId).map((i) => i.id);
      await DB.deleteMany('installments', relatedInstallments);
      await DB.delete('purchases', purchaseId);
    }
    if (installmentsToRemoveOnly.length) await DB.deleteMany('installments', installmentsToRemoveOnly);

    const reimbToRemove = cache.reimbursements.filter((r) => Calc.monthRefOf(r.date) === monthRef);
    await DB.deleteMany('reimbursements', reimbToRemove.map((r) => r.id));

    await loadAll();
    return {
      transactions: txToRemove.length,
      cardLaunches: monthInstallments.length,
      purchasesRemoved: purchasesToFullyDelete.size,
      reimbursements: reimbToRemove.length,
    };
  }

  // Reset total: apaga TODOS os dados do aplicativo e recria as categorias padrão.
  async function resetAll() {
    await DB.clearAll();
    Object.assign(cache, { categories: [], people: [], cards: [], transactions: [], purchases: [], installments: [], reimbursements: [] });
    await seedDefaultsIfEmpty();
    await loadAll();
  }

  // ---------- Import / Export ----------
  async function exportJSON() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        categories: cache.categories, people: cache.people, cards: cache.cards,
        transactions: cache.transactions, purchases: cache.purchases,
        installments: cache.installments, reimbursements: cache.reimbursements,
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  async function importJSON(jsonText, mode = 'merge') {
    const payload = JSON.parse(jsonText);
    if (!payload || !payload.data) throw new Error('Arquivo inválido: estrutura não reconhecida.');
    const d = payload.data;
    const requiredArrays = ['categories', 'people', 'cards', 'transactions', 'purchases', 'installments', 'reimbursements'];
    for (const key of requiredArrays) {
      if (d[key] && !Array.isArray(d[key])) throw new Error(`Campo inválido no backup: ${key}`);
    }
    if (mode === 'replace') await DB.clearAll();
    for (const key of requiredArrays) {
      if (Array.isArray(d[key]) && d[key].length) await DB.putMany(key, d[key]);
    }
    await loadAll();
  }

  function toCSV(rows, columns) {
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const header = columns.map((c) => c.label).join(';');
    const lines = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(';'));
    return [header, ...lines].join('\n');
  }

  return {
    cache, subscribe, loadAll, seedDefaultsIfEmpty,
    upsertCategory, deleteCategory,
    upsertPerson, deletePerson,
    upsertCard, deleteCard,
    createTransaction, updateTransaction, deleteTransaction,
    createCardPurchase, updateCardPurchase, updateSingleInstallment, deletePurchase, cancelSubscription,
    importCardStatement,
    resetMonth, resetAll,
    exportJSON, importJSON, toCSV,
  };
})();

window.Store = Store;
