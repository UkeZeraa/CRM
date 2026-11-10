// Servidor HTTP: recebe o webhook do WhatsApp e verifica a agenda a cada 30 segundos.
import http from "node:http";
import { carregarDotEnv, lerConfig, validarParaProducao } from "./config.js";
import { criarEstado } from "./estado.js";
import { criarWhatsApp, assinaturaValida, extrairMensagens } from "./whatsapp.js";
import { criarBot } from "./bot.js";
import { formatarHorario } from "./agenda.js";

carregarDotEnv();
const config = lerConfig();
validarParaProducao(config);

const estado = criarEstado(config.arquivoEstado);
const whatsapp = criarWhatsApp(config);
const bot = criarBot({ config, estado, whatsapp });

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on("data", (p) => {
      tamanho += p.length;
      if (tamanho > 1_000_000) {
        reject(new Error("corpo grande demais"));
        req.destroy();
      } else partes.push(p);
    });
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/saude") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname !== "/webhook") {
    res.writeHead(404);
    return res.end();
  }

  // Verificação do webhook feita pela Meta ao salvar a URL no painel.
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === config.whatsapp.verifyToken;
    res.writeHead(ok ? 200 : 403);
    return res.end(ok ? url.searchParams.get("hub.challenge") : "");
  }

  if (req.method === "POST") {
    let corpo;
    try {
      corpo = await lerCorpo(req);
    } catch {
      res.writeHead(413);
      return res.end();
    }
    if (!config.dryRun && !assinaturaValida(corpo, req.headers["x-hub-signature-256"], config.whatsapp.appSecret)) {
      res.writeHead(401);
      return res.end();
    }
    res.writeHead(200); // responde logo; a Meta reenvia se demorar
    res.end();
    let payload;
    try {
      payload = JSON.parse(corpo.toString("utf8"));
    } catch {
      return;
    }
    for (const mensagem of extrairMensagens(payload)) {
      bot.receber(mensagem).catch((erro) => console.error("[webhook]", erro));
    }
    return;
  }

  res.writeHead(405);
  res.end();
});

servidor.listen(config.porta, () => {
  console.log(`Bot de quiz rodando na porta ${config.porta} (webhook em /webhook)${config.dryRun ? " — DRY_RUN" : ""}`);
});

async function ciclo() {
  await bot.verificarAgenda();
  for (const telefone of config.alunos) {
    const agenda = bot.agendaDe(telefone);
    if (agenda && !agenda.logado) {
      console.log(`[agenda] ${telefone} em ${agenda.data}: ${agenda.horarios.map(formatarHorario).join(", ") || "nenhum horário restante hoje"}`);
      agenda.logado = true;
    }
  }
}
ciclo();
setInterval(ciclo, 30_000);
