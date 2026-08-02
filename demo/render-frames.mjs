import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const demoDir = dirname(fileURLToPath(import.meta.url));
const outputDir = join(demoDir, 'output', 'frames');
await mkdir(outputDir, { recursive: true });

async function openBrowser() {
  try {
    const puppeteer = (await import('puppeteer')).default;
    console.log('Rendering frames with Puppeteer.');
    return { browser: await puppeteer.launch({ headless: true }), kind: 'puppeteer' };
  } catch {
    const { chromium } = await import('playwright');
    console.log('Puppeteer is unavailable; rendering with installed Playwright Chromium fallback.');
    return { browser: await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }), kind: 'playwright' };
  }
}

const { browser, kind } = await openBrowser();
try {
  const page = kind === 'puppeteer'
    ? await browser.newPage()
    : await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  if (kind === 'puppeteer') await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const source = `file:///${join(demoDir, 'storyboard.html').replaceAll('\\', '/')}`;
  for (let scene = 1; scene <= 8; scene += 1) {
    await page.goto(`${source}?scene=${scene}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(outputDir, `scene-${scene}.png`), type: 'png' });
  }
} finally {
  await browser.close();
}

