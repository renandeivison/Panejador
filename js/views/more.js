// views/more.js
const ViewMore = (() => {
  const { el } = UI;

  function render(container) {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'page-title' }, 'Mais'));
    container.appendChild(el('div', { class: 'page-subtitle' }, 'Parcelas, assinaturas, relatórios e configurações'));

    const list = el('div', { class: 'list' }, [
      el('div', { class: 'list-item glass', onclick: () => App.navigate('installments') }, [
        UI.iconChipSvg(Icons.installments, '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, 'Parcelas'),
          el('div', { class: 'li-sub' }, 'Compras parceladas futuras, por cartão'),
        ]),
        el('span', { class: 'text-muted' }, '›'),
      ]),
      el('div', { class: 'list-item glass', onclick: () => App.navigate('subscriptions') }, [
        UI.iconChipSvg(Icons.subscriptions, '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, 'Assinaturas'),
          el('div', { class: 'li-sub' }, 'Cobranças recorrentes, indefinidas ou por tempo determinado'),
        ]),
        el('span', { class: 'text-muted' }, '›'),
      ]),
      el('div', { class: 'list-item glass', onclick: () => App.navigate('reports') }, [
        UI.iconChipSvg(Icons.reports, '#3f6fe0'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, 'Relatórios'),
          el('div', { class: 'li-sub' }, 'Categorias, cartões, pessoas, fluxo e projeção'),
        ]),
        el('span', { class: 'text-muted' }, '›'),
      ]),
      el('div', { class: 'list-item glass', onclick: () => App.navigate('settings') }, [
        UI.iconChipSvg(Icons.settings, '#6b6f7d'),
        el('div', { class: 'li-main' }, [
          el('div', { class: 'li-title' }, 'Configurações'),
          el('div', { class: 'li-sub' }, 'Categorias, cartões, pessoas, backup e testes'),
        ]),
        el('span', { class: 'text-muted' }, '›'),
      ]),
    ]);
    container.appendChild(list);
  }

  return { render };
})();
window.ViewMore = ViewMore;
