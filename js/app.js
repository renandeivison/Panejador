// app.js — casca da aplicação: roteamento, navegação, seletor de mês, inicialização.
const App = (() => {
  const { el } = UI;

  const state = {
    route: 'dashboard',
    params: {},
    currentMonth: Calc.currentMonthRef(),
    startMonth: null, // mês inicial de registro — meses anteriores não são navegáveis
  };

  // Desktop mantém a navegação completa (inclui Parcelas e Assinaturas como abas próprias).
  const SIDE_NAV_ITEMS = [
    { key: 'dashboard', icon: Icons.dashboard, label: 'Início' },
    { key: 'transactions', icon: Icons.transactions, label: 'Lançamentos' },
    { key: 'cards', icon: Icons.cards, label: 'Cartões' },
    { key: 'installments', icon: Icons.installments, label: 'Parcelas' },
    { key: 'subscriptions', icon: Icons.subscriptions, label: 'Assinaturas' },
    { key: 'people', icon: Icons.people, label: 'Pessoas' },
    { key: 'more', icon: Icons.more, label: 'Mais' },
  ];
  // Mobile: barra inferior reduzida — Parcelas e Assinaturas ficam dentro de "Mais".
  const BOTTOM_NAV_ITEMS = [
    { key: 'dashboard', icon: Icons.dashboard, label: 'Início' },
    { key: 'transactions', icon: Icons.transactions, label: 'Lançamentos' },
    { key: 'cards', icon: Icons.cards, label: 'Cartões' },
    { key: 'people', icon: Icons.people, label: 'Pessoas' },
    { key: 'more', icon: Icons.more, label: 'Mais' },
  ];
  const ALL_NAV_KEYS = [...new Set([...SIDE_NAV_ITEMS, ...BOTTOM_NAV_ITEMS].map((i) => i.key))];

  // rotas que não têm item próprio na navegação (ou não em todas as listas), mas
  // pertencem a um item existente (para destacar como ativo)
  const ROUTE_GROUP = {
    cardDetail: 'cards',
    personDetail: 'people',
    personStatement: 'people',
    reports: 'more',
    settings: 'more',
    installments: 'more',
    subscriptions: 'more',
    categories: 'more',
  };
  function isNavActive(item) {
    return state.route === item.key || ROUTE_GROUP[state.route] === item.key;
  }

  const ROUTE_TITLES = {
    dashboard: 'Início', transactions: 'Lançamentos', cards: 'Cartões', cardDetail: 'Cartões',
    installments: 'Parcelas', subscriptions: 'Assinaturas', people: 'Pessoas', personDetail: 'Pessoas', personStatement: 'Recibo',
    reports: 'Relatórios', settings: 'Configurações', categories: 'Categorias', more: 'Mais',
  };

  function navigate(route, params = {}) {
    state.route = route;
    state.params = params;
    location.hash = `#/${route}${params.id ? '/' + params.id : ''}`;
    renderShell();
    window.scrollTo(0, 0);
  }

  function rerender() { renderShell(); }

  function parseHash() {
    const hash = location.hash.replace('#/', '');
    const [route, id] = hash.split('/');
    return { route: route || 'dashboard', id };
  }

  function shiftMonth(delta) {
    const target = Calc.addMonths(state.currentMonth, delta);
    if (state.startMonth && target < state.startMonth) {
      UI.toast(`O mês inicial configurado é ${Calc.monthLabel(state.startMonth)}.`, 'info');
      return;
    }
    state.currentMonth = target;
    renderShell();
  }

  function openMonthPicker() {
    const wrap = el('div', { class: 'flex-col gap-8' });
    const [cy, cm] = state.currentMonth.split('-').map(Number);
    const minYear = state.startMonth ? parseInt(state.startMonth.split('-')[0], 10) : cy - 1;
    const yearRange = [];
    for (let y = Math.min(cy - 1, minYear); y <= cy + 2; y++) yearRange.push(y);
    const yearSel = el('select', {}, yearRange.map((y) => el('option', { value: y, selected: y === cy ? 'selected' : undefined }, `${y}`)));
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthSel = el('select', {}, monthNames.map((n, i) => el('option', { value: i + 1, selected: (i + 1) === cm ? 'selected' : undefined }, n)));
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Mês'), monthSel]));
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, 'Ano'), yearSel]));
    if (state.startMonth) wrap.appendChild(el('div', { class: 'hint' }, `Mês inicial configurado: ${Calc.monthLabel(state.startMonth)}.`));
    wrap.appendChild(el('button', { class: 'btn btn-primary btn-block', onclick: () => {
      const chosen = `${yearSel.value}-${String(monthSel.value).padStart(2, '0')}`;
      if (state.startMonth && chosen < state.startMonth) {
        UI.toast(`Não é possível selecionar um mês anterior a ${Calc.monthLabel(state.startMonth)}.`, 'error');
        return;
      }
      state.currentMonth = chosen;
      UI.closeTopModal();
      renderShell();
    } }, 'Selecionar mês'));
    UI.openModal({ title: 'Selecionar mês de planejamento', content: wrap, size: 'sm' });
  }

  async function setStartMonth(monthRef) {
    state.startMonth = monthRef;
    await DB.setMeta('appStartMonth', monthRef);
    if (monthRef && state.currentMonth < monthRef) state.currentMonth = monthRef;
    renderShell();
  }

  async function clearStartMonth() {
    state.startMonth = null;
    await DB.setMeta('appStartMonth', null);
    renderShell();
  }

  // ---------- Shell persistente ----------
  // A navegação (side-nav/bottom-nav) é construída UMA VEZ e nunca recriada a cada
  // clique/navegação — apenas as classes "active" e o conteúdo da view são atualizados.
  // Isso garante que a animação de desenho dos ícones SVG só dispare quando o próprio
  // ícone é reinserido manualmente no DOM (função replayIcon), disparada apenas no
  // clique daquele ícone específico — nunca em toda a barra.
  let shellBuilt = false;
  let innerViewEl = null;
  let desktopTitleEl = null;
  const navRefs = {}; // key -> { links: [{a, iconSpan, iconHtml}] }
  const monthLabelRefs = [];
  const prevBtnRefs = [];

  function replayIcon(iconSpan, html) {
    iconSpan.innerHTML = '';
    requestAnimationFrame(() => { iconSpan.innerHTML = html; });
  }

  function buildMonthSwitcher() {
    const label = el('span', { class: 'month-label', onclick: openMonthPicker }, '');
    monthLabelRefs.push(label);
    const prevBtn = el('button', { class: 'icon-btn', onclick: () => shiftMonth(-1) }, '‹');
    prevBtnRefs.push(prevBtn);
    return el('div', { class: 'month-switcher glass-soft' }, [
      prevBtn,
      label,
      el('button', { class: 'icon-btn', onclick: () => shiftMonth(1) }, '›'),
    ]);
  }

  function buildNavLink(item) {
    const iconSpan = el('span', { class: 'nav-ic-svg', html: item.icon });
    const a = el('a', {
      href: `#/${item.key}`,
      onclick: (e) => {
        e.preventDefault();
        replayIcon(iconSpan, item.icon);
        navigate(item.key);
      },
    }, [iconSpan, el('span', {}, item.label)]);
    navRefs[item.key].links.push({ a });
    return a;
  }

  function buildShellOnce() {
    if (shellBuilt) return;
    const root = document.getElementById('app-root');
    root.innerHTML = '';
    ALL_NAV_KEYS.forEach((key) => { navRefs[key] = { links: [] }; });

    const sideNav = el('nav', { class: 'side-nav glass' }, [
      el('div', { class: 'brand' }, 'Planejador'),
      ...SIDE_NAV_ITEMS.map((item) => buildNavLink(item)),
    ]);

    const topbar = el('div', { class: 'topbar glass' }, [buildMonthSwitcher()]);

    innerViewEl = el('div');
    desktopTitleEl = el('h2', {}, '');
    const desktopHeader = el('div', { class: 'desktop-header' }, [
      desktopTitleEl,
      el('span', { class: 'spacer' }),
      buildMonthSwitcher(),
    ]);
    const viewRoot = el('main', { id: 'view-root' }, [desktopHeader, innerViewEl]);

    const bottomNav = el('nav', { class: 'bottom-nav glass' }, BOTTOM_NAV_ITEMS.map((item) => buildNavLink(item)));

    const fab = el('button', { class: 'fab', 'aria-label': 'Nova movimentação', onclick: () => Forms.openQuickAddMenu(() => rerender()) }, '+');

    root.appendChild(sideNav);
    root.appendChild(el('div', { class: 'flex-col', style: 'flex:1' }, [topbar, viewRoot]));
    root.appendChild(bottomNav);
    root.appendChild(fab);

    shellBuilt = true;
  }

  function updateNavActiveStates() {
    [...SIDE_NAV_ITEMS, ...BOTTOM_NAV_ITEMS].forEach((item) => {
      const active = isNavActive(item);
      navRefs[item.key].links.forEach(({ a }) => a.classList.toggle('active', active));
    });
  }

  function renderShell() {
    buildShellOnce();
    updateNavActiveStates();
    monthLabelRefs.forEach((label) => { label.textContent = Calc.monthLabel(state.currentMonth); });
    const atStart = !!(state.startMonth && state.currentMonth <= state.startMonth);
    prevBtnRefs.forEach((btn) => {
      btn.disabled = atStart;
      btn.style.opacity = atStart ? '0.35' : '1';
      btn.style.cursor = atStart ? 'default' : 'pointer';
    });
    desktopTitleEl.textContent = ROUTE_TITLES[state.route] || '';
    renderView(innerViewEl);
  }

  function renderView(container) {
    switch (state.route) {
      case 'dashboard': return ViewDashboard.render(container);
      case 'transactions': return ViewTransactions.render(container, state.params);
      case 'cards': return ViewCards.renderList(container);
      case 'cardDetail': return ViewCards.renderDetail(container, state.params);
      case 'installments': return ViewInstallments.render(container);
      case 'subscriptions': return ViewSubscriptions.render(container);
      case 'people': return ViewPeople.renderList(container);
      case 'personDetail': return ViewPeople.renderDetail(container, state.params);
      case 'personStatement': return ViewPeople.renderStatement(container, state.params);
      case 'reports': return ViewReports.render(container);
      case 'settings': return ViewSettings.render(container);
      case 'categories': return ViewCategories.render(container);
      case 'more': return ViewMore.render(container);
      default: return ViewDashboard.render(container);
    }
  }

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
  async function promptInstall() {
    if (!deferredInstallPrompt) {
      UI.toast('Use o menu do navegador para "Adicionar à tela inicial" / instalar o app.', 'info');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }

  async function init() {
    await DB_ready();
    await Store.loadAll();
    await Store.seedDefaultsIfEmpty();

    state.startMonth = await DB.getMeta('appStartMonth', null);
    if (state.startMonth && state.currentMonth < state.startMonth) {
      state.currentMonth = state.startMonth;
    }

    const { route, id } = parseHash();
    state.route = route;
    state.params = id ? { id } : {};

    window.addEventListener('hashchange', () => {
      const p = parseHash();
      state.route = p.route;
      state.params = p.id ? { id: p.id } : {};
      renderShell();
      window.scrollTo(0, 0);
    });

    renderShell();
    registerServiceWorker();
  }

  function DB_ready() {
    return Promise.resolve();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  return { state, navigate, rerender, init, promptInstall, setStartMonth, clearStartMonth };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
