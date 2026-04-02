import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { getDataDir } from '../paths';
import { getSetting } from '../db/queries';

type ProviderType = 'openai' | 'groq' | 'local';

interface TranscriptionConfig {
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  localModelId?: string;
}

function getTranscriptionConfig(): TranscriptionConfig {
  const provider = (getSetting('transcription_provider') || 'openai') as string;

  if (provider === 'local') {
    const modelId = getSetting('local_whisper_model') || '';
    if (!modelId) {
      throw new Error(
        'No local Whisper model selected. Go to Settings → Models & Tasks → Transcription and download a model.'
      );
    }
    return { provider: 'local', model: modelId, localModelId: modelId };
  }

  if (provider === 'groq') {
    const apiKey = getSetting('groq_api_key');
    if (!apiKey) {
      throw new Error(
        'Groq transcription requires a Groq API key. ' +
        'Go to Settings → Providers → Groq → add your API key.'
      );
    }
    return { provider: 'groq', apiKey, baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3' };
  }

  // Default: OpenAI Whisper
  const apiKey = getSetting('openai_api_key');
  if (!apiKey) {
    throw new Error(
      'Audio/video transcription requires an OpenAI API key (for Whisper API). ' +
      'Go to Settings → Providers → OpenAI → add your API key. ' +
      'Or switch to Local Whisper or Groq in Settings → Models & Tasks.'
    );
  }
  return { provider: 'openai', apiKey, baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' };
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const config = getTranscriptionConfig();
  if (config.provider === 'local') {
    return transcribeWithLocal(audioPath, config.localModelId!);
  }
  return transcribeWithApi(audioPath, config);
}

async function transcribeWithLocal(audioPath: string, modelId: string): Promise<string> {
  const { transcribeLocal, isModelDownloaded } = await import('./local-whisper');
  if (!isModelDownloaded(modelId)) {
    throw new Error(`Local Whisper model "${modelId}" is not downloaded. Go to Settings → Models & Tasks → Transcription to download it.`);
  }
  return transcribeLocal(audioPath, modelId);
}

async function transcribeWithApi(audioPath: string, config: TranscriptionConfig): Promise<string> {
  console.log(`[transcribe] Sending ${path.basename(audioPath)} to ${config.provider} Whisper (${config.model})...`);
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });

  const fileStream = fs.createReadStream(audioPath);
  const response = await client.audio.transcriptions.create({
    model: config.model,
    file: fileStream,
    response_format: 'text',
  });

  const text = typeof response === 'string' ? response : String(response);
  console.log(`[transcribe] Done (${config.provider}), got ${text.length} chars`);
  return text;
}

export async function transcribeVideo(videoPath: string): Promise<string> {
  // Check ffmpeg
  try {
    execSync(process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'Video transcription requires ffmpeg. Install it:\n' +
      '  macOS:   brew install ffmpeg\n' +
      '  Linux:   sudo apt install ffmpeg\n' +
      '  Windows: choco install ffmpeg  (or download from ffmpeg.org)'
    );
  }

  const config = getTranscriptionConfig();

  const tempAudio = path.join(getDataDir(), `temp_audio_${Date.now()}.wav`);

  try {
    console.log(`[transcribe] Extracting audio from ${path.basename(videoPath)}...`);
    execFileSync('ffmpeg', ['-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', tempAudio, '-y'], {
      stdio: 'ignore',
      timeout: 300000,
    });

    if (!fs.existsSync(tempAudio)) {
      throw new Error('ffmpeg failed to extract audio');
    }

    if (config.provider === 'local') {
      return await transcribeWithLocal(tempAudio, config.localModelId!);
    }
    return await transcribeWithApi(tempAudio, config);
  } finally {
    try { fs.unlinkSync(tempAudio); } catch { /* ignore */ }
  }
}
