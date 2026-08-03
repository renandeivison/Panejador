// import.js — Importação de fatura de cartão via CSV (formato Nubank: date,title,amount).
const CSVImport = (() => {

  function parseCSVLine(line) {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  // Converte valores no formato brasileiro exportado pelo Nubank: "8,30" | "1.234,56" | "- 2.729,75"
  function parseAmountBR(raw) {
    if (raw === undefined || raw === null) return NaN;
    let s = String(raw).trim();
    let negative = false;
    if (s.startsWith('-')) { negative = true; s = s.slice(1).trim(); }
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return negative ? -n : n;
  }

  const INSTALLMENT_RE = /-\s*Parcela\s+(\d+)\s*\/\s*(\d+)\s*$/i;
  // "Pagamento recebido" / "Pagamento em atraso" etc. são a quitação da fatura ANTERIOR,
  // não uma compra nem um estorno de compra — não devem ser somados ao valor desta fatura.
  const PAYMENT_RE = /pagamento/i;

  // Extrai uma data YYYY-MM-DD do nome do arquivo (padrão de exportação: Nubank_2026-08-04.csv)
  function guessDateFromFilename(filename) {
    const m = filename && filename.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function parseNubankCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) throw new Error('Arquivo CSV vazio.');
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = header.findIndex((h) => h.includes('date') || h.includes('data'));
    const titleIdx = header.findIndex((h) => h.includes('title') || h.includes('descri') || h.includes('estabelecimento'));
    const amountIdx = header.findIndex((h) => h.includes('amount') || h.includes('valor'));
    if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) {
      throw new Error('Formato de CSV não reconhecido. Esperado cabeçalho com colunas de data, descrição e valor (ex: date,title,amount).');
    }

    const rows = [];
    let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const date = (cols[dateIdx] || '').trim();
      const title = (cols[titleIdx] || '').trim();
      const amount = parseAmountBR(cols[amountIdx]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || isNaN(amount)) { skipped++; continue; }
      const instMatch = title.match(INSTALLMENT_RE);
      const baseTitle = instMatch ? title.slice(0, instMatch.index).trim() : title;
      rows.push({
        date, title, baseTitle, amount,
        installmentNumber: instMatch ? parseInt(instMatch[1], 10) : null,
        installmentTotal: instMatch ? parseInt(instMatch[2], 10) : null,
        isPayment: PAYMENT_RE.test(title),
      });
    }
    return { rows, skipped, total: rows.length };
  }

  // Detecta possíveis duplicatas.
  // - Linhas de parcela: já existe uma série (mesmo nome ORIGINAL do CSV — não o nome que
  //   o usuário deu depois no app — + nº de parcelas + valor por parcela compatível) no
  //   cartão com essa parcela específica já lançada?
  // - Demais linhas (compra avulsa, estorno, pagamento): o nome NÃO entra na conta — duas
  //   compras de nomes idênticos no mesmo dia podem ter valores diferentes (ex: duas
  //   compras numa farmácia no mesmo dia) e são lançamentos genuinamente distintos. O que
  //   importa é a combinação data + valor: se baterem (com folga de até 1%, mínimo
  //   R$0,05, pra cobrir arredondamento), é uma forte candidata a duplicata — comum
  //   quando o Nubank fornece faturas parciais durante o mês e o usuário reimporta depois
  //   uma fatura mais completa cobrindo o mesmo período.
  function findDuplicates(cardId, rows) {
    const existingPurchases = Store.cache.purchases.filter((p) => p.cardId === cardId);
    const existingInstallments = Store.cache.installments;
    return rows.map((r) => {
      let duplicate = false, matchType = null;
      if (r.installmentNumber && r.installmentTotal) {
        const candidates = existingPurchases.filter((p) =>
          p.paymentType === 'installments' && (p.importedTitle || p.description) === r.baseTitle && p.installmentsCount === r.installmentTotal);
        const series = candidates.find((p) => Math.abs(Calc.round2(p.amount) / r.installmentTotal - r.amount) < 0.02);
        if (series) {
          const existingInst = existingInstallments.find((i) => i.purchaseId === series.id && i.number === r.installmentNumber);
          duplicate = !!(existingInst && existingInst.confirmedFromImport);
          if (duplicate) matchType = 'exact';
        }
      } else {
        for (const p of existingPurchases) {
          if (p.purchaseDate !== r.date) continue;
          const amountDiff = Math.abs(Calc.round2(p.amount) - Calc.round2(Math.abs(r.amount)));
          const amountTolerance = Math.max(0.05, Calc.round2(p.amount) * 0.01);
          if (amountDiff <= amountTolerance) { duplicate = true; matchType = amountDiff < 0.005 ? 'exact' : 'similar'; break; }
        }
      }
      return { ...r, duplicate, matchType };
    });
  }

  return { parseCSVLine, parseAmountBR, guessDateFromFilename, parseNubankCSV, findDuplicates };
})();

window.CSVImport = CSVImport;
