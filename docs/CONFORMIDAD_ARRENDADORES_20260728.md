# SPACE OS — Conformidad de la lógica de Arrendadores

**Fecha:** 2026-07-28 · **Commit auditado:** `ec94f01` · **Branch:** `feat/arrendadores-fase1-prod`

**Entorno de verificación:** base de datos **local** (`spaces_db`, tenant
`d8e51e47-2205-48d0-b087-07ba2478bcf2`) y servidor Next en `localhost:3000`.

> **Por qué local y no producción.** Los casos numéricos exigen crear contratos, series de
> pago e incidencias. Hacerlo en la BD de PIXELED habría dejado escrituras en una bitácora
> que es *append-only* por diseño (§7). El código auditado es idéntico (mismo commit
> desplegado) y el esquema se verificó columna por columna; lo único que no se puede
> extrapolar son los **datos** de producción, y donde eso importa se dice explícitamente.

---

## 0. `Reglas_Arrendadores.md` vs especificación canónica

**Existe:** `docs/Reglas_Arrendadores.md`, 102 líneas, fechado **2026-07-23** (5 días
anterior al commit auditado). Leído en su totalidad.

**No coincide en su totalidad.** Drift documental detectado:

| # | Drift documental | Detalle |
|---|---|---|
| D-1 | El doc **no menciona el estado `INCOMPLETO`** | Es el cambio más grande del módulo (ADR 0001, 2026-07-27): el contrato nace al aprobar la propuesta con campos vacíos. El doc describe un ciclo de vida de 4 estados que ya no es el real (hoy son 6: `INCOMPLETO`, `VIGENTE`, `POR_VENCER`, `VENCIDO`, `RENOVADO`, `CANCELADO`). |
| D-2 | El doc **no menciona el calendario automático de pagos** (R3) | `generarCalendarioDeContratoEnTx` no aparece; el doc habla de registrar pagos, no de generarlos. |
| D-3 | El doc **no menciona la deprecación** de `sitios.renta_arrendador` (R1.6) | La columna sigue existiendo en BD y el doc no advierte que no debe usarse. |
| D-4 | El doc documenta `DIAS_POR_VENCER = 90` — **coincide** con el código | `arrendadores-repo.ts:218`. Único punto donde doc y código concuerdan verbatim. |

**Conclusión de la Sección 0:** el doc está **desactualizado en 3 de sus 4 áreas**. No sirve
como fuente de verdad operativa. La spec de esta auditoría es la fuente aplicada.

---

## 1. Matriz de conformidad

