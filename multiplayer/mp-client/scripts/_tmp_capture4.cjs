const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join("scripts", "verify-selectchar-out");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:8081/?v=cmp4", { waitUntil: "domcontentloaded", timeout: 90000 });
  for (let n = 0; n < 60; n++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    if (window.__helbreathDevEnterPlayWorld) window.__helbreathDevEnterPlayWorld();
  });
  await page.waitForTimeout(3000);
  const last = await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas");
    const r = canvas ? canvas.getBoundingClientRect() : null;
    return {
      select: document.body.classList.contains("login-selectchar-active"),
      hotkey: !!document.querySelector(".hotkey-bar-root"),
      hub: !!document.querySelector(".login-hub"),
      canvasClass: canvas ? canvas.className : "",
      styleW: canvas ? canvas.style.width : "",
      transform: canvas ? canvas.style.transform : "",
      rect: r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null,
      snap: typeof window.__helbreathDevConnectSnapshot === "function" ? window.__helbreathDevConnectSnapshot() : null,
      body: document.body.className,
    };
  });
  console.log("STATE", JSON.stringify(last, null, 2));
  await page.screenshot({ path: path.join(OUT, "cmp4-full.png"), fullPage: true });
  const canvas = page.locator("#game-container canvas");
  if (await canvas.count()) {
    await canvas.screenshot({ path: path.join(OUT, "cmp4-canvas.png") });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
