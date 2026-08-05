# Discord Rich Presence (browser client)

## What users see

With **Discord desktop** open and logged in, entering the game world sets activity similar to:

- **Playing Helbreath Chain Lords**
- Details: `CharacterName · Lv N`
- State: `In the realm` / map name when available

## How it works

The web client connects to Discord’s **local RPC** (`ws://127.0.0.1:6463–6472`). Olympia does this via native Game SDK; we approximate the same IPC path from the browser.

If Discord is closed, RPC is blocked, or the Application ID is wrong → **silent no-op** (game still plays).

## Setup (one-time)

1. [Discord Developer Portal](https://discord.com/developers/applications) → your Chain Lords app (or create one).
2. Copy **Application ID** → build with:
   ```bash
   VITE_DISCORD_CLIENT_ID=your_app_id pnpm run build
   ```
   Default in code uses the existing bot application id if env is unset.
3. Optional: **Rich Presence → Art Assets** upload a large image key (then re-enable `assets.large_image` in `DiscordPresence.ts`).
4. Enable **Display on profile** / activity for the app as Discord UI requires.

## Code

- `mp-client/src/utils/DiscordPresence.ts`
- Wired in `App.tsx` on `OUT_MAP_LOADED` / leave LoginScreen
