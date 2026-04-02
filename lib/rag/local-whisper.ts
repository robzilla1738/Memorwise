import path from 'path';
import fs from 'fs';
import { getDataDir } from '../paths';

export interface WhisperModel {
  id: string;
  name: string;
  description: string;
  accuracy: number; // 1-5
  speed: number; // 1-5
  size: string;
  language: 'Multilingual' | 'English';
  hfModelId: string; // Hugging Face model ID for transformers.js
  downloaded?: boolean;
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: 'whisper-large-v3-turbo-q',
    name: 'Whisper Large V3 Turbo (Quantized)',
    description: 'Best for long audio transcriptions in any language. Compressed model delivers excellent accuracy while using less memory.',
    accuracy: 4, speed: 4, size: '547 MB', language: 'Multilingual',
    hfModelId: 'onnx-community/whisper-large-v3-turbo',
  },
  {
    id: 'distil-whisper-large-v3.5',
    name: 'Distil-Whisper Large V3.5 (English Only)',
    description: 'Newest Distil-Whisper model trained on 4x more diverse data. Delivers excellent accuracy ~1.5x faster than Whisper Large V3 Turbo.',
    accuracy: 4, speed: 3, size: '1.5 GB', language: 'English',
    hfModelId: 'distil-whisper/distil-large-v3.5',
  },
  {
    id: 'distil-whisper-medium-en',
    name: 'Distil-Whisper Medium (English Only)',
    description: 'Works well for English dictation with almost immediate output. Good accuracy while using less storage.',
    accuracy: 3, speed: 4, size: '794 MB', language: 'English',
    hfModelId: 'distil-whisper/distil-medium.en',
  },
  {
    id: 'distil-whisper-small-en',
    name: 'Distil-Whisper Small (English Only)',
    description: 'Fast English-optimized transcription with good accuracy. Quick processing with reduced storage requirements.',
    accuracy: 3, speed: 5, size: '336 MB', language: 'English',
    hfModelId: 'distil-whisper/distil-small.en',
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    description: 'Good for day-to-day dictation. On-device with balanced speed and accuracy for general use.',
    accuracy: 3, speed: 4, size: '244 MB', language: 'Multilingual',
    hfModelId: 'onnx-community/whisper-small',
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base',
    description: 'For quick memos and everyday dictation. Offline with good speed but best for straightforward speech.',
    accuracy: 2, speed: 5, size: '466 MB', language: 'Multilingual',
    hfModelId: 'onnx-community/whisper-base',
  },
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    description: 'For instant voice notes when speed matters. Smallest model gives quick results but limited accuracy.',
    accuracy: 1, speed: 5, size: '75 MB', language: 'Multilingual',
    hfModelId: 'onnx-community/whisper-tiny',
  },
  {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny (English)',
    description: 'For instant voice notes when speed matters. Smallest model, English only, quick results.',
    accuracy: 1, speed: 5, size: '75 MB', language: 'English',
    hfModelId: 'onnx-community/whisper-tiny.en',
  },
];

function getWhisperCacheDir(): string {
  const dir = path.join(getDataDir(), 'whisper-models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isModelDownloaded(modelId: string): boolean {
  const model = WHISPER_MODELS.find(m => m.id === modelId);
  if (!model) return false;
  // Check if transformers.js has cached this model
  const cacheDir = getWhisperCacheDir();
  const markerFile = path.join(cacheDir, `${modelId}.ready`);
  return fs.existsSync(markerFile);
}

export function getDownloadedModels(): string[] {
  return WHISPER_MODELS.filter(m => isModelDownloaded(m.id)).map(m => m.id);
}

export async function downloadModel(modelId: string, onProgress?: (status: string) => void): Promise<void> {
  const model = WHISPER_MODELS.find(m => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const cacheDir = getWhisperCacheDir();
  onProgress?.('Initializing download...');

  // Use transformers.js to download and cache the model
  const { pipeline, env } = await import('@huggingface/transformers');

  // Set cache directory
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;

  onProgress?.('Downloading model files (this may take a few minutes)...');

  // Creating the pipeline downloads the model
  const transcriber = await pipeline('automatic-speech-recognition', model.hfModelId, {
    dtype: 'q4', // Use quantized for smaller size
    device: 'auto',
  });

  // Dispose to free memory after download
  await transcriber.dispose();

  // Mark as downloaded
  fs.writeFileSync(path.join(cacheDir, `${modelId}.ready`), new Date().toISOString());
  onProgress?.('Download complete!');
}

export async function transcribeLocal(audioPath: string, modelId: string): Promise<string> {
  const model = WHISPER_MODELS.find(m => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  const cacheDir = getWhisperCacheDir();

  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;

  console.log(`[local-whisper] Loading ${model.name}...`);
  let transcriber: any;
  try {
    transcriber = await pipeline('automatic-speech-recognition', model.hfModelId, {
      dtype: 'q4',
      device: 'auto',
    });

    console.log(`[local-whisper] Transcribing ${path.basename(audioPath)}...`);
    const result = await transcriber(audioPath, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const text = typeof result === 'string' ? result : (result as { text: string }).text || '';
    console.log(`[local-whisper] Done, got ${text.length} chars`);
    return text;
  } finally {
    if (transcriber) await transcriber.dispose();
  }
}
