---
tipo: arquitectura
estado: verificado
actualizado: 2026-10-05
tags: [adr, decisiones, reglas-de-negocio]
archivos:
  - docs/adr/
  - apps/web/lib/server/cambios.ts
  - apps/web/lib/server/db.ts
  - apps/web/lib/server/folios.ts
---

# Decisiones de diseño

> [!warning] 2026-09-18 · esta nota llevaba ONCE ADR de retraso
> Listaba hasta el `0024` con fecha del 27/08, mientras `docs/adr/` iba por el
> `0035`. **Es la nota cuyo trabajo ES indexar decisiones**, así que su retraso
> no es un detalle: quien la abriera para saber qué se ha decidido se llevaría
> once decisiones menos, incluidas las dos que definen el módulo que se presenta
> el 14 de octubre.
>
> Se completó midiendo `docs/adr/` en vez de releyendo. El recuento sale de
> `node scripts/recuentos.mjs`.

> [!warning] 2026-10-05 · y volvió a pasar: SEIS ADR de retraso
> La tabla terminaba en el `0036` mientras `docs/adr/` iba por el `0042`
> (`node scripts/recuentos.mjs`: **42, hasta 0042**). Faltaban las dos de la
> flota del 21-22/09 y **las cuatro de la cadena de precio y la venta** que se
> enseñan el 14/10. Añadidas abajo, leyendo cada ADR. Y aparecieron dos
> desfases entre el **estado escrito** del ADR y el código, que se anotan en su
> fila en vez de corregir el ADR (un ADR no se edita para cambiar su historia).
## ADR formales

Viven en `docs/adr/`. **Un ADR aceptado no se edita para cambiar la decisión**:
se escribe uno nuevo que lo reemplace (`~/.claude/skills/eng-architecture`).

