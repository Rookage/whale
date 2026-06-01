<p align="center">
  <img src="whale-demo.gif" alt="WHALE Demo" width="800">
</p>

<h1 align="center">🐳 WHALE — Douyin Content Repurposing Tool</h1>
<h3 align="center">Douyin Link → Transcript → AI Rewrite (Xiaohongshu + Douyin) → TTS → Video</h3>

<p align="center">
  <img src="https://img.shields.io/badge/version-v17-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-ISC-green" alt="License">
  <img src="https://img.shields.io/badge/Node.js-16%2B-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue" alt="Python">
  <img src="https://img.shields.io/badge/AI-DeepSeek-blueviolet" alt="DeepSeek">
  <img src="https://img.shields.io/badge/ASR-faster--whisper-ff69b4" alt="Whisper">
  <img src="https://img.shields.io/badge/TTS-edge--tts-9cf" alt="edge-tts">
</p>

---

<p align="center">
  <a href="#english">English</a> | <a href="#chinese">中文</a>
</p>

---

<h2 id="english">🇬🇧 English</h2>

### The Problem

You see a great Douyin video. You want to repurpose its content for Xiaohongshu, or turn it into a narrated video of your own. Normally you'd: watch, pause, transcribe by hand, rewrite, record voiceover, find stock footage, edit... **hours of work.**

### The Solution

WHALE automates the entire pipeline in minutes.

| Manual Work | WHALE Automation |
|------|------|
| Watch, pause, hand-copy script | 🎬 Puppeteer extracts in 10s |
| Rewrite, brainstorm hooks, titles | ✍️ DeepSeek dual-style rewrite |
| Find voice talent, re-record | 🎙️ edge-tts with 6 Chinese voices |
| Source footage, edit, subtitle | 🎥 Pexels + ffmpeg auto-synthesis |

### 5-Stage Pipeline

| # | Stage | Tech | Time | Output |
|---|-------|------|------|--------|
| 1 | 🎬 Extract | Puppeteer | ~10s | Title, author, engagement data |
| 2 | 📝 Transcript | faster-whisper | 2–5min | Full speech-to-text |
| 3 | ✍️ Rewrite | DeepSeek | ~5s | Xiaohongshu / Douyin style |
| 4 | 🎙️ TTS | edge-tts + SSML | ~10s | MP3 audio |
| 5 | 🎥 Video | Pexels + ffmpeg | ~30s | 1080×1920 vertical MP4 |

### Two Rewrite Styles

| | 💄 Xiaohongshu | 🎵 Douyin Select |
|------|------|------|
| Title optimization | ✅ SEO keywords | ✅ 3-second hook |
| Body structure | 7 templates | TTS-friendly |
| Anti-AI-tone | ✅ 18 hook types | ✅ Conversational |
| Emoji | ✅ | ❌ (TTS reads them aloud) |
| Ending | Engagement ask | Follow + bookmark |

### Quick Start

```bash
git clone https://github.com/Rookage/whale.git
cd whale
npm install
pip install edge-tts faster-whisper
cp .env.example .env  # Add your DeepSeek API Key
npm start             # http://localhost:3000

# Optional: add Pexels API Key in .env for video images
```

### Tech Stack

| Layer | Tech |
|----|------|
| Browser Extraction | Puppeteer v25 |
| Speech Recognition | faster-whisper small |
| AI Rewrite | DeepSeek API |
| Text-to-Speech | edge-tts v7.2.8 + SSML |
| Image Search | Pexels API |
| Video Synthesis | ffmpeg v8.1.1 |
| Frontend | Vanilla HTML/CSS/JS, Mario NES pixel-art theme |

### License

MIT

---

<h2 id="chinese">🇨🇳 中文</h2>

### 为什么你需要这个工具？

做自媒体的都知道：**看别人视频很简单，把自己的想法变成视频很痛苦。** WHALE 把最花时间的文案提取、改写、配音、配画面全部自动化。

| 手工操作 | WHALE 自动化 |
|------|------|
| 看视频、暂停、手抄文案 | 🎬 Puppeteer 10 秒提取 |
| 自己改写、想标题、找钩子 | ✍️ DeepSeek 双风格改写 |
| 找配音、调语速、反复录 | 🎙️ edge-tts 6 种语音 |
| 找素材、剪辑、加字幕 | 🎥 Pexels + ffmpeg 自动合成 |

### 五阶段流水线

| # | 阶段 | 技术 | 耗时 |
|---|------|------|------|
| 1 | 🎬 视频描述提取 | Puppeteer | ~10s |
| 2 | 📝 逐字稿生成 | faster-whisper | 2-5min |
| 3 | ✍️ AI 改写 | DeepSeek（小红书+抖音双风格） | ~5s |
| 4 | 🎙️ TTS 语音 | edge-tts（6 种中文语音） | ~10s |
| 5 | 🎥 视频合成 | Pexels + ffmpeg | ~30s |

### 两种改写风格

| | 💄 小红书 | 🎵 抖音精选 |
|------|------|------|
| 标题优化 | ✅ SEO 关键词 | ✅ 3 秒钩子 |
| 正文结构 | 7 种模板 | TTS 友好 |
| 去 AI 味 | ✅ 18 种钩子 | ✅ 口语化 |
| emoji | ✅ | ❌（TTS 会读出来） |

### 🎮 Mario 像素风 UI

4 个马里奥角色精灵 + 绿色管道流水线 + 金币黄焦点高亮。零框架，原生 HTML/CSS/JS。

### 快速开始

```bash
git clone https://github.com/Rookage/whale.git
cd whale
npm install
pip install edge-tts faster-whisper
cp .env.example .env  # 填入 DeepSeek API Key
npm start             # http://localhost:3000
```

### 技术栈

| 层 | 技术 |
|----|------|
| 浏览器提取 | Puppeteer v25 |
| 语音识别 | faster-whisper small |
| AI 改写 | DeepSeek API |
| 语音合成 | edge-tts v7.2.8 + SSML |
| 视频合成 | ffmpeg v8.1.1 |

### 许可证

MIT

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Rookage">Rookage</a></sub>
</p>
