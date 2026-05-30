require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(os.tmpdir(), 'dy2xhs');
const AUDIO_DIR = path.join(__dirname, 'audio');
const VIDEO_DIR = path.join(__dirname, 'video');
const IMAGES_DIR = path.join(__dirname, 'images');
const UPLOAD_DIR = path.join(TEMP_DIR, 'uploads');
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'C:\\Users\\Administrator\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe';
const PYTHON_PATH = process.env.PYTHON_PATH || 'C:\\Python314\\python.exe';
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isMp4 = file.mimetype === 'video/mp4' || file.originalname.toLowerCase().endsWith('.mp4');
    cb(null, isMp4);
  },
});

// Runtime config — starts from .env, can be overridden via UI
const CONFIG_FILE = path.join(__dirname, 'config.json');
let runtimeConfig = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  pexelsApiKey: process.env.PEXELS_API_KEY || '',
};

// Load saved config from UI (overrides .env)
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (saved.deepseekApiKey) runtimeConfig.deepseekApiKey = saved.deepseekApiKey;
    if (saved.pexelsApiKey) runtimeConfig.pexelsApiKey = saved.pexelsApiKey;
    console.log('[Config] Loaded saved API keys from config.json');
  } catch (e) { console.warn('[Config] Failed to parse config.json:', e.message); }
}

function saveRuntimeConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    deepseekApiKey: runtimeConfig.deepseekApiKey,
    pexelsApiKey: runtimeConfig.pexelsApiKey,
  }, null, 2), 'utf-8');
}

const imageSearch = require('./services/imageSearch');
imageSearch.init({
  deepseekApiKey: runtimeConfig.deepseekApiKey,
  pexelsApiKey: runtimeConfig.pexelsApiKey,
});

app.use(express.json());
app.use(express.static('public'));
app.use('/audio', express.static(AUDIO_DIR));
app.use('/video', express.static(VIDEO_DIR));

// Disable caching for API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// ============ Puppeteer Browser Pool ============

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

async function closeBrowser() {
  if (browser) { await browser.close().catch(() => {}); browser = null; }
}

function shutdown() {
  closeBrowser();
  if (asrProc) { asrProc.kill(); asrProc = null; }
  process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============ Helpers ============

function isValidDouyinUrl(url) {
  return /douyin\.com|iesdouyin\.com/.test(url);
}

function extractAwemeId(url) {
  const m = url.match(/video\/(\d+)/);
  return m ? m[1] : null;
}

// Clean share text: extract douyin URL from pasted fluff
function cleanDouyinUrl(raw) {
  const m = raw.match(/https?:\/\/(?:v\.douyin\.com\/[a-zA-Z0-9_-]+|www\.douyin\.com\/(?:video\/\d+|user\/[^\s?]+))\S*/);
  return m ? m[0].replace(/[，,。！!？?\s]+$/, '') : raw;
}

// ============ Video Download URL Extractor ============

async function getVideoDownloadUrl(url) {
  const b = await getBrowser();
  const ctx = await b.createBrowserContext(); // fresh cookie jar
  const page = await ctx.newPage();

  // Desktop UA to hit aweme/detail API
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');
  await page.setCacheEnabled(false);

  try {
    // Navigate and wait for the aweme/detail API response concurrently
    const respPromise = page.waitForResponse(
      res => res.url().includes('aweme/detail') && res.headers()['content-type']?.includes('json'),
      { timeout: 30000 }
    );
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const resp = await respPromise;
    const data = await resp.json();
    const aweme = data.aweme_detail;
    const rawUrl = aweme?.video?.play_addr?.url_list?.[0];
    if (rawUrl) {
      return rawUrl.replace('/playwm/', '/play/').replace('watermark=1', 'watermark=0');
    }
  } catch {
    // Page might still have loaded enough — fall through
  } finally {
    await ctx.close().catch(() => {});
  }

  return null;
}

// ============ Video Download ============

async function downloadVideo(videoUrl, outputPath) {
  const res = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.douyin.com/',
    },
    signal: AbortSignal.timeout(300000),
  });

  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const fileStream = fs.createWriteStream(outputPath);
  const reader = res.body.getReader();

  let downloaded = 0;
  const total = parseInt(res.headers.get('content-length') || '0');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!fileStream.write(value)) {
      await new Promise(resolve => fileStream.once('drain', resolve));
    }
    downloaded += value.length;
    if (total) console.log(`[Download] ${((downloaded / total) * 100).toFixed(0)}%`);
  }

  fileStream.end();
  console.log(`[Download] Done: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
}

// ============ Audio Extraction (ffmpeg) ============

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-i', videoPath,
      '-vn',           // no video
      '-acodec', 'pcm_s16le',  // WAV format
      '-ar', '16000',  // 16kHz sample rate (good for ASR)
      '-ac', '1',      // mono
      '-y',            // overwrite
      audioPath,
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });

    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`));
    });
  });
}

