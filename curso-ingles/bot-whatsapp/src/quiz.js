// Geração e correção de quizzes com o Claude, com banco reserva quando a API falha.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CURRICULO, BANCO_RESERVA } from "./curriculo.js";

const TIPOS = ["multipla_escolha", "completar", "traduzir", "corrigir_frase", "responder_em_ingles"];

const PerguntaSchema = z.object({
  tipo: z.enum(TIPOS),
  pergunta: z.string().describe("Enunciado curto, com instrução em português e a frase em inglês"),
  opcoes: z.array(z.string()).describe("4 opções para multipla_escolha; lista vazia nos outros tipos"),
  resposta: z.string().describe("Resposta correta (para multipla_escolha, o texto exato de uma das opções)"),
  explicacao: z.string().describe("Explicação em 1 frase, em português"),
});

const QuizSchema = z.object({
  tema: z.string().describe("Tema do quiz em poucas palavras"),
  perguntas: z.array(PerguntaSchema),
});

const CorrecaoSchema = z.object({
  correta: z.boolean(),
  feedback: z.string().describe("1 a 2 frases em português, gentis e específicas"),
  versao_correta: z.string().describe("Como a resposta ficaria correta e natural em inglês"),
});

const SISTEMA = `Você é "Coach Sam", tutora de inglês de um(a) aluno(a) brasileiro(a) num curso de 12 meses
(do iniciante que só sabe o verbo to be até o intermediário B1/B1+). Você cria quizzes rápidos
enviados pelo WhatsApp: perguntas curtas, que caibam na tela do celular, sem markdown complexo.
Nunca reproduza letras de músicas; quando citar uma música, use só o título e a estrutura gramatical.`;

let cliente;
function claude() {
  cliente ??= new Anthropic();
  return cliente;
}

function sortear(lista, n, aleatorio = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, n);
}

/** Escolhe o foco do quiz: mês atual (60%), revisão de meses anteriores (30%) ou erros recentes (10%). */
export function escolherFoco(mes, temErros, aleatorio = Math.random) {
  const r = aleatorio();
  if (temErros && r < 0.1) return { tipo: "erros", meses: [mes] };
  if (mes > 1 && r < 0.4) {
    const anterior = 1 + Math.floor(aleatorio() * (mes - 1));
    return { tipo: "revisao", meses: [anterior, mes] };
  }
  return { tipo: "mes_atual", meses: [mes] };
}

export async function gerarQuiz({ mes, semana, quantidade, errosRecentes = [], config }) {
  const foco = escolherFoco(mes, errosRecentes.length > 0);
  const conteudo = foco.meses
    .map((m) => `Mês ${m} (${CURRICULO[m].nivel}) — gramática: ${CURRICULO[m].gramatica}; vocabulário: ${CURRICULO[m].vocabulario}; músicas: ${CURRICULO[m].musicas.join(", ")}`)
    .join("\n");
  const erros = errosRecentes.length
    ? `\nErros recentes do aluno (reforce pelo menos 1 deles com uma pergunta parecida, sem repetir igual):\n${errosRecentes.map((e) => `- ${e.pergunta} → correto: ${e.resposta}`).join("\n")}`
    : "";
  const pedido = `Crie um quiz de ${quantidade} perguntas para o aluno, que está no mês ${mes}, semana ${semana}.
Foco: ${foco.tipo === "revisao" ? "revisão misturando os meses abaixo" : foco.tipo === "erros" ? "reforço dos erros recentes" : "conteúdo do mês atual"}.
${conteudo}${erros}

Regras:
- Use apenas estruturas já estudadas até o mês ${mes}.
- Misture tipos: ${TIPOS.join(", ")}. Pelo menos 2 de múltipla escolha.
- "responder_em_ingles" é uma pergunta pessoal simples para o aluno responder com uma frase usando a estrutura do mês.
- Enunciados em português nos meses 1–6; a partir do mês 7, enunciados em inglês simples.
- Varie os temas do dia a dia. Seja criativa para o quiz não ficar repetitivo.`;

  try {
    const resposta = await claude().messages.parse({
      model: config.claude.model,
      max_tokens: 16000,
      output_config: { effort: config.claude.effort, format: zodOutputFormat(QuizSchema) },
      system: SISTEMA,
      messages: [{ role: "user", content: pedido }],
    });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      throw new Error(`Quiz não gerado (stop_reason=${resposta.stop_reason})`);
    }
    const perguntas = resposta.parsed_output.perguntas
      .filter((p) => p.tipo !== "multipla_escolha" || p.opcoes.includes(p.resposta))
      .slice(0, quantidade);
    if (perguntas.length === 0) throw new Error("Quiz vazio");
    return { tema: resposta.parsed_output.tema, perguntas, origem: "claude" };
  } catch (erro) {
    console.error("[quiz] usando banco reserva:", erro.message);
    return quizReserva(mes, quantidade);
  }
}

