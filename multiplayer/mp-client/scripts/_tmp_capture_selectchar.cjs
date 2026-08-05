const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join("scripts", "verify-selectchar-out");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:8081/?v=live-compare-20260715", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "live-pw-01-landing.png"), fullPage: true });
  const body = await page.evaluate(() => document.body.className);
  const hasHub = await page.$(".login-hub");
  const hasHooks = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === "function");
  console.log(JSON.stringify({ body, hasHub: !!hasHub, hasHooks }));
  if (hasHooks) {
    await page.evaluate(async () => {
      try { await window.__helbreathDevEnterPlayWorld(); } catch (e) { console.error(e); }
    });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, "live-pw-02-after-enter.png"), fullPage: true });
    const probe = await page.evaluate(() => {
      const canvas = document.querySelector("#game-container canvas");
      const r = canvas ? canvas.getBoundingClientRect() : null;
      return {
        body: document.body.className,
        hub: !!document.querySelector(".login-hub"),
        hotkey: !!document.querySelector(".hotkey-bar-root"),
        selectchar: document.body.classList.contains("login-selectchar-active"),
        canvasClass: canvas?.className,
        canvasRect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
        snap: typeof window.__helbreathDevConnectSnapshot === "function" ? window.__helbreathDevConnectSnapshot() : null,
      };
    });
    console.log("PROBE", JSON.stringify(probe, null, 2));
    await page.screenshot({ path: path.join(OUT, "live-pw-03-selectchar.png"), fullPage: true });
  }
  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