| # | Decisión | Estado | Impacto en código |
|---|---|---|---|
| 0001 | Contrato "incompleto" al generar la campaña | Aceptada | `est_contrato` incluye `INCOMPLETO` (`20260727_contrato_incompleto_enum.sql`) |
| 0002 | Arrendador obligatorio al alta de pantalla | Aceptada | [[inventario-y-sitios]] |
| 0003 | No reservar con contrato incompleto | Aceptada | [[comercial-propuestas-campanas]] |
| 0004 | Periodicidad de renta DIARIA | Aceptada | `20260729_periodicidad_diaria.sql` |
| 0005 | Recordatorios proporcionales a la cadencia | Aceptada | `lib/recordatorios-contratos.ts` |
| 0006 | **Un solo costo por pantalla: la renta al arrendador** | Aceptada | `costo_compra` no es un costo aparte |
| 0007 | Vencimientos anclados al inicio del contrato | Aceptada | `20260728_calendario_contratos_existentes.sql` |
| 0008 | Cupo de clientes por pantalla | Aceptada | `sitios.max_clientes`, `config_negocio.max_clientes_pantalla` |
| 0009 | **Reautenticación individual** | Aceptada, enmendada por `0036` | `lib/server/cambios.ts` — ver [[autenticacion-y-sesion]] |
| 0010 | Catálogo explícito de módulos, retiro del rol `CLIENTE` | Aceptada | `lib/modulos.ts`; el enum aún lo tiene |
| 0011 | `config_negocio` por tenant | **Propuesta** | Ya implementado: la tabla se declara en `db/schema.sql:108` y su `tenant_id`, índice único y RLS se añaden en el bloque `:643-674` |
| 0012 | **Acceso con cuenta de Google** | Aceptada + **enmendada el 07/08** | [[flujo-acceso-con-google]] |
| 0013 | **Altas que no se pueden duplicar** | Aceptada | `arrendadores_tenant_rfc_uq` (`20260810_arrendadores_rfc_unico.sql`); el nombre repetido avisa con 409 y se puede confirmar — ver [[arrendadores-y-contratos]]. Su espejo para `clientes` llegó el 26/08 con `20260826_clientes_rfc_unico.sql`, **escrita y sin aplicar** ([[migraciones]]) |
| 0014 | Postgres **en el droplet**, no base administrada | **Propuesta** (21/08) | Ninguno todavía. Toca el aprovisionamiento (F8.1), no la app |
| 0015 | DEMO vive **dentro** del PADRE | ~~Aceptada~~ → superada por el 0016 → **restablecida por el 0017** | `infra/systemd/spaces-demo.service` |
| 0016 | DEMO se queda en su propio droplet | **SUPERADA** el mismo día (25/08) por el 0017 | — |
| 0017 | **Todo se concentra en el PADRE** | Aceptada (25/08) | `infra/nginx/space-os.io.conf` sirve `space-os.io` (`:133`), `demo.space-os.io` (`:213`) y `prueba.space-os.io` (`:288`) desde la misma máquina — líneas medidas el 05/10 |
| 0018 | **Fijar la primera contraseña tras entrar con Google, sin teclear la anterior** | Aceptada — **verificada en producción el 25/08** | `sesiones.metodo` (`20260825_sesion_metodo.sql`), `crearSesion(usuarioId, metodo)` **sin default a propósito**: el comentario que lo explica está en `lib/server/auth.ts:102-106` y la función en `:107` (medido el 05/10). Ver [[flujo-acceso-con-google]] |
| 0019 | DEMO arranca con **systemd**, no con pm2 | Aceptada (25/08) | `infra/systemd/spaces-demo.service`; pm2 es inalcanzable para el usuario `demo` |
| 0020 | No hay demostración pública | **SUPERADA** el mismo día (26/08) por el 0021 | — |
| 0021 | ~~`demo.space-os.io` se queda~~ **SUPERADA por el 0024 (27/08)** | Aceptada (26/08) | `infra/nginx/space-os.io.conf:188` (hoy `:213`). **Canceló TH-F4.5** (borrar su registro A) |
| 0022 | **Una instancia dedicada por owner**; la RLS pasa a defensa en profundidad | Aceptada (26/08) | Toda la Fase 5: `infra/scripts/provision-instancia.sh`, `/api/bootstrap`, `/api/version`. Ver [[modelo-instancias-soberanas]] |
| 0023 | **El droplet viejo sale del modelo**, y sus datos no se rescatan | Aceptada (27/08) | Retira `F0.2`, `F1.1`, `F1.5`, `F7.1`, `F7.2` y `F7.3`: **la Fase 7 entera**. El plan queda en **40 tareas con objeto**. Extiende el 0017 |
| 0024 | **`demo.space-os.io` es la demo ORIGINAL y se eliminará** | Aceptada (27/08) — **sustituye al 0021** | No se mueve al PADRE ni se le emite certificado. **`F4.3` queda sin objeto**: el plan baja a **39 tareas con objeto**. Su certificado (26/10) pasa a ser caducidad natural, no plazo |
| 0025 | **El acceso de soporte a la instancia de un owner** | Aceptada | Cómo entra soporte sin quedarse con una llave permanente |
| 0026 | **El panel de flota tiene pantalla propia, fuera del artefacto** | Aceptada | No viaja en la imagen que corre cada instancia |
| 0027 | **El alta de una instancia se pide desde el panel, y la ejecuta otro proceso** | Aceptada | Separa pedir de ejecutar |
| 0028 | **Google obligatorio; la contraseña se reserva para los cambios** | Aceptada | Entrar es Google; cambiar dinero o catálogo pide contraseña |
| 0029 | **El ejecutor de altas pasa de «una pasada, un alta» a una máquina de estados** | Aceptada | Un alta se reanuda en vez de repetirse |
| 0030 | **El basemap de la flota no lleva clave** | Aceptada | Ninguna credencial en un artefacto que se distribuye |
| 0031 | **Los datos de g500 SÍ se rescatan del droplet viejo** | Aceptada | Sustituye **solo el punto 2** del 0023 |
| 0032 | **El alta en droplet propio del cliente, y la licencia firmada** | Aceptada | Cada owner en su droplet, con licencia firmada por el PADRE |
| 0033 | **El origen de las redirecciones sale de la cabecera `Host`** | Aceptada | Arregla el 500 que la flota daba con `Location` relativa |
| 0034 | **Multi-entidad es ATRIBUCIÓN, no aislamiento** | Aceptada (18/09) — PR #91 | La frase ES la decisión: el owner no quiere separar sus razones sociales, quiere **verlas juntas**. Descarta «un tenant por razón social», que rompía el consolidado por diseño. Su apartado de seguridad lleva el agujero R2 con su medición |
| 0035 | **Los reportes se agregan en el SERVIDOR, no en el navegador** | Aceptada (18/09) — PR #91 | El límite `/api/reportes/*`. Motivo medido: `/api/estado` llegó a **6.12 MB** con pantalla en blanco de 6-12 s **sin dar error**, y un reporte trimestral mira años. Declara lo que NO hace: sin agregación en SQL y sin tope de rango |
| 0036 | **Contraseña compartida de vuelta para el control de cambios** | Aceptada (21/09) | Enmienda al `0009`, pedida por el dueño. `tenants.cambios_password_hash` vuelve, pero SOLO desbloquea el candado general — `exigirReautenticacionSiempre` (resetear a un tercero) sigue exigiendo la propia — ver [[autenticacion-y-sesion]] |
| 0037 | **Cada instancia elige si toma la versión nueva** | Aceptada (21/09) | La base de la instancia es el buzón entre la aplicación y el actualizador: tabla `actualizaciones_instancia` (`20260921_actualizaciones_instancia.sql`), `app/api/actualizaciones/`, `update.sh --comprobar` y su cron cada 15 min (`infra/scripts/provision-instancia.sh:915`). Ver [[actualizaciones-instancia]] |
| 0038 | **Los tickets de soporte viven en la instancia, y el panel los jala** | Aceptada (22/09) | Tabla `tickets` con `tenant_id` y RLS (`20260923_tickets.sql`), `app/api/tickets/`; el PADRE los lee agrupados por instancia en una pantalla hermana de `/flota/` |
| 0039 | **La cadena de precio del spot**: franja, temporada, volumen, código y paquete | Escrito «aprobado para diseño · fases 1–4 una detrás de otra» (28/09). **Las cuatro fases tienen migración en el árbol**: `20260928_rejilla_franja_temporada.sql`, `_descuento_por_volumen.sql`, `_codigo_promocional.sql`, `_paquete_cerrado.sql` | [[02-Backend/rejilla-franja-y-temporada]] · [[02-Backend/descuento-por-volumen]] · [[02-Backend/codigo-promocional]] · [[02-Backend/paquete-cerrado]] |
| 0040 | **Roles de venta y la autorización de descuentos** | Escrito «en diseño · nada construido · la migración espera aprobación» (29/09). **Desfase con el código:** las dos migraciones existen (`20260929_roles_de_venta_enum.sql` y `_matriz.sql`). El estado del documento no se actualizó — mismo vicio que el `0011` y el `0014` | Cuatro roles nuevos en `rol_demo` (`ADMINISTRADOR`, `DIRECTOR_COMERCIAL`, `GERENTE_VENTAS`, `VENDEDOR`, este último default de `usuarios.rol`); `COMERCIAL` se retira de uso. Ver [[02-Backend/roles-de-venta]] |
| 0041 | **Google Maps solo donde aporta, con la clave en tiempo de ejecución** | **Propuesta** (01/10), pendiente del dueño | **Ninguno todavía**: no hay código de Google Maps en `apps/web` (búsqueda del 05/10). Complementa —no reemplaza— el `0030`. Pendiente también en [[preguntas-abiertas]] (P22) |
| 0042 | **La calculadora de spots da la CANTIDAD; el precio sigue siendo el de la pantalla** | Aceptada (01/10) | Cuatro columnas en `propuesta_items` (`20261007_calculadora_spots.sql`); la prima del Roadblock solo con `comercial.aprobar`. Ver [[02-Backend/calculadora-de-spots]] |

