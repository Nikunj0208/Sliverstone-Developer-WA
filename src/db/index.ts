import { env } from "../config/env.js";
import { InMemoryAnalyticsRepository, type AnalyticsRepository } from "./repository.js";
import { PostgresAnalyticsRepository, createPostgresPool, runPostgresMigrations } from "./postgres.js";

export * from "./types.js";
export * from "./repository.js";
export * from "./postgres.js";

let currentRepository: AnalyticsRepository | null = null;

export function getAnalyticsRepository(): AnalyticsRepository {
  if (!currentRepository) {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      // Lazy or sync fallback will be initialized; default to memory if async init hasn't completed yet
      currentRepository = new InMemoryAnalyticsRepository();
    } else {
      currentRepository = new InMemoryAnalyticsRepository();
    }
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
      return currentRepository;
    } catch (error) {
      console.warn("[DATABASE] Failed to initialize PostgreSQL pool, falling back to memory:", error);
      currentRepository = new InMemoryAnalyticsRepository();
      return currentRepository;
    }
  }

  currentRepository = new InMemoryAnalyticsRepository();
  return currentRepository;
}