// ============ ASR Transcription (faster-whisper, persistent daemon) ============

let asrProc = null;
let asrQueue = Promise.resolve();

function getAsrProc() {
  return new Promise((resolve, reject) => {
    if (asrProc && asrProc.exitCode === null) return resolve(asrProc);

    const script = path.join(__dirname, 'transcribe.py');
    console.log('[ASR] Starting daemon...');
    const proc = spawn(PYTHON_PATH, [script, '--daemon', 'small'], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buf = '';
    proc.stdout.on('data', d => {
      buf += d.toString('utf-8');
      // Wait for the "ready" signal (first JSON line)
      if (buf.includes('\n')) {
        const lines = buf.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.status === 'ready') {
              console.log('[ASR] Daemon ready.');
              asrProc = proc;
              resolve(proc);
              return;
            }
          } catch {}
        }
      }
    });

    proc.stderr.on('data', d => process.stderr.write(d));

    proc.on('close', code => {
      console.log(`[ASR] Daemon exited (${code}), will restart on next request.`);
      asrProc = null;
    });

    // Timeout: if model takes too long to load
    setTimeout(() => {
      if (!asrProc) {
        proc.kill();
        reject(new Error('ASR daemon startup timed out'));
      }
    }, 120000);
  });
}

function transcribeAudio(audioPath) {
  // Serialize requests via queue (one at a time through stdin/stdout)
  return new Promise((resolve, reject) => {
    asrQueue = asrQueue.then(async () => {
      try {
        const proc = await getAsrProc();
        return new Promise((innerResolve, innerReject) => {
          const onData = d => {
            const line = d.toString('utf-8').trim();
            if (!line) return;
            try {
              const msg = JSON.parse(line);
              proc.stdout.removeListener('data', onData);
              if (msg.error) innerReject(new Error(msg.error));
              else if (msg.transcript) innerResolve(msg.transcript);
              else innerReject(new Error('Unexpected ASR response'));
            } catch { /* partial line, keep buffering */ }
          };
          proc.stdout.on('data', onData);
          proc.stdin.write(JSON.stringify({ audio_path: audioPath }) + '\n');
        });
      } catch (err) {
        throw err;
      }
    });
    asrQueue.then(resolve).catch(reject);
  });
}

// ============ Full Transcript Pipeline ============

async function extractTranscript(url) {
  if (!isValidDouyinUrl(url)) {
    throw { code: 'INVALID_URL', message: '请输入有效的抖音链接' };
  }

  const awemeId = extractAwemeId(url);
  const videoFile = path.join(TEMP_DIR, `${awemeId || 'video'}.mp4`);
  const audioFile = path.join(TEMP_DIR, `${awemeId || 'audio'}.wav`);

  // Step 1: Get video download URL (always needed — URLs may expire)
  console.log('[Pipeline] Step 1: Getting video URL...');
  const videoUrl = await getVideoDownloadUrl(url);
  if (!videoUrl) {
    throw { code: 'FETCH_FAILED', message: '无法获取视频下载地址，该视频可能受限' };
  }
  console.log('[Pipeline] Video URL:', videoUrl.slice(0, 100) + '...');

  // Step 2: Download video (skip if cached)
  if (fs.existsSync(videoFile)) {
    console.log('[Pipeline] Step 2: Video already cached, skipping download.');
  } else {
    console.log('[Pipeline] Step 2: Downloading video...');
    await downloadVideo(videoUrl, videoFile);
  }

  // Step 3: Extract audio (skip if cached)
  if (fs.existsSync(audioFile)) {
    console.log('[Pipeline] Step 3: Audio already cached, skipping extraction.');
  } else {
    console.log('[Pipeline] Step 3: Extracting audio...');
    await extractAudio(videoFile, audioFile);
  }

  // Step 4: ASR
  console.log('[Pipeline] Step 4: Transcribing...');
  const transcript = await transcribeAudio(audioFile);

  return transcript;
}

