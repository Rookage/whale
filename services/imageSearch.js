// Image search service — generates search keywords via DeepSeek,
// fetches images from Pexels/Pixabay, downloads to local disk.

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

// Will be set by server.js at startup
let DEEPSEEK_API_KEY = '';
let PEXELS_API_KEY = '';

function init(config) {
  DEEPSEEK_API_KEY = config.deepseekApiKey || '';
  PEXELS_API_KEY = config.pexelsApiKey || '';
}

// Generate 3-5 image search keywords from text content via DeepSeek
async function generateImageQueries(text) {
  if (!DEEPSEEK_API_KEY) {
    // Fallback: extract simple keywords from text
    return fallbackKeywords(text);
  }

  const systemPrompt = `你是一个图片搜索关键词生成器。分析文本内容，提取3-5组适合在Pexels图库搜索的英文关键词。

规则：
1. 每组关键词1-3个单词，用空格分隔
2. 使用英文（Pexels主要支持英文搜索）
3. 关键词应该是具体的、可被图库搜索到的（如"mountain sunset"、"modern office"、"happy family"）
4. 覆盖文本中的主要场景、情绪和主题
5. 避免抽象概念（如"success"、"freedom"），改为具象表达（如"celebration"、"open field"）

输出格式：每组关键词一行，不要编号，不要其他文字。`;

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `为以下文本生成图片搜索关键词：\n\n${text.slice(0, 1500)}` },
        ],
        max_tokens: 200,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return fallbackKeywords(text);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const queries = content
      .split('\n')
      .map(line => line.replace(/^[\d\.\-\s]+/, '').trim())
      .filter(q => q.length > 0 && q.length < 100);

    return queries.length > 0 ? queries : fallbackKeywords(text);
  } catch {
    return fallbackKeywords(text);
  }
}

// Fallback when DeepSeek is unavailable — extract keywords from Chinese text
function fallbackKeywords(text) {
  // Common scene/subject words to look for
  const sceneMap = {
    '美食': 'food cuisine',
    '吃': 'food dish',
    '旅行': 'travel landscape',
    '旅游': 'travel scenery',
    '城市': 'city urban',
    '自然': 'nature landscape',
    '工作': 'office work',
    '学习': 'study education',
    '家庭': 'family home',
    '生活': 'lifestyle daily',
    '音乐': 'music concert',
    '运动': 'sports fitness',
    '健康': 'health wellness',
    '科技': 'technology digital',
    '宠物': 'pet animal',
    '穿搭': 'fashion style',
    '美妆': 'beauty makeup',
    '护肤': 'skincare beauty',
    '家居': 'home interior',
    '设计': 'design creative',
    '摄影': 'photography camera',
    '艺术': 'art creative',
    '历史': 'history ancient',
    '文化': 'culture traditional',
    '汽车': 'car vehicle',
    '游戏': 'game entertainment',
    '电影': 'movie cinema',
    '读书': 'book reading',
    '创业': 'business startup',
    '理财': 'finance money',
  };

  const queries = [];
  for (const [cn, en] of Object.entries(sceneMap)) {
    if (text.includes(cn)) {
      queries.push(en);
      if (queries.length >= 5) break;
    }
  }

  // Default queries if nothing matched
  return queries.length > 0 ? queries : ['lifestyle', 'nature', 'technology', 'people', 'city'];
}

// Search images from Pexels API
async function searchPexels(query, count = 5) {
  if (!PEXELS_API_KEY) {
    // Fallback to Pixabay (no key needed for basic usage? Actually Pixabay needs key too)
    // Return empty with warning
    console.warn('[ImageSearch] No Pexels API key configured');
    return [];
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait&size=medium`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[ImageSearch] Pexels API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.photos || []).map(p => ({
      id: p.id,
      url: p.src.large2x || p.src.large || p.src.medium,
      thumb: p.src.medium,
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      alt: p.alt || query,
    }));
  } catch (err) {
    console.error('[ImageSearch] Pexels search failed:', err.message);
    return [];
  }
}

// Fallback: search Pixabay (also needs key but many people have one)
async function searchPixabay(query, count = 5) {
  // Pixabay can be added as fallback when Pexels key is not available
  console.warn('[ImageSearch] Pixabay fallback not configured');
  return [];
}

// Main search function — tries Pexels first, then Pixabay
async function searchImages(query, count = 5) {
  // Try Pexels first
  const pexelsResults = await searchPexels(query, count);
  if (pexelsResults.length > 0) return pexelsResults;

  // Fallback to Pixabay
  const pixabayResults = await searchPixabay(query, count);
  return pixabayResults;
}

// Download image from URL to local path
async function downloadImage(url, outputPath) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  await pipeline(res.body, createWriteStream(outputPath));
}

// Full pipeline: text → keywords → images → downloaded files
async function fetchImagesForText(text, outputDir, { count = 5 } = {}) {
  // Step 1: Generate search keywords
  console.log('[ImageSearch] Generating keywords for text...');
  const queries = await generateImageQueries(text);
  console.log('[ImageSearch] Keywords:', queries);

  // Step 2: Search images for each keyword (round-robin to fill count)
  const allImages = [];
  const perQuery = Math.max(1, Math.floor(count / queries.length) + 1);

  for (const query of queries) {
    if (allImages.length >= count * 2) break; // Get extras for filtering
    const results = await searchImages(query, perQuery);
    allImages.push(...results);
  }

  // Deduplicate by ID
  const seen = new Set();
  const unique = allImages.filter(img => {
    if (seen.has(img.id)) return false;
    seen.add(img.id);
    return true;
  }).slice(0, count);

  if (unique.length === 0) {
    console.warn('[ImageSearch] No images found');
    return [];
  }

  // Step 3: Download images
  fs.mkdirSync(outputDir, { recursive: true });
  const downloaded = [];

  for (let i = 0; i < unique.length; i++) {
    const img = unique[i];
    const ext = '.jpg';
    const filename = `scene_${String(i + 1).padStart(2, '0')}${ext}`;
    const filepath = path.join(outputDir, filename);

    try {
      console.log(`[ImageSearch] Downloading ${i + 1}/${unique.length}: ${img.alt}`);
      await downloadImage(img.url, filepath);
      downloaded.push({
        path: filepath,
        filename,
        ...img,
      });
    } catch (err) {
      console.error(`[ImageSearch] Download failed for ${img.url}:`, err.message);
    }
  }

  console.log(`[ImageSearch] Downloaded ${downloaded.length} images`);
  return downloaded;
}

module.exports = {
  init,
  generateImageQueries,
  searchImages,
  downloadImage,
  fetchImagesForText,
};
