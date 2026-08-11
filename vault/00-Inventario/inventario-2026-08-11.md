---
tipo: inventario
estado: verificado
actualizado: 2026-08-11
tags: [inventario, reconocimiento, base-para-manuales]
archivos:
  - apps/web/
  - db/schema.sql
  - db/migrations/
  - vault/
---

# Inventario — Space OS (spaces_doohmain_nueva) — 2026-08-11

> **Qué es este documento.** Inventario factual de reconocimiento, hecho leyendo
> primero la bóveda (`vault/`, 39 notas) y verificando después contra el código.
> Cada afirmación lleva evidencia `ruta:línea`. Lo no verificable está en §10.
> **Solo lectura**: no se modificó ni ejecutó nada del repo, la base ni el servidor.

---

## 1. Resumen

1. **Qué es.** CRM/ERP multi-organización para publicidad exterior OOH/DOOH:
   inventario de pantallas, arrendadores y contratos de renta, propuestas,
   campañas, órdenes de trabajo, imprenta, facturación y cobranza (`vault/00-Indice/MOC-Proyecto.md:18-21`).
2. **Para quién.** Cinco organizaciones («tenants») sobre una sola instalación;
   roles `DUENO`, `COMERCIAL`, `OPERACIONES`, `IMPRENTA`, `FINANZAS` (`apps/web/components/demo/shell/nav.ts:128-133`).
3. **Stack.** Next.js 14.2.29 App Router + React 18 + Tailwind, con **BFF integrado**
   (Route Handlers). PostgreSQL con `pg` directo, **sin ORM**. Auth propia, sin librería.
4. **Una sola pista viva — CONFIRMADO.** `apps/` contiene **únicamente** `web`
   (`ls apps/`). El único proceso desplegado es `spaces-web` (`ecosystem.config.js:5-27`).
5. **La segunda pista NO es `apps/api`: es `_archive/api`.** Fastify 5 + Prisma +
   BullMQ, fuera de los workspaces npm (`package.json:25-28` declara solo `apps/*`
   y `packages/*`), nunca desplegada (`ecosystem.config.js:1-3`).
6. **Los grupos de rutas `(comercial)` y `(operaciones)` NO EXISTEN.** Los únicos
   grupos de ruta del repo son `(app)`, `(app)/(shell)` y `_legacy/(auth)`
   (`find apps/web/app -type d -name '(*)'`). Ver §9, D-0.
7. **El segmento `/demo` tampoco existe ya en las URLs**: `middleware.ts:44`
   redirige `/demo/*` → `/*` con 308. El nombre «demo» solo sobrevive en
   `components/demo/`, `.demo-root` y `demo.css`.
8. **Infraestructura latente** (existe en el repo, no corre): `_archive/api`,
   `_archive/web-frontend-2`, `app/_legacy/` (7 páginas), `lib/auth-context.tsx`
   + sus tres consumidores, `infra/nginx/spaces.conf`, `infra/apache/spaces.conf`,
   `doohmain_sdk/` (sí se invoca, ver §7).
9. **Producción.** Droplet DigitalOcean, `https://demo.space-os.io/spaces-dooh/`,
   `/var/www/Spaces`, pm2 fork 1 instancia, base `spaces_prod`. Despliegue **manual por SSH**.
10. **Estado.** Muy activo: 30 commits entre 09/08 y 11/08. Recuentos verificados
    hoy: **88 archivos `route.ts` / 110 métodos HTTP**, **38 tablas**, **66 migraciones**,
    **13 ADR**, **22 pantallas internas** + 8 públicas/sin-chrome.

---

## 2. Mapa del repositorio

| Carpeta | Qué vive ahí | Pista |
|---|---|---|
| `apps/web/app/(app)/(shell)/` | Las 22 pantallas internas con sidebar+topbar | **VIVA** |
| `apps/web/app/(app)/` (fuera de shell) | 8 páginas sin chrome: `login`, `recuperar/[token]`, `contrato/[id]`, `firmar/[token]`, `m/ot/[id]`, `p/[id]`, `portal/[token]`, `propuesta` | **VIVA** |
| `apps/web/app/api/` | 88 `route.ts` — el BFF entero | **VIVA** |
| `apps/web/lib/server/` | 76 archivos `.ts`: controllers + repos + infraestructura | **VIVA** |
| `apps/web/lib/` (raíz) | Cálculos puros compartidos cliente/servidor, con `.test.ts` | **VIVA** |
| `apps/web/lib/data/` | Store zustand `DemoState`, adapters, `estado-api.ts` | **VIVA** (costura con la demo) |
| `apps/web/lib/test/` | Arnés e2e (`db-e2e.ts`, `servidor-e2e.ts`, `doble-google.ts`) | **VIVA** |
| `apps/web/components/demo/` | 68 componentes: `shell/`, `ui/`, por módulo | **VIVA** |
| `apps/web/app/_legacy/` | 7 páginas archivadas (portal cliente viejo, login viejo) | **LATENTE** |
| `_archive/api/` | Fastify + Prisma + BullMQ + `prisma/` | **LATENTE**, nunca desplegado |
| `_archive/web-frontend-2/` | Front anterior | **LATENTE** |
| `packages/types`, `packages/utils` | Tipos y utilidades compartidas | **VIVA** |
| `packages/ui` | 3 componentes (`button`, `card`, `code`) | Marginal |
| `db/` | `schema.sql` (656 líneas), `migrations/` (66), `seeds/`, `docker-compose.yml` (Postgres en **5433**), `dev-rol-app.sql` | **VIVA** |
| `docs/adr/` | 13 ADR (0001–0013) | **VIVA** |
| `docs/datos/` | 13 scripts SQL de corrección de datos de producción, con rollback | **VIVA** |
| `docs/` | Bitácora `Registro_Cambios.md`, `Reglas_Arrendadores.md`, `DEPENDENCIAS.md`, runbooks, diseño DOOHmain | **VIVA** |
| `infra/nginx/demo.space-os.io.conf` | Reverse proxy real | **VIVA** |
| `infra/nginx/spaces.conf`, `infra/apache/spaces.conf`, `infra/docker-compose.yml`, `infra/scripts/*` | Asumen el API Fastify | **LATENTE / obsoleto** |
| `doohmain_sdk/` | SDK Python invocado por subproceso | **VIVA** (detrás de flag) |
| `.github/workflows/` | `ci.yml`, `deploy.yml`, `lockfile-check.yml` | **VIVA** |
| `scripts/` | `apply-migration.mjs`, generadores de plantillas, `md-to-pdf.mjs` | Utilería |
| Raíz: `DESPLIEGUE_*.txt` (11), `Manual_*.pdf`, `Auditoria_*.pdf` | Runbooks ejecutados y documentación histórica | Documental |
| `vault/` | La bóveda de conocimiento (39 notas) | Documental |

---

## 3. Pantallas y navegación

### 3.1 El menú, por fases (cambió el 11/08)

`components/demo/shell/nav.ts:75-82` define **6 grupos**; el arreglo `NAV`
(`nav.ts:84-126`) tiene **18 entradas**. `AuthGate` usa el MISMO `NAV` para
autorizar rutas (`AuthGate.tsx:9,18-23`), así que menú y control de acceso no se
desincronizan.

| Grupo (`key`) | Título en pantalla | Entradas |
|---|---|---|
| `inicio` | *(sin título)* | Dashboard |
| `patrimonio` | **Inventario** | Inventario · Arrendadores · Network |
| `vender` | **Vender** | Clientes · Comercial · Disponibilidad · Propuestas |
| `entregar` | **Entregar** | Campañas · Creativos · Imprenta · Operaciones · Almacén |
| `cobrar` | **Finanzas** | Finanzas · Comisiones |
| `sistema` | **Sistema** | Integraciones · Actividad · Administración |

### 3.2 Las 22 pantallas internas (`app/(app)/(shell)/`)

