import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sortearHorarios, agoraNoFuso, posicaoNoCurso } from "../src/agenda.js";
import { opcaoEscolhida, quizReserva, normalizar } from "../src/quiz.js";
import { assinaturaValida, extrairMensagens } from "../src/whatsapp.js";
import { criarBot } from "../src/bot.js";
import { BANCO_RESERVA } from "../src/curriculo.js";

const AGENDA = { inicio: 8 * 60, fim: 17 * 60, min: 2, max: 3, intervaloMinimo: 120 };

test("sorteia 2 a 3 horários entre 8h e 17h, com 2h de intervalo", () => {
  for (let i = 0; i < 2000; i++) {
    const h = sortearHorarios(AGENDA);
    assert.ok(h.length >= 2 && h.length <= 3, `quantidade ${h.length}`);
    for (const m of h) assert.ok(m >= 480 && m < 1020, `fora da janela: ${m}`);
    for (let j = 1; j < h.length; j++) assert.ok(h[j] - h[j - 1] >= 120);
  }
});

test("horários variam de um dia para o outro", () => {
  const conjuntos = new Set(Array.from({ length: 50 }, () => sortearHorarios(AGENDA).join(",")));
  assert.ok(conjuntos.size > 40);
});

test("ligado no meio do dia, só agenda horários futuros e reduz a quantidade", () => {
  for (let i = 0; i < 500; i++) {
    const h = sortearHorarios(AGENDA, { aPartirDe: 14 * 60 });
    assert.ok(h.length >= 1 && h.length <= 2);
    for (const m of h) assert.ok(m > 840 && m < 1020);
  }
  assert.deepEqual(sortearHorarios(AGENDA, { aPartirDe: 17 * 60 }), []);
});

test("data/hora no fuso de Brasília", () => {
  const r = agoraNoFuso("America/Sao_Paulo", new Date("2026-11-10T11:30:00Z"));
  assert.deepEqual(r, { data: "2026-11-10", minutos: 8 * 60 + 30 });
  const virada = agoraNoFuso("America/Sao_Paulo", new Date("2026-11-11T02:00:00Z"));
  assert.equal(virada.data, "2026-11-10");
});

test("posição no curso (mês e semana)", () => {
  assert.deepEqual(posicaoNoCurso("2026-11-10", "2026-11-10"), { mes: 1, semana: 1, dias: 0 });
  assert.equal(posicaoNoCurso("2026-11-10", "2026-11-25").semana, 3);
  assert.equal(posicaoNoCurso("2026-11-10", "2027-03-15").mes, 5);
  assert.equal(posicaoNoCurso("2026-11-10", "2028-01-01").mes, 12);
});

test("múltipla escolha aceita letra, número e texto", () => {
  const p = { opcoes: ["a few", "a little", "much", "any"] };
  assert.equal(opcaoEscolhida(p, "a few"), "a few");
  assert.equal(opcaoEscolhida(p, "B"), "a little");
  assert.equal(opcaoEscolhida(p, "c)"), "much");
  assert.equal(opcaoEscolhida(p, "4"), "any");
  assert.equal(opcaoEscolhida(p, "banana"), undefined);
  assert.equal(normalizar("  I’m  GOING!  "), "i'm going");
});

test("banco reserva tem respostas válidas e respeita o mês", () => {
  for (const p of BANCO_RESERVA) assert.ok(p.opcoes.includes(p.resposta), p.pergunta);
  for (let mes = 1; mes <= 12; mes++) {
    const quiz = quizReserva(mes, 5);
    assert.equal(quiz.perguntas.length, mes === 1 ? 4 : 5);
    assert.equal(new Set(quiz.perguntas.map((p) => p.pergunta)).size, quiz.perguntas.length, "sem repetição");
  }
});

test("assinatura do webhook", () => {
  const corpo = Buffer.from('{"a":1}');
  const assinatura = "sha256=" + crypto.createHmac("sha256", "segredo").update(corpo).digest("hex");
  assert.equal(assinaturaValida(corpo, assinatura, "segredo"), true);
  assert.equal(assinaturaValida(corpo, assinatura, "outro"), false);
  assert.equal(assinaturaValida(corpo, "sha256=zz", "segredo"), false);
  assert.equal(assinaturaValida(corpo, undefined, "segredo"), false);
});