> [!danger] Cuatro de estos ADR se superaron entre sí en 48 horas — lee el estado, no el número
> `0015` → `0016` → `0017` y `0020` → `0021` cambiaron de decisión **el mismo día
> en que se escribieron**, y el `0015` llegó a resucitar. Un ADR más alto no es
> automáticamente el vigente sobre el mismo asunto: **lo vigente hoy (frase del
> 27/08, sigue cierta al 05/10 para este asunto) es
> `0017` (todo en el PADRE), `0022` (una instancia por owner), `0023` (el
> droplet viejo sale del modelo) y `0024` (`demo.space-os.io` se eliminará)**.
> Citar el `0016`, el `0020` o el `0021` como si mandaran es el error que ya
> dejó falso un reporte entero (`d506725`, 26/08).
>
> **Ojo con el `0021` en particular**: duró un día y medio y llegó a propagarse
> a media bóveda diciendo que el nombre «se conserva». Lo superó el `0024` el
> 27/08. Si encuentras una nota que diga que se queda, está vieja.

> [!warning] ADR 0011 dice "Propuesta" pero ya está en producción
> El código y la migración `20260805_config_negocio_por_tenant.sql` están
> aplicados. El estado del documento quedó sin actualizar. Ver
> [[preguntas-abiertas]]. **Le pasa lo mismo al 0014**, que sigue en «Propuesta»
> desde el 21/08 y bloquea F8.1.