| Ruta | Propósito | Quién entra (`nav.ts` `roles`) |
|---|---|---|
| `/inicio` | Tablero / KPIs | DUENO |
| `/inventario` | Alta, consulta, carga masiva y exportación de pantallas | DUENO |
| `/arrendadores` | Arrendadores, predios, contratos, rentas, firmas, licencias | DUENO |
| `/network` | Pantallas compartidas en red | DUENO, COMERCIAL |
| `/clientes` | Clientes y agencias | DUENO, COMERCIAL |
| `/comercial` | Buscador de inventario con mapa | DUENO, COMERCIAL |
| `/disponibilidad` | Calendario de ocupación | DUENO, COMERCIAL |
| `/propuestas` · `/propuestas/[id]` | Cotizaciones y liga pública | DUENO, COMERCIAL |
| `/campanas` · `/campanas/[id]` | Pipeline, candado, validación, playlogs | DUENO, COMERCIAL |
| `/creativos` | Piezas (imagen o HTML) | DUENO, COMERCIAL |
| `/imprenta` | Órdenes de impresión, prueba de color | DUENO, IMPRENTA |
| `/operaciones` · `/operaciones/ot/[id]` | Órdenes de trabajo | DUENO, OPERACIONES |
| `/almacen` | Activos físicos y traslados | DUENO, OPERACIONES |
| `/finanzas` | Facturación y cobranza | DUENO, FINANZAS |
| `/comisiones` | Comisiones (derivado) | DUENO, COMERCIAL |
| `/integraciones` | Estado de conectores | DUENO |
| `/actividad` | Bitácora | DUENO |
| `/administracion` | Usuarios, permisos, organizaciones, control de cambios | DUENO |
| `/configuracion` | Config del negocio (IVA, plazos, logo, remitente) | **No está en `NAV`** — se llega desde Topbar/Administración |

### 3.3 Páginas fuera del shell

| Ruta | Chrome | Credencial | Quién |
|---|---|---|---|
| `/login` | No | — | Cualquiera. Tres modos: login, alta (`signup`), olvidé contraseña (`login/page.tsx:55,126-127`) |
| `/recuperar/[token]` | No | Token del correo | Quien recibe el enlace |
| `/portal/[token]` | No | `campanas.portal_token` | El cliente anunciante |
| `/p/[id]` | No | `propuestas.token_publico` | Cliente/agencia |
| `/firmar/[token]` | No | Token de firma | El arrendador |
| `/contrato/[id]` | No | **Sesión** | Interno |
| `/m/ot/[id]` | No | **Sesión** | Cuadrilla en campo. Renderiza `OTVista`, no `OTMovil` (`app/(app)/m/ot/[id]/page.tsx:3,7`) |
| `/propuesta` | No | — | Consulta de propuesta por código |

### 3.4 Las tres capas de control de acceso

| Capa | Comprueba | Evidencia | ¿Es seguridad? |
|---|---|---|---|
| `middleware.ts` | Que **exista** la cookie `spaces_sesion` | `middleware.ts:92-109` | No (UX) |
| `AuthGate` (cliente) | Sesión real + rol vs módulo del `NAV` | `AuthGate.tsx:18-23` | No (UX) |
| `exigir()` en cada handler | Sesión válida + permiso `modulo/accion` | `lib/server/auth.ts:146` | **Sí** |

---

## 4. Flujos de usuario extremo a extremo

### F1 · Alta de organización (autorregistro) — **ABIERTO en producción**

- **Quién:** cualquiera con la URL.
- **Empieza:** `/login`, modo `signup` (`login/page.tsx:126`).
- **Endpoint:** `POST /api/signup` (`app/api/signup/route.ts:18`).
- **Guardas:** 503 si `NEXT_PUBLIC_AUTOREGISTRO=0` (`signup/route.ts:19-24`);
  rate limit **5/hora por IP** (`signup/route.ts:26`).
- **Cadena servidor:** `registrarCuentaCtrl` → `crearOrgConDueno` → `crearTenant()`
  + `crearUsuario()` (`lib/server/cuentas-controller.ts:41-63`).
- **Base:** inserta en `tenants` y `usuarios` (rol `DUENO`), y `config_negocio`
  obtiene su fila por tenant.
- **Nota:** la bandera se hornea en el build (`NEXT_PUBLIC_*`); cambiarla exige recompilar.

### F2 · Login con contraseña

- **Quién:** usuario existente. **Empieza:** `/login`.
- `POST /api/auth/login` (exento de CSRF, `middleware.ts:49-50`) → rate limit 10/5 min
  → función `auth_usuario_por_email()` SECURITY DEFINER → `verifyPassword` (bcrypt)
  → `crearSesion()` (`lib/server/auth.ts:92`) → cookies `spaces_sesion` (httpOnly,
  30 d, `auth.ts:191-202`) y `spaces_csrf` (httpOnly:false a propósito, `auth.ts:216-226`).
- **Base:** inserta fila en `sesiones`.
- **Siguiente petición:** `exigir()` (`auth.ts:146`) → `tenantActual()` (`tenant.ts:32-41`)
  → `set_config('app.tenant_id', …, true)` transaction-local (`db.ts:59`) → RLS filtra.
- **Corte:** si `debe_cambiar_password`, `exigir()` cierra todo salvo `/api/auth/me`
  y `PATCH /api/perfil`.

### F3 · Acceso y alta con Google (ADR 0012 + enmienda)

- `GET /api/auth/google/inicio` — 503 si no está habilitado (`inicio/route.ts:50`),
  rate limit 10/5 min (`inicio/route.ts:63`), genera `state`+`nonce`+PKCE
  (`inicio/route.ts:93-95`) y tres cookies cortas httpOnly.
- **Alta de organización:** `?alta=1&organizacion=…`; el nombre va en cookie
  `COOKIE_ALTA_ORG`, **nunca en el `state`** (`inicio/route.ts:71-90`).
- `GET /api/auth/google/callback` — valida claims, resuelve por `sub` vía
  `auth_usuario_por_identidad()`, y **vuelve a comprobar** `autoregistroHabilitado()`
  (`callback/route.ts:166`). Termina en `crearSesion()` (`callback/route.ts:80`).
- **Base:** `identidades_externas` (+ `tenants`/`usuarios` si es alta).
- **Invariante:** el alta «entra con Google» **genera igualmente un `password_hash`**
  (`cuentas-controller.ts:76-77`, `passwordDeAlta`). Sin él, la persona no podría
  desbloquear operaciones de dinero.

### F4 · Recuperación de contraseña

- `/login` modo `forgot` → `POST /api/auth/forgot` (5/15 min por IP + 3/h por correo).
- Correo con enlace → `/recuperar/[token]` → `GET /api/auth/reset` valida →
  `POST /api/auth/reset` aplica.
- **Base:** `password_resets` (token 256 bits, **60 min**, un solo uso,
  `password-reset-repo.ts:36`), y al consumir **borra todas las sesiones del usuario**
  (`password-reset-repo.ts:121`).
- **Estado:** apagado en producción por `NEXT_PUBLIC_RECUPERAR_PASSWORD` (no hay correo saliente).
- La tabla es **fail-closed desde el 07/08**; leer va por `auth_reset_por_token()`
  SECURITY DEFINER y escribir por `qConTenant` (`password-reset-repo.ts:21-24,64`).

### F5 · De propuesta a campaña publicada (flujo principal)

1. **Comercial** crea propuesta: `POST /api/propuestas` → `propuestas` + `propuesta_items`,
   folio consecutivo. Gate: agencia con negociación sin validar bloquea.
2. Comparte liga pública → cliente acepta en `/p/[id]` → `POST /api/propuestas/publica/[id]`
   → escribe `aceptado_en`, `aceptado_por`, `aceptado_ip`.
3. `POST /api/propuestas/[id]/generar-campana` → **idempotente**; exige contrato
   completo (ADR 0003) → inserta `campanas` + `reservas`.
4. `POST /api/creatividades` → `creatividades` (PENDIENTE) →
   `POST /api/campanas/[id]/validar` → `POST /api/campanas/[id]/creativos/repartir`.
5. `POST /api/campanas/[id]/enviar-dominio` → publica; con
   `DOOHMAIN_PUBLISH_ENABLED=1` sale por el SDK Python a pantallas reales.
6. El estado comercial lo **recalcula el sistema**: `recomputarEstadoCampanas()` se
   dispara desde `GET /api/estado` (`app/api/estado/route.ts:10,63-70`), detrás de
   `comercial.ver`. **No existe `PATCH /api/campanas/[id]`.**

