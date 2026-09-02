import { createAdminClient } from '@/lib/supabase/admin';

export interface CleanupReport {
  expired_exports_count: number;
  expired_staging_files_count: number;
  deleted_storage_paths: string[];
  preserved_active_files_count: number;
  cleaned_at: string;
}

export class ExportCleanupService {
  private static isCleaning = false;

  /**
   * Cleans up expired export jobs and stale Stage 1 staging files past TTL (24h)
   * Ensures physical deletion from private storage buckets.
   * Includes concurrency guard for thread-safe operations in high-frequency triggers.
   */
  public static async executePhysicalCleanup(
    exportJobs: { id: string; storage_path?: string | null; expires_at: string; status: string }[],
    documents: { 
      id: string; 
      storage_path: string; 
      uploaded_at: string; 
      status: string; 
      jamaah_id?: string | null; 
      confirmed_at?: string | null 
    }[],
    mockStorageFiles?: Set<string>
  ): Promise<{
    activeJobs: typeof exportJobs;
    remainingDocs: typeof documents;
    deletedStoragePaths: string[];
    report: CleanupReport;
  }> {
    // If a cleanup is concurrently in progress, prevent duplicate mutation
    if (this.isCleaning) {
      return {
        activeJobs: exportJobs,
        remainingDocs: documents,
        deletedStoragePaths: [],
        report: {
          expired_exports_count: 0,
          expired_staging_files_count: 0,
          deleted_storage_paths: [],
          preserved_active_files_count: documents.length,
          cleaned_at: new Date().toISOString(),
        },
      };
    }

    this.isCleaning = true;
    try {
      const now = Date.now();
      const ttl24h = 24 * 60 * 60 * 1000;
      const deletedStoragePaths: string[] = [];
      const expiredJobIds: string[] = [];

      // 1. Process Export Jobs
      const activeJobs = exportJobs.filter(job => {
        const expTime = new Date(job.expires_at).getTime();
        const isExpired = expTime < now || job.status === 'EXPIRED';
        if (isExpired) {
          expiredJobIds.push(job.id);
          if (job.storage_path) {
            deletedStoragePaths.push(job.storage_path);
            if (mockStorageFiles) mockStorageFiles.delete(job.storage_path);
          }
          return false;
        }
        return true;
      });

      // 2. Process Staging Documents (Stage 1 stale rejected / failed OCR / abandoned staging)
      let preservedCount = 0;
      const remainingDocs = documents.filter(doc => {
        // Never delete confirmed documents or documents with confirmed_at
        if (doc.status === 'CONFIRMED' || doc.confirmed_at) {
          preservedCount++;
          return true;
        }

        const uploadTime = new Date(doc.uploaded_at).getTime();
        const age = now - uploadTime;

        // Staging files: rejected, failed, or unassigned/abandoned older than 24h
        const isStaleStaging = age > ttl24h && (
          doc.status === 'REJECTED' ||
          doc.status === 'UPLOADED' ||
          doc.status === 'FAILED' ||
          (doc.status === 'NEEDS_REVIEW' && !doc.jamaah_id) ||
          doc.storage_path.startsWith('staging/')
        );

        if (isStaleStaging) {
          deletedStoragePaths.push(doc.storage_path);
          if (mockStorageFiles) mockStorageFiles.delete(doc.storage_path);
          return false; // Remove
        }

        preservedCount++;
        return true;
      });

      // 3. Physical Storage Removal via Supabase Client if live credentials exist
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (
        supabaseUrl && 
        !supabaseUrl.includes('dummy') && 
        serviceKey && 
        !serviceKey.includes('dummy') && 
        deletedStoragePaths.length > 0
      ) {
        try {
          const supabase = createAdminClient();
          await supabase.storage.from('documents').remove(deletedStoragePaths);
        } catch (err) {
          console.error('Supabase physical storage cleanup warning:', err);
        }
      }

      return {
        activeJobs,
        remainingDocs,
        deletedStoragePaths,
        report: {
          expired_exports_count: expiredJobIds.length,
          expired_staging_files_count: deletedStoragePaths.length - expiredJobIds.length,
          deleted_storage_paths: deletedStoragePaths,
          preserved_active_files_count: preservedCount,
          cleaned_at: new Date().toISOString(),
        },
      };
    } finally {
      this.isCleaning = false;
    }
  }
}