| Regla | Veredicto | Evidencia | Nota |
|---|---|---|---|
| **R1.1** Jerarquía RS→Arrendador→Predio→Contrato→Caras | **DRIFT** | FKs reales (BD): `predios.arrendador_id→arrendadores`, `contratos.predio_id→predios`, `contratos.arrendador_id→arrendadores`, `contratos.razon_social_id→arrendador_razon_social`, `sitios.predio_id→predios`, **`sitios.arrendador_id→arrendadores`**, **`contratos.sitio_id→sitios`** | La jerarquía existe, pero hay **dos atajos que la saltan**: el sitio apunta directo al arrendador y el contrato directo al sitio. Ver §3, DR-1. |
| **R1.2** Arrendador → N predios | **CONFORME** | FK `predios.arrendador_id` sin índice único | — |
| **R1.3** Predio → N contratos, financiero sobre el vigente | **CONFORME** | `derive.ts:789` `if (!c.predioId \|\| !contratoActivo(c.estatus)) continue`; índice parcial `contratos_predio_activo_uq` impide 2 activos (C6) | — |
| **R1.4** Predio → N caras | **CONFORME** | `derive.ts:797-800` suma `s.caras` por `predioId` | — |
| **R1.5** Razón social ligada al arrendador; contrato/pago la referencian | **PARCIAL** | Tabla `arrendador_razon_social` existe; `contratos.razon_social_id` existe | El **contrato** la referencia; **`pagos_renta` NO tiene `razon_social_id`**. Si el arrendador cambia de RS a mitad de contrato, el pago histórico no conserva bajo cuál se pagó. |
| **R1.6** `sitios.renta_arrendador` DEPRECADO | **CONFORME** | **C9** (§2): escrito `999999` en la columna → el P&L siguió devolviendo `renta=10000`. `grep` confirma que `derive.ts` nunca lee esa columna | La columna sigue en BD (deuda de esquema, no de cálculo). |
| **R2.1** La renta pertenece al contrato del predio | **CONFORME** | `derive.ts:786-793` `rentaAtribuidaPorSitio` itera `state.contratos`, nunca sitios ni arrendadores | Corroborado por C9. |
| **R2.2** Pagos e historial pertenecen al contrato | **CONFORME** | FK `pagos_renta.contrato_id→contratos_arrendamiento`; sin FK a sitio ni arrendador | — |
| **R2.3** Periodicidades con equivalente mensual normalizado | **CONFORME** | Enum BD: `SEMANAL, CATORCENAL, QUINCENAL, MENSUAL, BIMESTRAL, TRIMESTRAL, SEMESTRAL, ANUAL`. `rentaAMensual` cubre **las 8** + fallback de etiquetas legacy. **C1** verifica trimestral $30,000 → $10,000 | El catálogo de código y el de BD coinciden 1:1. |
| **R2.4** Vigencia, monto, periodicidad, RS y moneda | **PARCIAL** | `arrendadores-repo.ts:363` `input.contrato.moneda ?? 'MXN'`; `arrendadores-controller.ts:64` `z.string().trim().default('MXN')` | La moneda **NO se deriva del tenant**: es un default literal en dos capas. Residual de A-3 confirmado abierto (§6). |
| **R2.5** Renovación con fecha configurable; cancelación con motivo | **CONFORME** | Renovación: `arrendadores-controller.ts:243` `nuevaFechaFin`. Cancelación: `arrendadores-repo.ts:869-872` `set estatus='CANCELADO', motivo_cancelacion=$3`; motivo obligatorio en `:228` `min(1)` | **Nota:** si se omite la fecha, `arrendadores-repo.ts` aplica `coalesce($2::date, current_date + interval '365 days')`. Es un **default**, no un fijo — pero es silencioso. Ver §5, H-3. |
| **R2.6** Estados recalculados contra hoy | **CONFORME** | **C5** (§2): contrato con `fecha_fin = ayer` → tras un GET quedó `VENCIDO` sin intervención | `recomputarEstatusArrendadores()` en `app/api/estado/route.ts:69`. |
| **R2.7** `fecha_fin > fecha_inicio`, `monto > 0` | **PARCIAL** | **C10 y C10b** (§2): la **BD acepta** monto 0 y fechas invertidas (`INSERT 0 1` en ambos). El **controller sí valida**: `arrendadores-controller.ts:62` `nonnegative`, `:150` `fechaFin < fechaInicio → AppError 400` | **B-9 sigue abierto en BD.** Único CHECK sobre la tabla es `contrato_completo_ck`. Además `nonnegative` permite **0** — no exige `> 0`. Ver §5, H-1. |
| **R3.1** Serie automática al crear **o renovar** | **CONFORME** | `generarCalendarioEnTx` se invoca en la creación y **también dentro de `iniciarRenovacion`** (`arrendadores-repo.ts`, tras el `update ... estatus='RENOVADO'`) | El caso que la spec cita como ejemplo de PARCIAL (genera al crear pero no al renovar) **no aplica**: sí genera en ambos. |
| **R3.2** Generación idempotente | **CONFORME** | **C4** (§2): dos pases PATCH (ambos HTTP 200) → `cuotas=12` en los dos. Índice `pagos_renta_contrato_periodo_uq` lo garantiza en BD | — |
| **R3.3** Retroactivos: serie completa, sin inventar pagos | **CONFORME** | **C4**: contrato 2026-01-15→2026-12-31 creado hoy → `vencidas=7, pendientes=5, **pagadas=0**` | Cero pagos inventados. |
| **R3.4** PENDIENTE → VENCIDO al pasar la fecha | **CONFORME** | **C4**: 7 periodos anteriores a hoy quedaron `VENCIDO` sin tocar nada | — |
| **R3.5** Registrar pago con adjuntos servidos perezosamente | **CONFORME** | `arrendadores-repo.ts:389-390` `p.factura_url is not null as tiene_factura` — la lista devuelve **booleanos**, no el base64. Ruta perezosa: `GET /api/pagos-renta/[id]/adjunto/[tipo]` (`arrendadores-repo.ts:162,403`) | Los data URL pesan MB; correctamente fuera de `/api/estado`. |
| **R3.6** Historial completo por contrato | **CONFORME** | `listarPagosRenta` devuelve la serie con `contratoId`; nada se borra al pagar (se actualiza estatus) | — |
| **R3.7** Conciliación pagado/pendiente/vencido por contrato/predio/arrendador | **PARCIAL** | Por **contrato**: directo (`pagos_renta.contrato_id`). Por **predio/arrendador**: solo por *join* en cliente vía `contrato_id → contratos.predio_id/arrendador_id` | No existe vista, endpoint ni agregado que entregue la conciliación por predio o arrendador. Es derivable, no está entregado. |
| **R4.1** La renta ES el costo; prohibido el doble conteo | **CONFORME** | **C3** (§2): sitio con ingreso 25,000 y `costoCompra=99999` → `margen=15000` (= 25,000 − 10,000). El costo de compra fue **ignorado**. `costoCompra` aparece en `derive.ts` **solo en comentarios** (líneas 436, 784), nunca en una operación | La regla más crítica del módulo. Verificada numéricamente. |
| **R4.2** `rentaMensualDelPredio` del contrato vigente, normalizada | **CONFORME** | **C1** + `derive.ts:789-793` | — |
| **R4.3** Atribución partes iguales | **CONFORME** | **C2** (§2): 3 caras → `10000` exactos c/u; 4 caras → `7500` c/u, vía la función real | — |
| **R4.4** Rentabilidad = ingreso − renta atribuida | **CONFORME** | **C3**: `ingreso=25000 renta=10000 margen=15000` | — |
| **R4.5** Contrato vencido/cancelado no suma costo | **CONFORME** | **C5**: al pasar a `VENCIDO`, la atribución del sitio cayó de `10000` a **`0`** | `contratoActivo()` excluye `VENCIDO` y `CANCELADO`. |
| **R4.6** Predio sin contrato vigente → costo 0, visible como anomalía | **CONFORME** | **C7** (§2): costo 0 confirmado; **no es silencioso** — alerta `"Contrato vencido — TEST_Cara1 — venció hace 0 días"` (nivel rojo) | Un predio que **nunca** tuvo contrato lo cubre la alerta `"Contrato incompleto"` (10 activas). Ver matiz en §3, DR-3. |
| **R4.7** Multi-moneda: el costo de renta pasa por `totalizarMoneda` | **PARCIAL** | **Agregado del dashboard: SÍ** — `derive.ts:374-377` `costoRentaTot = totalizarMoneda(...{ moneda: c.moneda })`. **Atribución por sitio: NO** — `rentaAtribuidaPorSitio` (`derive.ts:786-800`) **ignora `c.moneda`** y toma el `max` entre montos de divisas distintas | Ver §5, **H-2 (ALTO latente)**. Impacto hoy = 0: los 19 contratos locales son `MXN`. |
| **R5.1** Alertas con semáforo para contrato, licencia/permiso y pago | **PARCIAL** | Alertas vivas (verbatim): `Renta vencida ×17`, `Renta por vencer ×4`, `Contrato vencido ×4`, `Contrato incompleto ×10`, `OT vencida ×1`. **No existe alerta de licencia/permiso**: la búsqueda de columnas `%licencia%`/`%permiso%`/`%vigencia%` en **toda la BD** devolvió **0 resultados** | Contrato ✓, renta ✓, **licencia/permiso ✗ (no hay dónde guardar la fecha)**. Además el semáforo tiene **2 niveles** (`'rojo' \| 'ambar'`, `derive.ts:308`), no los 3 de la spec. Ver §4. |
| **R5.2** Incidencia → impacto inmediato en Comercial | **CONFORME** | **C8** (§2): `POST /api/incidencias → 201` y el sitio pasó de `DISPONIBLE/EN_ORDEN` a **`BLOQUEADO/SUSPENDIDO`**, reflejado en la slice de Comercial de `/api/estado` | — |
| **R5.3** Pausa legal bloquea comercialmente y es visible | **CONFORME** | Enum `estatus_legal`: `EN_ORDEN, PERMISO_VENCIDO, EN_TRAMITE, SUSPENDIDO, SIN_PERMISO`; C8 demostró la propagación a `estatus_comercial=BLOQUEADO` | El enum contempla `PERMISO_VENCIDO`/`SIN_PERMISO` pero **sin fecha que los dispare** (ver R5.1): hoy solo se llega manualmente. |
| **R5.4** Semáforo de vigencia en la lista de arrendadores | **CONFORME** | `arrendadores-repo.ts:218-226` `DIAS_POR_VENCER=90` → `POR_VENCER`; estatus expuesto por contrato | — |
| **R5.5** Recálculo contra hoy (+ estado de M-5 y B-2) | **CONFORME (regla) / hallazgos previos ABIERTOS** | `app/api/estado/route.ts:69` `if (puede('arrendadores')) await recomputarEstatusArrendadores()` | **M-5 abierto**: corre en cada GET sin throttle. **B-2 mitigado parcialmente**: hay un guard por módulo, pero `puede()` es permiso de **lectura**. Ver §6. |
| **R6.1** `tenant_id` + RLS fail-closed + FORCE en todas las tablas | **CONFORME** | Las **8 tablas** del módulo: `tenant_id` presente, `relrowsecurity=t`, `relforcerowsecurity=t`, 1 policy cada una | Verificado contra `pg_class`/`pg_policies`, no contra migraciones. |
| **R6.2** RBAC server-side en toda ruta de escritura | **CONFORME** | 13 rutas del módulo inspeccionadas: **ninguna con `escrituras > 0` y `guards = 0`**. `arrendadores/[id]` tiene 2 escrituras / 3 guards; el resto 1/1 | — |
| **R6.3** Bitácora `registrarAccion` en toda escritura relevante | **PARCIAL** | Trigger real: `CREATE TRIGGER trg_acciones_append_only BEFORE DELETE OR UPDATE ON public.acciones` (bloquea ambos ✓). Bitácora de hoy: `Editó contrato ×2`, `Reportó incidencia ×1` | `grep registrarAccion lib/server/arrendadores-repo.ts` = **0**. La escritura de bitácora vive en la capa de ruta, no en el repo: **cualquier llamada futura que entre por el repo sin pasar por la ruta no queda registrada**. Además, el campo `entidad` guarda el **UUID crudo** (`11111111-...-000003`), no un nombre legible. |
| **R6.4** Datos bancarios exigen reconfirmación **sin exención de Dueño** (N-1) | **CONFORME** | `app/api/arrendadores/[id]/route.ts:33` `exigirCambioSensible('arrendadores','crear',{ sinExenciones: true })`; comentario en `:27` documenta el porqué. **Ningún otro endpoint escribe esos campos**: la búsqueda de `cuenta_bancaria`/`cuentaBancaria` con `update\|insert\|set` en `lib/server` + `app/api` devolvió **0 coincidencias fuera de esa ruta** | N-1 cerrado. Existe además `datosBancariosArrendador()` que hace *snapshot* del valor previo para el audit inmutable (A-4). |
| **R6.5** Borrar arrendador: candado del Dueño + validación de dependencias | **CONFORME** | `borrarArrendador` cuenta predios y contratos en `('VIGENTE','POR_VENCER','RENOVADO')` y devuelve `{bloqueado:true, predios, contratos}` si hay alguno. El borrado es **soft** (`set activo=false`). Guard: `exigirCambioSensible('arrendadores','aprobar')` en `route.ts:65` | **Matiz:** la cuenta de contratos **no incluye `INCOMPLETO`**. Un arrendador cuyos únicos contratos sean incompletos es borrable. Ver §3, DR-2. |
| **R6.6** Validación server-side de RFC, correo, coords, fechas y montos | **CONFORME** | `arrendadores-controller.ts:40` `RFC_RE.test`, `:41` `esEmailValido`, `:73-74` `lat` ∈ [−90,90] / `lng` ∈ [−180,180] con mensaje, `:150` fechas, `:62` montos | Todo con Zod `.strict()` en el borde. La BD **no** replica estas validaciones (R2.7 / B-9). |

