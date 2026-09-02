import { RecentActivityItem } from '@/types/database.types';
import { DbRepository } from '@/lib/repository/db';

export class RecentActivityService {
  /**
   * Compose unified chronological activity feed from real audit logs and domain events.
   */
  public static async getRecentActivities(limit = 20): Promise<RecentActivityItem[]> {
    const auditLogs = await DbRepository.getAuditLogs({ limit: limit * 2 });

    const items: RecentActivityItem[] = [];

    for (const log of auditLogs) {
      let type: RecentActivityItem['type'] = 'AUDIT';
      let badge_variant: RecentActivityItem['badge_variant'] = 'info';
      let title = log.action;
      let description = `${log.actor_name || 'Admin'} melakukan ${log.action} pada ${log.entity_type}`;
      let action_url: string | undefined = undefined;

      switch (log.action) {
        case 'PAYMENT_ALLOCATED':
          type = 'FINANCE';
          badge_variant = 'success';
          title = 'Alokasi Pembayaran Berhasil';
          description = `Pembayaran Rp ${(log.metadata?.amount || 0).toLocaleString('id-ID')} dialokasikan ke ${log.jamaah_name || 'Jamaah'}.`;
          action_url = log.package_id ? `/paket/${log.package_id}` : '/finance/pembayaran';
          break;
        case 'PAYMENT_CREATED':
          type = 'FINANCE';
          badge_variant = 'info';
          title = 'Pencatatan Pembayaran Masuk';
          description = `Pembayaran baru Rp ${(log.metadata?.amount || 0).toLocaleString('id-ID')} dicatat dari ${log.metadata?.sender_name || 'Pengirim'}.`;
          action_url = '/finance/inbox';
          break;
        case 'PAYMENT_CANCELLED':
          type = 'FINANCE';
          badge_variant = 'danger';
          title = 'Pembayaran Dibatalkan';
          description = `Pembayaran Rp ${(log.metadata?.amount || 0).toLocaleString('id-ID')} dibatalkan (${log.metadata?.reason || ''}).`;
          action_url = '/finance/pembayaran';
          break;
        case 'DOCUMENT_CONFIRMED':
        case 'PASSPORT_REPLACED':
          type = 'DOCUMENT';
          badge_variant = 'success';
          title = 'Verifikasi Paspor Selesai';
          description = `Paspor ${log.jamaah_name || 'Jamaah'} telah dikonfirmasi dan diperbarui dalam master data.`;
          action_url = log.jamaah_id ? `/jamaah/${log.jamaah_id}` : '/jamaah';
          break;
        case 'EQUIPMENT_HANDED_OVER':
          type = 'EQUIPMENT';
          badge_variant = 'success';
          title = 'Penyerahan Perlengkapan';
          description = `Perlengkapan ${log.metadata?.item_name || ''} (${log.metadata?.quantity || 1} unit) diserahkan ke ${log.jamaah_name || 'Jamaah'}.`;
          action_url = log.package_id ? `/perlengkapan/penyerahan?packageId=${log.package_id}` : '/perlengkapan/penyerahan';
          break;
        case 'EQUIPMENT_PREPARED':
          type = 'EQUIPMENT';
          badge_variant = 'info';
          title = 'Penyiapan Perlengkapan';
          description = `Perlengkapan ${log.metadata?.item_name || ''} siap untuk diserahkan ke jamaah.`;
          action_url = log.package_id ? `/perlengkapan/penyerahan?packageId=${log.package_id}` : '/perlengkapan/penyerahan';
          break;
        case 'MANIFEST_EXPORTED':
          type = 'MANIFEST';
          badge_variant = 'info';
          title = 'Export Manifest Penerbangan';
          description = `Manifest untuk paket ${log.package_name || ''} berhasil diexport ke Excel.`;
          action_url = log.package_id ? `/manifest?packageId=${log.package_id}` : '/manifest';
          break;
        case 'DOCUMENT_ZIP_EXPORTED':
          type = 'DOCUMENT';
          badge_variant = 'info';
          title = 'Export Bulk ZIP Dokumen';
          description = `Arsip dokumen peserta paket ${log.package_name || ''} diunduh sebagai ZIP.`;
          action_url = '/dokumen/download';
          break;
        case 'ALERT_DISMISSED':
          type = 'AUDIT';
          badge_variant = 'neutral';
          title = 'Alert Di-dismiss';
          description = `Peringatan operasional (${log.metadata?.category || ''}) di-dismiss oleh admin.`;
          action_url = '/action-center';
          break;
        default:
          title = log.action.replace(/_/g, ' ');
          break;
      }

      items.push({
        id: log.id,
        timestamp: log.created_at,
        type,
        title,
        description,
        actor: log.actor_name || 'Admin',
        action_url,
        badge_variant,
      });
    }

    return items.slice(0, limit);
  }
}
