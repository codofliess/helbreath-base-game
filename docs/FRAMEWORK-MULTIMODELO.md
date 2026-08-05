# Framework multi-modelo (Fable diseña → baratos ejecutan → Fable review)

> Guía **reutilizable** para cualquier repo (no solo Helbreath).  
> En este proyecto: bitácora canónica [`MASTERPLAN.md`](./MASTERPLAN.md); sesión legible [`BITACORA.md`](./BITACORA.md).  
> Contexto 2026-07-10: **Fable pausado** (factura); usar **Composer / Grok** para ejecución `[cheap]` sin bloquear.

---

## 1. Principio

| Rol | Modelo típico | Hace | No hace |
|-----|---------------|------|---------|
| **Arquitecto / Reviewer** | Fable (u otro “caro” de diseño) | Visión, descomposición, contratos, review de PRs, decisiones de producto | CRUD mecánico, CSS, scripts boilerplate, docs largas |
| **Ejecutor** | Grok / Composer / similares **baratos o incluidos** | Implementar tareas etiquetadas `[cheap]`, tests, docs, wiring según spec | Inventar arquitectura nueva sin spec; cambiar decisiones de producto |
| **Humano** | — | Prioridad, merge, secrets, “go/no-go” legal (apuestas, tokens) | — |

**Regla de oro:** no pedirle a Fable lo que un modelo barato puede hacer con una spec de 1 página. Fable escribe la spec; el barato pega el código; Fable (cuando vuelva) revisa el diff.

---

## 2. Etiquetas de tarea

Usar en MASTERPLAN / issues / prompts:

| Tag | Significado | Quién |
|-----|------------|-------|
| `[fable]` | Diseño, API contracts, seguridad, anti-cheat, product calls | Fable (o humano si Fable offline) |
| `[cheap]` | Implementación acotada siguiendo spec existente | Grok / Composer |
| `[human]` | Secrets, deploy prod, legal, pagos | Solo humano |
| `[blocked]` | Espera decisión o dependencia externa | Nadie codea hasta desbloquear |

Si una tarea `[cheap]` requiere una decisión no documentada → **parar** y append en Decisiones del MASTERPLAN (o ping humano), no improvisar.

---

## 3. Flujo de trabajo (copy-paste mental)

```
1. Fable (o humano) actualiza MASTERPLAN: visión + checklist + spec corta de la feature
2. Humano abre chat con modelo barato y pega plantilla "Ejecutor"
3. Ejecutor implementa SOLO el alcance; actualiza checkboxes del MASTERPLAN
4. (Opcional) segundo barato hace smoke test / lint
5. Fable review: plantilla "Reviewer" sobre el diff
6. Humano merge
```

**Paralelismo:** varios chats baratos en el mismo repo, cada uno con **alcance de archivos distinto** (ej. uno middleware, otro CSS client). Evitar dos agentes tocando el mismo `.cs` / mismo proto a la vez.

**Fable offline:** las tareas `[fable]` pendientes se dejan marcadas; se puede avanzar solo `[cheap]` cuya spec ya esté en el MASTERPLAN. No inventar Fase D sin decisión.

**Bugs visuales / gameplay (anti-brecha Grok↔Fable):** después de cada fix de un ejecutor barato, correr el **Agente de verificación / adversarial review** (§ 3.1) antes de marcar el bug como done.

---

## 3.1 Agente de verificación / adversarial review (obligatorio en bugs UI/gameplay)

Grok/Composer **no** marcan un bug visual o de gameplay como done sin un segundo pass adversarial. Fable hace este rol cuando está disponible; si no, un **segundo agente explore/review** (modelo cheap) revisa solo el diff del primero.

### Checklist del verificador

- [ ] ¿El cambio está en el **path hot real** (call site de render/input/update), no en un helper muerto o un comentario?
- [ ] ¿Hay **otra code path** que dibuje/dispare lo mismo (fallback, placeholder, lazy load, remote vs local, InitialState)?
- [ ] ¿**Server + client** en sync (proto, equipped, persistencia, seed loadout)? Hard-refresh no basta si el server re-envía estado malo.
- [ ] ¿Se reinició lo necesario (server / client / regeneración proto)?
- [ ] ¿Hay **evidencia en código** (snippet del early-return / “no se llama al render”), no solo “debería funcionar”?

### Regla dura para Grok (ejecutor)

En bugs UI/gameplay, el reporte de done **debe** incluir:

1. Cita del **call site** de render o input (path + líneas).
2. Confirmación explícita de que **no queda path alternativo** (grep de fallbacks / placeholders / seeds).

