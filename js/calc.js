// calc.js — Motor central de cálculo financeiro.
// TODA lógica de soma, fatura, parcela, divisão e saldo projetado passa por aqui.
// Isso evita duplicidade de valores e cálculos espalhados pelo código (requisito do projeto).

const Calc = (() => {

  // ---------- Utilidades de data / mês ----------

  function pad2(n) { return String(n).padStart(2, '0'); }

  function monthRefOf(dateStr) {
    // dateStr: 'YYYY-MM-DD' -> 'YYYY-MM'
    return dateStr.slice(0, 7);
  }

  function addMonths(monthRef, n) {
    // monthRef 'YYYY-MM'
    const [y, m] = monthRef.split('-').map(Number);
    const total = (y * 12 + (m - 1)) + n;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${pad2(nm)}`;
  }

  function daysInMonth(year, month1to12) {
    return new Date(year, month1to12, 0).getDate();
  }

  function monthLabel(monthRef) {
    const [y, m] = monthRef.split('-').map(Number);
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${names[m - 1]} de ${y}`;
  }

  function currentMonthRef() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // ---------- Motor de faturamento (fechamento/vencimento do cartão) ----------
  // Decisão de arquitetura (revisada): `invoiceMonth` — a chave usada em todo o app
  // (Dashboard, seletor de mês, agrupamento de parcelas) — representa o mês de
  // VENCIMENTO da fatura, não o mês em que ela fecha. É isso que importa para
  // planejamento: "quanto vou pagar em agosto" precisa incluir toda fatura que
  // VENCE em agosto, mesmo que tenha fechado ainda em julho.
  //
  // Passo 1: dado a data da compra, descobre o mês de FECHAMENTO da fatura que a
  // engloba (compra até o dia de fechamento → fecha no mês da própria compra;
  // depois do fechamento → fecha no mês seguinte).
  // Passo 2: a partir do mês de fechamento, descobre o mês de VENCIMENTO (se o dia
  // de vencimento for menor ou igual ao dia de fechamento, o vencimento cai no mês
  // seguinte ao fechamento — ex: fecha dia 27, vence dia 4 do mês seguinte).

  function closingMonthForPurchase(card, purchaseDateStr) {
    const d = new Date(purchaseDateStr + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const closingDay = Math.min(card.closingDay, daysInMonth(y, m));
    let closingMonth = `${y}-${pad2(m)}`;
    if (day > closingDay) {
      closingMonth = addMonths(closingMonth, 1);
    }
    return closingMonth;
  }

  function dueMonthForClosingMonth(card, closingMonth) {
    return card.dueDay <= card.closingDay ? addMonths(closingMonth, 1) : closingMonth;
  }

  // invoiceMonth aqui é sempre o mês de VENCIMENTO (chave usada no resto do app).
  function invoiceDetailsForMonth(card, invoiceMonth) {
    const [dy, dm] = invoiceMonth.split('-').map(Number);
    const dueDay = Math.min(card.dueDay, daysInMonth(dy, dm));
    // mês de fechamento correspondente (apenas informativo/exibição)
    let closingMonth = card.dueDay <= card.closingDay ? addMonths(invoiceMonth, -1) : invoiceMonth;
    const [cy, cm] = closingMonth.split('-').map(Number);
    const closingDay = Math.min(card.closingDay, daysInMonth(cy, cm));
    return {
      invoiceMonth,
      closingMonth,
      closingDate: `${cy}-${pad2(cm)}-${pad2(closingDay)}`,
      dueDate: `${invoiceMonth}-${pad2(dueDay)}`,
    };
  }

  function invoiceForPurchase(card, purchaseDateStr) {
    const closingMonth = closingMonthForPurchase(card, purchaseDateStr);
    const invoiceMonth = dueMonthForClosingMonth(card, closingMonth);
    return invoiceDetailsForMonth(card, invoiceMonth);
  }

  // ---------- Divisão proporcional (splits) sem perda de centavos ----------
  // Distribui `total` entre `parts` (array de valores-alvo) preservando a soma exata.
  function distributeProportional(total, weights) {
    const sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW === 0) return weights.map(() => 0);
    const raw = weights.map((w) => (total * w) / sumW);
    const rounded = raw.map(round2);
    let diff = round2(total - rounded.reduce((a, b) => a + b, 0));
    // ajusta o resto (centavos) na maior parcela
    if (diff !== 0) {
      let idx = 0, max = -Infinity;
      rounded.forEach((v, i) => { if (v > max) { max = v; idx = i; } });
      rounded[idx] = round2(rounded[idx] + diff);
    }
    return rounded;
  }

  // splits do usuário no cadastro: [{personId: null|id, amount}] com amount somando ao total da compra
  // retorna splits proporcionais para uma parcela específica de valor `installmentAmount`
  function splitsForInstallment(purchaseSplits, purchaseTotal, installmentAmount) {
    if (!purchaseSplits || purchaseSplits.length === 0) {
      return [{ personId: null, amount: installmentAmount }];
    }
    const weights = purchaseSplits.map((s) => s.amount);
    const amounts = distributeProportional(installmentAmount, weights);
    return purchaseSplits.map((s, i) => ({ personId: s.personId, amount: amounts[i] }));
  }

  // ---------- Geração de parcelas/assinaturas a partir de uma compra ----------
  // horizon: quantos meses no futuro gerar para assinaturas indeterminadas
  const SUBSCRIPTION_HORIZON_MONTHS = 36;

  function generateInstallments(purchase, card) {
    const rows = [];
    const total = round2(purchase.amount);

    // Se o usuário definiu manualmente o mês de vencimento da fatura (substituindo o
    // cálculo automático pelo fechamento do cartão), usamos esse mês como âncora.
    const firstInvoiceOf = () => purchase.invoiceMonthOverride
      ? invoiceDetailsForMonth(card, purchase.invoiceMonthOverride)
      : invoiceForPurchase(card, purchase.purchaseDate);

    if (purchase.paymentType === 'single' || purchase.isReversal) {
      const inv = firstInvoiceOf();
      const splits = splitsForInstallment(purchase.splits, total, total);
      rows.push({
        id: DB.uid(),
        purchaseId: purchase.id,
        cardId: card.id,
        number: 1,
        totalInstallments: 1,
        amount: total,
        purchaseDate: purchase.purchaseDate,
        invoiceMonth: inv.invoiceMonth,
        invoiceDueDate: inv.dueDate,
        kind: purchase.isReversal ? 'reversal' : 'single',
        splits,
        status: 'planned',
      });
    } else if (purchase.paymentType === 'installments') {
      const n = Math.max(1, purchase.installmentsCount || 1);
      const baseAmount = round2(total / n);
      const amounts = new Array(n).fill(baseAmount);
      const diff = round2(total - amounts.reduce((a, b) => a + b, 0));
      amounts[n - 1] = round2(amounts[n - 1] + diff);

      const firstInv = firstInvoiceOf();
      // Em qual parcela a data informada se ancora — por padrão a 1ª, mas o usuário
      // pode indicar "já estou na parcela X" ao cadastrar uma compra retroativa que
      // esqueceu de lançar antes, sem precisar recuar a data até a parcela 1.
      const startAt = Math.min(Math.max(1, purchase.startInstallmentNumber || 1), n);
      // Divisão entre pessoas: usa alocação cumulativa para garantir que a soma das
      // parcelas de cada pessoa feche exatamente com o valor total dividido a ela
      // (evita perda/sobra de centavos por arredondamento parcela a parcela).
      const hasSplits = purchase.splits && purchase.splits.length > 0;
      const proportions = hasSplits ? purchase.splits.map((s) => s.amount / total) : [1];
      let prevCumulative = hasSplits ? purchase.splits.map(() => 0) : [0];
      let runningTotal = 0;

      for (let i = 0; i < n; i++) {
        const number = i + 1;
        const invoiceMonth = addMonths(firstInv.invoiceMonth, number - startAt);
        const inv = invoiceDetailsForMonth(card, invoiceMonth);
        runningTotal = round2(runningTotal + amounts[i]);

        let splits;
        if (hasSplits) {
          const isLast = i === n - 1;
          const cumulative = purchase.splits.map((s, idx) =>
            isLast ? s.amount : round2(runningTotal * proportions[idx])
          );
          splits = purchase.splits.map((s, idx) => ({
            personId: s.personId,
            amount: round2(cumulative[idx] - prevCumulative[idx]),
          }));
          prevCumulative = cumulative;
        } else {
          splits = [{ personId: null, amount: amounts[i] }];
        }
        rows.push({
          id: DB.uid(),
          purchaseId: purchase.id,
          cardId: card.id,
          number,
          totalInstallments: n,
          amount: amounts[i],
          purchaseDate: number === startAt ? purchase.purchaseDate : `${invoiceMonth}-01`,
          invoiceMonth: inv.invoiceMonth,
          invoiceDueDate: inv.dueDate,
          kind: 'installment',
          splits,
          status: 'planned',
        });
      }
    } else if (purchase.paymentType === 'subscription') {
      const firstInv = firstInvoiceOf();
      let horizonEnd = SUBSCRIPTION_HORIZON_MONTHS;
      if (purchase.subscriptionEndDate) {
        const endMonth = monthRefOf(purchase.subscriptionEndDate);
        // conta quantos meses de firstInv.invoiceMonth até endMonth
        const [y1, m1] = firstInv.invoiceMonth.split('-').map(Number);
        const [y2, m2] = endMonth.split('-').map(Number);
        horizonEnd = Math.max(0, (y2 * 12 + m2) - (y1 * 12 + m1));
      }
      for (let i = 0; i <= horizonEnd; i++) {
        const invoiceMonth = addMonths(firstInv.invoiceMonth, i);
        const inv = invoiceDetailsForMonth(card, invoiceMonth);
        const splits = splitsForInstallment(purchase.splits, total, total);
        rows.push({
          id: DB.uid(),
          purchaseId: purchase.id,
          cardId: card.id,
          number: i + 1,
          totalInstallments: purchase.subscriptionEndDate ? horizonEnd + 1 : null,
          amount: total,
          purchaseDate: purchase.purchaseDate,
          invoiceMonth: inv.invoiceMonth,
          invoiceDueDate: inv.dueDate,
          kind: 'subscription',
          splits,
          status: 'planned',
        });
      }
    }
    return rows;
  }

  // ---------- Resumo mensal (fonte única de verdade para o Dashboard) ----------
  // data = { transactions, purchases, installments, cards, people, reimbursements, categories }
  function computeMonthSummary(monthRef, data) {
    const txsOfMonth = data.transactions.filter((t) => t.monthRef === monthRef && t.status !== 'cancelled');
    const incomeTxs = txsOfMonth.filter((t) => t.type === 'income');
    const expenseTxs = txsOfMonth.filter((t) => t.type === 'expense');

    const incomeTotal = round2(incomeTxs.reduce((a, t) => a + t.amount, 0));
    const expenseTotal = round2(expenseTxs.reduce((a, t) => a + t.amount, 0));

    const instOfMonth = data.installments.filter((i) => i.invoiceMonth === monthRef && i.status !== 'cancelled');

    // total real da(s) fatura(s) do mês = soma de todos os lançamentos de cartão daquele mês
    // (estornos entram com valor negativo e reduzem o total automaticamente)
    const cardInvoiceTotal = round2(instOfMonth.reduce((a, i) => a + i.amount, 0));

    // por cartão
    const byCard = {};
    for (const card of data.cards) {
      const items = instOfMonth.filter((i) => i.cardId === card.id);
      byCard[card.id] = {
        card,
        total: round2(items.reduce((a, i) => a + i.amount, 0)),
        items,
      };
    }

    // responsabilidade própria vs. terceiros dentro das faturas do mês
    let ownCardResponsibility = 0;
    let thirdPartyResponsibility = 0;
    const receivableByPerson = {};
    for (const inst of instOfMonth) {
      for (const sp of inst.splits) {
        if (sp.personId === null) {
          ownCardResponsibility += sp.amount;
        } else {
          thirdPartyResponsibility += sp.amount;
          receivableByPerson[sp.personId] = round2((receivableByPerson[sp.personId] || 0) + sp.amount);
        }
      }
    }
    ownCardResponsibility = round2(ownCardResponsibility);
    thirdPartyResponsibility = round2(thirdPartyResponsibility);

    // reembolsos efetivamente recebidos neste mês (pela data do reembolso, não da compra)
    const reimbursementsOfMonth = (data.reimbursements || []).filter((r) => monthRefOf(r.date) === monthRef);
    const reimbursementsThisMonth = round2(reimbursementsOfMonth.reduce((a, r) => a + r.amount, 0));

    // comprometido = despesas próprias + fatura total (dinheiro que efetivamente sai da conta)
    const committed = round2(expenseTotal + cardInvoiceTotal);

    // saldo projetado = receitas - despesas próprias - faturas totais dos cartões
    const projectedBalance = round2(incomeTotal - expenseTotal - cardInvoiceTotal);

    // valores a receber de pessoas relativos a compras deste mês (informativo, não altera o saldo)
    const receivableThisMonth = thirdPartyResponsibility;

    return {
      monthRef,
      incomeTotal,
      expenseTotal,
      cardInvoiceTotal,
      committed,
      projectedBalance,
      ownCardResponsibility,
      thirdPartyResponsibility,
      receivableThisMonth,
      receivableByPerson,
      reimbursementsThisMonth,
      reimbursementsOfMonth,
      byCard,
      incomeTxs,
      expenseTxs,
      cardInstallments: instOfMonth,
    };
  }

  // ---------- Resumo por pessoa (dívidas e reembolsos) ----------
  function computePersonSummary(personId, data) {
    let totalDue = 0;
    const relatedInstallments = [];
    for (const inst of data.installments) {
      if (inst.status === 'cancelled') continue;
      for (const sp of inst.splits) {
        if (sp.personId === personId) {
          totalDue += sp.amount;
          relatedInstallments.push({ inst, amount: sp.amount });
        }
      }
    }
    totalDue = round2(totalDue);

    const reimbursements = data.reimbursements.filter((r) => r.personId === personId);
    const totalPaid = round2(reimbursements.reduce((a, r) => a + r.amount, 0));
    const pending = round2(totalDue - totalPaid);

    return { personId, totalDue, totalPaid, pending, relatedInstallments, reimbursements };
  }

  // ---------- Totais de cartão (limite usado, faturas) ----------
  function computeCardSummary(card, data, referenceMonth) {
    const items = data.installments.filter((i) => i.cardId === card.id && i.status !== 'cancelled');
    const currentInvoice = round2(
      items.filter((i) => i.invoiceMonth === referenceMonth).reduce((a, i) => a + i.amount, 0)
    );
    const nextMonth = addMonths(referenceMonth, 1);
    const nextInvoice = round2(
      items.filter((i) => i.invoiceMonth === nextMonth).reduce((a, i) => a + i.amount, 0)
    );
    const futureTotal = round2(
      items.filter((i) => i.invoiceMonth >= referenceMonth).reduce((a, i) => a + i.amount, 0)
    );
    // limite utilizado: soma de todas as faturas em aberto (mês atual em diante) — decisão de projeto
    const used = futureTotal;
    const available = round2((card.limit || 0) - used);

    // agrupar por mês a partir do mês de referência (futuro) para o gráfico de evolução
    const byMonth = {};
    for (const it of items) {
      if (it.invoiceMonth < referenceMonth) continue;
      byMonth[it.invoiceMonth] = round2((byMonth[it.invoiceMonth] || 0) + it.amount);
    }

    return { currentInvoice, nextInvoice, futureTotal, used, available, byMonth, items };
  }

  // ---------- Projeção de saldo para os próximos N meses ----------
  function computeProjection(startMonthRef, months, data) {
    const out = [];
    for (let i = 0; i < months; i++) {
      const m = addMonths(startMonthRef, i);
      const s = computeMonthSummary(m, data);
      out.push({ monthRef: m, projectedBalance: s.projectedBalance, incomeTotal: s.incomeTotal, committed: s.committed });
    }
    return out;
  }

  return {
    pad2, monthRefOf, addMonths, monthLabel, currentMonthRef, round2,
    invoiceForPurchase, invoiceDetailsForMonth,
    distributeProportional, splitsForInstallment,
    generateInstallments,
    computeMonthSummary, computePersonSummary, computeCardSummary, computeProjection,
  };
})();

window.Calc = Calc;
