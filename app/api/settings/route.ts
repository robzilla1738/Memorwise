import { NextResponse } from 'next/server';
import { registry } from '@/lib/llm/provider-registry';

export async function GET() {
  return NextResponse.json({
    activeProvider: registry.getActiveProvider().id,
    activeChatModel: registry.getActiveChatModel(),
    activeEmbeddingModel: registry.getActiveEmbeddingModel(),
    embeddingProvider: registry.getEmbeddingProviderId(),
    transcriptionProvider: registry.getTranscriptionProvider(),
    localWhisperModel: registry.getLocalWhisperModel(),
    ttsProvider: registry.getTTSProvider(),
    ttsVoice: registry.getTTSVoice(),
    kokoroUrl: registry.getKokoroUrl(),
    kokoroVoice: registry.getKokoroVoice(),
    podcastSpeakers: registry.getPodcastSpeakers(),
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (body.activeProvider) registry.setActiveProvider(body.activeProvider);
  if (body.activeChatModel) registry.setActiveChatModel(body.activeChatModel);
  if (body.activeEmbeddingModel) registry.setActiveEmbeddingModel(body.activeEmbeddingModel);
  if (body.embeddingProvider) registry.setEmbeddingProvider(body.embeddingProvider);
  if (body.transcriptionProvider) registry.setTranscriptionProvider(body.transcriptionProvider);
  if (body.localWhisperModel !== undefined) registry.setLocalWhisperModel(body.localWhisperModel);
  if (body.ttsProvider) registry.setTTSProvider(body.ttsProvider);
  if (body.ttsVoice) registry.setTTSVoice(body.ttsVoice);
  if (body.kokoroUrl) registry.setKokoroUrl(body.kokoroUrl);
  if (body.kokoroVoice) registry.setKokoroVoice(body.kokoroVoice);
  if (body.podcastSpeakers) registry.setPodcastSpeakers(body.podcastSpeakers);
  return NextResponse.json({ success: true });
}
