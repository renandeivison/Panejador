// tests.js — Rotina interna de testes para os cenários financeiros do projeto.
// Executada via tela Configurações > "Executar testes internos".

const InternalTests = (() => {
  const results = [];

  function assert(name, condition, detail) {
    results.push({ name, pass: !!condition, detail });
  }

  function eq(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }

  function makeCard(over = {}) {
    return Object.assign({ id: 'card1', name: 'Cartão Teste', limit: 5000, closingDay: 10, dueDay: 17 }, over);
  }

  function run() {
    results.length = 0;

    // ---- Cenário 1: receita 5000, despesa própria 1000, compra própria no cartão 2000 ----
    {
      const card = makeCard();
      const purchase = { id: 'p1', cardId: card.id, amount: 2000, purchaseDate: '2026-08-05', paymentType: 'single', splits: [] };
      const installments = Calc.generateInstallments(purchase, card);
      const data = {
        transactions: [
          { id: 't1', type: 'income', amount: 5000, monthRef: '2026-08' },
          { id: 't2', type: 'expense', amount: 1000, monthRef: '2026-08' },
        ],
        purchases: [purchase],
        installments,
        cards: [card],
        people: [],
        reimbursements: [],
      };
      const summary = Calc.computeMonthSummary('2026-08', data);
      assert('Cenário 1: saldo projetado = 2000', eq(summary.projectedBalance, 2000), summary.projectedBalance);
      assert('Cenário 1: fatura do cartão = 2000', eq(summary.cardInvoiceTotal, 2000), summary.cardInvoiceTotal);
    }

    // ---- Cenário 2: compra 2000 dividida (própria 1200 / mãe 800) ----
    {
      const card = makeCard();
      const purchase = {
        id: 'p2', cardId: card.id, amount: 2000, purchaseDate: '2026-08-05', paymentType: 'single',
        splits: [{ personId: null, amount: 1200 }, { personId: 'mae', amount: 800 }],
      };
      const installments = Calc.generateInstallments(purchase, card);
      const data = {
        transactions: [
          { id: 't1', type: 'income', amount: 5000, monthRef: '2026-08' },
          { id: 't2', type: 'expense', amount: 1000, monthRef: '2026-08' },
        ],
        purchases: [purchase], installments, cards: [card], people: [{ id: 'mae', name: 'Mãe' }], reimbursements: [],
      };
      const summary = Calc.computeMonthSummary('2026-08', data);
      const person = Calc.computePersonSummary('mae', data);
      assert('Cenário 2: fatura = 2000', eq(summary.cardInvoiceTotal, 2000), summary.cardInvoiceTotal);
      assert('Cenário 2: minha responsabilidade = 1200', eq(summary.ownCardResponsibility, 1200), summary.ownCardResponsibility);
      assert('Cenário 2: a receber = 800', eq(summary.thirdPartyResponsibility, 800), summary.thirdPartyResponsibility);
      assert('Cenário 2: mãe deve 800', eq(person.totalDue, 800), person.totalDue);
      // saldo = 5000 (receita) + 800 (a receber, recebimento garantido) - 1000 (despesa) - 2000 (fatura) = 2800
      assert('Cenário 2: saldo projetado soma o a receber = 2800', eq(summary.projectedBalance, 2800), summary.projectedBalance);
    }

    // ---- Cenário 3: compra 1000 dividida em 3 (mãe 400 / irmão 300 / eu 300) ----
    {
      const card = makeCard();
      const purchase = {
        id: 'p3', cardId: card.id, amount: 1000, purchaseDate: '2026-08-05', paymentType: 'single',
        splits: [{ personId: 'mae', amount: 400 }, { personId: 'irmao', amount: 300 }, { personId: null, amount: 300 }],
      };
      const installments = Calc.generateInstallments(purchase, card);
      const data = {
        transactions: [], purchases: [purchase], installments, cards: [card],
        people: [{ id: 'mae', name: 'Mãe' }, { id: 'irmao', name: 'Irmão' }], reimbursements: [],
      };
      const summary = Calc.computeMonthSummary('2026-08', data);
      assert('Cenário 3: fatura = 1000', eq(summary.cardInvoiceTotal, 1000), summary.cardInvoiceTotal);
      assert('Cenário 3: terceiros = 700', eq(summary.thirdPartyResponsibility, 700), summary.thirdPartyResponsibility);
      assert('Cenário 3: minha responsabilidade = 300', eq(summary.ownCardResponsibility, 300), summary.ownCardResponsibility);
    }

    // ---- Cenário 4: compra 500 + estorno -200 = fatura líquida 300 ----
    {
      const card = makeCard();
      const purchase = { id: 'p4', cardId: card.id, amount: 500, purchaseDate: '2026-08-05', paymentType: 'single', splits: [] };
      const reversal = { id: 'r4', cardId: card.id, amount: -200, purchaseDate: '2026-08-07', paymentType: 'single', isReversal: true, linkedPurchaseId: 'p4', splits: [] };
      const installments = [...Calc.generateInstallments(purchase, card), ...Calc.generateInstallments(reversal, card)];
      const data = { transactions: [], purchases: [purchase, reversal], installments, cards: [card], people: [], reimbursements: [] };
      const summary = Calc.computeMonthSummary('2026-08', data);
      assert('Cenário 4: fatura líquida = 300', eq(summary.cardInvoiceTotal, 300), summary.cardInvoiceTotal);
    }

    // ---- Parcelamento: 1200 em 6x = 200 cada, soma exata ----
    {
      const card = makeCard();
      const purchase = { id: 'p5', cardId: card.id, amount: 1200, purchaseDate: '2026-08-05', paymentType: 'installments', installmentsCount: 6, splits: [] };
      const installments = Calc.generateInstallments(purchase, card);
      const sum = Calc.round2(installments.reduce((a, i) => a + i.amount, 0));
      assert('Parcelamento: 6 parcelas geradas', installments.length === 6, installments.length);
      assert('Parcelamento: soma = 1200', eq(sum, 1200), sum);
      assert('Parcelamento: cada parcela = 200', installments.every((i) => eq(i.amount, 200)), JSON.stringify(installments.map((i) => i.amount)));
    }

    // ---- Parcelamento com divisão e arredondamento: 1200 em 6x, própria 800 / mãe 400 ----
    {
      const card = makeCard();
      const purchase = {
        id: 'p6', cardId: card.id, amount: 1200, purchaseDate: '2026-08-05', paymentType: 'installments', installmentsCount: 6,
        splits: [{ personId: null, amount: 800 }, { personId: 'mae', amount: 400 }],
      };
      const installments = Calc.generateInstallments(purchase, card);
      const ownSum = Calc.round2(installments.reduce((a, i) => a + i.splits.find((s) => s.personId === null).amount, 0));
      const maeSum = Calc.round2(installments.reduce((a, i) => a + i.splits.find((s) => s.personId === 'mae').amount, 0));
      assert('Parcelamento dividido: soma própria = 800', eq(ownSum, 800), ownSum);
      assert('Parcelamento dividido: soma mãe = 400', eq(maeSum, 400), maeSum);
    }

    // ---- Motor de faturamento: fechamento dia 10, compra dia 5/08 -> fatura de agosto ----
    {
      const card = makeCard({ closingDay: 10, dueDay: 17 });
      const inv1 = Calc.invoiceForPurchase(card, '2026-08-05');
      const inv2 = Calc.invoiceForPurchase(card, '2026-08-11');
      assert('Faturamento: compra dia 5 -> fatura 2026-08', inv1.invoiceMonth === '2026-08', inv1.invoiceMonth);
      assert('Faturamento: compra dia 11 -> fatura 2026-09', inv2.invoiceMonth === '2026-09', inv2.invoiceMonth);
      assert('Faturamento: vencimento fatura 2026-08 = 2026-08-17', inv1.dueDate === '2026-08-17', inv1.dueDate);
    }

    // ---- Motor de faturamento (vencimento no mês seguinte ao fechamento): fecha dia 27, vence dia 4 ----
    // Este é o caso que gerava confusão: uma fatura fecha em julho mas só VENCE em agosto.
    // O app deve agrupar essa fatura em "agosto" (mês de vencimento), não em "julho" (mês de fechamento).
    {
      const card = makeCard({ closingDay: 27, dueDay: 4 });
      const invBeforeClosing = Calc.invoiceForPurchase(card, '2026-06-05'); // dia 5 <= 27 -> fecha em junho -> vence em julho
      const invAfterClosing = Calc.invoiceForPurchase(card, '2026-06-30'); // dia 30 > 27 -> fecha em julho -> vence em agosto
      assert('Faturamento (vence mês seguinte): compra 06/06 -> fatura de vencimento 2026-07', invBeforeClosing.invoiceMonth === '2026-07', invBeforeClosing.invoiceMonth);
      assert('Faturamento (vence mês seguinte): compra 30/06 -> fatura de vencimento 2026-08', invAfterClosing.invoiceMonth === '2026-08', invAfterClosing.invoiceMonth);
      assert('Faturamento (vence mês seguinte): vencimento da fatura de agosto = 2026-08-04', invAfterClosing.dueDate === '2026-08-04', invAfterClosing.dueDate);
      assert('Faturamento (vence mês seguinte): fechamento correspondente = 2026-07-27', invAfterClosing.closingMonth === '2026-07' && invAfterClosing.closingDate === '2026-07-27', invAfterClosing.closingDate);
    }

    // ---- Assinatura com data final: para de gerar após o período ----
    {
      const card = makeCard();
      const purchase = {
        id: 'p7', cardId: card.id, amount: 44, purchaseDate: '2026-08-05', paymentType: 'subscription',
        subscriptionEndDate: '2026-10-05', splits: [],
      };
      const installments = Calc.generateInstallments(purchase, card);
      const months = installments.map((i) => i.invoiceMonth);
      assert('Assinatura: gera 3 meses (ago, set, out)', installments.length === 3, installments.length);
      assert('Assinatura: não gera novembro', !months.includes('2026-11'), months.join(','));
    }

    return results;
  }

  return { run };
})();

window.InternalTests = InternalTests;
