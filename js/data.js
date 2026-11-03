/* Dados de exemplo — usados apenas na primeira execução (ou ao restaurar). */
window.SEED = (() => {
  const now = Date.now();
  const h = (n) => now - n * 3600e3;
  const d = (n) => now - n * 86400e3;

  const agents = [
    { id: 'a1', name: 'Kaique Silva', role: 'Supervisor' },
    { id: 'a2', name: 'Marina Costa', role: 'Atendente' },
    { id: 'a3', name: 'Rafael Lima', role: 'Atendente' },
  ];

  const contacts = [
    { id: 'c1', name: 'Juliana Alves', email: 'juliana@lojaflor.com.br', phone: '(11) 98877-1020', company: 'Loja Flor', tags: ['VIP'], createdAt: d(40) },
    { id: 'c2', name: 'Pedro Henrique', email: 'pedro@techno.io', phone: '(21) 99654-3321', company: 'Techno', tags: ['Lead'], createdAt: d(12) },
    { id: 'c3', name: 'Carla Mendes', email: 'carla@clinicavida.com', phone: '(31) 98123-4455', company: 'Clínica Vida', tags: ['Cliente'], createdAt: d(90) },
    { id: 'c4', name: 'Bruno Rocha', email: 'bruno@rochafit.com', phone: '(41) 99777-8899', company: 'Rocha Fit', tags: ['Cliente'], createdAt: d(25) },
    { id: 'c5', name: 'Amanda Souza', email: 'amanda@studioas.com', phone: '(51) 98456-1122', company: 'Studio AS', tags: ['Lead'], createdAt: d(3) },
    { id: 'c6', name: 'Lucas Ferreira', email: 'lucas@ferreiraadv.com', phone: '(61) 99311-7788', company: 'Ferreira Advocacia', tags: ['VIP', 'Cliente'], createdAt: d(150) },
  ];

  const m = (from, text, at, type = 'msg') => ({ id: Math.random().toString(36).slice(2, 9), from, text, at, type });

  const tickets = [
    { id: 't1', number: 1042, contactId: 'c1', subject: 'Campanha de Black Friday', channel: 'WhatsApp', status: 'aberto', priority: 'alta', agentId: 'a2', unread: true, createdAt: h(1), updatedAt: h(0.3),
      messages: [m('contact', 'Oi! Queremos começar a campanha de Black Friday essa semana. Conseguem montar os criativos?', h(1)), m('contact', 'Orçamento de até R$ 5 mil em mídia.', h(0.3))] },
    { id: 't2', number: 1041, contactId: 'c2', subject: 'Dúvida sobre proposta de site', channel: 'E-mail', status: 'andamento', priority: 'media', agentId: 'a1', unread: false, createdAt: h(5), updatedAt: h(2),
      messages: [m('contact', 'Recebi a proposta, mas queria entender se a hospedagem está inclusa.', h(5)), m('agent', 'Olá Pedro! Sim, o primeiro ano de hospedagem está incluso. Posso te ligar para detalhar?', h(4)), m('contact', 'Pode sim, amanhã às 10h.', h(2))] },
    { id: 't3', number: 1040, contactId: 'c3', subject: 'Relatório mensal de tráfego', channel: 'Instagram', status: 'aguardando', priority: 'baixa', agentId: 'a3', unread: false, createdAt: d(1), updatedAt: h(20),
      messages: [m('contact', 'Vocês podem enviar o relatório de outubro?', d(1)), m('agent', 'Claro, Carla! Envio até amanhã.', h(22)), m('a3', 'Aguardando dados do Google Ads para fechar.', h(20), 'note')] },
    { id: 't4', number: 1039, contactId: 'c4', subject: 'Ajuste no anúncio do Meta', channel: 'WhatsApp', status: 'resolvido', priority: 'media', agentId: 'a2', unread: false, createdAt: d(2), updatedAt: h(30), csat: 5,
      messages: [m('contact', 'O anúncio está com o preço errado.', d(2)), m('agent', 'Corrigido, Bruno! Já está no ar com o valor certo.', h(30))] },
    { id: 't5', number: 1038, contactId: 'c5', subject: 'Quero um orçamento de gestão de redes', channel: 'Site', status: 'aberto', priority: 'media', agentId: null, unread: true, createdAt: h(3), updatedAt: h(3),
      messages: [m('contact', 'Olá, vi o site de vocês e queria um orçamento para gestão de Instagram e TikTok.', h(3))] },
    { id: 't6', number: 1037, contactId: 'c6', subject: 'Renovação de contrato', channel: 'E-mail', status: 'resolvido', priority: 'alta', agentId: 'a1', unread: false, createdAt: d(4), updatedAt: d(3), csat: 4,
      messages: [m('contact', 'Gostaria de renovar por mais 12 meses.', d(4)), m('agent', 'Perfeito, Lucas! Contrato enviado para assinatura.', d(3))] },
  ];

  const stages = [
    { id: 'novo', name: 'Novo lead' },
    { id: 'qualificado', name: 'Qualificado' },
    { id: 'proposta', name: 'Proposta enviada' },
    { id: 'negociacao', name: 'Negociação' },
    { id: 'ganho', name: 'Fechado / ganho' },
  ];

  const deals = [
    { id: 'd1', title: 'Gestão de redes', contactId: 'c5', value: 2400, stage: 'novo', agentId: 'a2' },
    { id: 'd2', title: 'Site institucional', contactId: 'c2', value: 8900, stage: 'proposta', agentId: 'a1' },
    { id: 'd3', title: 'Black Friday — mídia paga', contactId: 'c1', value: 5000, stage: 'qualificado', agentId: 'a2' },
    { id: 'd4', title: 'SEO 6 meses', contactId: 'c3', value: 7200, stage: 'negociacao', agentId: 'a3' },
    { id: 'd5', title: 'Renovação anual', contactId: 'c6', value: 18000, stage: 'ganho', agentId: 'a1' },
  ];

  return { agents, contacts, tickets, stages, deals, settings: { meId: 'a1', theme: 'dark', nextTicket: 1043 } };
})();