### F6 · Orden de trabajo en campo → destraba el dinero

- Origen automático (`operaciones-eventos.ts`: cancelar contrato → OT RETIRO; alta
  de pantalla fija → OT MONTAJE, a mejor esfuerzo) o manual (`POST /api/ot`).
- Cuadrilla abre `/m/ot/[id]` → `POST /api/ot/[id]/cerrar` con fotos →
  validación por **magic bytes** (`uploads.ts`) → fecha EXIF a `tomada_en` →
  S3 si `storageHabilitado()`, si no data URL.
- **Base:** `evidencias_ot` + `ordenes_trabajo → COMPLETADA`, y si hay campaña
  ligada, enciende `campanas.fotos_comprobatorias` y `reporte_publicacion`.
- **No hay forma de reasignar una OT ya creada:** no existe `PATCH /api/ot/[id]`
  (verificado: `app/api/ot/[id]/route.ts` solo exporta `GET`).

### F7 · Facturación y cobranza

- `POST /api/campanas/[id]/facturar` — `exigirCambioSensible('finanzas','facturar')`:
  permiso **+ desbloqueo**. Si falta, 403 `{requiereDesbloqueo:true}` y la UI abre
  `DesbloqueoCambios`.
- Candado por segmento: OC + fotos + reporte. Doble factura → **409**.
- **Base:** `facturas` (folio consecutivo + snapshot fiscal) + `cobranzas`
  (plazo de `config_negocio.plazos_cobranza`) + `notificaciones`.
- Cobro en parcialidades: cuotas que suman exacto; abono acotado al saldo;
  `POST /api/cobranzas/[id]/pagar` (también SENSIBLE).

### F8 · Alta de pantalla → contrato de arrendamiento

- `POST /api/sitios` (o `POST /api/sitios/import` con Excel). ADR 0002: arrendador
  obligatorio; `contratos-sitio.ts` abre un contrato que **nace INCOMPLETO** (ADR 0001),
  y eso **bloquea reservar** (ADR 0003).
- **11/08:** el alta de arrendador ahora guarda `direccion` y la lista permite
  editar arrendadores existentes (commit `504b4fc`) — el `PATCH` existía y no lo
  llamaba ninguna pantalla.

---

## 5. Endpoints

**88 archivos `route.ts`, 110 métodos HTTP** (`find apps/web/app/api -name route.ts | wc -l` = 88;
`grep -c '^export async function (GET|POST|…)'` = 110). Todos bajo
`https://demo.space-os.io/spaces-dooh/api/…`, **pista VIVA** (BFF de `apps/web`).
No hay un solo endpoint de la pista `_archive/api` desplegado.

Leyenda de guard: `PÚBLICO` = sin sesión (se auto-protege por token o es bootstrap) ·
`exigir(m,a)` = sesión + permiso · `SENSIBLE` = `exigirCambioSensible` (permiso + desbloqueo) ·
`DESBLOQ` = `exigirDesbloqueo` añadido · `REAUTH` = `exigirReautenticacionSiempre`.

> **El middleware NO valida la sesión** (`middleware.ts:92-109` solo mira que la cookie
> exista, y las `/api/` quedan fuera del gate). Un endpoint nuevo sin guard queda abierto.

### Autenticación y cuenta

| Método | Ruta | Guard | Entrada | Salida | Archivo |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | PÚBLICO (10/5min IP) | `{email,password}` | `{usuario,permisos}` + 2 cookies | `app/api/auth/login/route.ts` |
| POST | `/api/auth/logout` | PÚBLICO (exento CSRF) | — | 200 | `app/api/auth/logout/route.ts` |
| GET | `/api/auth/me` | `usuarioActual` | — | usuario o 401 | `app/api/auth/me/route.ts` |
| GET | `/api/auth/metodos` | PÚBLICO | — | `{google:bool}` | `app/api/auth/metodos/route.ts` |
| POST | `/api/auth/forgot` | PÚBLICO (5/15min IP + 3/h correo) | `{email}` | 200 genérico | `app/api/auth/forgot/route.ts` |
| GET·POST | `/api/auth/reset` | PÚBLICO | token / token+password | valida / aplica | `app/api/auth/reset/route.ts` |
| GET | `/api/auth/google/inicio` | PÚBLICO (10/5min IP) | `?alta=1&organizacion=` | 302 a Google · 503 si apagado | `.../google/inicio/route.ts:50,63,76-90` |
| GET | `/api/auth/google/callback` | PÚBLICO | `code`+`state` | 302 con sesión | `.../google/callback/route.ts:80,166` |
| POST | `/api/signup` | PÚBLICO (5/h IP) | `{organizacion,nombre,email,password}` | 201 · 503 si apagado | `app/api/signup/route.ts:19,26` |
| PATCH | `/api/perfil` | `usuarioActual` | exige `passwordActual` | usuario | `app/api/perfil/route.ts` |
| GET | `/api/permisos` | `exigir('administracion','ver')` | — | matriz | `app/api/permisos/route.ts` |
| GET | `/api/admin/permisos-matriz` | `exigir('administracion','ver')` | — | matriz+áreas | `app/api/admin/permisos-matriz/route.ts` |

### Organización, usuarios y plataforma

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| GET·POST | `/api/usuarios` | `exigir('administracion','ver'\|'crear')` — acepta `entraConGoogle` | `app/api/usuarios/route.ts` |
| PATCH·DELETE | `/api/usuarios/[id]` | `exigir('administracion','crear')` | `app/api/usuarios/[id]/route.ts` |
| POST | `/api/usuarios/[id]/restablecer` | **REAUTH + DESBLOQ** | `.../restablecer/route.ts` |
| GET·POST | `/api/tenants` | `exigir('administracion','crear')` **en ambos** | `app/api/tenants/route.ts:13,22` |
| POST | `/api/tenant-activo` | `exigir()` | `app/api/tenant-activo/route.ts` |
| PATCH | `/api/organizacion` | `exigir('administracion','crear')` | `app/api/organizacion/route.ts` |
| GET·PATCH | `/api/config` | `exigir('administracion','ver'\|'crear')` | `app/api/config/route.ts` |
| GET·PUT | `/api/cambios` | `exigir()` / `exigir('administracion','aprobar')` | `app/api/cambios/route.ts` |
| POST·DELETE | `/api/cambios/desbloquear` | `exigir()` (5/5min usuario+IP) | `app/api/cambios/desbloquear/route.ts` |
| GET | `/api/estado` | `exigir()` + filtro por permiso, rebanada a rebanada | `app/api/estado/route.ts:44-57` |
| GET | `/api/integraciones` | `exigir('administracion','ver')` | `app/api/integraciones/route.ts` |

> `/api/estado` devuelve **todo el tenant** que el rol puede ver, y dispara cuatro
> barridos de mantenimiento en paralelo (`estado/route.ts:63-70`), entre ellos
> `recomputarEstadoCampanas()` y `recomputarEstatusArrendadores()` — **escribe en la base**.

### Inventario

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| GET·POST | `/api/sitios` | `exigir('network','ver')` / `exigir('inventario','crear')` | `app/api/sitios/route.ts` |
| PATCH·DELETE | `/api/sitios/[id]` | `exigir('inventario','crear')` + **DESBLOQ** | `app/api/sitios/[id]/route.ts` |
| GET | `/api/sitios/[id]/media` | `exigir('network','ver')` | `app/api/sitios/[id]/media/route.ts` |
| POST·DELETE | `/api/sitios/[id]/pausa-legal` | `exigir('arrendadores','crear')` | `.../pausa-legal/route.ts` |
| POST | `/api/sitios/[id]/reubicar` | `exigir('arrendadores','crear')` | `.../reubicar/route.ts` |
| GET | `/api/sitios/[id]/space-eye` | `exigir('comercial','ver')` | `.../space-eye/route.ts` |
| POST | `/api/sitios/import` | `exigir('inventario','crear')` | `app/api/sitios/import/route.ts` |
| POST | `/api/predios` · PATCH `/api/predios/[id]` · POST `/api/predios/[id]/pantallas` | `exigir('arrendadores','crear')` | `app/api/predios/**` |
| POST | `/api/incidencias` | `exigir('arrendadores','crear')` | `app/api/incidencias/route.ts` |
| GET·POST | `/api/almacen` · POST `/api/almacen/[id]/movimiento` | `exigir('operaciones','ver'\|'crear')` | `app/api/almacen/**` |
| POST | `/api/licencias` · PATCH·DELETE `/api/licencias/[id]` | `exigir('arrendadores','crear'\|'aprobar')` | `app/api/licencias/**` |

