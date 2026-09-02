import { AuditLog } from '@/types/database.types';
import { DbRepository } from '@/lib/repository/db';

// Sensitive keys to automatically redact from audit payloads
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'cron_secret',
  'secret',
  'authorization',
  'api_key',
  'apikey',
  'key',
  'signature',
  'signed_url',
  'binary',
  'file_bytes',
  'raw_bytes',
]);

export class AuditService {
  /**
   * Central data sanitizer that strips private credentials, secrets, tokens, and binary payloads.
   */
  public static sanitizeData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeData(item));
    }

    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (
        SENSITIVE_KEYS.has(lower) || 
        lower.includes('token') || 
        lower.includes('secret') || 
        lower.includes('password') || 
        lower.includes('api_key') ||
        lower.includes('apikey')
      ) {
        clean[k] = '[REDACTED]';
      } else if (typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('data:application/pdf') || v.length > 5000)) {
        clean[k] = `[BINARY_OMITTED length=${v.length}]`;
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = this.sanitizeData(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  /**
   * Record a business mutation to central audit log.
   */
  public static async logMutation(params: {
    actorId?: string | null;
    actorName?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    packageId?: string | null;
    packageName?: string | null;
    jamaahId?: string | null;
    jamaahName?: string | null;
    beforeData?: Record<string, any> | null;
    afterData?: Record<string, any> | null;
    metadata?: Record<string, any> | null;
  }): Promise<AuditLog> {
    const now = new Date().toISOString();
    const entry: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      actor_id: params.actorId || 'admin-1',
      actor_name: params.actorName || 'Admin Operasional',
      actor_email: params.actorEmail || 'admin@travelumroh.com',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      package_id: params.packageId || null,
      package_name: params.packageName || null,
      jamaah_id: params.jamaahId || null,
      jamaah_name: params.jamaahName || null,
      before_data: params.beforeData ? this.sanitizeData(params.beforeData) : null,
      after_data: params.afterData ? this.sanitizeData(params.afterData) : null,
      metadata: params.metadata ? this.sanitizeData(params.metadata) : null,
      created_at: now,
    };

    return DbRepository.createAuditLog(entry);
  }

  /**
   * Retrieve audit logs with optional filters
   */
  public static async getAuditLogs(filters?: {
    packageId?: string;
    jamaahId?: string;
    entityType?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    return DbRepository.getAuditLogs(filters);
  }
}
