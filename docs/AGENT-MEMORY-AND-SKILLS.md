# Memoria de agentes y skills reutilizables

> Aprendizaje multi-proyecto (2026-08-06).  
> Origen: post X [@N01ennn](https://x.com/n01ennn/status/2085100042566701419) sobre **PlugMem** (Microsoft) — compilar experiencia en conocimiento decision-ready, no re-inyectar historial crudo.  
> Skill operativa: `~\.grok\skills\agent-memory-skills\SKILL.md`.

## 1. Insight (PlugMem / artículo)

| Mal | Bien |
|-----|------|
| Meter transcripts y logs enteros al contexto | Extraer **hechos** + **skills reutilizables** |
| “Más memoria = mejor agente” | **Mejor memoria** = menos tokens, más utilidad por token |
| Un solo chat como fuente de verdad | Graph / docs / skills versionados |

Claims del post (verificar paper si se implementa código): hasta **1–2 órdenes de magnitud** menos tokens; un módulo plug-in vs memorias task-specific.

**Advertencia (críticas en el hilo):** compilar el graph tiene costo LLM upfront; no borrar “intentos fallidos” o el agente reintenta caminos muertos.

## 2. Política PO — dónde va cada cosa

| Artefacto | GitHub | Google Drive | Local |
|-----------|--------|--------------|--------|
| Código CL | `helbreath-base-game` `consolidacion` | no (salvo handoff) | clone |
| MASTERPLAN / BITACORA / satélites | sí en `docs/` | espejo legible | sí |
| Skills multi-proyecto | monorepo privado futuro `agent-skills` | espejo de skills clave | `~\.grok\skills\` |
| SESSION-HANDOFF | sí | sí | sí |
| Secrets, SSH, `.env` | **nunca** | **nunca público** | password manager |
| Publish bins / tmp | no | opcional pesado | no commit |

### Dispersión de un aprendizaje (checklist)

1. **¿Es hecho de producto/código CL?** → BITACORA (legible) + MASTERPLAN changelog/roadmap si aplica.  
2. **¿Es reutilizable en otro repo?** → skill `SKILL.md` (+ scripts/refs).  
3. **¿Es handoff de sesión / ops?** → `SESSION-HANDOFF-*.md`.  
4. **Git push** de docs/código (sin secrets).  
5. **Drive update** de docs densos (MASTERPLAN, BITACORA, satélites nuevos).  
6. **No** pegar secrets ni keys de GitGuardian/viejos tokens en ningún lado.

## 3. Monorepo privado `agent-skills` (diseño)

```
agent-skills/   (private, codofliess)
├── AGENTS.md
├── install.ps1          # junctions → ~/.grok/skills
├── skills/
│   ├── agent-memory-skills/
│   ├── logistics-vision-tms/
│   ├── chainlords-cdo/   # o symlink desde repo CL
│   ├── video/ ...
│   ├── cv/ ...
│   └── physical/ ...
└── shared/
```

Install: `git pull` + junctions; un edit, todos los proyectos Grok/Claude/Cursor.

## 4. Camino de aprendizaje del PO (no mezclar con CL core)

1. **SportSignature** — video de producto.  
2. **CV** — detección / clasificación.  
3. **Toolings físicos** — cámaras, latencia, captura.  
4. **Robótica** — con o sin socio; después de video+QC estable.  
5. **TMS/logística** — spin-off (ver `LOGISTICS-TMS-VISION.md`).

## 5. Anti-patrones

- Guardar solo en el chat.  
- Duplicar la misma skill en 5 carpetas sin git.  
- Meter `REALM_STATS_SECRET` / vault keys en docs.  
- Tratar Drive como backup del **código** (el código es GitHub).  
- Compilar skill sin “qué falló / no reintentar”.

---

*Append-only debajo con fecha si cambia la política.*