// ============ Simple Description Extractor ============

async function extractDescription(url) {
  if (!isValidDouyinUrl(url)) {
    throw { code: 'INVALID_URL', message: '请输入有效的抖音链接' };
  }

  let finalUrl = url;
  if (url.includes('v.douyin.com')) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      const loc = r.headers.get('location');
      if (loc) finalUrl = new URL(loc, url).href;
    } catch {}
  }

  const b = await getBrowser();
  const ctx = await b.createBrowserContext(); // fresh cookie jar
  const page = await ctx.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
  await page.setCacheEnabled(false);

  try {
    await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Click "展开" if present (only search buttons/spans)
    const expandClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, span, a');
      for (const el of btns) {
        if (el.textContent.trim() === '展开') { el.click(); return true; }
      }
      return false;
    });
    if (expandClicked) await new Promise(r => setTimeout(r, 1000));

    const text = await page.evaluate(() => {
      const title = document.title.replace(/\s*[-–|]\s*抖音.*$/, '').trim();
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      let desc = ogDesc || ogTitle || title;
      desc = desc.replace(/@\S+创作的原声[一-龥]*@\S+/g, '').replace(/作者声明[：:].+/g, '').trim();
      return desc || title;
    });

    if (!text) throw { code: 'EXTRACTION_FAILED', message: '未能从页面提取到文字，请使用手动粘贴' };
    return text;
  } catch (err) {
    if (err.code) throw err;
    throw { code: 'FETCH_FAILED', message: '无法访问抖音页面，请使用手动粘贴' };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============ DeepSeek Rewriter ============

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const PROMPTS = {
  xhs: `你是拥有10年经验的小红书爆款内容主编，深谙CES评分机制（评论4x>转发4x>收藏1x>点赞1x>关注8x）和搜索流量逻辑。
你的任务是将原始文案改写为适合小红书图文发布的高互动率内容。

## 核心铁律：保留原文灵魂
- 必须保留：核心事实/数据、情感基调、个人视角、独特观点
- 可以改写：句式节奏、语气温度、词汇选择、结构布局
- 禁止：丢失关键信息、改变情感方向、添加虚假信息或夸大效果

## 标题生成（15-20字）
从以下6种公式中选择最匹配的，前10字必须含核心关键词：
A. 数字具象法：数字+人群/场景+具体利益
B. 情绪触发法：强烈情绪词+共鸣场景
C. 身份共鸣法：人群标签+场景+利益点
D. 悬念反差法：反常识观点+省略号
E. 结果前置法：小努力+大结果
F. 热点加观点法：热点+反套路+人群
禁用"最/第一/yyds/绝绝子"等过时或极限词。

## 正文结构（根据内容类型选择）
- 干货/教程→数字清单型：emoji编号开头，每项1-2行
- 产品测评→AIDA型：注意→兴趣→欲望→行动
- 痛点营销→PAS型：问题→放大痛苦→解决方案
- 人设故事→故事加方法型：亲身经历(约150字)→核心观点→3点方法→金句

## 段落与格式
- 每段≤3行，单段≤45字，段落间留空行
- 关键金句独占一行
- 每段开头用1个emoji做视觉锚点（🔴→⚠️💪✨😊1️⃣2️⃣3️⃣）
- 用"—"或"· · ·"做弱分割

## 情绪钩子（开头前2句必须命中其一）
反常识/痛点共鸣/利益钩子/悬念/人群标签/数字冲击/挑衅/故事/对话/提问
必须制造冲突、好奇或共鸣，2句话内完成。

## 去AI味规则（重要）
- 打破工整排比，长短句交错（10字短句穿插在25字句中）
- 消灭"首先/其次/最后/综上所述/由此可见"等书面连接词
- 消灭"赋能/深耕/优化/闭环/抓手"等空泛词
- 自然融入口语过渡："说实话""坦白讲""谁懂啊""重点来了""你发现了没"
- 数字必须具体可感知（不说"显著提升"要说"从每天50阅读涨到380"）
- 默认第一人称（"我""我们""你"），朋友聊天语气
- 每100字最多1个高强度情绪词（"绝了""救命""杀疯了"），多了像咆哮

## 标签与结尾
- 标签5-7个：1个泛标签+2-3个细分标签+2个场景/人群标签
- 结尾设计互动引导：提问引发讨论/邀请收藏/投票式互动

## 输出格式
先输出标题（单独一行），空一行后输出正文，最后一行输出话题标签。不要写"标题："等前缀。`,

  douyin: `你是抖音精选专栏的资深作者，擅长将口播内容改写为节奏紧凑、适合朗读的深度图文。
你的内容会被TTS引擎朗读，因此必须自然口语化、节奏流畅、听觉友好。

## 核心铁律：保留原文灵魂
- 必须保留：核心事实/数据、情感基调、个人视角、独特观点
- 可以改写：句式节奏、语气温度、词汇选择、结构布局
- 禁止：丢失关键信息、改变情感方向、添加虚假信息或夸大效果

## 绝对禁止emoji
你的输出会被TTS朗读。emoji会被读成"笑脸""爱心""大拇指"等文字，严重破坏听感。
统一使用标点符号控制语气：问号=语调上扬、感叹号=语气加重、省略号=停顿留白。

## 3秒钩子法则（开头第一句决定完播率）
从以下7种钩子选1个，第一句就打破信息流惯性：
1. 情绪杠杆："别怪我没提醒你，..."
2. 圈定人群："所有[人群]请注意..."
3. 恐惧/焦虑："千万不要[行为]，尤其是..."
4. 反常识："你以为[A]，其实是[B]"
5. 悬念故事："我昨天[事件]，结果..."
6. 结果冲击："只做了[简单动作]，[惊人结果]"
7. 认同钩子："我从来不[A]，不是[B]，而是[C]"

## 正文结构（3选1）
- 三点式：每点=核心观点→场景化解释→一句话总结
- 递进式：事实→解读→启示→行动建议
- 对比式：错误做法 vs 正确做法→为什么错→怎么做才对
每5-10秒给出一个新信息点，15-20秒一次小转折。

## 语言规范（TTS朗读友好）
- 单句≤30字，关键信息≤15字独占一行
- 口语化但精简填充词（去掉"这个""那个""就是""然后"等）
- 书面词替换：总而言之→说白了、综上所述→总结一下、毋庸置疑→不用怀疑
- 阿拉伯数字优先（"3个信号"比"几个信号"效果好44%）
- 用换行创造"停顿"，用独占一行的金句制造"重音"
- 问号和感叹号在TTS中会改变语调，精准使用

## 结尾（4选1，必须引导互动）
1. 开放式提问："你怎么看？评论区告诉我"
2. 身份认同："认同的点个赞，让更多人看到"
3. 收藏引导："先收藏，免得之后找不到"
4. 挑战行动："敢不敢试7天？回来告诉我结果"

## 输出格式
直接输出改写后的抖音精选文案，不要写任何前缀说明。
不需要话题标签（TTS会读出来）。`,
};

async function rewriteText(originalText, style = 'xhs') {
  if (!originalText || !originalText.trim()) {
    throw { code: 'EMPTY_TEXT', message: '请先输入或提取文字内容' };
  }
  if (originalText.length > 8000) {
    originalText = originalText.slice(0, 8000);
  }

  const prompt = PROMPTS[style] || PROMPTS.xhs;
  const userMessages = {
    xhs: `请将以下原始文案改写为小红书爆款风格。要求：保留原文核心观点和事实，增强情绪共鸣和阅读体验，用第一人称口语化表达。\n\n---原始文案---\n${originalText}\n---`,
    douyin: `请将以下原始文案改写为抖音精选风格（适合TTS朗读）。要求：保留原文核心观点和事实，增强节奏感和听觉体验，用自然口语化表达，绝对不使用emoji。\n\n---原始文案---\n${originalText}\n---`,
  };

  let res;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeConfig.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: (userMessages[style] || userMessages.xhs) },
        ],
        max_tokens: 2048,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw { code: 'DEEPSEEK_API_ERROR', message: 'AI 服务连接失败，请稍后重试' };
  }

  if (res.status === 429) throw { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' };
  if (!res.ok) throw { code: 'DEEPSEEK_API_ERROR', message: `AI 服务返回错误 (${res.status})` };

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw { code: 'DEEPSEEK_API_ERROR', message: 'AI 未能生成内容，请重试' };

  return content.trim();
}