### Arrendadores y contratos

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| POST | `/api/arrendadores` | `exigir('arrendadores','crear')` | `app/api/arrendadores/route.ts` |
| PATCH·DELETE | `/api/arrendadores/[id]` | **SENSIBLE** | `app/api/arrendadores/[id]/route.ts` |
| POST | `/api/contratos` | **SENSIBLE** | `app/api/contratos/route.ts` |
| PATCH | `/api/contratos/[id]` | **SENSIBLE** | `app/api/contratos/[id]/route.ts` |
| POST | `/api/contratos/[id]/cancelar` · `/renovar` | **SENSIBLE** | `.../cancelar|renovar/route.ts` |
| GET | `/api/contratos/[id]/documento` | `exigir()` + `siAlguno(['arrendadores','finanzas'])` | `.../documento/route.ts` |
| GET·POST | `/api/contratos/[id]/firma` | `exigir('arrendadores','ver'\|'crear')` | `.../firma/route.ts` |
| PATCH | `/api/pagos-renta/[id]` | `exigir('arrendadores','crear')` | `app/api/pagos-renta/[id]/route.ts` |
| POST | `/api/pagos-renta/[id]/pagar` | **SENSIBLE** | `.../pagar/route.ts` |
| GET | `/api/pagos-renta/[id]/adjunto/[tipo]` | `exigir('arrendadores','ver')` | `.../adjunto/[tipo]/route.ts` |
| POST · PATCH·DELETE | `/api/razones-sociales` · `/[id]` | `exigir('arrendadores','crear')` | `app/api/razones-sociales/**` |

### Comercial

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| POST · PATCH | `/api/clientes` · `/api/clientes/[id]` | `exigir('comercial','crear')` | `app/api/clientes/**` |
| POST · PATCH | `/api/propuestas` · `/api/propuestas/[id]` | `exigir('comercial','crear')` | `app/api/propuestas/**` |
| PATCH | `/api/propuestas/items/[id]` | `exigir('comercial','crear')` | `.../items/[id]/route.ts` |
| POST | `/api/propuestas/[id]/generar-campana` | `exigir('comercial','crear')` | `.../generar-campana/route.ts` |
| POST | `/api/reservar` | `exigir('comercial','crear')` | `app/api/reservar/route.ts` |
| PATCH | `/api/reservas/[id]/creativo` | `exigir('comercial','crear')` | `.../creativo/route.ts` |
| POST · PATCH·DELETE·PUT | `/api/creatividades` · `/[id]` | `exigir('comercial','crear')` | `app/api/creatividades/**` |
| GET | `/api/creativos/[id]/arte` | `exigir('comercial','ver')` | `.../arte/route.ts` |
| POST | `/api/campanas/[id]/{confirmar,contrato,extender,oc,validar,creativos/repartir,enviar-dominio}` | `exigir('comercial','crear')` | `app/api/campanas/[id]/**` |
| GET·POST | `/api/campanas/[id]/playlogs` | `exigir('comercial','ver'\|'crear')` | `.../playlogs/route.ts` |
| POST | `/api/campanas/[id]/facturar` | **SENSIBLE** | `.../facturar/route.ts` |
| POST | `/api/ordenes-compra` | `exigir('comercial','crear')` | `app/api/ordenes-compra/route.ts` |

### Operaciones, imprenta y finanzas

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| GET·POST | `/api/ot` | `exigir('operaciones','ver'\|'crear')` | `app/api/ot/route.ts` |
| GET | `/api/ot/[id]` | `exigir('operaciones','ver')` — **no hay PATCH** | `app/api/ot/[id]/route.ts` |
| POST | `/api/ot/[id]/cerrar` | `exigir('operaciones','crear')` | `.../cerrar/route.ts` |
| GET·POST · PATCH | `/api/impresion` · `/[id]` · `/[id]/prueba-color` | `exigir('imprenta','ver'\|'crear')` | `app/api/impresion/**` |
| POST | `/api/cobranzas/[id]/pagar` | **SENSIBLE** | `.../pagar/route.ts` |
| POST | `/api/cobranzas/[id]/recordar` | `exigir('finanzas','crear')` | `.../recordar/route.ts` |

### Notificaciones

| Método | Ruta | Guard | Archivo |
|---|---|---|---|
| GET | `/api/notificaciones/nuevas` | `exigir()` | `app/api/notificaciones/nuevas/route.ts` |
| POST | `/api/notificaciones/[id]/leer` | `exigir()` | `.../[id]/leer/route.ts` |
| POST | **`/api/notificaciones/archivar-todas`** | `exigir()` | `.../archivar-todas/route.ts` — **sustituyó a `leer-todas`**, ver §9 |

### Públicos por token (sin sesión, exentos de CSRF)

| Método | Ruta | Credencial | Archivo |
|---|---|---|---|
| GET | `/api/portal/[token]` | `campanas.portal_token` | `app/api/portal/[token]/route.ts` |
| GET·POST | `/api/firma/[token]` | token de firma | `app/api/firma/[token]/route.ts` |
| GET·POST | `/api/propuestas/publica/[id]` | `propuestas.token_publico` | `.../publica/[id]/route.ts` |
| GET | `/api/logo/[token]` | `config_negocio.logo_token` | `app/api/logo/[token]/route.ts` |

El tenant de estas rutas lo deriva **Postgres** del token (`portal_tenant_por_token()`,
`propuesta_tenant_por_token()`), nunca el cliente.

### Cron

| Método | Ruta | Credencial | Archivo |
|---|---|---|---|
| POST | `/api/recordatorios` | header `x-recordatorios-token` == `RECORDATORIOS_TOKEN`; **503 si la variable falta** | `app/api/recordatorios/route.ts:39,49-53` |

---

## 6. Modelo de datos

**PostgreSQL, schema `public`, 38 tablas, sin ORM.** `db/schema.sql` (656 líneas,
28 `create table`) + 66 migraciones aditivas que añaden 10 tablas más
(`almacen_activos`, `almacen_movimientos`, `contrato_firmas`, `doohmain_consultas_play`,
`doohmain_remote_campaigns`, `doohmain_remote_lists`, `identidades_externas`,
`licencias`, `media_uploads`, `password_resets`). Todo pertenece a la **pista VIVA**;
`_archive/api/prisma/` tiene un esquema Prisma propio que **no se usa**.

> **`db/schema.sql` por sí solo NO es seguro.** Crea políticas RLS *permisivas*
> (`schema.sql:619-622`, `with check (true)`); el endurecimiento fail-closed llega
> por migración (`20260715_arr_m5_rls_failclosed.sql`, `20260720_hard1_*.sql`).

