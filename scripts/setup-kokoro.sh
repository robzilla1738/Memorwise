#!/bin/bash
# Memorwise — Kokoro Local TTS Setup
# Run: chmod +x scripts/setup-kokoro.sh && ./scripts/setup-kokoro.sh

set -e

echo ""
echo "  Kokoro Local TTS Setup"
echo "  ─────────────────────"
echo ""

# Check Python 3.12
if command -v python3.12 &> /dev/null; then
    PYTHON=python3.12
    echo "✓ Python 3.12 found"
elif command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 -c "import sys; print(sys.version_info.minor)")
    if [ "$PY_VERSION" -le 12 ]; then
        PYTHON=python3
        echo "✓ Python 3.$(python3 -c 'import sys; print(sys.version_info.minor)') found"
    else
        echo "✗ Python 3.13+ detected — Kokoro needs Python 3.12 or earlier"
        echo "  Install: brew install python@3.12"
        exit 1
    fi
else
    echo "✗ Python 3 not found"
    echo "  Install: brew install python@3.12"
    exit 1
fi

# Check espeak-ng
if command -v espeak-ng &> /dev/null; then
    echo "✓ espeak-ng found"
else
    echo "✗ espeak-ng not found"
    echo "  Installing..."
    if command -v brew &> /dev/null; then
        brew install espeak-ng
    elif command -v apt-get &> /dev/null; then
        sudo apt-get install -y espeak-ng
    else
        echo "  Please install espeak-ng manually"
        exit 1
    fi
    echo "✓ espeak-ng installed"
fi

# Create venv
if [ ! -d ".kokoro-venv" ]; then
    echo ""
    echo "→ Creating virtual environment..."
    $PYTHON -m venv .kokoro-venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment exists"
fi

# Install packages
echo ""
echo "→ Installing Kokoro TTS..."
source .kokoro-venv/bin/activate
pip install -q kokoro>=0.9.2 soundfile flask

echo ""
echo "  ✅ Kokoro setup complete!"
echo ""
echo "  To start the TTS server:"
echo "    source .kokoro-venv/bin/activate"
echo "    python scripts/kokoro-server.py"
echo ""
echo "  Then in Memorwise: Settings → Audio → Kokoro (Local)"
echo ""
