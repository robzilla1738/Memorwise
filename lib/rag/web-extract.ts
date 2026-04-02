import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { YoutubeTranscript } from 'youtube-transcript';

export interface ExtractedContent {
  title: string;
  text: string;
  sourceType: 'youtube' | 'url';
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function extractYouTube(url: string): Promise<ExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Could not extract YouTube video ID from URL');

  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  if (!transcript || transcript.length === 0) {
    throw new Error('No transcript available for this YouTube video');
  }

  const text = transcript.map(t => t.text).join(' ');

  // Try to get title from page
  let title = `YouTube: ${videoId}`;
  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(r => r.text());
    const $ = cheerio.load(html);
    const pageTitle = $('title').text().replace(' - YouTube', '').trim();
    if (pageTitle) title = pageTitle;
  } catch { /* use default title */ }

  return { title, text, sourceType: 'youtube' };
}

async function extractWebPage(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Memorwise/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
  const html = await response.text();

  // Use Readability for clean content extraction
  const doc = new JSDOM(html, { url });
  const reader = new Readability(doc.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    // Fallback: extract all visible text with Cheerio
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    const fallbackText = $('body').text().replace(/\s+/g, ' ').trim();
    const fallbackTitle = $('title').text().trim() || url;
    return { title: fallbackTitle, text: fallbackText, sourceType: 'url' };
  }

  return {
    title: article.title || url,
    text: article.textContent.trim(),
    sourceType: 'url',
  };
}

export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  if (isYouTubeUrl(url)) {
    return extractYouTube(url);
  }
  return extractWebPage(url);
}
