const express = require("express");
const cors = require("cors");
const path = require("path");
const { getDb } = require("./db");

const router = express.Router();

// ── Config ──────────────────────────────────────────────────
router.get("/config", async (req, res) => {
  try {
    const { getConfig } = require("./configLoader");
    const defaults = getConfig();
    const db = await getDb();
    const doc = await db.collection("nova_config").findOne({ _id: "bot_config" });
    res.json({ ...defaults, ...(doc || {}), _id: undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/config", async (req, res) => {
  try {
    const db = await getDb();
    const update = { ...req.body, _id: "bot_config", updatedAt: new Date() };
    await db.collection("nova_config").replaceOne(
      { _id: "bot_config" },
      update,
      { upsert: true }
    );
    // Hot-reload config in memory so bot uses new settings immediately
    const { reloadConfig } = require("./configLoader");
    await reloadConfig();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Telegram status ─────────────────────────────────────────
router.get("/telegram/status", (req, res) => {
  const { getTelegramStatus } = require("./bot");
  res.json(getTelegramStatus());
});

router.post("/telegram/restart", async (req, res) => {
  try {
    const { restartBot } = require("./bot");
    await restartBot();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp status & QR ────────────────────────────────────
router.get("/whatsapp/status", (req, res) => {
  const { getWhatsappStatus } = require("./whatsapp");
  res.json(getWhatsappStatus());
});

router.post("/whatsapp/connect", async (req, res) => {
  try {
    const { connectWhatsapp } = require("./whatsapp");
    await connectWhatsapp();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/whatsapp/qr", (req, res) => {
  const { getWhatsappStatus } = require("./whatsapp");
  const { qrDataUrl, status } = getWhatsappStatus();
  res.json({ qrDataUrl, status });
});

router.post("/whatsapp/disconnect", async (req, res) => {
  try {
    const { disconnectWhatsapp } = require("./whatsapp");
    await disconnectWhatsapp();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chats ────────────────────────────────────────────────────
router.get("/chats", async (req, res) => {
  try {
    const db = await getDb();
    const chats = await db.collection("nova_chats")
      .find({}, { projection: { messages: 0 } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chats/:chatId", async (req, res) => {
  try {
    const db = await getDb();
    const chat = await db.collection("nova_chats").findOne({ chatId: req.params.chatId });
    res.json(chat || { messages: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats ────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const db = await getDb();
    const totalProducts = await db.collection("stock").countDocuments();
    const inStock = await db.collection("stock").countDocuments({ quantity: { $gt: 0 } });
    const withPrice = await db.collection("stock").countDocuments({ price: { $gt: 0 } });
    res.json({ totalProducts, inStock, withPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", router);

  // Serve frontend in production
  const distPath = path.join(__dirname, "../panel/dist");
  app.use(express.static(distPath));
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  return app;
}

module.exports = { createApp };
