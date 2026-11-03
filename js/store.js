/* Persistência simples em localStorage. Troque por chamadas de API quando houver backend. */
window.Store = (() => {
  const KEY = 'ascend-crm-v1';
  let state;

  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
    if (!state) state = structuredClone(window.SEED);
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    listeners.forEach((fn) => fn(state));
  }
  const listeners = new Set();
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);

  load();

  return {
    get: () => state,
    save,
    subscribe: (fn) => listeners.add(fn),
    reset() { state = structuredClone(window.SEED); save(); },
    uid,

    contact: (id) => state.contacts.find((c) => c.id === id),
    agent: (id) => state.agents.find((a) => a.id === id),
    ticket: (id) => state.tickets.find((t) => t.id === id),
    me: () => state.agents.find((a) => a.id === state.settings.meId),

    upsertContact(data) {
      if (data.id) Object.assign(this.contact(data.id), data);
      else { data.id = uid('c'); data.createdAt = Date.now(); state.contacts.unshift(data); }
      save(); return data;
    },
    deleteContact(id) {
      state.contacts = state.contacts.filter((c) => c.id !== id);
      state.tickets = state.tickets.filter((t) => t.contactId !== id);
      state.deals = state.deals.filter((d) => d.contactId !== id);
      save();
    },
    createTicket({ contactId, subject, channel, priority, message }) {
      const t = {
        id: uid('t'), number: state.settings.nextTicket++, contactId, subject, channel, priority,
        status: 'aberto', agentId: state.settings.meId, unread: false, createdAt: Date.now(), updatedAt: Date.now(),
        messages: message ? [{ id: uid('m'), from: 'contact', text: message, at: Date.now(), type: 'msg' }] : [],
      };
      state.tickets.unshift(t); save(); return t;
    },
    updateTicket(id, patch) { Object.assign(this.ticket(id), patch, { updatedAt: Date.now() }); save(); },
    addMessage(id, text, type = 'msg') {
      const t = this.ticket(id);
      t.messages.push({ id: uid('m'), from: type === 'note' ? state.settings.meId : 'agent', text, at: Date.now(), type });
      t.updatedAt = Date.now();
      if (type === 'msg' && t.status === 'aberto') t.status = 'andamento';
      save();
    },
    upsertDeal(data) {
      if (data.id) Object.assign(state.deals.find((d) => d.id === data.id), data);
      else { data.id = uid('d'); state.deals.push(data); }
      save();
    },
    moveDeal(id, stage) { state.deals.find((d) => d.id === id).stage = stage; save(); },
    deleteDeal(id) { state.deals = state.deals.filter((d) => d.id !== id); save(); },
  };
})();
