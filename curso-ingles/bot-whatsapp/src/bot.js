// Regras do bot: agenda diária, início/condução dos quizzes, comandos e pontuação.
import { agoraNoFuso, sortearHorarios, posicaoNoCurso } from "./agenda.js";
import * as quizPadrao from "./quiz.js";

const JANELA_24H_MS = 23.5 * 60 * 60 * 1000; // margem de segurança antes das 24h da Meta
const OCIOSO_MS = 30 * 60 * 1000; // quiz parado há 30 min pode ser substituído
const ATRASO_MAXIMO_MIN = 60; // um horário perdido (servidor fora do ar) vale por até 1h

const ABERTURAS = [
  "⏰ Hora do quiz relâmpago de inglês!",
  "🇺🇸 Pausa de 3 minutos para o seu inglês!",
  "🧠 Desafio surpresa: bora treinar?",
  "🎯 Quiz rápido! Vamos ver o que você lembra.",
  "☕ Que tal um quiz enquanto toma um café?",
];

const AJUDA = `*Comandos*
QUIZ – quiz extra agora
PULAR – pula a pergunta atual
PARAR – encerra o quiz atual
PLACAR – seus pontos e sequência
MES 5 – muda o mês do curso (1 a 12)
PAUSAR / VOLTAR – pausa ou retoma os quizzes automáticos
AJUDA – mostra esta lista

Os quizzes chegam sozinhos 2 a 3 vezes por dia, em horários surpresa entre 8h e 17h. 😉`;

