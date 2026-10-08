import { env } from "../config/env.js";
import { InMemoryAnalyticsRepository, type AnalyticsRepository } from "./repository.js";
import { PostgresAnalyticsRepository, createPostgresPool, runPostgresMigrations } from "./postgres.js";
import { syncBroadcastLogsToRepository } from "./sync-logs.js";
import { syncFromLiveRender } from "../services/live-sync.js";
import { metaInsightsService } from "../services/meta-insights-service.js";
import { join } from "node:path";

export * from "./types.js";
export * from "./repository.js";
export * from "./postgres.js";
export * from "./sync-logs.js";

let currentRepository: AnalyticsRepository | null = null;
let liveSyncInterval: NodeJS.Timeout | null = null;

export function getAnalyticsRepository(): AnalyticsRepository {
  if (!currentRepository) {
    currentRepository = new InMemoryAnalyticsRepository();
  }
  return currentRepository;
}

export function setAnalyticsRepository(repo: AnalyticsRepository): void {
  currentRepository = repo;
}

export async function initDatabase(): Promise<AnalyticsRepository> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const pool = await createPostgresPool(databaseUrl);
      await runPostgresMigrations(pool);
      currentRepository = new PostgresAnalyticsRepository(pool);
      console.info("[DATABASE] PostgreSQL analytics repository initialized successfully");
      
      // Fast startup: only sync broadcast files if contacts table is fresh/empty
      const { rows } = await pool.query("SELECT COUNT(*) FROM contacts");
      const contactCount = parseInt(rows[0]?.count || "0", 10);
      if (contactCount === 0) {
        console.info("[DATABASE] Contacts table empty, running initial broadcast log sync...");
        await syncBroadcastLogsToRepository(currentRepository);
      } else {
        console.info(`[DATABASE] PostgreSQL already has ${contactCount} verified contacts. Fast startup ready.`);
      }
      
      // Sync official Meta WhatsApp Business Insights in background
      metaInsightsService.syncToDatabase(currentRepository).catch((e: any) => {
        console.warn("[DATABASE] Meta insights background sync note:", e.message);
      });
      metaInsightsService.startPeriodicSync(currentRepository);

      return currentRepository;
    } catch (error) {
      console.warn("[DATABASE] Failed to initialize PostgreSQL pool, falling back to memory:", error);
    }
  }

  const memoryRepo = new InMemoryAnalyticsRepository();
  currentRepository = memoryRepo;

  if (process.env.NODE_ENV !== "test") {
    const storePath = join(process.cwd(), "data", "crm-store.json");
    memoryRepo.setPersistentFilePath(storePath);
    const loaded = await memoryRepo.loadFromFile();
    if (loaded) {
      console.info("[DATABASE] Loaded persistent CRM store from data/crm-store.json");
    }

    // Discover and sync broadcast logs across data/broadcasts and logs
    await syncBroadcastLogsToRepository(memoryRepo);

    // Pull any live customer replies and status events from live Render deployment
    try {
      const result = await syncFromLiveRender(memoryRepo);
      if (result.synced && (result.importedContacts > 0 || result.importedMessages > 0)) {
        console.info(`[SYNC] Pulled live customer data from WhatsApp: ${result.importedContacts} contacts, ${result.importedMessages} messages`);
      }
    } catch {}

    // Sync official Meta WhatsApp Business Insights
    try {
      await metaInsightsService.syncToDatabase(memoryRepo);
      metaInsightsService.startPeriodicSync(memoryRepo);
    } catch {}

    await memoryRepo.saveToFile();

    // Start background sync every 60 seconds to automatically pull new WhatsApp replies
    if (!liveSyncInterval) {
      liveSyncInterval = setInterval(async () => {
        try {
          if (currentRepository) {
            await syncFromLiveRender(currentRepository);
          }
        } catch {}
      }, 60000);
    }
  } else {
    await syncBroadcastLogsToRepository(memoryRepo);
  }

  return memoryRepo;
}