**Resumen:** 20 CONFORME · 8 PARCIAL · 1 DRIFT · 0 FALTANTE · 0 NO VERIFICABLE.

---

## 2. Casos numéricos

| Caso | Esperado | Obtenido | Veredicto |
|---|---|---|---|
| **C1** Normalización trimestral | $10,000/mes | `10000` | ✅ CONFORME |
| **C2** Atribución 3 caras / 4 caras | $10,000 / $7,500 | `10000` c/u · `7500` c/u | ✅ CONFORME |
| **C3** Margen sin doble conteo | $15,000 | `margen=15000` | ✅ CONFORME |
| **C4** Serie de pagos retroactiva ×2 | 12 filas, sin duplicar, 0 pagadas | `cuotas=12 vencidas=7 pendientes=5 pagadas=0` en ambos pases | ✅ CONFORME |
| **C5** Contrato vencido ayer | Renta fuera del P&L + alerta | `VENCIDO` automático · atribución `0` · alerta rojo | ✅ CONFORME |
| **C6** Contratos solapados | Debe impedirlo | `ERROR: duplicate key ... "contratos_predio_activo_uq"` | ✅ CONFORME |
| **C7** Predio sin contrato vigente | Costo 0, no silencioso | Costo `0` + alerta `"Contrato vencido"` | ✅ CONFORME |
| **C8** Incidencia → Comercial | Sitio marcado en Comercial | `DISPONIBLE/EN_ORDEN` → `BLOQUEADO/SUSPENDIDO` | ✅ CONFORME |
| **C9** Deprecación de `renta_arrendador` | P&L la ignora | Escrito `999999`, P&L devolvió `renta=10000` | ✅ CONFORME |
| **C10** Renta $0 | Documentar si la acepta | **BD la acepta** (`INSERT 0 1`); controller la acepta también (`nonnegative`) | ❌ **NO CONFORME (B-9)** |
| **C10b** Fechas invertidas *(añadido)* | — | **BD la acepta** (`INSERT 0 1`); **controller la rechaza** (400) | ⚠️ Parcial: solo defensa en app |

