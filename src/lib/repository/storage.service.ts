import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.data', 'storage');

export class StorageService {
  private static BUCKET_NAME = 'travel-documents';
  private static memoryStorage = new Map<string, { buffer: Buffer; mimeType: string }>();

  /**
   * Upload file to private Supabase storage with local fallback persistence
   * Path format: jamaah/<jamaah_id>/<doc_type>/<generated_id>.<ext> or staging/<generated_id>.<ext>
   */
  public static async uploadDocument(
    fileBuffer: Buffer,
    storagePath: string,
    mimeType: string
  ): Promise<{ path: string; error?: string }> {
    // 1. Save in-memory & local disk cache for instant development preview
    this.memoryStorage.set(storagePath, { buffer: fileBuffer, mimeType });
    try {
      const fullLocalPath = path.join(LOCAL_STORAGE_DIR, storagePath);
      fs.mkdirSync(path.dirname(fullLocalPath), { recursive: true });
      fs.writeFileSync(fullLocalPath, fileBuffer);
    } catch {}

    // 2. Try Supabase storage
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload fallback to local:', error.message);
        return { path: storagePath };
      }

      return { path: data.path };
    } catch (err: any) {
      console.warn('Storage upload exception fallback to local:', err);
      return { path: storagePath };
    }
  }

  /**
   * Retrieve file buffer from local cache or Supabase storage
   */
  public static async getFileBuffer(storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    // 1. Check in-memory map
    if (this.memoryStorage.has(storagePath)) {
      return this.memoryStorage.get(storagePath)!;
    }

    // 2. Check local disk
    try {
      const fullLocalPath = path.join(LOCAL_STORAGE_DIR, storagePath);
      if (fs.existsSync(fullLocalPath)) {
        const buf = fs.readFileSync(fullLocalPath);
        const ext = path.extname(storagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.pdf') mimeType = 'application/pdf';
        else if (ext === '.webp') mimeType = 'image/webp';
        return { buffer: buf, mimeType };
      }
    } catch {}

    // 3. Fallback to Supabase
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.from(this.BUCKET_NAME).download(storagePath);
      if (!error && data) {
        const buf = Buffer.from(await data.arrayBuffer());
        return { buffer: buf, mimeType: data.type || 'application/octet-stream' };
      }
    } catch {}

    return null;
  }

  /**
   * Generate temporary Signed URL for private document access (valid for 1 hour)
   */
  public static async getSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return `/api/documents/file?path=${encodeURIComponent(storagePath)}`;
      }

      return data.signedUrl;
    } catch {
      return `/api/documents/file?path=${encodeURIComponent(storagePath)}`;
    }
  }
}

