---
tipo: moc
estado: verificado
actualizado: 2026-08-10
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
| Tablas | 38 | [[esquema]] |
| Migraciones | 66 | [[migraciones]] |

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
- [[decisiones]] — los 12 ADR y las decisiones deducidas del código

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
- [[esquema]] — diagrama ER y las 38 tablas
- [[migraciones]] — las 66 en orden, y las trampas de orden

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
- [[2026-08-10]] — **última entrada**: despliegues del día + V2-01
- [[2026-08-07]] — creación de la bóveda y la tarde de Google

### 08 · Manuales
Los dos salen del [[inventario-2026-08-11]] y llevan fecha en el nombre: cada corrida
escribe uno nuevo en vez de pisar el anterior.
- [[manual-tecnico-2026-08-11]] — entrada para un dev nuevo: arquitectura, datos, API,
  entornos, despliegue y operación. 31 pendientes al cierre
- [[manual-usuario-2026-08-25]] — **el vigente**. Para quien usa la aplicación sin saber
  programar, ordenado por tarea y con los controles nombrados por su rótulo real. Cubre
  las 18 áreas, las pantallas públicas y el diccionario de estados. 8 pendientes: siete
  de negocio y **un ajuste que no gobierna nada** («Plazos de cobranza»)
- [[manual-usuario-2026-08-11]] — el borrador anterior, escrito desde el inventario.
  **Superado**: se conserva como historia

> [!tip] Esta bóveda caduca
> Última validación completa contra el código: **10/08/2026**. El procedimiento
> para repetirla (cuatro chequeos y sus dos trampas) está en [[convenciones]].

## Advertencia sobre la documentación existente

`README.md` en la raíz **está desactualizado**: describe un backend Fastify
(`apps/api`), rutas `/var/www/spaces-dooh` y despliegue automático en cada push.
Nada de eso es cierto hoy — ver [[vision-general]] y [[entorno-y-despliegue]].