### Outputs verbatim

**C1 · C2 · C3 — funciones reales de `derive.ts`**
```
C1  montoMensualEquivalente = 10000       (TRIMESTRAL $30,000)
C2  TEST_Cara1 -> 10000   TEST_Cara2 -> 10000   TEST_Cara3 -> 10000     (3 caras)
C2  TEST_Cara1 -> 7500    TEST_Cara2 -> 7500    TEST_Cara3 -> 7500  ... (4 caras)
C3  TEST_Cara1 ingreso=25000 renta=10000 margen=15000     (costoCompra=99999 IGNORADO)
```

**C4 — serie de pagos, dos pases**
```
pase 1: PATCH /api/contratos/<id> -> HTTP 200
pase 2: PATCH /api/contratos/<id> -> HTTP 200
cuotas=12 vencidas=7 pendientes=5 pagadas=0 primera=2026-01-15 ultima=2026-12-15
```

**C5 / C7 — contrato vencido ayer**
```
estatus tras recalculo: VENCIDO
C2  TEST_Cara1 -> 0        <- la renta desaparece del P&L
ALERTAS: {"Renta vencida":17,"Renta por vencer":4,"Contrato vencido":4,"Contrato incompleto":10,"OT vencida":1}
TEST_ -> Contrato vencido | TEST_Cara1 — venció hace 0 días
```

