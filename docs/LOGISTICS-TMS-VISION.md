# Visión TMS / logística con visión + etiquetas

> **Spin-off / aprendizaje** — no es core Chain Lords.  
> Capturado 2026-08-06 desde sesión Grok (interrupción deliberada antes de volver a CL).  
> Relacionado: SportSignature (video), skills CV, futuro monorepo `agent-skills`.

## 1. Problema

Depósitos altos: escanear cajas a mano en niveles superiores es lento, caro y riesgoso.  
Pallets enfilmados de alto valor (USD 2k–10k) no se “ven” bien solo con cámara.

## 2. Tech ya existe

| Capa | Ejemplos / estado |
|------|-------------------|
| Visión en warehouse | Detección pallet/caja, conteo, safety; mercado CV warehousing en crecimiento |
| Drones inventory | Cycle count en pasillos altos (lectura etiqueta + foto) |
| Barcode/QR | Maduro, barato |
| RFID UHF | Portales, muchos tags a la vez |
| BLE / UWB | Zonas / ubicación de activos caros |
| Retail shelf vision | Análogo “góndola” (no idéntico a depósito) |

**Patrón ganador:** híbrido **etiqueta + sensor/lectura + cámara como evidencia**, no “solo IA mira y adivina el stock”.

## 3. Arquitectura propuesta (capas)

```
[ Fábrica ]
  serial + QR (+ opcional glyph familia) en caja
       ↓
[ Muelle / container ]
  portal RFID o scan QR → remito digital con thumbs
       ↓
[ Stock sistema ]
  ubicaciones lógicas  pasillo-nivel-posición
       ↓
[ Pallets valor 2k–10k ]
  BLE beacon o RFID → zona / última vista
       ↓
[ Cycle count ]
  2 drones (redundancia) → QR + foto + morfología si layout regular
       ↓
[ Excepciones ]
  humano solo si no matchea remito / no lee tag / hueco vacío
```

### 3.1 Drones ×2

- **Por qué dos:** spare + turnos de batería, no necesariamente vuelo en pareja.
- **Carga útil:** cámara RGB + decoder QR; opcional distancia (ToF/lidar corto).
- **Indoor:** sin GPS fiable → SLAM / UWB / marcadores de pasillo.
- **Límites:** polvo, cables, gente, film arrugado, mix de SKU → confianza baja → cola humana.
- **Producto:** “cierra cycle count + evidencia”, no reemplaza WMS entero.

### 3.2 Pallets enfilmados de valor

| Opción | Uso |
|--------|-----|
| RFID UHF | Portal muelle / inventarios de paso |
| BLE beacon | Zona en app, barato |
| UWB | Precisión mayor, más caro |
| Solo cámara | Débil con film y oclusión |

Costo del tag ≪ valor del pallet.

## 4. Mejora de **input** (prioridad #1)

El 80% del ROI está en **cómo entra** el inventario, no en el drone.

### 4.1 Origen (fábrica)

- Servicio: fábrica pega QR en cada caja, **o**
- Impresión unificada: **número de serie + QR** en la misma etiqueta.
- Payload QR ejemplo: `SKU | lote | serial | qty | PO | factory_id | ts`.

### 4.2 Remito repensado

Por línea de ítem:

| Columna | Contenido |
|--------|-----------|
| Texto | desc + qty |
| Imagen **familia** | pictograma / foto de familia de producto |
| Imagen **identidad** | QR o glyph del serial / unidad |
| Evidencia recepción | thumbnail de lo leído al ingresar |

### 4.3 Glyph geométrico B/N

- Círculo con líneas / cuerpos geométricos, monocromo.
- ID **visual offline** robusto y imprimible.
- **No requiere** blockchain.

### 4.4 cNFT Solana (opcional)

| Sí (piloto) | No (día 1) |
|-------------|------------|
| Hash de remito / batch export / disputa multi-parte | Cada caja pyme on-chain |
| Pallet premium con audit Web3 | Base del WMS |

Reutilizar tooling Chain Lords solo si hay **comprador** del ancla on-chain.

## 5. MVP roadmap

| Fase | Entrega |
|------|---------|
| 0 | QR en caja + remito digital con familia + serial |
| 1 | App recepción: scan vs remito + fotos |
| 2 | Beacon/RFID en pallets de valor |
| 3 | 1 drone piloto, un pasillo |
| 4 | 2º drone + rutas |
| 5 | Hash/cNFT opcional de remitos premium |

## 6. Encaje con stack del PO

- **Video** (SportSignature, HyperFrames) → pipeline de frames y evidencia.
- **CV** (detección/clasificación) → caja/pallet/persona en zona.
- **Solana** → solo capa opcional de ancla.
- **Skills:** `logistics-vision-tms`, `video-pipeline`, futuro monorepo `agent-skills`.

## 7. Fuera de alcance (explícito)

- Reemplazar WMS enterprise day-0.
- Conteo 99.99% de piezas sueltas sin etiqueta.
- Drone 24/7 sin operación humana de batería/seguridad.

---

*Append-only: nuevas decisiones de producto de logística van abajo con fecha.*
