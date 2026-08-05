const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join("scripts", "verify-selectchar-out");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:8081/?v=live3", { waitUntil: "domcontentloaded", timeout: 90000 });
  for (let i = 0; i < 90; i++) {
    const hub = await page.$(".login-hub");
    if (hub) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "cmp-01-hub.png"), fullPage: true });
  await page.evaluate(async () => {
    if (window.__helbreathDevEnterPlayWorld) await window.__helbreathDevEnterPlayWorld();
  });
  // Wait up to 15s for selectchar class
  let last = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    last = await page.evaluate(() => {
      const canvas = document.querySelector("#game-container canvas");
      const r = canvas ? canvas.getBoundingClientRect() : null;
      return {
        i,
        select: document.body.classList.contains("login-selectchar-active"),
        body: document.body.className,
        hotkey: !!document.querySelector(".hotkey-bar-root"),
        hub: !!document.querySelector(".login-hub"),
        canvasClass: canvas?.className || "",
        styleW: canvas?.style.width || "",
        styleH: canvas?.style.height || "",
        transform: canvas?.style.transform || "",
        rect: r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null,
        snap: typeof window.__helbreathDevConnectSnapshot === "function" ? window.__helbreathDevConnectSnapshot() : null,
      };
    });
    if (i % 2 === 0) console.log(JSON.stringify(last));
    if (last.select) break;
  }
  await page.screenshot({ path: path.join(OUT, "cmp-02-after.png"), fullPage: true });
  try {
    await page.locator("#game-container canvas").screenshot({ path: path.join(OUT, "cmp-03-canvas.png") });
  } catch (e) {
    console.log("canvas shot fail", e.message);
  }
  console.log("FINAL", JSON.stringify(last, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
