# Bot de WhatsApp — Quiz diário de inglês

Todo dia o bot **sorteia de 2 a 3 horários entre 8h e 17h (horário de Brasília)**, com pelo menos 2 horas de intervalo, e manda um **quiz relâmpago de 5 perguntas** no WhatsApp do aluno. Os horários mudam todo dia, e o aluno não sabe quando o próximo vai chegar.

- As perguntas são **geradas pelo Claude** de acordo com o mês e a semana do [plano de 12 meses](../plano-12-meses.md): 60% do conteúdo do mês atual, 30% de revisão de meses anteriores e 10% de reforço dos erros recentes do aluno.
- O bot corrige cada resposta na hora, com explicação em português, e reforça os erros nos quizzes seguintes.
- Tem **pontos, sequência de dias (🔥) e placar** para manter a motivação.
- Se a API do Claude falhar, o bot usa um **banco reserva** de 48 perguntas (4 por mês), e o aluno nunca fica sem quiz.

## Como o aluno usa

Ele só precisa responder às mensagens. Os comandos opcionais são:

| Comando | O que faz |
|---|---|
| `QUIZ` | Quiz extra na hora |
| `PULAR` | Pula a pergunta atual |
| `PARAR` | Encerra o quiz atual |
| `PLACAR` | Pontos, % de acertos e sequência |
| `MES 5` | Ajusta o mês do curso (1 a 12) |
| `PAUSAR` / `VOLTAR` | Pausa ou retoma os quizzes automáticos (férias, por exemplo) |
| `AJUDA` | Lista os comandos |

## Regra importante do WhatsApp: a janela de 24 horas

Pela política da Meta, uma empresa só pode mandar **mensagem livre** para quem falou com ela nas **últimas 24 horas**. Fora dessa janela, só pode mandar um **modelo de mensagem aprovado** (template). O bot trata isso sozinho:

- **O aluno respondeu nas últimas 24h:** o quiz chega direto, com a primeira pergunta.
- **O aluno não respondeu:** o bot envia o modelo ("Hora do quiz! Responda para começar"). Quando o aluno responde qualquer coisa, a primeira pergunta é enviada.

Como o aluno responde aos quizzes todo dia, quase sempre o quiz chega direto.

## Passo a passo de instalação

### 1. Crie o app na Meta (WhatsApp Cloud API, a API oficial)
1. Acesse **developers.facebook.com**, crie um app do tipo **Empresa** e adicione o produto **WhatsApp**.
2. Em *WhatsApp > Configuração da API*, anote o **ID do número de telefone**. Para testes, a Meta oferece um número grátis; para uso real, cadastre um número próprio que **não** esteja em uso no app do WhatsApp.
3. Crie um **token permanente**: *Configurações do negócio > Usuários do sistema > Gerar token*, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Em *Configurações do app > Básico*, copie a **Chave secreta do app** (App Secret).
5. No modo de teste, cadastre o número do aluno como destinatário permitido.

> **Por que não usar uma biblioteca "não oficial" (que conecta o WhatsApp Web)?** Ela viola os termos do WhatsApp, e o número pode ser **banido**. A Cloud API é o caminho seguro.

### 2. Crie o modelo de mensagem (template)
Em *WhatsApp > Gerenciar modelos*, crie:
- **Nome:** `quiz_ingles_diario` · **Idioma:** Português (BR) · **Categoria:** Utilidade. A Meta pode reclassificar o modelo como Marketing, que custa mais.
- **Corpo:** `Olá! ⏰ Chegou a hora do seu quiz de inglês de hoje. Responda esta mensagem para começar!`
- **Botão de resposta rápida (opcional):** `Começar`

Aguarde a aprovação, que costuma levar de minutos a algumas horas.

### 3. Pegue uma chave da API do Claude
Em **platform.claude.com**, crie uma chave de API. O consumo é baixo, porque cada quiz usa poucas chamadas curtas.

