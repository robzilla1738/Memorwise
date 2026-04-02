#!/usr/bin/env python3
"""
Kokoro TTS Local Server for Memorwise.
Run: pip install kokoro>=0.9.2 soundfile flask
Then: python scripts/kokoro-server.py
"""

import io
import sys
import json
import soundfile as sf
import numpy as np

try:
    from flask import Flask, request, jsonify, send_file
except ImportError:
    print("Flask not installed. Run: pip install flask")
    sys.exit(1)

try:
    from kokoro import KPipeline
except ImportError:
    print("Kokoro not installed. Run: pip install kokoro>=0.9.2 soundfile")
    print("Also install espeak-ng: brew install espeak-ng (macOS) or apt-get install espeak-ng (Linux)")
    sys.exit(1)

app = Flask(__name__)

# Cache pipelines per language
pipelines = {}

LANG_CODES = {
    'en-us': 'a',
    'en-gb': 'b',
    'es': 'e',
    'fr': 'f',
    'hi': 'h',
    'it': 'i',
    'ja': 'j',
    'pt-br': 'p',
    'zh': 'z',
}

DEFAULT_VOICES = [
    {'id': 'af_heart', 'name': 'Heart (Female)', 'lang': 'en-us'},
    {'id': 'af_bella', 'name': 'Bella (Female)', 'lang': 'en-us'},
    {'id': 'af_nicole', 'name': 'Nicole (Female)', 'lang': 'en-us'},
    {'id': 'af_sarah', 'name': 'Sarah (Female)', 'lang': 'en-us'},
    {'id': 'af_sky', 'name': 'Sky (Female)', 'lang': 'en-us'},
    {'id': 'am_adam', 'name': 'Adam (Male)', 'lang': 'en-us'},
    {'id': 'am_michael', 'name': 'Michael (Male)', 'lang': 'en-us'},
    {'id': 'bf_emma', 'name': 'Emma (Female, British)', 'lang': 'en-gb'},
    {'id': 'bm_george', 'name': 'George (Male, British)', 'lang': 'en-gb'},
    {'id': 'bm_lewis', 'name': 'Lewis (Male, British)', 'lang': 'en-gb'},
]


def get_pipeline(lang_code='a'):
    if lang_code not in pipelines:
        print(f"[kokoro] Loading pipeline for lang_code={lang_code}...")
        pipelines[lang_code] = KPipeline(lang_code=lang_code)
        print(f"[kokoro] Pipeline ready for lang_code={lang_code}")
    return pipelines[lang_code]


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'kokoro-82m'})


@app.route('/voices', methods=['GET'])
def voices():
    return jsonify(DEFAULT_VOICES)


@app.route('/tts', methods=['POST'])
def tts():
    data = request.json
    text = data.get('text', '')
    voice = data.get('voice', 'af_heart')
    lang = data.get('lang', 'en-us')

    if not text:
        return jsonify({'error': 'text is required'}), 400

    lang_code = LANG_CODES.get(lang, 'a')

    try:
        pipeline = get_pipeline(lang_code)
        # Generate all audio segments
        audio_segments = []
        for _, _, audio in pipeline(text, voice=voice):
            audio_segments.append(audio)

        if not audio_segments:
            return jsonify({'error': 'No audio generated'}), 500

        # Concatenate all segments
        full_audio = np.concatenate(audio_segments)

        # Write to WAV buffer
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)

        return send_file(buffer, mimetype='audio/wav', download_name='speech.wav')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/tts/stream', methods=['POST'])
def tts_stream():
    """Generate TTS and return as MP3 base64 for browser playback."""
    data = request.json
    text = data.get('text', '')
    voice = data.get('voice', 'af_heart')
    lang = data.get('lang', 'en-us')

    if not text:
        return jsonify({'error': 'text is required'}), 400

    lang_code = LANG_CODES.get(lang, 'a')

    try:
        pipeline = get_pipeline(lang_code)
        audio_segments = []
        for _, _, audio in pipeline(text, voice=voice):
            audio_segments.append(audio)

        if not audio_segments:
            return jsonify({'error': 'No audio generated'}), 500

        full_audio = np.concatenate(audio_segments)

        # Write WAV to buffer
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)

        import base64
        audio_b64 = base64.b64encode(buffer.read()).decode('utf-8')

        return jsonify({
            'audioBase64': audio_b64,
            'format': 'wav',
            'sampleRate': 24000,
            'duration': len(full_audio) / 24000,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("[kokoro] Starting Kokoro TTS server on http://localhost:8787")
    print("[kokoro] Voices:", len(DEFAULT_VOICES), "available")
    print("[kokoro] Languages: en-us, en-gb, es, fr, hi, it, ja, pt-br, zh")

    # Pre-load English pipeline
    get_pipeline('a')

    app.run(host='0.0.0.0', port=8787, debug=False)
