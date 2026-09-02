import { createWorker, Worker } from 'tesseract.js';

let cachedWorker: Worker | null = null;
let isInitializing = false;

export async function getClientOcrWorker(): Promise<Worker> {
  if (cachedWorker) return cachedWorker;

  if (isInitializing) {
    // Wait for ongoing initialization
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (cachedWorker) return cachedWorker;
  }

  isInitializing = true;
  try {
    const worker = await createWorker('ind+eng', 1, {
      errorHandler: (err) => {
        console.warn('[CLIENT_OCR_WORKER_DIAG]', err);
      }
    });
    cachedWorker = worker;
    return worker;
  } finally {
    isInitializing = false;
  }
}

export async function runClientOcr(
  file: File,
  onProgress?: (percent: number, status: string) => void
): Promise<string> {
  try {
    if (onProgress) onProgress(10, 'Inisialisasi OCR...');
    const worker = await getClientOcrWorker();

    if (onProgress) onProgress(30, 'Mengekstrak teks dokumen...');
    
    const res = await worker.recognize(file);
    let fullText = res.data?.text || '';

    if (onProgress) onProgress(85, 'Memproses teks...');

    // Quick secondary sparse check if needed
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '11' as any, // PSM.SPARSE_TEXT
      });
      const res2 = await worker.recognize(file);
      if (res2.data?.text && res2.data.text.length > fullText.length) {
        fullText = fullText + '\n' + res2.data.text;
      }
    } catch {
      // safe ignore
    }

    if (onProgress) onProgress(100, 'Ekstraksi selesai!');
    return fullText;
  } catch (err: any) {
    console.warn('[CLIENT_OCR_FAILED]', err);
    return '';
  }
}
