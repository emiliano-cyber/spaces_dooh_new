# SPACES OS
## Informe de auditoría — cierre pre go-live · PIXELED / G500

**Fecha:** 08/07/2026 · **Alcance:** flujo comercial end-to-end, features nuevas y endurecimiento de seguridad · **Método:** batería automatizada (39 verificaciones) contra local (mismo código que producción) y contra `spaces_prod`.

---

## 1. Veredicto

> ## ✅ APROBADO — 39/39 verificaciones en verde
>
> Los 3 defectos críticos y los 6 importantes del plan cumplen sus criterios de aceptación en producción. Un hallazgo cosmético no bloqueante (detallado en §6), ya corregido.

---

## 2. Sprint 0 — Bloqueantes (críticos)

| ID | Criterio de aceptación | Resultado |
|----|------------------------|-----------|
| **S0-1** | Snapshot económico inmutable: Total aceptado = Total campaña = Total factura (**$129,920** con desc. 20% + comisión 10%). Rentabilidad = neto del snapshot ($100,800). Bitácora con versión. | ✅ PASS |
| **S0-2** | Registrar abono parcial actualiza el saldo; liquidar cambia la factura a **Pagada** y detiene recordatorios; abono negativo rechazado. | ✅ PASS |
| **S0-3** | Motor gobernado por tipo de medio: segunda reserva traslapada en pantalla estática **bloqueada (409)** con mensaje claro. | ✅ PASS |

## 3. Sprint 1 — Importantes

| ID | Criterio de aceptación | Resultado |
|----|------------------------|-----------|
| **S1-1** | Fechas invertidas (fin < inicio) rechazadas en backend: propuestas, reservas y OTs. | ✅ PASS |
| **S1-2** | Aprobar una propuesta con Total $0 exige confirmación explícita (409) y queda en bitácora. | ✅ PASS |
| **S1-3** | Liga pública por **token aleatorio**: `token → 200`, `folio → 404`, `id → 404` (folio enumerable ya no abre propuestas ajenas). | ✅ PASS |
| **S1-4** | Registro de OC captura número de OC del cliente, monto, fecha y documento. | ✅ PASS |
| **S1-5** | Crear OT exige **fecha compromiso**; asignación de responsable disponible. | ✅ PASS |
| **S1-6** | Costo de espacios en Rentabilidad marcado como **"estimado"** cuando no hay contrato que lo respalde. | ✅ PASS |

## 4. Features nuevas + Endurecimiento de seguridad

| Área | Verificación | Resultado |
|------|-------------|-----------|
| Red compartida de pantallas | Pantalla de otro CRM visible en el catálogo, con **costo interno oculto** y operador dueño mostrado. | ✅ PASS |
| Anti-duplicados | Alta/import de una pantalla que ya es de otro operador → **409 "Esas pantallas son de alguien más"**. | ✅ PASS |
| Contraseñas | Cifrado **bcrypt** (cost 10); política (min 8 + letra + número); contraseña débil → 400; el hash **nunca** se expone al front; login inválido → 401; rate-limit anti fuerza bruta. | ✅ PASS |
| Backend por capas | `ruta → controller (validación zod) → model (SQL parametrizado)` en ~40 endpoints; entrada inválida rechazada; errores mapeados sin filtrar internals. | ✅ PASS |
| Aislamiento multi-tenant | Un CRM no ve datos (campañas/clientes/finanzas) de otro; el catálogo de pantallas es la única capa compartida y sin costos. | ✅ PASS |

## 5. Estado de producción (`spaces_prod`)

| Verificación | Resultado |
|-------------|-----------|
| Migraciones aplicadas: `numero_oc`, `snapshot_economico`, `token_publico` | ✅ |
| Espectaculares estáticas (exhibición fija, 1 cara) · **0 pantallas rotativas con slots** | ✅ 13 |
| Inventario íntegro: 12 pantallas G500 + 3 nuevas (importadas por el operador `eyro`) | ✅ 15 |
| Todas las propuestas con token de liga pública | ✅ 0 sin token |
| Endpoints: liga por folio → 404 · signup con contraseña débil → 400 · login inválido → 401 | ✅ |

## 6. Hallazgo (no bloqueante) — ya corregido

Durante la auditoría se detectó que un **re-import del inventario G500** (08/07 13:09) sobrescribió la metadata `exhibicion/total_spots` con los valores del archivo (rotativo/12 slots), deshaciendo la reclasificación a estática.

- **Impacto funcional:** ninguno. El motor de reservas y la vista de Disponibilidad deciden por **tipo de medio** (ESPECTACULAR → estático), no por esa metadata, por lo que el doble-booking siguió bloqueado en todo momento.
- **Acción:** se re-aplicó la reclasificación; la metadata quedó consistente (fija / 1 cara).
- **Recomendación (follow-up, no urgente):** que el importador **respete el tipo de medio** al dar de alta/actualizar, para que un futuro re-import no vuelva a desalinear la metadata.

## 7. Criterio de go-live

| Requisito del plan | Estado |
|--------------------|--------|
| S0-1, S0-2, S0-3 en verde (criterios al 100%) | ✅ |
| S1-1 (fechas) y S1-4 (OC real) en verde | ✅ |
| Aislamiento multi-tenant y de roles | ✅ verificado |
| Contraseñas cifradas + validación de entrada | ✅ |
| Cambios desplegados en el droplet productivo | ✅ |

> **Conclusión:** SPACES OS pasa la auditoría de cierre. El sistema es apto para go-live de PIXELED en G500, con el follow-up del importador (§6) atendible en el primer sprint post-lanzamiento.

---

*SPACES OS · Informe de auditoría de cierre · 08/07/2026 · Confidencial — uso interno RGB Catorce / AS OOH Enterprise*
