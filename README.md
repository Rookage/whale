<p align="center">
  <img src="whale-demo.gif" alt="WHALE Demo" width="800">
</p>

<h1 align="center">🐳 WHALE — 抖音文案智能改写工具</h1>
<h3 align="center">抖音链接 → 逐字稿 → AI改写 → TTS语音 → 视频合成</h3>

<p align="center">
  <img src="https://img.shields.io/badge/version-v17-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-ISC-green" alt="License">
  <img src="https://img.shields.io/badge/Node.js-v16+-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/Python-3.8+-blue" alt="Python">
  <img src="https://img.shields.io/badge/AI-DeepSeek-blueviolet" alt="DeepSeek">
</p>

---

## ✨ 五阶段流水线

| # | 阶段 | 技术 | 耗时 |
|---|------|------|------|
| 1 | 🎬 视频描述提取 | Puppeteer | ~10s |
| 2 | 📝 逐字稿生成 | faster-whisper | 2-5min |
| 3 | ✍️ AI 改写 | DeepSeek（小红书+抖音双风格） | ~5s |
| 4 | 🎙️ TTS 语音 | edge-tts（6种中文语音） | ~10s |
| 5 | 🎥 视频合成 | Pexels + ffmpeg | ~30s |

## 🚀 快速开始

```bash
git clone https://github.com/Rookage/whale.git
cd whale
npm install
pip install edge-tts faster-whisper
cp .env.example .env  # 填入 DeepSeek API Key
npm start             # http://localhost:3000
```

## 🎮 前端风格

Mario NES 像素风 — 4个马里奥角色精灵 + 绿色管道流水线 + 金币黄焦点高亮。零框架，原生 HTML/CSS/JS。

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 浏览器提取 | Puppeteer v25 |
| 语音识别 | faster-whisper small |
| AI 改写 | DeepSeek API |
| 语音合成 | edge-tts v7.2.8 + SSML |
| 图片搜索 | Pexels API |
| 视频合成 | ffmpeg v8.1.1 |

## 📄 许可证

MIT License

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Rookage">Rookage</a></sub>
</p>
