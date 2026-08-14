---
tipo: manual
estado: verificado
actualizado: 2026-08-14
tags: [manual, tecnico, onboarding, arquitectura, despliegue, runbook]
archivos:
  - apps/web/
  - db/schema.sql
  - db/migrations/
  - db/docker-compose.yml
  - infra/nginx/demo.space-os.io.conf
  - ecosystem.config.js
  - .github/workflows/
  - package.json
  - apps/web/package.json
  - apps/web/vitest.config.ts
  - apps/web/vitest.e2e.config.ts
  - apps/web/lib/test/db-e2e.ts
  - scripts/apply-migration.mjs
---

# Manual técnico — Space OS (spaces_doohmain_nueva)

> **Para quién es esto.** Para la persona que entra hoy al proyecto y no lo conoce de
> nada. Al terminar de leerlo deberías poder: situarte en el repo, entender cómo se
> aísla cada organización, saber por dónde entra una petición, y saber **qué no tocar
> sin avisar**.

> [!info] De dónde sale cada afirmación
> El cuerpo de este manual está construido a partir de [[inventario-2026-08-11]],
> el reconocimiento factual del 11/08/2026 (bóveda leída primero, verificada
> después contra el código, cada dato con evidencia `ruta:línea`). **Tres
> secciones son la excepción** y se leyeron del repo directamente el mismo día,
> para cerrar los pendientes P-01 a P-04: **§7.1** (arranque local y scripts),
> **§7.1.1** (pruebas) y **§8.1** (`apply-migration.mjs`). Lo que sigue sin cubrir
> está al final, en [[#PENDIENTE]], redactado como pregunta concreta. Si una
> sección te parece corta, es que la fuente no daba para más — no que el tema sea
> pequeño.

> [!warning] Lo que de producción **nadie ha verificado**
> El estado real de la base `spaces_prod`, el contenido de `.env.production` del
> droplet y si el despliegue `3164aaa` sigue corriendo **no están comprobados**.
> Los comandos para comprobarlos —sin ejecutar todavía— están en
> [[verificacion-de-produccion]]. Todo lo que este manual dice de producción viene
> de notas escritas a mano, no de la máquina.
> **De las pruebas sí hay dato:** 789 unitarias y 136 de integración, **todas en
> verde el 11/08/2026** (§7.1.1).

---

## Índice

1. [[#1 · Panorama]]
2. [[#2 · Arquitectura]]
3. [[#3 · Estructura del repositorio]]
4. [[#4 · Modelo de datos y multi-tenancy]]
5. [[#5 · API (el BFF)]]
6. [[#6 · Autenticación, sesión y permisos]]
7. [[#7 · Entornos y configuración]]
8. [[#8 · Migraciones]]
9. [[#9 · Despliegue y runbook]]
10. [[#10 · Zonas de riesgo]]
11. [[#11 · Cómo seguir leyendo la bóveda]]
12. [[#PENDIENTE]]

---

## 1 · Panorama

### 1.1 Qué resuelve

CRM/ERP **multi-organización** para publicidad exterior OOH/DOOH: inventario de
pantallas, arrendadores y contratos de renta, propuestas comerciales, campañas,
órdenes de trabajo en campo, imprenta, facturación y cobranza
(`vault/00-Indice/MOC-Proyecto.md:18-21`).

Cinco organizaciones («tenants») viven sobre **una sola instalación**. Los roles son
`DUENO`, `COMERCIAL`, `OPERACIONES`, `IMPRENTA`, `FINANZAS`
(`apps/web/components/demo/shell/nav.ts:128-133`).

### 1.2 Stack

| Pieza | Qué es | Evidencia |
|---|---|---|
| Framework | Next.js 14.2.29, App Router + React 18 + Tailwind | inventario §1.3 |
| Backend | **BFF integrado** en la misma app (Route Handlers de Next) | inventario §1.3 |
| Base de datos | PostgreSQL, driver `pg` directo, **sin ORM** | inventario §1.3 |
| Autenticación | **Propia**, sin librería de terceros | inventario §1.3 |
| Proceso | pm2 `spaces-web`, fork, 1 instancia | `ecosystem.config.js:5-27` |

### 1.3 Las cuatro cosas que más despistan al entrar

Léelas antes que nada; son cuatro trampas de nomenclatura ya confirmadas.

1. **Hay una sola pista viva.** `apps/` contiene **únicamente** `web`. El único
   proceso desplegado es `spaces-web` (`ecosystem.config.js:5-27`).
2. **No existe `apps/api`.** El backend Fastify 5 + Prisma + BullMQ vive en
   `_archive/api`, fuera de los workspaces npm (`package.json:25-28` declara solo
   `apps/*` y `packages/*`) y **nunca se desplegó** (`ecosystem.config.js:1-3`).
   Su `prisma/` **no se usa**: el esquema real es `db/schema.sql`.
3. **No existen los grupos de rutas `(comercial)` ni `(operaciones)`.** Los únicos
   grupos del repo son `(app)`, `(app)/(shell)` y `_legacy/(auth)` (inventario §1.6,
   D-0).
4. **El segmento `/demo` ya no existe en las URLs**: `middleware.ts:36` redirige
   `/demo/*` → `/*` con 308. El nombre «demo» solo sobrevive en `components/demo/`,
   la clase `.demo-root` y `demo.css` — **no significa que sea código de mentira**.

> [!danger] El `README.md` de la raíz está obsoleto
> Describe Fastify + Prisma + Redis + `apps/api` (`README.md:5-31`). Nada de eso es
> cierto hoy. No lo uses para arrancar.

### 1.4 Tamaño y actividad (recuentos verificados el 11/08)

88 archivos `route.ts` / **110 métodos HTTP** · **38 tablas** · **66 migraciones** ·
**13 ADR** · **22 pantallas internas** + 8 públicas/sin-chrome · 30 commits entre el
09/08 y el 11/08. El proyecto está **muy activo**: asume que estos números crecen.

### 1.5 Decisiones de fondo

Las decisiones formales están en `docs/adr/` (13 ADR, `0001`–`0013`) y resumidas en
[[decisiones]] — ojo, esa nota dice «los 12 ADR» y el `0013` **no está en su tabla**
(inventario D-10). Las que más te van a pegar el primer día:

- **ADR 0001 / 0002 / 0003** — un alta de pantalla exige arrendador, abre un contrato
  que **nace `INCOMPLETO`**, y un contrato incompleto **bloquea reservar**.
- **ADR 0007** — los vencimientos de renta se anclan al **inicio** del contrato.
- **ADR 0008** — `max_clientes` por sitio.
- **ADR 0009** — desbloqueo temporal para cambios sensibles (`desbloqueo_expira_en`).
- **ADR 0011** — configuración por tenant (`config_negocio`).
- **ADR 0012 (+ enmienda)** — acceso y alta con Google.
- **ADR 0013** — `rfc` de arrendador único **por tenant**.

---

## 2 · Arquitectura

### 2.1 Diagrama de componentes

```mermaid
flowchart TD
    subgraph cliente["Navegador"]
        UI["Next.js App Router · React 18 · Tailwind<br/>22 pantallas internas + 8 públicas"]
    end

    CRON["Cron del droplet<br/>POST /api/recordatorios"]

    subgraph droplet["Droplet DigitalOcean · /var/www/Spaces"]
        NGINX["nginx · TLS + HSTS<br/>proxy_pass http://spaces_web<br/>X-Forwarded-For = $remote_addr (reemplaza)"]
        subgraph pm2["pm2 · spaces-web · fork · 1 instancia · :3000"]
            MW["middleware.ts<br/>308 /demo/* · CSRF · cookie presente"]
            API["app/api/**/route.ts<br/>88 handlers / 110 métodos (el BFF)"]
            SRV["lib/server/** (76 archivos)<br/>controllers + repos + infraestructura"]
            RL["rate-limit.ts<br/>Map EN MEMORIA del proceso"]
        end
    end

    PG[("PostgreSQL · spaces_prod<br/>38 tablas · RLS por app.tenant_id")]

    subgraph ext["Integraciones (cada una detrás de sus variables)"]
        DOOH["doohmain_sdk (Python, subproceso)<br/>DOOHMAIN_PUBLISH_ENABLED"]
        S3["DigitalOcean Spaces (S3)<br/>DO_SPACES_*"]
        GOOG["Google OAuth<br/>GOOGLE_*"]
        EYE["Space Eye (cámaras)<br/>SPACE_EYE_*"]
        MAIL["Resend (correo)<br/>RESEND_API_KEY + EMAIL_FROM"]
    end

    subgraph latente["LATENTE · existe en el repo, NO corre"]
        ARCH["_archive/api (Fastify+Prisma+BullMQ)<br/>_archive/web-frontend-2<br/>app/_legacy (7 páginas)<br/>infra/nginx/spaces.conf · infra/apache"]
    end

    UI --> NGINX
    CRON --> NGINX
    NGINX --> MW --> API --> SRV --> PG
    API -.-> RL
    SRV --> DOOH
    SRV --> S3
    SRV --> GOOG
    SRV --> EYE
    SRV --> MAIL
```

### 2.2 Cómo se hablan las piezas

- **Todo entra por nginx** con TLS y HSTS y sale a `http://spaces_web`
  (`infra/nginx/demo.space-os.io.conf:68-70,112`). La ruta pública es
  `https://demo.space-os.io/spaces-dooh/` (`basePath`, `next.config.mjs:19-20`).
- **No hay red interna de servicios**: el «backend» son los Route Handlers de la
  misma app Next. Una llamada del navegador a `/api/...` no sale de la máquina.
- **La capa de servidor** (`lib/server/`, 76 archivos) separa *controllers* de
  *repos*; los repos hablan con Postgres por el pool de `db.ts`.
- **Las integraciones son opcionales por diseño**: cada una tiene su
  `*Habilitado()`; si faltan sus variables devuelve `false` y el sistema sigue
  operando **en silencio** (`storage.ts`, `email.ts`, `google-oauth.ts`,
  `space-eye.ts`). Ver §7.4.
- **El límite de peticiones vive en memoria del proceso**
  (`lib/server/rate-limit.ts`), por eso pm2 corre con `instances: 1`. Ver §10.

Nota de bóveda: [[vision-general]] tiene el diagrama equivalente pero dice «86 route
handlers» (`vision-general.md:47`); el número real hoy es **88 archivos / 110
métodos** (inventario D-10).

---

## 3 · Estructura del repositorio

«VIVA» = corre en producción. «LATENTE» = está en el repo y **no corre**.

| Carpeta | Qué vive ahí | Pista |
|---|---|---|
| `apps/web/app/(app)/(shell)/` | Las 22 pantallas internas con sidebar + topbar | **VIVA** |
| `apps/web/app/(app)/` (fuera de shell) | 8 páginas sin chrome: `login`, `recuperar/[token]`, `contrato/[id]`, `firmar/[token]`, `m/ot/[id]`, `p/[id]`, `portal/[token]`, `propuesta` | **VIVA** |
| `apps/web/app/api/` | 88 `route.ts` — el BFF entero | **VIVA** |
| `apps/web/lib/server/` | 76 `.ts`: controllers + repos + infraestructura | **VIVA** |
| `apps/web/lib/` (raíz) | Cálculos puros compartidos cliente/servidor, con `.test.ts` | **VIVA** |
| `apps/web/lib/data/` | Store zustand `DemoState`, adapters, `estado-api.ts` | **VIVA** (costura con la demo) |
| `apps/web/lib/test/` | Arnés e2e: `db-e2e.ts`, `servidor-e2e.ts`, `doble-google.ts` | **VIVA** |
| `apps/web/components/demo/` | 68 componentes: `shell/`, `ui/`, por módulo | **VIVA** |
| `apps/web/app/_legacy/` | 7 páginas archivadas (portal cliente viejo, login viejo) | **LATENTE** |
| `_archive/api/` | Fastify + Prisma + BullMQ + `prisma/` | **LATENTE**, nunca desplegado |
| `_archive/web-frontend-2/` | Front anterior | **LATENTE** |
| `packages/types`, `packages/utils` | Tipos y utilidades compartidas | **VIVA** |
| `packages/ui` | 3 componentes (`button`, `card`, `code`) | Marginal |
| `db/` | `schema.sql` (656 líneas), `migrations/` (66), `seeds/`, `docker-compose.yml` (Postgres en **5433**), `dev-rol-app.sql` | **VIVA** |
| `docs/adr/` | 13 ADR (0001–0013) | **VIVA** |
| `docs/datos/` | 13 scripts SQL de corrección de datos de producción, **con rollback** | **VIVA** |
| `docs/` | `Registro_Cambios.md`, `Reglas_Arrendadores.md`, `DEPENDENCIAS.md`, runbooks, diseño DOOHmain | **VIVA** |
| `infra/nginx/demo.space-os.io.conf` | El reverse proxy **real** | **VIVA** |
| `infra/nginx/spaces.conf`, `infra/apache/spaces.conf`, `infra/docker-compose.yml`, `infra/scripts/*` | Asumen el API Fastify | **LATENTE / obsoleto** |
| `doohmain_sdk/` | SDK Python invocado por subproceso | **VIVA** (detrás de flag) |
| `.github/workflows/` | `ci.yml`, `deploy.yml`, `lockfile-check.yml` | **VIVA** |
| `scripts/` | `apply-migration.mjs`, generadores de plantillas, `md-to-pdf.mjs` | Utilería |
| Raíz: `DESPLIEGUE_*.txt` (11), `Manual_*.pdf`, `Auditoria_*.pdf` | Runbooks ya ejecutados e historia | Documental |
| `vault/` | La bóveda de conocimiento (39 notas) | Documental |

### 3.1 Dónde tocar cada cosa

- **Una pantalla nueva** → `apps/web/app/(app)/(shell)/…` + entrada en
  `components/demo/shell/nav.ts` (el mismo arreglo `NAV` autoriza rutas en
  `AuthGate`, ver §6.3, así que no se desincronizan).
- **Un endpoint nuevo** → `apps/web/app/api/…/route.ts`. **Ponle guard tú**: el
  middleware no protege `/api/` (§5.1).
- **Lógica de negocio / SQL** → `apps/web/lib/server/` (controller + repo).
- **Cálculo compartido cliente/servidor** → `apps/web/lib/` raíz, con su `.test.ts`.
- **Cambio de esquema** → una migración nueva en `db/migrations/` (§8). **Nunca**
  editando `db/schema.sql` a solas: no es seguro por sí mismo (§4.3).

---

## 4 · Modelo de datos y multi-tenancy

PostgreSQL, schema `public`, **38 tablas**, sin ORM. Base: `db/schema.sql`
(656 líneas, 28 `create table`) + **66 migraciones aditivas** que añaden 10 tablas
más: `almacen_activos`, `almacen_movimientos`, `contrato_firmas`,
`doohmain_consultas_play`, `doohmain_remote_campaigns`, `doohmain_remote_lists`,
`identidades_externas`, `licencias`, `media_uploads`, `password_resets`.

### 4.1 Diagrama entidad-relación (relaciones principales)

```mermaid
erDiagram
    TENANTS ||--o{ USUARIOS : "tiene"
    TENANTS ||--|| CONFIG_NEGOCIO : "1:1 (ADR 0011)"
    TENANTS ||--o{ NOTIFICACIONES : ""
    USUARIOS ||--o{ SESIONES : "CASCADE"
    USUARIOS ||--o{ IDENTIDADES_EXTERNAS : "CASCADE (Google)"
    USUARIOS ||--o{ PASSWORD_RESETS : "CASCADE"
    USUARIOS ||--o{ ACCIONES : "bitacora append-only"

    ARRENDADORES ||--o{ ARRENDADOR_RAZON_SOCIAL : "CASCADE"
    ARRENDADORES ||--o{ PREDIOS : "RESTRICT"
    ARRENDADORES ||--o{ CONTRATOS_ARRENDAMIENTO : "RESTRICT"
    PREDIOS ||--o{ SITIOS : "aloja N pantallas"
    PREDIOS ||--o{ CONTRATOS_ARRENDAMIENTO : ""
    SITIOS ||--o{ CONTRATOS_ARRENDAMIENTO : ""
    ARRENDADOR_RAZON_SOCIAL ||--o{ CONTRATOS_ARRENDAMIENTO : ""
    CONTRATOS_ARRENDAMIENTO ||--o{ PAGOS_RENTA : "CASCADE (ADR 0007)"
    CONTRATOS_ARRENDAMIENTO ||--o{ CONTRATO_FIRMAS : "firma electronica"
    SITIOS ||--o{ SITIO_MODALIDADES : "CASCADE"
    SITIOS ||--o{ INCIDENCIAS : "CASCADE"
    SITIOS ||--o{ LICENCIAS : ""

    CLIENTES ||--o{ CLIENTES : "agencia_id (NO ACTION)"
    CLIENTES ||--o{ PROPUESTAS : ""
    CLIENTES ||--o{ CAMPANAS : ""
    CLIENTES ||--o{ FACTURAS : "RESTRICT"
    PROPUESTAS ||--o{ PROPUESTA_ITEMS : "CASCADE"
    SITIOS ||--o{ PROPUESTA_ITEMS : "RESTRICT"
    PROPUESTAS ||--o{ CAMPANAS : "SET NULL"
    CAMPANAS ||--o{ RESERVAS : "CASCADE"
    SITIOS ||--o{ RESERVAS : "RESTRICT"
    CAMPANAS ||--o{ CREATIVIDADES : "CASCADE"
    CAMPANAS ||--o{ ORDENES_COMPRA : "CASCADE"
    CAMPANAS ||--o{ ORDENES_IMPRESION : "CASCADE"
    CAMPANAS ||--o{ ORDENES_TRABAJO : ""
    SITIOS ||--o{ ORDENES_TRABAJO : ""
    ORDENES_TRABAJO ||--o{ EVIDENCIAS_OT : "CASCADE"
    CAMPANAS ||--o{ FACTURAS : "RESTRICT"
    FACTURAS ||--o{ COBRANZAS : "CASCADE"
```

**Sin relación de clave ajena en el diagrama** (a propósito): `rol_permisos` y
`folios_consecutivos` (globales a la instalación, **sin `tenant_id`**),
`almacen_activos` / `almacen_movimientos`, `media_uploads`, y las tres tablas de
caché `doohmain_*`.

### 4.2 Las tablas, una por una

| Tabla | Propósito | Campos de negocio que importan |
|---|---|---|
| `tenants` | Organización/CRM. RLS **exenta** | `slug`, `nombre_comercial`, `exigir_reautenticacion`, `rfc`, `domicilio_fiscal`, `representante_legal` |
| `usuarios` | Personas. RLS **fail-closed + FORCE** | `rol` (`rol_demo`), `password_hash` (**nunca nulo**), `debe_cambiar_password`, `activo`; `lower(email)` UNIQUE **global** |
| `sesiones` | Sesión opaca. RLS **exenta** | token 256 bits, `expira_en` (+30 d), `desbloqueo_expira_en` (ADR 0009) |
| `identidades_externas` | Vínculo con Google. fail-closed | `proveedor`, `sub` |
| `password_resets` | Restablecimiento. fail-closed desde el 07/08 | token único, **60 min**, `usado_en` |
| `rol_permisos` | RBAC. **Sin `tenant_id`, sin RLS** | `(rol, modulo, accion)`; `accion` ∈ ver·crear·aprobar·facturar (`schema.sql:75-80`) |
| `config_negocio` | Config por tenant (ADR 0011). fail-closed + FORCE, **sin DEFAULT** | `moneda` (default `'PEN'`, `schema.sql:110`), `plazos_cobranza {60,90,120}`, `iva_tasas`, `logo_token`, `email_remitente`, `max_clientes_pantalla` |
| `folios_consecutivos` | Contador atómico **global**, sin `tenant_id` | `(ambito, periodo, ultimo)` |
| `acciones` | Bitácora **append-only**: un trigger rechaza `DELETE` incluso a superusuario | `accion`, `entidad`, `usuario_nombre`, `timestamp` |
| `notificaciones` | Avisos in-app, dedupe por día | `archivada_en` (migración del 10/08) |
| `arrendadores` | Dueño del inmueble. Soft-delete | `rfc` **único por tenant** (ADR 0013); `direccion` obligatorio para el contrato, capturable desde el 11/08 |
| `arrendador_razon_social` | Entidad fiscal del arrendador | — |
| `predios` | Inmueble que aloja N pantallas | coordenadas |
| `contratos_arrendamiento` | Contrato de renta | `est_contrato` (incluye `INCOMPLETO`), `monto_renta`, `periodicidad_pago` (incluye `DIARIA`), `documento_url`, `documento_congelado` (texto sellado SHA-256) |
| `pagos_renta` | Calendario de pagos | vencimientos anclados al **inicio** del contrato (ADR 0007) |
| `contrato_firmas` | Firma electrónica | hash del documento congelado, token |
| `licencias` | Permisos legales del sitio | — |
| `sitios` | **La pantalla física** | `clave_interna` / `codigo_proveedor` UNIQUE **globales** (`schema.sql:124-125`), `caras`, `total_spots`, `max_clientes` (ADR 0008), `en_network`, tres estatus (comercial/legal/operativo), `fotos text[]`, `imagen_promocional`. `renta_arrendador` y `periodicidad_renta` están **DEPRECADAS** (`schema.sql:179-181`) |
| `sitio_modalidades` | Formas de venta (mensual, catorcenal, spot, hora) | tarifa por modalidad |
| `incidencias` | Averías del sitio | — |
| `almacen_activos` / `almacen_movimientos` | Activos físicos y traslados | — |
| `clientes` | Anunciante o agencia. Soft-delete | autorreferencia `agencia_id`, `iva_pct` (default 16) |
| `propuestas` | Cotización | `folio` UNIQUE, `token_publico` UNIQUE, `comision_pct` (**divisor**), `descuento_pct` (**descuento**), `aceptado_en/por/ip` |
| `propuesta_items` | Líneas de la cotización | `spotsPorDia` |
| `campanas` | La venta ejecutada | `folio` UNIQUE, `portal_token` UNIQUE, `estado_comercial`, **candado** (`oc_recibida` + `fotos_comprobatorias` + `reporte_publicacion`), `enviada_dominio`, `validacion_estatus`, `moneda` default `'PEN'` (`schema.sql:390`) |
| `reservas` | Ocupación sitio × fechas | `estatus` (`TENTATIVA` caduca por `expira_en`), `creativos jsonb` (asignación por pantalla, INC-02) |
| `creatividades` | Piezas (imagen o HTML) | `codigo` (HTML), `estatus`, `retirado_en` |
| `ordenes_compra` | ODC del cliente | `folio` UNIQUE |
| `ordenes_trabajo` | OT de campo | `tipo_ot`, `est_ot`, `asignado_a` (**solo se escribe al crear o al cerrar**), folio |
| `evidencias_ot` | Prueba fotográfica | foto (base64 o key S3), `lat`/`lng`/`precision_m`, **`tomada_en` (EXIF) ≠ `timestamp` (subida)** |
| `ordenes_impresion` | Imprenta | `prueba_color_url`, `prueba_color_aprobada`, folio `OI-2026-NNNN` |
| `facturas` | CFDI simulado | `folio` UNIQUE, `folio_fiscal`, snapshot fiscal (`rfc`, `razon_social`, `uso_cfdi`, `serie`), `igv` (nombre heredado de Perú, `schema.sql:542-545`), `moneda` default `'PEN'` |
| `cobranzas` | Seguimiento del cobro | `plazo_dias` (90), `fecha_vencimiento`, `recordatorio_en`, `recordatorios_enviados`, parcialidades |
| `doohmain_consultas_play` · `doohmain_remote_campaigns` · `doohmain_remote_lists` | Caché de la integración DOOHmain | guardan la respuesta **cruda** de la API |
| `media_uploads` | Registro de subidas | — |

### 4.3 Aislamiento entre organizaciones (lo más importante de este capítulo)

- **RLS de Postgres por `app.tenant_id`.** Todas las tablas con `tenant_id` tienen
  RLS **fail-closed + FORCE**, salvo las exentas por bootstrap: `tenants`,
  `sesiones`, `rol_permisos`, `folios_consecutivos`.
- **Doble capa.** Además de la RLS, la aplicación añade `and tenant_id = $n`
  explícito en toda operación por id. Las dos capas son intencionales; no quites una
  «porque la otra ya protege».
- **El tenant se fija por transacción**: `set_config('app.tenant_id', …, true)`,
  transaction-local (`db.ts:59`).

> [!danger] `db/schema.sql` por sí solo **NO es seguro**
> Crea políticas RLS *permisivas* (`schema.sql:619-622`, `with check (true)`). El
> endurecimiento fail-closed llega **por migración**
> (`20260715_arr_m5_rls_failclosed.sql`, `20260720_hard1_*.sql`). Una base levantada
> solo con `schema.sql` **no aísla nada**.

> [!danger] Comentario obsoleto y peligroso
> `tenant.ts:12-15` dice «la conexión sigue siendo superuser, así que RLS no aplica».
> Ese comentario **sigue en el código y ya no es cierto**. No lo tomes como permiso
> para saltarte nada.

**Las cinco puertas a la base** (`lib/server/db.ts`) — usa la primera salvo que
sepas exactamente por qué no:

| Puerta | Qué hace | Cuándo |
|---|---|---|
| `q` / `q1` | Fijan el tenant de la sesión | **Por defecto, siempre** |
| `qRaw` / `qRaw1` | **No** fijan tenant | Solo bootstrap |
| `qConTenant` | Tenant explícito, sin sesión | Rutas por token, cron |
| `fijarTenant` / `fijarTenantExplicito` | Dentro de una transacción | Casos compuestos |

**Las 21 tablas con `DEFAULT` de `tenant_id` a `rgb`** (`schema.sql:615`) son la
causa conocida de la deriva de datos: un `INSERT` que olvide el tenant **no falla,
miente**. `config_negocio` se dejó **sin default a propósito**
(`schema.sql:630-633`).

### 4.4 Las organizaciones en producción

> Dato declarado por el equipo en el inventario (no derivable del código). **Manda
> sobre cualquier suposición.**

- `rgb` — tenant de **plataforma**, **vacío**; su Dueño es el único que puede cambiar
  de CRM (`tenant.ts:26-29`).
- `g500` — la que tiene los datos de negocio reales (nombre comercial **PIXELED**).
- `eyro` — **perfil de pruebas del usuario**, pero **publica de verdad** en DOOHmain.
  Es decir: no es un sandbox; lo que hagas ahí sale a pantallas reales.

---

## 5 · API (el BFF)

**88 archivos `route.ts`, 110 métodos HTTP**, todos bajo
`https://demo.space-os.io/spaces-dooh/api/…`. **Ningún** endpoint de `_archive/api`
está desplegado. La tabla completa vive en [[api-endpoints]] (con un desfase
conocido, ver §5.5).

### 5.1 Regla número uno para quien añada un endpoint

> [!danger] El middleware **no valida la sesión** y las rutas `/api/` quedan fuera del gate
> `middleware.ts:85-104` solo comprueba que la cookie **exista**. **Un endpoint nuevo
> sin guard queda abierto a internet.** El guard se pone en el handler, siempre.

### 5.2 Leyenda de guards

| Guard | Qué exige |
|---|---|
| `PÚBLICO` | Sin sesión: o se auto-protege por token, o es bootstrap |
| `exigir(modulo, accion)` | Sesión válida + permiso (`lib/server/auth.ts:146`) |
| `SENSIBLE` | `exigirCambioSensible`: permiso **+ desbloqueo** vigente (ADR 0009) |
| `DESBLOQ` | `exigirDesbloqueo` añadido |
| `REAUTH` | `exigirReautenticacionSiempre` |

### 5.3 Endpoints por área

#### Autenticación y cuenta

| Método | Ruta | Guard | Entrada | Salida |
|---|---|---|---|---|
| POST | `/api/auth/login` | PÚBLICO (10/5 min por IP) | `{email,password}` | `{usuario,permisos}` + 2 cookies |
| POST | `/api/auth/logout` | PÚBLICO (exento de CSRF) | — | 200 |
| GET | `/api/auth/me` | `usuarioActual` | — | usuario o 401 |
| GET | `/api/auth/metodos` | PÚBLICO | — | `{google:bool}` |
| POST | `/api/auth/forgot` | PÚBLICO (5/15 min IP + 3/h correo) | `{email}` | 200 genérico |
| GET·POST | `/api/auth/reset` | PÚBLICO | token / token+password | valida / aplica |
| GET | `/api/auth/google/inicio` | PÚBLICO (10/5 min IP) | `?alta=1&organizacion=` | 302 a Google · **503 si apagado** (`inicio/route.ts:50,63`) |
| GET | `/api/auth/google/callback` | PÚBLICO | `code` + `state` | 302 con sesión (`callback/route.ts:80,166`) |
| POST | `/api/signup` | PÚBLICO (5/h IP) | `{organizacion,nombre,email,password}` | 201 · **503 si apagado** (`signup/route.ts:19,26`) |
| PATCH | `/api/perfil` | `usuarioActual` | exige `passwordActual` | usuario |
| GET | `/api/permisos` | `exigir('administracion','ver')` | — | matriz |
| GET | `/api/admin/permisos-matriz` | `exigir('administracion','ver')` | — | matriz + áreas |

#### Organización, usuarios y plataforma

| Método | Ruta | Guard |
|---|---|---|
| GET·POST | `/api/usuarios` | `exigir('administracion','ver'\|'crear')` — acepta `entraConGoogle` |
| PATCH·DELETE | `/api/usuarios/[id]` | `exigir('administracion','crear')` |
| POST | `/api/usuarios/[id]/restablecer` | **REAUTH + DESBLOQ** |
| GET·POST | `/api/tenants` | `exigir('administracion','crear')` **en ambos** (`tenants/route.ts:13,22`) |
| POST | `/api/tenant-activo` | `exigir()` |
| PATCH | `/api/organizacion` | `exigir('administracion','crear')` |
| GET·PATCH | `/api/config` | `exigir('administracion','ver'\|'crear')` |
| GET·PUT | `/api/cambios` | `exigir()` / `exigir('administracion','aprobar')` |
| POST·DELETE | `/api/cambios/desbloquear` | `exigir()` (5/5 min por usuario+IP) |
| GET | `/api/estado` | `exigir()` + filtro por permiso, rebanada a rebanada (`estado/route.ts:44-57`) |
| GET | `/api/integraciones` | `exigir('administracion','ver')` |

> [!warning] `GET /api/estado` no es un `GET` inocente
> Devuelve **todo el tenant** que el rol puede ver **y dispara cuatro barridos de
> mantenimiento en paralelo** (`estado/route.ts:63-70`), entre ellos
> `recomputarEstadoCampanas()` y `recomputarEstatusArrendadores()`: **escribe en la
> base**. Es el endpoint más caro del sistema y el que sustituye a un cron.

#### Inventario

| Método | Ruta | Guard |
|---|---|---|
| GET·POST | `/api/sitios` | `exigir('network','ver')` / `exigir('inventario','crear')` |
| PATCH·DELETE | `/api/sitios/[id]` | `exigir('inventario','crear')` + **DESBLOQ** |
| GET | `/api/sitios/[id]/media` | `exigir('network','ver')` |
| POST·DELETE | `/api/sitios/[id]/pausa-legal` | `exigir('arrendadores','crear')` |
| POST | `/api/sitios/[id]/reubicar` | `exigir('arrendadores','crear')` |
| GET | `/api/sitios/[id]/space-eye` | `exigir('comercial','ver')` |
| POST | `/api/sitios/import` | `exigir('inventario','crear')` |
| POST·PATCH | `/api/predios`, `/api/predios/[id]`, `/api/predios/[id]/pantallas` | `exigir('arrendadores','crear')` |
| POST | `/api/incidencias` | `exigir('arrendadores','crear')` |
| GET·POST | `/api/almacen`, `/api/almacen/[id]/movimiento` | `exigir('operaciones','ver'\|'crear')` |
| POST·PATCH·DELETE | `/api/licencias`, `/api/licencias/[id]` | `exigir('arrendadores','crear'\|'aprobar')` |

#### Arrendadores y contratos

| Método | Ruta | Guard |
|---|---|---|
| POST | `/api/arrendadores` | `exigir('arrendadores','crear')` |
| PATCH·DELETE | `/api/arrendadores/[id]` | **SENSIBLE** |
| POST | `/api/contratos` | **SENSIBLE** |
| PATCH | `/api/contratos/[id]` | **SENSIBLE** |
| POST | `/api/contratos/[id]/cancelar` · `/renovar` | **SENSIBLE** |
| GET | `/api/contratos/[id]/documento` | `exigir()` + `siAlguno(['arrendadores','finanzas'])` |
| GET·POST | `/api/contratos/[id]/firma` | `exigir('arrendadores','ver'\|'crear')` |
| PATCH | `/api/pagos-renta/[id]` | `exigir('arrendadores','crear')` |
| POST | `/api/pagos-renta/[id]/pagar` | **SENSIBLE** |
| GET | `/api/pagos-renta/[id]/adjunto/[tipo]` | `exigir('arrendadores','ver')` |
| POST·PATCH·DELETE | `/api/razones-sociales`, `/[id]` | `exigir('arrendadores','crear')` |

#### Comercial

| Método | Ruta | Guard |
|---|---|---|
| POST·PATCH | `/api/clientes`, `/api/clientes/[id]` | `exigir('comercial','crear')` |
| POST·PATCH | `/api/propuestas`, `/api/propuestas/[id]` | `exigir('comercial','crear')` |
| PATCH | `/api/propuestas/items/[id]` | `exigir('comercial','crear')` |
| POST | `/api/propuestas/[id]/generar-campana` | `exigir('comercial','crear')` |
| POST | `/api/reservar` | `exigir('comercial','crear')` |
| PATCH | `/api/reservas/[id]/creativo` | `exigir('comercial','crear')` |
| POST·PATCH·DELETE·PUT | `/api/creatividades`, `/[id]` | `exigir('comercial','crear')` |
| GET | `/api/creativos/[id]/arte` | `exigir('comercial','ver')` |
| POST | `/api/campanas/[id]/{confirmar,contrato,extender,oc,validar,creativos/repartir,enviar-dominio}` | `exigir('comercial','crear')` |
| GET·POST | `/api/campanas/[id]/playlogs` | `exigir('comercial','ver'\|'crear')` |
| POST | `/api/campanas/[id]/facturar` | **SENSIBLE** |
| POST | `/api/ordenes-compra` | `exigir('comercial','crear')` |

#### Operaciones, imprenta y finanzas

| Método | Ruta | Guard |
|---|---|---|
| GET·POST | `/api/ot` | `exigir('operaciones','ver'\|'crear')` |
| GET | `/api/ot/[id]` | `exigir('operaciones','ver')` — **no hay `PATCH`** |
| POST | `/api/ot/[id]/cerrar` | `exigir('operaciones','crear')` |
| GET·POST·PATCH | `/api/impresion`, `/[id]`, `/[id]/prueba-color` | `exigir('imprenta','ver'\|'crear')` |
| POST | `/api/cobranzas/[id]/pagar` | **SENSIBLE** |
| POST | `/api/cobranzas/[id]/recordar` | `exigir('finanzas','crear')` |

#### Notificaciones

| Método | Ruta | Guard |
|---|---|---|
| GET | `/api/notificaciones/nuevas` | `exigir()` |
| POST | `/api/notificaciones/[id]/leer` | `exigir()` |
| POST | **`/api/notificaciones/archivar-todas`** | `exigir()` — **sustituyó a `leer-todas`**, que hoy da 404 |

#### Públicos por token (sin sesión, exentos de CSRF)

| Método | Ruta | Credencial |
|---|---|---|
| GET | `/api/portal/[token]` | `campanas.portal_token` |
| GET·POST | `/api/firma/[token]` | token de firma |
| GET·POST | `/api/propuestas/publica/[id]` | `propuestas.token_publico` |
| GET | `/api/logo/[token]` | `config_negocio.logo_token` |

El tenant de estas rutas lo deriva **Postgres** a partir del token
(`portal_tenant_por_token()`, `propuesta_tenant_por_token()`), **nunca el cliente**.
Si añades una ruta pública por token, sigue ese patrón.

#### Cron

| Método | Ruta | Credencial |
|---|---|---|
| POST | `/api/recordatorios` | header `x-recordatorios-token` == `RECORDATORIOS_TOKEN`; **503 si la variable falta** (`recordatorios/route.ts:39,49-53`) |

### 5.4 Endpoints que **no existen** (y la gente busca)

- **No existe `PATCH /api/campanas/[id]`.** El estado comercial lo recalcula el
  sistema desde `GET /api/estado` (`estado/route.ts:10,63-70`).
- **No existe `PATCH /api/ot/[id]`**: no hay forma de reasignar una OT ya creada
  (`app/api/ot/[id]/route.ts` solo exporta `GET`).
- **No existe `/api/notificaciones/leer-todas`** (404 verificado en producción el
  10/08).

### 5.5 Desfase con la bóveda

[[api-endpoints]] lista `POST /api/notificaciones/leer-todas`
(`api-endpoints.md:165`), que **ya no existe**, y **omite** `archivar-todas`. Es el
**único** desfase de esa tabla; todo lo demás cuadra (inventario D-1).

### 5.6 Los flujos de negocio, de punta a punta

Detalle completo en [[flujo-propuesta-a-campana]],
[[flujo-facturacion-y-cobranza]] y [[flujo-orden-de-trabajo]]. Resumen operativo:

**De propuesta a campaña publicada (el flujo principal):**

1. Comercial crea la propuesta → `POST /api/propuestas` → `propuestas` +
   `propuesta_items`, con folio consecutivo. **Gate:** una agencia con negociación sin
   validar **bloquea**.
2. Comparte la liga pública; el cliente acepta en `/p/[id]` →
   `POST /api/propuestas/publica/[id]` → escribe `aceptado_en`, `aceptado_por`,
   `aceptado_ip`.
3. `POST /api/propuestas/[id]/generar-campana` — **idempotente**; **exige contrato
   completo** (ADR 0003) → inserta `campanas` + `reservas`.
4. `POST /api/creatividades` → `POST /api/campanas/[id]/validar` →
   `POST /api/campanas/[id]/creativos/repartir`.
5. `POST /api/campanas/[id]/enviar-dominio` → publica; con
   `DOOHMAIN_PUBLISH_ENABLED=1` **sale por el SDK Python a pantallas reales**.
6. El estado comercial **lo recalcula el sistema** en `GET /api/estado`
   (`estado/route.ts:10,63-70`), detrás de `comercial.ver`. No lo pongas a mano: no
   hay `PATCH`.

**Orden de trabajo en campo → destraba el dinero:**

- Origen **automático** (`operaciones-eventos.ts`: cancelar contrato → OT `RETIRO`;
  alta de pantalla fija → OT `MONTAJE`, a mejor esfuerzo) o **manual**
  (`POST /api/ot`).
- La cuadrilla abre `/m/ot/[id]` → `POST /api/ot/[id]/cerrar` con fotos → validación
  por **magic bytes** (`uploads.ts`) → fecha EXIF a `tomada_en` → S3 si
  `storageHabilitado()`, si no **data URL**.
- Escribe `evidencias_ot` y pasa la OT a `COMPLETADA`; si hay campaña ligada,
  enciende `campanas.fotos_comprobatorias` y `reporte_publicacion` — que son dos de
  los tres cerrojos del candado de facturación.

**Facturación y cobranza:**

- `POST /api/campanas/[id]/facturar` con
  `exigirCambioSensible('finanzas','facturar')`: permiso **+ desbloqueo**.
- **Candado por segmento:** OC + fotos + reporte. **Doble factura → 409.**
- Escribe `facturas` (folio consecutivo + snapshot fiscal) + `cobranzas` (plazo
  tomado de `config_negocio.plazos_cobranza`) + `notificaciones`.
- Cobro en parcialidades: las cuotas deben sumar exacto, el abono se acota al saldo,
  y `POST /api/cobranzas/[id]/pagar` también es **SENSIBLE**.

**Alta de pantalla → contrato de arrendamiento:**

- `POST /api/sitios` (o `POST /api/sitios/import` con Excel). **ADR 0002:** el
  arrendador es obligatorio; `contratos-sitio.ts` abre un contrato que **nace
  `INCOMPLETO`** (ADR 0001), y eso **bloquea reservar** (ADR 0003).
- Desde el **11/08** el alta de arrendador guarda `direccion` y la lista permite
  editar arrendadores existentes (commit `504b4fc`): el `PATCH` ya existía y **no lo
  llamaba ninguna pantalla**. Ese commit **aún no está desplegado** (§9.6).

---

## 6 · Autenticación, sesión y permisos

Nota de bóveda: [[autenticacion-y-sesion]] describe bien el mecanismo, pero **sus
citas de línea de `auth.ts` están 4 líneas corridas** (inventario D-3). Usa estas:

| Símbolo | Línea real hoy (`auth.ts`, 226 líneas) |
|---|---|
| `passwordAleatoria` | 55 |
| `hashPassword` | 83 |
| `crearSesion` | 92 |
| `usuarioActual` | 108 |
| `exigir` | 146 |
| `cookieSecure` | 184 |
| `cookieSesion` | 191 |
| `cookieCsrf` | 216 |

Y la **política de contraseñas ya no vive en `auth.ts`**: está en
`apps/web/lib/password.ts:26-31` (fuera de `server-only`, para que los formularios
puedan importarla); `auth.ts:31-38` solo la reexporta (commit `cde5f58`, 10/08).
Es el origen de verdad para tres formularios y una prueba que los vigila
(inventario D-4).

### 6.1 Login con contraseña

`POST /api/auth/login` (**exento de CSRF**, `middleware.ts:48`) → rate limit
10/5 min → función `auth_usuario_por_email()` **SECURITY DEFINER** → `verifyPassword`
(bcrypt) → `crearSesion()` (`auth.ts:92`) → dos cookies:

- `spaces_sesion` — **httpOnly**, 30 días (`auth.ts:191-202`).
- `spaces_csrf` — **`httpOnly:false` a propósito** (`auth.ts:216-226`): el cliente
  tiene que leerla para reenviarla.

Inserta una fila en `sesiones`. En la petición siguiente: `exigir()` (`auth.ts:146`)
→ `tenantActual()` (`tenant.ts:32-41`) → `set_config('app.tenant_id', …, true)`
(`db.ts:59`) → la RLS filtra.

**Corte por contraseña caducada:** si `debe_cambiar_password`, `exigir()` cierra
todo salvo `GET /api/auth/me` y `PATCH /api/perfil`.

### 6.2 Google (ADR 0012 + enmienda)

- `GET /api/auth/google/inicio` — 503 si no está habilitado (`inicio/route.ts:50`),
  rate limit 10/5 min (`:63`), genera `state` + `nonce` + PKCE (`:93-95`) y tres
  cookies cortas httpOnly.
- **Alta de organización** con `?alta=1&organizacion=…`: el nombre viaja en la cookie
  `COOKIE_ALTA_ORG`, **nunca en el `state`** (`inicio/route.ts:71-90`).
- `GET /api/auth/google/callback` — valida claims, resuelve por `sub` vía
  `auth_usuario_por_identidad()` y **vuelve a comprobar** `autoregistroHabilitado()`
  (`callback/route.ts:166`). Termina en `crearSesion()` (`:80`).

> **Invariante que no debes romper:** un alta «entra con Google» **genera igualmente
> un `password_hash`** (`cuentas-controller.ts:76-77`, `passwordDeAlta`). Sin él, la
> persona no podría desbloquear operaciones de dinero.

### 6.3 Las tres capas de control de acceso

| Capa | Qué comprueba | Evidencia | ¿Es seguridad? |
|---|---|---|---|
| `middleware.ts` | Que **exista** la cookie `spaces_sesion` | `middleware.ts:85-104` | **No** (UX) |
| `AuthGate` (cliente) | Sesión real + rol contra el módulo del `NAV` | `AuthGate.tsx:18-23` | **No** (UX) |
| `exigir()` en cada handler | Sesión válida + permiso `modulo/accion` | `auth.ts:146` | **SÍ** |

`AuthGate` usa el **mismo** arreglo `NAV` que pinta el menú (`AuthGate.tsx:9,18-23`),
así que menú y control de acceso no se desincronizan.

### 6.4 Permisos y cambios sensibles

- `rol_permisos` guarda `(rol, modulo, accion)` con `accion` ∈
  **ver · crear · aprobar · facturar** (`schema.sql:75-80`).
- **Es global a la instalación**: no tiene `tenant_id`. Cambiar los permisos de un rol
  se los cambia **a las cinco organizaciones**. Ver §10.
- Operaciones de dinero y de contrato exigen **desbloqueo** además del permiso
  (`exigirCambioSensible`, ADR 0009, `sesiones.desbloqueo_expira_en`). Si falta,
  el handler responde **403 `{requiereDesbloqueo:true}`** y la UI abre
  `DesbloqueoCambios`.

### 6.5 Recuperación de contraseña

`/login` modo `forgot` → `POST /api/auth/forgot` (5/15 min por IP + 3/h por correo) →
correo con enlace → `/recuperar/[token]` → `GET /api/auth/reset` valida →
`POST /api/auth/reset` aplica. Token de 256 bits, **60 minutos**, un solo uso
(`password-reset-repo.ts:36`); al consumirlo **borra todas las sesiones del usuario**
(`password-reset-repo.ts:121`).

**Estado:** apagado en producción por `NEXT_PUBLIC_RECUPERAR_PASSWORD` (no hay correo
saliente). La tabla es **fail-closed desde el 07/08**: leer va por
`auth_reset_por_token()` SECURITY DEFINER, escribir por `qConTenant`
(`password-reset-repo.ts:21-24,64`).

### 6.6 Autorregistro — **abierto en producción**

Cualquiera con la URL puede crear una organización desde `/login` modo `signup`
(`login/page.tsx:134`) → `POST /api/signup` (`signup/route.ts:21`). Guardas: **503**
salvo `AUTOREGISTRO=1` (fail-closed desde el 14/08: ausente = apagado) y rate limit **5/hora por IP** (`:28`).
Cadena: `registrarCuentaCtrl` → `crearOrgConDueno` → `crearTenant()` + `crearUsuario()`
(`cuentas-controller.ts:41-63`); inserta en `tenants` y `usuarios` (rol `DUENO`) y
`config_negocio` obtiene su fila.

> [!warning] La bandera se hornea en el build
> `NEXT_PUBLIC_*` se resuelve al compilar: **apagar el autorregistro exige
> recompilar y redesplegar**, no basta con editar el `.env`.

---

## 7 · Entornos y configuración

### 7.1 Local

> [!danger] El `README.md` de la raíz te va a mandar por el camino equivocado
> Describe la **pista archivada**: Fastify + Prisma + Redis + BullMQ, `npx prisma
> migrate deploy`, `infra/scripts/new-tenant.sh` y un API en el puerto 3001
> (`README.md:7,14,27`). Nada de eso corre hoy (§1.3, §2). **Este capítulo manda
> sobre el README.** Lo mismo con `db/README.md`, cuyas secciones 3 y 4 hablan de
> «cablear un API» y de datos en memoria: son anteriores al BFF.

#### Requisitos

| Pieza | Versión | Evidencia |
|---|---|---|
| Node | **≥ 18** | `package.json:21-23` |
| npm | **10.8.2** (declarado en `packageManager`) | `package.json:24` |
| PostgreSQL | **16** (imagen `postgres:16-alpine`) | `db/docker-compose.yml:15` |
| Docker | necesario para la base y para las pruebas de integración | `db/docker-compose.yml` |

El `README.md` de la raíz pide Node 20; el `engines` del repo dice `>=18`. Manda
el `engines`, y con Node 20 también funciona.

#### Primer arranque, en orden

```bash
# 1 · Dependencias — desde la RAÍZ, es un monorepo con workspaces (apps/*, packages/*)
npm install

# 2 · Base de datos: Postgres en 5433 (no 5432) y Adminer en 8081
cd db && docker compose up -d && cd ..
```

`db/schema.sql` se carga **solo la primera vez**, al crear el volumen. Las tablas
quedan vacías; lo que insertes persiste entre `docker compose stop` / `up`.
Para empezar de cero otra vez: `docker compose down -v && docker compose up -d`
— borra todo.

```bash
# 3 · Rol de aplicación restringido (SIN esto no estarías probando la RLS)
psql postgresql://spaces:spaces@localhost:5433/spaces -f db/dev-rol-app.sql
node scripts/apply-migration.mjs db/migrations/20260715_arr_m6_rol_restringido.sql
```

```bash
# 4 · Conexión de la app — apps/web/.env.local
DATABASE_URL=postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces
```

```bash
# 5 · Arrancar
npm run dev        # desde la raíz (turbo) — la web queda en :3000, bajo /spaces-dooh
```

> [!danger] Conéctate como `spaces_app`, no como `spaces`
> `spaces` es **superusuario** y **salta la RLS**. Si apuntas ahí tu
> `DATABASE_URL`, el aislamiento entre organizaciones pasará todas tus pruebas
> en local y fallará en producción (§4.3). En producción el rol equivalente es
> `spaces_user`, y ya existe: las migraciones no crean roles a propósito, porque
> un `.sql` que viaja en el repo plantaría una contraseña conocida en prod.

> [!danger] No levantes la base solo con `schema.sql`
> Sin las migraciones de endurecimiento, la RLS queda **permisiva** (§4.3) y tu
> entorno local no se parecerá al de producción justo en lo que más importa.
> Y ojo con el contenedor viejo: como `schema.sql` corre una sola vez, un
> `spaces_db` levantado hace semanas tiene el esquema de hace semanas. Ya pasó —
> una máquina sin `config_negocio.tenant_id` daba por buenas pruebas que corrían
> contra otro esquema (`lib/test/db-e2e.ts:12-19`).

#### Los scripts que existen

**Raíz** (`package.json:4-10`) — todos delegan en turbo, que los propaga a los
workspaces:

| Comando | Qué hace |
|---|---|
| `npm run dev` | `turbo run dev` |
| `npm run build` | `turbo run build` |
| `npm run lint` | `turbo run lint` |
| `npm run check-types` | `turbo run typecheck` |
| `npm run format` | `prettier --write "**/*.{ts,tsx,md}"` |

**`apps/web`** (`apps/web/package.json:5-13`) — aquí está el producto:

| Comando | Qué hace |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` |
| `npm start` | `next start -p 3000` |
| `npm run lint` | `next lint` |
| `npm test` | `vitest run` — unitarias |
| `npm run test:e2e` | `vitest run --config vitest.e2e.config.ts` — integración |
| `npm run typecheck` | `tsc --noEmit` |

**`packages/ui`** tiene `lint`, `check-types` y `generate:component`. Los demás
paquetes (`types`, `utils`, `eslint-config`, `typescript-config`) **no tienen
scripts**: son librerías que se consumen desde el código.

> [!warning] No hay `test` en la raíz
> `npm test` desde la raíz no corre nada. Las pruebas se lanzan **desde
> `apps/web`**.

#### 7.1.1 Cómo verifico mi cambio antes del PR

**Unitarias** — no necesitan Docker ni base de datos:

```bash
cd apps/web
npm test
```

Corren `lib/**/*.test.ts` y `components/**/*.test.ts` en entorno `node`,
excluyendo `*.e2e.test.ts` (`vitest.config.ts`). El guard `server-only` de Next
se sustituye por un stub para poder importar los controllers.
**Estado verificado el 11/08/2026: 71 ficheros, 789 pruebas, todas en verde, 15 s.**

**Integración** — Postgres real y **el servidor de Next de verdad**, no simulados:

```bash
# 1 · Postgres arriba
cd db && docker compose up -d && cd ..

# 2 · La base dedicada — una sola vez en la vida de la máquina
docker exec spaces_db psql -U spaces -d postgres -c "create database spaces_e2e"

# 3 · BUILD DE PRODUCCIÓN — sin esto no arrancan (ver el aviso de abajo)
npx turbo run build --filter=web

# 4 · Correr
cd apps/web
npm run test:e2e
```

> [!danger] Sin `next build` previo, las e2e fallan en bloque y el mensaje no te
> dice por qué
> El arnés levanta el servidor con `npx next start` y **reutiliza el build
> existente** (`lib/test/servidor-e2e.ts:18-21,30`). Si en `.next/` solo hay
> artefacto de `next dev` —no hay `BUILD_ID` ni `server/`—, `next start` muere al
> instante con *«Could not find a production build»*… pero el arnés lanza el
> proceso con **`stdio: 'ignore'`** (`servidor-e2e.ts:85`), así que ese error
> **no se ve en ninguna parte**. Lo que ves es cada fichero esperando 60 s y
> muriendo con «El servidor de pruebas no respondió», y una corrida de **10
> minutos** que no explica nada.
> **Comprobación de un vistazo:** `ls apps/web/.next/BUILD_ID`. Si no existe, no
> hay build de producción.

Van en **serie** (`fileParallelism: false`): comparten una sola base y cada
fichero **recrea el esquema desde cero**. Los timeouts son altos a propósito
(30 s por prueba, 60 s por hook) porque recrear y sembrar cuesta segundos.

El servidor de pruebas escucha en **`127.0.0.1:3311`** (`PUERTO_E2E`), corre con
`NODE_ENV=production`, `COOKIE_SECURE=0` (las pruebas hablan por HTTP y una
cookie `Secure` no se guardaría), autorregistro **cerrado** y Google **encendido**
contra un doble local — al revés que producción en esos dos últimos, y a
propósito: es la única forma de ejercer esos flujos.

Van en **serie** (`fileParallelism: false`): comparten una sola base y cada
fichero **recrea el esquema desde cero**. Los timeouts son altos a propósito
(30 s por prueba, 60 s por hook) porque recrear y sembrar cuesta segundos.

**Estado verificado el 11/08/2026: 12 ficheros, 136 pruebas en verde + 1 omitida,
56 s.** Coincide con la cifra del diario.

Usan **dos conexiones**, y esa distinción es lo que las hace válidas:

| Variable | Rol | Default si no la pones |
|---|---|---|
| `DATABASE_URL_TEST` | `spaces` — superusuario, **salta la RLS**; siembra datos de varios tenants | `postgresql://spaces:spaces@localhost:5433/spaces_e2e` |
| `DATABASE_URL_TEST_APP` | `spaces_app` — **respeta la RLS**; equivale a `spaces_user` en prod | `postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces_e2e` |

> [!danger] El arnés hace `drop schema public cascade` en cada corrida
> La base del demo local se llama **`spaces`** a secas y ahí se suben pantallas,
> campañas y **creativos con sus imágenes**. Apuntar ahí el arnés la borra entera
> (`lib/test/db-e2e.ts:21-30`). Por eso exige un nombre que acabe en `_e2e` o
> `_test` y un host local, y aborta si no. **Deja las dos variables vacías** salvo
> que sepas exactamente lo que haces; los defaults ya apuntan a `spaces_e2e`.

Las otras variables del arnés (`PUERTO_E2E`, `PUERTO_DOBLE_GOOGLE`,
`GOOGLE_DOBLE_SUB`, `GOOGLE_DOBLE_EMAIL`, `GOOGLE_AUTH_ENDPOINT`) levantan el
servidor de pruebas y el doble de Google; ver §7.3.

**Antes de abrir el PR**, además: `npm run lint` y `npm run typecheck`.

### 7.2 Producción

| Pieza | Valor | Evidencia |
|---|---|---|
| Host | Droplet de DigitalOcean | [[entorno-y-despliegue]] |
| Dominio | `https://demo.space-os.io`, ruta pública `/spaces-dooh/` | `next.config.mjs:19-20` |
| Directorio | `/var/www/Spaces` | `deploy.yml:88` |
| Proceso | pm2 `spaces-web`, **fork, 1 instancia**, puerto 3000, usuario `emiliano` | `ecosystem.config.js:10-12` |
| Base | `spaces_prod`; las migraciones se aplican como rol `postgres` | `deploy.yml:14-19` |
| Reverse proxy | nginx TLS + HSTS, `proxy_pass http://spaces_web` | `demo.space-os.io.conf:68-70,112` |

La bóveda registra una IP del droplet marcada como **vieja** en
[[entorno-y-despliegue]]; **no la copies aquí ni la uses sin confirmarla**.

Dos detalles de infraestructura que parecen erratas y **son deliberados**:

- `X-Forwarded-For $remote_addr` (`demo.space-os.io.conf:123`) **reemplaza** la
  cabecera en vez de añadir. Es lo que impide que un cliente se elija su propio cubo
  de rate limit.
- `instances: 1` en pm2 es lo que hace que el limitador **en memoria** funcione.

### 7.3 Variables de entorno (solo **nombres**; los valores viven fuera de git)

Los valores están en `apps/web/.env.production` **del droplet**, cubierto por
`.gitignore`. Nunca los pegues en la bóveda, en un issue ni en un PR.

**Leídas por el código vivo:**

| Variable | Para qué | Evidencia |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres | `lib/server/db.ts` |
| `NODE_ENV` | Modo y default de `Secure` | `auth.ts:187` |
| `COOKIE_SECURE` | Fuerza o apaga `Secure` en las cookies | `auth.ts:184-188` |
| `APP_URL` | Base de los enlaces de los correos (5 usos) | `api/auth/forgot/route.ts` |
| `HSTS` | Cabecera Strict-Transport-Security | `next.config.mjs:51` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo saliente — hacen falta **las dos** | `lib/server/email.ts` |
| `RECORDATORIOS_TOKEN` | Autentica el cron; sin ella la ruta da **503** | `api/recordatorios/route.ts:39,49` |
| `AUTOREGISTRO` | Solo `'1'` enciende el alta pública (UI **y** servidor). **Sin prefijo NEXT_PUBLIC_ desde el 14/08: se lee al arrancar, no se hornea** | `lib/entorno.ts` |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD` | Apaga «recuperar contraseña» | `login/page.tsx:24` |
| `NEXT_PUBLIC_MAPTILER_KEY` | Mapas | `components/maps/SitiosMap.tsx` |
| `DO_SPACES_KEY` · `DO_SPACES_SECRET` · `DO_SPACES_ENDPOINT` · `DO_SPACES_BUCKET` · `DO_SPACES_CDN_URL` | Almacenamiento S3 | `lib/server/storage.ts` |
| `GOOGLE_OAUTH` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` · `GOOGLE_TOKEN_ENDPOINT` | Acceso con Google | `lib/server/google-oauth.ts` |
| `SPACE_EYE_BASE_URL` · `SPACE_EYE_USER` · `SPACE_EYE_PASS` | Verificación por cámaras | `lib/server/space-eye.ts` |
| `DOOHMAIN_PUBLISH_ENABLED` · `DOOHMAIN_PY` · `DOOHMAIN_SDK_DIR` · `DOOHMAIN_SCREEN_MAP` · `DOOHMAIN_DEFAULT_SCREEN` | Publicación por subproceso Python | `lib/server/doohmain.ts` |
| `ADMOBILIZE_API_KEY` · `CMS_API_TOKEN` · `CFDI_PAC_KEY` | Conectores en **modo demo simulado** | `lib/server/integraciones.ts` |
| `MEDIR_ESTADO` | `=1` imprime kB por rebanada de `/api/estado` | `api/estado/route.ts` |
| `TZ` | Zona horaria | — |

**Solo pruebas:** `DATABASE_URL_TEST`, `DATABASE_URL_TEST_APP`, `PUERTO_E2E`,
`PUERTO_DOBLE_GOOGLE`, `GOOGLE_DOBLE_SUB`, `GOOGLE_DOBLE_EMAIL`,
`GOOGLE_AUTH_ENDPOINT`.

**Declaradas en las plantillas pero NO leídas por código vivo** (restos del backend
archivado; no las «arregles» ni las borres sin leer §10): `JWT_SECRET`, `REDIS_URL`,
`LOG_LEVEL`, `PORT`. **`COOKIE_DOMAIN` salió de `.env.example` el 14/08** (F0.3): las
cookies son host-only a propósito y `apps/web/lib/entorno.test.ts` impide que vuelva
**a esa plantilla** — la prueba lee una sola, así que
`.env.production.example:9` sigue declarándola, y con el valor comodín del modelo de
subdominios muerto. Ver el aviso de [[entorno-y-despliegue]].

**Leídas solo por código muerto o `_legacy`:** `NEXT_PUBLIC_API_URL` (6 archivos) y
`NEXT_PUBLIC_TENANT_SLUG` (4 archivos). La bóveda dice que solo las lee un archivo
muerto — **es inexacto**: las leen 6 y 4 respectivamente (inventario D-7). Ninguno
está hoy en una ruta alcanzable, pero si reactivas alguno de esos módulos te van a
hacer falta.

> [!warning] Variables que el código lee y **no aparecen en ninguna plantilla**
> `APP_URL`, `HSTS`, `COOKIE_SECURE`, `RECORDATORIOS_TOKEN`,
> `NEXT_PUBLIC_MAPTILER_KEY`, `SPACE_EYE_*`, `DOOHMAIN_*`, `ADMOBILIZE_API_KEY`,
> `CMS_API_TOKEN`, `CFDI_PAC_KEY`, `TZ`. Si copias `.env.example` y esperas que
> funcione todo, te faltarán éstas.

### 7.4 El patrón «apagado en silencio»

Todas las integraciones están gateadas por sus variables: si faltan,
`*Habilitado()` devuelve `false` y **el sistema sigue operando sin ellas sin avisar**
(`storage.ts`, `email.ts`, `google-oauth.ts`, `space-eye.ts`). Consecuencia práctica:
si algo «no manda correo» o «no sube la foto a S3», la primera hipótesis es una
variable ausente, no un bug.

**Estado declarado en la bóveda** (comprobado el 07/08 y el 10/08, **no reverificado
contra el droplet**): Resend **apagado**, `DOOHMAIN_PUBLISH_ENABLED=1` **encendido**,
Google **configurado**. Confirmarlo es parte de [[verificacion-de-produccion]].

---

## 8 · Migraciones

- **66 migraciones**, todas **aditivas**, en `db/migrations/`. Sobre
  `db/schema.sql` añaden 10 tablas y el endurecimiento de seguridad.
- **Convención de nombres observada** en los ejemplos que consigna el inventario:
  `YYYYMMDD_` + área/propósito, p. ej. `20260715_arr_m5_rls_failclosed.sql` y
  `20260720_hard1_*.sql`. El orden de aplicación es el orden de esa fecha.
  (La lista completa y las trampas de orden están en [[migraciones]].)
- **`db/schema.sql` no incluye el endurecimiento**: las políticas fail-closed llegan
  por migración (§4.3). Esquema base + migraciones, siempre.

> [!danger] No hay tabla de control de migraciones ni herramienta que las gestione
> **El único registro de qué está aplicado en producción son las notas
> `DESPLIEGUE_*.txt` escritas a mano.** Ya hubo una divergencia de **27 columnas**
> entre lo esperado y lo real. Antes de aplicar nada, ver [[#9 · Despliegue y runbook]]
> y [[verificacion-de-produccion]].

**Regla de oro del orden:** **migración primero, código después.** Una migración
aditiva con el código viejo corriendo es inofensiva; el código nuevo contra el
esquema viejo, no.

### 8.1 Aplicar una migración en local — `scripts/apply-migration.mjs`

Un fichero por invocación, desde la **raíz** del repo:

```bash
node scripts/apply-migration.mjs db/migrations/20260706_reserva_ttl.sql
```

No aplica «todas las pendientes»: **no lleva la cuenta de nada** — no hay tabla de
control (ver el aviso de arriba). Aplicar varias es llamarlo varias veces, tú en
el orden correcto.

**Contra qué base escribe**, y este es el punto que hay que mirar dos veces. Resuelve
`DATABASE_URL` en este orden y **usa la primera que encuentre**
(`scripts/apply-migration.mjs:17-27`):

1. La variable de entorno `DATABASE_URL`
2. `apps/web/.env.production`   ← **ojo aquí**
3. `apps/web/.env.local`
4. `.env` de la raíz
5. Default `postgresql://spaces:spaces@localhost:5433/spaces`

> [!danger] El orden pone `.env.production` **por encima** de `.env.local`
> Si en tu máquina existe un `apps/web/.env.production` —copiado del droplet para
> depurar, por ejemplo— este script escribirá **en producción** aunque tú creas
> que estás en local. Imprime el destino antes de aplicar (`host:puerto/base`, sin
> credenciales): **léelo**. Si dice algo distinto de `localhost:5433/spaces`,
> para.

Es **fail-closed a propósito**: sale con código ≠ 0 si no puede aplicar, para que
un despliegue con `set -e` aborte **antes** de recargar la app. Aplica el fichero
entero en una sola sentencia y **no abre transacción propia**: la atomicidad
depende de lo que traiga el `.sql`, y por eso las migraciones se escriben
idempotentes.

En **producción no se usa este script**: los `DESPLIEGUE_*.txt` aplican con
`sudo -u postgres psql --set ON_ERROR_STOP=1 -f <fichero>`, porque hace falta el
rol `postgres` (§9.2) y no el rol de la app.

Cómo se aplica en producción, con su ensayo y su respaldo: §9.2. Cómo se **revierte**:
no consta un procedimiento → [[#PENDIENTE]] P-06.

---

## 9 · Despliegue y runbook

> Este es el capítulo que vas a leer bajo presión. Léelo **antes** de necesitarlo.

### 9.0 Cómo se despliega hoy, en una frase

**A mano, por SSH.** No hay despliegue continuo. `deploy.yml` existe y está
`workflow_dispatch` (manual), pero **no consta que se haya ejecutado nunca**.

| Workflow | Disparo | Qué corre |
|---|---|---|
| `ci.yml` | `pull_request` + push a `main` | typecheck → test → build. Usa **`pull_request` y NO `pull_request_target` a propósito** (`ci.yml:18-24`) |
| `lockfile-check.yml` | push + PR | `npm ci --dry-run` |
| `deploy.yml` | **manual** (`workflow_dispatch`) | SSH → backup `pg_dump -Fc` → migraciones como `postgres` → build + reload como `emiliano` |

`deploy.yml` fue **reescrito el 31/07/2026** tras un despliegue manual que reveló
cuatro defectos (ruta muerta, rol equivocado en migraciones, `npm ci` como root, `pm2`
como root); los cuatro están documentados y corregidos en la cabecera del propio
archivo (`deploy.yml:3-37`). Hoy usa la ruta correcta, aplica migraciones como
`postgres`, corre la app como `emiliano`, deriva el nombre de la base de
`.env.production` en vez de hardcodearlo (`:110`), valida la `ref` contra inyección
(`:98-101`) y tiene `concurrency` sin cancelación.

> La nota [[entorno-y-despliegue]] todavía lo llama «desactualizado»: **ese
> calificativo ya no describe el archivo** (inventario D-9). Sigue siendo manual, eso
> sí.

### 9.1 Procedimiento A — Desplegar código **sin** migraciones

**Cuándo:** cambios que no tocan el esquema.
**Accesos necesarios:** SSH al droplet como `emiliano`.

1. Confirma que CI está en verde para el commit que vas a desplegar.
2. `pull` de la fuente en el droplet **antes** de nada.
3. Build.
   > ⚠️ **Lee el código de salida del build antes de recargar.** Turbo imprime
   > «Compiled successfully» y **puede fallar después en typecheck**. Un
   > `pm2 reload` sobre un build a medias tumba el sitio.
4. > ⚠️ **Toca producción:** `pm2 reload` del proceso `spaces-web`.
5. **Verifica:** que el contador de reinicios de pm2 no se disparó, que `/login`
   responde **200**, y que el **artefacto servido** es el nuevo (no la versión
   cacheada).
6. Anota en el `DESPLIEGUE_*.txt` correspondiente **con la hora**.

**Cómo revertir:** volver al commit anterior (mismo procedimiento: `pull` de la ref
anterior → build → `pm2 reload`). Como no hubo cambios de esquema, el rollback de
código es suficiente. **No consta un script de rollback automatizado**
([[#PENDIENTE]] P-06).

### 9.2 Procedimiento B — Desplegar **con** migraciones

**Cuándo:** el cambio toca `db/`.
**Accesos necesarios:** SSH al droplet, rol `postgres` en la base, usuario `emiliano`
para la app.

1. `pull` de la fuente **antes** del ensayo.
2. > ⚠️ **Respaldo obligatorio antes de tocar nada.** `pg_dump` comprimido
   > (`-Fc`) **ejecutado como rol `postgres`**.
   > **Con el rol de la aplicación, la RLS fail-closed devolvería cero filas y el
   > respaldo *parecería* correcto.** Referencia de tamaño de los respaldos
   > históricos: ~7.1 MB, 38 bloques `COPY`, nombre
   > `spaces_prod_pre_<motivo>_YYYYMMDD.sql.gz`.
3. **Ensayo de la migración**: ejecútala dentro de una transacción que termine en
   `ROLLBACK` (quitando a mano el `commit;` que traiga el fichero). Si el ensayo
   falla, paras aquí y no ha pasado nada.
4. > ⚠️ **Irreversible sin restaurar respaldo:** aplicar la migración de verdad, con
   > `ON_ERROR_STOP=1`, **como `postgres`**.
   > **Migración primero, código después.**
5. Build, con la misma advertencia del paso 3 de §9.1: **lee el código de salida**.
6. > ⚠️ **Toca producción:** `pm2 reload`.
7. **Verifica:** reinicios de pm2, `/login` 200, artefacto servido, y la pantalla
   concreta que dependía de la migración.
8. Anota en `DESPLIEGUE_*.txt` con la hora **y con qué migraciones aplicaste** — es
   el único registro que existe (§8).

**Cómo revertir:** no hay migraciones «down». Las opciones reales son (a) una
migración correctiva nueva, o (b) restaurar el `pg_dump` del paso 2 —lo que implica
**perder todo lo escrito desde el respaldo**. Elige antes de empezar, no durante.
Procedimiento exacto de restauración: [[#PENDIENTE]] P-07.

### 9.3 Procedimiento C — Corrección de datos en producción

**Cuándo:** hay que arreglar filas, no esquema. Ya se ha hecho 13 veces.

1. El script va en `docs/datos/`, versionado.
2. > ⚠️ **Captura el rollback ANTES de ejecutar** (el `SELECT` que preserva el estado
   > previo, o su `UPDATE` inverso). Los 13 scripts existentes lo tienen; el tuyo
   > también.
3. Ensaya en transacción con `ROLLBACK` (igual que §9.2 paso 3).
4. > ⚠️ **Toca datos reales:** ejecuta, y deja constancia de cuántas filas cambiaron.
5. **Verifica** en la pantalla afectada, no solo en SQL.

### 9.4 Respaldos

- **No hay respaldo automatizado en el repo.** Los `pg_dump` se toman **a mano en
  cada despliegue** (§9.2 paso 2).
- Si hoy es un día sin despliegue, hoy no hay respaldo nuevo. Tenlo presente antes de
  cualquier operación destructiva.
- Política de retención, ubicación de los respaldos y quién los custodia: **no
  constan** → [[#PENDIENTE]] P-08.

### 9.5 Tareas programadas

| Qué | Cómo corre | Nota |
|---|---|---|
| Barrido diario de contratos | **Cron del droplet** → `POST /api/recordatorios` | Recorre todos los tenants fijando `app.tenant_id` uno por uno; **idempotente por día** |
| Reservas vencidas · estatus de arrendadores · estado de campañas · recordatorios de cobranza | **NO son cron**: corren dentro de `GET /api/estado` | Es decir: **solo se ejecutan cuando alguien abre la aplicación** |

> Consecuencia operativa: si nadie entra al sistema durante días, esos cuatro
> barridos **no ocurren**. No los busques en `crontab`.

### 9.6 Qué se está ejecutando hoy (11/08)

`3164aaa`, desplegado a las **09:35 sin migraciones**, arrastrando además V2-01
(hidratación ligera). **Commits posteriores en `main` y SIN desplegar:**

| Commit | Qué trae |
|---|---|
| `376841f` | Secciones plegables en Arrendadores |
| `349f03f` | Rótulos del menú (**Inventario** y **Finanzas**) |
| `504b4fc` | Domicilio del arrendador — **arregla un flujo hoy roto en producción** |

Que `3164aaa` siga siendo lo que corre **no está verificado**
([[verificacion-de-produccion]]).

### 9.7 Si se cae

El inventario **no documenta un procedimiento de incidente** (diagnóstico, dónde
están los logs, a quién escalar, criterios de rollback). Lo único que consta y sirve
en esa situación:

- El proceso es `spaces-web` bajo pm2, **1 instancia fork**, puerto 3000; el contador
  de reinicios de pm2 es la primera señal.
- El punto de verificación rápido es `/login` → 200.
- nginx hace de reverse proxy: distingue «nginx responde y la app no» de «no responde
  nadie».
- Los comandos de comprobación **sin efectos secundarios** están recogidos en
  [[verificacion-de-produccion]] (estado `sin-ejecutar`).

Todo lo demás → [[#PENDIENTE]] P-09, P-10.

---

## 10 · Zonas de riesgo

La lista canónica y con semáforo está en [[zonas-de-riesgo]] (ojo: hereda las citas
corridas de `auth.ts`, §6, y su punto A6 sobre `OTMovil` está superado, ver abajo).
Esto es lo que **no** debes tocar sin avisar:

| # | Zona | Por qué |
|---|---|---|
| R-1 | **`instances: 1` en `ecosystem.config.js`** | El rate limit es un `Map` **en memoria del proceso**. Subir instancias lo rompe **en silencio**: no falla, simplemente deja de limitar |
| R-2 | **`X-Forwarded-For $remote_addr` en nginx** (`:123`) | Reemplaza en vez de añadir, **a propósito**. «Arreglarlo» a `$proxy_add_x_forwarded_for` deja que el cliente elija su cubo de rate limit |
| R-3 | **Orden migración → código** | Migración primero, código después. Siempre (§8) |
| R-4 | **Respaldo con el rol equivocado** | Un `pg_dump` con el rol de la app sale **vacío y con buena cara** por la RLS fail-closed (§9.2) |
| R-5 | **21 tablas con `DEFAULT tenant_id → rgb`** (`schema.sql:615`) | Un insert sin tenant **no falla, miente**. Es la causa de la deriva de datos conocida. `config_negocio` se dejó sin default a propósito (`:630-633`) |
| R-6 | **Endpoint nuevo sin `exigir()`** | El middleware no cubre `/api/`. Queda abierto (§5.1) |
| R-7 | **`rol_permisos` sin `tenant_id`** | Tocar los permisos de un rol los toca **en las cinco organizaciones** |
| R-8 | **`clave_interna` y `codigo_proveedor` UNIQUE globales** (`schema.sql:124-125`) | Dos organizaciones **no pueden** usar el mismo código de proveedor |
| R-9 | **`GET /api/estado` escribe en la base** | Cuatro barridos en paralelo (`:63-70`). Cualquier cambio ahí afecta rendimiento **y** datos |
| R-10 | **`NEXT_PUBLIC_*` se hornea en el build** | Apagar autorregistro o recuperación de contraseña **exige recompilar** |
| R-11 | **`eyro` publica de verdad en DOOHmain** | Es «perfil de pruebas» del usuario, **no** un sandbox: con `DOOHMAIN_PUBLISH_ENABLED=1` sale a pantallas reales |
| R-12 | **Defaults `PEN` / `IGV` con operación en México** (`schema.sql:110,390,545`) | Herencia de Perú. Cualquier ruta que caiga en el default introduce moneda equivocada |
| R-13 | **`catch` vacío en la bitácora** (`acciones-repo.ts`, INC-06) | 8 de 8 handlers `DELETE` registran, **0 de 8 de forma atómica**, y el fallo **no se loguea** |
| R-14 | **El store de zustand y el BFF conviven** (`lib/data/store.ts`) | Al añadir una pantalla tienes que saber de cuál lee. No hay dirección decidida |
| R-15 | **Comentario mentiroso en `tenant.ts:12-15`** | «la conexión sigue siendo superuser, así que RLS no aplica» — **falso hoy**, y sigue ahí |
| R-16 | **`_archive/` e `infra/*/spaces.conf`** | Configuración que asume el Fastify inexistente. Aplicar uno de esos ficheros por error rompe el proxy |
| R-17 | **Archivos grandes = zona de conflicto** | Crecieron entre 6 % y 29 % en cuatro días: `arrendadores-repo.ts` **1435**, `campanas-repo.ts` **1204**, `doohmain.ts` **403**, `creativos-repo.ts` **366**, `sitios-repo.ts` **640**, `arrendadores-controller.ts` **471** líneas. La bóveda tiene cifras viejas (inventario D-5) |

**Riesgo degradado (buena noticia):** [[zonas-de-riesgo]] A6 dice que `OTMovil.tsx`
depende del `AuthProvider` muerto. **La página real `/m/ot/[id]` renderiza `OTVista`,
no `OTMovil`** (`app/(app)/m/ot/[id]/page.tsx:3,7`), y **ningún** archivo importa
`OTMovil.tsx`, `PermissionGuard.tsx`, `ReadinessPanel.tsx` ni `ReporteVisual.tsx`.
El `AuthProvider` sigue montado (`providers.tsx:34`) pero **ningún componente vivo
depende de su `user`**: retirarlo es menos arriesgado de lo que dice la nota
(inventario D-6).

---

## 11 · Cómo seguir leyendo la bóveda

Entrada: [[MOC-Proyecto]] → desde ahí se llega a cualquier nota en un salto.
[[glosario]] traduce el vocabulario del dominio (predio, modalidad, divisor,
candado…). Antes de trabajar en paralelo con otros agentes: [[AGENTES]] y [[tablero]].

**Notas con desfase conocido a 11/08** (léelas, pero con esta corrección al lado):

| Nota | Desfase | Corrección |
|---|---|---|
| [[api-endpoints]] | Lista `leer-todas`, omite `archivar-todas` | §5.5 |
| [[autenticacion-y-sesion]] | Citas de `auth.ts` corridas ~4 líneas; sitúa la política de contraseñas en `auth.ts` | §6 |
| [[shell-y-navegacion]], [[modulos-internos]] | Describen el menú **plano**, sin los 6 grupos; y `modulos-internos` lista `ReadinessPanel`/`ReporteVisual` como componentes de `/campanas/[id]` — no lo son | §3, inventario D-2/D-6 |
| [[entorno-y-despliegue]] | «`deploy.yml` está desactualizado» y la lectura de `NEXT_PUBLIC_API_URL` | §9.0, §7.3 |
| [[estado-y-data-fetching]] | Presenta `lib/portal-cliente-api.ts` como cliente del portal público; el portal vivo usa `hidratarPortalPublico` de `lib/data/estado-api.ts` | inventario D-8 |
| [[decisiones]] | Habla de «los 12 ADR»; hay **13** y el `0013` no está en su tabla | §1.5 |
| [[zonas-de-riesgo]] | A6 sobre `OTMovil` está superado | §10 |
| [[preguntas-abiertas]] | P3c y P8 **ya tienen respuesta** en el código y siguen abiertas en la lista | inventario D-11 |
| [[vision-general]] | «86 route handlers» | 88 archivos / 110 métodos |

**Regla de convivencia:** si el código y la bóveda se contradicen, **gana el código**,
y el desfase se anota. Este manual sigue esa regla.

---

## PENDIENTE

Huecos reales de este manual. Cada uno es una pregunta accionable: **qué falta para
poder documentar qué**. Ninguna se ha rellenado con conocimiento general ni con
suposiciones.

### Entorno local y pruebas

> [!success] P-01 a P-04 — **cerrados el 11/08/2026**
> Resueltos leyendo el repo (`package.json` de la raíz y de `apps/web`,
> `db/docker-compose.yml`, `db/README.md`, `scripts/apply-migration.mjs`, las dos
> configs de vitest, `lib/test/db-e2e.ts` y `lib/test/servidor-e2e.ts`) y
> **corriendo las pruebas**: 789 unitarias y 136 de integración, todas en verde.
> Lo que salió de ahí está en §7.1, §7.1.1 y §8.1. Cuatro hallazgos que no
> estaban en el inventario: el `README.md` de la raíz manda a la pista archivada;
> `apply-migration.mjs` prefiere `.env.production` **antes** que `.env.local`; no
> existe `test` en la raíz; y las e2e **exigen un build de producción previo**,
> con un modo de fallo que no se explica solo (§7.1.1).
- **P-05** — Falta confirmar si la base local del `docker-compose` (puerto **5433**,
  base `spaces`) contiene **datos reales que no deban borrarse**. El propio arnés
  la trata como si los tuviera —`db-e2e.ts:21-30` dice que ahí se suben pantallas,
  campañas y creativos con imágenes, y se niega a apuntar ahí— así que la pregunta
  ya no es «¿es desechable?» sino **quién puede autorizar un `docker compose down
  -v` y con qué respaldo previo**.

### Despliegue, respaldo y recuperación

- **P-06** — Falta un **procedimiento de reversión escrito**: no consta ningún
  «down» de migración ni script de rollback. ¿La política oficial es «migración
  correctiva» o «restaurar respaldo»? Sin eso, §9.2 solo puede enunciar las dos
  opciones.
- **P-07** — Falta el **procedimiento de restauración** de un `pg_dump -Fc` sobre
  `spaces_prod` (con qué rol, con la app parada o corriendo, qué hacer con las
  sesiones vivas) para completar §9.4.
- **P-08** — Falta la **política de respaldos**: dónde se guardan, cuánto se
  conservan, quién los custodia, y si existe algo fuera de los `pg_dump` manuales de
  cada despliegue.
- **P-09** — Falta el **runbook de incidente**: dónde están los logs (¿`pm2 logs`?,
  ¿logs de nginx?), qué se mira primero, a quién se escala y con qué criterio se
  decide rollback. §9.7 hoy solo tiene señales sueltas.
- **P-10** — Falta saber si hay **monitoreo o alertas** (uptime, errores, disco de la
  base) o si el descubrimiento de una caída depende de que alguien la note.
- **P-11** — Faltan las **líneas de comando exactas** que se han ejecutado en
  despliegues reales; viven en los `DESPLIEGUE_*.txt` de la raíz, que no forman parte
  del inventario. Con ellas, §9.1–9.3 pasarían de «pasos» a «copiar y pegar».
- **P-12** — Falta saber **qué migraciones están aplicadas en `spaces_prod`**. No hay
  tabla de control y ya hubo una divergencia de 27 columnas (P5 de la bóveda, sigue
  abierta).
- **P-13** — Falta decidir si los tres commits sin desplegar (`376841f`, `349f03f`,
  `504b4fc`) **se despliegan juntos**. El de `arrendadores.direccion` arregla un flujo
  hoy roto en producción.
- **P-14** — Falta la **gestión de accesos**: quién concede SSH al droplet, quién
  tiene el rol `postgres`, y cómo se renueva el certificado TLS. Un manual técnico no
  puede decirle a alguien nuevo «entra por SSH» sin decir a quién pedírselo.
- **P-15** — Falta saber **quién es dueño del proyecto de Google Cloud y quién rota
  el `GOOGLE_CLIENT_SECRET`** (P3 de la bóveda).
- **P-16** — Falta la **medición de V2-01** en producción (`<500 kB`, `<1 s` en frío):
  ¿se tomó al desplegar `3164aaa` el 11/08?

### API y modelo de datos

- **P-17** — Faltan los **contratos de entrada/salida** de la mayoría de endpoints: el
  inventario detalla cuerpo y respuesta solo para el bloque de autenticación. Para las
  ~90 rutas restantes solo constan método, ruta y guard. Falta eso para que §5 sirva
  como referencia de integración.
- **P-18** — Falta el **catálogo de errores**: qué códigos devuelve el sistema y con
  qué forma de cuerpo. Solo constan tres casos (403 `{requiereDesbloqueo:true}`, 409
  por doble factura, 503 por integración apagada).
- **P-19** — Falta el **contenido de `rol_permisos`**: la matriz real rol × módulo ×
  acción. Sin ella no se puede documentar qué puede hacer de verdad un `COMERCIAL`
  frente a un `OPERACIONES` más allá de qué pantallas ve.
- **P-20** — Falta la **lista de las 66 migraciones en orden** y sus «trampas de
  orden» (están en [[migraciones]], no en el inventario) para que §8 sea autosuficiente.
- **P-21** — Falta el detalle de las tablas marcadas «—» en §4.2
  (`licencias`, `incidencias`, `almacen_activos`, `almacen_movimientos`,
  `media_uploads`, `arrendador_razon_social`): no constan sus campos de negocio.
- **P-22** — Falta el formato de `DOOHMAIN_SCREEN_MAP` y cómo se invoca el subproceso
  Python (`DOOHMAIN_PY`, `DOOHMAIN_SDK_DIR`) para documentar la publicación real a
  pantallas.

### Producto y decisiones abiertas (bloquean secciones enteras)

- **P-23** — **¿Quién ocupa cada rol en la vida real y con qué frecuencia?** El código
  define cinco; no consta quién los usa.
- **P-24** — **¿Por dónde se llega a `/configuracion`?** No está en `NAV`
  (`nav.ts:84-126`); el inventario apunta a Topbar o Administración, sin confirmar.
- **P-25** — **¿Qué es `/propuesta`** (sin `[id]`)? Existe como página y ninguna nota
  la describe. ¿Sigue en uso?
- **P-26** — **¿Qué comisión calcula `/comisiones`**: la de agencia
  (`propuestas.comision_pct`) o comisión de vendedor? No tiene tabla propia.
- **P-27** — **¿`/almacen` está en uso real** o es funcionalidad adelantada («Fase 3»
  en la bóveda)?
- **P-28** — **¿`rol_permisos` global es deliberado** o es la misma deuda que el ADR
  0011 resolvió para `config_negocio`? (P4)
- **P-29** — **¿Se quitan los `DEFAULT tenant_id → rgb` de las 21 tablas** para que un
  insert sin tenant falle en vez de mentir? (P15)
- **P-30** — **¿Es deseado que `clave_interna` y `codigo_proveedor` sean UNIQUE
  globales**, impidiendo que dos organizaciones compartan código de proveedor? (P12)
- **P-31** — **¿Basta con loguear el fallo de la bitácora o hace falta atomicidad?**
  (INC-06 / P19)
- **P-32** — **¿Queda alguna ruta que use los defaults `PEN`/`IGV` sin corregir?** (P13)
- **P-33** — **¿La dirección es retirar el store de zustand o dejarlo como caché de
  UI?** Quien añada una pantalla necesita saber de cuál lee. (P14)
- **P-34** — **¿Se cierran o se dejan las 2 pantallas de `eyro` sin creativo
  asignado** (INC-02), ahora que `eyro` es tenant de pruebas?

### No verificable sin tocar producción

- **P-35** — Estado real de `spaces_prod`, contenido de `.env.production`, si
  `3164aaa` sigue corriendo y si las pruebas pasan hoy: **los cuatro tienen runbook
  propio en [[verificacion-de-produccion]]** (estado `sin-ejecutar`). Nada de este
  manual sobre producción debe darse por confirmado hasta que ese runbook se ejecute.

---

## Relacionadas

[[inventario-2026-08-11]] · [[MOC-Proyecto]] · [[vision-general]] ·
[[stack-y-dependencias]] · [[entorno-y-despliegue]] · [[decisiones]] ·
[[api-endpoints]] · [[autenticacion-y-sesion]] · [[multi-tenancy-y-rls]] ·
[[esquema]] · [[migraciones]] · [[zonas-de-riesgo]] · [[convenciones]] ·
[[verificacion-de-produccion]] · [[preguntas-abiertas]] · [[glosario]] ·
[[shell-y-navegacion]] · [[modulos-internos]] · [[paginas-publicas]] ·
[[estado-y-data-fetching]] · [[flujo-login]] · [[flujo-acceso-con-google]] ·
[[flujo-propuesta-a-campana]] · [[flujo-facturacion-y-cobranza]] ·
[[flujo-orden-de-trabajo]] · [[AGENTES]] · [[tablero]]