export function criarBot({ config, estado, whatsapp, quiz = quizPadrao, relogio = () => new Date(), aleatorio = Math.random }) {
  const vistos = new Set();
  let fila = Promise.resolve();
  // Executa uma tarefa por vez, para mensagens e agenda não se atropelarem.
  const emFila = (tarefa) => {
    const proxima = fila.then(tarefa, tarefa);
    fila = proxima.catch((erro) => console.error("[bot]", erro));
    return proxima;
  };

  const alunoDe = (telefone) => estado.aluno(telefone, config.inicioCurso);
  const hoje = () => agoraNoFuso(config.agenda.fuso, relogio());

  function posicao(aluno) {
    const pos = posicaoNoCurso(aluno.inicioCurso, hoje().data);
    return aluno.mesManual ? { ...pos, mes: aluno.mesManual } : pos;
  }

  function dentroDaJanela(aluno) {
    if (!aluno.ultimaMensagemRecebida) return false;
    return relogio().getTime() - Date.parse(aluno.ultimaMensagemRecebida) < JANELA_24H_MS;
  }

  async function enviarPerguntaAtual(aluno, prefixo = "") {
    const q = aluno.quizAtivo;
    const texto = quiz.formatarPergunta(q.perguntas[q.indice], q.indice, q.perguntas.length);
    await whatsapp.enviarTexto(aluno.telefone, prefixo ? `${prefixo}\n\n${texto}` : texto);
  }

  async function comecarPerguntas(aluno) {
    const q = aluno.quizAtivo;
    q.status = "em_andamento";
    q.ultimaAtividade = relogio().toISOString();
    const abertura = ABERTURAS[Math.floor(aleatorio() * ABERTURAS.length)];
    const { mes } = posicao(aluno);
    await enviarPerguntaAtual(aluno, `${abertura}\n📚 Mês ${mes} · ${q.tema} · ${q.perguntas.length} perguntas`);
  }

  function registrarFim(aluno, completo) {
    const q = aluno.quizAtivo;
    const acertos = q.respostas.filter((r) => r.correta).length;
    const total = q.perguntas.length;
    let ganhos = 0;
    if (completo) {
      ganhos = acertos * 10 + (acertos === total ? 20 : 0);
      aluno.pontos += ganhos;
      const { data } = hoje();
      const seq = aluno.sequencia;
      if (seq.ultimaData !== data) {
        const ontem = new Date(Date.parse(`${data}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
        seq.dias = seq.ultimaData === ontem ? seq.dias + 1 : 1;
        seq.ultimaData = data;
      }
    }
    aluno.historico.push({
      data: hoje().data,
      mes: posicao(aluno).mes,
      acertos,
      respondidas: q.respostas.length,
      total,
      completo,
      origem: q.origem,
    });
    aluno.historico = aluno.historico.slice(-200);
    aluno.quizAtivo = null;
    return { acertos, total, ganhos };
  }

  function resumoFinal(aluno, { acertos, total, ganhos }) {
    const pct = acertos / total;
    const elogio = pct === 1 ? "🏆 Gabaritou! Incrível!" : pct >= 0.7 ? "👏 Muito bem!" : pct >= 0.4 ? "💪 Bom treino, continue!" : "🌱 Errar faz parte de aprender. Amanhã tem mais!";
    return `${elogio}\nResultado: *${acertos}/${total}* (+${ganhos} pontos)\n⭐ Total: ${aluno.pontos} pontos · 🔥 Sequência: ${aluno.sequencia.dias} dia(s)`;
  }

  async function iniciarQuiz(aluno, { automatico }) {
    if (aluno.quizAtivo) registrarFim(aluno, false); // quiz anterior abandonado
    const { mes, semana } = posicao(aluno);
    const novo = await quiz.gerarQuiz({
      mes,
      semana,
      quantidade: config.perguntasPorQuiz,
      errosRecentes: aluno.errosRecentes.slice(-5),
      config,
    });
    aluno.quizAtivo = {
      tema: novo.tema,
      origem: novo.origem,
      perguntas: novo.perguntas,
      indice: 0,
      respostas: [],
      status: "aguardando_inicio",
      criadoEm: relogio().toISOString(),
      ultimaAtividade: relogio().toISOString(),
      automatico,
    };
    if (dentroDaJanela(aluno)) {
      await comecarPerguntas(aluno);
    } else {
      // Fora da janela de 24h: só um modelo aprovado pode abrir a conversa.
      await whatsapp.enviarModelo(aluno.telefone);
    }
    estado.salvar();
  }

  async function responderPergunta(aluno, texto, { pulou = false } = {}) {
    const q = aluno.quizAtivo;
    const pergunta = q.perguntas[q.indice];
    const correcao = pulou
      ? { correta: false, feedback: `Pulada! A resposta era: "${pergunta.resposta}". ${pergunta.explicacao}`, versao_correta: pergunta.resposta }
      : await quiz.corrigir(pergunta, texto, config);
    q.respostas.push({ resposta: texto, correta: correcao.correta });
    q.ultimaAtividade = relogio().toISOString();
    if (!correcao.correta) {
      aluno.errosRecentes.push({ pergunta: pergunta.pergunta, resposta: correcao.versao_correta || pergunta.resposta });
      aluno.errosRecentes = aluno.errosRecentes.slice(-10);
    }
    const retorno = `${correcao.correta ? "✅" : "❌"} ${correcao.feedback}`;
    q.indice += 1;
    if (q.indice < q.perguntas.length) {
      await enviarPerguntaAtual(aluno, retorno);
    } else {
      const resultado = registrarFim(aluno, true);
      await whatsapp.enviarTexto(aluno.telefone, `${retorno}\n\n${resumoFinal(aluno, resultado)}`);
    }
    estado.salvar();
  }

  async function tratarComando(aluno, texto) {
    if (texto.trim().split(/\s+/).length > 2) return false; // frases longas são respostas, não comandos
    const [comando, argumento] = texto.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/);
    switch (comando) {
      case "AJUDA":
      case "MENU":
      case "HELP":
        await whatsapp.enviarTexto(aluno.telefone, AJUDA);
        return true;
      case "QUIZ":
        await iniciarQuiz(aluno, { automatico: false });
        return true;
      case "PLACAR": {
        const feitos = aluno.historico.filter((h) => h.completo);
        const acertos = feitos.reduce((s, h) => s + h.acertos, 0);
        const total = feitos.reduce((s, h) => s + h.total, 0);
        const { mes, semana } = posicao(aluno);
        await whatsapp.enviarTexto(aluno.telefone,
          `📊 *Seu placar*\nMês ${mes}, semana ${semana}\nQuizzes completos: ${feitos.length}\nAcertos: ${total ? Math.round((acertos / total) * 100) : 0}%\n⭐ ${aluno.pontos} pontos · 🔥 ${aluno.sequencia.dias} dia(s) seguidos`);
        return true;
      }
      case "PAUSAR":
        aluno.pausado = true;
        await whatsapp.enviarTexto(aluno.telefone, "⏸️ Quizzes automáticos pausados. Mande VOLTAR quando quiser retomar.");
        return true;
      case "VOLTAR":
        aluno.pausado = false;
        await whatsapp.enviarTexto(aluno.telefone, "▶️ Quizzes automáticos de volta! O próximo chega em um horário surpresa.");
        return true;
      case "MES": {
        const n = Number.parseInt(argumento, 10);
        if (!(n >= 1 && n <= 12)) {
          await whatsapp.enviarTexto(aluno.telefone, "Use: MES seguido de um número de 1 a 12. Ex.: MES 4");
          return true;
        }
        aluno.mesManual = n;
        await whatsapp.enviarTexto(aluno.telefone, `📚 Combinado! Os próximos quizzes serão do mês ${n}.`);
        return true;
      }
      case "PULAR":
        if (!aluno.quizAtivo || aluno.quizAtivo.status !== "em_andamento") return false;
        await responderPergunta(aluno, "(pulou)", { pulou: true });
        return true;
      case "PARAR":
        if (!aluno.quizAtivo) return false;
        registrarFim(aluno, false);
        await whatsapp.enviarTexto(aluno.telefone, "🛑 Quiz encerrado. Até o próximo!");
        return true;
      default:
        return false;
    }
  }

  async function processarMensagem({ id, de, texto }) {
    if (id && vistos.has(id)) return; // a Meta pode reenviar o mesmo webhook
    if (id) {
      vistos.add(id);
      if (vistos.size > 1000) vistos.delete(vistos.values().next().value);
    }
    if (!config.alunos.includes(de)) {
      console.warn(`[bot] mensagem ignorada de número não cadastrado: ${de}`);
      return;
    }
    const aluno = alunoDe(de);
    aluno.ultimaMensagemRecebida = relogio().toISOString();

    if (!texto) {
      await whatsapp.enviarTexto(de, "Por enquanto eu só entendo mensagens de texto. ✍️");
    } else if (await tratarComando(aluno, texto)) {
      // comando já tratado
    } else if (aluno.quizAtivo?.status === "aguardando_inicio") {
      await comecarPerguntas(aluno);
    } else if (aluno.quizAtivo?.status === "em_andamento") {
      await responderPergunta(aluno, texto);
    } else {
      await whatsapp.enviarTexto(de, `Oi! Agora não tem quiz aberto. O próximo chega num horário surpresa. 😉\nMande QUIZ para treinar agora ou AJUDA para ver os comandos.`);
    }
    estado.salvar();
  }

  async function verificarAgenda() {
    const agora = hoje();
    for (const telefone of config.alunos) {
      const aluno = alunoDe(telefone);
      if (aluno.agenda?.data !== agora.data) {
        aluno.agenda = {
          data: agora.data,
          horarios: sortearHorarios(config.agenda, { aPartirDe: agora.minutos, aleatorio }),
          enviados: [],
        };
        estado.salvar();
      }
      if (aluno.pausado) continue;

      const vencidos = aluno.agenda.horarios.filter((h) => h <= agora.minutos && !aluno.agenda.enviados.includes(h));
      if (vencidos.length === 0) continue;

      const q = aluno.quizAtivo;
      const ocupado = q?.status === "em_andamento" && relogio().getTime() - Date.parse(q.ultimaAtividade) < OCIOSO_MS;
      const ultimo = vencidos[vencidos.length - 1];
      if (agora.minutos - ultimo > ATRASO_MAXIMO_MIN) {
        aluno.agenda.enviados.push(...vencidos); // perdido há muito tempo: descarta
        estado.salvar();
        continue;
      }
      if (ocupado) continue; // aluno no meio de um quiz: tenta de novo no próximo ciclo

      aluno.agenda.enviados.push(...vencidos); // vários vencidos juntos viram um só quiz
      estado.salvar();
      try {
        await iniciarQuiz(aluno, { automatico: true });
      } catch (erro) {
        console.error(`[bot] falha ao enviar quiz para ${telefone}:`, erro.message);
      }
    }
  }

  return {
    receber: (mensagem) => emFila(() => processarMensagem(mensagem)),
    verificarAgenda: () => emFila(verificarAgenda),
    agendaDe: (telefone) => alunoDe(telefone).agenda,
  };
}
