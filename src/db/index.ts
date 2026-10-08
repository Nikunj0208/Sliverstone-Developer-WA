import { env } from "../config/env.js";
import { InMemoryAnalyticsRepository, type AnalyticsRepository } from "./repository.js";
import { PostgresAnalyticsRepository, createPostgresPool, runPostgresMigrations } from "./postgres.js";

import { syncBroadcastLogsToRepository } from "./sync-logs.js";

export * from "./types.js";
export * from "./repository.js";
export * from "./postgres.js";
export * from "./sync-logs.js";

let currentRepository: AnalyticsRepository | null = null;

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
      const { total } = await currentRepository.listContacts({ limit: 1 });
      if (total === 0) {
        console.info("[DATABASE] Populating initial broadcast logs datewise...");
        await syncBroadcastLogsToRepository(currentRepository);
      }
      return currentRepository;
    } catch (error) {
      console.warn("[DATABASE] Failed to initialize PostgreSQL pool, falling back to memory:", error);
      currentRepository = new InMemoryAnalyticsRepository();
      await syncBroadcastLogsToRepository(currentRepository);
      return currentRepository;
    }
  }

  currentRepository = new InMemoryAnalyticsRepository();
  await syncBroadcastLogsToRepository(currentRepository);
  return currentRepository;
}
