# Playtest door (no Phantom) — local / isolated host only

**Audience:** Elon / QA who need to enter the traveler client without installing Phantom.  
**This is not a login skip on live.** Do not deploy this host. Do not point it at production.

Live (`https://play.chainlords.net`) stays Phantom + SIWS. Production auth is unchanged.

---

## Hard rules

| Do | Do not |
|----|--------|
| Run a **separate** Vite traveler + **local** C# game server | Put a Phantom skip on `play.chainlords.net` |
| Open **http://127.0.0.1:8081** only | Open live, then use browser console “dev” hooks |
| Keep saves in this machine’s `Chars/` | Set `VITE_GAME_HOST` / `VITE_GAME_PORT` to play / Hetzner |
| Leave wallets, middleware, $HELL, market **off** | Set `VITE_MIDDLEWARE_URL` to Railway middleware |
| Use character name **`ElonQa`** | Copy live `Chars/`, `DATABASE_URL`, or `WALLET_AUTH_SECRET` |

**Never point the playtest client at production.** If the page hostname is `play.chainlords.net`, `*.chainlords.net`, or the VPS IPs, the client treats the session as public traveler and talks to that host’s `/ws`. A fake `dev-bypass-token` there is either rejected (secret required) or would be an account-takeover bug. Do not test that path.

The no-Phantom helpers exist only while Vite `import.meta.env.DEV` is true (`installConnectDialogDevHooks` in `ConnectDialog.store.ts`). A production `pnpm build` **does not** install them. Do not add a production flag to “make Phantom optional.”

---

## What you actually start (later — not in this freeze)

Two processes on **your laptop / a throwaway VM**, never Hetzner, never Railway:

1. **Game server** — WebSocket **1337**, `ASPNETCORE_ENVIRONMENT=Development`, **no** `WALLET_AUTH_SECRET`.
2. **Traveler client** — existing Vite config on port **8081** (`vite/config.dev.traveler.mjs`). GM tooling stays on **8080**; Elon should use **8081**.

Do **not** start production middleware. Wallet auth defaults to `http://localhost:3001`; leave that unused.

Do **not** `railway up`, SSH, or copy this stack onto `play.chainlords.net`.

---

## How to run (when someone is allowed to boot a local stack)

From a clone of this repo (branch does not matter for *running*; ship docs via PR to `consolidacion`).

**Terminal A — game server**

```bash
cd multiplayer/server
# Isolated playtest: Development auth, no HMAC, no prod DB, no $HELL mint.
unset DATABASE_URL WALLET_AUTH_SECRET HELL_MINT MARKET_MIDDLEWARE_URL SOLANA_RPC_URL
export ASPNETCORE_ENVIRONMENT=Development
export HELL_TESTING_WEEK=0
export HELL_TESTING_WEEK_UNTIL=2020-01-01
# launchSettings.json sets HELL_MINT — skip that profile.
dotnet run --no-launch-profile
```

Expect a bind on **1337** (see `Config/Settings.json`). You may see `[SECURITY] WARNING: WALLET_AUTH_SECRET is not set` — that is **required** for this isolated door. It must **never** appear on the live VPS.

**Terminal B — traveler Vite (8081)**

```bash
cd multiplayer/mp-client
pnpm install
# Do not set VITE_GAME_HOST / VITE_GAME_PORT / VITE_MIDDLEWARE_URL.
pnpm exec vite --config vite/config.dev.traveler.mjs
```

Browser: **http://127.0.0.1:8081/** (prefer IPv4; the game often binds `0.0.0.0` and not `[::1]`).

---

## Enter without Phantom

1. Wait until the login hub paints.
2. Open DevTools → Console on **that same 8081 origin**.
3. First time (empty slots):

   ```js
   window.__helbreathDevEnterCreateChar(0)
   ```

   Create the character with display name **`ElonQa`** (2–10 letters/digits, must start with a letter). Complete appearance + stats on the Create Character desk.

4. Later logins (slot already saved locally):

   ```js
   window.__helbreathDevEnterPlayWorld()
   ```

   then Start on the occupied slot, **or**:

   ```js
   window.__helbreathDevConnectAs('ElonQa')
   ```

`__helbreathDevConnectAs` sends a **fake** wallet id (`DevTestWallet…`) and `dev-bypass-token`. That is accepted only because this server is Development with no `WALLET_AUTH_SECRET`. It is not a Solana wallet and must not be used against live.

---

## Economy / live isolation

- **No Phantom, no SIWS, no real pubkey.**
- **No $HELL:** do not set `HELL_MINT`; keep testing-week env off as above. Any local credit JSON under `Chars/` is toy data — do not claim, mint, or merge it with live.
- **No cash shop / market / middleware.** Do not set `CASH_SHOP_ALLOW_DEV_GRANT=1`.
- **No Postgres.** Leave `DATABASE_URL` unset so persistence stays local `Chars/*.json`.
- **No bridge:** do not rsync `Chars/`, do not reuse live `WALLET_AUTH_SECRET`, do not tunnel 8081 to the VPS.

---

## Sanity checks

| Check | Expected |
|-------|----------|
| Address bar | `http://127.0.0.1:8081` (or `localhost`), **not** `play.chainlords.net` |
| `window.__helbreathDevConnectAs` | Function exists (Vite DEV only) |
| Live play | Unchanged: Phantom required; no `__helbreathDev*` |
| This PR | Docs only; nobody deployed a playtest host |

If `__helbreathDevConnectAs` is missing, you are on a production build — **stop**. Do not invent a skip.
