# douyin-xiaohongshu-rewriter

抖音→多平台文案改写工具。输入抖音链接，提取视频描述或完整逐字稿，用 DeepSeek API 改写为小红书/抖音精选风格，TTS 生成语音 MP3。

## 继续执行（触发词）

用户说「抖音继续」「继续执行」，或任何明确要继续抖音项目的模糊讯息时，加载所有记忆 + 本文档 + RESUME.md → 进入扩展预备状态，等待具体任务。

## fs 触发词（飞书同步）

用户输入 "fs" 时：

1. 列出 `~/.cc-connect/sessions/` 下所有 `douyin_*.json` 文件，取修改时间最新的
2. 读取该 session 文件，获取 agent_session_id 和 history
3. 读取对应的 `~/.claude/projects/C--claude-douyin-xiaohongshu-rewriter/<agent_session_id>.jsonl`
4. 展示飞书端最近对话内容
5. 将飞书对话上下文纳入当前会话

仅在用户输入 "fs" 时触发，其余时间不检查。

## 启动

```bash
cd C:\claude\douyin-xiaohongshu-rewriter
npm start        # http://localhost:3000
```

## 架构

- `server.js` — Express 后端（提取 + 改写 + TTS + 路由）
- `transcribe.py` — Python ASR 脚本（faster-whisper small，支持 `--daemon` 常驻模式）
- `tts.py` — Python TTS 脚本（edge-tts）
- `public/` — 前端静态文件（HTML/CSS/JS，Mario 像素风格）
- `.env` — DeepSeek API Key（已 gitignore）
- `audio/` — TTS 生成的 MP3 文件

## API（完整 5 阶段）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/extract` | POST | 提取抖音视频描述 `{ url }`（Puppeteer，~10秒） |
| `/api/transcript` | POST | 提取完整逐字稿 `{ url }`（视频下载+ffmpeg+faster-whisper，2-5分钟，aweme_id 缓存） |
| `/api/rewrite` | POST | AI 改写 `{ text, style }`（style: `xhs` 小红书 / `douyin` 抖音精选） |
| `/api/tts` | POST | 生成语音 `{ text, voice }`（edge-tts，6种中文语音，输出MP3） |
| `/api/clear-cache` | POST | 清除服务端缓存 |

## 开发阶段

- **Stage 1 ✅**: 视频描述提取 + 小红书改写
- **Stage 2 ✅**: 完整逐字稿提取（视频下载 + ASR）
- **Stage 3 ✅**: 双风格改写（小红书 + 抖音精选）+ TTS 语音生成
- **Stage 4 ✅**: Mario 像素风格 UI 重设计
- **Stage 5 ✅**: 4 角色流水线（马里奥→路易吉→碧琪→耀西）+ 像素场景

## 当前 UI

Mario NES 像素风格（`public/css/style.css?v=17`，`public/js/main.js?v=17`）：
- 配色：蓝天 #63B8FF / 红 #FF0000 / 蓝 #0066FF / 粉 #FF69B4 / 绿 #00C000 / 金 #FFD700
- 字体：Press Start 2P，字号层级 24/18/16/14/12
- 4 个马里奥角色 SVG 精灵 + 对话气泡
- 绿色管道流水线，金币黄焦点高亮
- 0 圆角、0 渐变、纯帧动画

## 设计决策

- **DeepSeek 而非 Claude API**: 用户指定，`deepseek-chat` 模型，OpenAI 兼容格式
- **Puppeteer 提取 + 手动粘贴兜底**: 真实浏览器提取，失败自动展开手动粘贴区
- **零框架前端**: 原生 HTML/CSS/JS，无构建步骤
- **Puppeteer v25**: `browser.connected` 属性（非 `browser.isConnected()` 方法）
- **每次请求独立 browserContext**: `browser.createBrowserContext()` + `page.setCacheEnabled(false)` + API cache headers + 手动清除按钮 → 四层缓存防线
- **Windows spawn**: 路径用 `C:\...` 格式，Python 设 `PYTHONIOENCODING=utf-8` + `PYTHONUTF8=1`
- **Douyin精选 prompt 禁用 emoji**: emoji 会被 TTS 朗读，严重影响听感
- **faster-whisper small 模型**: 中文识别效果好，通过 HF 镜像下载
- **6 种 TTS 语音**: 晓晓/晓伊（小红书推荐）、云希（抖音精选推荐）、云健/云扬/晓辰

## 经验和已知问题

- 抖音页面 JS 动态渲染，cheerio 静态解析无效 → Puppeteer 真实浏览器
- 抖音有反爬机制，连续提取需间隔 10 秒以上
- 移动端 API (`aweme/post`) 不返回 `play_addr`，需桌面 UA 访问 `aweme/detail`
- 视频下载 + ASR 耗时数分钟，API 设 10 分钟超时
- Press Start 2P 中文 fallback 到等宽字体，正文必须 ≥14px 才可读
- edge-tts 需在线使用，依赖 Microsoft 服务
