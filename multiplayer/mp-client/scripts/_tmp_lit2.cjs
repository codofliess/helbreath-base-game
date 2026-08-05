const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => console.log("ERR", e.message));
  await page.goto("http://localhost:8081/?v=lit2-" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.__helbreathDevEnterPlayWorld && window.__helbreathDevEnterPlayWorld());
  await page.waitForTimeout(3500);
  console.log("scale", await page.evaluate(() => document.body.style.getPropertyValue("--login-desk-scale")));
  await page.locator("#game-container canvas").screenshot({ path: "scripts/verify-selectchar-out/literal2-canvas.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