| Tabla | Propósito | Relaciones clave | Campos de negocio |
|---|---|---|---|
| `tenants` | Organización/CRM. RLS **exenta** | padre de casi todo | `slug`, `nombre_comercial`, `exigir_reautenticacion`, `rfc`, `domicilio_fiscal`, `representante_legal` |
| `usuarios` | Personas. RLS **fail-closed + FORCE** | → `tenants` | `rol` (`rol_demo`), `password_hash` (**nunca nulo**), `debe_cambiar_password`, `activo`; `lower(email)` UNIQUE **global** |
| `sesiones` | Sesión opaca. RLS **exenta** | → `usuarios` (CASCADE) | token 256 bits, `expira_en` (+30 d), `desbloqueo_expira_en` (ADR 0009) |
| `identidades_externas` | Vínculo Google. fail-closed | → `usuarios` (CASCADE) | `proveedor`, `sub` |
| `password_resets` | Restablecimiento. fail-closed desde 07/08 | → `usuarios` (CASCADE) | token único, 60 min, `usado_en` |
| `rol_permisos` | RBAC. **Sin `tenant_id`, sin RLS** | — | `(rol, modulo, accion)`; `accion` ∈ ver·crear·aprobar·facturar (`schema.sql:75-80`) |
| `config_negocio` | Config por tenant (ADR 0011). fail-closed + FORCE, **sin DEFAULT** | 1:1 `tenants` | `moneda` (default `'PEN'`, `schema.sql:110`), `plazos_cobranza {60,90,120}`, `iva_tasas`, `logo_token`, `email_remitente`, `max_clientes_pantalla` |
| `folios_consecutivos` | Contador atómico global, sin `tenant_id` | — | `(ambito, periodo, ultimo)` |
| `acciones` | Bitácora **append-only** (trigger rechaza DELETE incluso a superusuario) | → `usuarios` | `accion`, `entidad`, `usuario_nombre`, `timestamp` |
| `notificaciones` | Avisos in-app, dedupe por día | → `tenants` | `archivada_en` (migración 10/08) |
| `arrendadores` | Dueño del inmueble. Soft-delete | ← `predios`, `contratos` (RESTRICT) | `rfc` (**único por tenant** desde ADR 0013), `direccion` (obligatorio para el contrato, capturable desde 11/08) |
| `arrendador_razon_social` | Entidad fiscal del arrendador | → `arrendadores` (CASCADE) | — |
| `predios` | Inmueble que aloja N pantallas | → `arrendadores` (RESTRICT) | coordenadas |
| `contratos_arrendamiento` | Contrato de renta | → `arrendadores`\|`predios`\|`sitio`\|`razon_social` | `est_contrato` (incluye `INCOMPLETO`), `monto_renta`, `periodicidad_pago` (incluye `DIARIA`), `documento_url`, `documento_congelado` (texto sellado SHA-256) |
| `pagos_renta` | Calendario de pagos | → `contratos` (CASCADE) | vencimientos anclados al **inicio** del contrato (ADR 0007) |
| `contrato_firmas` | Firma electrónica | → contrato | hash del documento congelado, token |
| `licencias` | Permisos legales del sitio | → `sitios` | — |
| `sitios` | **La pantalla física** | → `predios`, `arrendadores` | `clave_interna`/`codigo_proveedor` UNIQUE **globales** (`schema.sql:124-125`), `caras`, `total_spots`, `max_clientes` (ADR 0008), `en_network`, tres estatus (comercial/legal/operativo), `fotos text[]`, `imagen_promocional`; `renta_arrendador` y `periodicidad_renta` **DEPRECADAS** (`schema.sql:179-181`) |
| `sitio_modalidades` | Formas de venta (mensual, catorcenal, spot, hora) | → `sitios` (CASCADE) | tarifa por modalidad |
| `incidencias` | Averías del sitio | → `sitios` (CASCADE) | — |
| `almacen_activos` / `almacen_movimientos` | Activos físicos y traslados | — | — |
| `clientes` | Anunciante o agencia. Soft-delete | autorreferencia `agencia_id` (NO ACTION) | `iva_pct` (default 16) |
| `propuestas` | Cotización | → `clientes` | `folio` UNIQUE, `token_publico` UNIQUE, `comision_pct` (**divisor**), `descuento_pct` (**descuento**), `aceptado_en/por/ip` |
| `propuesta_items` | Líneas | → `propuestas` (CASCADE), `sitios` (RESTRICT) | `spotsPorDia` |
| `campanas` | La venta ejecutada | → `clientes`, `propuestas` (SET NULL) | `folio` UNIQUE, `portal_token` UNIQUE, `estado_comercial`, **candado**: `oc_recibida`+`fotos_comprobatorias`+`reporte_publicacion`, `enviada_dominio`, `validacion_estatus`, `moneda` default `'PEN'` (`schema.sql:390`) |
| `reservas` | Ocupación sitio × fechas | → `campanas` (CASCADE), `sitios` (RESTRICT) | `estatus` (`TENTATIVA` caduca por `expira_en`), `creativos jsonb` (asignación por pantalla, INC-02) |
| `creatividades` | Piezas (imagen o HTML) | → `campanas` (CASCADE) | `codigo` (HTML), `estatus`, `retirado_en` |
| `ordenes_compra` | ODC del cliente | → `campanas` (CASCADE) | `folio` UNIQUE |
| `ordenes_trabajo` | OT de campo | → `campanas`, `sitios` | `tipo_ot`, `est_ot`, `asignado_a` (**solo se escribe al crear o al cerrar**), folio |
| `evidencias_ot` | Prueba fotográfica | → `ordenes_trabajo` (CASCADE) | foto (base64 o key S3), `lat`/`lng`/`precision_m`, **`tomada_en` (EXIF) ≠ `timestamp` (subida)** |
| `ordenes_impresion` | Imprenta | → `campanas` (CASCADE) | `prueba_color_url`, `prueba_color_aprobada`, folio `OI-2026-NNNN` |
| `facturas` | CFDI simulado | → `campanas` (RESTRICT), `clientes` (RESTRICT) | `folio` UNIQUE, `folio_fiscal`, snapshot fiscal (`rfc`, `razon_social`, `uso_cfdi`, `serie`), `igv` (nombre heredado de Perú, `schema.sql:542-545`), `moneda` default `'PEN'` |
| `cobranzas` | Seguimiento del cobro | → `facturas` (CASCADE) | `plazo_dias` (90), `fecha_vencimiento`, `recordatorio_en`, `recordatorios_enviados`, parcialidades |
| `doohmain_consultas_play` / `doohmain_remote_campaigns` / `doohmain_remote_lists` | Caché de la integración DOOHmain | — | respuesta **cruda** de la API |
| `media_uploads` | Registro de subidas | — | — |

**Aislamiento.** Todas las tablas con `tenant_id` tienen RLS fail-closed + FORCE
salvo las exentas de bootstrap (`tenants`, `sesiones`, `rol_permisos`,
`folios_consecutivos`). Además hay **doble capa**: la app añade `and tenant_id = $n`
explícito en toda operación por id. **21 tablas tienen `DEFAULT` de `tenant_id`
apuntando a `rgb`** (`schema.sql:615`) — es la causa de la deriva de datos conocida;
`config_negocio` se dejó sin default a propósito (`schema.sql:630-633`).

**Las cinco puertas a la base** (`lib/server/db.ts`): `q`/`q1` (fijan tenant, por
defecto), `qRaw`/`qRaw1` (**no** fijan, solo bootstrap), `qConTenant` (tenant explícito
sin sesión), `fijarTenant` / `fijarTenantExplicito` (dentro de transacción). Siempre
transaction-local (`db.ts:12-15,59`).

**Organizaciones en producción:** `rgb` = tenant de plataforma, **vacío**, su Dueño
es el único que puede cambiar de CRM (`tenant.ts:26-29`); `g500` = la que tiene datos
de negocio (nombre comercial `PIXELED`); `eyro` = **perfil de pruebas del usuario**,
pero **publica de verdad** en DOOHmain.

---

## 7. Configuración y entorno

> Solo **nombres**. Los valores viven en `apps/web/.env.production` del droplet,
> fuera de git (`.gitignore`).

### Leídas por el código vivo (`grep process.env` sobre `apps/web`)

