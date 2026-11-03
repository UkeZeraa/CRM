/* Helpers de interface */
window.UI = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name = '?') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return `${Math.floor(s / 60)} min`;
    if (s < 86400) return `${Math.floor(s / 3600)} h`;
    return `${Math.floor(s / 86400)} d`;
  }
  const dateTime = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const STATUS = { aberto: 'Aberto', andamento: 'Em andamento', aguardando: 'Aguardando cliente', resolvido: 'Resolvido' };
  const PRIORITY = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const CHANNELS = ['WhatsApp', 'E-mail', 'Instagram', 'Site', 'Telefone'];
  const statusBadge = (s) => `<span class="badge s-${s}">${STATUS[s]}</span>`;
  const priorityBadge = (p) => `<span class="badge p-${p}">${PRIORITY[p]}</span>`;
  const options = (map, sel) => Object.entries(map).map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');

  const modal = document.getElementById('modal');
  function openModal(title, html, onMount) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    modal.hidden = false;
    onMount && onMount(document.getElementById('modal-body'));
    const first = modal.querySelector('input, select, textarea'); first && first.focus();
  }
  const closeModal = () => { modal.hidden = true; };
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }
  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  return { esc, initials, money, ago, dateTime, STATUS, PRIORITY, CHANNELS, statusBadge, priorityBadge, options, openModal, closeModal, toast, formData };
})();
