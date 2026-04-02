import { NextResponse } from 'next/server';
import { registry } from '@/lib/llm/provider-registry';
import { getNotebookContext } from '@/lib/generate';
import { getSetting } from '@/lib/db/queries';

const OPENAI_SPEAKER_VOICES: Record<string, 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer'> = {
  'Alex': 'onyx', 'Sam': 'nova', 'Jordan': 'echo', 'Riley': 'shimmer',
};
const KOKORO_SPEAKER_VOICES: Record<string, string> = {
  'Alex': 'am_adam', 'Sam': 'af_heart', 'Jordan': 'bm_george', 'Riley': 'af_bella',
};

interface ScriptLine { speaker: string; text: string; }

function parseScript(script: string, speakerNames: string[]): ScriptLine[] {
  const lines: ScriptLine[] = [];
  const pattern = new RegExp(`^(${speakerNames.join('|')})\\s*:\\s*`, 'i');
  let currentSpeaker = speakerNames[0];
  let currentText = '';

  for (const rawLine of script.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(pattern);
    if (match) {
      if (currentText.trim()) lines.push({ speaker: currentSpeaker, text: currentText.trim() });
      currentSpeaker = match[1];
      currentText = line.slice(match[0].length);
    } else {
      currentText += ' ' + line;
    }
  }
  if (currentText.trim()) lines.push({ speaker: currentSpeaker, text: currentText.trim() });
  return lines;
}

function buildPrompt(speakerCount: number, context: string, len: { words: string; minutes: string; turns: string }): { system: string; user: string } {
  const names = ['Alex', 'Sam', 'Jordan', 'Riley'].slice(0, speakerCount);

  if (speakerCount === 1) {
    return {
      system: `Write a podcast monologue. Output ONLY the script, no titles or notes. Plain text only, no markdown. Format: "Alex: [spoken text]". Make it ${len.words} words, detailed and engaging.`,
      user: `Write a ${len.minutes} minute podcast monologue by Alex about the following content. Be thorough, cover every key point, add personal commentary and insights. Start with an intro, end with a takeaway.

CONTENT:
${context}

Remember: plain text only, no asterisks or formatting. At least ${len.words} words. Start with "Alex:" on the first line.`
    };
  }

  const example = names.length === 2
    ? `Alex: Hey ${names[1]}, today we're diving into something really fascinating. So I was reading through this material and what jumped out to me first was...

${names[1]}: Oh yeah, I noticed that too! What really caught my attention was how they connected that idea to the broader theme. Can you break that down a bit more?

Alex: Absolutely. So the key thing here is...`
    : `Alex: Welcome everyone! Today ${names.slice(1).join(', ')} and I are unpacking some really interesting material. Let me set the stage here...

${names[1]}: Thanks Alex. I've been looking at this and honestly, the first thing that struck me was...

${names[2] || names[1]}: That's a great point. I'd add that...`;

  return {
    system: `Write a podcast conversation between ${names.join(', ')}. Output ONLY the dialogue, no titles or stage directions. Plain text only, no markdown/asterisks. Each turn starts with the speaker name and colon. Make it ${len.words} words with natural back-and-forth.`,
    user: `Write a detailed, engaging ${len.minutes} minute podcast conversation between ${names.join(' and ')} about the following content. They should discuss every key point, react to each other, ask follow-up questions, share insights, and have natural back-and-forth. Each speaker should talk for 2-4 sentences per turn, with at least ${len.turns} turns total.

CONTENT:
${context}

EXAMPLE FORMAT (follow this style exactly):
${example}

RULES:
- Plain text only. No asterisks, no bold, no markdown, no headers.
- No stage directions like [laughs] or (pauses).
- Each line starts with a name and colon: "${names[0]}: ..."
- At least ${len.words} words total, at least ${len.turns} speaker turns.
- Cover ALL the key points from the content.
- End with a summary/takeaway.

Begin the script now:`
  };
}