Si falta (1) o (2) → el bug **sigue abierto**.

### Cuándo usar segundo agente (Fable offline)

```
1. Agente A (Grok) implementa el fix
2. Agente B (explore/review, cheap) recibe SOLO el diff + plantilla VerifyFix
3. B busca paths alternativos y contradicciones server/client
4. Si B encuentra huecos → A corrige; no se marca done
```

### Plantilla copy-paste: VerifyFix

```text
Rol: Agente de verificación / adversarial review (NO implementes features nuevas).
Contexto: el ejecutor dice haber fixeado: <bug en 1 línea>.
Diff / archivos tocados: <lista o pegá el diff>.

Checklist (respondé sí/no + evidencia):
1) ¿El cambio está en el path hot real? Citá el call site de render/input.
2) ¿Queda otra code path (fallback, placeholder, lazy load, remote, InitialState, seed)?
3) ¿Server y client en sync? ¿Persistencia / SeedInitialLoadout / traveler loadout pueden reintroducir el bug?
4) ¿Hace falta reiniciar server/client?
5) ¿Hay evidencia en código de que sin la condición el render/input NO corre (early-return o no se construye el sprite)?

Regla: si no podés citar (1) y descartar (2), el fix NO está done.
Salida: PASS con snippets, o FAIL con la path alternativa concreta a cerrar.
No tocar: <paths prohibidos, ej. spells>
```

---

## 4. Control de costos

### Checklist antes de abrir un chat “caro”

- [ ] ¿La tarea está etiquetada `[fable]` de verdad, o es `[cheap]` disfrazada?
- [ ] ¿Hay spec en MASTERPLAN / issue con paths y criterios de aceptación?
- [ ] ¿Puede Composer/Grok hacerlo con esa spec en &lt;1 sesión?
- [ ] ¿Estoy pagando Fable “de gusto” por docs, renames, o CSS?

### Heurística

| Tipo de trabajo | Modelo |
|-----------------|--------|
| “Escribí MASTERPLAN / README / checklist” | `[cheap]` |
| “Implementá endpoint CRUD según schema.sql” | `[cheap]` |
| “Diseñá anti-double-mint y threat model” | `[fable]` |
| “Regenerá proto y cableá un campo nuevo en 3 capas” | Spec `[fable]` corta + exec `[cheap]`, o todo `[fable]` si el contrato es ambiguo |
| “¿Apuestas de espectadores?” | `[human]` + Decisiones — **ya eliminadas en Helbreath** |
| Review de PR grande / seguridad | `[fable]` |

### Durante Fable pausado

1. No esperar: ejecutar backlog `[cheap]`.
2. Acumular preguntas de diseño en § Evaluaciones o una lista “Preguntas para Fable” al final del MASTERPLAN (append).
3. Al reactivar Fable: una sola sesión de review del diff acumulado + decisiones pendientes (más barato que micro-pings diarios).

### Verificar que “gratis” sea gratis

- Confirmar en la UI de Cursor / plan qué modelos consumen quota de pago.
- Si Grok/Composer pasan a cobrarse: actualizar este doc y el MASTERPLAN (append Decisión).
- No asumir: **chequear** antes de sesiones largas.

---

## 5. Estructura estándar de un MASTERPLAN.md

Todo proyecto que use este framework debería tener un `docs/MASTERPLAN.md` con **estas secciones** (nombres pueden traducirse; el orden ayuda a otros agentes):

1. **Visión** — qué es / qué no es; pilares; fuera de alcance  
2. **Arquitectura** — diagramas + **paths reales del repo**  
3. **Changelog fechado** — qué entró al repo y cuándo  
4. **Roadmap por fases** — checkboxes + tags `[fable]` / `[cheap]`  
5. **Decisiones (append-only)** — tabla fecha / decisión / contexto  
6. **Evaluaciones externas (APPEND-ONLY)** — formato fijo + log  
7. **Rollback** — cómo deshacer features peligrosas  
8. **Cómo usar este doc** — 4–5 bullets operativos  

Opcional: referencias rápidas (tabla path → tema).

**Reglas de edición del MASTERPLAN**

- Decisiones y Evaluaciones: **solo append**.
- Checkboxes y Changelog: sí se actualizan (marcar hecho, agregar línea nueva).
- Visión/Arquitectura: editar con cuidado; si hay conflicto, nueva Decisión que supersede.

---

## 6. Plantillas copy-paste

### 6.1 Brief para Fable (diseño)

