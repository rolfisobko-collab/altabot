const { getDb } = require("./db");
const config = require("./config");

/**
 * Builds a MongoDB text/regex search query from a user message.
 * Splits the query into keywords and searches name field with each.
 */
/**
 * Normalize a string: lowercase + remove accents/tildes.
 * e.g. "módulo" → "modulo", "batería" → "bateria"
 */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildSearchQuery(userQuery) {
  const stopWords = [
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "para", "con", "sin", "por", "que", "como",
    "tiene", "hay", "tengo", "busco", "necesito", "quiero",
    "precio", "cuanto", "cuesta", "vale", "cuanto",
    "me", "te", "le", "se", "si", "no", "es", "en",
  ];

  const keywords = normalize(userQuery)
    .replace(/[\u00bf?\u00a1!.,;:]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w));

  if (keywords.length === 0) return null;

  // Each keyword matches with accent-insensitive regex
  const andConditions = keywords.map((kw) => ({
    name: { $regex: kw, $options: "i" },
  }));

  return { $and: andConditions };
}

/**
 * Search products in MongoDB by user query string.
 * Returns an array of formatted product objects.
 */
async function searchProducts(userQuery) {
  const db = await getDb();
  const query = buildSearchQuery(userQuery);

  if (!query) return [];

  const keywords = normalize(userQuery)
    .replace(/[\u00bf?\u00a1!.,;:]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const raw = await db
    .collection("stock")
    .find(query)
    .limit(config.maxProductsFromDB)
    .toArray();

  // Sort by how many keywords match (most relevant first)
  if (raw.length > 0) {
    raw.sort((a, b) => {
      const nameA = normalize(a.name || "");
      const nameB = normalize(b.name || "");
      const scoreA = keywords.filter((kw) => nameA.includes(kw)).length;
      const scoreB = keywords.filter((kw) => nameB.includes(kw)).length;
      return scoreB - scoreA;
    });
    return formatProducts(raw);
  }

  // Fallback: only if query has a specific model keyword (number or alphanumeric like "13", "a52", "redmi")
  const modelKeywords = keywords.filter((kw) => /\d/.test(kw) || kw.length <= 4);
  if (modelKeywords.length > 0) {
    // Must match at least one model keyword AND one other keyword (AND logic, not pure OR)
    const fallbackConditions = modelKeywords.map((kw) => ({
      name: { $regex: kw, $options: "i" },
    }));
    const fallback = await db
      .collection("stock")
      .find({ $or: fallbackConditions })
      .limit(config.maxProductsFromDB)
      .toArray();

    // Sort fallback by relevance too
    fallback.sort((a, b) => {
      const nameA = normalize(a.name || "");
      const nameB = normalize(b.name || "");
      const scoreA = keywords.filter((kw) => nameA.includes(kw)).length;
      const scoreB = keywords.filter((kw) => nameB.includes(kw)).length;
      return scoreB - scoreA;
    });
    return formatProducts(fallback);
  }

  return [];
}

/**
 * Get products by category name (partial match).
 */
async function getProductsByCategory(categoryName) {
  const db = await getDb();

  // First find the category ID
  const category = await db.collection("stockCategories").findOne({
    name: { $regex: categoryName, $options: "i" },
  });

  if (!category) return [];

  const raw = await db
    .collection("stock")
    .find({ category: category._id })
    .limit(config.maxProductsFromDB)
    .toArray();

  return formatProducts(raw);
}

/**
 * List all available categories.
 */
async function getCategories() {
  const db = await getDb();
  const cats = await db.collection("stockCategories").find().toArray();
  return cats.map((c) => c.name).filter(Boolean);
}

/**
 * Format raw DB products into clean objects for the AI context.
 */
function formatProducts(products) {
  return products.slice(0, config.maxProductsInResponse).map((p) => {
    const imageUrl = p.image1 || (Array.isArray(p.images) && p.images[0]) || null;
    return {
      name: p.name?.trim(),
      price: p.promoPrice ?? p.price,
      promoPrice: p.promoPrice ?? null,
      regularPrice: p.price,
      currency: p.currency || config.currency,
      quantity: p.quantity ?? p.stock ?? 0,
      inStock: (p.quantity ?? p.stock ?? 0) > 0,
      location: p.location || null,
      category: p.category || null,
      imageUrl: imageUrl && imageUrl.startsWith("http") ? imageUrl : null,
    };
  });
}

module.exports = { searchProducts, getProductsByCategory, getCategories };