// ============ Routes ============

// Get API key config status (no real keys returned)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    deepseekConfigured: !!runtimeConfig.deepseekApiKey,
    pexelsConfigured: !!runtimeConfig.pexelsApiKey,
  });
});

// Save API keys from UI
app.post('/api/config', (req, res) => {
  const { deepseekApiKey, pexelsApiKey } = req.body;
  if (deepseekApiKey !== undefined) runtimeConfig.deepseekApiKey = deepseekApiKey.trim();
  if (pexelsApiKey !== undefined) runtimeConfig.pexelsApiKey = pexelsApiKey.trim();
  saveRuntimeConfig();
  imageSearch.init({
    deepseekApiKey: runtimeConfig.deepseekApiKey,
    pexelsApiKey: runtimeConfig.pexelsApiKey,
  });
  console.log('[Config] API keys saved via UI');
  res.json({ success: true });
});

// Extract video description (fast, existing)
app.post('/api/extract', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: '请提供抖音链接' } });
    const cleanUrl = cleanDouyinUrl(url);
    const text = await extractDescription(cleanUrl);
    res.json({ success: true, text, source: 'auto' });
  } catch (err) {
    if (err.code) {
      const m = { INVALID_URL: 400, FETCH_FAILED: 502, EXTRACTION_FAILED: 422 };
      return res.status(m[err.code] || 500).json({ success: false, error: err });
    }
    next(err);
  }
});

