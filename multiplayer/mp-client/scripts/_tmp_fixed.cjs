const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8081/?v=fixed-" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__helbreathDevEnterPlayWorld && window.__helbreathDevEnterPlayWorld());
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => ({
    select: document.body.classList.contains("login-selectchar-active"),
    hub: !!document.querySelector(".login-hub"),
    snap: window.__helbreathDevConnectSnapshot && window.__helbreathDevConnectSnapshot(),
  }));
  console.log("ST", JSON.stringify(st));
  console.log("ERRORS", JSON.stringify(errors));
  await page.screenshot({ path: "scripts/verify-selectchar-out/fixed-play.png", fullPage: true });
  try { await page.locator("#game-container canvas").screenshot({ path: "scripts/verify-selectchar-out/fixed-canvas.png" }); } catch {}
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
