/* Telas do CRM. Cada view recebe o elemento raiz e (opcionalmente) parâmetros da rota. */
window.Views = (() => {
  const { esc, initials, money, ago, dateTime, STATUS, PRIORITY, CHANNELS, statusBadge, priorityBadge, options, openModal, closeModal, toast, formData, ask } = UI;
  const S = Store;

  /* ============ VISÃO GERAL ============ */
  function dashboard(root) {
    const { tickets, deals, stages } = S.get();
    const open = tickets.filter((t) => t.status !== 'resolvido');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resolved = tickets.filter((t) => t.status === 'resolvido');
    const resolvedToday = resolved.filter((t) => t.updatedAt >= today.getTime());
    const rated = tickets.filter((t) => t.csat);
    const csat = rated.length ? (rated.reduce((a, t) => a + t.csat, 0) / rated.length).toFixed(1) : '—';

    // tempo médio da 1ª resposta
    const firstResp = tickets.map((t) => {
      const firstIn = t.messages.find((m) => m.from === 'contact');
      const firstOut = t.messages.find((m) => m.from === 'agent');
      return firstIn && firstOut && firstOut.at > firstIn.at ? firstOut.at - firstIn.at : null;
    }).filter(Boolean);
    const avgMin = firstResp.length ? Math.round(firstResp.reduce((a, b) => a + b, 0) / firstResp.length / 60000) : 0;
    const avgLabel = avgMin >= 60 ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : `${avgMin} min`;

    const pipeline = deals.filter((d) => d.stage !== 'ganho').reduce((a, d) => a + Number(d.value), 0);

    const byChannel = CHANNELS.map((c) => [c, tickets.filter((t) => t.channel === c).length]);
    const maxCh = Math.max(1, ...byChannel.map(([, n]) => n));

    const days = [...Array(7)].map((_, i) => {
      const start = new Date(today); start.setDate(start.getDate() - (6 - i));
      const end = start.getTime() + 86400e3;
      return { label: start.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), n: tickets.filter((t) => t.createdAt >= start.getTime() && t.createdAt < end).length };
    });
    const maxDay = Math.max(1, ...days.map((d) => d.n));

    const maxStage = Math.max(1, ...stages.map((s) => deals.filter((d) => d.stage === s.id).reduce((a, d) => a + Number(d.value), 0)));
    const recent = [...tickets].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

    root.innerHTML = `
      <div class="kpis">
        ${kpi('Atendimentos abertos', open.length, `${tickets.filter((t) => t.unread).length} não lidos`)}
        ${kpi('Resolvidos hoje', resolvedToday.length, `${resolved.length} no total`)}
        ${kpi('1ª resposta (média)', avgLabel, 'meta: 15 min')}
        ${kpi('Satisfação (CSAT)', csat, `${rated.length} avaliações`)}
        ${kpi('Pipeline em aberto', money(pipeline), `${deals.filter((d) => d.stage !== 'ganho').length} oportunidades`)}
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Novos atendimentos — últimos 7 dias</h3>
          <div class="cols">${days.map((d) => `<div class="col"><b>${d.n}</b><div class="stick" style="height:${(d.n / maxDay) * 100}%"></div><small>${d.label}</small></div>`).join('')}</div>
        </div>
        <div class="card">
          <h3>Por canal</h3>
          <div class="bars">${byChannel.map(([c, n]) => `<div class="bar-row"><span>${c}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / maxCh) * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Atividade recente</h3>
          <div class="list">${recent.map((t) => {
            const c = S.contact(t.contactId) || {};
            return `<a class="list-item" href="#/atendimentos/${t.id}"><div class="avatar">${initials(c.name)}</div>
              <div class="grow"><div class="ellipsis"><b>${esc(c.name)}</b> · ${esc(t.subject)}</div><small class="muted">#${t.number} · ${t.channel} · ${ago(t.updatedAt)}</small></div>
              ${statusBadge(t.status)}</a>`;
          }).join('')}</div>
        </div>
        <div class="card">
          <h3>Funil de vendas</h3>
          <div class="bars">${stages.map((s) => {
            const ds = deals.filter((d) => d.stage === s.id);
            const total = ds.reduce((a, d) => a + Number(d.value), 0);
            return `<div class="bar-row" style="grid-template-columns:120px 1fr 80px"><span class="ellipsis">${esc(s.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${(total / maxStage) * 100}%"></div></div><small class="muted">${money(total)}</small></div>`;
          }).join('')}</div>
        </div>
      </div>`;
  }
  const kpi = (label, value, sub) => `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="delta">${sub}</div></div>`;

  /* ============ ATENDIMENTOS ============ */
  const inboxState = { filter: 'ativos', mine: false, q: '' };

  function atendimentos(root, id) {
    const { tickets, agents } = S.get();
    const q = inboxState.q.toLowerCase();
    const list = tickets.filter((t) => {
      if (inboxState.filter === 'ativos' && t.status === 'resolvido') return false;
      if (STATUS[inboxState.filter] && t.status !== inboxState.filter) return false;
      if (inboxState.mine && t.agentId !== S.get().settings.meId) return false;
      if (q) {
        const c = S.contact(t.contactId) || {};
        if (![t.subject, c.name, c.company, String(t.number)].join(' ').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);

    const sel = id ? S.ticket(id) : null;
    if (sel && sel.unread) { sel.unread = false; S.save(); }

    const filters = { ativos: 'Ativos', ...STATUS, todos: 'Todos' };
    root.innerHTML = `
      <div class="inbox ${sel ? 'has-selection' : ''}">
        <div class="inbox-list">
          <div class="inbox-filters">
            ${Object.entries(filters).map(([k, l]) => `<button class="chip ${inboxState.filter === k ? 'active' : ''}" data-filter="${k}">${l}</button>`).join('')}
            <button class="chip ${inboxState.mine ? 'active' : ''}" data-mine>Meus</button>
          </div>
          <div class="tickets">
            ${list.length ? list.map((t) => ticketRow(t, sel)).join('') : '<div class="empty">Nenhum atendimento aqui 🎉</div>'}
          </div>
        </div>
        ${sel ? conversation(sel, agents) : '<div class="conv-wrap"><div class="empty">Selecione um atendimento para ver a conversa</div></div>'}
      </div>`;

    root.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { inboxState.filter = b.dataset.filter; atendimentos(root, id); });
    root.querySelector('[data-mine]').onclick = () => { inboxState.mine = !inboxState.mine; atendimentos(root, id); };
    if (sel) bindConversation(root, sel);
  }

  function ticketRow(t, sel) {
    const c = S.contact(t.contactId) || {};
    const last = t.messages[t.messages.length - 1];
    return `<a class="ticket ${sel && sel.id === t.id ? 'active' : ''}" href="#/atendimentos/${t.id}">
      <div class="avatar">${initials(c.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="t-top"><b class="ellipsis">${esc(c.name)}</b><small class="muted">${t.unread ? '<span class="unread-dot"></span> ' : ''}${ago(t.updatedAt)}</small></div>
        <div class="t-sub ellipsis">${esc(t.subject)}</div>
        <div class="muted ellipsis" style="font-size:12px">${last ? esc(last.text) : 'Sem mensagens'}</div>
        <div class="t-meta">${statusBadge(t.status)}${priorityBadge(t.priority)}<span class="badge">${t.channel}</span></div>
      </div></a>`;
  }

  function conversation(t, agents) {
    const c = S.contact(t.contactId) || {};
    const history = S.get().tickets.filter((x) => x.contactId === c.id && x.id !== t.id);
    return `
      <div class="conv-wrap">
        <div class="conv">
          <div class="conv-head">
            <a class="icon-btn" href="#/atendimentos" title="Voltar">←</a>
            <div class="avatar">${initials(c.name)}</div>
            <div class="grow"><b>${esc(t.subject)}</b><div class="muted" style="font-size:12px">#${t.number} · ${esc(c.name)} · via ${t.channel}</div></div>
            ${t.status !== 'resolvido' ? '<button class="btn btn-sm btn-primary" data-resolve>✓ Resolver</button>' : '<button class="btn btn-sm" data-reopen>Reabrir</button>'}
          </div>
          <div class="messages" id="messages">
            ${t.messages.map((m) => {
              if (m.type === 'note') return `<div class="msg note">📝 <b>${esc((S.agent(m.from) || {}).name || 'Nota')}</b>: ${esc(m.text)}<small>${dateTime(m.at)}</small></div>`;
              return `<div class="msg ${m.from === 'contact' ? 'in' : 'out'}">${esc(m.text)}<small>${dateTime(m.at)}</small></div>`;
            }).join('') || '<div class="empty">Sem mensagens ainda</div>'}
          </div>
          <form class="composer" id="composer">
            <div class="composer-tabs">
              <button type="button" class="chip active" data-mode="msg">Responder</button>
              <button type="button" class="chip" data-mode="note">Nota interna</button>
              <select class="input" name="quick" style="margin-left:auto;padding:5px 8px;font-size:12px">
                <option value="">Respostas rápidas…</option>
                <option>Olá! Obrigado pelo contato com a Ascend Digital. Como posso ajudar?</option>
                <option>Recebemos sua solicitação e já estamos trabalhando nela.</option>
                <option>Pode me enviar mais detalhes, por favor?</option>
                <option>Ficamos felizes em ajudar! Posso encerrar este atendimento?</option>
              </select>
            </div>
            <textarea class="input" name="text" placeholder="Escreva sua resposta… (Ctrl+Enter para enviar)"></textarea>
            <div class="composer-row"><small class="muted" id="mode-hint">Visível para o cliente</small><button class="btn btn-primary">Enviar</button></div>
          </form>
        </div>
        <aside class="side-panel">
          <div style="text-align:center"><div class="avatar lg" style="margin:0 auto 8px">${initials(c.name)}</div><b>${esc(c.name)}</b><div class="muted">${esc(c.company || '')}</div></div>
          <div class="kv"><span>E-mail</span><span class="ellipsis">${esc(c.email || '—')}</span><span>Telefone</span><span>${esc(c.phone || '—')}</span><span>Tags</span><span>${(c.tags || []).map((x) => `<span class="badge">${esc(x)}</span>`).join(' ') || '—'}</span></div>
          <h4>Atendimento</h4>
          <label class="field">Status<select class="input" data-field="status">${options(STATUS, t.status)}</select></label>
          <label class="field">Prioridade<select class="input" data-field="priority">${options(PRIORITY, t.priority)}</select></label>
          <label class="field">Responsável<select class="input" data-field="agentId"><option value="">Sem responsável</option>${options(Object.fromEntries(agents.map((a) => [a.id, a.name])), t.agentId)}</select></label>
          <h4>Histórico (${history.length})</h4>
          <div class="list">${history.map((h) => `<a class="list-item" href="#/atendimentos/${h.id}"><div class="grow"><div class="ellipsis">${esc(h.subject)}</div><small class="muted">#${h.number} · ${ago(h.createdAt)}</small></div>${statusBadge(h.status)}</a>`).join('') || '<small class="muted">Primeiro atendimento deste contato</small>'}</div>
        </aside>
      </div>`;
  }

  function bindConversation(root, t) {
    const msgs = root.querySelector('#messages'); msgs.scrollTop = msgs.scrollHeight;
    const form = root.querySelector('#composer');
    let mode = 'msg';
    form.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
      mode = b.dataset.mode;
      form.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
      form.querySelector('#mode-hint').textContent = mode === 'note' ? 'Visível apenas para a equipe' : 'Visível para o cliente';
    });
    form.quick.onchange = () => { if (form.quick.value) { form.text.value = form.quick.value; form.quick.value = ''; form.text.focus(); } };
    form.text.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = form.text.value.trim(); if (!text) return;
      S.addMessage(t.id, text, mode);
      toast(mode === 'note' ? 'Nota adicionada' : 'Resposta enviada');
    };
    root.querySelectorAll('[data-field]').forEach((s) => s.onchange = () => { S.updateTicket(t.id, { [s.dataset.field]: s.value || null }); toast('Atendimento atualizado'); });
    const resolve = root.querySelector('[data-resolve]');
    resolve && (resolve.onclick = () => { S.updateTicket(t.id, { status: 'resolvido' }); toast(`Atendimento #${t.number} resolvido`); });
    const reopen = root.querySelector('[data-reopen]');
    reopen && (reopen.onclick = () => S.updateTicket(t.id, { status: 'andamento' }));
  }

  function newTicket(preContactId) {
    const { contacts } = S.get();
    openModal('Novo atendimento', `
      <form id="f" class="form-grid">
        <label class="field full">Contato<select class="input" name="contactId" required>
          <option value="">Selecione…</option>${contacts.map((c) => `<option value="${c.id}" ${c.id === preContactId ? 'selected' : ''}>${esc(c.name)}${c.company ? ' — ' + esc(c.company) : ''}</option>`).join('')}
          <option value="__new">+ Novo contato…</option></select></label>
        <div class="full" id="new-contact" hidden><div class="form-grid">
          <label class="field">Nome<input class="input" name="cname" /></label>
          <label class="field">Telefone<input class="input" name="cphone" /></label>
        </div></div>
        <label class="field full">Assunto<input class="input" name="subject" required /></label>
        <label class="field">Canal<select class="input" name="channel">${CHANNELS.map((c) => `<option>${c}</option>`).join('')}</select></label>
        <label class="field">Prioridade<select class="input" name="priority">${options(PRIORITY, 'media')}</select></label>
        <label class="field full">Mensagem inicial do cliente<textarea class="input" name="message"></textarea></label>
        <div class="form-actions full"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Criar atendimento</button></div>
      </form>`, (body) => {
      const f = body.querySelector('#f');
      f.contactId.onchange = () => { body.querySelector('#new-contact').hidden = f.contactId.value !== '__new'; f.cname.required = f.contactId.value === '__new'; };
      f.onsubmit = (e) => {
        e.preventDefault();
        const d = formData(f);
        if (d.contactId === '__new') d.contactId = S.upsertContact({ name: d.cname, phone: d.cphone, email: '', company: '', tags: ['Lead'] }).id;
        const t = S.createTicket(d);
        closeModal(); toast(`Atendimento #${t.number} criado`);
        location.hash = `#/atendimentos/${t.id}`;
      };
    });
  }

  /* ============ CONTATOS ============ */
  const contactState = { q: '', tag: '' };
  function contatos(root, id) {
    if (id) return contactDetail(root, id);
    const { contacts, tickets } = S.get();
    const allTags = [...new Set(contacts.flatMap((c) => c.tags || []))];
    const q = contactState.q.toLowerCase();
    const list = contacts.filter((c) => (!q || [c.name, c.email, c.company, c.phone].join(' ').toLowerCase().includes(q)) && (!contactState.tag || (c.tags || []).includes(contactState.tag)));
    root.innerHTML = `
      <div class="toolbar">
        <input class="search" id="cq" placeholder="Filtrar contatos…" value="${esc(contactState.q)}" style="display:block" />
        <select class="input" id="ctag"><option value="">Todas as tags</option>${allTags.map((t) => `<option ${t === contactState.tag ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="add-contact">+ Novo contato</button>
      </div>
      <div class="card" style="padding:0;overflow:auto">
        <table class="table">
          <thead><tr><th>Nome</th><th class="hide-sm">Empresa</th><th class="hide-sm">E-mail</th><th>Telefone</th><th>Tags</th><th class="hide-sm">Atendimentos</th></tr></thead>
          <tbody>${list.map((c) => `<tr data-id="${c.id}">
            <td><div style="display:flex;gap:10px;align-items:center"><div class="avatar">${initials(c.name)}</div><b>${esc(c.name)}</b></div></td>
            <td class="hide-sm">${esc(c.company || '—')}</td><td class="hide-sm">${esc(c.email || '—')}</td><td>${esc(c.phone || '—')}</td>
            <td>${(c.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join(' ')}</td>
            <td class="hide-sm">${tickets.filter((t) => t.contactId === c.id).length}</td></tr>`).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">Nenhum contato encontrado</td></tr>'}</tbody>
        </table>
      </div>`;
    const cq = root.querySelector('#cq');
    cq.oninput = () => { contactState.q = cq.value; contatos(root); const el = root.querySelector('#cq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
    root.querySelector('#ctag').onchange = (e) => { contactState.tag = e.target.value; contatos(root); };
    root.querySelector('#add-contact').onclick = () => contactForm();
    root.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `#/contatos/${tr.dataset.id}`));
  }

  function contactDetail(root, id) {
    const c = S.contact(id);
    if (!c) { location.hash = '#/contatos'; return; }
    const ts = S.get().tickets.filter((t) => t.contactId === id).sort((a, b) => b.updatedAt - a.updatedAt);
    const ds = S.get().deals.filter((d) => d.contactId === id);
    root.innerHTML = `
      <div class="toolbar"><a class="btn" href="#/contatos">← Contatos</a><div class="spacer"></div>
        <button class="btn" id="edit">Editar</button><button class="btn btn-danger" id="del">Excluir</button><button class="btn btn-primary" id="nt">+ Atendimento</button></div>
      <div class="grid-2">
        <div class="card">
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px"><div class="avatar lg">${initials(c.name)}</div>
            <div><h2>${esc(c.name)}</h2><div class="muted">${esc(c.company || '')}</div></div></div>
          <div class="kv"><span>E-mail</span><span>${esc(c.email || '—')}</span><span>Telefone</span><span>${esc(c.phone || '—')}</span>
            <span>Tags</span><span>${(c.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join(' ') || '—'}</span>
            <span>Cliente desde</span><span>${new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
            <span>Notas</span><span>${esc(c.notes || '—')}</span></div>
        </div>
        <div class="card"><h3>Oportunidades</h3><div class="list">${ds.map((d) => `<div class="list-item"><div class="grow">${esc(d.title)}<br><small class="muted">${esc((S.get().stages.find((s) => s.id === d.stage) || {}).name)}</small></div><b>${money(d.value)}</b></div>`).join('') || '<small class="muted">Nenhuma oportunidade</small>'}</div></div>
      </div>
      <div class="card"><h3>Atendimentos (${ts.length})</h3><div class="list">${ts.map((t) => `<a class="list-item" href="#/atendimentos/${t.id}"><div class="grow"><b>${esc(t.subject)}</b><br><small class="muted">#${t.number} · ${t.channel} · ${dateTime(t.createdAt)}</small></div>${priorityBadge(t.priority)} ${statusBadge(t.status)}</a>`).join('') || '<small class="muted">Nenhum atendimento ainda</small>'}</div></div>`;
    root.querySelector('#edit').onclick = () => contactForm(c);
    root.querySelector('#nt').onclick = () => newTicket(c.id);
    root.querySelector('#del').onclick = () => {
      ask('Excluir contato', `Excluir ${c.name}? Os atendimentos e oportunidades deste contato também serão removidos.`, 'Excluir', () => { S.deleteContact(id); location.hash = '#/contatos'; toast('Contato excluído'); });
    };
  }

  function contactForm(c = {}) {
    openModal(c.id ? 'Editar contato' : 'Novo contato', `
      <form id="f" class="form-grid">
        <label class="field">Nome<input class="input" name="name" required value="${esc(c.name)}" /></label>
        <label class="field">Empresa<input class="input" name="company" value="${esc(c.company)}" /></label>
        <label class="field">E-mail<input class="input" type="email" name="email" value="${esc(c.email)}" /></label>
        <label class="field">Telefone<input class="input" name="phone" value="${esc(c.phone)}" /></label>
        <label class="field full">Tags (separadas por vírgula)<input class="input" name="tags" value="${esc((c.tags || []).join(', '))}" placeholder="Lead, VIP, Cliente" /></label>
        <label class="field full">Notas<textarea class="input" name="notes">${esc(c.notes)}</textarea></label>
        <div class="form-actions full"><button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
      </form>`, (body) => {
      body.querySelector('#f').onsubmit = (e) => {
        e.preventDefault();
        const d = formData(e.target);
        d.tags = d.tags.split(',').map((s) => s.trim()).filter(Boolean);
        if (c.id) d.id = c.id;
        S.upsertContact(d); closeModal(); toast('Contato salvo');
      };
    });
  }

  /* ============ FUNIL ============ */
  function funil(root) {
    const { stages, deals } = S.get();
    root.innerHTML = `
      <div class="toolbar"><span class="muted">Arraste os cards entre as etapas.</span><div class="spacer"></div><button class="btn btn-primary" id="add-deal">+ Nova oportunidade</button></div>
      <div class="kanban">${stages.map((s) => {
        const ds = deals.filter((d) => d.stage === s.id);
        return `<div class="stage"><div class="stage-head"><div class="row"><b>${esc(s.name)}</b><span class="badge">${ds.length}</span></div>
          <small>${money(ds.reduce((a, d) => a + Number(d.value), 0))}</small><div class="stage-line"></div></div>
          <div class="stage-body" data-stage="${s.id}">${ds.map((d) => {
            const c = S.contact(d.contactId) || {};
            return `<div class="deal" draggable="true" data-id="${d.id}"><b>${esc(d.title)}</b><small class="muted">${esc(c.name || '—')}</small>
              <div class="row"><span class="grad-text" style="font-weight:700">${money(d.value)}</span><span class="avatar" style="width:24px;height:24px;font-size:9px" title="${esc((S.agent(d.agentId) || {}).name)}">${initials((S.agent(d.agentId) || {}).name)}</span></div></div>`;
          }).join('')}</div></div>`;
      }).join('')}</div>`;

    root.querySelector('#add-deal').onclick = () => dealForm();
    root.querySelectorAll('.deal').forEach((el) => {
      el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', el.dataset.id); el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');
      el.onclick = () => dealForm(deals.find((d) => d.id === el.dataset.id));
    });
    root.querySelectorAll('.stage-body').forEach((col) => {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add('drag-over'); };
      col.ondragleave = () => col.classList.remove('drag-over');
      col.ondrop = (e) => {
        e.preventDefault(); col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        S.moveDeal(id, col.dataset.stage);
        if (col.dataset.stage === 'ganho') toast('🚀 Oportunidade ganha!');
      };
    });
  }

  function dealForm(d = {}) {
    const { contacts, stages, agents } = S.get();
    openModal(d.id ? 'Editar oportunidade' : 'Nova oportunidade', `
      <form id="f" class="form-grid">
        <label class="field full">Título<input class="input" name="title" required value="${esc(d.title)}" /></label>
        <label class="field">Contato<select class="input" name="contactId" required>${contacts.map((c) => `<option value="${c.id}" ${c.id === d.contactId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field">Valor (R$)<input class="input" type="number" min="0" step="1" name="value" required value="${esc(d.value ?? '')}" /></label>
        <label class="field">Etapa<select class="input" name="stage">${options(Object.fromEntries(stages.map((s) => [s.id, s.name])), d.stage || 'novo')}</select></label>
        <label class="field">Responsável<select class="input" name="agentId">${options(Object.fromEntries(agents.map((a) => [a.id, a.name])), d.agentId || S.get().settings.meId)}</select></label>
        <div class="form-actions full">${d.id ? '<button type="button" class="btn btn-danger" id="del" style="margin-right:auto">Excluir</button>' : ''}<button type="button" class="btn" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
      </form>`, (body) => {
      body.querySelector('#f').onsubmit = (e) => {
        e.preventDefault();
        const data = formData(e.target); data.value = Number(data.value);
        if (d.id) data.id = d.id;
        S.upsertDeal(data); closeModal(); toast('Oportunidade salva');
      };
      const del = body.querySelector('#del');
      del && (del.onclick = () => { S.deleteDeal(d.id); closeModal(); toast('Oportunidade excluída'); });
    });
  }

  /* ============ CONFIGURAÇÕES ============ */
  function configuracoes(root) {
    const { agents, settings } = S.get();
    root.innerHTML = `
      <div class="grid-2">
        <div class="card"><h3>Equipe</h3>
          <div class="list">${agents.map((a) => `<div class="list-item"><div class="avatar">${initials(a.name)}</div><div class="grow"><b>${esc(a.name)}</b><br><small class="muted">${esc(a.role)}</small></div>
            ${a.id === settings.meId ? '<span class="badge s-resolvido">Você</span>' : `<button class="btn btn-sm" data-me="${a.id}">Entrar como</button>`}</div>`).join('')}</div>
          <form id="fa" class="form-grid" style="margin-top:14px">
            <input class="input" name="name" placeholder="Nome do atendente" required />
            <select class="input" name="role"><option>Atendente</option><option>Supervisor</option><option>Comercial</option></select>
            <div class="full"><button class="btn btn-primary">+ Adicionar atendente</button></div>
          </form>
        </div>
        <div class="card"><h3>Preferências</h3>
          <label class="field">Tema<select class="input" id="theme"><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Escuro</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option></select></label>
          <h3 style="margin-top:24px">Dados</h3>
          <p class="muted">Os dados ficam salvos neste navegador. Copie para backup ou restaure o exemplo.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="export">Copiar dados (JSON)</button><button class="btn btn-danger" id="reset">Restaurar dados de exemplo</button></div>
        </div>
      </div>`;
    root.querySelectorAll('[data-me]').forEach((b) => b.onclick = () => { settings.meId = b.dataset.me; S.save(); toast('Usuário alterado'); });
    root.querySelector('#fa').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); agents.push({ id: S.uid('a'), ...d }); S.save(); toast('Atendente adicionado'); };
    root.querySelector('#theme').onchange = (e) => { settings.theme = e.target.value; S.save(); };
    root.querySelector('#export').onclick = async () => {
      const json = JSON.stringify(S.get(), null, 2);
      try { await navigator.clipboard.writeText(json); toast('Dados copiados'); }
      catch { openModal('Dados (JSON)', `<textarea class="input" style="min-height:300px" id="json-out" readonly>${esc(json)}</textarea>`, (b) => b.querySelector('#json-out').select()); }
    };
    root.querySelector('#reset').onclick = () => ask('Restaurar dados', 'Apagar tudo e restaurar os dados de exemplo?', 'Restaurar', () => { S.reset(); toast('Dados restaurados'); });
  }

  return { dashboard, atendimentos, contatos, funil, configuracoes, newTicket, inboxState };
})();