// Extract full transcript (slow, new pipeline)
app.post('/api/transcript', async (req, res, next) => {
  // 10-minute timeout for video download + ASR
  req.setTimeout(10 * 60 * 1000);
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: '请提供抖音链接' } });
    const cleanUrl = cleanDouyinUrl(url);
    const transcript = await extractTranscript(cleanUrl);
    res.json({ success: true, text: transcript, source: 'transcript' });
  } catch (err) {
    if (err.code) {
      const m = { INVALID_URL: 400, FETCH_FAILED: 502, EXTRACTION_FAILED: 422 };
      return res.status(m[err.code] || 500).json({ success: false, error: err });
    }
    next(err);
  }
});

// Upload MP4 and extract transcript
app.post('/api/upload', upload.single('video'), async (req, res, next) => {
  req.setTimeout(10 * 60 * 1000);
  let videoPath = null;
  let audioPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: '请选择MP4文件' } });
    }

    videoPath = req.file.path;
    audioPath = path.join(UPLOAD_DIR, `audio_${Date.now()}.wav`);

    console.log('[Upload] Extracting audio from uploaded MP4...');
    await extractAudio(videoPath, audioPath);

    // Remove video file, keep only audio
    try { fs.unlinkSync(videoPath); videoPath = null; } catch {}

    console.log('[Upload] Transcribing...');
    const transcript = await transcribeAudio(audioPath);

    // Clean up audio
    try { fs.unlinkSync(audioPath); audioPath = null; } catch {}

    res.json({ success: true, text: transcript, source: 'upload' });
  } catch (err) {
    // Clean up temp files on error
    try { if (videoPath) fs.unlinkSync(videoPath); } catch {}
    try { if (audioPath) fs.unlinkSync(audioPath); } catch {}
    if (err.code) {
      const m = { INVALID_URL: 400, FETCH_FAILED: 502, EXTRACTION_FAILED: 422 };
      return res.status(m[err.code] || 500).json({ success: false, error: err });
    }
    next(err);
  }
});

// Rewrite (with style parameter: 'xhs' or 'douyin')
app.post('/api/rewrite', async (req, res, next) => {
  try {
    const { text, style } = req.body;
    const result = await rewriteText(text, style || 'xhs');
    res.json({ success: true, rewritten: result });
  } catch (err) {
    if (err.code) {
      const m = { EMPTY_TEXT: 400, TEXT_TOO_LONG: 400, RATE_LIMITED: 429, DEEPSEEK_API_ERROR: 500 };
      return res.status(m[err.code] || 500).json({ success: false, error: err });
    }
    next(err);
  }
});

// ============ TTS (Text-to-Speech via edge-tts) ============

const ALLOWED_VOICES = [
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural',
  'zh-CN-YunyangNeural',
  'zh-CN-XiaochenNeural',
];