export function quizReserva(mes, quantidade, aleatorio = Math.random) {
  const doMes = BANCO_RESERVA.filter((p) => p.mes === mes);
  const escolhidas = sortear(doMes, Math.min(doMes.length, Math.ceil(quantidade / 2)), aleatorio);
  // Completa com perguntas de meses anteriores (ou do próprio mês, se for o mês 1), sem repetir.
  const resto = BANCO_RESERVA.filter((p) => p.mes <= mes && !escolhidas.includes(p));
  const anteriores = resto.filter((p) => p.mes < mes);
  escolhidas.push(...sortear(anteriores.length ? anteriores : resto, quantidade - escolhidas.length, aleatorio));
  return {
    tema: `Revisão até o mês ${mes}`,
    perguntas: sortear(escolhidas, escolhidas.length, aleatorio).map(({ mes: _m, ...p }) => p),
    origem: "reserva",
  };
}

export function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Para múltipla escolha aceita o texto da opção, a letra (A–D) ou o número (1–4). */
export function opcaoEscolhida(pergunta, resposta) {
  const r = normalizar(resposta);
  const porTexto = pergunta.opcoes.find((o) => normalizar(o) === r);
  if (porTexto !== undefined) return porTexto;
  const letra = String(resposta).trim().toLowerCase().match(/^\(?([a-d])(?:[).:\-\s]|$)/);
  if (letra) return pergunta.opcoes["abcd".indexOf(letra[1])];
  const numero = r.match(/^([1-4])$/);
  if (numero) return pergunta.opcoes[Number(numero[1]) - 1];
  return undefined;
}

export async function corrigir(pergunta, resposta, config) {
  if (pergunta.tipo === "multipla_escolha") {
    const escolhida = opcaoEscolhida(pergunta, resposta);
    const correta = escolhida !== undefined && normalizar(escolhida) === normalizar(pergunta.resposta);
    return {
      correta,
      feedback: escolhida === undefined
        ? `Não reconheci a opção. A resposta era: ${pergunta.resposta}. ${pergunta.explicacao}`
        : correta ? `Isso! ${pergunta.explicacao}` : `Quase! A certa é "${pergunta.resposta}". ${pergunta.explicacao}`,
      versao_correta: pergunta.resposta,
    };
  }

  if (normalizar(resposta) === normalizar(pergunta.resposta)) {
    return { correta: true, feedback: `Perfeito! ${pergunta.explicacao}`, versao_correta: pergunta.resposta };
  }

  try {
    const r = await claude().messages.parse({
      model: config.claude.model,
      max_tokens: 4000,
      output_config: { effort: config.claude.effort, format: zodOutputFormat(CorrecaoSchema) },
      system: SISTEMA,
      messages: [{
        role: "user",
        content: `Corrija a resposta do aluno. Seja tolerante com maiúsculas, pontuação e pequenos erros de digitação;
considere correta qualquer resposta gramaticalmente certa que cumpra o enunciado, mesmo que diferente da resposta de referência.

Tipo: ${pergunta.tipo}
Pergunta: ${pergunta.pergunta}
Resposta de referência: ${pergunta.resposta}
Resposta do aluno: ${resposta}`,
      }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) throw new Error(`stop_reason=${r.stop_reason}`);
    return r.parsed_output;
  } catch (erro) {
    console.error("[quiz] correção sem IA:", erro.message);
    return {
      correta: false,
      feedback: `Uma resposta possível é: "${pergunta.resposta}". ${pergunta.explicacao} Compare com a sua!`,
      versao_correta: pergunta.resposta,
    };
  }
}

export function formatarPergunta(pergunta, indice, total) {
  let texto = `*Pergunta ${indice + 1}/${total}*\n${pergunta.pergunta}`;
  if (pergunta.tipo === "multipla_escolha") {
    texto += "\n" + pergunta.opcoes.map((o, i) => `${"ABCD"[i]}) ${o}`).join("\n");
    texto += "\n\n_Responda com a letra._";
  }
  return texto;
}