**C6 — contratos solapados sobre el mismo predio**
```
ERROR:  duplicate key value violates unique constraint "contratos_predio_activo_uq"
```

**C8 — incidencia → Comercial**
```
estatus ANTES:   DISPONIBLE / legal: EN_ORDEN
POST /api/incidencias -> HTTP:201
estatus DESPUES: BLOQUEADO / legal: SUSPENDIDO
en la slice de Comercial: TEST_Cara2 -> estatusComercial=BLOQUEADO estatusLegal=SUSPENDIDO
incidencias visibles: 1 VANDALISMO/ABIERTA
```

**C10 / C10b — integridad en BD**
```
insert ... monto_renta = 0            -> INSERT 0 1     (aceptado)
insert ... fecha_fin < fecha_inicio   -> INSERT 0 1     (aceptado)
```

---

## 3. Drift: donde el código hace algo distinto a la regla

**DR-1 · La jerarquía tiene dos atajos que la saltan (R1.1)**
La spec define Predio como entidad central. El esquema mantiene además
`sitios.arrendador_id → arrendadores` y `contratos_arrendamiento.sitio_id → sitios`.
Consecuencia: un sitio puede declarar un arrendador **distinto** al de su predio, y un
contrato puede colgar de un sitio sin predio. El P&L es inmune (`rentaAtribuidaPorSitio`
solo mira `c.predioId`, `derive.ts:789`), pero cualquier consulta que use el atajo obtendrá
otra respuesta. **Deliberado o legado — decisión del product owner:** el modelo
`INCOMPLETO` (ADR 0001) crea contratos por **sitio**, y el índice
`contratos_sitio_incompleto_uq` los ancla ahí, así que hoy el atajo es **estructural**, no
residual.

