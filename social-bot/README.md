# Chain Lord — Discord community bot

Lightweight **FAQ / DM** bot for Helbreath Chain Lords.

- **With `XAI_API_KEY`:** cheap Grok replies (freeze copy enforced in system prompt).
- **Without key:** **static FAQ** (`src/staticFaq.js`) — play, wallet, bugs, arena, mint, AFK, EK, $HELL, scams (EN/ES).

## What it does

- Answers **DMs** to the bot  
- Answers in channels listed in `DISCORD_SUPPORT_CHANNEL_IDS` (`#support`)  
- Answers when **@mentioned** in other channels  
- System prompt / static freezes: no investment shill, not “official Helbreath”  
- Optional log to `#ops-bot-log` (`DISCORD_OPS_LOG_CHANNEL_ID`)

## What it does **not** do

- Post announcements for you  
- Post on **X** (needs X API + approval flow — phase 2)  
- Replace human mods for bans / exploits / refunds  

## Setup (15–30 min)

### 1. Discord application

1. https://discord.com/developers/applications → New Application  
2. **Bot** → Add Bot → copy token → `DISCORD_BOT_TOKEN`  
3. Privileged intents: **Message Content Intent** ON (needed for free-text in `#support`).  
   Without it the bot still answers via **`/faq`** and DMs.  
4. If Message Content is ON, set `DISCORD_MESSAGE_CONTENT=1` in `.env`.  
5. OAuth2 → URL Generator: `bot` + `applications.commands`  
   Permissions: Read Messages, Send Messages, Read Message History, Use App Commands, DM  
6. Invite to your server  

### 2. xAI API

1. https://console.x.ai/ → create API key → `XAI_API_KEY`  
2. Prefer cheap model: `grok-4-1-fast-non-reasoning` or `grok-3-mini`  
3. Check free/promo credits under data sharing if available  

### 3. Run

```bash
cd social-bot
cp .env.example .env
# edit .env
npm install
npm start
```

### 4. Test

- In Discord: **`/faq question: how do I play?`**  
- Or DM the bot: `How do I join the test?`  
- Or free-text in `#support` (requires Message Content Intent + `DISCORD_MESSAGE_CONTENT=1`)  

Expect a short answer + official links from `.env`.

## X (phase 2)

X automated DMs/replies need:

- X Developer App + **paid** access for write/DM  
- Separate process + human approval for public posts  

Draft tweets in Discord `#ops-content` first; don’t auto-post money/token claims.

## Ops docs

- [`docs/social/OPS-DESK.md`](../docs/social/OPS-DESK.md)  
- [`docs/social/FREEZE-COPY.md`](../docs/social/FREEZE-COPY.md)  