export async function POST(req: Request) {
  const { notebookId, speakerCount: rawSpeakerCount, length: podcastLength } = await req.json();
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  const speakerCount = Math.min(4, Math.max(1, Number(rawSpeakerCount) || 2));

  const lengthConfig: Record<string, { words: string; minutes: string; turns: string; contextChars: number }> = {
    short: { words: '500-800', minutes: '3-5', turns: '10', contextChars: 3000 },
    medium: { words: '1000-1500', minutes: '7-10', turns: '20', contextChars: 5000 },
    long: { words: '2000-2500', minutes: '12-15', turns: '30', contextChars: 6000 },
  };
  const len = lengthConfig[podcastLength as string] || lengthConfig.medium;

  const context = getNotebookContext(notebookId, len.contextChars);
  if (!context.trim()) return NextResponse.json({ error: 'No readable sources to generate from' }, { status: 400 });

  const provider = registry.getActiveProvider();
  const model = registry.getActiveChatModel();
  const speakerNames = ['Alex', 'Sam', 'Jordan', 'Riley'].slice(0, speakerCount);

  // Step 1: Generate script
  let script: string;
  try {
    const prompt = buildPrompt(speakerCount, context, len);
    script = await provider.generate({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.85,
      maxTokens: 4096,
    });

    // Clean up markdown artifacts
    script = script.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '').replace(/^[-]\s+/gm, '');

    // If script is too short, the model didn't follow instructions well — try to pad context
    if (script.split(/\s+/).length < 200) {
      console.log(`[audio-overview] Script only ${script.split(/\s+/).length} words, attempting longer generation...`);
      const retryScript = await provider.generate({
        model,
        messages: [
          { role: 'system', content: 'Continue and expand this podcast script. Add more discussion, analysis, and commentary. At least 400 more words. Same format — speaker names with colons, plain text only.' },
          { role: 'user', content: script + '\n\nContinue the conversation with more depth and detail:' },
        ],
        temperature: 0.85,
        maxTokens: 4096,
      });
      script = script + '\n' + retryScript.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '');
    }
  } catch (err) {
    return NextResponse.json({ error: `Script generation failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // Step 2: Parse into speaker segments
  const scriptLines = parseScript(script, speakerNames);
  console.log(`[audio-overview] Generated ${scriptLines.length} segments, ${script.split(/\s+/).length} words`);

  // Step 3: Generate TTS
  const ttsProvider = registry.getTTSProvider();
  let audioBase64: string | null = null;
  let audioFormat = 'mp3';

  if (ttsProvider === 'kokoro') {
    try {
      const kokoroUrl = registry.getKokoroUrl();
      const audioBuffers: Buffer[] = [];
      for (const line of scriptLines) {
        const voice = KOKORO_SPEAKER_VOICES[line.speaker] || registry.getKokoroVoice();
        const res = await fetch(`${kokoroUrl}/tts/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: line.text, voice, lang: 'en-us' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) audioBuffers.push(Buffer.from(data.audioBase64, 'base64'));
        }
      }
      if (audioBuffers.length > 0) {
        audioBase64 = Buffer.concat(audioBuffers).toString('base64');
        audioFormat = 'wav';
      }
    } catch (err) {
      console.error('[audio-overview] Kokoro TTS failed:', err);
    }
  } else {
    const openaiKey = getSetting('openai_api_key');
    if (openaiKey) {
      try {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: openaiKey });

        if (speakerCount === 1) {
          const ttsVoice = registry.getTTSVoice() as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
          const fullText = scriptLines.map(l => l.text).join(' ');
          const ttsResponse = await client.audio.speech.create({
            model: 'tts-1', voice: ttsVoice,
            input: fullText.slice(0, 4096), response_format: 'mp3',
          });
          audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString('base64');
        } else {
          // Multi-speaker: batch segments by speaker to reduce API calls and improve flow
          // Group consecutive same-speaker lines, then generate per group
          const groups: ScriptLine[] = [];
          for (const line of scriptLines) {
            const last = groups[groups.length - 1];
            if (last && last.speaker === line.speaker) {
              last.text += ' ' + line.text;
            } else {
              groups.push({ ...line });
            }
          }

          const audioBuffers: Buffer[] = [];
          for (const group of groups) {
            const voice = OPENAI_SPEAKER_VOICES[group.speaker] || 'alloy';
            try {
              const ttsResponse = await client.audio.speech.create({
                model: 'tts-1', voice,
                input: group.text.slice(0, 4096), response_format: 'mp3',
              });
              audioBuffers.push(Buffer.from(await ttsResponse.arrayBuffer()));
            } catch (err) {
              console.error(`[audio-overview] TTS failed for ${group.speaker}:`, err);
            }
          }
          if (audioBuffers.length > 0) {
            audioBase64 = Buffer.concat(audioBuffers).toString('base64');
          }
        }
      } catch (err) {
        console.error('[audio-overview] OpenAI TTS failed:', err);
      }
    }
  }

  return NextResponse.json({
    script, audioBase64, audioFormat,
    hasAudio: !!audioBase64,
    speakerCount,
    segments: scriptLines.length,
    wordCount: script.split(/\s+/).length,
    message: audioBase64
      ? `Audio generated — ${scriptLines.length} segments, ${script.split(/\s+/).length} words`
      : ttsProvider === 'kokoro'
        ? 'Script generated. Start Kokoro server: python scripts/kokoro-server.py'
        : 'Script generated (add OpenAI key for TTS audio)',
  });
}
