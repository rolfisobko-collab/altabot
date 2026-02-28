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

// Map of normalized chars to accent-tolerant regex equivalents
const ACCENT_MAP = {
  a: "[aáàäâã]", e: "[eéèëê]", i: "[iíìïî]",
  o: "[oóòöôõ]", u: "[uúùüû]", n: "[nñ]",
};

function accentTolerantRegex(normalizedWord) {
  return normalizedWord
    .split("")
    .map((c) => ACCENT_MAP[c] || c)
    .join("");
}

function buildSearchQuery(userQuery) {
  const stopWords = [
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "para", "con", "sin", "por", "que", "como",
    "tiene", "hay", "tengo", "busco", "necesito", "quiero",
    "precio", "cuanto", "cuesta", "vale",
    "me", "te", "le", "se", "si", "no", "es", "en",
  ];

  const keywords = normalize(userQuery)
    .replace(/[\u00bf?\u00a1!.,;:]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w));

  if (keywords.length === 0) return null;

  // Each keyword uses accent-tolerant regex so 'modulo' matches 'MÓDULO' in DB
  const andConditions = keywords.map((kw) => ({
    name: { $regex: accentTolerantRegex(kw), $options: "i" },
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

  // Sort by how many keywords match in normalized name (most relevant first)
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
