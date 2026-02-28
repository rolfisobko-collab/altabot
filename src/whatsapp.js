const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { processMessage } = require("./ai");

const AUTH_PATH = path.join(__dirname, "../.wa_auth");

let sock = null;
let status = "disconnected"; // disconnected | connecting | qr_ready | connected
let qrDataUrl = null;
let qrRaw = null;
let intentionalDisconnect = false;

function getWhatsappStatus() {
  return { status, qrDataUrl, qrRaw };
}

async function connectWhatsapp() {
  if (sock) {
    await disconnectWhatsapp();
    await new Promise((r) => setTimeout(r, 1000));
  }

  status = "connecting";
  qrDataUrl = null;
  qrRaw = null;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[WA] Using WA version ${version.join(".")}`);

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04"],
    syncFullHistory: false,
    connectTimeoutMs: 20000,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrRaw = qr;
      status = "qr_ready";
      try {
        qrDataUrl = await qrcode.toDataURL(qr);
        console.log("[WA] QR code ready — scan it in the panel");
      } catch (err) {
        console.error("[WA] QR generation error:", err.message);
      }
    }

    if (connection === "open") {
      status = "connected";
      qrDataUrl = null;
      qrRaw = null;
      console.log("[WA] WhatsApp connected ✅");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[WA] Connection closed (code ${code}), intentional: ${intentionalDisconnect}`);

      if (intentionalDisconnect) {
        intentionalDisconnect = false;
        return;
      }

      const shouldReconnect = code !== DisconnectReason.loggedOut;
      if (!shouldReconnect) {
        clearAuthFiles();
        status = "disconnected";
        sock = null;
      } else {
        status = "connecting";
        setTimeout(() => connectWhatsapp(), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;

    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const chatId = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) continue;

      const sender = msg.pushName || chatId;
      console.log(`[WA] ${sender}: ${text}`);

      try {
        await sock.sendPresenceUpdate("composing", chatId);
        const { text: responseText, products } = await processMessage(`wa_${chatId}`, text);
        await sock.sendMessage(chatId, { text: responseText });

        // Send images for products that have one (max 3)
        const withImages = (products || []).filter((p) => p.imageUrl).slice(0, 3);
        for (const p of withImages) {
          const priceStr =
            !p.price || p.price === 0
              ? "💬 Precio a consultar"
              : p.promoPrice
              ? `💥 PROMO: $${p.promoPrice} ${p.currency} (antes $${p.regularPrice})`
              : `💵 $${p.price} ${p.currency}`;
          const stockStr = p.inStock ? `✅ En stock (${p.quantity} unid.)` : `❌ Sin stock`;
          const caption = `📦 *${p.name}*\n${priceStr}\n${stockStr}`;
          try {
            await sock.sendMessage(chatId, {
              image: { url: p.imageUrl },
              caption,
            });
          } catch {
            // skip if image fails
          }
        }

        await sock.sendPresenceUpdate("available", chatId);
        console.log(`[WA] → ${responseText.substring(0, 80).replace(/\n/g, " ")}...`);
      } catch (err) {
        console.error("[WA] Error processing message:", err.message.split("\n")[0]);
        await sock.sendMessage(chatId, {
          text: "Ups, ocurrió un error. Por favor intentá de nuevo en unos segundos.",
        });
      }
    }
  });
}

function clearAuthFiles() {
  try {
    if (fs.existsSync(AUTH_PATH)) {
      fs.rmSync(AUTH_PATH, { recursive: true, force: true });
      console.log("[WA] Auth files cleared");
    }
  } catch (err) {
    console.error("[WA] Error clearing auth files:", err.message);
  }
}

async function disconnectWhatsapp() {
  intentionalDisconnect = true;
  if (sock) {
    try { sock.end(); } catch {}
    sock = null;
  }
  clearAuthFiles();
  status = "disconnected";
  qrDataUrl = null;
  qrRaw = null;
  console.log("[WA] Disconnected");
}

module.exports = { connectWhatsapp, disconnectWhatsapp, getWhatsappStatus };
