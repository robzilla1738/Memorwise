import fs from 'fs';
import path from 'path';

export async function ocrImage(imagePath: string): Promise<string> {
  console.log(`[ocr] Starting OCR on ${imagePath}...`);

  const Tesseract = await import('tesseract.js');

  // Create worker with explicit path to avoid Next.js bundling issues
  const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');

  const worker = await Tesseract.createWorker('eng', undefined, {
    workerPath,
  });

  try {
    const result = await Promise.race([
      worker.recognize(imagePath),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out after 90 seconds')), 90000)
      ),
    ]);

    const text = result.data.text.trim();
    console.log(`[ocr] Done, extracted ${text.length} chars`);

    if (!text) {
      throw new Error('OCR found no readable text in the image');
    }

    return text;
  } finally {
    await worker.terminate();
  }
}

export async function parsePdfWithOcrFallback(filepath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filepath);
  const data = await pdfParse(buffer);

  if (data.text && data.text.trim().length > 100) {
    return data.text;
  }

  console.log('[ocr] PDF has sparse text, may be scanned');
  return data.text || '';
}
