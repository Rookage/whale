(function () {
  // DOM refs
  const urlInput = document.getElementById('urlInput');
  const extractBtn = document.getElementById('extractBtn');
  const transcriptBtn = document.getElementById('transcriptBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const toggleManualBtn = document.getElementById('toggleManualBtn');
  const manualArea = document.getElementById('manualArea');
  const manualInput = document.getElementById('manualInput');
  const urlError = document.getElementById('urlError');
  const urlHint = document.getElementById('urlHint');

  // Upload tab refs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const urlPanel = document.getElementById('urlPanel');
  const uploadPanel = document.getElementById('uploadPanel');
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadInfo = document.getElementById('uploadInfo');
  const uploadFilename = document.getElementById('uploadFilename');
  const uploadFileSize = document.getElementById('uploadFileSize');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const uploadTranscriptBtn = document.getElementById('uploadTranscriptBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const uploadError = document.getElementById('uploadError');

  let selectedFile = null;

  // ============ Tab Switching ============

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.dataset.tab;
      if (tab === 'url') {
        urlPanel.classList.remove('hidden');
        uploadPanel.classList.add('hidden');
      } else {
        urlPanel.classList.add('hidden');
        uploadPanel.classList.remove('hidden');
      }
      hideError(urlError);
      hideError(uploadError);
    });
  });

  // ============ URL Auto-Extract ============

  function extractDouyinUrl(raw) {
    // Match douyin URLs embedded in share text
    const m = raw.match(/https?:\/\/(?:v\.douyin\.com\/[a-zA-Z0-9_-]+|www\.douyin\.com\/(?:video\/\d+|user\/[^\s?]+))\S*/);
    return m ? m[0].replace(/[，,。！!？?\s]+$/, '') : null;
  }

  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      const raw = urlInput.value.trim();
      const clean = extractDouyinUrl(raw);
      if (clean && clean !== raw) {
        urlInput.value = clean;
        if (urlHint) {
          urlHint.textContent = '已自动识别视频链接';
          urlHint.classList.add('visible');
          setTimeout(() => urlHint.classList.remove('visible'), 2500);
        }
      }
    }, 50);
  });

  // Also attempt extraction on blur (user pastes with mouse)
  urlInput.addEventListener('blur', () => {
    const raw = urlInput.value.trim();
    const clean = extractDouyinUrl(raw);
    if (clean && clean !== raw) {
      urlInput.value = clean;
    }
  });

  const statusCard = document.getElementById('statusCard');
  const statusText = document.getElementById('statusText');

  const textCard = document.getElementById('textCard');
  const textSource = document.getElementById('textSource');
  const textDisplay = document.getElementById('textDisplay');
  const rewriteXhsBtn = document.getElementById('rewriteXhsBtn');
  const rewriteDouyinBtn = document.getElementById('rewriteDouyinBtn');
  const textError = document.getElementById('textError');

  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultContent = document.getElementById('resultContent');
  const copyBtn = document.getElementById('copyBtn');
  const copyToast = document.getElementById('copyToast');
  const copyTextBtn = document.getElementById('copyTextBtn');
  const textCopyToast = document.getElementById('textCopyToast');
  const voiceSelect = document.getElementById('voiceSelect');
  const rateSlider = document.getElementById('rateSlider');
  const rateValue = document.getElementById('rateValue');
  const generateAudioBtn = document.getElementById('generateAudioBtn');
  const audioPlayer = document.getElementById('audioPlayer');
  const audioElement = document.getElementById('audioElement');
  const downloadAudioBtn = document.getElementById('downloadAudioBtn');
  const ttsError = document.getElementById('ttsError');
  const generateVideoBtn = document.getElementById('generateVideoBtn');
  const videoProgress = document.getElementById('videoProgress');
  const videoProgressFill = document.getElementById('videoProgressFill');
  const videoProgressText = document.getElementById('videoProgressText');
  const videoPlayer = document.getElementById('videoPlayer');
  const videoElement = document.getElementById('videoElement');
  const downloadVideoBtn = document.getElementById('downloadVideoBtn');
  const videoMeta = document.getElementById('videoMeta');
  const videoError = document.getElementById('videoError');

  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastClose = document.getElementById('toastClose');

  // Pipeline stages
  const pipelineStages = document.querySelectorAll('.pipeline-stage');
  const extractSpeech = document.getElementById('extractSpeech');
  const rewriteSpeech = document.getElementById('rewriteSpeech');
  const audioSpeech = document.getElementById('audioSpeech');

  function setPipeline(activeStage) {
    const stages = ['input', 'extract', 'rewrite', 'audio', 'video'];
    const idx = stages.indexOf(activeStage);
    pipelineStages.forEach(function (el) {
      var stage = el.dataset.stage;
      el.classList.remove('active', 'done');
      var pos = stages.indexOf(stage);
      if (pos === idx) el.classList.add('active');
      else if (pos < idx) el.classList.add('done');
    });
  }

  // State
  let extractedText = '';

  // ============ API Key Config ============

  const configCard = document.getElementById('configCard');
  const configToggle = document.getElementById('configToggle');
  const configBody = document.getElementById('configBody');
  const configLabel = document.getElementById('configLabel');
  const configArrow = document.getElementById('configArrow');
  const deepseekKeyInput = document.getElementById('deepseekKeyInput');
  const pexelsKeyInput = document.getElementById('pexelsKeyInput');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const configMsg = document.getElementById('configMsg');

  let configExpanded = false;

  // Load config status on page init
  (async function initConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success && data.deepseekConfigured) {
        configLabel.textContent = 'API Keys ✓';
        configArrow.textContent = '▸';
        configBody.classList.add('hidden');
        configExpanded = false;
      } else {
        configLabel.textContent = 'API Keys 未配置 — 点击设置';
        configArrow.textContent = '▾';
        configBody.classList.remove('hidden');
        configExpanded = true;
      }
    } catch (e) {
      // Server not available, keep defaults
    }
  })();

  configToggle.addEventListener('click', function () {
    configExpanded = !configExpanded;
    if (configExpanded) {
      configBody.classList.remove('hidden');
      configArrow.textContent = '▾';
    } else {
      configBody.classList.add('hidden');
      configArrow.textContent = '▸';
    }
  });

  saveConfigBtn.addEventListener('click', async function () {
    setBtnLoading(saveConfigBtn, true);
    hide(configMsg);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deepseekApiKey: deepseekKeyInput.value.trim(),
          pexelsApiKey: pexelsKeyInput.value.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error('保存失败');
      configLabel.textContent = 'API Keys ✓';
      configMsg.textContent = '已保存，重启服务后仍有效';
      show(configMsg);
      // Collapse after save
      configExpanded = false;
      configBody.classList.add('hidden');
      configArrow.textContent = '▸';
    } catch (e) {
      showToast('保存失败: ' + (e.message || '请重试'), 'error');
    } finally {
      setBtnLoading(saveConfigBtn, false);
    }
  });

  // ============ Upload Handlers ============

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function showFileInfo(file) {
    selectedFile = file;
    uploadFilename.textContent = file.name;
    uploadFileSize.textContent = formatFileSize(file.size);
    uploadZone.classList.add('hidden');
    uploadInfo.classList.remove('hidden');
    uploadTranscriptBtn.disabled = false;
    hideError(uploadError);
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    uploadZone.classList.remove('hidden');
    uploadInfo.classList.add('hidden');
    uploadTranscriptBtn.disabled = true;
    uploadProgress.classList.add('hidden');
    hideError(uploadError);
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mp4') && file.type !== 'video/mp4') {
      showError(uploadError, '仅支持 MP4 格式的视频文件');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showError(uploadError, '文件大小不能超过 500MB');
      return;
    }
    showFileInfo(file);
  }

  // Click to select file
  uploadZone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    handleFile(fileInput.files[0]);
  });

  // Drag & drop
  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });

  clearFileBtn.addEventListener('click', clearFile);

  // Upload & transcribe
  uploadTranscriptBtn.addEventListener('click', async function () {
    if (!selectedFile) {
      showError(uploadError, '请先选择 MP4 文件');
      return;
    }

    hideError(uploadError);
    hide(textCard);
    hide(resultCard);
    uploadTranscriptBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    setPipeline('extract');

    var formData = new FormData();
    formData.append('video', selectedFile);

    try {
      // Phase 1: uploading
      progressFill.style.width = '10%';
      progressText.textContent = '正在上传文件...';

      var res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      // Phase 2: processing (server is extracting audio + ASR)
      progressFill.style.width = '50%';
      progressText.textContent = '正在提取音频并识别语音...';

      var data = await res.json();
      if (!data.success) throw data.error;

      progressFill.style.width = '100%';
      progressText.textContent = '提取完成！';

      extractedText = data.text;
      textSource.textContent = 'MP4 语音识别逐字稿';
      textDisplay.textContent = extractedText;
      show(textCard);
      setPipeline('extract');
      if (extractSpeech) extractSpeech.textContent = '逐字稿提取完成！一字不漏！';

      setTimeout(function () { uploadProgress.classList.add('hidden'); }, 1500);
    } catch (err) {
      uploadProgress.classList.add('hidden');
      if (err.name === 'AbortError') {
        showError(uploadError, '请求超时，请重试');
      } else {
        showError(uploadError, err.message || '提取失败，请重试');
      }
    } finally {
      uploadTranscriptBtn.disabled = false;
    }
  });

  // Init: disable upload transcript button until file selected
  uploadTranscriptBtn.disabled = true;

  // ============ UI Helpers ============

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function showToast(message, type) {
    toastMsg.textContent = message;
    toast.className = 'toast ' + (type || '');
    show(toast);
  }

  function hideToast() {
    hide(toast);
  }

  function showError(el, msg) {
    el.textContent = msg;
    show(el);
  }

  function hideError(el) {
    hide(el);
  }

  function setLoading(loading, msg) {
    if (loading) {
      statusText.textContent = msg;
      show(statusCard);
    } else {
      hide(statusCard);
    }
  }

  function setBtnLoading(btn, loading) {
    btn.disabled = loading;
    if (loading) {
      btn.dataset.origText = btn.textContent;
      btn.textContent = '处理中...';
    } else {
      btn.textContent = btn.dataset.origText || btn.textContent;
    }
  }

  // ============ API Calls ============

  async function extractText(url) {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!data.success) throw data.error;
    return data;
  }

  async function extractTranscript(url) {
    // Long timeout — video download + ASR can take several minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.success) throw data.error;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function rewrite(content, style) {
    const res = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ text: content, style: style }),
    });
    const data = await res.json();
    if (!data.success) throw data.error;
    return data;
  }

  // ============ Event Handlers ============

  extractBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    hideError(urlError);
    urlInput.classList.remove('invalid');

    if (!url) {
      showError(urlError, '请输入抖音视频链接');
      urlInput.classList.add('invalid');
      return;
    }

    if (!/douyin\.com/.test(url)) {
      showError(urlError, '请输入有效的抖音链接（包含 douyin.com）');
      urlInput.classList.add('invalid');
      return;
    }

    setLoading(true, '正在提取文字...');
    setBtnLoading(extractBtn, true);

    try {
      const data = await extractText(url);
      extractedText = data.text;
      textSource.textContent = data.source === 'auto' ? '自动提取' : '';
      textDisplay.textContent = extractedText;
      show(textCard);
      hide(resultCard);
      setPipeline('extract');
      if (extractSpeech) extractSpeech.textContent = '交给我吧！我来把文案提取出来了！';
    } catch (err) {
      if (err.code === 'EXTRACTION_FAILED' || err.code === 'FETCH_FAILED') {
        showToast(err.message, 'warning');
        toggleManual(true);
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
      setBtnLoading(extractBtn, false);
    }
  });

  transcriptBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    hideError(urlError);
    urlInput.classList.remove('invalid');

    if (!url) {
      showError(urlError, '请输入抖音视频链接');
      urlInput.classList.add('invalid');
      return;
    }

    if (!/douyin\.com/.test(url)) {
      showError(urlError, '请输入有效的抖音链接（包含 douyin.com）');
      urlInput.classList.add('invalid');
      return;
    }

    setLoading(true, '正在提取逐字稿... 下载视频中，可能需要2-5分钟');
    setBtnLoading(transcriptBtn, true);

    try {
      const data = await extractTranscript(url);
      extractedText = data.text;
      textSource.textContent = '语音识别逐字稿';
      textDisplay.textContent = extractedText;
      show(textCard);
      hide(resultCard);
      setPipeline('extract');
      if (extractSpeech) extractSpeech.textContent = '逐字稿提取完成！一字不漏！';
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('请求超时，视频下载或语音识别用时过长，请重试', 'error');
      } else if (err.code === 'EXTRACTION_FAILED' || err.code === 'FETCH_FAILED') {
        showToast(err.message, 'warning');
      } else {
        showToast(err.message || '逐字稿提取失败', 'error');
      }
    } finally {
      setLoading(false);
      setBtnLoading(transcriptBtn, false);
    }
  });

  // Clear cache
  clearCacheBtn.addEventListener('click', async () => {
    setBtnLoading(clearCacheBtn, true);
    try {
      const res = await fetch('/api/clear-cache', { method: 'POST' });
      const data = await res.json();
      // Clear client state
      extractedText = '';
      textDisplay.textContent = '';
      textSource.textContent = '';
      resultContent.textContent = '';
      resultTitle.textContent = '[♛] 小红书风格文案';
      hide(textCard);
      hide(resultCard);
      hide(audioPlayer);
      hide(videoPlayer);
      hide(ttsError);
      manualInput.value = '';
      currentStyle = 'xhs';
      setPipeline('input');
      showToast(data.message || '缓存已清除', '');
    } catch {
      showToast('清除失败，请重试', 'error');
    } finally {
      setBtnLoading(clearCacheBtn, false);
    }
  });

  // Allow Enter key in URL input
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') extractBtn.click();
  });

  // Toggle manual paste
  function toggleManual(force) {
    const show = force !== undefined ? force : manualArea.classList.contains('hidden');
    if (show) {
      show(manualArea);
      toggleManualBtn.textContent = '[?] 手动粘贴文案 ▴';
    } else {
      hide(manualArea);
      toggleManualBtn.textContent = '[?] 手动粘贴文案 ▾';
    }
  }

  toggleManualBtn.addEventListener('click', () => toggleManual());

  // Manual input: auto-show text card
  manualInput.addEventListener('input', () => {
    const val = manualInput.value.trim();
    if (val) {
      extractedText = val;
      textSource.textContent = '手动粘贴';
      textDisplay.textContent = extractedText;
      show(textCard);
      hide(resultCard);
      setPipeline('extract');
    }
  });

  // Rewrite — shared handler
  const STYLE_LABELS = { xhs: '[♛] 小红书风格文案', douyin: '[★] 抖音精选文案' };
  const STYLE_VOICES = { xhs: 'zh-CN-XiaoxiaoNeural', douyin: 'zh-CN-YunxiNeural' };

  async function handleRewrite(style, btn, label) {
    const text = extractedText || manualInput.value.trim();

    if (!text) {
      showError(textError, '请先输入或提取文字内容');
      return;
    }

    hideError(textError);
    hide(resultCard);
    setLoading(true, `AI 正在改写为${label}风格...`);
    setBtnLoading(btn, true);

    try {
      const data = await rewrite(text, style);
      resultTitle.textContent = STYLE_LABELS[style] || STYLE_LABELS.xhs;
      resultContent.textContent = data.rewritten;
      // Reset audio state
      hide(audioPlayer);
      hide(ttsError);
      hideError(ttsError);
      // Set recommended voice
      voiceSelect.value = STYLE_VOICES[style] || 'zh-CN-XiaoxiaoNeural';
      currentStyle = style;
      hide(videoPlayer);
      show(resultCard);
      setPipeline('rewrite');
      if (rewriteSpeech) rewriteSpeech.textContent = '让我把它变成超好看的风格！';
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setBtnLoading(btn, false);
    }
  }

  rewriteXhsBtn.addEventListener('click', () => handleRewrite('xhs', rewriteXhsBtn, '小红书'));
  rewriteDouyinBtn.addEventListener('click', () => handleRewrite('douyin', rewriteDouyinBtn, '抖音精选'));

  // TTS — Generate audio
  generateAudioBtn.addEventListener('click', async () => {
    const text = resultContent.textContent;
    if (!text) return;
    hide(ttsError);
    hide(audioPlayer);
    hide(videoPlayer);
    hide(videoProgress);
    setBtnLoading(generateAudioBtn, true);

    try {
      const voice = voiceSelect.value;
      const rateEl = document.getElementById('rateSlider');
      const rate = rateEl ? parseInt(rateEl.value) : 0;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate }),
      });
      const data = await res.json();
      if (!data.success) throw data.error;

      audioElement.src = data.audioUrl;
      downloadAudioBtn.href = data.audioUrl;
      downloadAudioBtn.download = data.audioUrl.split('/').pop();
      show(audioPlayer);
      setPipeline('audio');
      if (audioSpeech) audioSpeech.textContent = '交给我吧！我来给它配上声音了！';
    } catch (err) {
      showError(ttsError, err.message || '音频生成失败');
    } finally {
      setBtnLoading(generateAudioBtn, false);
    }
  });

  // Video — Generate video from rewrite + audio
  let currentStyle = 'xhs'; // track which style was used for the current result

  generateVideoBtn.addEventListener('click', async () => {
    const text = resultContent.textContent;
    const audioSrc = audioElement.src;
    if (!text || !audioSrc) {
      showError(videoError, '请先生成改写文案和TTS音频');
      return;
    }

    hideError(videoError);
    hide(videoPlayer);
    setBtnLoading(generateVideoBtn, true);
    videoProgress.classList.remove('hidden');
    videoProgressFill.style.width = '5%';
    videoProgressText.textContent = '正在准备生成视频...';

    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          audioUrl: audioSrc.replace(location.origin, ''),
          style: currentStyle,
        }),
      });
      const data = await res.json();
      if (!data.success) throw data.error;

      videoProgressFill.style.width = '100%';
      videoProgressText.textContent = '视频生成完成！';
      videoElement.src = data.videoUrl;
      downloadVideoBtn.href = data.videoUrl;
      downloadVideoBtn.download = data.videoUrl.split('/').pop();
      if (videoMeta) videoMeta.textContent = `${data.imageCount || 0} 张配图 · ${data.duration || 0} 秒`;
      show(videoPlayer);
      setPipeline('video');
      if (document.getElementById('videoSpeech')) {
        document.getElementById('videoSpeech').textContent = '视频已生成！点击播放看看效果吧！';
      }
      setTimeout(() => videoProgress.classList.add('hidden'), 1500);
    } catch (err) {
      videoProgress.classList.add('hidden');
      if (err.name === 'AbortError') {
        showError(videoError, '视频生成超时，请重试');
      } else {
        showError(videoError, err.message || '视频生成失败，请重试');
      }
    } finally {
      setBtnLoading(generateVideoBtn, false);
    }
  });

  // Copy
  copyBtn.addEventListener('click', async () => {
    const text = resultContent.textContent;
    try {
      await navigator.clipboard.writeText(text);
      show(copyToast);
      setTimeout(() => hide(copyToast), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      show(copyToast);
      setTimeout(() => hide(copyToast), 2000);
    }
  });

  // Copy extracted text
  if (copyTextBtn) {
    copyTextBtn.addEventListener('click', async () => {
      const text = textDisplay.textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        if (textCopyToast) { show(textCopyToast); setTimeout(() => hide(textCopyToast), 2000); }
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (textCopyToast) { show(textCopyToast); setTimeout(() => hide(textCopyToast), 2000); }
      }
    });
  }

  // Rate slider display
  if (rateSlider && rateValue) {
    rateSlider.addEventListener('input', function () {
      var v = parseInt(this.value);
      rateValue.textContent = (v >= 0 ? '+' : '') + v + '%';
    });
  }

  // Toast close
  toastClose.addEventListener('click', hideToast);

  // Auto-hide toast after 5s
  toast.addEventListener('animationend', () => {
    setTimeout(hideToast, 5000);
  }, { once: true });
})();