// Strip hashtags and trailing tag lines so TTS doesn't read them aloud
function stripHashtags(text) {
  return text
    .split('\n')
    .filter(line => !/^[\s#]+[#＃]/.test(line.trim()) && !/^#[一-鿿\w]+(?:[\s　]+#[一-鿿\w]+)*$/.test(line.trim()))
    .join('\n')
    .trim();
}

function generateTTS(text, voice, outputPath, rate, pitch) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, 'tts.py');
    const rateArg = (rate != null && rate !== '') ? rate : '-3%';
    const pitchArg = (pitch != null && pitch !== '') ? pitch : '+2Hz';
    const cleanText = stripHashtags(text);
    const proc = spawn(PYTHON_PATH, [script, cleanText, voice, outputPath, rateArg, pitchArg], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString('utf-8'); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`TTS failed (exit ${code}): ${stderr.slice(-300)}`));
    });
    proc.on('error', err => reject(new Error(`TTS spawn failed: ${err.message}`)));
  });
}


// Split text at paragraph boundaries, each chunk ≤ maxLen
function splitIntoChunks(text, maxLen) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxLen) {
      const last = chunks[chunks.length - 1];
      if (last && last.length + trimmed.length + 2 <= maxLen) {
        chunks[chunks.length - 1] = last + '\n\n' + trimmed;
      } else {
        chunks.push(trimmed);
      }
    } else {
      const subChunks = splitLongParagraph(trimmed, maxLen);
      for (const sub of subChunks) {
        const last = chunks[chunks.length - 1];
        if (last && last.length + sub.length + 1 <= maxLen) {
          chunks[chunks.length - 1] = last + '\n' + sub;
        } else {
          chunks.push(sub);
        }
      }
    }
  }

  return chunks;
}

function splitLongParagraph(para, maxLen) {
  const sentences = para.split(/(?<=[。！？!?\n])/);
  const result = [];

  for (const sent of sentences) {
    if (!sent.trim()) continue;
    if (sent.length <= maxLen) {
      const last = result[result.length - 1];
      if (last && last.length + sent.length <= maxLen) {
        result[result.length - 1] = last + sent;
      } else {
        result.push(sent);
      }
    } else {
      for (let i = 0; i < sent.length; i += maxLen) {
        result.push(sent.slice(i, i + maxLen));
      }
    }
  }

  return result;
}

