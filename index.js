require("dotenv").config();
const { connect } = require("./src/db");
const { reloadConfig } = require("./src/configLoader");
const { startBot } = require("./src/bot");
const { createApp } = require("./src/api");

const PORT = process.env.PORT || 8000;

async function main() {
  console.log("[App] Starting IA Chat Bot...");

  await connect();
  await reloadConfig();

  // Start Express API + panel
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[App] Panel running at http://localhost:${PORT}`);
  });

  // Start Telegram bot
  await startBot();

  console.log("[App] Bot is running.");
}

process.on("SIGINT", async () => {
  console.log("\n[App] Shutting down...");
  const { close } = require("./src/db");
  await close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  const { close } = require("./src/db");
  await close();
  process.exit(0);
});

main().catch((err) => {
  console.error("[App] Fatal error:", err);
  process.exit(1);
});
