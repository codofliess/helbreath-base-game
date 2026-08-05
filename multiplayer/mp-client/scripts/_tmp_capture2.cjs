const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join("scripts", "verify-selectchar-out");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error" || /select|desk|login|play-world/i.test(m.text())) {
      console.log("[console]", m.type(), m.text().slice(0, 200));
    }
  });
  console.log("goto");
  await page.goto("http://localhost:8081/?v=live-compare-2", { waitUntil: "domcontentloaded", timeout: 90000 });
  // Wait for hub or login ready (loading finishes)
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => ({
      hub: !!document.querySelector(".login-hub"),
      body: document.body.className,
      hooks: typeof window.__helbreathDevEnterPlayWorld === "function",
      canvas: !!document.querySelector("#game-container canvas"),
      select: document.body.classList.contains("login-selectchar-active"),
    }));
    if (st.hub || st.select) {
      console.log("ready", i, JSON.stringify(st));
      break;
    }
    if (i % 5 === 0) console.log("wait", i, JSON.stringify(st));
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(OUT, "live-pw-10-ready.png"), fullPage: true });
  const hooks = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === "function");
  if (!hooks) {
    console.log("no hooks");
    await browser.close();
    return;
  }
  // If hub visible, enter play world
  const hub = await page.$(".login-hub-world button");
  if (hub) {
    console.log("click hub world button");
    // Prefer hook to skip wallet UI flakiness if session stored
    try {
      await page.evaluate(async () => {
        if (window.__helbreathDevEnterPlayWorld) await window.__helbreathDevEnterPlayWorld();
      });
    } catch (e) {
      console.log("hook err", e.message);
    }
  } else {
    console.log("no hub button, calling hook");
    await page.evaluate(async () => {
      if (window.__helbreathDevEnterPlayWorld) await window.__helbreathDevEnterPlayWorld();
    });
  }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const canvas = document.querySelector("#game-container canvas");
      const r = canvas ? canvas.getBoundingClientRect() : null;
      const snap = typeof window.__helbreathDevConnectSnapshot === "function" ? window.__helbreathDevConnectSnapshot() : null;
      return {
        select: document.body.classList.contains("login-selectchar-active"),
        hotkey: !!document.querySelector(".hotkey-bar-root"),
        hub: !!document.querySelector(".login-hub"),
        canvasClass: canvas?.className || "",
        canvas: r ? { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) } : null,
        snap,
        body: document.body.className,
      };
    });
    console.log("tick", i, JSON.stringify(st));
    if (st.select || (st.snap && st.snap.phase === "play-world" && !st.hub)) {
      await page.screenshot({ path: path.join(OUT, "live-pw-11-selectchar.png"), fullPage: true });
      // crop-ish: also canvas only if possible
      if (st.canvas) {
        const canvas = page.locator("#game-container canvas");
        try {
          await canvas.screenshot({ path: path.join(OUT, "live-pw-12-canvas.png") });
        } catch (_) {}
      }
      break;
    }
  }
  await page.screenshot({ path: path.join(OUT, "live-pw-13-final.png"), fullPage: true });
  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
