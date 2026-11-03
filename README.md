# Ascend CRM — Atendimento

CRM de atendimento com a identidade da **Ascend Digital**. Front-end puro (HTML/CSS/JS), sem build: abra o `index.html` no navegador.

## Funcionalidades
- **Visão geral** — KPIs (abertos, resolvidos hoje, 1ª resposta média, CSAT, pipeline), gráfico dos últimos 7 dias, volume por canal, atividade recente.
- **Atendimentos** — caixa de entrada multicanal (WhatsApp, E-mail, Instagram, Site, Telefone), filtros por status/"meus", conversa, respostas rápidas, notas internas, troca de status/prioridade/responsável, histórico do contato.
- **Contatos** — lista com busca e tags, cadastro/edição, ficha com atendimentos e oportunidades.
- **Funil de vendas** — kanban com arrastar e soltar entre etapas.
- **Configurações** — equipe, alternar usuário, tema claro/escuro, exportar JSON, restaurar dados.

Os dados ficam no `localStorage` do navegador (`js/store.js`) — é o ponto único para trocar por uma API/back-end.

## Identidade visual
Cores, fontes e raios ficam em **`css/brand.css`**. Os valores atuais são provisórios e devem ser alinhados com https://ascend-digital-kohl.vercel.app/. O logo está em `assets/logo.svg`.

## Rodar localmente
```bash
python3 -m http.server 8080
```
Depois acesse http://localhost:8080.
