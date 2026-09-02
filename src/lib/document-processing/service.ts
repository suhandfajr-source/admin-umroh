import { DocumentType } from '@/types/database.types';
import { DocumentExtractionResult, DocumentClassificationResult, FieldSource, FieldConfidence } from '@/types/document.types';
import { classifyDocument } from './classifier';
import { parsePassport } from './parsers/passport-parser';
import { parseKtp } from './parsers/ktp-parser';
import { parseKk } from './parsers/kk-parser';
import { parseVaksin } from './parsers/vaksin-parser';
import { parseBukuNikah } from './parsers/buku-nikah-parser';
import { PreprocessingService } from './preprocessing';

import fs from 'fs';
import path from 'path';

function getTesseractWorkerPath(): string {
  try {
    const resolved = require.resolve('tesseract.js/src/worker-script/node/index.js');
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {}

  const cwdCandidate = path.resolve(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js');
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  return '';
}

export class DocumentProcessingService {
  /**
   * Process document OCR text and extract structured domain data
   */
  public static async processText(
    rawText: string, 
    filename?: string,
    forcedType?: DocumentType
  ): Promise<DocumentExtractionResult> {
    // 1. Auto Classification
    const detectedClassification = classifyDocument(rawText, filename);
    const docType: DocumentType = forcedType || detectedClassification.detected_type;

    let fields: Record<string, any> = {};
    let mrzData: Record<string, any> | undefined = undefined;
    const qualityWarnings: string[] = [];
    let fieldSources: Record<string, FieldSource> | undefined = undefined;
    let fieldConfidences: Record<string, FieldConfidence> | undefined = undefined;
    let conflicts: string[] | undefined = undefined;

    // Check for classification mismatch warning if user forced a type that strongly disagrees with OCR
    if (forcedType && detectedClassification.detected_type !== 'OTHER' && forcedType !== detectedClassification.detected_type && detectedClassification.confidence >= 60) {
      qualityWarnings.push(`Perhatian: Dokumen terdeteksi sebagai ${detectedClassification.detected_type} berdasarkan teks OCR, namun diproses sebagai ${forcedType}.`);
    }

    // 2. Specialized Parsing based on Document Type
    switch (docType) {
      case 'PASSPORT': {
        const passportData = parsePassport(rawText, filename);
        fields = passportData;
        mrzData = passportData.mrz_parsed;
        fieldSources = passportData.field_sources;
        fieldConfidences = passportData.field_confidences;
        conflicts = passportData.conflicts;

        if (!passportData.passport_number) {
          qualityWarnings.push('Nomor Paspor tidak terdeteksi secara jelas.');
        }
        if (!passportData.passport_name) {
          qualityWarnings.push('Nama Paspor tidak terdeteksi.');
        }
        if (!passportData.passport_expiry_date) {
          qualityWarnings.push('Tanggal Kadaluarsa Paspor tidak terdeteksi.');
        }
        if (passportData.mrz_parsed && !passportData.mrz_parsed.valid) {
          qualityWarnings.push('Checksum MRZ Paspor memiliki ketidaksesuaian.');
        }
        break;
      }
      case 'KTP': {
        const ktpData = parseKtp(rawText);
        fields = ktpData;
        fieldSources = ktpData.field_sources;
        fieldConfidences = ktpData.field_confidences;
        conflicts = ktpData.conflicts;

        if (!ktpData.nik || ktpData.nik.length !== 16) {
          qualityWarnings.push('Format NIK KTP tidak standar 16 digit.');
        }
        if (!ktpData.ktp_name) {
          qualityWarnings.push('Nama pada KTP tidak terdeteksi.');
        }
        break;
      }
      case 'KK': {
        const kkData = parseKk(rawText);
        fields = kkData;
        fieldSources = kkData.field_sources;
        fieldConfidences = kkData.field_confidences;
        conflicts = kkData.conflicts;

        if (!kkData.kk_number) {
          qualityWarnings.push('Nomor Kartu Keluarga tidak terdeteksi.');
        }
        if (!kkData.members || kkData.members.length === 0) {
          qualityWarnings.push('Tabel anggota keluarga tidak terdeteksi otomatis.');
        }
        break;
      }
      case 'VAKSIN': {
        const vaxData = parseVaksin(rawText);
        fields = vaxData;
        fieldSources = vaxData.field_sources;
        fieldConfidences = vaxData.field_confidences;
        conflicts = vaxData.conflicts;

        if (!vaxData.recipient_name) {
          qualityWarnings.push('Nama penerima vaksin tidak terdeteksi.');
        }
        if (!vaxData.vaccination_date) {
          qualityWarnings.push('Tanggal vaksinasi tidak terdeteksi.');
        }
        break;
      }
      case 'BUKU_NIKAH': {
        const nikahData = parseBukuNikah(rawText);
        fields = nikahData;
        fieldSources = nikahData.field_sources;
        fieldConfidences = nikahData.field_confidences;
        conflicts = nikahData.conflicts;

        if (!nikahData.husband_name || !nikahData.wife_name) {
          qualityWarnings.push('Nama pasangan nikah perlu diverifikasi manual.');
        }
        if (!nikahData.marriage_date) {
          qualityWarnings.push('Tanggal akad nikah tidak terdeteksi.');
        }
        break;
      }
      case 'OTHER':
      default: {
        fields = {
          notes: 'Dokumen tersimpan sebagai lampiran pendukung.',
          extracted_snippet: rawText ? rawText.substring(0, 300) : '',
        };
        break;
      }
    }

    if (conflicts && conflicts.length > 0) {
      qualityWarnings.push(...conflicts);
    }

    // Compute final confidence score
    let baseConfidence = forcedType ? 100 : detectedClassification.confidence;
    if (qualityWarnings.length > 0) {
      baseConfidence = Math.max(20, baseConfidence - (qualityWarnings.length * 15));
    }

    return {
      document_type: docType,
      confidence: baseConfidence,
      raw_text: rawText || '',
      fields,
      mrz_data: mrzData,
      quality_warnings: qualityWarnings,
      field_sources: fieldSources,
      field_confidences: fieldConfidences,
      conflicts,
    };
  }

  /**
   * Run OCR via Tesseract.js on an image buffer or path with hard timeout and safe error containment
   */
  public static async runOcr(
    imageBufferOrUrl: string | Buffer,
    options?: { timeoutMs?: number; mimeType?: string }
  ): Promise<{ text: string; error?: string }> {
    const timeoutMs = options?.timeoutMs || 60000;
    let worker: any = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    // Validate buffer if Buffer provided
    if (Buffer.isBuffer(imageBufferOrUrl)) {
      const val = PreprocessingService.validateBuffer(imageBufferOrUrl, options?.mimeType || 'image/png');
      if (!val.valid) {
        return { text: '', error: val.warnings[0] || 'BUFFER_INVALID' };
      }
    }

    const timeoutPromise = new Promise<{ text: string; error: string }>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new Error('OCR_TIMEOUT'));
      }, timeoutMs);
    });

    const ocrPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const workerPath = getTesseractWorkerPath();

      const workerOptions: Record<string, any> = {
        errorHandler: (err: any) => {
          // Log safe diagnostic warning without crashing worker process
          console.warn('[OCR_WORKER_DIAGNOSTIC]', typeof err === 'string' ? err : err?.message || 'Worker event warning');
        }
      };

      if (workerPath) {
        workerOptions.workerPath = workerPath;
      }
      const localTessdata = process.cwd();
      if (fs.existsSync(path.join(localTessdata, 'ind.traineddata')) && fs.existsSync(path.join(localTessdata, 'eng.traineddata'))) {
        workerOptions.langPath = localTessdata;
        workerOptions.gzip = false;
      }

      worker = await createWorker('ind+eng', 1, workerOptions);
      const ret1 = await worker.recognize(imageBufferOrUrl);
      let fullText = ret1.data?.text || '';

      // Secondary Sparse Pass to capture faint/spread-out text (e.g. KTP background city, addresses)
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '11' as any, // PSM.SPARSE_TEXT
        });
        const ret2 = await worker.recognize(imageBufferOrUrl);
        if (ret2.data?.text) {
          fullText = fullText + '\n' + ret2.data.text;
        }
      } catch (sparseErr) {
        // Safe fallback to primary pass
      }

      return { text: fullText, error: undefined };
    })();

    try {
      const result = await Promise.race([ocrPromise, timeoutPromise]);
      return result;
    } catch (error: any) {
      const isTimeout = error?.message === 'OCR_TIMEOUT';
      if (isTimeout) {
        console.warn('[OCR_TIMEOUT] OCR execution exceeded timeout of', timeoutMs, 'ms');
        return { text: '', error: 'OCR_TIMEOUT' };
      }
      console.warn('[OCR_EXECUTION_ERROR]', error?.message || error);
      return { text: '', error: error?.message || 'OCR_FAILED' };
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (worker) {
        try {
          await worker.terminate();
        } catch (termErr) {
          console.warn('[OCR_WORKER_TERMINATE_WARNING]', termErr);
        }
      }
    }
  }
}