```text
Contexto: leé docs/MASTERPLAN.md (visión + fase actual).
Rol: arquitecto. NO implementes código de juego todavía.
Entregable:
1) Spec de la feature en bullets (contratos, tablas, mensajes proto si aplica)
2) Lista de tareas etiquetadas [fable] vs [cheap]
3) Riesgos / rollback
4) Append de decisión si cambió producto
Repo: <path>
No tocar: <paths prohibidos si aplica>
```

### 6.2 Brief para ejecutor barato (Grok / Composer)

```text
Leé docs/MASTERPLAN.md sección Roadmap fase <X> y la spec de: <feature>.
Rol: ejecutor [cheap]. Implementá SOLO:
- <bullet 1>
- <bullet 2>
Paths permitidos: <lista>
NO edites: <lista> (ej. no rediseñar Progression.json sin pedirlo)
Al terminar:
1) Actualizá checkboxes en MASTERPLAN
2) Una línea en Changelog
3) Si la sesión fue larga: refrescar docs/BITACORA.md (1 página)
3) No commits salvo que el humano lo pida
Criterios de aceptación:
- <test manual o comando>
```

### 6.3 Brief de review (Fable u otro)

```text
Review del diff de <rama o descripción>.
Contrato: docs/MASTERPLAN.md + proto/schema si aplica.
Buscá: regresiones, persistencia incorrecta, double-spend/mint, torneo loadout leak al char real, apuestas espectador (deben seguir ausentes).
Formato de salida: pegá una Evaluación APPEND en MASTERPLAN §6 (plantilla del propio MASTERPLAN).
No reescribas el MASTERPLAN entero.
```

### 6.4 Handoff entre chats (mismo día)

```text
Handoff:
- Hecho: <lista>
- Pendiente [cheap]: <lista>
- Bloqueado [fable]/human]: <lista>
- Archivos tocados: <lista>
- Cómo probar: <pasos>
MASTERPLAN actualizado: sí/no
```

### 6.6 VerifyFix (adversarial, post-fix UI/gameplay)

```text
Rol: Agente de verificación / adversarial review (NO implementes features nuevas).
Contexto: el ejecutor dice haber fixeado: <bug en 1 línea>.
Diff / archivos tocados: <lista o pegá el diff>.

Checklist (respondé sí/no + evidencia):
1) ¿El cambio está en el path hot real? Citá el call site de render/input.
2) ¿Queda otra code path (fallback, placeholder, lazy load, remote, InitialState, seed)?
3) ¿Server y client en sync? ¿Persistencia / SeedInitialLoadout / traveler loadout pueden reintroducir el bug?
4) ¿Hace falta reiniciar server/client?
5) ¿Hay evidencia en código de que sin la condición el render/input NO corre?

Regla: sin citar (1) y descartar (2), el fix NO está done.
Salida: PASS con snippets, o FAIL con la path alternativa concreta.
```

---

## 7. Anti-patrones

| Evitar | Por qué |
|--------|---------|
| Dos agentes editan el mismo proto a la vez | Conflictos y contratos rotos |
| Ejecutor “mejora” la visión (ej. reintroduce apuestas) | Viola Decisiones |
| Fable para generar solo markdown de bitácora | Desperdicio; usar `[cheap]` |
| MASTERPLAN sin paths reales | El siguiente modelo alucina carpetas |
| Borrar evaluaciones viejas | Se pierde trazabilidad |
| Commit automático del agente | Solo si el humano lo pide |
| Marcar bug UI “done” sin call site + sin descartar paths alternativos | Brecha Grok↔Fable; ver § 3.1 VerifyFix |

---

## 8. Aplicación en Helbreath (resumen)

| Ahora (Fable pausado) | Después (Fable activo) |
|----------------------|-------------------------|
| Composer/Grok: cerrar Fase C `[cheap]` (middleware torneos, UI, decay job) | Fable: review seguridad torneo + premios custodial |
| No abrir apuestas espectador | Confirmar que sigue CANCELADO en Decisiones |
| Docs / MASTERPLAN updates = `[cheap]` | Sesión Fable batch-review del acumulado |

Detalle de producto y checkboxes: **[`MASTERPLAN.md`](./MASTERPLAN.md)** (borrador v0.9).  
Cola de decisiones abiertas para cuando vuelva Fable: **MASTERPLAN § 10 — Cola de críticas para Fable 5**.

---

## 9. Versionado de este framework

- Este archivo **sí** se puede editar in-place (es guía operativa, no bitácora append-only).
- Cambios grandes de política de modelos → también append una Decisión en el MASTERPLAN del proyecto.
