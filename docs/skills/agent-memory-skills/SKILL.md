---
name: agent-memory-skills
description: >
  Compile session experience into durable skills and docs instead of stuffing raw chat
  history into context. Use when the user mentions agent memory, PlugMem, context bloat,
  where to save learnings, multi-project skills, or dispersing knowledge to git/Drive/local.
---

# Agent memory → skills (not raw logs)

## North star (Microsoft PlugMem-style insight)

Agents need **facts + reusable skills**, not full transcripts in the prompt.  
Compile experience offline → inject only decision-ready knowledge.

## When this skill triggers

- “dónde guardo esto”, “skill multi-proyecto”, “memoria del agente”
- Context too large / session compaction
- User wants git + Drive + local dispersion policy
- Creating or updating a skill after a long session

## Write destinations (PO policy)

| Content | Destination |
|---------|-------------|
| Product facts for Chain Lords | `helbreath-base-game/docs/BITACORA.md` + `MASTERPLAN.md` |
| Reusable procedure | `~\.grok\skills\<name>\SKILL.md` (and future private `agent-skills` repo) |
| Session handoff | `docs/SESSION-HANDOFF-YYYY-MM-DD.md` |
| Code | GitHub only (branch of the product) |
| Secrets | Never git / never public Drive |

## Compile checklist (do this at end of digressions)

1. Extract **decisions** (what/why).  
2. Extract **anti-patterns** (what failed — so we do not retry).  
3. Extract **verify** steps.  
4. Update BITACORA (readable) + MASTERPLAN if roadmap.  
5. Write or patch a **skill** if multi-project.  
6. Git commit docs (no secrets).  
7. Mirror dense docs to Google Drive (`martin.fliess@grupofliess.com.ar`).

## Skill quality bar

- Frontmatter `name` + `description` (triggers).  
- Short, actionable, paths real.  
- No secrets.  
- Prefer links to repo docs over pasting 50 pages.

## Related docs in CL repo

- `docs/AGENT-MEMORY-AND-SKILLS.md`  
- `docs/LOGISTICS-TMS-VISION.md` (example of a compiled digression)