test("extrai texto e resposta de botão do webhook", () => {
  const payload = { entry: [{ changes: [{ value: { messages: [
    { id: "1", from: "5511", type: "text", text: { body: "B" } },
    { id: "2", from: "5511", type: "button", button: { text: "Começar" } },
  ] } }] }] };
  assert.deepEqual(extrairMensagens(payload).map((m) => m.texto), ["B", "Começar"]);
});

// ---- Fluxo completo com relógio e WhatsApp falsos ----
function montar(horaUtc) {
  let agora = new Date(horaUtc);
  const enviados = [];
  const dados = {};
  const estado = { aluno: (t, inicio) => (dados[t] ??= { telefone: t, inicioCurso: inicio, mesManual: null, pausado: false, ultimaMensagemRecebida: null, agenda: null, quizAtivo: null, historico: [], errosRecentes: [], pontos: 0, sequencia: { dias: 0, ultimaData: null } }), salvar() {} };
  const whatsapp = {
    enviarTexto: async (para, texto) => enviados.push({ tipo: "texto", texto }),
    enviarModelo: async () => enviados.push({ tipo: "modelo" }),
  };
  const quiz = {
    gerarQuiz: async ({ mes }) => quizReserva(mes, 2, () => 0),
    corrigir: async (p, r) => ({ correta: opcaoEscolhida(p, r) === p.resposta, feedback: "ok", versao_correta: p.resposta }),
    formatarPergunta: (p, i, t) => `P${i + 1}/${t}: ${p.pergunta}`,
  };
  const config = {
    alunos: ["5511"], inicioCurso: "2026-11-10", perguntasPorQuiz: 2,
    agenda: { ...AGENDA, fuso: "America/Sao_Paulo" }, claude: {},
  };
  const bot = criarBot({ config, estado, whatsapp, quiz, relogio: () => agora });
  return { bot, enviados, dados, avancar: (min) => { agora = new Date(agora.getTime() + min * 60_000); } };
}

test("fora da janela de 24h envia modelo; resposta do aluno inicia o quiz", async () => {
  const { bot, enviados, dados, avancar } = montar("2026-11-10T10:00:00Z"); // 07:00 em Brasília
  await bot.verificarAgenda();
  const [primeiro] = dados["5511"].agenda.horarios;
  avancar(primeiro - 7 * 60);
  await bot.verificarAgenda();
  assert.equal(enviados.at(-1).tipo, "modelo");
  await bot.receber({ id: "m1", de: "5511", texto: "Bora!" });
  assert.match(enviados.at(-1).texto, /P1\/2/);
  const q = dados["5511"].quizAtivo;
  await bot.receber({ id: "m2", de: "5511", texto: q.perguntas[0].resposta });
  await bot.receber({ id: "m3", de: "5511", texto: q.perguntas[1].resposta });
  assert.match(enviados.at(-1).texto, /2\/2/);
  assert.equal(dados["5511"].pontos, 40);
  assert.equal(dados["5511"].quizAtivo, null);
});

test("dentro da janela de 24h envia a pergunta direto; ignora número desconhecido e duplicatas", async () => {
  const { bot, enviados, dados, avancar } = montar("2026-11-10T10:00:00Z");
  await bot.receber({ id: "x", de: "5511", texto: "oi" });
  await bot.receber({ id: "x", de: "5511", texto: "oi" });
  await bot.receber({ id: "y", de: "9999", texto: "oi" });
  assert.equal(enviados.length, 1);
  await bot.verificarAgenda();
  const [primeiro] = dados["5511"].agenda.horarios;
  avancar(primeiro - 7 * 60 + 1);
  await bot.verificarAgenda();
  assert.match(enviados.at(-1).texto, /P1\/2/);
  await bot.verificarAgenda(); // não repete o mesmo horário
  assert.equal(enviados.filter((e) => /P1\/2/.test(e.texto ?? "")).length, 1);
});

test("PAUSAR impede quizzes automáticos e VOLTAR retoma", async () => {
  const { bot, enviados, dados, avancar } = montar("2026-11-10T10:00:00Z");
  await bot.receber({ id: "1", de: "5511", texto: "PAUSAR" });
  await bot.verificarAgenda();
  avancar(dados["5511"].agenda.horarios[0] - 7 * 60);
  await bot.verificarAgenda();
  assert.equal(enviados.length, 1);
  await bot.receber({ id: "2", de: "5511", texto: "voltar" });
  await bot.verificarAgenda();
  assert.match(enviados.at(-1).texto, /P1\/2/);
});
