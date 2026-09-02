import JSZip from 'jszip';
import { Package, PackageParticipant, Jamaah, DocumentType, DocumentRecord } from '@/types/database.types';
import { ManifestGenerator } from './manifest-generator';

export interface DocumentZipFilterOptions {
  picId?: string;
  documentTypes: DocumentType[];
  currentOnly?: boolean;
}

export interface DocumentZipPreviewResult {
  package_id: string;
  package_name: string;
  total_participants: number;
  available_files_count: number;
  missing_files_count: number;
  missing_jamaah: {
    jamaah_id: string;
    jamaah_name: string;
    missing_types: DocumentType[];
  }[];
  files_to_download: {
    sequence: number;
    jamaah_name: string;
    document_type: DocumentType;
    clean_file_name: string;
    storage_path: string;
    file_size: number;
  }[];
}

export class DocumentZipService {
  /**
   * Evaluates document availability and builds clean file manifests for ZIP
   */
  public static previewPackageDocuments(
    pkg: Package,
    participants: (PackageParticipant & { jamaah?: Jamaah; pic?: any })[],
    options: DocumentZipFilterOptions
  ): DocumentZipPreviewResult {
    let activeParticipants = participants.filter(p => !p.deleted_at);

    if (options.picId) {
      activeParticipants = activeParticipants.filter(
        p => p.pic_id === options.picId || (options.picId === 'DIRECT' && !p.pic_id)
      );
    }

    const docTypes = options.documentTypes && options.documentTypes.length > 0
      ? options.documentTypes
      : (['PASSPORT'] as DocumentType[]);

    const filesToDownload: DocumentZipPreviewResult['files_to_download'] = [];
    const missingJamaah: DocumentZipPreviewResult['missing_jamaah'] = [];

    let seq = 1;

    for (const part of activeParticipants) {
      const j = part.jamaah;
      if (!j) continue;

      const jName = ManifestGenerator.sanitizeFilename(j.passport_name || j.identity_name || 'JAMAAH');
      const missingForThisJamaah: DocumentType[] = [];

      const docs = j.documents || [];

      for (const type of docTypes) {
        // Filter by type and current status
        const matchingDocs = docs.filter(d => {
          const typeMatch = d.document_type === type;
          if (options.currentOnly !== false) {
            return typeMatch && d.is_current;
          }
          return typeMatch;
        });

        if (matchingDocs.length === 0) {
          missingForThisJamaah.push(type);
        } else {
          for (const doc of matchingDocs) {
            const ext = this.getFileExtension(doc.original_file_name || doc.storage_path);
            let cleanFileName: string;

            const seqStr = String(seq).padStart(2, '0');
            if (type === 'PASSPORT' && j.passport_number) {
              const safePNo = ManifestGenerator.sanitizeFilename(j.passport_number);
              cleanFileName = `${seqStr}_${jName}_${safePNo}.${ext}`;
            } else {
              cleanFileName = `${seqStr}_${jName}_${type}.${ext}`;
            }

            filesToDownload.push({
              sequence: seq,
              jamaah_name: j.passport_name || j.identity_name || 'Jamaah',
              document_type: type,
              clean_file_name: cleanFileName,
              storage_path: doc.storage_path,
              file_size: doc.file_size || 0,
            });

            seq++;
          }
        }
      }

      if (missingForThisJamaah.length > 0) {
        missingJamaah.push({
          jamaah_id: j.id,
          jamaah_name: j.passport_name || j.identity_name || 'Jamaah',
          missing_types: missingForThisJamaah,
        });
      }
    }

    return {
      package_id: pkg.id,
      package_name: pkg.package_name,
      total_participants: activeParticipants.length,
      available_files_count: filesToDownload.length,
      missing_files_count: missingJamaah.length,
      missing_jamaah: missingJamaah,
      files_to_download: filesToDownload,
    };
  }

  /**
   * Generates ZIP archive buffer from files
   */
  public static async generateZipArchive(
    pkg: Package,
    filesWithBuffers: { cleanFileName: string; buffer: Buffer }[],
    options?: DocumentZipFilterOptions
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const zip = new JSZip();

    for (const item of filesWithBuffers) {
      zip.file(item.cleanFileName, item.buffer);
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const safePkg = ManifestGenerator.sanitizeFilename(pkg.package_name);
    const typeLabel = options?.documentTypes?.length === 1 ? options.documentTypes[0] : 'DOCUMENTS';
    const fileName = `${safePkg}_${typeLabel}.zip`;

    try {
      const { AuditService } = await import('@/lib/audit/audit-service');
      await AuditService.logMutation({
        action: 'DOCUMENT_ZIP_EXPORTED',
        entityType: 'DOCUMENT_ARCHIVE',
        entityId: pkg.id,
        packageId: pkg.id,
        packageName: pkg.package_name,
        metadata: { file_name: fileName, files_count: filesWithBuffers.length },
      });
    } catch {}

    return {
      buffer,
      fileName,
      mimeType: 'application/zip',
    };
  }

  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'pdf';
  }
}