// Concatenate MP3 files using ffmpeg concat demuxer
function concatMP3s(inputFiles, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = outputPath + '.list.txt';
    const listContent = inputFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf-8');

    const proc = spawn(FFMPEG_PATH, ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString('utf-8'); });
    proc.on('close', code => {
      try { fs.unlinkSync(listPath); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg concat failed (exit ${code}): ${stderr.slice(-300)}`));
    });
    proc.on('error', err => reject(new Error(`ffmpeg concat spawn failed: ${err.message}`)));
  });
}

app.post('/api/tts', async (req, res, next) => {
  req.setTimeout(5 * 60 * 1000);
  try {
    const { text, voice, rate } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_TEXT', message: '请先改写文案再生成音频' } });
    }
    const selectedVoice = ALLOWED_VOICES.includes(voice) ? voice : 'zh-CN-XiaoxiaoNeural';

    let rateArg = '-3%';
    if (typeof rate === 'number' && rate >= -50 && rate <= 50) {
      rateArg = (rate >= 0 ? '+' : '') + rate + '%';
    }

    let pitchArg = '+2Hz';
    if (typeof rate === 'number') {
      const hz = Math.round(rate * 0.08);
      pitchArg = (hz >= 0 ? '+' : '') + hz + 'Hz';
    }

    const MAX_CHUNK = 2000;
    const cleanText = text.trim();

    // Single chunk path
    if (cleanText.length <= MAX_CHUNK) {
      const filename = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
      const outputPath = path.join(AUDIO_DIR, filename);

      console.log(`[TTS] Generating audio: ${filename} (voice: ${selectedVoice}, rate: ${rateArg}, pitch: ${pitchArg})`);
      await generateTTS(cleanText, selectedVoice, outputPath, rateArg, pitchArg);
      console.log(`[TTS] Done: ${filename}`);

      return res.json({ success: true, audioUrl: `/audio/${filename}` });
    }

    // Multi-chunk path for text > 2000 chars
    const chunks = splitIntoChunks(cleanText, MAX_CHUNK);
    console.log(`[TTS] Text length ${cleanText.length}, split into ${chunks.length} chunks`);

    const chunkFiles = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkFilename = `tts-chunk-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.mp3`;
      const chunkPath = path.join(AUDIO_DIR, chunkFilename);
      console.log(`[TTS] Chunk ${i + 1}/${chunks.length}: ${chunkFilename} (${chunks[i].length} chars)`);
      await generateTTS(chunks[i], selectedVoice, chunkPath, rateArg, pitchArg);
      chunkFiles.push(chunkPath);
    }

    // Concatenate chunks into final audio
    const finalFilename = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
    const finalPath = path.join(AUDIO_DIR, finalFilename);
    console.log(`[TTS] Concatenating ${chunks.length} chunks into ${finalFilename}`);
    await concatMP3s(chunkFiles, finalPath);

    // Clean up individual chunk files
    for (const f of chunkFiles) {
      fs.unlink(f, () => {});
    }

    console.log(`[TTS] Done: ${finalFilename}`);
    res.json({ success: true, audioUrl: `/audio/${finalFilename}` });
  } catch (err) {
    if (err.message?.includes('TTS') || err.message?.includes('ffmpeg')) {
      return res.status(500).json({ success: false, error: { code: 'TTS_FAILED', message: '音频生成失败，请重试' } });
    }
    next(err);
  }
});

// ============ Video Generation ============

app.post('/api/video/generate', async (req, res, next) => {
  req.setTimeout(10 * 60 * 1000); // 10 min timeout
  try {
    const { text, audioUrl, style } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false, error: { code: 'EMPTY_TEXT', message: '请先改写文案再生成视频' }
      });
    }
    if (!audioUrl) {
      return res.status(400).json({
        success: false, error: { code: 'NO_AUDIO', message: '请先生成TTS音频' }
      });
    }

    const trimmedText = text.trim();
    const platform = style === 'douyin' ? 'douyin' : 'xhs';
    const timestamp = Date.now();

    console.log(`[Video] Starting generation for ${platform} (${trimmedText.length} chars)`);

    // Step 1: Fetch images
    const imageDir = path.join(IMAGES_DIR, `video_${timestamp}`);
    const images = await imageSearch.fetchImagesForText(trimmedText, imageDir, { count: 5 });
    console.log(`[Video] Fetched ${images.length} images`);

    // Step 2: Resolve audio path
    let audioPath;
    if (audioUrl.startsWith('/audio/')) {
      audioPath = path.join(AUDIO_DIR, audioUrl.replace('/audio/', ''));
    } else {
      audioPath = path.join(__dirname, audioUrl);
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({
        success: false, error: { code: 'AUDIO_NOT_FOUND', message: '音频文件不存在，请重新生成TTS' }
      });
    }

    // Step 3: Get audio duration
    const duration = await getAudioDuration(audioPath);
    console.log(`[Video] Audio duration: ${duration}s`);

    // Step 4: Build ffmpeg command
    const outputFilename = `video_${platform}_${timestamp}.mp4`;
    const outputPath = path.join(VIDEO_DIR, outputFilename);

    if (images.length === 0) {
      // No images — create audio-only video with text overlay
      await createTextOnlyVideo(trimmedText, audioPath, outputPath, duration);
    } else {
      // Build ffmpeg input list and filter chain
      await createSlideshowVideo(images, audioPath, outputPath, duration);
    }

    const videoUrl = `/video/${outputFilename}`;
    console.log(`[Video] Generated: ${videoUrl}`);

    res.json({
      success: true,
      videoUrl,
      imageCount: images.length,
      duration: Math.round(duration),
      message: images.length > 0
        ? `视频已生成，使用了 ${images.length} 张配图`
        : '视频已生成（无配图，使用了文字背景）',
    });
  } catch (err) {
    if (err.code) {
      const m = { EMPTY_TEXT: 400, NO_AUDIO: 400, AUDIO_NOT_FOUND: 400 };
      return res.status(m[err.code] || 500).json({ success: false, error: err });
    }
    next(err);
  }
});

// Get audio duration via ffprobe
function getAudioDuration(audioPath) {
  const ffprobePath = path.join(path.dirname(FFMPEG_PATH), 'ffprobe.exe');
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'quiet', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', audioPath,
    ], { timeout: 10000 });
    let output = '';
    ffprobe.stdout.on('data', d => output += d);
    ffprobe.on('close', code => {
      if (code !== 0) { reject(new Error('ffprobe failed')); return; }
      resolve(parseFloat(output.trim()) || 30);
    });
    ffprobe.on('error', reject);
  });
}

// Create slideshow video from images + audio
function createSlideshowVideo(images, audioPath, outputPath, totalDuration) {
  return new Promise((resolve, reject) => {
    const perImage = totalDuration / images.length;
    const args = [];

    // Build input args and filter chain
    const filterParts = [];
    const inputs = [];

    for (let i = 0; i < images.length; i++) {
      args.push('-loop', '1', '-t', String(perImage + 0.5), '-i', images[i].path);
      inputs.push(`[${i}:v]`);
      // Scale to 1080x1920 (vertical), pad if needed
      const fadeStart = Math.max(0, perImage - 0.5).toFixed(1);
      filterParts.push(
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black:eval=frame,setsar=1,format=yuv420p,fade=t=in:d=0.5,fade=t=out:d=0.5:st=${fadeStart}[v${i}]`
      );
    }

    const concatInputs = images.map((_, i) => `[v${i}]`).join('');
    const filterComplex = [
      ...filterParts,
      `${concatInputs}concat=n=${images.length}:v=1:a=0,format=yuv420p[v]`,
    ].join(';');

    args.push('-i', audioPath);
    args.push('-filter_complex', filterComplex);
    args.push('-map', '[v]');
    args.push('-map', `${images.length}:a:0`);
    args.push('-c:v', 'libx264');
    args.push('-preset', 'fast');
    args.push('-crf', '23');
    args.push('-c:a', 'aac');
    args.push('-b:a', '128k');
    args.push('-shortest');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-movflags', '+faststart');
    args.push('-y');
    args.push(outputPath);

    const proc = spawn(FFMPEG_PATH, args, { timeout: 5 * 60 * 1000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code !== 0) {
        console.error('[Video] ffmpeg failed:', stderr.slice(-500));
        reject(new Error('Video generation failed'));
        return;
      }
      resolve();
    });
    proc.on('error', reject);
  });
}

