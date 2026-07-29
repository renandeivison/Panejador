// views/categories.js
const ViewCategories = (() => {
  const { el } = UI;

  function render(container) {
    container.innerHTML = '';
    container.appendChild(UI.pageHeader({
      title: 'Categorias', subtitle: `${Store.cache.categories.length} categoria(s) cadastrada(s)`,
      onBack: () => App.navigate('settings'),
      actions: [{ icon: '+', label: 'Nova categoria', onClick: () => Forms.openCategoryForm(null, () => render(container)) }],
    }));

    if (!Store.cache.categories.length) {
      container.appendChild(el('div', { class: 'empty-state glass' }, [
        el('div', { class: 'es-icon' }, '🏷'),
        el('div', { class: 'es-title' }, 'Nenhuma categoria cadastrada'),
        el('div', {}, 'Crie categorias para organizar receitas, despesas e compras no cartão.'),
      ]));
      return;
    }

    const list = el('div', { class: 'list mt-8' });
    Store.cache.categories.forEach((c) => {
      list.appendChild(el('div', { class: 'list-item glass' }, [
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
    container.appendChild(list);
  }

  return { render };
})();
window.ViewCategories = ViewCategories;
