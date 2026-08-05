# Grok model routing — Chain Lords

**Policy (PO 2026-07-22):** calibrate by **channel / tool**, not one global model.

| Channel | Role | Default API model | Cost intent |
|---------|------|-------------------|-------------|
| **Discord FAQ** (`social-bot`) | Short support EN/ES, links, no combat advice | `grok-4-1-fast-non-reasoning` | **Cheap / high volume** |
| **Market advisor** (middleware `/market/advisor`) | Search/buy plan JSON only | same as FAQ (cheap) | **Cheap** |
| **In-game assistant** (middleware `/assistant/ingame`) | Richer help, quests, UI, soft onboarding | `grok-4.3` | **Quality** |

## Why you may not “see” 4.1 in xAI Console

xAI UI often lists **flagship** names (4.3 / 4.5). The **Fast** line is an **API slug** for high-volume cheap calls.  
As of mid-2026, older Fast slugs may **redirect** to 4.3 at different pricing if retired — always check [docs.x.ai models](https://docs.x.ai/developers/models) + console usage.

**If FAQ Fast is gone / errors:** set  
`XAI_MODEL_FAQ=grok-4.3`  
and shorten prompts / `MAX_REPLY_CHARS` / cooldowns.

## Env knobs

### social-bot
```
XAI_API_KEY=...
XAI_MODEL_FAQ=grok-4-1-fast-non-reasoning
# legacy alias still works:
# XAI_MODEL=grok-4-1-fast-non-reasoning
```

### middleware-node
```
XAI_API_KEY=...
XAI_MODEL_FAQ=grok-4-1-fast-non-reasoning
XAI_MODEL_MARKET=grok-4-1-fast-non-reasoning
XAI_MODEL_INGAME=grok-4.3
```

## Usage telemetry (for later reports)

Each LLM call appends a line to:

- `social-bot/data/xai-usage.jsonl` (if writable)
- `middleware-node/data/xai-usage.jsonl`

Fields: `ts`, `channel` (`faq`|`market`|`ingame`), `model`, `ok`, `latencyMs`, `promptChars`, `replyChars`, optional `error`.

**Report workflow (when users hammer tools):**

```bash
# middleware
node -e "const fs=require('fs');const L=fs.readFileSync('data/xai-usage.jsonl','utf8').trim().split(/\n/).map(JSON.parse);const by={};for(const r of L){const k=r.channel+'|'+r.model;by[k]=(by[k]||0)+1};console.log(by)"
```

Or ask Grok: “summarize xai-usage.jsonl by channel/model and recommend upgrades”.

## Soft-test budget (~US$10 API)

1. Keep **FAQ + market** on Fast (or cheapest slug).  
2. **In-game** only when the feature is live / gated (rate limit).  
3. After 1–2 weeks: report → promote only the tools that need 4.3/4.5.

## In-game wire-up (game server)

Client/NPC → `POST {MIDDLEWARE}/assistant/ingame`  
Body: `{ "message", "characterName?", "locale?" }`  
Header optional: wallet auth when public.

Not combat-cheating; system prompt forbids exploits / wallet drain advice.
