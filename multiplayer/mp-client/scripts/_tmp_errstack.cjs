const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message, "\nSTACK", e.stack));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  await page.goto("http://localhost:8081/?v=fix-" + Date.now(), { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(8000);
  // force login screen ready
  for (let i = 0; i < 30; i++) {
    const hub = await page.$(".login-hub");
    if (hub) { console.log("hub at", i); break; }
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    try {
      window.__helbreathDevEnterPlayWorld && window.__helbreathDevEnterPlayWorld();
    } catch (e) {
      console.log("HOOKERR", e && e.stack);
    }
  });
  await page.waitForTimeout(2000);
  // Try construct desks by reading module - not possible
  // Check if SELECTCHAR_TITLE_FRAME in window bundle by fetching main
  const st = await page.evaluate(() => ({
    snap: window.__helbreathDevConnectSnapshot && window.__helbreathDevConnectSnapshot(),
    select: document.body.classList.contains("login-selectchar-active"),
    hub: !!document.querySelector(".login-hub"),
  }));
  console.log("ST", JSON.stringify(st));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
