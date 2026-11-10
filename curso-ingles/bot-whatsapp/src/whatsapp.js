// Envio de mensagens e validação de webhooks da WhatsApp Cloud API (Meta).
import crypto from "node:crypto";

export function criarWhatsApp(config) {
  const { token, phoneNumberId, graphVersion, templateName, templateLang } = config.whatsapp;
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  async function enviar(corpo) {
    if (config.dryRun) {
      const texto = corpo.type === "text" ? corpo.text.body : `[modelo ${corpo.template.name}]`;
      console.log(`\n📤 Para ${corpo.to}:\n${texto}\n`);
      return { dryRun: true };
    }
    const resposta = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...corpo }),
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(`WhatsApp API ${resposta.status}: ${JSON.stringify(json.error ?? json)}`);
    }
    return json;
  }

  return {
    enviarTexto: (para, texto) =>
      enviar({ to: para, type: "text", text: { body: texto.slice(0, 4096) } }),
    // Fora da janela de 24h a Meta só permite iniciar conversa com um modelo aprovado.
    enviarModelo: (para) =>
      enviar({
        to: para,
        type: "template",
        template: { name: templateName, language: { code: templateLang } },
      }),
  };
}

/** Confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto com a App Secret). */
export function assinaturaValida(corpoBruto, cabecalho, appSecret) {
  if (!appSecret || !cabecalho?.startsWith("sha256=")) return false;
  const esperado = crypto.createHmac("sha256", appSecret).update(corpoBruto).digest("hex");
  const recebido = Buffer.from(cabecalho.slice("sha256=".length), "utf8");
  const calculado = Buffer.from(esperado, "utf8");
  return recebido.length === calculado.length && crypto.timingSafeEqual(recebido, calculado);
}

/** Extrai as mensagens recebidas (texto ou botão de resposta rápida) do payload do webhook. */
export function extrairMensagens(payload) {
  const mensagens = [];
  for (const entrada of payload?.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      for (const m of mudanca.value?.messages ?? []) {
        const texto =
          m.type === "text" ? m.text?.body
          : m.type === "button" ? m.button?.text
          : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
          : undefined;
        mensagens.push({ id: m.id, de: m.from, texto: texto ?? null, tipo: m.type });
      }
    }
  }
  return mensagens;
}
