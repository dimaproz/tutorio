/**
 * Captures the Studio fidelity fixtures and scores them against the approved
 * design screenshots.
 *
 * It drives a Storybook that is already running (`pnpm --filter @tutorio/web
 * storybook`), so a capture takes seconds and picks up edits immediately.
 *
 *   node scripts/capture-studio-screens.mjs --out <dir> --reference <dir>
 *
 * `--reference` is optional: without it the script only captures. The
 * comparison itself runs inside the same browser — two images into a canvas,
 * a per-pixel delta, and a 50% overlay plus a difference view written next to
 * the capture. That keeps the harness dependency-free.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const SCREENS = [
  { id: 'fidelity-studio--students-list', file: 'students-list' },
  { id: 'fidelity-studio--student-profile', file: 'student-profile' },
  { id: 'fidelity-studio--stat-blocks', file: 'stat-block' },
];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const base = arg('base', 'http://localhost:6006');
const outDir = path.resolve(arg('out', '.visual'));
const referenceDir = arg('reference', null);
const width = Number(arg('width', '1440'));
// Storybook toolbar globals, e.g. `--globals locale:uk` or `theme:dark`.
const globals = arg('globals', null);
const suffix = arg('suffix', '');
// `--ids a=file,b=file` captures arbitrary stories, e.g. the live screens.
const ids = arg('ids', null);

// Mirrors the Storybook preview: the same frozen clock and zone, so relative
// dates and times render identically on every run.
const STORY_NOW = '2026-09-09T12:00:00.000Z';

const screens = ids
  ? ids.split(',').map((entry) => {
      const [id, file] = entry.split('=');
      return { id, file: file ?? id };
    })
  : SCREENS;

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch().catch((error) => {
    console.error(
      'Could not launch Chromium. Run this once:\n' +
        '  pnpm --filter @tutorio/web exec playwright install chromium\n',
    );
    throw error;
  });

  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    timezoneId: 'Europe/Kyiv',
    locale: 'en-GB',
  });
  await context.addInitScript(`{
    const fixed = new Date(${JSON.stringify(STORY_NOW)}).valueOf();
    const OriginalDate = Date;
    Date = class extends OriginalDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }
      static now() {
        return fixed;
      }
    };
    Math.random = () => 0.42;
  }`);

  const page = await context.newPage();
  const results = [];

  for (const screen of screens) {
    const url =
      `${base}/iframe.html?id=${screen.id}&viewMode=story` +
      (globals ? `&globals=${encodeURIComponent(globals)}` : '');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#storybook-root > *', { timeout: 30_000 });
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, {
      timeout: 30_000,
    });
    // Carets and scrollbars are the two things that differ between otherwise
    // identical runs.
    await page.addStyleTag({
      content: '*{caret-color:transparent!important}::-webkit-scrollbar{display:none}',
    });

    // `scale: 'device'` keeps the 2x pixels; the default would throw them away.
    await page.screenshot({
      path: path.join(outDir, `${screen.file}${suffix}.png`),
      fullPage: true,
      animations: 'disabled',
      scale: 'device',
    });

    const size = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));

    results.push({ ...screen, size });
    console.log(`captured ${screen.file}  ${size.width}x${size.height} css px`);
  }

  if (referenceDir) {
    for (const result of results) {
      const reference = path.join(path.resolve(referenceDir), `${result.file}.png`);
      if (!existsSync(reference)) {
        console.log(`skipped  ${result.file}: no reference at ${reference}`);
        continue;
      }
      const score = await compare(page, reference, result.file);
      console.log(
        `compared ${result.file}  ${(score.mismatch * 100).toFixed(2)}% of pixels differ ` +
          `(reference ${score.referenceSize}, capture ${score.captureSize})`,
      );
    }
  }

  await browser.close();
}

/** Loads both images into a canvas, scores the delta and writes the overlays. */
async function compare(page, referencePath, name) {
  const capturePath = path.join(outDir, `${name}.png`);
  // Inlined rather than linked: a file:// image taints the canvas, and a
  // tainted canvas cannot be read back to score the delta.
  const [referenceData, captureData] = await Promise.all([
    readFile(referencePath),
    readFile(capturePath),
  ]);
  const referenceSrc = `data:image/png;base64,${referenceData.toString('base64')}`;
  const captureSrc = `data:image/png;base64,${captureData.toString('base64')}`;
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}.w{position:relative;line-height:0}
img{display:block;width:100%;image-rendering:pixelated}
.over{position:absolute;inset:0;opacity:.5}
.diff{position:absolute;inset:0;mix-blend-mode:difference;filter:invert(1) contrast(3)}</style>
<div class="w" id="w">
  <img id="a" src="${referenceSrc}">
  <img id="b" class="over" src="${captureSrc}">
</div>`;
  const tmp = path.join(outDir, `${name}.overlay.html`);
  await writeFile(tmp, html, 'utf8');

  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );

  const score = await page.evaluate(() => {
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const width = Math.min(a.naturalWidth, b.naturalWidth);
    const height = Math.min(a.naturalHeight, b.naturalHeight);
    const draw = (image) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.getContext('2d').getImageData(0, 0, width, height).data;
    };
    const left = draw(a);
    const right = draw(b);
    let different = 0;
    for (let index = 0; index < left.length; index += 4) {
      const delta = Math.max(
        Math.abs(left[index] - right[index]),
        Math.abs(left[index + 1] - right[index + 1]),
        Math.abs(left[index + 2] - right[index + 2]),
      );
      if (delta > 8) different += 1;
    }
    return {
      mismatch: different / (width * height),
      referenceSize: `${a.naturalWidth}x${a.naturalHeight}`,
      captureSize: `${b.naturalWidth}x${b.naturalHeight}`,
    };
  });

  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({
    path: path.join(outDir, `${name}.overlay.png`),
    fullPage: true,
    scale: 'device',
  });

  return score;
}

await main();
