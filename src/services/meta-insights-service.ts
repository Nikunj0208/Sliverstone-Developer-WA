import type { AnalyticsRepository } from "../db/repository.js";
import type { MetaTemplateDailyMetric, MetaCampaignOverview } from "../db/types.js";
import { metaSyncService } from "./meta-sync-service.js";

/**
 * Meta Insights Service
 * Operates strictly on live Meta WhatsApp Business Platform data.
 * All mock/synthetic fallbacks have been completely purged.
 */
export class MetaInsightsService {
  getBatchNumberFromDate(dateStr: string): number | null {
    return metaSyncService.getBatchNumberFromDate(dateStr);
  }

  /**
   * Fetches daily metrics directly from Meta Graph API
   */
  async fetchFromMetaGraphApi(repo: AnalyticsRepository): Promise<MetaTemplateDailyMetric[]> {
    await metaSyncService.syncAll(repo);
    return repo.getMetaDailyMetrics();
  }

  /**
   * Synchronizes Meta Graph API insights directly to the CRM database
   */
  async syncToDatabase(repo: AnalyticsRepository): Promise<{
    success: boolean;
    syncedDays: number;
    overview: MetaCampaignOverview;
    error?: string;
  }> {
    try {
      const syncResult = await metaSyncService.syncAll(repo);
      const overview = await repo.getMetaCampaignOverview();
      return {
        success: syncResult.success,
        syncedDays: syncResult.syncedDays,
        overview,
        error: syncResult.error
      };
    } catch (err: any) {
      console.error("[META-INSIGHTS] Sync error:", err.message);
      const overview = await repo.getMetaCampaignOverview();
      return {
        success: false,
        syncedDays: 0,
        overview,
        error: err.message
      };
    }
  }

  /**
   * Starts periodic automated sync with Meta Graph API (30 minutes)
   */
  startPeriodicSync(repo: AnalyticsRepository, intervalMs = 30 * 60 * 1000): void {
    metaSyncService.startPeriodicSync(repo, intervalMs);
  }
}

export const metaInsightsService = new MetaInsightsService();