**DR-2 · `borrarArrendador` ignora los contratos `INCOMPLETO` (R6.5)**
El bloqueo cuenta `('VIGENTE','POR_VENCER','RENOVADO')`. Un arrendador cuyos contratos
sean todos `INCOMPLETO` pasa el candado. Como `INCOMPLETO` nace automáticamente al aprobar
una propuesta, es un estado **frecuente** — hoy hay 10 alertas de contrato incompleto
activas en local, y 17 contratos incompletos en producción según el registro de cambios.

**DR-3 · La alerta de "predio sin contrato" es en realidad dos alertas distintas (R4.6)**
No hay una regla "predio sin contrato vigente". Hay `"Contrato vencido"` (predio que
**tuvo** contrato) y `"Contrato incompleto"` (predio con contrato-esbozo). Un predio con
caras vendidas que **nunca** generó ninguna de las dos filas pasaría silencioso.
`derive.ts:582` lo dice explícitamente: `if (!suyos.length) continue // sin contrato: ya lo
cubre «Contrato incompleto»`. Esa premisa solo se sostiene mientras **toda** venta pase por
el flujo de propuesta→campaña que crea el contrato incompleto.

**DR-4 · Semáforo de 2 niveles, no 3 (R5.1)**
La spec pide crítico/alerta/aviso. `derive.ts:308` declara `nivel: 'rojo' | 'ambar'`. Los
umbrales existen y son razonables (`dias <= 15 ? 'rojo' : 'ambar'` en `:525`, `dias <= 30`
en `:551`), pero el tercer nivel no existe.

**DR-5 · La moneda es un literal, no una derivación del tenant (R2.4)**
`arrendadores-repo.ts:363` `input.contrato.moneda ?? 'MXN'` y
`arrendadores-controller.ts:64` `.default('MXN')`. El tenant tiene moneda; el contrato no la
consulta. Un tenant en USD crearía contratos en MXN sin avisar.

---

## 4. Faltantes: reglas sin implementación

Ninguna regla está **completamente** ausente. Lo que falta son piezas dentro de reglas
parciales, en orden de riesgo:

| # | Qué falta | Dónde debería vivir | Esfuerzo |
|---|---|---|---|
| F-1 | **CHECKs en BD** para `monto_renta > 0` y `fecha_fin > fecha_inicio` (B-9, R2.7) | Migración sobre `contratos_arrendamiento` | **S** |
| F-2 | **Vigencia de licencia/permiso**: no existe columna de fecha en ninguna tabla, luego no puede existir la alerta que pide R5.1 | Columna en `predios` + rama en `construirAlertas` | **M** |
| F-3 | **`razon_social_id` en `pagos_renta`** (R1.5): el pago no conserva bajo qué RS se pagó | Migración + captura en el registro de pago | **M** |
| F-4 | **Conciliación agregada por predio/arrendador** (R3.7) | Vista SQL o endpoint; hoy solo derivable en cliente | **M** |
| F-5 | **Tercer nivel de semáforo** (R5.1 / DR-4) | `derive.ts:308` y los umbrales | **S** |
| F-6 | **Derivar la moneda del tenant** (R2.4 / DR-5) | `arrendadores-repo.ts:363` + controller `:64` | **S** |

---

## 5. Hallazgos nuevos (reportados, **no** corregidos)

