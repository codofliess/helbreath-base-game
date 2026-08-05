const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + (e.stack||"").slice(0,200)));
  await page.goto("http://localhost:8081/?v=literal-" + Date.now(), { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 50; i++) {
    if (await page.$(".login-hub")) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__helbreathDevEnterPlayWorld && window.__helbreathDevEnterPlayWorld());
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => ({
    select: document.body.classList.contains("login-selectchar-active"),
    scale: document.body.style.getPropertyValue("--login-desk-scale"),
    top: document.body.style.getPropertyValue("--login-desk-top"),
  }));
  console.log(JSON.stringify({ st, errors }, null, 2));
  await page.locator("#game-container canvas").screenshot({ path: "scripts/verify-selectchar-out/literal-canvas.png" });
  await page.screenshot({ path: "scripts/verify-selectchar-out/literal-full.png", fullPage: true });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
