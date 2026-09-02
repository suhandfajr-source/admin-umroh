import { DbRepository } from '@/lib/repository/db';
import { CleanupReport, ExportCleanupService } from './cleanup-service';

/**
 * CLEANUP SCHEDULER (Local Development & Test Helper)
 * 
 * NOTE FOR PRODUCTION:
 * In serverless/stateless cloud platforms (Vercel, Next.js standalone, Cloud Run),
 * in-process NodeJS timers (setInterval) must NOT be relied upon as the primary production scheduler.
 * 
 * Primary Production Scheduling is executed via:
 * 1. Vercel Cron (configured in `vercel.json` invoking `/api/exports/cleanup` with `CRON_SECRET`)
 * 2. Supabase pg_cron (configured in `supabase/migrations/20260826000004_stage_3_cleanup_cron.sql`)
 * 3. External HTTP Schedulers (GCP Cloud Scheduler, AWS EventBridge, etc.)
 * 
 * This class is maintained for local development, staging simulation, and integration testing.
 */
export class CleanupScheduler {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static lastRun: string | null = null;
  private static isRunning = false;

  /**
   * Starts periodic background cleanup schedule (local development helper)
   */
  public static startSchedule(intervalMs: number = 3600000, triggerImmediate = false): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    if (triggerImmediate) {
      this.triggerNow().catch(console.error);
    }

    this.intervalTimer = setInterval(async () => {
      try {
        await this.triggerNow();
      } catch (err) {
        console.error('Scheduled cleanup tick error:', err);
      }
    }, intervalMs);

    if (this.intervalTimer && typeof this.intervalTimer.unref === 'function') {
      this.intervalTimer.unref();
    }
  }

  /**
   * Stops the background schedule
   */
  public static stopSchedule(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Triggers an immediate execution of the cleanup cycle (with concurrency protection)
   */
  public static async triggerNow(): Promise<CleanupReport> {
    if (this.isRunning) {
      // If already running, return last known status or await safe resolution
      return {
        expired_exports_count: 0,
        expired_staging_files_count: 0,
        deleted_storage_paths: [],
        preserved_active_files_count: 0,
        cleaned_at: new Date().toISOString(),
      };
    }

    this.isRunning = true;
    try {
      const report = await DbRepository.cleanupExpiredExports();
      this.lastRun = new Date().toISOString();
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  public static getStatus(): { active: boolean; lastRun: string | null; isRunning: boolean } {
    return {
      active: !!this.intervalTimer,
      lastRun: this.lastRun,
      isRunning: this.isRunning,
    };
  }
}
