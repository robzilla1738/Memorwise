#!/bin/bash
# Memorwise Setup Script
# Run: chmod +x scripts/setup.sh && ./scripts/setup.sh

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         Memorwise Setup              ║"
echo "  ║   Local notebook for documents       ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Install it from https://nodejs.org (v18+ required)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18+ required (you have $(node -v))"
    echo "   Update from https://nodejs.org"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✓ npm $(npm -v)"

# Install dependencies
echo ""
echo "→ Installing dependencies..."
npm install

# Check optional dependencies
echo ""
echo "Checking optional tools..."

if command -v ffmpeg &> /dev/null; then
    echo "✓ ffmpeg (video transcription)"
else
    echo "○ ffmpeg not found (optional — needed for video transcription)"
    echo "  Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
fi

if command -v ollama &> /dev/null; then
    echo "✓ ollama (local LLM)"
else
    echo "○ ollama not found (optional — for local models)"
    echo "  Install from https://ollama.com"
fi

# Build
echo ""
echo "→ Building..."
npm run build

echo ""
echo "  ✅ Setup complete!"
echo ""
echo "  To start Memorwise:"
echo "    npm run dev        (development)"
echo "    npm start          (production)"
echo ""
echo "  Then open http://localhost:3000"
echo ""
echo "  First time? Go to Settings (⚙️) and configure"
echo "  at least one LLM provider to get started."
echo ""
