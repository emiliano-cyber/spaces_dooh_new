---
tipo: moc
estado: verificado
actualizado: 2026-08-20
tags: [indice, entrada]
archivos:
  - package.json
  - apps/web/package.json
  - db/schema.sql
---

# MOC — Space OS (spaces_doohmain_nueva)

> **Punto de entrada de la bóveda.** Desde aquí se llega a cualquier nota en 1 salto.

## Qué es esto

CRM/ERP multi-organización para **publicidad exterior (OOH/DOOH)**: inventario de
pantallas y espectaculares, arrendadores y contratos de renta, propuestas
comerciales, campañas, órdenes de trabajo en campo, imprenta, facturación y
cobranza.

| Dato | Valor | Evidencia |
|---|---|---|
| Producto vivo | Una sola app Next.js con BFF integrado | `ecosystem.config.js:1-3` |
| Framework | Next.js 14.2.29, App Router | `apps/web/package.json:17` |
| Base de datos | PostgreSQL, `pg` directo (sin ORM) | `apps/web/lib/server/db.ts:2` |
| Aislamiento | RLS de Postgres por `app.tenant_id` | `apps/web/lib/server/db.ts:54-69` |
| Producción | `https://demo.space-os.io/spaces-dooh/` | `infra/nginx/demo.space-os.io.conf` |
| Endpoints | 88 route handlers | `apps/web/app/api/**/route.ts` |
| Tablas | 39 | [[esquema]] |
| Migraciones | 71 | [[migraciones]] |

## Antes de tocar nada

> [!warning] Lectura obligatoria para cualquier agente
> 1. [[AGENTES]] — el contrato de trabajo en paralelo
> 2. [[zonas-de-riesgo]] — qué es ROJO, AMARILLO y VERDE
> 3. [[tablero]] — qué zonas están tomadas ahora mismo

## Mapa

### 00 · Índice
- [[glosario]] — términos del dominio (predio, modalidad, divisor, candado…)
- [[preguntas-abiertas]] — lo que **no** se pudo determinar leyendo el código

### 01 · Arquitectura
- [[vision-general]] — diagrama de componentes y por qué hay una sola pista viva
- [[stack-y-dependencias]] — versiones reales y por qué están fijadas
- [[entorno-y-despliegue]] — local, CI y el despliegue manual por SSH
- [[decisiones]] — los 13 ADR y las decisiones deducidas del código
- [[modelo-instancias-soberanas]] — una instancia por owner: avance de la corrección del 12/08, costos y calendario

### 02 · Backend
- [[02-Backend/_indice|Índice de Backend]] — mapa de la capa servidor
- [[api-endpoints]] — los 88 endpoints con método, guard y módulo
- [[autenticacion-y-sesion]] — cookie, sesión, CSRF, permisos, reautenticación
- [[multi-tenancy-y-rls]] — cómo se aísla cada organización
- [[inventario-y-sitios]] — pantallas, modalidades, importación
- [[arrendadores-y-contratos]] — predios, contratos, rentas, firmas
- [[comercial-propuestas-campanas]] — propuestas, reservas, campañas
- [[operaciones-y-ot]] — órdenes de trabajo, evidencias, imprenta
- [[finanzas-y-cobranza]] — facturación, candado, parcialidades
- [[integraciones-externas]] — DOOHmain, Space Eye, Spaces S3, Resend, Google
- [[infraestructura-servidor]] — pool, errores, folios, rate limit, subidas

### 03 · Frontend
- [[03-Frontend/_indice|Índice de Frontend]] — mapa de la capa cliente
- [[shell-y-navegacion]] — layouts, sidebar, topbar, guards de UI
- [[acceso-y-sesion-ui]] — login, recuperar, autoregistro
- [[modulos-internos]] — las 22 pantallas del shell
- [[paginas-publicas]] — portal, firma, propuesta compartible, OT móvil
- [[estado-y-data-fetching]] — React Query, zustand, el parche de `fetch`

### 04 · Datos
- [[esquema]] — diagrama ER y las 39 tablas
- [[migraciones]] — las 68 en orden, y las trampas de orden

### 05 · Flujos
- [[flujo-login]] — del clic a la cookie
- [[flujo-acceso-con-google]] — ADR 0012, desplegado y apagado
- [[flujo-propuesta-a-campana]] — el flujo principal del producto
- [[flujo-facturacion-y-cobranza]] — el candado y las parcialidades
- [[flujo-orden-de-trabajo]] — campo, evidencias y cierre

### 06 · Operación
- [[zonas-de-riesgo]] — ROJO / AMARILLO / VERDE con evidencia
- [[convenciones]] — cómo se escribe código y documentación aquí
- [[verificacion-de-produccion]] — comandos para comprobar qué corre de verdad
  en el droplet y qué hay en `spaces_prod` (sin ejecutar)

### 07 · Agentes
- [[AGENTES]] — particionado, claims, ramas, conflictos
- [[tablero]] — estado vivo de las zonas
- [[_plantilla-diaria]] — plantilla del diario
- [[2026-08-20]] — **última entrada**: los tres ROJO del re-ensayo de la Fase 4,
  cerrados; el catálogo de permisos completo y la contraseña del Dueño
- [[2026-08-17]] — el runner de migraciones en tres ciclos, T-04, F3.3, el
  workflow de release y `update.sh`. ⚠️ **Faltan las entradas del 18 y del 19/08**
- [[2026-08-14]] — expedientes de evidencia, Fase 2 y el registro cerrado en toda la flota
- [[2026-08-13]] — entra el plan v3 con sus tres agentes; Fase 1 cerrada en local
- [[2026-08-12]] — nace el plan del servidor padre
- [[2026-08-11]] — el menú lateral cuenta el proceso
- [[2026-08-10]] — despliegues del día + V2-01
- [[2026-08-07]] — creación de la bóveda y la tarde de Google

### 08 · Manuales
- [[manual-tecnico]] — entrada para un dev nuevo: arquitectura, datos, API,
  entornos, despliegue y operación. Derivado del [[inventario-2026-08-11]]

> [!tip] Esta bóveda caduca
> Última validación completa contra el código: **10/08/2026**. El procedimiento
> para repetirla (cuatro chequeos y sus dos trampas) está en [[convenciones]].

## Advertencia sobre la documentación existente

`README.md` en la raíz **está desactualizado**: describe un backend Fastify
(`apps/api`), rutas `/var/www/spaces-dooh` y despliegue automático en cada push.
Nada de eso es cierto hoy — ver [[vision-general]] y [[entorno-y-despliegue]].