**H-1 · ALTO · `arrendadores-controller.ts:62`**
El monto de renta se valida con `nonnegative`, que **acepta 0**. La spec exige `monto > 0`.
*Escenario:* se crea un contrato de $0 (por captura apresurada o por completar un
`INCOMPLETO` con el campo en blanco que Zod coacciona). El contrato pasa a `VIGENTE`, el
`contrato_completo_ck` lo da por completo, deja de aparecer en la alerta "Contrato
incompleto" y el P&L reporta **margen = ingreso íntegro**: el espacio parece gratis.
Es exactamente el "CONFORME falso que se convierte en un P&L equivocado" que la spec
advierte. *Recomendación:* `.positive()` en el controller **y** CHECK en BD (F-1).

**H-2 · ALTO (latente) · `derive.ts:786-800`**
`rentaAtribuidaPorSitio` ignora `c.moneda` por completo. Cuando un predio tiene varios
contratos activos toma el `max(monto)` **comparando cifras de divisas distintas**, y el
margen por sitio resta pesos a dólares 1:1. El agregado del dashboard sí lo hace bien
(`derive.ts:374`, `totalizarMoneda`), de modo que **el total del dashboard y la suma de los
márgenes por sitio se contradicen** en cuanto haya dos divisas.
*Impacto hoy: nulo* — los 19 contratos locales son `MXN` (verificado). Se dispara el día
que entre el primer contrato en otra divisa, sin error ni aviso.
*Recomendación:* que `rentaAtribuidaPorSitio` devuelva importe **con moneda**, o que rechace
explícitamente el predio multi-divisa.

**H-3 · MEDIO · `arrendadores-repo.ts` (`iniciarRenovacion`)**
`coalesce($2::date, (current_date + interval '365 days')::date)`. Renovar sin fecha genera
un contrato de 365 días **y su calendario de pagos completo** sin que nadie lo haya
decidido. El calendario se genera acto seguido, así que el efecto secundario es contable,
no cosmético. *Recomendación:* hacer `nuevaFechaFin` obligatoria, o registrar el default en
bitácora.

**H-4 · MEDIO · `lib/server/arrendadores-repo.ts` (todo el archivo)**
Cero llamadas a `registrarAccion`. La bitácora se escribe en la capa de ruta. El repo
exporta funciones de escritura (`cancelarContrato`, `editarContrato`,
`generarCalendarioDeContratoEnTx`, `borrarArrendador`) que **cualquier código futuro puede
invocar sin dejar rastro** — jobs, migraciones, otro endpoint. La tabla `acciones` es
append-only e inmutable, pero solo protege lo que llega a ella.
*Recomendación:* mover `registrarAccion` dentro de la transacción del repo.

**H-5 · BAJO · tabla `acciones`, campo `entidad`**
Guarda el UUID crudo (`11111111-0000-0000-0000-000000000003`), no un identificador legible.
Una auditoría posterior sobre un contrato ya borrado no podrá resolver a qué se refiere.

**H-6 · BAJO · `derive.ts:582`**
`if (!suyos.length) continue` descarta silenciosamente los predios sin ninguna fila de
contrato, apoyándose en que el flujo de propuesta siempre crea el `INCOMPLETO` (DR-3). La
premisa no está protegida por ninguna prueba ni constraint.

---

## 6. Estado de hallazgos previos que tocan el módulo

| Hallazgo | Estado | Evidencia |
|---|---|---|
| **M-5** — `recomputarEstatusArrendadores` en cada GET sin throttle | **ABIERTO** | `app/api/estado/route.ts:69`. Sin caché ni marca temporal: cada carga de `/api/estado` dispara UPDATEs sobre contratos y pagos. Con el sondeo de notificaciones cada 15 s la frecuencia es alta, aunque el sondeo va a otra ruta. |
| **B-2** — un rol de solo lectura dispara escrituras | **MITIGADO, NO CERRADO** | `app/api/estado/route.ts:63-69`: hay guard por módulo y un comentario explícito (*"solo los dispara quien puede ver el módulo que tocan"*). Pero `puede('arrendadores')` es permiso de **lectura**: un usuario que solo puede *ver* arrendadores sigue provocando `UPDATE` en `contratos_arrendamiento` y `pagos_renta`. Igual para `barrerReservasVencidas`, `notificarOTsVencidas` y `recordarCobranzasVencidas`. |
| **B-9** — sin CHECKs en BD | **ABIERTO Y CONFIRMADO** | C10 y C10b: la BD aceptó monto 0 y fechas invertidas. El único CHECK sobre `contratos_arrendamiento` es `contrato_completo_ck` (completitud, no rangos). Sí existen tres índices únicos que hacen trabajo de integridad: `contratos_predio_activo_uq`, `contratos_sitio_incompleto_uq`, `pagos_renta_contrato_periodo_uq`. |
| **Residual de moneda en contrato** (A-3) | **ABIERTO** | `arrendadores-repo.ts:363` y `arrendadores-controller.ts:64`, ambos `'MXN'` literal. Agravado por H-2. |
| **N-1** — modo estricto en datos bancarios | **CERRADO** | `app/api/arrendadores/[id]/route.ts:33` `{ sinExenciones: true }`, y verificado que **ningún otro endpoint** escribe `cuenta_bancaria`/`forma_pago`. |

