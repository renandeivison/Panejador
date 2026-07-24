// views/settings.js
const ViewSettings = (() => {
  const { el } = UI;

  function render(container) {
    container.innerHTML = '';
    container.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => App.navigate('more') }, '← Voltar para Mais'));
    container.appendChild(el('div', { class: 'page-title mt-14' }, 'Configurações'));
    container.appendChild(el('div', { class: 'page-subtitle' }, 'Categorias, dados e preferências'));

    // Categorias
    container.appendChild(el('div', { class: 'flex justify-between items-center' }, [
      el('div', { class: 'section-title', style: 'margin:0' }, 'Categorias'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => Forms.openCategoryForm(null, () => render(container)) }, '+ Nova'),
    ]));
    const catList = el('div', { class: 'list mt-8' });
    Store.cache.categories.forEach((c) => {
      catList.appendChild(el('div', { class: 'list-item glass' }, [
        UI.iconChip(c.icon, c.color),
        el('div', { class: 'li-main' }, el('div', { class: 'li-title' }, c.name)),
        el('div', { class: 'flex gap-8' }, [
          el('button', { class: 'icon-btn', onclick: (e) => { e.stopPropagation(); Forms.openCategoryForm(c, () => render(container)); } }, '✎'),
          el('button', { class: 'icon-btn', onclick: async (e) => {
            e.stopPropagation();
            const ok = await UI.confirmDialog({ title: 'Excluir categoria', message: `Excluir "${c.name}"?`, choices: [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: true, danger: true }] });
            if (!ok) return;
            await Store.deleteCategory(c.id);
            render(container);
          } }, '🗑'),
        ]),
      ]));
    });
    container.appendChild(catList);

    // Cartões e Pessoas — atalhos
    container.appendChild(el('div', { class: 'grid grid-2 mt-14' }, [
      el('button', { class: 'stat-card glass clickable', onclick: () => App.navigate('cards') }, [el('div', { class: 'stat-label' }, 'Cartões'), el('div', { class: 'stat-value text-blue' }, `${Store.cache.cards.length}`)]),
      el('button', { class: 'stat-card glass clickable', onclick: () => App.navigate('people') }, [el('div', { class: 'stat-label' }, 'Pessoas'), el('div', { class: 'stat-value text-blue' }, `${Store.cache.people.length}`)]),
    ]));

    // Mês inicial de registro
    container.appendChild(el('div', { class: 'section-title' }, 'Período de planejamento'));
    const monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const startMonthCurrent = App.state.startMonth || App.state.currentMonth;
    const [smY, smM] = startMonthCurrent.split('-').map(Number);
    const smMonthSel = el('select', {}, monthNamesFull.map((n, i) => el('option', { value: i + 1, selected: (i + 1) === smM ? 'selected' : undefined }, n)));
    const smYearSel = el('select', {}, [-3, -2, -1, 0, 1].map((d) => el('option', { value: smY + d, selected: d === 0 ? 'selected' : undefined }, `${smY + d}`)));
    container.appendChild(el('div', { class: 'glass', style: 'padding:16px' }, [
      el('div', { class: 'text-xs text-muted mb-8' },
        App.state.startMonth
          ? `Mês inicial atual: ${Calc.monthLabel(App.state.startMonth)}. Meses anteriores a ele não aparecem na navegação do app.`
          : 'Nenhum mês inicial definido — todos os meses estão navegáveis. Defina um mês inicial para ocultar meses anteriores ao começo do seu planejamento.'),
      el('div', { class: 'form-row' }, [smMonthSel, smYearSel]),
      el('div', { class: 'flex gap-8 mt-8', style: 'flex-wrap:wrap' }, [
        el('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
          const chosen = `${smYearSel.value}-${String(smMonthSel.value).padStart(2, '0')}`;
          await App.setStartMonth(chosen);
          UI.toast(`Mês inicial definido: ${Calc.monthLabel(chosen)}.`, 'success');
          render(container);
        } }, 'Definir mês inicial'),
        App.state.startMonth ? el('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
          await App.clearStartMonth();
          UI.toast('Restrição de mês inicial removida.', 'success');
          render(container);
        } }, 'Remover restrição') : null,
      ]),
    ]));

    // Instalação do app
    container.appendChild(el('div', { class: 'section-title' }, 'Aplicativo'));
    container.appendChild(el('div', { class: 'glass', style: 'padding:16px' }, [
      el('div', { class: 'text-xs text-muted mb-8' }, 'Instale o Planejador Financeiro na tela inicial do seu celular ou computador para uma experiência semelhante a um app nativo, com funcionamento offline.'),
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => App.promptInstall() }, '📲 Instalar aplicativo'),
    ]));

    // Backup
    container.appendChild(el('div', { class: 'section-title' }, 'Backup de dados'));
    const backupCard = el('div', { class: 'glass', style: 'padding:16px' }, [
      el('div', { class: 'text-xs text-muted mb-8' }, 'Exporte um backup completo em JSON ou exporte relatórios em CSV. A importação valida o arquivo antes de aplicar.'),
      el('div', { class: 'flex gap-8', style: 'flex-wrap:wrap' }, [
        el('button', { class: 'btn btn-primary btn-sm', onclick: exportJSON }, 'Exportar JSON (backup completo)'),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: exportCSV }, 'Exportar movimentações (CSV)'),
        el('label', { class: 'btn btn-ghost btn-sm', style: 'cursor:pointer' }, [
          'Importar backup JSON',
          el('input', { type: 'file', accept: 'application/json', style: 'display:none', onchange: importJSON }),
        ]),
      ]),
    ]);
    container.appendChild(backupCard);

    // Testes internos
    container.appendChild(el('div', { class: 'section-title' }, 'Qualidade'));
    const testCard = el('div', { class: 'glass', style: 'padding:16px' }, [
      el('div', { class: 'text-xs text-muted mb-8' }, 'Executa cenários de teste do motor de cálculo (faturamento, parcelas, divisão, estornos, assinaturas).'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: runTests }, 'Executar testes internos'),
      el('div', { id: 'test-results', class: 'mt-14' }),
    ]);
    container.appendChild(testCard);

    // Zona de risco
    container.appendChild(el('div', { class: 'section-title' }, 'Zona de risco'));
    const dangerCard = el('div', { class: 'glass', style: 'padding:16px;border:1px solid rgba(224,57,62,0.25)' }, [
      el('div', { class: 'flex-col' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:13px' }, `Resetar ${Calc.monthLabel(App.state.currentMonth)}`),
          el('div', { class: 'text-xs text-muted mt-8' }, 'Remove receitas, despesas e lançamentos de cartão apenas deste mês. Parcelas e assinaturas em andamento continuam nos demais meses.'),
          el('button', { class: 'btn btn-danger btn-sm mt-8', onclick: async () => {
            const ok = await UI.confirmDialog({
              title: 'Resetar mês',
              message: `Isso vai apagar todos os lançamentos planejados para ${Calc.monthLabel(App.state.currentMonth)}. Esta ação não pode ser desfeita. Continuar?`,
              choices: [{ label: 'Cancelar', value: null }, { label: 'Resetar este mês', value: true, danger: true }],
            });
            if (!ok) return;
            const res = await Store.resetMonth(App.state.currentMonth);
            UI.toast(`Mês resetado: ${res.transactions} lançamento(s) e ${res.cardLaunches} item(ns) de cartão removidos.`, 'success');
            App.rerender();
          } }, 'Resetar mês selecionado'),
        ]),
        el('div', { class: 'divider' }),
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:13px' }, 'Resetar aplicativo inteiro'),
          el('div', { class: 'text-xs text-muted mt-8' }, 'Apaga TODOS os dados: cartões, pessoas, categorias, movimentações, parcelas e histórico. Recomendado exportar um backup antes.'),
          el('button', { class: 'btn btn-danger btn-sm mt-8', onclick: async () => {
            const ok = await UI.confirmDialog({
              title: 'Resetar aplicativo inteiro',
              message: 'Isso vai apagar TODOS os dados permanentemente, incluindo cartões, pessoas e histórico de movimentações. Esta ação não pode ser desfeita. Tem certeza?',
              choices: [{ label: 'Cancelar', value: null }, { label: 'Apagar tudo', value: true, danger: true }],
            });
            if (!ok) return;
            await Store.resetAll();
            UI.toast('Aplicativo resetado.', 'success');
            App.navigate('dashboard');
          } }, 'Resetar tudo'),
        ]),
      ]),
    ]);
    container.appendChild(dangerCard);

    container.appendChild(el('div', { class: 'text-xs text-muted mt-14', style: 'text-align:center;padding:20px 0' }, 'Planejador Financeiro Mensal · dados armazenados localmente neste dispositivo'));
  }

  async function exportJSON() {
    const json = await Store.exportJSON();
    downloadFile(json, `backup-financeiro-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    UI.toast('Backup exportado.', 'success');
  }

  function exportCSV() {
    const rows = [];
    Store.cache.transactions.forEach((t) => rows.push({
      tipo: t.type === 'income' ? 'Receita' : 'Despesa', descricao: t.description, valor: t.amount, data: t.date,
      categoria: Store.cache.categories.find((c) => c.id === t.category)?.name || '',
    }));
    Store.cache.installments.forEach((i) => {
      const purchase = Store.cache.purchases.find((p) => p.id === i.purchaseId);
      rows.push({
        tipo: i.kind === 'reversal' ? 'Estorno' : 'Cartão', descricao: purchase?.description || '', valor: i.amount, data: i.invoiceDueDate,
        categoria: Store.cache.categories.find((c) => c.id === purchase?.category)?.name || '',
      });
    });
    const csv = Store.toCSV(rows, [
      { label: 'Tipo', value: 'tipo' }, { label: 'Descrição', value: 'descricao' },
      { label: 'Valor', value: 'valor' }, { label: 'Data', value: 'data' }, { label: 'Categoria', value: 'categoria' },
    ]);
    downloadFile(csv, `movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    UI.toast('CSV exportado.', 'success');
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const mode = await UI.confirmDialog({
      title: 'Importar backup',
      message: 'Deseja mesclar os dados importados com os existentes, ou substituir todos os dados atuais?',
      choices: [{ label: 'Cancelar', value: null }, { label: 'Mesclar', value: 'merge' }, { label: 'Substituir tudo', value: 'replace', danger: true }],
    });
    if (!mode) return;
    try {
      await Store.importJSON(text, mode);
      UI.toast('Dados importados com sucesso.', 'success');
      App.rerender();
    } catch (err) {
      UI.toast('Erro ao importar: ' + err.message, 'error');
    }
  }

  function runTests() {
    const results = InternalTests.run();
    const host = document.getElementById('test-results');
    host.innerHTML = '';
    const passCount = results.filter((r) => r.pass).length;
    host.appendChild(el('div', { class: `text-xs`, style: `font-weight:700;color:${passCount === results.length ? 'var(--green)' : 'var(--red)'};margin-bottom:8px` },
      `${passCount}/${results.length} testes passaram`));
    results.forEach((r) => {
      host.appendChild(el('div', { class: 'flex justify-between text-xs', style: 'padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05)' }, [
        el('span', {}, `${r.pass ? '✅' : '❌'} ${r.name}`),
        !r.pass ? el('span', { class: 'text-red' }, String(r.detail)) : null,
      ]));
    });
  }

  return { render };
})();
window.ViewSettings = ViewSettings;
