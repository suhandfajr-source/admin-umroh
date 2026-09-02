import { createWorker, PSM } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

async function main() {
  const filePath = path.resolve('.data/storage/jamaah/jam_1787986786158_rqszjx/unclassified/1787987000884_6q7v5q.jpeg');
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }

  console.log('Testing OCR on:', filePath);

  const psmModes = [
    { name: 'AUTO (Default 3)', psm: PSM.AUTO },
    { name: 'SINGLE_BLOCK (6)', psm: PSM.SINGLE_BLOCK },
    { name: 'SPARSE_TEXT (11)', psm: PSM.SPARSE_TEXT },
    { name: 'SINGLE_COLUMN (4)', psm: PSM.SINGLE_COLUMN },
  ];

  for (const mode of psmModes) {
    console.log(`\n=================== TESTING PSM: ${mode.name} ===================`);
    const worker = await createWorker('ind+eng', 1, {
      errorHandler: (err) => console.log('worker err:', err)
    });
    
    await worker.setParameters({
      tessedit_pageseg_mode: mode.psm as any,
    });

    const ret = await worker.recognize(filePath);
    console.log('RESULT TEXT:\n', ret.data.text);
    await worker.terminate();
  }
}

main().catch(console.error);
