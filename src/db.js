const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB);
  console.log(`[DB] Connected to MongoDB: ${process.env.MONGODB_DB}`);
  return db;
}

async function getDb() {
  if (!db) await connect();
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, close };
