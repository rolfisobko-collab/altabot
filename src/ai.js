const Groq = require("groq-sdk");
const { getConfig } = require("./configLoader");
const { searchProducts } = require("./products");
const { getDb } = require("./db");

// Groq client is created per-request so it picks up hot-reloaded API key
function getGroqClient() {
  const key = getConfig().groqApiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq API key no configurada. Agregala en MongoDB (groqApiKey) o como env var GROQ_API_KEY.");
  return new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
}

// In-memory conversation history per user (chatId -> array of messages)
const conversationHistory = new Map();

const MAX_HISTORY_TURNS = 10; // Keep last N turns to avoid token overflow

/**
 * Detects if the user message is a product/price query
 * that requires a DB lookup.
 */
function isProductQuery(message) {
  const productKeywords = [
    "precio", "precios", "cuánto", "cuanto", "cuesta", "vale", "valor",
    "stock", "tenés", "tenes", "tienen", "hay", "disponible", "disponibilidad",
    "busco", "necesito", "quiero", "pantalla", "batería", "bateria", "cámara",
    "camara", "flex", "módulo", "modulo", "repuesto", "placa", "conector",
    "carga", "speaker", "parlante", "altavoz", "blindaje", "táctil", "tactil",
    "vidrio", "display", "lcd", "samsung", "iphone", "xiaomi", "motorola",
    "huawei", "lg", "nokia", "oppo", "realme", "poco", "redmi", "a10",
    "a20", "a30", "a50", "a51", "a52", "a71", "a72", "s20", "s21", "s22",
  ];
  const lower = message.toLowerCase();
  return productKeywords.some((kw) => lower.includes(kw));
}

/**
 * Build the context string injected into the AI prompt with DB results.
 */
function buildProductContext(products) {
  if (!products || products.length === 0) {
    return "No se encontraron productos coincidentes en el stock.";
  }

  const lines = products.map((p) => {
    const priceStr =
      !p.price || p.price === 0
        ? "Precio a consultar"
        : p.promoPrice
        ? `$${p.promoPrice} ${p.currency} (PROMO, antes $${p.regularPrice})`
        : `$${p.price} ${p.currency}`;

    const stockStr = p.inStock ? "✅ En stock" : "❌ Sin stock";

    return `- ${p.name} | ${priceStr} | ${stockStr}`;
  });

  return `LISTA EXACTA DE PRODUCTOS DISPONIBLES (solo podés mencionar estos ${products.length} productos, nada más):\n${lines.join("\n")}\n\nRECORDATORIO: No menciones ningún producto que no esté en esta lista.`;
}

/**
 * Fetch latest exchange rates from MongoDB and format them for the AI context.
 */
async function getExchangeRatesContext() {
  try {
    const db = await getDb();
    const rates = await db.collection("exchangeRates").find({}).toArray();
    if (!rates.length) return "";

    const flags = { ARS: "🇦🇷", REAL: "🇧🇷", GUARANI: "🇵🇾" };
    const names = { ARS: "Pesos argentinos", REAL: "Reales brasileños", GUARANI: "Guaraníes paraguayos" };

    const lines = rates.map(r => {
      const flag = flags[r.toCurrency] || "";
      const name = names[r.toCurrency] || r.toCurrency;
      return `1 USD = ${r.rate.toLocaleString("es-AR")} ${flag} ${name}`;
    });

    return `COTIZACIONES ACTUALES (usar siempre estos valores, nunca inventar precios en otras monedas):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * Get or create conversation history for a chat.
 */
function getHistory(chatId) {
  if (!conversationHistory.has(chatId)) {
    conversationHistory.set(chatId, []);
  }
  return conversationHistory.get(chatId);
}

/**
 * Trim history to avoid exceeding token limits.
 */
function trimHistory(history) {
  if (history.length > MAX_HISTORY_TURNS * 2) {
    return history.slice(-MAX_HISTORY_TURNS * 2);
  }
  return history;
}

/**
 * Main function: process a user message and return AI response + matched products.
 * @param {string} chatId - Unique identifier for the conversation
 * @param {string} userMessage - The message from the user
 * @returns {Promise<{text: string, products: Array}>}
 */
async function processMessage(chatId, userMessage) {
  // Fetch product context and exchange rates in parallel
  let productContext = "";
  let matchedProducts = [];
  const [ratesContext] = await Promise.all([
    getExchangeRatesContext(),
    isProductQuery(userMessage)
      ? searchProducts(userMessage)
          .then(p => { matchedProducts = p; productContext = buildProductContext(p); })
          .catch(err => { console.error("[AI] Error fetching products:", err.message); productContext = "No se pudo consultar la base de datos en este momento."; })
      : Promise.resolve(),
  ]);

  // Build system prompt with exchange rates always included + optional product context
  const systemPrompt =
    getConfig().systemPrompt +
    (ratesContext ? `\n\n--- ${ratesContext} ---` : "") +
    (productContext
      ? `\n\n--- CONTEXTO DE BASE DE DATOS ---\n${productContext}\n--- FIN CONTEXTO ---`
      : "");

  // Get conversation history and build messages array for Groq
  const history = trimHistory(getHistory(chatId));
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  // Call Groq API (with retry on 429)
  let responseText;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await getGroqClient().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 1024,
        temperature: 0.2,
      });
      responseText = completion.choices[0].message.content;
      break;
    } catch (err) {
      const is429 = err.status === 429 || (err.message && err.message.includes("429"));
      console.error(`[AI] Groq API error (attempt ${attempt}):`, err.message?.split("\n")[0]);
      if (is429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }

  // Save turn to in-memory history
  const fullHistory = getHistory(chatId);
  fullHistory.push({ role: "user", content: userMessage });
  fullHistory.push({ role: "assistant", content: responseText });

  // Persist turn to MongoDB (fire and forget)
  getDb().then(db => {
    const channel = chatId.toString().startsWith("wa_") ? "whatsapp" : "telegram";
    db.collection("nova_chats").updateOne(
      { chatId: chatId.toString() },
      {
        $set: { chatId: chatId.toString(), channel, updatedAt: new Date() },
        $push: {
          messages: {
            $each: [
              { role: "user", text: userMessage, ts: new Date() },
              { role: "assistant", text: responseText, ts: new Date() },
            ],
          },
        },
      },
      { upsert: true }
    );
  }).catch(() => {});

  return { text: responseText, products: matchedProducts };
}

/**
 * Clear conversation history for a user (e.g. on /start).
 */
function clearHistory(chatId) {
  conversationHistory.delete(chatId);
}

module.exports = { processMessage, clearHistory };
