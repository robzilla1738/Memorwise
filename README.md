# Memorwise

An open-source, local-first alternative to NotebookLM. Drop in your PDFs, images, audio, video, URLs, or YouTube links — Memorwise chunks and embeds everything on your machine, then lets you have a conversation with your documents using whichever LLM you prefer.

## Get Started

```bash
npx memorwise
```

That's it. This clones the repo, installs dependencies, starts the server, and opens your browser. Head to **Settings** (gear icon), connect at least one LLM provider, create a notebook, add some sources, and start chatting.

**Requirements:** Node.js 18+ and git

**Prefer to do it manually?**
```bash
git clone https://github.com/robzilla1738/Memorwise.git
cd Memorwise
npm install
npm run dev
```

Then open **http://localhost:3000**.

## Connecting an LLM Provider

Open Settings → **Providers**. Pick at least one — you can always add more later.

| Provider | Setup |
|----------|-------|
| **Ollama** | [Install Ollama](https://ollama.com), run `ollama serve`, then `ollama pull llama3.1` |
| **LM Studio** | [Download LM Studio](https://lmstudio.ai), load a model, start the local server |
| **OpenAI** | Paste your API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Paste your API key from [console.anthropic.com](https://console.anthropic.com) |
| **Gemini** | Paste your API key from [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Groq** | Paste your API key from [console.groq.com](https://console.groq.com) |
| **Mistral** | Paste your API key from [console.mistral.ai](https://console.mistral.ai) |
| **OpenRouter** | Paste your API key from [openrouter.ai](https://openrouter.ai/keys) |

**Mix and match providers per task** — use whatever combination makes sense for you:
- **Chat** — Any provider (e.g., OpenAI GPT-5.4, Claude, local Ollama model)
- **Embeddings** — Local model recommended (e.g., Ollama `nomic-embed-text`)
- **Transcription** — OpenAI Whisper, Groq Whisper, or Local Whisper
- **Text-to-Speech** — OpenAI voices or Kokoro (local, free)

## What You Can Do

- **Chat with your documents** — RAG-powered Q&A with source citations
- **8 LLM providers** — Ollama, OpenAI, Anthropic, Gemini, Groq, Mistral, OpenRouter, LM Studio
- **20+ file formats** — PDF, DOCX, XLSX, images (OCR), audio/video (Whisper), URLs, YouTube
- **Knowledge graph** — AI-extracted concepts showing how your sources connect
- **Study tools** — Flashcards, quizzes, study guides, and summaries, all saved per notebook
- **Audio overview** — Generate a podcast-style multi-speaker discussion from your documents
- **Source-focused chat** — Drill into a single source for deeper conversation
- **Notes** — Markdown editor with backlinks and templates
- **Per-task providers** — Different models for chat, embeddings, transcription, and TTS
- **Completely local** — All data lives on your machine. No cloud. No account.

## Adding Sources

| Source type | How |
|------------|-----|
| **Files** | Click "+ Add sources" and select files (PDF, DOCX, images, audio, video) |
| **URLs** | Paste any web URL into the URL input |
| **YouTube** | Paste a YouTube link (transcript is pulled automatically) |

Sources are chunked, embedded, and indexed on upload. Images go through local OCR via Tesseract.js. Audio and video are transcribed with Whisper.

## Optional Dependencies

Everything below is optional — only install what you need:

| Tool | What it enables | Install |
|------|----------------|---------|
| **Ollama** | Run LLMs locally | [ollama.com](https://ollama.com) |
| **LM Studio** | Run LLMs locally (GUI) | [lmstudio.ai](https://lmstudio.ai) |
| **ffmpeg** | Video file transcription | `brew install ffmpeg` (macOS) / `apt install ffmpeg` (Linux) / `choco install ffmpeg` (Windows) |
| **espeak-ng** | Kokoro local TTS | `brew install espeak-ng` (macOS) / `apt install espeak-ng` (Linux) / [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases) (Windows) |

## Data Storage

All your data stays local in `.memorwise/` at the project root:

```
.memorwise/
├── memorwise.db     — SQLite database
├── lancedb/         — Vector embeddings
├── sources/         — Uploaded files
└── whisper-models/  — Local Whisper models (if used)
```

Want to store data somewhere else? Set the `MEMORWISE_DATA_DIR` environment variable:
```bash
MEMORWISE_DATA_DIR=/path/to/data npm run dev
```

## Local TTS with Kokoro (Optional)

Kokoro is a small (82M parameter) text-to-speech model that runs entirely on your machine — free, offline, with 54 voices. It powers the Audio Overview feature so you can generate podcasts without an OpenAI key.

**Quick setup:**
```bash
./scripts/setup-kokoro.sh
```

This handles Python 3.12, espeak-ng, the virtual environment, and all dependencies.

<details>
<summary>Manual setup</summary>

```bash
# 1. Install Python 3.12 (Kokoro doesn't support 3.13 yet)
brew install python@3.12          # macOS
# sudo apt install python3.12     # Linux

# 2. Install espeak-ng
brew install espeak-ng             # macOS
# sudo apt install espeak-ng      # Linux

# 3. Create a virtual environment
python3.12 -m venv .kokoro-venv

# 4. Install dependencies
source .kokoro-venv/bin/activate
pip install kokoro>=0.9.2 soundfile flask
```
</details>

**Start the Kokoro server:**
```bash
source .kokoro-venv/bin/activate
python scripts/kokoro-server.py
```

Then in Memorwise: Settings → **Audio** → **Kokoro (Local)** → pick a voice → generate an Audio Overview.

> Kokoro runs in a separate terminal. You only need it when generating audio.

---

## MCP Server (Claude Code / Cursor)

Memorwise ships with an MCP server so AI coding assistants can read, search, and interact with your notebooks directly.

**Claude Code** — add to `~/.claude.json` or `.claude/settings.json`:
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

**Cursor** — add to `.cursor/mcp.json`:
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

No extra setup — it uses `node` directly with the project's TypeScript compiler.

**35 tools across 12 categories:**

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

## Production Build

```bash
npm run build
npm start
# → http://localhost:3000
```

## Tech Stack

Next.js 15 · TypeScript · React 19 · Tailwind CSS v4 · Framer Motion · Zustand · SQLite (better-sqlite3) · LanceDB · Tesseract.js

## License

MIT