| Variable | Para qué | Evidencia |
|---|---|---|
| `DATABASE_URL` | Conexión Postgres | `lib/server/db.ts` |
| `NODE_ENV` | Modo y default de `Secure` | `lib/server/auth.ts:187` |
| `COOKIE_SECURE` | Fuerza/apaga `Secure` | `lib/server/auth.ts:184-188` |
| `APP_URL` | Base de enlaces en correos (5 usos) | `app/api/auth/forgot/route.ts` |
| `HSTS` | Strict-Transport-Security | `next.config.mjs:40` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo saliente (hacen falta **las dos**) | `lib/server/email.ts` |
| `RECORDATORIOS_TOKEN` | Autentica el cron; sin ella la ruta da 503 | `app/api/recordatorios/route.ts:39,49` |
| `NEXT_PUBLIC_AUTOREGISTRO` | `'0'` apaga el alta pública (**UI + servidor**) | `app/api/signup/route.ts:19` |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD` | Apaga recuperar contraseña | `app/(app)/login/page.tsx:24` |
| `NEXT_PUBLIC_MAPTILER_KEY` | Mapas | `components/maps/SitiosMap.tsx` |
| `DO_SPACES_KEY/SECRET/ENDPOINT/BUCKET/CDN_URL` | Almacenamiento S3 | `lib/server/storage.ts` |
| `GOOGLE_OAUTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENDPOINT` | Acceso con Google | `lib/server/google-oauth.ts` |
| `SPACE_EYE_BASE_URL/USER/PASS` | Verificación por cámaras | `lib/server/space-eye.ts` |
| `DOOHMAIN_PUBLISH_ENABLED`, `DOOHMAIN_PY`, `DOOHMAIN_SDK_DIR`, `DOOHMAIN_SCREEN_MAP`, `DOOHMAIN_DEFAULT_SCREEN` | Publicación por subproceso Python | `lib/server/doohmain.ts` |
| `ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY` | Conectores en **modo demo simulado** | `lib/server/integraciones.ts` |
| `MEDIR_ESTADO` | `=1` imprime kB por rebanada de `/api/estado` | `app/api/estado/route.ts` |
| `TZ` | Zona horaria | — |

### Solo pruebas
`DATABASE_URL_TEST`, `DATABASE_URL_TEST_APP`, `PUERTO_E2E`, `PUERTO_DOBLE_GOOGLE`,
`GOOGLE_DOBLE_SUB`, `GOOGLE_DOBLE_EMAIL`, `GOOGLE_AUTH_ENDPOINT`.

### Declaradas en las plantillas pero **no leídas** por código vivo
`JWT_SECRET`, `REDIS_URL`, `COOKIE_DOMAIN`, `LOG_LEVEL`, `PORT` (`.env.example`,
`.env.production.example`). Restos del backend archivado.

### Leídas **solo por código muerto o `_legacy`**
`NEXT_PUBLIC_API_URL` (6 usos) y `NEXT_PUBLIC_TENANT_SLUG` (4 usos):
`lib/auth-context.tsx:16-17`, `lib/api-client.ts:1,38`, `lib/portal-cliente-api.ts:1`,
`lib/data/adapters/http.ts:15`, `components/campanas/ReadinessPanel.tsx:15,17`,
`app/_legacy/portal/[token]/page.tsx:7-8`. Ninguno de esos módulos está en una ruta
alcanzable (ver §9, D-6).

### Variables usadas por el código que **NO aparecen en ninguna plantilla**
`APP_URL`, `HSTS`, `COOKIE_SECURE`, `RECORDATORIOS_TOKEN`, `NEXT_PUBLIC_MAPTILER_KEY`,
`SPACE_EYE_*`, `DOOHMAIN_*`, `ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY`, `TZ`.

### Patrón de las integraciones
Todas están gateadas por sus variables: si faltan, `*Habilitado()` devuelve `false`
y el sistema opera sin ellas **en silencio** (`storage.ts`, `email.ts`, `google-oauth.ts`,
`space-eye.ts`). Estado declarado en la bóveda: Resend **apagado** en producción,
`DOOHMAIN_PUBLISH_ENABLED=1` **encendido**, Google **configurado**.

---

## 8. Despliegue, respaldos y operación

| Pieza | Valor | Evidencia |
|---|---|---|
| Host | Droplet DigitalOcean, IP vieja `209.97.146.136` | `vault/01-Arquitectura/entorno-y-despliegue.md` |
| Dominio | `https://demo.space-os.io`, ruta pública `/spaces-dooh/` | `next.config.mjs:8-9` |
| Directorio | `/var/www/Spaces` | `.github/workflows/deploy.yml:88` |
| Proceso | pm2 `spaces-web`, **fork, 1 instancia**, puerto 3000, usuario `emiliano` | `ecosystem.config.js:10-12` |
| Base | `spaces_prod`; migraciones como rol `postgres` | `deploy.yml:14-19` |
| Reverse proxy | nginx TLS + HSTS, `proxy_pass http://spaces_web` | `infra/nginx/demo.space-os.io.conf:68-70,112` |

**`X-Forwarded-For $remote_addr` es deliberado** (`demo.space-os.io.conf:123`):
**reemplaza** la cabecera en vez de añadir. Es lo que impide elegirse el propio cubo
de rate limit. `instances: 1` es lo que hace que el limitador en memoria (`Map` en
proceso, `lib/server/rate-limit.ts`) funcione; subirlo lo rompe **en silencio**.

### CI

| Workflow | Disparo | Qué corre |
|---|---|---|
| `ci.yml` | `pull_request` + push a `main` | typecheck → test → build. **`pull_request` y NO `pull_request_target` a propósito** (`ci.yml:18-24`) |
| `lockfile-check.yml` | push + PR | `npm ci --dry-run` |
| `deploy.yml` | **`workflow_dispatch` manual** | SSH → backup `pg_dump -Fc` → migraciones como `postgres` → build+reload como `emiliano` |

`deploy.yml` fue **reescrito el 31/07/2026** tras un despliegue manual que reveló
cuatro defectos (ruta muerta, rol equivocado en migraciones, `npm ci` como root,
`pm2` como root) — todos documentados y corregidos en la cabecera del propio archivo
(`deploy.yml:3-37`). Tiene `concurrency` sin cancelación, valida la `ref` contra
inyección (`deploy.yml:98-101`) y deriva el nombre de la base de `.env.production`
en vez de hardcodearlo (`deploy.yml:110`). **No hay despliegue continuo.**

### Procedimiento real de despliegue (de los `DESPLIEGUE_*.txt` ejecutados)

1. `pull` de la fuente **antes** del ensayo.
2. Respaldo `pg_dump` comprimido **como `postgres`** (con el rol de la app, la RLS
   fail-closed lo dejaría sin filas y *parecería* bueno).
3. Ensayo de la migración dentro de una transacción que acaba en `ROLLBACK`
   (quitando a mano el `commit;` que traiga el fichero).
4. Migración con `ON_ERROR_STOP=1`. **Migración primero, código después.**
5. Build: **leer el código de salida antes de recargar** (turbo imprime «Compiled
   successfully» y puede fallar después en typecheck).
6. `pm2 reload`, verificar reinicios, login 200 y el **artefacto servido**.
7. Anotar en `DESPLIEGUE_*.txt` con la hora.

### Respaldos y correcciones de datos
- No hay respaldo automatizado en el repo; los `pg_dump` se toman a mano en cada
  despliegue (`spaces_prod_pre_*_YYYYMMDD.sql.gz`, ~7.1 MB, 38 bloques `COPY`).
- Las correcciones de datos de producción viven en `docs/datos/` **con su rollback
  capturado antes** (13 archivos).
- **No hay tabla de control de migraciones ni herramienta.** El registro son las
  notas `DESPLIEGUE_*.txt` escritas a mano.

### Tareas programadas
Una sola: el cron del droplet hace `POST /api/recordatorios` (barrido diario de
contratos, recorre todos los tenants fijando `app.tenant_id` uno por uno, idempotente
por día). Los otros cuatro barridos (reservas vencidas, estatus de arrendadores,
estado de campañas, recordatorios de cobranza) **no son cron**: corren dentro de
`GET /api/estado`, es decir, cuando alguien abre la aplicación.

### Estado desplegado a hoy (11/08)
`3164aaa` desplegado a las 09:35 sin migraciones, arrastrando además V2-01
(hidratación ligera). Commits **posteriores y sin desplegar**: `376841f`
(secciones plegables en Arrendadores), `349f03f` (rótulos del menú), `504b4fc`
(domicilio del arrendador).

---

## 9. Notas de la bóveda que ya no coinciden con el código (DESFASADO)

> Esta es la sección con más valor del encargo. Cada punto: **qué dice la bóveda**,
> **qué dice el código hoy**, **la diferencia concreta**.

### D-0 · La premisa de arquitectura del encargo, corregida
- **Se me pidió verificar:** «`apps/api` (Fastify/Prisma) y los grupos de rutas
  `(comercial)` y `(operaciones)` no están desplegados».
- **Código hoy:** `apps/` contiene **solo `web`**; el Fastify vive en `_archive/api`.
  Los grupos de ruta `(comercial)` y `(operaciones)` **no existen en ninguna parte**
  del repo (`find apps/web/app -type d -name '(*)'` devuelve solo `(app)`, `(app)/(shell)`
  y `_legacy/(auth)`).