> [!note] ADR 0012 se enmendó el mismo día que se desplegó
> La versión original decía «Google autentica, no da de alta». La enmienda
> (`4206ab2`) permite crear usuarios y organizaciones con Google, colgándolo del
> **mismo interruptor** `AUTOREGISTRO` (`apps/web/lib/entorno.ts:27`; se llamaba
> `NEXT_PUBLIC_AUTOREGISTRO` hasta que F2.6 lo renombró) que ya gobernaba `/api/signup`.
> Google sigue sin decidir organización ni rol.
>
> La decisión 4 (reautenticación por Google) **sigue fuera**, y deja de ser un
> bloqueo porque el alta con Google **genera igualmente un `password_hash`**. Ese
> invariante es lo que mantiene intactos `cambios.ts` y `perfil-controller.ts`.
>
> **Ejemplo de cómo se enmienda un ADR aquí:** revertir en parte una alternativa
> rechazada va con enmienda escrita, no de tapadillo.

## Decisiones deducidas del código (sin ADR)

Están razonadas en comentarios, no en `docs/adr/`. Se documentan aquí porque
tienen el mismo peso operativo.

### D-1 · La sesión es opaca y se resuelve contra la tabla, no criptográficamente
`lib/server/auth.ts:107-117` (`crearSesion`) genera 256 bits aleatorios
(`randomBytes(32)`, `:108`) y los guarda en `sesiones`.
No hay JWT ni firma. **Ventaja:** la revocación es real (borrar la fila).
**Costo:** cada petición hace una consulta.

> [!warning] Si citabas `auth.ts:92-101` para `crearSesion`, recalcula
> El ADR 0018 le añadió el parámetro `metodo` y **once líneas de comentario**
> encima, así que la función bajó de `:92` a `:103`. Hoy `:92` es el `return
> bcrypt.compare(...)` de `verifyPassword`. La cabecera de
> `20260825_sesion_metodo.sql:5` **también** cita la línea vieja: es una
> migración ya aplicada y **no se edita** (R3), así que la corrección vive aquí.
>
> **2026-10-05 · y volvió a moverse, y esta nota se contradecía a sí misma:**
> la fila del ADR 0018 citaba `auth.ts:98-103` y este apartado `:103-113`
> para la misma función. Medido hoy: el comentario «el método es OBLIGATORIO»
> ocupa `:102-106`, **`crearSesion` empieza en `:107`** y termina en `:117`;
> `:94-97` es `verifyPassword`. Las dos citas se igualaron a eso.

### D-2 · El GUC de tenant es transaction-local, nunca de sesión
`lib/server/db.ts:12-15` lo explica: el pool reutiliza conexiones entre tenants,
y un `set_config` a nivel de sesión filtraría datos de otra organización.
**Es la línea que sostiene todo el aislamiento.** Ver [[multi-tenancy-y-rls]].

### D-3 · Doble capa de aislamiento: RLS + filtro explícito
`lib/server/usuarios-repo.ts:13-17`: toda operación por `id` lleva **además**
`and tenant_id = $n`. Redundante con la RLS a propósito — "si algún día la app
conectara con un rol BYPASSRLS, esto sigue aislando".

### D-4 · Los folios son consecutivos, no aleatorios
`lib/server/folios.ts:6-22` documenta el fallo que lo motivó: el generador de
campañas tenía 1.000 combinaciones por día, así que por la paradoja del
cumpleaños chocaba al ~37.º documento — y el usuario veía
`duplicate key value violates unique constraint` a media venta.

### D-5 · Las subidas se validan por magic bytes, no por el MIME declarado
`lib/server/uploads.ts:5-16`: 6 de 7 puntos de subida aceptaban cualquier data
URL de cualquier peso. El límite del navegador se salta con `curl`.

### D-6 · Sin dependencia nueva para OIDC
`lib/server/google-oauth.ts:5-17`: el `id_token` llega por canal directo
servidor-a-servidor, y OIDC Core §3.1.3.7 permite no verificar la firma. **La
exención vale solo para ese canal** — si se añade One Tap, hay que verificar
contra el JWKS.

### D-7 · El escapado de HTML tiene una sola implementación
`app/api/recordatorios/route.ts` reexporta `escaparHtml` de `email.ts` en vez de
copiarlo: "dos escapadores para lo mismo acaban divergiendo, y aquí el que se
quedara corto daría un correo con HTML inyectado".

## Relacionadas
[[vision-general]] · [[autenticacion-y-sesion]] · [[multi-tenancy-y-rls]] ·
[[zonas-de-riesgo]] · [[preguntas-abiertas]] · [[MOC-Proyecto]]
