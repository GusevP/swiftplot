// Needs Playwright: pnpm add -D @playwright/test
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const med = a => a.sort((x, y) => x - y)[a.length >> 1];
const cases = [
  ['text-none'],
  ['text-canvas'],
  ['text-dom'],
  ['sc-obj', 10000],
  ['sc-typed', 10000],
  ['sc-sprite', 10000],
  ['sc-gl', 10000],
  ['sc-obj', 100000],
  ['sc-typed', 100000],
  ['sc-sprite', 100000],
  ['sc-gl', 100000],
  ['sc-typed', 1000000],
  ['sc-sprite', 1000000],
  ['sc-gl', 1000000],
  ['st-full', 100000],
  ['st-decim', 100000],
  ['st-full', 1000000],
  ['st-decim', 1000000],
];
const rows = [];
for (const [v, n = 0] of cases) {
  const row = { v, n };
  for (const rate of [1, 4]) {
    const js = [],
      fr = [];
    for (let i = 0; i < 8; i++) {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await page.goto(new URL('index.html', import.meta.url) + '?v=' + v + '&n=' + n);
      await page.waitForFunction(() => window.ready);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const r = await page.evaluate(() => window.run());
      await page.close();
      if (i) {
        js.push(r.js);
        fr.push(r.frame);
      }
    }
    row['js' + rate + 'x'] = +med(js).toFixed(1);
    row['frame' + rate + 'x'] = +med(fr).toFixed(1);
  }
  rows.push(row);
}
await browser.close();
console.table(rows);
