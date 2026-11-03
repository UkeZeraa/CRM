/* Roteador e casca da aplicação */
(() => {
  const TITLES = { dashboard: 'Visão geral', atendimentos: 'Atendimentos', contatos: 'Contatos', funil: 'Funil de vendas', configuracoes: 'Configurações' };
  const view = document.getElementById('view');
  const sidebar = document.getElementById('sidebar');

  function render() {
    const [route = 'dashboard', param] = location.hash.replace(/^#\/?/, '').split('/');
    const name = Views[route] && TITLES[route] ? route : 'dashboard';
    document.getElementById('page-title').textContent = TITLES[name];
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    document.documentElement.dataset.theme = Store.get().settings.theme;
    const s = Store.get();
    const unread = s.tickets.filter((t) => t.status !== 'resolvido').length;
    document.getElementById('badge-open').textContent = unread || '';
    const me = Store.me() || {};
    document.getElementById('me').innerHTML = `<div class="avatar">${UI.initials(me.name)}</div><div><b>${UI.esc(me.name)}</b><small>${UI.esc(me.role)} · online</small></div>`;
    const scroll = view.scrollTop;
    Views[name](view, param);
    view.scrollTop = scroll;
    sidebar.classList.remove('open');
  }

  window.addEventListener('hashchange', () => { view.scrollTop = 0; render(); });
  Store.subscribe(render);

  document.getElementById('new-ticket-btn').onclick = () => Views.newTicket();
  document.getElementById('menu-btn').onclick = () => sidebar.classList.toggle('open');
  const gs = document.getElementById('global-search');
  gs.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    Views.inboxState.q = gs.value; Views.inboxState.filter = 'todos';
    location.hash === '#/atendimentos' ? render() : (location.hash = '#/atendimentos');
  });

  render();
})();
