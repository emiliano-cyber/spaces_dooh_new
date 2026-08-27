---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-27
tags: [adr, decisiones, reglas-de-negocio]
archivos:
  - docs/adr/
  - apps/web/lib/server/cambios.ts
  - apps/web/lib/server/db.ts
  - apps/web/lib/server/folios.ts
---

# Decisiones de diseño

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
| 0009 | **Reautenticación individual** | Aceptada | `lib/server/cambios.ts` — ver [[autenticacion-y-sesion]] |
| 0010 | Catálogo explícito de módulos, retiro del rol `CLIENTE` | Aceptada | `lib/modulos.ts`; el enum aún lo tiene |
| 0011 | `config_negocio` por tenant | **Propuesta** | Ya implementado (`db/schema.sql:643-674`) |
| 0012 | **Acceso con cuenta de Google** | Aceptada + **enmendada el 07/08** | [[flujo-acceso-con-google]] |
| 0013 | **Altas que no se pueden duplicar** | Aceptada | `arrendadores_tenant_rfc_uq` (`20260810_arrendadores_rfc_unico.sql`); el nombre repetido avisa con 409 y se puede confirmar — ver [[arrendadores-y-contratos]]. Su espejo para `clientes` llegó el 26/08 con `20260826_clientes_rfc_unico.sql`, **escrita y sin aplicar** ([[migraciones]]) |
| 0014 | Postgres **en el droplet**, no base administrada | **Propuesta** (21/08) | Ninguno todavía. Toca el aprovisionamiento (F8.1), no la app |
| 0015 | DEMO vive **dentro** del PADRE | ~~Aceptada~~ → superada por el 0016 → **restablecida por el 0017** | `infra/systemd/spaces-demo.service` |
| 0016 | DEMO se queda en su propio droplet | **SUPERADA** el mismo día (25/08) por el 0017 | — |
| 0017 | **Todo se concentra en el PADRE** | Aceptada (25/08) | `infra/nginx/space-os.io.conf` sirve `space-os.io` (`:124`) y `demo.space-os.io` (`:188`) desde la misma máquina |
| 0018 | **Fijar la primera contraseña tras entrar con Google, sin teclear la anterior** | Aceptada — **verificada en producción el 25/08** | `sesiones.metodo` (`20260825_sesion_metodo.sql`), `crearSesion(usuarioId, metodo)` **sin default a propósito** (`lib/server/auth.ts:98-103`) y [[flujo-acceso-con-google]] |
| 0019 | DEMO arranca con **systemd**, no con pm2 | Aceptada (25/08) | `infra/systemd/spaces-demo.service`; pm2 es inalcanzable para el usuario `demo` |
| 0020 | No hay demostración pública | **SUPERADA** el mismo día (26/08) por el 0021 | — |
| 0021 | ~~`demo.space-os.io` se queda~~ **SUPERADA por el 0024 (27/08)** | Aceptada (26/08) | `infra/nginx/space-os.io.conf:188`. **Canceló TH-F4.5** (borrar su registro A) |
| 0022 | **Una instancia dedicada por owner**; la RLS pasa a defensa en profundidad | Aceptada (26/08) | Toda la Fase 5: `infra/scripts/provision-instancia.sh`, `/api/bootstrap`, `/api/version`. Ver [[modelo-instancias-soberanas]] |
| 0023 | **El droplet viejo sale del modelo**, y sus datos no se rescatan | Aceptada (27/08) | Retira `F0.2`, `F1.1`, `F1.5`, `F7.1`, `F7.2` y `F7.3`: **la Fase 7 entera**. El plan queda en **40 tareas con objeto**. Extiende el 0017 |
| 0024 | **`demo.space-os.io` es la demo ORIGINAL y se eliminará** | Aceptada (27/08) — **sustituye al 0021** | No se mueve al PADRE ni se le emite certificado. **`F4.3` queda sin objeto**: el plan baja a **39 tareas con objeto**. Su certificado (26/10) pasa a ser caducidad natural, no plazo |

> [!danger] Cuatro de estos ADR se superaron entre sí en 48 horas — lee el estado, no el número
> `0015` → `0016` → `0017` y `0020` → `0021` cambiaron de decisión **el mismo día
> en que se escribieron**, y el `0015` llegó a resucitar. Un ADR más alto no es
> automáticamente el vigente sobre el mismo asunto: **lo vigente hoy es
> `0017` (todo en el PADRE), `0021` (`demo.space-os.io` se queda) y `0022`
> (una instancia por owner)**. Citar el `0016` o el `0020` como si mandaran es
> el error que ya dejó falso un reporte entero (`d506725`, 26/08).

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
`lib/server/auth.ts:103-113` genera 256 bits aleatorios y los guarda en `sesiones`.
No hay JWT ni firma. **Ventaja:** la revocación es real (borrar la fila).
**Costo:** cada petición hace una consulta.

> [!warning] Si citabas `auth.ts:92-101` para `crearSesion`, recalcula
> El ADR 0018 le añadió el parámetro `metodo` y **once líneas de comentario**
> encima, así que la función bajó de `:92` a `:103`. Hoy `:92` es el `return
> bcrypt.compare(...)` de `verifyPassword`. La cabecera de
> `20260825_sesion_metodo.sql:5` **también** cita la línea vieja: es una
> migración ya aplicada y **no se edita** (R3), así que la corrección vive aquí.

### D-2 · El GUC de tenant es transaction-local, nunca de sesión
`lib/server/db.ts:12-15` lo explica: el pool reutiliza conexiones entre tenants,
y un `set_config` a nivel de sesión filtraría datos de otra organización.
**Es la línea que sostiene todo el aislamiento.** Ver [[multi-tenancy-y-rls]].

### D-3 · Doble capa de aislamiento: RLS + filtro explícito
`lib/server/usuarios-repo.ts:11-15`: toda operación por `id` lleva **además**
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
