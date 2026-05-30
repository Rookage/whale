const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const outDir = path.join(__dirname, 'demo');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Clean homepage
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(outDir, '01-home.png'), fullPage: true });
  console.log('1/3 Home captured');

  // 2. Type into textarea
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (ta) {
      ta.value = 'https://v.douyin.com/F2Imu92LHQc/';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '02-input.png'), fullPage: true });
  console.log('2/3 Input captured');

  // 3. Click extract button
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('提取') || text.includes('Extract') || text.includes('开始')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: path.join(outDir, '03-result.png'), fullPage: true });
  console.log('3/3 Result captured');

  await browser.close();
  console.log('Done!');
})();
