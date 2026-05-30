# RESUME.md — 抖音文案工具箱

## 当前状态（2026-05-27 — v17）

### v17 — MP4 上传 + 视频生成前端 UI + Bug 修复

| # | 项目 | 说明 |
|---|------|------|
| 1 | MP4 上传入口 | 前端 Tab 切换（抖音链接 / 上传MP4），拖拽或选择文件，multer 接收最大 500MB |
| 2 | 视频阶段 UI | 第 5 管道阶段「视频」按钮 + 进度条 + 播放器 + 下载，Yoshi 绿色样式 |
| 3 | Bug 修复 | `generateTTS()` rate=0 falsy 修复（`(rate != null && rate !== '') ? rate : '-3%'`） |
| 4 | multer 错误处理 | 新增 multer.MulterError 中间件，中文错误提示（文件过大/格式错误） |
| 5 | 代码清理 | 删除飞书会话遗留的 10 个临时文件 |

### TTS 语音推荐（2026 最佳实践）

| 风格 | 最佳语音 | 适用场景 |
|------|---------|---------|
| 女声最自然 | **晓晓** `zh-CN-XiaoxiaoNeural` | 小红书 |
| 男声最自然 | **云希** `zh-CN-YunxiNeural` | 抖音精选 |
| SSML 关键词 | `<break time="350ms"/>` 句号停顿 / `<mstts:express-as style="chat"/>` 聊天风格 / `rate="-5%"` 略慢 / `pitch="+2Hz"` 略高 |

### cc-connect 飞书接入状态

| 项目 | 状态 |
|------|------|
| cc-connect 安装 | v1.3.2，`~/.cc-connect/config.toml` 已配置 |
| 飞书应用 | `cli_aa9ed635d8b89ccd`，应用名 "Claude code的机器人"，已发布 |
| 事件订阅 | `im.message.receive_v1` + `card.action.trigger` 已配置 |
| WebSocket | 已连接 `wss://msg-frontier.feishu.cn/ws/v2` |
| **问题** | 用户在飞书单聊发送消息，cc-connect 无任何会话记录 |
| **待确认** | ① 应用发布状态是否「已发布」② 机器人消息接收模式是否勾选「单聊」③ 管理员审核是否通过 |

### 文件版本
- `server.js` — v17（multer 错误处理 + rate falsy 修复）
- `services/imageSearch.js` — v15
- `tts.py` — v16（SSML + pitch + break）
- `public/index.html` — v17（5 阶段管道 + 视频播放器）
- `public/js/main.js` — v17（视频生成处理 + currentStyle 状态管理）
- `public/css/style.css` — v17（video-section + btn-video + video-player + video-meta）
- `.env` — PEXELS_API_KEY 已配置
- `~/.cc-connect/config.toml` — cc-connect 配置

## 历史

### v15 — 提示词重设计 + 复制按钮 + 图片服务 + 视频MVP

| # | 项目 | 说明 |
|---|------|------|
| 1 | 提示词重设计 | `server.js` PROMPTS 完全重写：小红书（CES评分/6标题公式/7正文结构/18钩子/去AI味）+ 抖音精选（3秒钩子/无emoji/TTS友好/节奏控制）|
| 2 | 复制按钮 | textCard 新增逐字稿复制按钮；resultCard 确认 copyBtn 正常；版本→v15 |
| 3 | 图片服务 | 新建 `services/imageSearch.js`：DeepSeek关键词生成 + Pexels API搜索 + 图片下载，支持fallback |
| 4 | 视频MVP | 新增 `POST /api/video/generate`：Pexels图片 + TTS音频 → ffmpeg幻灯片视频（1080x1920竖屏，淡入淡出）|
| 5 | 配置更新 | `.env` 新增可选 `PEXELS_API_KEY`（免费注册 pexels.com/api）|

### 提示词核心改进

