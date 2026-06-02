# Douyin Content Toolkit (WHALE)

Convert Douyin videos into rewritten content, voiceovers, and repurposed videos — all automated.

## What This Project Does

A 5-stage pipeline that takes a Douyin link and outputs:
1. Video description & metadata (Puppeteer, ~10s)
2. Full transcript via speech recognition (faster-whisper, 2–5min)
3. AI rewrite in two styles — Xiaohongshu or Douyin Select (DeepSeek, ~5s)
4. Text-to-speech voiceover (edge-tts, 6 Chinese voices, ~10s)
5. Synthesized video with stock footage (Pexels + ffmpeg, ~30s)

## Project Structure

```
douyin-xiaohongshu-rewriter/
├── server.js          # Express backend, port 3000
├── transcribe.py      # faster-whisper ASR (daemon mode)
├── tts.py             # edge-tts with SSML
├── services/
│   └── imageSearch.js # Pexels image search
├── public/            # Mario NES pixel-art UI
└── .env.example       # DEEPSEEK_API_KEY, PEXELS_API_KEY
```

## Available API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/extract` | POST | Extract video description `{ url }` |
| `/api/transcript` | POST | Full speech-to-text `{ url }` |
| `/api/rewrite` | POST | AI rewrite `{ text, style }` (style: xhs/douyin) |
| `/api/tts` | POST | Generate MP3 `{ text, voice }` |
| `/api/video/generate` | POST | Synthesize video `{ text }` |
| `/api/clear-cache` | POST | Reset browser + ASR + temp files |

## Quick Start

```bash
cd douyin-xiaohongshu-rewriter
npm install
pip install edge-tts faster-whisper
cp .env.example .env   # Add DEEPSEEK_API_KEY
npm start              # http://localhost:3000
```

## Common Issues

- **Server won't start**: Make sure `.env` exists with valid `DEEPSEEK_API_KEY`
- **Puppeteer timeout on Douyin**: Douyin has anti-bot protection. Wait 10s between requests
- **ASR daemon fails**: Model downloads from `hf-mirror.com`. First run takes 2–3 minutes
- **ffmpeg not found**: Set `FFMPEG_PATH` in `.env` or install ffmpeg
- **Windows encoding**: Python subprocesses need `PYTHONIOENCODING=utf-8`
