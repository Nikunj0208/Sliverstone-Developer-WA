import { createApp } from "./app.js";
import { assertEnvironment, env } from "./config/env.js";
import { initDatabase } from "./db/index.js";
import { metaSyncService } from "./services/meta-sync-service.js";

assertEnvironment();
const repo = await initDatabase();
metaSyncService.startPeriodicSync(repo, 30 * 60 * 1000);

const app = createApp();

app.listen(Number.parseInt(env.port, 10), () => {
  console.log(`Silverstone WhatsApp CRM listening on port ${env.port}`);
});
