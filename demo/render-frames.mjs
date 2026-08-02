import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer';

const demoDir = dirname(fileURLToPath(import.meta.url));
const outputDir = join(demoDir, 'output', 'frames');
await mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const source = `file:///${join(demoDir, 'storyboard.html').replaceAll('\\', '/')}`;
  for (let scene = 1; scene <= 8; scene += 1) {
    await page.goto(`${source}?scene=${scene}`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: join(outputDir, `scene-${scene}.png`), type: 'png' });
  }
} finally {
  await browser.close();
}
