const axios = require("axios");
const { getConfig } = require("./configLoader");
const { processMessage, clearHistory } = require("./ai");
const { getCategories } = require("./products");

let running = false;
let offset = 0;
let connected = false;
let currentToken = null;

/**
 * Call Telegram Bot API.
 */
async function tg(token, method, params = {}) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const { data } = await axios.post(url, params);
  return data.result;
}

/**
 * Send a message safely — tries Markdown, falls back to plain text.
 */
async function safeSend(token, chatId, text) {
  try {
    await tg(token, "sendMessage", { chat_id: chatId, text, parse_mode: "Markdown" });
  } catch {
    const plain = text
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    await tg(token, "sendMessage", { chat_id: chatId, text: plain });
  }
}

/**
 * Handle a single incoming Telegram message.
 */
async function handleMessage(token, msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const userName = msg.from?.first_name || "Cliente";

  // /start
  if (text === "/start") {
    clearHistory(chatId);
    await safeSend(token, chatId, getConfig().welcomeMessage);
    return;
  }

  // /ayuda or /help
  if (text === "/ayuda" || text === "/help") {
    const helpText =
      `*¿Cómo puedo ayudarte?*\n\n` +
      `Podés preguntarme cosas como:\n` +
      `• "¿Tenés pantalla para Samsung A52?"\n` +
      `• "¿Cuánto cuesta una batería para iPhone 11?"\n` +
      `• "¿Tienen flex de carga para Xiaomi Redmi 9A?"\n\n` +
      `Simplemente escribí tu consulta y te respondo 🙂`;
    await safeSend(token, chatId, helpText);
    return;
  }

  // /categorias
  if (text === "/categorias") {
    try {
      const cats = await getCategories();
      const reply = `*Categorías disponibles:*\n\n` + cats.map((c) => `• ${c}`).join("\n");
      await safeSend(token, chatId, reply);
    } catch (err) {
      console.error("[Bot] Error fetching categories:", err.message);
      await safeSend(token, chatId, "No pude obtener las categorías en este momento.");
    }
    return;
  }

  // /reset
  if (text === "/reset") {
    clearHistory(chatId);
    await safeSend(token, chatId, "Conversación reiniciada. ¿En qué te puedo ayudar?");
    return;
  }

  // Skip other commands
  if (text.startsWith("/")) return;

  // Non-text message
  if (!text) {
    await safeSend(token, chatId, "Por el momento solo puedo responder mensajes de texto. ¿En qué te puedo ayudar?");
    return;
  }

  // Regular message — process with AI
  console.log(`[Bot] ${userName} (${chatId}): ${text}`);
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  try {
    const { text: responseText, products } = await processMessage(chatId, text);

    // Send the main AI text response
    await safeSend(token, chatId, responseText);

    // Send images for products that have one (max 3 to avoid spam)
    const withImages = (products || []).filter((p) => p.imageUrl).slice(0, 3);
    for (const p of withImages) {
      const priceStr =
        !p.price || p.price === 0
          ? "💬 Precio a consultar"
          : p.promoPrice
          ? `💥 *PROMO: $${p.promoPrice} ${p.currency}* ~~$${p.regularPrice}~~`
          : `💵 *$${p.price} ${p.currency}*`;

      const stockStr = p.inStock
        ? `✅ En stock (${p.quantity} unidades)`
        : `❌ Sin stock por el momento`;

      const caption = `📦 *${p.name}*\n${priceStr}\n${stockStr}`;

      try {
        await tg(token, "sendPhoto", {
          chat_id: chatId,
          photo: p.imageUrl,
          caption,
          parse_mode: "Markdown",
        });
      } catch {
        // If photo fails, skip silently
      }
    }

    console.log(`[Bot] → ${responseText.substring(0, 100).replace(/\n/g, " ")}...`);
  } catch (err) {
    console.error(`[Bot] Error for ${chatId}:`, err.message.split("\n")[0]);
    await safeSend(token, chatId, "Ups, ocurrió un error. Por favor intentá de nuevo en unos segundos.");
  }
}

/**
 * Main polling loop.
 */
async function poll(token) {
  while (running) {
    try {
      const updates = await tg(token, "getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          handleMessage(token, update.message).catch((err) =>
            console.error("[Bot] Unhandled error:", err.message)
          );
        }
      }
    } catch (err) {
      console.error("[Bot] Polling error:", err.message.split("\n")[0]);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Initialize and start the Telegram bot.
 */
async function startBot() {
  const token = getConfig().telegramToken || process.env.TELEGRAM_TOKEN;
  if (!token) {
    console.warn("[Bot] TELEGRAM_TOKEN no configurado — bot en espera. Configuralo desde el panel.");
    return;
  }

  currentToken = token;
  await tg(token, "deleteWebhook", { drop_pending_updates: true });

  running = true;
  connected = true;
  offset = 0;
  console.log(`[Bot] Telegram bot started`);
  poll(token);
}

async function restartBot() {
  stopBot();
  await new Promise((r) => setTimeout(r, 1000));
  await startBot();
}

function stopBot() {
  running = false;
  connected = false;
}

function getTelegramStatus() {
  return { connected, token: currentToken ? "configured" : "missing" };
}

module.exports = { startBot, stopBot, restartBot, getTelegramStatus };
