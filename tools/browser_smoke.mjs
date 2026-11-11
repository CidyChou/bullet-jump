// Run a static HTTP server first. No game code is modified or test hook exposed.
// npm install --no-save playwright (or point PLAYWRIGHT_MODULE at an existing copy)
// node tools/browser_smoke.mjs http://127.0.0.1:8080
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const url = process.argv[2] || 'http://127.0.0.1:8080';
const failures = [];
const artifactDir = process.env.SMOKE_ARTIFACT_DIR || '/tmp/bullet-jump-smoke';
await mkdir(artifactDir, { recursive: true });

try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
    page.on('requestfailed', request => failures.push(`${request.url()} ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.goto(url);
    await page.waitForSelector('#app[data-state="title"]');
    assert.match(await page.title(), /v4.0/);
    await page.screenshot({ path: `${artifactDir}/${mobile ? 'mobile' : 'desktop'}-title.png` });
    await page.click('[data-action="settings"]');
    await page.click('[data-action="sound"]');
    assert.equal(await page.getAttribute('[data-action="sound"]', 'aria-pressed'), 'false');
    await page.click('[data-action="settings-back"]');
    await page.click('[data-action="play"]');
    assert.equal(await page.locator('.level-slot').count(), 5);
    assert.equal(await page.locator('.level-slot:disabled').count(), 4);
    await page.screenshot({ path: `${artifactDir}/${mobile ? 'mobile' : 'desktop'}-levels.png` });
    await page.click('[data-level="1"]');
    await page.waitForSelector('#app[data-state="playing"]');
    for (let i = 0; i < 3; i++) await page.click('#tutorialHint button');
    const canvasColors = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 120) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    });
    assert.ok(canvasColors > 20, `Canvas appears blank: ${canvasColors} colors`);
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      const box = await page.locator('canvas').boundingBox();
      const touch = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.7, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touch, x: touch.x + 50 }] });
      assert.ok(await page.locator('#joystick').evaluate(el => el.classList.contains('show')));
      const skill = await page.locator('#bulletTimeButton').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touch, x: touch.x + 50 }, { x: skill.x + 25, y: skill.y + 25, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.locator('#joystick').evaluate(el => el.classList.contains('show')), false);
    } else {
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(140); await page.keyboard.up('ArrowRight');
      await page.keyboard.press('Space');
    }
    await page.click('#pauseButton');
    await page.waitForSelector('#app[data-state="paused"]');
    const before = await page.textContent('#runClock'); await page.waitForTimeout(1100);
    assert.equal(await page.textContent('#runClock'), before);
    await page.click('[data-action="settings"]'); await page.click('[data-action="sound"]'); await page.click('[data-action="settings-back"]');
    await page.click('[data-action="retry"]');
    assert.equal(await page.textContent('#killValue'), '0');
    await page.screenshot({ path: `${artifactDir}/${mobile ? 'mobile' : 'desktop'}-playing.png` });
    await page.click('#pauseButton'); await page.click('[data-action="select"]');
    await page.reload(); await page.waitForSelector('#app[data-state="title"]');
    await page.click('[data-action="settings"]');
    assert.equal(await page.getAttribute('[data-action="sound"]', 'aria-pressed'), 'true');
    await context.close();
  }
  assert.deepEqual(failures, []);
  console.log(`PASS desktop + mobile smoke; zero page/console/request errors. Screenshots: ${artifactDir}`);
} finally { await browser.close(); }