// Create text-only video when no images available
function createTextOnlyVideo(text, audioPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    // Truncate text for overlay
    const overlayText = text.length > 160 ? text.slice(0, 160) : text;
    // Escape for ffmpeg drawtext: single quotes are used as delimiters, so replace with fullwidth
    const safe = overlayText
      .replace(/'/g, '’')   // replace single quotes
      .replace(/\\/g, '/')       // backslashes
      .replace(/:/g, '：')       // colons (Chinese fullwidth)
      .replace(/\n/g, ' ')       // newlines
      .replace(/%/g, '%%');      // ffmpeg printf escapes

    const args = [
      '-f', 'lavfi', '-i', 'color=c=0x1a1a2e:s=1080x1920:d=' + duration,
      '-i', audioPath,
      '-vf', `drawtext=text='${safe}':fontcolor=white:fontsize=36:fontfile=/Windows/Fonts/msyh.ttc:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.4:boxborderw=20`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-shortest', '-y', outputPath,
    ];

    const proc = spawn(FFMPEG_PATH, args, { timeout: 5 * 60 * 1000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code !== 0) {
        console.error('[Video] ffmpeg text-only failed:', stderr.slice(-500));
        reject(new Error('Video generation failed'));
        return;
      }
      resolve();
    });
    proc.on('error', reject);
  });
}

// ============ Multer Error Handler ============

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: '文件过大，最大支持 500MB',
      LIMIT_FILE_COUNT: '一次只能上传一个文件',
      LIMIT_UNEXPECTED_FILE: '请选择 MP4 视频文件',
    };
    const message = messages[err.code] || `文件上传失败: ${err.message}`;
    return res.status(400).json({ success: false, error: { code: err.code, message } });
  }
  next(err);
});

// ============ Cache ============

app.post('/api/clear-cache', async (req, res) => {
  try {
    // Kill and restart browser to clear all cookies/cache/contexts
    await closeBrowser();
    // Clear temp video/audio files
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    // Clear generated videos, images, and upload temp files
    try { fs.rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    try { fs.rmSync(IMAGES_DIR, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    try { fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('[Cache] Browser restarted, temp files, videos, images and uploads cleared.');
    res.json({ success: true, message: '缓存已清除' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'CLEAR_FAILED', message: '清除缓存失败' } });
  }
});

// ============ Error Handler ============

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: { code: 'UNKNOWN_ERROR', message: '服务器内部错误，请稍后重试' } });
});

app.listen(PORT, () => {
  console.log(`🔄 抖音→小红书文案改写工具: http://localhost:${PORT}`);
});