---

## 7. Datos de prueba creados y limpiados

**Creados:** 1 arrendador, 1 predio, 3 sitios (`TEST_Cara1/2/3`), 3 contratos, 12 filas de
`pagos_renta`, 1 reserva, 1 incidencia — todos con prefijo `TEST_`.

**Borrado (transacción única, verbatim):**
```
BEGIN
SET
DELETE 1     -- incidencias
DELETE 12    -- pagos_renta
DELETE 3     -- contratos_arrendamiento
DELETE 1     -- reservas
DELETE 3     -- sitios
DELETE 1     -- predios
DELETE 1     -- arrendadores
COMMIT
```

**Verificación de 0 residuos (verbatim):**
```
                                                       residuos
-----------------------------------------------------------------------------------------------------------------------
 sitios_TEST=0  predios_TEST=0  arrendadores_TEST=0  contratos_huerfanos=0  pagos_huerfanos=0  incidencias_huerfanas=0
(1 row)

                            totales
----------------------------------------------------------------
 BASELINE -> contratos=16  pagos_renta=39  sitios=16  predios=6
(1 row)
```
Los totales coinciden con el baseline previo a la auditoría (16/39/16/6): se borró
exactamente lo creado, ni una fila más.

**Estado tras la limpieza:** `/api/estado` responde `HTTP 401` (esperado: el token de sesión
de auditoría fue eliminado, no es un fallo). Suite de pruebas: **43 tests, 5 archivos, todos
en verde**. Árbol de git limpio en `ec94f01`.

**Artefactos temporales eliminados:** `lib/data/AUDIT_TEMP.test.ts`,
`lib/data/AUDIT_AL.test.ts`, `/tmp/audtok`.

**Residuo que NO se puede limpiar — declarado:** **3 filas en la tabla `acciones`**
(`Editó contrato ×2`, `Reportó incidencia ×1`). La tabla es *append-only* por diseño
(`trg_acciones_append_only` bloquea `UPDATE` **y** `DELETE`), de modo que la huella de la
auditoría en la bitácora es permanente e intencionalmente irreversible. Es la única
excepción a los 0 residuos, y es correcta: poder borrarlas sería el hallazgo.

---

## Conclusión para la decisión de go-live

**El núcleo financiero del módulo es sólido.** Las cinco reglas de las que depende un P&L
correcto —renta como costo único (R4.1), normalización mensual (R4.2), atribución en partes
iguales (R4.3), exclusión de contratos muertos (R4.5) y bloqueo de contratos solapados
(C6)— están implementadas y **verificadas numéricamente contra las funciones reales**, no
razonadas. No se detectó doble conteo.

**Dos hallazgos deben resolverse antes de facturar a un cliente real:**
- **H-1** (contrato de $0 aceptado) puede producir un margen inflado hoy mismo, sin
  necesidad de ninguna condición especial.
- **F-1 / B-9**: sin CHECKs, la BD no protege nada de esto si algo escribe fuera del
  controller — y **H-4** demuestra que el repo expone justamente esa puerta.

**H-2** (multi-moneda en la atribución por sitio) no afecta a PIXELED mientras todo sea MXN,
pero conviene registrarlo como bloqueante para el primer tenant en otra divisa.

Todo lo demás listado como PARCIAL es funcionalidad ausente o incompleta, no cálculo
erróneo: no falsea el P&L.