### 4. Configure e rode o bot
Requer **Node.js 20+**.

```bash
cd curso-ingles/bot-whatsapp
cp .env.example .env      # preencha os valores (tokens, número do aluno, data de início)
npm install
npm test                  # testes automáticos
npm start                 # servidor na porta 3000
```

Variáveis principais do `.env` (todas explicadas no [`.env.example`](.env.example)):

| Variável | Exemplo | Para que serve |
|---|---|---|
| `ALUNOS` | `5511999999999` | Número(s) do(s) aluno(s), separados por vírgula. Só eles podem usar o bot |
| `INICIO_CURSO` | `2026-11-10` | Data de início, que define o mês e a semana do currículo |
| `JANELA_INICIO` / `JANELA_FIM` | `08:00` / `17:00` | Janela de envio |
| `QUIZZES_MIN_DIA` / `QUIZZES_MAX_DIA` | `2` / `3` | Quantos quizzes por dia |
| `INTERVALO_MINIMO_MIN` | `120` | Distância mínima entre quizzes, em minutos |
| `CLAUDE_MODEL` / `CLAUDE_EFFORT` | `claude-opus-5-5` / `low` | Modelo e nível de raciocínio usados para criar e corrigir |

### 5. Publique o servidor e ligue o webhook
O bot precisa ficar **ligado 24h** num endereço **HTTPS público**. Algumas opções: Render, Railway, Fly.io, uma VPS ou qualquer servidor Node.
1. Faça o deploy e confirme que `https://SEU-DOMINIO/saude` responde `{"ok":true}`.
2. No painel da Meta, em *WhatsApp > Configuração > Webhook*, informe:
   - **URL de retorno:** `https://SEU-DOMINIO/webhook`
   - **Token de verificação:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
3. Assine o campo **`messages`**.

O estado (pontos, agenda e histórico) fica em `data/estado.json`. Em hospedagens com disco temporário, configure um **volume persistente** para essa pasta.

## Testar sem a Meta (simulador)

```bash
npm run simular
```

Abre uma conversa no terminal como se fosse o WhatsApp. Com `ANTHROPIC_API_KEY` no `.env`, os quizzes são gerados pelo Claude; sem a chave, o simulador usa o banco reserva. Também é possível rodar o servidor com `DRY_RUN=1`: nesse modo as mensagens são impressas no terminal em vez de enviadas, e a assinatura do webhook não é conferida, então use apenas localmente.

## Como funciona por dentro

| Arquivo | Responsabilidade |
|---|---|
| `src/agenda.js` | Sorteia os horários do dia (método de distribuição de folga: aleatório e sempre com o intervalo mínimo), calcula data e hora no fuso e o mês/semana do curso |
| `src/curriculo.js` | Resumo do currículo de 12 meses e banco reserva de perguntas |
| `src/quiz.js` | Gera o quiz e corrige respostas abertas com o Claude (saída estruturada em JSON); corrige múltipla escolha localmente, aceitando letra, número ou texto |
| `src/bot.js` | Fluxo: agenda, janela de 24h, quizzes, comandos, pontos e sequência |
| `src/whatsapp.js` | Envio pela Cloud API, validação da assinatura `X-Hub-Signature-256` e leitura do webhook |
| `src/server.js` | Servidor HTTP (`/webhook`, `/saude`) e verificação da agenda a cada 30 segundos |

Detalhes do comportamento:
- **Se o servidor ficar fora do ar** e perder um horário, o quiz é enviado assim que ele voltar, desde que o atraso seja de até 1 hora. Se vários horários vencerem juntos, vira um único quiz.
- **Se o aluno estiver no meio de um quiz** quando chegar o próximo horário, o novo espera até o aluno terminar ou ficar 30 minutos sem responder.
- **Se o bot for ligado no meio do dia**, ele sorteia apenas horários que ainda estão por vir.
- **Mensagens de números fora de `ALUNOS` são ignoradas.**
