// Simulador no terminal: converse com o bot como se fosse o WhatsApp, sem precisar da Meta.
// Uso: npm run simular   (com ANTHROPIC_API_KEY para quizzes gerados pelo Claude;
//                         sem a chave, usa o banco reserva de perguntas)
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { carregarDotEnv, lerConfig } from "../src/config.js";
import { criarEstado } from "../src/estado.js";
import { criarBot } from "../src/bot.js";
import { formatarHorario } from "../src/agenda.js";

carregarDotEnv();
process.env.ALUNOS = "5500000000000";
process.env.DRY_RUN = "1";
process.env.ARQUIVO_ESTADO = "./data/simulacao.json";
const config = lerConfig();

const whatsapp = {
  enviarTexto: async (_para, texto) => console.log(`\n🤖 Coach Sam:\n${texto}\n`),
  enviarModelo: async () => console.log("\n🤖 [modelo] Hora do quiz de inglês! Responda qualquer coisa para começar.\n"),
};
const bot = criarBot({ config, estado: criarEstado(config.arquivoEstado), whatsapp });

await bot.verificarAgenda();
const agenda = bot.agendaDe(config.alunos[0]);
console.log(`Horários sorteados para hoje: ${agenda.horarios.map(formatarHorario).join(", ") || "(nenhum restante)"}`);
console.log("Digite mensagens como se fosse o aluno. QUIZ inicia um quiz agora. Ctrl+C para sair.\n");

const rl = readline.createInterface({ input: stdin, output: stdout });
let n = 0;
while (true) {
  const texto = await rl.question("🧑 Você: ");
  await bot.receber({ id: `sim-${n++}`, de: config.alunos[0], texto });
}
