// Sorteio dos horários diários dos quizzes e utilitários de data/hora no fuso do aluno.

/** Data (AAAA-MM-DD) e minutos desde a meia-noite no fuso informado. */
export function agoraNoFuso(fuso, data = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(data)
      .map((p) => [p.type, p.value]),
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

export function formatarHorario(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function inteiroAleatorio(min, max, aleatorio) {
  return min + Math.floor(aleatorio() * (max - min + 1));
}

/**
 * Sorteia de `min` a `max` horários em [inicio, fim), com pelo menos `intervaloMinimo`
 * minutos entre eles. Se `aPartirDe` for informado (bot ligado no meio do dia), só usa
 * horários depois dele e reduz a quantidade se não couber.
 * Retorna minutos desde a meia-noite, em ordem crescente.
 */
export function sortearHorarios(
  { inicio, fim, min, max, intervaloMinimo },
  { aPartirDe = 0, aleatorio = Math.random } = {},
) {
  const comeco = Math.max(inicio, aPartirDe + 1);
  if (comeco >= fim) return [];

  let quantidade = inteiroAleatorio(min, max, aleatorio);
  // Quantos cabem com o intervalo mínimo?
  const cabem = Math.floor((fim - 1 - comeco) / intervaloMinimo) + 1;
  quantidade = Math.min(quantidade, Math.max(cabem, 0));
  if (quantidade <= 0) return [];

  // Método da "folga": distribui aleatoriamente o tempo livre entre os intervalos,
  // garantindo o espaçamento mínimo sem tentativa e erro.
  const folgaTotal = fim - 1 - comeco - (quantidade - 1) * intervaloMinimo;
  const cortes = Array.from({ length: quantidade }, () =>
    Math.floor(aleatorio() * (folgaTotal + 1)),
  ).sort((a, b) => a - b);
  return cortes.map((corte, i) => comeco + corte + i * intervaloMinimo);
}

/** Mês (1–12) e semana (1–4) do currículo a partir da data de início do curso. */
export function posicaoNoCurso(inicioCurso, dataHoje) {
  const inicio = Date.parse(`${inicioCurso}T00:00:00Z`);
  const hoje = Date.parse(`${dataHoje}T00:00:00Z`);
  const dias = Math.max(0, Math.round((hoje - inicio) / 86_400_000));
  const DIAS_POR_MES = 365 / 12;
  const mes = Math.min(12, Math.floor(dias / DIAS_POR_MES) + 1);
  const diaNoMes = dias - (mes - 1) * DIAS_POR_MES;
  const semana = Math.min(4, Math.floor(diaNoMes / 7) + 1);
  return { mes, semana, dias };
}
