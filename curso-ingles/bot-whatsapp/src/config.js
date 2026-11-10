// Lê a configuração das variáveis de ambiente (veja .env.example).
import fs from "node:fs";

// Carrega um arquivo .env simples (CHAVE=valor), sem dependências externas.
export function carregarDotEnv(caminho = ".env") {
  if (!fs.existsSync(caminho)) return;
  for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || linha.trim().startsWith("#")) continue;
    const [, chave, bruto] = m;
    const valor = bruto.replace(/^["']|["']$/g, "");
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

function hhmmParaMinutos(texto, padrao) {
  const m = String(texto ?? padrao).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Horário inválido: ${texto} (use HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function inteiro(nome, padrao) {
  const v = process.env[nome];
  if (v === undefined || v === "") return padrao;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${nome} deve ser um número inteiro`);
  return n;
}

export function lerConfig() {
  const env = process.env;
  const config = {
    whatsapp: {
      token: env.WHATSAPP_TOKEN ?? "",
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? "",
      appSecret: env.WHATSAPP_APP_SECRET ?? "",
      graphVersion: env.GRAPH_API_VERSION || "v23.0",
      templateName: env.WHATSAPP_TEMPLATE_NAME || "quiz_ingles_diario",
      templateLang: env.WHATSAPP_TEMPLATE_LANG || "pt_BR",
    },
    alunos: (env.ALUNOS ?? "")
      .split(",")
      .map((t) => t.replace(/\D/g, ""))
      .filter(Boolean),
    inicioCurso: env.INICIO_CURSO || new Date().toISOString().slice(0, 10),
    agenda: {
      fuso: env.FUSO_HORARIO || "America/Sao_Paulo",
      inicio: hhmmParaMinutos(env.JANELA_INICIO, "08:00"),
      fim: hhmmParaMinutos(env.JANELA_FIM, "17:00"),
      min: inteiro("QUIZZES_MIN_DIA", 2),
      max: inteiro("QUIZZES_MAX_DIA", 3),
      intervaloMinimo: inteiro("INTERVALO_MINIMO_MIN", 120),
    },
    perguntasPorQuiz: inteiro("PERGUNTAS_POR_QUIZ", 5),
    claude: {
      model: env.CLAUDE_MODEL || "claude-opus-5-5",
      effort: env.CLAUDE_EFFORT || "low",
    },
    porta: inteiro("PORT", 3000),
    arquivoEstado: env.ARQUIVO_ESTADO || "./data/estado.json",
    dryRun: env.DRY_RUN === "1",
  };

  const a = config.agenda;
  if (a.fim <= a.inicio) throw new Error("JANELA_FIM deve ser depois de JANELA_INICIO");
  if (a.min < 1 || a.max < a.min) throw new Error("QUIZZES_MIN_DIA/QUIZZES_MAX_DIA inválidos");
  return config;
}

export function validarParaProducao(config) {
  const faltando = [];
  if (!config.dryRun) {
    if (!config.whatsapp.token) faltando.push("WHATSAPP_TOKEN");
    if (!config.whatsapp.phoneNumberId) faltando.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!config.whatsapp.appSecret) faltando.push("WHATSAPP_APP_SECRET");
  }
  if (!config.whatsapp.verifyToken) faltando.push("WHATSAPP_VERIFY_TOKEN");
  if (config.alunos.length === 0) faltando.push("ALUNOS");
  if (faltando.length) {
    throw new Error(`Variáveis obrigatórias ausentes: ${faltando.join(", ")}`);
  }
}
