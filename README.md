# Memorwise

Your local, open-source notebook for chatting with documents. Add PDFs, images, audio, video, URLs, and YouTube links — Memorwise chunks and embeds them locally, then lets you chat with your documents using any LLM provider.

## Setup (2 minutes)

```bash
git clone https://github.com/robzilla1738/Memorwise.git
cd Memorwise
npm install
npm run dev
```

Open **http://localhost:3000**. Go to **Settings** (⚙️ icon) and configure at least one LLM provider. Create a notebook, add sources, start chatting.

**Requirements:** Node.js 18+ ([download](https://nodejs.org))

**Or use the setup script** (checks everything for you):
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## Configuring LLM Providers

Open Settings → **Providers** tab. You need at least one:

| Provider | How to set up | Cost |
|----------|--------------|------|
| **Ollama** | [Install](https://ollama.com), run `ollama serve`, then `ollama pull llama3.1` | Free (local) |
| **LM Studio** | [Download](https://lmstudio.ai), load a model, start server | Free (local) |
| **OpenAI** | Paste API key from [platform.openai.com](https://platform.openai.com/api-keys) | Paid |
| **Anthropic** | Paste API key from [console.anthropic.com](https://console.anthropic.com) | Paid |
| **Gemini** | Paste API key from [aistudio.google.com](https://aistudio.google.com/apikey) | Free tier |
| **Groq** | Paste API key from [console.groq.com](https://console.groq.com) | Free tier |
| **Mistral** | Paste API key from [console.mistral.ai](https://console.mistral.ai) | Free tier |
| **OpenRouter** | Paste API key from [openrouter.ai](https://openrouter.ai/keys) | Pay per use |

**Mix and match:** In Settings, you can use different providers for different tasks:
- **Chat** → Any provider (e.g., OpenAI GPT-5.4)
- **Embeddings** → Local model (e.g., Ollama nomic-embed-text)
- **Transcription** → OpenAI Whisper, Groq Whisper, or Local Whisper
- **TTS** → OpenAI voices or Kokoro (local, free)

## Features

- **Chat with documents** — RAG-powered Q&A with source citations
- **8 LLM providers** — Ollama, OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, LM Studio
- **20+ file formats** — PDF, DOCX, XLSX, images (OCR), audio/video (Whisper), URLs, YouTube
- **Knowledge graph** — AI-extracted concepts with visual connections between sources
- **Study tools** — Flashcards, quizzes, study guides, summaries (all saved per notebook)
- **Audio overview** — Podcast-style multi-speaker audio from your documents
- **Source-specific chat** — Focus conversation on a single source
- **Notes** — Markdown editor with backlinks and templates
- **Per-task providers** — Different models for chat, embeddings, transcription, TTS
- **Local-first** — All data on your machine, no cloud, no account

## Adding Sources

| Source type | How |
|------------|-----|
| **Files** | Click "+ Add sources" → select files (PDF, DOCX, images, audio, video) |
| **URLs** | Paste any web URL in the URL input |
| **YouTube** | Paste a YouTube video URL (auto-transcribes) |

Sources are automatically chunked, embedded, and indexed. Images use local OCR (Tesseract.js). Audio/video use Whisper transcription.

## Optional Dependencies

These are only needed for specific features:

| Tool | Feature | Install |
|------|---------|---------|
| **ffmpeg** | Video transcription | `brew install ffmpeg` (macOS) |
| **Ollama** | Local LLM models | [ollama.com](https://ollama.com) |
| **espeak-ng** | Kokoro local TTS | `brew install espeak-ng` |

## Data Storage

All data stays local in `.openlm/` at the project root:

```
.openlm/
├── openlm.db        — SQLite database
├── lancedb/         — Vector embeddings
├── sources/         — Uploaded files
└── whisper-models/  — Local Whisper models (if used)
```

To change the data location, set `MEMORWISE_DATA_DIR`:
```bash
MEMORWISE_DATA_DIR=/path/to/data npm run dev
```

## Local TTS — Kokoro (Optional)

Kokoro is an 82M parameter text-to-speech model that runs on your machine — free, offline, 54 voices. Powers the Audio Overview (podcast) feature without needing an OpenAI key.

### One-time setup (automatic)

```bash
./scripts/setup-kokoro.sh
```

This checks for Python 3.12, installs espeak-ng if needed, creates a virtual environment, and installs all Kokoro dependencies.

### One-time setup (manual)

```bash
# 1. Install Python 3.12 (Kokoro doesn't support 3.13 yet)
brew install python@3.12          # macOS
# sudo apt install python3.12     # Linux

# 2. Install espeak-ng (required for phoneme conversion)
brew install espeak-ng             # macOS
# sudo apt install espeak-ng      # Linux

# 3. Create a virtual environment inside your memorwise folder
python3.12 -m venv .kokoro-venv

# 4. Activate and install dependencies
source .kokoro-venv/bin/activate   # bash/zsh
pip install kokoro>=0.9.2 soundfile flask
```

### Start the server

```bash
source .kokoro-venv/bin/activate
python scripts/kokoro-server.py
```

First run downloads the model (~82MB). You'll see:
```
[kokoro] Starting Kokoro TTS server on http://localhost:8787
[kokoro] Pipeline ready for lang_code=a
```

### Enable in Memorwise

Settings → **Audio** → select **Kokoro (Local)** → pick a voice → generate an Audio Overview.

> The Kokoro server runs in a separate terminal. You only need it for the Audio Overview feature.

---

## MCP Server (Claude Code / Cursor)

Memorwise includes an MCP server so AI coding assistants can interact with your notebooks directly.

**Add to Claude Code** (`~/.claude.json` or project `.claude/settings.json`):
```json
{
  "mcpServers": {
    "memorwise": {
      "command": "node",
      "args": ["/path/to/memorwise/mcp-server.js"]
    }
  }
}
```

**Add to Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "memorwise": {
      "command": "node",
      "args": ["/path/to/memorwise/mcp-server.js"]
    }
  }
}
```

No extra dependencies needed — uses `node` directly with the project's TypeScript compiler.

**32 tools available:**

| Category | Tools |
|----------|-------|
| Notebooks | list, create, delete, get |
| Sources | list, add URL, add text, delete, get content |
| Chat | ask question (RAG), get context, search |
| Notes | list, create, update, delete, get |
| Generate | summary, quiz, flashcards, study guide, suggestions |
| Tags | list, create, assign |
| Folders | list, create |
| Chat History | list sessions, get messages |
| Generations | list saved outputs |
| Settings | get/set provider, set model |
| Graph | get knowledge graph |
| Export | full notebook export |

## Production

```bash
npm run build
npm start
# Runs on http://localhost:3000
```

## Tech Stack

Next.js 15 · TypeScript · React 19 · Tailwind CSS v4 · Framer Motion · Zustand · SQLite (better-sqlite3) · LanceDB · Tesseract.js

## License

MIT