- **Diferencia:** la premisa está desactualizada en el nombre de la carpeta y es
  falsa en lo de los grupos de ruta. La bóveda ya lo tenía bien
  (`vault/01-Arquitectura/vision-general.md:21-25`). **Confirmado: una sola pista viva.**

### D-1 · `/api/notificaciones/leer-todas` ya no existe
- **Bóveda:** `vault/02-Backend/api-endpoints.md:165` lista
  `POST /api/notificaciones/leer-todas`.
- **Código hoy:** existe `app/api/notificaciones/archivar-todas/route.ts`; **no hay
  ningún `leer-todas`**. El diario del 10/08 lo verificó en producción («`leer-todas` **404**»).
- **Diferencia:** la tabla de endpoints nombra una ruta muerta y omite la viva.
  Es el único desfase de la tabla de endpoints; todo lo demás cuadra.

### D-2 · El menú por fases no está en las notas de Frontend, y sus rótulos ya cambiaron
- **Bóveda:** `vault/07-Agentes/diario/2026-08-11.md:25-29` documenta los grupos como
  «LO QUE TIENES · VENDER · ENTREGAR · **COBRAR** · SISTEMA».
  `vault/03-Frontend/shell-y-navegacion.md` y `modulos-internos.md` **no mencionan
  los grupos en absoluto**: siguen describiendo el menú plano.
- **Código hoy:** `components/demo/shell/nav.ts:75-82` define los títulos
  **«Inventario · Vender · Entregar · Finanzas · Sistema»** (commit `349f03f`, 11/08).
  Las claves internas (`patrimonio`, `cobrar`) se conservaron a propósito.
- **Diferencia:** dos rótulos distintos de los documentados, y dos notas de Frontend
  que describen una navegación anterior.

### D-3 · Las citas de línea de `lib/server/auth.ts` están **4 líneas corridas**
- **Bóveda:** `autenticacion-y-sesion.md:27-33` cita `auth.ts:96-105` (token),
  `112-126` (`usuarioActual`), `150-182` (`exigir`), `188-192` (`cookieSecure`),
  `195-211` (`cookieSesion`), `213-230` (`cookieCsrf`), `59` (`passwordAleatoria`);
  `api-endpoints.md:24-25` repite `112-126` y `150-182`; `zonas-de-riesgo.md` y
  `flujo-login.md` heredan las mismas.
- **Código hoy** (`auth.ts`, 226 líneas): `passwordAleatoria` **55**, `hashPassword` **83**,
  `crearSesion` **92**, `usuarioActual` **108**, `exigir` **146**, `cookieSecure` **184**,
  `cookieSesion` **191**, `cookieCsrf` **216**.
- **Diferencia:** todas apuntan ~4 líneas más abajo de lo real. Ninguna da error;
  simplemente mandan al sitio equivocado. El diario del 10/08 lo detectó y **no se
  corrigió en las notas**.

### D-4 · La política de contraseñas ya no vive en `auth.ts`
- **Bóveda:** `autenticacion-y-sesion.md:126` — «Política única (`auth.ts:35-57`)».
- **Código hoy:** la política está en **`apps/web/lib/password.ts:26-31`**, fuera de
  `server-only`, y `auth.ts:31-38` solo la reexporta. Se movió el 10/08 (commit
  `cde5f58`) precisamente porque los formularios no podían importarla.
- **Diferencia:** la cita apunta a un archivo que ya no contiene la regla. Es el
  origen de verdad para tres formularios y una prueba que los vigila.

### D-5 · Los recuentos de tamaño de los archivos grandes
- **Bóveda:** `02-Backend/_indice.md:42-51` y `zonas-de-riesgo.md:146-151`.
- **Código hoy** (`wc -l`):

| Archivo | Bóveda | Real hoy | Δ |
|---|---|---|---|
| `lib/server/arrendadores-repo.ts` | 1317 | **1435** | +118 |
| `lib/server/campanas-repo.ts` | 1044 | **1204** | +160 |
| `lib/server/doohmain.ts` | 313 | **403** | +90 |
| `lib/server/creativos-repo.ts` | 287 | **366** | +79 |
| `lib/server/sitios-repo.ts` | 624 | **640** | +16 |
| `lib/server/arrendadores-controller.ts` | 460 | **471** | +11 |

- **Diferencia:** los cuatro primeros crecieron entre un 6 % y un 29 % en cuatro días.
  Importa porque esa tabla se usa para estimar superficie de conflicto entre agentes.

### D-6 · `OTMovil.tsx` **no lo usa nadie** — y con él caen tres afirmaciones
- **Bóveda:** `operaciones-y-ot.md:87-90` («`OTMovil.tsx` depende del `AuthProvider`
  muerto»), `paginas-publicas.md:76-77`, `zonas-de-riesgo.md:178-181` (A6) y
  `preguntas-abiertas.md:109-115` (P8: «¿`OTMovil` funciona hoy en campo, o depende
  de un `user` que siempre es `null`?»).
- **Código hoy:** `app/(app)/m/ot/[id]/page.tsx:3,7` renderiza **`OTVista`**, no
  `OTMovil`. Ningún archivo importa `components/operaciones/OTMovil.tsx`; ninguno
  importa `components/shared/PermissionGuard.tsx`; ninguno importa
  `components/campanas/ReadinessPanel.tsx` ni `ReporteVisual.tsx`.
- **Diferencia:** **P8 tiene respuesta y no es la que se temía.** Los tres
  consumidores de `lib/auth-context.tsx` fuera de `providers.tsx` son código muerto
  no alcanzable. El `AuthProvider` sigue montado en `providers.tsx:34` (verificado),
  pero **ningún componente vivo depende de su `user`**. Retirarlo es menos arriesgado
  de lo que dice A6. Además, `modulos-internos.md:28` lista `ReadinessPanel` y
  `ReporteVisual` como componentes de `/campanas/[id]`, y no lo son.

### D-7 · `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_TENANT_SLUG` los leen 6 y 4 archivos, no uno
- **Bóveda:** `entorno-y-despliegue.md:121-125` — «`NEXT_PUBLIC_API_URL` (esta última
  solo la lee el `auth-context.tsx` muerto)» y `NEXT_PUBLIC_TENANT_SLUG` entre las
  **no leídas**.
- **Código hoy:** `NEXT_PUBLIC_API_URL` en `lib/auth-context.tsx:16`, `lib/api-client.ts:1`,
  `lib/portal-cliente-api.ts:1`, `lib/data/adapters/http.ts:15`,
  `components/campanas/ReadinessPanel.tsx:17` y `app/_legacy/portal/[token]/page.tsx:7`.
  `NEXT_PUBLIC_TENANT_SLUG` en cuatro de esos mismos.
- **Diferencia:** la afirmación es inexacta. El **efecto** sí es el que dice la bóveda
  (ninguno de esos módulos está en una ruta alcanzable, ver D-6), pero quien lea la
  nota y borre la variable creyendo que solo la toca un archivo muerto se llevará una
  sorpresa al reactivar cualquiera de ellos.

### D-8 · `lib/portal-cliente-api.ts` no es el cliente del portal público
- **Bóveda:** `estado-y-data-fetching.md:108` lo lista como «Portal público».
- **Código hoy:** el portal vivo `app/(app)/portal/[token]/page.tsx:8` usa
  `hidratarPortalPublico` de `lib/data/estado-api.ts`. `portal-cliente-api.ts` solo
  lo importan las cinco páginas de `app/_legacy/portal/cliente/`.
- **Diferencia:** apunta al cliente del portal **archivado**, que además habla con el
  Fastify inexistente.

### D-9 · `deploy.yml` ya **no** está desactualizado
- **Bóveda:** `entorno-y-despliegue.md:50-56` — «`deploy.yml` solo corre a mano y
  **está desactualizado**».
- **Código hoy:** fue reescrito el 31/07/2026 y hoy usa la ruta correcta
  (`/var/www/Spaces`), aplica migraciones **como `postgres`**, corre la app como
  `emiliano`, deriva el nombre de la base de `.env.production`, valida la `ref`
  contra inyección y tiene `concurrency` sin cancelación (`deploy.yml:3-37,88-120`).
