const { getDb } = require("./db");
const defaultConfig = require("./config");

let activeConfig = { ...defaultConfig };

/**
 * Load config from MongoDB, falling back to default config.js values.
 */
async function reloadConfig() {
  try {
    const db = await getDb();
    const doc = await db.collection("nova_config").findOne({ _id: "bot_config" });
    if (doc) {
      activeConfig = {
        ...defaultConfig,
        businessName: doc.businessName || defaultConfig.businessName,
        businessDescription: doc.businessDescription || defaultConfig.businessDescription,
        welcomeMessage: doc.welcomeMessage || defaultConfig.welcomeMessage,
        systemPrompt: doc.systemPrompt || defaultConfig.systemPrompt,
        currency: doc.currency || defaultConfig.currency,
        maxProductsInResponse: doc.maxProductsInResponse || defaultConfig.maxProductsInResponse,
        maxProductsFromDB: doc.maxProductsFromDB || defaultConfig.maxProductsFromDB,
        telegramToken: doc.telegramToken || process.env.TELEGRAM_TOKEN,
      };
      console.log("[Config] Loaded from MongoDB");
    } else {
      activeConfig = { ...defaultConfig, telegramToken: process.env.TELEGRAM_TOKEN };
      console.log("[Config] Using default config.js");
    }
  } catch (err) {
    console.error("[Config] Failed to load from DB, using defaults:", err.message);
    activeConfig = { ...defaultConfig, telegramToken: process.env.TELEGRAM_TOKEN };
  }
}

function getConfig() {
  return activeConfig;
}

module.exports = { reloadConfig, getConfig };
