const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8081/?v=geo-" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__helbreathDevEnterPlayWorld && window.__helbreathDevEnterPlayWorld());
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => ({
    select: document.body.classList.contains("login-selectchar-active"),
    errors: 0,
    scale: document.body.style.getPropertyValue("--login-desk-scale"),
    snap: window.__helbreathDevConnectSnapshot && window.__helbreathDevConnectSnapshot(),
  }));
  console.log("ST", JSON.stringify(st));
  console.log("ERRORS", JSON.stringify(errors));
  await page.screenshot({ path: "scripts/verify-selectchar-out/geo-full.png", fullPage: true });
  try { await page.locator("#game-container canvas").screenshot({ path: "scripts/verify-selectchar-out/geo-canvas.png" }); } catch(e) { console.log(e.message); }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
