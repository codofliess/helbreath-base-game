const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join("scripts", "verify-selectchar-out");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("[console] " + m.text());
  });
  await page.goto("http://localhost:8081/?v=broke-check", { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 45; i++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "broke-01-hub.png"), fullPage: true });
  try {
    await page.evaluate(() => {
      if (window.__helbreathDevEnterPlayWorld) window.__helbreathDevEnterPlayWorld();
    });
  } catch (e) {
    errors.push("hook: " + e.message);
  }
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, "broke-02-play.png"), fullPage: true });
  try {
    await page.locator("#game-container canvas").screenshot({ path: path.join(OUT, "broke-03-canvas.png") });
  } catch (_) {}
  const st = await page.evaluate(() => {
    const c = document.querySelector("#game-container canvas");
    return {
      body: document.body.className,
      select: document.body.classList.contains("login-selectchar-active"),
      hub: !!document.querySelector(".login-hub"),
      hotkey: !!document.querySelector(".hotkey-bar-root"),
      snap: typeof window.__helbreathDevConnectSnapshot === "function" ? window.__helbreathDevConnectSnapshot() : null,
      canvasClass: c?.className || "",
      style: c ? { w: c.style.width, h: c.style.height, t: c.style.transform } : null,
    };
  });
  console.log("STATE", JSON.stringify(st, null, 2));
  console.log("ERRORS", JSON.stringify(errors.slice(0, 30), null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