- **Diferencia:** sigue siendo **manual** (`workflow_dispatch`) y no consta que se
  haya ejecutado nunca, pero llamarlo «desactualizado» ya no describe el archivo.

### D-10 · Recuentos menores que ya no cuadran
| Afirmación | Bóveda | Real hoy |
|---|---|---|
| «86 Route Handlers» en el diagrama | `vision-general.md:47` | **88** archivos / 110 métodos |
| «65 de 86 handlers» usan `exigir()` | `zonas-de-riesgo.md:36` | base 88, no 86 |
| «Cero cambios en … los 86 handlers» | `flujo-acceso-con-google.md:40` | 88 |
| `db/schema.sql` (657 líneas) | `esquema.md:13` | **656** |
| «130 archivos en `app/`, 69 componentes» | `03-Frontend/_indice.md:13` | **132** archivos, **68** componentes `.tsx` |
| «~75 archivos en `lib/server/`» | `02-Backend/_indice.md:13` | **76** |
| «los 12 ADR» | `decisiones.md:51` (MOC) | **13** (`0013` existe y **no está** en la tabla de `decisiones.md:20-33`) |

### D-11 · Preguntas abiertas que ya tienen respuesta en el código
- **P3c** («¿qué falta del aislamiento de `password_resets`?») —
  `preguntas-abiertas.md:71-78` sigue abierta, pero el diario del 10/08 documenta que
  se **desplegó y verificó** (`rls=t force=t`, `auth_reset_por_token` con GRANT), y el
  código lo confirma: `password-reset-repo.ts:21-24,64` usa `qConTenant` para escribir
  y la función SECURITY DEFINER para leer. **Cerrada de hecho, abierta en la lista.**
- **P8** (`AuthProvider` muerto) — respondida por D-6.
- **P16** (`vault/.obsidian/` sin ignorar) — sigue igual: la carpeta existe y
  `.gitignore` no la cubre.

### Lo que verifiqué y **SÍ cuadra** (para que conste)
88 endpoints · 66 migraciones · 38 tablas · 22 pantallas internas · `basePath` y
`trailingSlash` (`next.config.mjs:8-9`) · `HSTS` (`next.config.mjs:40`) · alias de
webpack para `styled-jsx` (`next.config.mjs:47-56`) · `overrides` de React
(`package.json:16`) · `BASE_PATH` duplicado (`middleware.ts:5`) · 308 de `/demo`
(`middleware.ts:44`) · el comentario **obsoleto y peligroso** de `tenant.ts:12-15`
(«la conexión sigue siendo superuser, así que RLS no aplica») sigue ahí ·
`db.ts:12-15` y `db.ts:54-69` · `schema.sql:75-80,110,124-125,179-181,390,615,630-633,646-651` ·
`cambios.ts:49,199,221,236` · `ecosystem.config.js` con `instances:1` fork ·
`X-Forwarded-For $remote_addr` (`nginx:123`) · el `AuthProvider` montado
(`providers.tsx:34`) · los parches de `fetch` (`providers.tsx:13-16`) ·
`QueryClient` por instancia (`providers.tsx:18-30`) · V2-01 en `main`
(`sitios-repo.ts:37,97-101`, `arrendadores-repo.ts:355`) · `README.md` describe
Fastify + Prisma + Redis + `apps/api` y **está obsoleto** (`README.md:5-31`).

---

## 10. Huecos y dudas para preguntar al humano

### Sobre el producto y el negocio (necesarios para escribir manuales)
1. **¿Quién usa cada rol en la vida real?** El código define cinco roles, pero no
   consta en ninguna parte quién los ocupa ni con qué frecuencia. Sin esto, un manual
   de usuario no puede ordenar tareas por prioridad.
2. **¿`/configuracion` es alcanzable desde el menú?** No está en `NAV`
   (`nav.ts:84-126`), así que un manual no puede decir «entra por el menú lateral».
   Falta confirmar por dónde se llega (Topbar, Administración, o solo por URL).
3. **`/propuesta` (sin `[id]`)** existe como página pero no aparece descrita en
   ninguna nota de la bóveda. ¿Es la «consulta de propuesta por código»? ¿Sigue en uso?
4. **`/comisiones`** se describe como «derivado» sin más. ¿Qué comisión calcula:
   la de agencia (`propuestas.comision_pct`) o comisión de vendedor? No hay tabla propia.
5. **Almacén (`/almacen`)** está marcado como «Fase 3» en la bóveda. ¿Está en uso real
   o es funcionalidad adelantada?

### Sobre operación y datos
6. **¿Cómo se sabe qué migraciones están aplicadas en producción?** (P5 de la bóveda,
   sigue sin respuesta). No hay tabla de control; el único registro son los
   `DESPLIEGUE_*.txt`. Ya hubo una divergencia de 27 columnas.
7. **¿Quién es dueño del proyecto de Google Cloud y quién rota el `client_secret`?** (P3).
8. **Los tres commits del 11/08 posteriores al despliegue** (`376841f`, `349f03f`,
   `504b4fc`) están en `main` **sin desplegar**. ¿Se despliegan juntos? El de
   `arrendadores.direccion` cambia un flujo que hoy está roto en producción.
9. **V2-01 sigue sin medir en producción**: su métrica (`<500 kB`, `<1 s` en frío)
   no está tomada. ¿Se midió el 11/08 al desplegar `3164aaa`?
10. **Las 2 pantallas de `eyro` sin creativo asignado** (INC-02). ¿Se cierran o se
    dejan, ahora que `eyro` está reclasificado como tenant de pruebas?

### Decisiones pendientes que el código no puede resolver
11. **`rol_permisos` es global a la instalación** (sin `tenant_id`, `schema.sql:75-80`).
    Cambiar los permisos de un rol se los cambia a las cinco organizaciones. ¿Es
    deliberado o es la misma deuda que el ADR 0011 arregló para `config_negocio`? (P4)
12. **21 tablas con `DEFAULT` de `tenant_id` a `rgb`** (`schema.sql:615`). ¿Se quitan
    para que un insert sin tenant falle en vez de mentir? (P15)
13. **`clave_interna` y `codigo_proveedor` son UNIQUE globales** (`schema.sql:124-125`):
    dos organizaciones no pueden usar el mismo código de proveedor. ¿Deseado? (P12)
14. **El `catch` vacío de la bitácora** (`acciones-repo.ts`, INC-06): 8 de 8 handlers
    `DELETE` registran, 0 de 8 de forma atómica, y el fallo no se loguea. ¿Basta con
    loguear o hace falta atomicidad? (P19)
15. **Defaults `PEN`/`IGV` con operación en México** (`schema.sql:110,390,545`). ¿Queda
    alguna ruta que use el default sin corregir? (P13)
16. **El store de zustand y el BFF conviven** (`lib/data/store.ts`). ¿La dirección es
    retirar el store o dejarlo como caché de UI? Quien añada una pantalla necesita
    saber de cuál lee. (P14)

### Lo que no pude verificar por las restricciones del encargo (solo lectura, sin sondeos)
17. **Nada del estado real de `spaces_prod`**: número de filas, qué tenants existen
    hoy, qué migraciones están aplicadas. Todo lo que digo de producción viene de las
    notas `DESPLIEGUE_*.txt` y del diario, no de la base.
18. **El contenido de `.env.production` del droplet.** El estado de las integraciones
    (Resend apagado, `DOOHMAIN_PUBLISH_ENABLED=1`, Google configurado) lo tomo de la
    bóveda, que dice haberlo comprobado el 07/08 y el 10/08.
19. **Si el despliegue del 11/08 (`3164aaa`) sigue siendo lo que corre.** No hay forma
    de confirmarlo sin SSH.
20. **Si las pruebas pasan hoy** (789 unitarias + 136 e2e según el diario): no corrí
    `npm test` porque está fuera de mis permisos.

---

## Relacionadas
[[MOC-Proyecto]] · [[vision-general]] · [[api-endpoints]] · [[esquema]] ·
[[zonas-de-riesgo]] · [[preguntas-abiertas]] · [[tablero]] · [[2026-08-11]]