- **小红书**：从8条简单规则 → 完整爆款主编系统提示词（CES算法/标题公式/正文结构选择器/段落规则/18种钩子/去AI味清单）
- **抖音精选**：强化3秒钩子法则、TTS朗读兼容（绝对禁用emoji）、口语化节奏控制、结尾互动引导
- max_tokens: 1024→2048, temperature: 0.7→0.8

### 视频生成流程

```
改写文本 → DeepSeek生成图片关键词 → Pexels搜索 → 下载5张图
         ↘ TTS音频 ────────────────→ ffmpeg合成 → MP4输出
```

- 无Pexels API Key时：DeepSeek关键词fallback + 文字背景模式
- 视频输出：`video/` 目录，`/video/` 静态路径

---

## 历史（2026-05-24）

### v14 全面优化（昨日）

| # | 项目 | 说明 |
|---|------|------|
| 1 | Bug修复 | Express错误处理中间件添加`next`参数 |
| 2 | Bug修复 | CSS `.card`重复规则合并，不再覆盖边框阴影 |
| 3 | Bug修复 | 视频下载`write()`背压处理，避免大文件OOM |
| 4 | 路径配置 | ffmpeg/Python路径改为环境变量（`FFMPEG_PATH`/`PYTHON_PATH`）|
| 5 | TTS重构 | 内联`python -c`改为独立`tts.py`脚本 |
| 6 | 等待优化 | `getVideoDownloadUrl`用`waitForResponse`替代15s硬等；`extractDescription`精准搜索"展开"按钮 |
| 7 | ASR持久化 | `transcribe.py --daemon`常驻模式，模型只加载一次，请求通过stdin/stdout JSON行协议串行化 |
| 8 | CSS优化 | 全局`*`选择器缩小范围；`translate`→`transform: translate()`兼容性修复 |
| 9 | 清理 | 移除未使用的`cheerio`依赖；rate参数前端传数字后端组字符串 |

### 核心流水线（全部完成）

| # | 阶段 | 接口 | 说明 |
|---|------|------|------|
| 1 | 提取描述 | `/api/extract` | Puppeteer，~10秒 |
| 2 | 提取逐字稿 | `/api/transcript` | 视频下载→ffmpeg→faster-whisper ASR（常驻模型），2-5分钟，aweme_id缓存 |
| 3 | AI改写 | `/api/rewrite` | DeepSeek，双风格：小红书(xhs) + 抖音精选(douyin) |
| 4 | TTS语音 | `/api/tts` | edge-tts v7.2.8，6种中文语音，SSML自然语音 |
| 5 | 视频生成 | `/api/video/generate` | Pexels图片 + TTS音频 → ffmpeg幻灯片视频 |
| 6 | 清除缓存 | `/api/clear-cache` | 重置Puppeteer浏览器 + ASR进程 + 临时文件 + video + images |

### UI（v15 Mario像素风格）
- Mario NES色板：蓝天#63B8FF、红#FF0000、蓝#0066FF、粉#FF69B4、绿#00C000、金#FFD700
- 4角色流水线：马里奥(输入)→路易吉(提取)→碧琪(改写)→耀西(音频)
- 绿色管道连接，金币黄焦点高亮
- 像素白云+草地场景
- 语速调节滑块
- 逐字稿+改写结果一键复制

---

## 启动

```bash
cd C:\claude\douyin-xiaohongshu-rewriter
npm start        # http://localhost:3000
```

## 技术栈

- Node.js + Express（后端）
- Puppeteer v25（浏览器提取）
- faster-whisper small（ASR，Python）
- edge-tts v7.2.8（TTS，Python，SSML）
- DeepSeek API `deepseek-chat`（AI改写）
- ffmpeg v8.1.1（音频提取 + 视频合成）
- Pexels API（免费图片搜索）
- cc-connect v1.3.2（飞书桥接，进行中）
- 原生 HTML/CSS/JS（前端，零框架）
