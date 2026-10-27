import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Packaging only: resize the approved full-bleed artwork without altering its content.
const cachedChrome = resolve('.browser/chrome-win/chrome.exe');
const browser = await chromium.launch({ executablePath: existsSync(cachedChrome) ? cachedChrome : undefined });
try {
  const page = await browser.newPage();
  for (const [source, size, target] of [
    ['public/app-icon.png', 192, 'public/icon-192.png'],
    ['public/app-icon.png', 512, 'public/icon-512.png'],
    ['public/app-icon.png', 180, 'public/apple-touch-icon.png'],
    ['assets/branding/icon-maskable-source.png', 512, 'public/icon-maskable-512.png'],
  ]) {
    const sourceUrl = `data:image/png;base64,${readFileSync(source).toString('base64')}`;
    const png = await page.evaluate(async ({ sourceUrl, size }) => {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { sourceUrl, size });
    writeFileSync(target, Buffer.from(png, 'base64'));
    console.log(`${target}: ${size}x${size}`);
  }
} finally {
  await browser.close();
}
