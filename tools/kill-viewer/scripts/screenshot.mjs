// Local-only screenshots with SAMPLE data. Starts both built servers on 127.0.0.1, drives headless Chrome.
// Uses a throwaway, randomly generated dev JWT secret for the admin API (never a real credential).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { chromium } from 'playwright-core';

const devSecret = randomBytes(32).toString('hex');
const base = { ...process.env, NODE_ENV: 'development' };
const procs = [
  spawn('node', ['dist/server/public-api.mjs'], { env: { ...base, PUBLIC_PORT: '8797', PUBLIC_STATIC_DIR: 'dist/public', PUBLIC_PUBLISH_DELAY_HOURS: '0', PUBLIC_LOOT_REVEAL_DELAY_HOURS: '0', PUBLIC_TIME_ROUND_MINUTES: '60', KILL_LEDGER_ONCHAIN_DEPLOYED: 'false' }, stdio: 'inherit' }),
  spawn('node', ['dist/server/admin-api.mjs'], { env: { ...base, ADMIN_PORT: '8798', ADMIN_STATIC_DIR: 'dist/admin', ADMIN_IP_ALLOWLIST: '127.0.0.1,::1', ADMIN_DEV_JWT_SECRET: devSecret }, stdio: 'inherit' }),
];
const cleanup = () => procs.forEach((p) => p.kill());
process.on('exit', cleanup);
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, timezoneId: process.env.SHOT_TZ ?? 'America/Buenos_Aires' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8797/#/c/GoldMule_77');
  await page.waitForSelector('.character .kill');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshot-public.png', fullPage: false });
  await page.goto('http://127.0.0.1:8797/#/rankings');
  await page.waitForSelector('.rank-table tbody tr');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot-rankings.png', fullPage: true });
  await page.goto('http://127.0.0.1:8797/#/c/Sable_Rogue');
  await page.waitForFunction(() => document.querySelector('.character h2')?.textContent?.includes('Sable_Rogue'));
  await page.waitForSelector('.character .ek-top10');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot-character-ek.png' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Europe/Madrid' });
  const mp = await mobile.newPage();
  await mp.goto('http://127.0.0.1:8797/');
  await mp.waitForSelector('.kill');
  await mp.screenshot({ path: 'screenshot-public-mobile.png' });

  const token = await new SignJWT({ roles: ['ops_admin'], email: 'gm.example@example.invalid' }).setProtectedHeader({ alg: 'HS256' })
    .setSubject('staff-demo').setIssuer('chainlords-dev').setAudience('kill-viewer-admin').setExpirationTime('10m').sign(new TextEncoder().encode(devSecret));
  const ap = await ctx.newPage();
  await ap.addInitScript((t) => sessionStorage.setItem('ops_token', t), token);
  await ap.goto('http://127.0.0.1:8798/admin/');
  await ap.waitForSelector('.flag');
  await ap.click('.flag:has-text("Loot funneling")');
  await ap.waitForSelector('table.full tbody tr');
  await ap.waitForTimeout(300);
  await ap.screenshot({ path: 'screenshot-admin.png' });
  await ap.click('.tabs button:has-text("Flags")');
  await ap.screenshot({ path: 'screenshot-admin-flags.png' });
  console.log('screenshots written');
} finally { await browser.close(); cleanup(); }
