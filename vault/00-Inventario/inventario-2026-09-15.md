---
tipo: inventario
estado: verificado
actualizado: 2026-09-15
tags: [inventario, reconocimiento, endpoints, datos, instancias, flota, licencias]
archivos:
  - apps/web/app/api/
  - apps/web/middleware.ts
  - apps/web/lib/server/db.ts
  - apps/web/lib/server/auth.ts
  - apps/flota/
  - infra/scripts/
  - db/schema.sql
  - db/migrations/
  - scripts/migrar.mjs
  - .github/workflows/
  - Dockerfile
---

# Inventario — SPACE OS — 2026-09-15

> **Sustituye a [[00-Inventario/inventario-2026-08-11]]**, que tiene más de un mes y
> es anterior al aterrizaje del modelo de instancias soberanas en `main` (28/08), al
> alta en droplet propio del cliente (11/09), al sistema de licencias, al panel de
> flota y al receptor de reportes.
>
> **Todo recuento de este documento se midió hoy sobre el repositorio**, no se copió
> de ninguna nota. Las cifras que no cuadran con la bóveda o con `CLAUDE.md` están en
> la §9.

---

## 1 · Resumen

CRM/ERP **multi-organización para publicidad exterior (OOH/DOOH)**: inventario de
pantallas y espectaculares, arrendadores y contratos de renta, propuestas comerciales,
campañas, órdenes de trabajo en campo, imprenta, facturación y cobranza.

- **Para quién:** cada cliente («owner») es una empresa de medios OOH. Desde el ADR
  0022 **cada owner corre su propia instancia completa** en su propio servidor, con su
  base y su dominio. AS OOH opera el PADRE, que construye, firma y vigila.
- **Producto vivo:** **una sola aplicación Next.js con BFF integrado** (`apps/web`).
  Next **14.2.29**, App Router, React 18.3.1, TypeScript 5.9.2, Node ≥18
  (`apps/web/package.json:17`, `package.json:14-24`).
- **Base de datos:** PostgreSQL con **`pg` directo, sin ORM** (`apps/web/package.json:38`,
  `apps/web/lib/server/db.ts`).
- **Aislamiento:** RLS de Postgres por `app.tenant_id` (`apps/web/lib/server/db.ts:74-89`).
- **Artefacto:** una imagen Docker idéntica para toda la flota (`Dockerfile`), con la
  versión sellada dentro (`Dockerfile:78-79`).
- **Plano de control:** `apps/flota`, que **no viaja en la imagen** — el `Dockerfile`
  construye con `--filter=web` (`Dockerfile:60`).
- **Estado al 2026-09-15:** en producción con **al menos una instancia de cliente con
  datos reales** (`g500`), y con un defecto activo: el canal `estable` sirve una imagen
  anterior al arreglo del middleware. Ver §14.

### Los recuentos de hoy, medidos

| Qué | Medido hoy | Cómo se midió |
|---|---|---|
| Route handlers (`route.ts`) | **92** | `find apps/web/app/api -name route.ts \| wc -l` |
| Métodos HTTP exportados | **115** | 31 GET · 55 POST · 18 PATCH · 9 DELETE · 2 PUT |
| Páginas (`page.tsx`) | **31** | `find apps/web/app -name page.tsx` |
| Tablas | **40** | 28 en `db/schema.sql` + 12 creadas por migración |
| Migraciones | **80** | 76 de esquema + **4** con `-- @tipo: datos` |
| Notas de la bóveda | **69** | `find vault -name "*.md"` |
| ADR | **32** (`0001`–`0032`) | `ls docs/adr/` |
| Casos de prueba unitarios `apps/web` | **1092** en **103** archivos | grep estático de `it(`/`test(` |
| Casos e2e `apps/web` | **345** en **34** archivos | ídem, sobre `*.e2e.test.ts` |
| Casos `apps/flota` | **286** en **15** archivos | ídem |

> [!warning] Los conteos de pruebas son ESTÁTICOS, no de corrida
> Se contaron con `grep` sobre `it(`/`test(`. Un `it.each` cuenta **uno** aquí y
> varios en el runner, así que el número real del runner es **igual o mayor**. No se
> corrió `npm test`: este reconocimiento es de solo lectura. Para la cifra exacta:
> `cd apps/web && npm test`.

---

## 2 · Mapa del repositorio

| Carpeta | Qué vive ahí |
|---|---|
| `apps/web/` | **La única pista viva.** Next 14 con BFF integrado. Páginas en `app/`, endpoints en `app/api/`, lógica de servidor en `lib/server/` (16 867 líneas en 40+ archivos) |
| `apps/flota/` | **El plano de control del PADRE.** 18 módulos `.mjs` sin dependencias + 15 archivos de prueba. **No viaja en la imagen** (`apps/flota/package.json:5`) |
| `packages/` | `types`, `ui`, `utils`, `eslint-config`, `typescript-config` — workspaces compartidos |
| `db/` | `schema.sql` (el esquema base), `migrations/` (80), `semilla-desarrollo.sql`, `dev-rol-app.sql`, `docker-compose.yml` (Postgres de desarrollo en el **5433**) |
| `scripts/` | `migrar.mjs` (el runner de migraciones y su `ANTES_DE`), `migrar.test.ts` (20 casos), generadores de plantillas |
| `infra/scripts/` | Los guiones de instancia: `provision-instancia.sh`, `instalar-hijo.sh`, `update.sh`, `base-instancia.sh`, `entorno-instancia.sh`, `respaldo.sh`, `setup-droplet.sh` + 4 arneses `pruebas-*.sh` |
| `infra/systemd/` | 5 units + 1 timer: `spaces-web`, `spaces-demo`, `flota-panel`, `flota-reporte`, `flota-altas` (+ `.timer`) |
| `infra/nginx/` | `space-os.io.conf`, `instancia.conf.tpl`, `instancia-sin-licencia.conf.tpl`, `demo.space-os.io.conf`, `padre-ip.conf`, `snippets/`, `cloudflare-realip.sh` |
| `infra/env/` | `app.env.example`, `instancia.env.example`, `ejecutor.env.example` — **nombres, nunca valores** |
| `infra/licencias/` | `space-os.pub` (113 bytes, la llave pública Ed25519) y `estados.casos.tsv` (el banco compartido por las dos implementaciones) |
| `.github/workflows/` | `ci.yml`, `release.yml`, `promover.yml`, `lockfile-check.yml` |
| `docs/` | 32 ADR, planes, runbooks, `Registro_Cambios.md`, `evidencias/` (71 archivos), `datos/` (correcciones en producción con rollback), `noche/`, 10 `Traspaso_*.md` |
| `vault/` | La bóveda: 69 notas Markdown enlazadas. Punto de entrada `vault/00-Indice/MOC-Proyecto.md` |
| `Dockerfile` | En la **raíz**. Contexto de build = raíz del monorepo, no `apps/web` (`Dockerfile:3-7`) |

### Lo que NO está vivo

- **`_archive/api`** — la pista Fastify + Prisma + BullMQ. Fuera de los workspaces npm.
- **`_archive/web-frontend-2`** — el segundo frontend.
- **`README.md` de la raíz — DESACTUALIZADO.** Verificado hoy: sigue describiendo
  «API — Fastify + Prisma + Redis + BullMQ», `apps/api/.env`, `prisma migrate deploy`
  y `./infra/scripts/new-tenant.sh` (`README.md:5-28`). Nada de eso existe. Su último
  commit es `d9dd9fd`, muy anterior al modelo actual.
- **`apps/web/lib/auth-context.tsx`** (el `AuthProvider` JWT muerto) y
  **`apps/web/app/_legacy/`** — **ya no existen**. Verificado hoy con `ls`.
- Los `DESPLIEGUE_*.txt` y `MANUAL_*.md` de la raíz son runbooks y manuales ejecutados,
  históricos.
- `infra/scripts/.mutante-*.sh` son residuos de las barridas de mutantes, ignorados por
  git (`.gitignore:158`).

---

## 3 · Pantallas y navegación

`basePath` = **`/spaces-dooh`** y `trailingSlash: true` (`apps/web/next.config.mjs:126-127`).
Toda URL de este documento va bajo ese prefijo.

### Con chrome — `app/(app)/(shell)/` (22 páginas)

El menú **y** el control de acceso salen del mismo archivo:
`apps/web/components/demo/shell/nav.ts`. Lo que un rol no debe ver **no se monta en el
DOM** (`nav.ts:24-25`).

| Ruta | Propósito | Quién entra (campo `roles`) |
|---|---|---|
| `/inicio` | Dashboard | DUENO (`nav.ts:93`) |
| `/inventario` | Pantallas y espectaculares | DUENO (`nav.ts:99`) |
| `/arrendadores` | Arrendadores, predios, contratos, rentas | DUENO (`nav.ts:103`) |
| `/network` | Red de sitios | DUENO, COMERCIAL (`nav.ts:104`) |
| `/clientes` | Clientes | DUENO, COMERCIAL (`nav.ts:109`) |
| `/comercial` | Mapa comercial | DUENO, COMERCIAL (`nav.ts:110`) |
| `/disponibilidad` | Calendario de disponibilidad | DUENO, COMERCIAL (`nav.ts:111`) |
| `/propuestas` y `/propuestas/[id]` | Propuestas comerciales | DUENO, COMERCIAL (`nav.ts:112`) |
| `/campanas` y `/campanas/[id]` | Campañas | DUENO, COMERCIAL (`nav.ts:118`) |
| `/creativos` | Creatividades | DUENO, COMERCIAL (`nav.ts:119`) |
| `/imprenta` | Órdenes de impresión | DUENO, IMPRENTA (`nav.ts:120`) |
| `/operaciones` y `/operaciones/ot/[id]` | Órdenes de trabajo | DUENO, OPERACIONES (`nav.ts:121`) |
| `/almacen` | Almacén de activos | DUENO, OPERACIONES (`nav.ts:122`) |
| `/finanzas` | Facturas y cobranza | DUENO, FINANZAS (`nav.ts:125`) |
| `/comisiones` | Comisiones | DUENO, COMERCIAL (`nav.ts:126`) |
| `/integraciones` | Integraciones externas | DUENO (`nav.ts:131`) |
| `/actividad` | Bitácora de acciones | DUENO (`nav.ts:132`) |
| `/administracion` | Usuarios, roles, matriz de permisos | DUENO (`nav.ts:133`) |
| `/configuracion` | Configuración de la organización | (no listada en `nav.ts`; se alcanza desde el menú de usuario) |
| `/codigos-recuperacion` | Códigos de recuperación de la cuenta | Cualquier sesión — es **salida obligatoria** del gate de sesión |

El layout del shell monta además **`BandaLicencia`**, que avisa del vencimiento de la
licencia y **no bloquea nada** (`app/(app)/(shell)/layout.tsx:10`,
`components/demo/shell/BandaLicencia.tsx:33-37`).

### Sin chrome — `app/(app)/` (9 páginas)

| Ruta | Propósito | Quién entra |
|---|---|---|
| `/login` | Acceso (contraseña y/o Google) | **Público** |
| `/recuperar/[token]` | Fijar contraseña nueva | **Público** con token |
| `/p/[id]` | Propuesta compartible por liga | **Público** con token |
| `/portal/[token]` | Portal de campaña del cliente | **Público** con token |
| `/firmar/[token]` | Firma del contrato por el arrendador | **Público** con token |
| `/contrato/[id]` | Vista del contrato | Sesión |
| `/propuesta` | Alta rápida de propuesta | Sesión |
| `/m/ot/[id]` | Orden de trabajo en móvil (campo) | Sesión |
| `/p/[id]` ↔ `/portal/[token]` | también servidos por subdominio `portal.` (`middleware.ts:11-13`) | |

### El gate de sesión

`apps/web/middleware.ts:129-143`. Son públicas: `/api/*` (se autoprotegen), `/_next/*`,
`/favicon*`, `/login`, `/recuperar/*`, `/p/*`, `/firmar/*`, `/portal/*`. **Cualquier
otra ruta sin cookie `spaces_sesion` redirige a `/login`.**

> [!important] La redirección lleva `Location` **relativa** — y es un arreglo, no un detalle
> `middleware.ts:46-52`. Hasta el 10/09, `NextResponse.redirect(request.nextUrl)` mandaba
> al cliente a `https://localhost:3000/...` porque `nextUrl` toma su origen de donde
> escucha el proceso (`Dockerfile:72-73`), **no de la cabecera `Host`**. El comentario
> de `middleware.ts:16-44` documenta por qué se descartaron las dos alternativas obvias
> (leer `Host` sería un open redirect; `APP_URL` quedaría horneada en el build).
> **Ese arreglo está en `main` pero NO en la imagen que sirve el canal `estable`** — §14.

---

## 4 · Flujos de usuario extremo a extremo

### 4.1 · Login con contraseña

- **Quién:** cualquier usuario con cuenta.
- **Dónde empieza:** `/spaces-dooh/login/`.
- **Pantallas:** `/login` → (si toca) `/codigos-recuperacion` → `/inicio`.
- **Endpoints:** `GET /api/auth/metodos` (qué métodos ofrece esta instancia) →
  `POST /api/auth/login` → `GET /api/auth/me` → `GET /api/estado`.
- **Qué cambia en la base:** fila nueva en `sesiones` con `metodo='password'`
  (`lib/server/auth.ts:107`, migración `20260825_sesion_metodo.sql`).
- **Cookies que se emiten:** `spaces_sesion` (`auth.ts:15`, `:256`) y `spaces_csrf`
  (`auth.ts:274`, `:281`).
- `POST /api/auth/login` está **exento de CSRF** a propósito: es el bootstrap de la
  sesión y todavía no hay cookie que proteger (`middleware.ts:85`).

### 4.2 · Acceso con Google

- **Quién:** usuario con identidad externa vinculada; y, si `AUTOREGISTRO=1`, también
  un alta nueva.
- **Endpoints:** `GET /api/auth/google/inicio` → Google → `GET /api/auth/google/callback`.
- **Base:** `identidades_externas` (`20260806_identidades_externas.sql`, con RLS
  fail-closed), y `sesiones` con `metodo='google'`.
- Desde el **ADR 0028** Google puede ser obligatorio en una instancia
  (`20260907_solo_google.sql`), y el callback puede crear la organización y su Dueño
  (`app/api/auth/google/callback/route.ts:5` → `crearOrgConDueno`).
- El callback tiene rate limit por IP (`lib/server/rate-limit.ts`).

### 4.3 · Recuperación de contraseña

- **Endpoints:** `POST /api/auth/forgot` → correo por Resend → `GET/POST /api/auth/reset`.
- **Pantalla:** `/recuperar/[token]`.
- **Base:** `password_resets` (`20260723_password_resets.sql`, RLS por
  `20260807_password_resets_rls.sql`).
- Se enciende con `NEXT_PUBLIC_RECUPERAR_PASSWORD`.
- Alternativa sin correo: **códigos de recuperación** de un solo uso
  (`codigos_recuperacion`, `20260907_codigos_recuperacion.sql`), con
  `POST /api/auth/codigo` y `POST /api/perfil/codigos-recuperacion`.

### 4.4 · Alta de organización — y hay **tres** caminos distintos

| Camino | Endpoint / guion | Credencial | Cuándo se usa |
|---|---|---|---|
| **Autoregistro** | `POST /api/signup` | ninguna | Solo si `AUTOREGISTRO=1` en el `.env` de esa instancia. **Ausente = apagado** (`app/api/signup/route.ts:13-19`) |
| **Bootstrap de instancia** | `POST /api/bootstrap` | `BOOTSTRAP_TOKEN` **y** que `tenants` esté **vacía** (`app/api/bootstrap/route.ts:26-28`) | El arranque de una instancia recién aprovisionada (F5.2). Devuelve 201 |
| **Desde dentro** | `POST /api/tenants` | sesión + `exigir('administracion','crear')` | Alta de otra organización desde una instancia con varias |

`db/schema.sql` **nace sin ninguna organización** desde el 19/08 (`db/schema.sql:598-611`):
una base recién creada tiene `tenants = 0` y `config_negocio = 0`.

### 4.5 · Propuesta → campaña (el flujo comercial)

1. `/clientes` → `POST /api/clientes`.
2. `/comercial` o `/disponibilidad` → `POST /api/reservar` (reserva de espacios).
3. `/propuestas` → `POST /api/propuestas`, `PATCH /api/propuestas/items/[id]`.
4. Liga compartible: `/p/[id]` → `GET/POST /api/propuestas/publica/[id]` (**público por
   token**, exento de CSRF, `middleware.ts:92`).
5. `POST /api/propuestas/[id]/generar-campana` → nace la campaña.
6. `/campanas/[id]` → `POST .../validar`, `.../confirmar`, `.../oc`, `.../contrato`,
   `.../creativos/repartir`, `.../extender`.
7. **Tablas tocadas:** `clientes`, `reservas`, `propuestas`, `propuesta_items`,
   `campanas`, `ordenes_compra`, `creatividades`.

### 4.6 · Orden de trabajo (operaciones en campo)

- `/operaciones` → `GET/POST /api/ot` → `/operaciones/ot/[id]` o `/m/ot/[id]` en móvil.
- `POST /api/ot/[id]/cerrar` con evidencias.
- **Tablas:** `ordenes_trabajo`, `evidencias_ot`, `incidencias`.

### 4.7 · Facturación y cobranza — **con re-autenticación**

- `POST /api/campanas/[id]/facturar` → `exigirCambioSensible('finanzas','facturar')`.
- `POST /api/cobranzas/[id]/pagar` → `exigirCambioSensible('finanzas','crear')`.
- `POST /api/cobranzas/[id]/recordar` (recordatorio al cliente).
- **Tablas:** `facturas`, `cobranzas`, `folios_consecutivos`.
- `exigirCambioSensible` = `exigir(modulo, accion)` **+** `exigirDesbloqueo()`
  (`lib/server/cambios.ts:236-245`). El desbloqueo se pide en
  `POST /api/cambios/desbloquear` y es la **contraseña de cambios** del ADR 0028.

### 4.8 · Arrendadores, contratos y firma

- `/arrendadores` → `POST /api/arrendadores`, `/api/predios`, `/api/razones-sociales`,
  `/api/licencias`, `/api/contratos`.
- `POST /api/contratos`, `PATCH /api/contratos/[id]`, `.../renovar`, `.../cancelar` —
  **todos con `exigirCambioSensible('arrendadores', …)`**.
- Firma pública: `GET/POST /api/contratos/[id]/firma` genera la liga; el arrendador
  entra sin sesión a `/firmar/[token]` y firma con `GET/POST /api/firma/[token]`
  (exento de CSRF, `middleware.ts:90-91`).
- `POST /api/pagos-renta/[id]/pagar` — también re-autenticado.
- **Tablas:** `arrendadores`, `arrendador_razon_social`, `predios`,
  `contratos_arrendamiento`, `contrato_firmas`, `pagos_renta`, `licencias`, `incidencias`.

### 4.9 · Alta de una instancia — **los dos caminos**

**a) Administrado (nosotros ponemos el servidor)** — `infra/scripts/provision-instancia.sh`
(786 líneas). Se corre **desde la máquina del operador**; todo lo que toca el servidor
pasa por `remoto()`, que es también lo que respeta `--dry-run`. **Nada se ejecuta sin
`--confirmar`** (`provision-instancia.sh:17-19`). Puede además emitir certificado
(`--emitir-certificado`) y disparar el bootstrap (`--bootstrap`).

**b) Droplet propio del cliente (ADR 0032, 10-11/09)** — `infra/scripts/instalar-hijo.sh`
(957 líneas). Lo corre **el cliente, como root, dentro de su propia máquina**. La
dirección se invierte: no hay `ssh` desde fuera. Recibe `--instancia`, `--dominio`,
`--licencia <dir>`, `--contacto`. **Verifica la firma de la licencia antes de instalar**
(`instalar-hijo.sh:375`) y deja la pública en `/opt/space-os/space-os.pub`
(`instalar-hijo.sh:647`) y la licencia en `/etc/space-os/licencia/`
(`instalar-hijo.sh:679`).

Los dos comparten dos archivos que se **sourcean**, escritos una sola vez a propósito:

- **`base-instancia.sh`** (225 líneas) — los dos roles de Postgres, la base, el esquema
  y las migraciones. Existe porque el bloque estaba duplicado y **derivó en el mismo
  commit** (`base-instancia.sh:15-21`).
- **`entorno-instancia.sh`** (186 líneas) — cómo se escriben `app.env` e `instancia.env`
  y **qué valores se niega a escribir**. Es la zona **R7**, cerrada el 14/09.

**c) Alta desatendida desde el panel (ADR 0027 / 0029)** — el panel escribe una
solicitud; el **ejecutor** (`apps/flota/ejecutor.mjs`, usuario `altas`, sin puerto) la
lee y aprovisiona. Máquina de estados: `pendiente → en-curso → esperando-dns →
emitiendo-cert → lista`, con `fallida` y `cert-agotado` (`ejecutor.mjs:25-44`).
**No hay reintento automático**, y se marca `en-curso` **antes** de lanzar para no crear
un segundo droplet ya cobrándose (`ejecutor.mjs:11-19`).

### 4.10 · Actualización de una instancia

`infra/scripts/update.sh` (2341 líneas), instalado en `/opt/space-os/update.sh` y
lanzado por cron: **`17 4 * * * root`** (`instalar-hijo.sh:867`). El PADRE no aparece:
la instancia habla con el registro de imágenes y con su propia base
(`update.sh:5-8`). Hace `pg_dump -Fc` antes de migrar, aplica migraciones, comprueba
salud contra `SALUD_URL` (que es `/api/version`), y al terminar hace `POST` al receptor
de reportes del PADRE.

---

## 5 · Endpoints — **92 archivos, 115 métodos**

Todos son Route Handlers de Next bajo `/spaces-dooh/api/`. `apps/web/app/api/**/route.ts`.

### 5.1 · Los públicos (sin sesión), y por qué

| Ruta | Métodos | Por qué es pública |
|---|---|---|
| `/api/auth/login` | POST | Bootstrap de la sesión. Exento de CSRF (`middleware.ts:85`) |
| `/api/auth/logout` | POST | Ídem (`middleware.ts:89`) |
| `/api/auth/metodos` | GET | Dice qué métodos ofrece la instancia; solo lee entorno |
| `/api/auth/forgot` | POST | Pide el correo de recuperación (`middleware.ts:86`) |
| `/api/auth/reset` | GET, POST | Fija la contraseña con el token del correo (`middleware.ts:87`) |
| `/api/auth/codigo` | POST | Entrada con código de recuperación |
| `/api/auth/google/inicio` | GET | Arranca el OAuth |
| `/api/auth/google/callback` | GET | Vuelve de Google; crea sesión, y puede crear organización |
| `/api/signup` | POST | Autoregistro. **Solo si `AUTOREGISTRO=1`** (`middleware.ts:88`) |
| `/api/bootstrap` | POST | Arranque de instancia. Credencial `BOOTSTRAP_TOKEN`; **cerrojo real: `tenants` vacía** (`middleware.ts:97`) |
| `/api/portal/[token]` | GET | Portal de campaña del cliente. El token es la credencial (`middleware.ts:90`) |
| `/api/propuestas/publica/[id]` | GET, POST | Propuesta compartible (`middleware.ts:92`) |
| `/api/firma/[token]` | GET, POST | Firma del contrato: el arrendador no tiene sesión (`middleware.ts:91`) |
| `/api/logo/[token]` | GET | Logo de la organización para las vistas públicas |
| `/api/recordatorios` | POST | **Lo dispara el cron del droplet, no un usuario.** Credencial `RECORDATORIOS_TOKEN`; 401 sin ella (`app/api/recordatorios/route.ts:39-57`) |
| `/api/version` | GET | Sin token devuelve **solo `{ok}`**; con `x-flota-token` devuelve versión, última migración, canal y uptime (`app/api/version/route.ts`) |

> [!important] `/api/version` es el `SALUD_URL` de `update.sh`, y **toca la base** a propósito
> `app/api/version/route.ts:36-46`: el PADRE estuvo **cuatro días** sirviendo un login
> perfecto sin poder autenticar a nadie —faltaba `DATABASE_URL`— y las cinco
> comprobaciones salían verdes. Hoy `ok:true` significa «la base me contesta»; si no,
> **503**. Y lo que la ruta **no** dice es lo importante: ni una cifra del negocio del
> owner.

### 5.2 · Los de sesión, por área

Guard `exigir(modulo, accion)` (`lib/server/auth.ts:183`) salvo donde se indique.

| Área | Rutas | Guard |
|---|---|---|
| **Sesión / perfil** | `auth/me`, `perfil`, `perfil/codigos-recuperacion`, `tenant-activo` | `usuarioActual()` / `exigir()` sin permiso |
| **Inventario y sitios** | `sitios` (GET,POST), `sitios/[id]` (PATCH,DELETE), `sitios/import`, `sitios/[id]/media`, `sitios/[id]/space-eye`, `sitios/[id]/reubicar`, `sitios/[id]/pausa-legal` | `inventario`/`network`/`arrendadores`/`comercial` según la ruta |
| **Arrendadores y contratos** | `arrendadores`, `arrendadores/[id]`, `predios`, `predios/[id]`, `predios/[id]/pantallas`, `razones-sociales`, `razones-sociales/[id]`, `licencias`, `licencias/[id]`, `incidencias`, `contratos`, `contratos/[id]`, `contratos/[id]/renovar`, `contratos/[id]/cancelar`, `contratos/[id]/firma`, `contratos/[id]/documento`, `pagos-renta/[id]`, `pagos-renta/[id]/pagar`, `pagos-renta/[id]/adjunto/[tipo]` | `arrendadores/*`; **5 con `exigirCambioSensible`** |
| **Comercial** | `clientes`, `clientes/[id]`, `propuestas`, `propuestas/[id]`, `propuestas/items/[id]`, `propuestas/[id]/generar-campana`, `reservar`, `reservas/[id]/creativo`, `creatividades`, `creatividades/[id]`, `creativos/[id]/arte`, `ordenes-compra`, `campanas/[id]/{validar,confirmar,oc,contrato,extender,enviar-dominio,playlogs,creativos/repartir}` | `comercial/*` |
| **Operaciones** | `ot`, `ot/[id]`, `ot/[id]/cerrar`, `almacen`, `almacen/[id]/movimiento` | `operaciones/*` |
| **Imprenta** | `impresion`, `impresion/[id]`, `impresion/[id]/prueba-color` | `imprenta/*` |
| **Finanzas** | `campanas/[id]/facturar`, `cobranzas/[id]/pagar`, `cobranzas/[id]/recordar` | `finanzas/*`; **2 con `exigirCambioSensible`** |
| **Administración** | `usuarios`, `usuarios/[id]`, `usuarios/[id]/restablecer`, `permisos`, `admin/permisos-matriz`, `config`, `organizacion`, `tenants`, `integraciones`, `cambios`, `cambios/desbloquear` | `administracion/*` |
| **Transversal** | `estado` (GET) | `exigir()` **y filtra cada slice por permiso de módulo** (`app/api/estado/route.ts:37-45`) |
| **Notificaciones** | `notificaciones/nuevas`, `notificaciones/[id]/leer`, `notificaciones/archivar-todas` | `exigir()` sin permiso de módulo |

**8 endpoints llevan `exigirCambioSensible`** (re-autenticación por contraseña de
cambios, ADR 0028): `contratos`, `contratos/[id]`, `contratos/[id]/renovar`,
`contratos/[id]/cancelar`, `pagos-renta/[id]/pagar`, `campanas/[id]/facturar`,
`cobranzas/[id]/pagar` — todo lo que mueve dinero o compromisos irreversibles.

### 5.3 · CSRF

Double-submit: toda mutación (`POST|PUT|PATCH|DELETE`) sobre `/api/` **con cookie de
sesión** debe traer `x-csrf-token` igual a la cookie `spaces_csrf`, o se responde **403**
(`middleware.ts:82-108`). **Si no hay cookie de sesión, se deja pasar**: no hay credencial
ambiental que proteger. Exentas por ruta: `auth/login`, `auth/forgot`, `auth/reset`,
`auth/logout`, `signup`, `portal/*`, `firma/*`, `propuestas/publica/*`, `bootstrap`.

---

## 6 · Modelo de datos — **40 tablas**

`db/schema.sql` crea **28**; las migraciones añaden **12** más. El estado real de una
base es `schema.sql` + las 80 migraciones **en su orden**, nunca `schema.sql` solo.

### 6.1 · Las 28 de `db/schema.sql`

`acciones`, `arrendador_razon_social`, `arrendadores`, `campanas`, `clientes`,
`cobranzas`, `config_negocio`, `contratos_arrendamiento`, `creatividades`,
`evidencias_ot`, `facturas`, `folios_consecutivos`, `incidencias`, `notificaciones`,
`ordenes_compra`, `ordenes_impresion`, `ordenes_trabajo`, `pagos_renta`, `predios`,
`propuesta_items`, `propuestas`, `reservas`, `rol_permisos`, `sesiones`,
`sitio_modalidades`, `sitios`, `tenants`, `usuarios`.

### 6.2 · Las 12 que crean las migraciones

| Tabla | Migración | Propósito |
|---|---|---|
| `almacen_activos`, `almacen_movimientos` | `20260723_almacen.sql` | Almacén de activos y su kardex |
| `password_resets` | `20260723_password_resets.sql` | Tokens de recuperación |
| `licencias` | `20260729_licencias_permisos.sql` | Licencias/permisos del sitio (dominio de negocio — **no** la licencia del producto) |
| `contrato_firmas` | `20260729_firma_contrato.sql` | Firmas del arrendador |
| `identidades_externas` | `20260806_identidades_externas.sql` | Vínculo con Google |
| `schema_migrations` | `20260812_schema_migrations.sql` | Registro de migraciones aplicadas |
| `doohmain_consultas_play` | `20260716_doohmain_playlogs.sql` | Playlogs consultados a DOOHmain |
| `doohmain_remote_campaigns`, `doohmain_remote_lists`, `media_uploads` | `20260805_objetos_solo_en_prod.sql` | Objetos que existían solo en producción |
| `codigos_recuperacion` | `20260907_codigos_recuperacion.sql` | **Nueva el 07/09.** Códigos de un solo uso |

> [!warning] `licencias` (tabla) ≠ licencia del producto
> La tabla `licencias` es del módulo de arrendadores (permisos de anuncio de un sitio) y
> se gestiona con `POST /api/licencias`. La **licencia del producto** —la que decide si
> una instancia sigue sirviendo— **no vive en la base**: es un `licencia.json` firmado en
> `/etc/space-os/licencia/`. Ver §10.

### 6.3 · Multi-tenant: **32 tablas con `tenant_id`, 8 sin él**

`db/schema.sql:612-643` aplica en bucle a **23 tablas**: `usuarios`, `sitios`,
`clientes`, `propuestas`, `propuesta_items`, `ordenes_compra`, `campanas`,
`creatividades`, `reservas`, `ordenes_trabajo`, `evidencias_ot`, `ordenes_impresion`,
`facturas`, `cobranzas`, `arrendadores`, `contratos_arrendamiento`, `pagos_renta`,
`incidencias`, `notificaciones`, `acciones`, `sitio_modalidades`, `predios`,
`arrendador_razon_social` — `add column tenant_id`, `set not null`,
`enable row level security` y la política `tenant_isolation`.

`config_negocio` va aparte, con índice único por tenant y **`force row level security`**
(`db/schema.sql:662-674`, ADR 0011: una fila por organización).

Ocho más llegan con `tenant_id` por migración: `almacen_activos`, `almacen_movimientos`,
`codigos_recuperacion`, `contrato_firmas`, `doohmain_consultas_play`,
`identidades_externas`, `licencias`, `password_resets`.

**Las 8 exentas, y por qué:**

| Tabla | Motivo |
|---|---|
| `tenants` | Es el catálogo de organizaciones (`20260715_arr_m5_rls_failclosed.sql:11`) |
| `sesiones` | El login se resuelve **pre-sesión**: no hay tenant todavía |
| `rol_permisos` | Catálogo global de permisos. **Es la pregunta abierta P4** de la bóveda |
| `folios_consecutivos` | Infraestructura de numeración |
| `schema_migrations` | Infraestructura del runner |
| `doohmain_remote_campaigns`, `doohmain_remote_lists`, `media_uploads` | Objetos de integración creados por `20260805_objetos_solo_en_prod.sql` |

> [!danger] `db/schema.sql` crea la política **PERMISIVA**, y el fail-closed llega por migración
> La política del bucle lleva `or nullif(current_setting('app.tenant_id', true),'') is null`
> (`db/schema.sql:637-638`): **sin tenant fijado se ve todo**. El endurecimiento a
> fail-closed + `FORCE` lo aplican **8 migraciones**:
> `20260715_arr_m5_rls_failclosed.sql`, `20260720_hard1_usuarios_rls.sql`,
> `20260720_hard1_rls_todas_tablas.sql`, `20260723_almacen.sql`,
> `20260805_config_negocio_por_tenant.sql`, `20260806_identidades_externas.sql`,
> `20260807_password_resets_rls.sql`, `20260907_codigos_recuperacion.sql`.
> **Aplicar `schema.sql` solo deja una base insegura.**

### 6.4 · Migraciones — **80**, y la trampa del orden

- **76 de esquema + 4 con `-- @tipo: datos`**: `20260731_calendario_meses_cortos.sql`,
  `20260812_schema_migrations.sql`, `20260819_semilla_rol_permisos.sql`,
  `20260820_catalogo_permisos_completo.sql`. **El runner NO las aplica sin `--con-datos`**
  (`scripts/migrar.mjs:98-108`), y `update.sh` **no lo pasa a propósito**.
- El tipo se decide por la **primera línea** del archivo, no por el contenido
  (`scripts/migrar.mjs:107`): `20260812_schema_migrations.sql` menciona la cadena en su
  prosa y un filtro por contenido se saltaría justo la migración que crea la tabla de
  registro.
- **El orden NO es lexicográfico puro.** El mapa `ANTES_DE` vive **una sola vez** en
  `scripts/migrar.mjs:63-70` y lo importa también `apps/web/lib/test/db-e2e.ts`. Dos
  excepciones reales:
  - `20260720_hard1_usuarios_rls.sql` **antes de** `20260720_hard1_rls_todas_tablas.sql`
    (la segunda comprueba lo que hace la primera, y `r < u`).
  - `20260727_contrato_incompleto_enum.sql` **antes de** `20260727_contrato_incompleto.sql`
    (usa un valor del enum que añade la otra, y `'.' < '_'`).
  **Cualquier cosa que aplique migraciones tiene que reproducir ese orden o una base
  nueva no levanta.**
- **`--instalacion-nueva`** se verifica con **testigos derivados del repositorio**, no
  con una lista a mano: las tablas que crean las migraciones y no `schema.sql`
  (`scripts/migrar.mjs:165-177`). Hoy son **12** (era 11 antes de `codigos_recuperacion`).
- **13 migraciones** conceden GRANT a una lista blanca de **dos** nombres de rol
  (`spaces_user`, `spaces_app`). Con cualquier otro nombre **no conceden nada y no dan
  error** (`vault/04-Datos/migraciones.md:242`).

---

## 7 · Configuración y entorno — **nombres, nunca valores**

### 7.1 · Leídas por `apps/web` (`process.env`, medido hoy)

`ADMIN_EMAIL`, `ADMIN_NOMBRE`, `ADMOBILIZE_API_KEY`, `APP_URL`, `AUTOREGISTRO`,
`BOOTSTRAP_TOKEN`, `CANAL`, `CFDI_PAC_KEY`, `CMS_API_TOKEN`, `COOKIE_DOMAIN`,
`COOKIE_SECURE`, `DATABASE_URL`, `DATABASE_URL_TEST`, `DATABASE_URL_TEST_APP`,
`DOOHMAIN_DEFAULT_SCREEN`, `DOOHMAIN_PUBLISH_ENABLED`, `DOOHMAIN_PY`,
`DOOHMAIN_SCREEN_MAP`, `DOOHMAIN_SDK_DIR`, `DO_SPACES_BUCKET`, `DO_SPACES_CDN_URL`,
`DO_SPACES_ENDPOINT`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `EMAIL_FROM`, `FLOTA_TOKEN`,
`GOOGLE_AUTH_ENDPOINT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DOBLE_EMAIL`,
`GOOGLE_DOBLE_SUB`, `GOOGLE_OAUTH`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENDPOINT`,
`HSTS`, `LICENCIA_JSON`, `MEDIR_ESTADO`, `NEXT_PUBLIC_MAPTILER_KEY`,
`NEXT_PUBLIC_RECUPERAR_PASSWORD`, `NODE_ENV`, `ORG_NOMBRE`, `ORG_SLUG`,
`PUERTO_DOBLE_GOOGLE`, `PUERTO_E2E`, `RECORDATORIOS_TOKEN`, `RESEND_API_KEY`,
`SEED_PASSWORD`, `SMOKE_BASE`, `SPACE_EYE_BASE_URL`, `SPACE_EYE_PASS`, `SPACE_EYE_USER`,
`SPACE_OS_VERSION`, `TZ`.

(De ellas, `DATABASE_URL_TEST*`, `GOOGLE_DOBLE_*`, `PUERTO_*`, `MEDIR_ESTADO`,
`SMOKE_BASE`, `SEED_PASSWORD` son **solo de pruebas**.)

### 7.2 · `infra/env/app.env.example` — lo que lee **docker** (sin comillas)

`APP_URL`, `DATABASE_URL`, `HOSTNAME`, `COOKIE_SECURE`, `AUTOREGISTRO`,
`NEXT_PUBLIC_RECUPERAR_PASSWORD`, `EMAIL_FROM`, `RESEND_API_KEY`, `GOOGLE_OAUTH`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `BOOTSTRAP_TOKEN`,
`RECORDATORIOS_TOKEN`, `FLOTA_TOKEN`, `CANAL`, `TZ`, `DOOHMAIN_PUBLISH_ENABLED`,
`DOOHMAIN_API_KEY`, `DOOHMAIN_DEFAULT_SCREEN`, `DOOHMAIN_SCREEN_MAP`, `DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`.

### 7.3 · `infra/env/instancia.env.example` — lo que **sourcea bash** (exige comillas)

`CANAL`, `REGISTRY`, `IMAGEN_NOMBRE`, `CONTENEDOR`, `DATABASE_URL`, `ENV_APP`,
`DOCKER_OPCIONES_APP`, `RED_MIGRACION`, `SALUD_URL`, `SALUD_INTENTOS`, `SALUD_ESPERA`,
`PULL_ESPERAS`, `FLOTA_REPORTE_URL`, `FLOTA_PENDIENTES_MAX`, `RUNNER_MIGRACIONES`,
`PG_DUMP`, `PG_RESTORE`, `INSTANCIA`, `SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET`,
`LOGS_BUCKET`, `REGISTRY_TOKEN`.

Además `update.sh` lee `LICENCIA_REQUERIDA`, `LICENCIA_DIR`, `LICENCIA_PUB`,
`OPENSSL_BIN`, `DOMINIO`, `NGINX_SITIO_ACTIVO`, `NGINX_SITIO_NORMAL`,
`NGINX_SITIO_SIN_LICENCIA` (`update.sh:845-875`).

> [!danger] R7 — `instancia.env` se **sourcea** (`update.sh:700`)
> Un valor con espacios y sin comillas hace que bash **ejecute** la segunda palabra.
> Por eso `app.env` **no admite comillas** (lo lee docker literalmente) y `instancia.env`
> **las exige**. Los dos los escribe `entorno-instancia.sh`, que valida y entrecomilla.
> Antes del 14/09, `provision-instancia.sh` los escribía con `sed` crudo.

### 7.4 · `infra/env/ejecutor.env.example` — solo en el PADRE, usuario `altas`

`DIR_SOLICITUDES`, `DO_REGION`, `DO_TAMANO`, `DO_SSH_KEYS`, `DIGITALOCEAN_ACCESS_TOKEN`,
`REGISTRY`, `REGISTRY_TOKEN`, `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONAS`, `CERTBOT_EMAIL`.

### 7.5 · `apps/flota`

`FLOTA_PUERTO`, `FLOTA_INTERFAZ`, `FLOTA_DIR_ESTADO`, `FLOTA_DIR_PUBLICO`,
`FLOTA_VERSION_ESTABLE`, `PANEL_PUERTO`, `PANEL_INTERFAZ`, `ORIGEN_PANEL`, `URL_PADRE`,
`DIR_ESTADO`, `DIR_SOLICITUDES`, `CLOUDFLARE_TOKEN`, `CLOUDFLARE_ZONAS`, y los tokens
por instancia **`FLOTA_TOKEN_<NOMBRE>`**.

Los tokens se buscan en orden **entorno → `/etc/space-os/flota-tokens.env` (640,
`altas:flota`) → `FLOTA_TOKEN` compartido**. Solo se leen claves `FLOTA_TOKEN_*`: esa
lista blanca impide que un `DIGITALOCEAN_ACCESS_TOKEN` pegado ahí acabe leído por el
proceso que da la cara a internet (`apps/flota/README.md`).

### 7.6 · Integraciones externas

| Integración | Módulo | Cómo se enciende |
|---|---|---|
| **Resend** (correo) | `lib/server/email.ts:23-27` | `RESEND_API_KEY` + `EMAIL_FROM`; ausentes = apagado |
| **Google OAuth** | `lib/server/google-oauth.ts` (293 líneas) | `GOOGLE_OAUTH` + client id/secret/redirect |
| **DigitalOcean Spaces (S3)** | `lib/server/storage.ts:12-16` | `DO_SPACES_*`; `habilitado()` es false sin ellas |
| **DOOHmain** (publicación de spots) | `lib/server/doohmain.ts` (403 líneas) | `DOOHMAIN_PUBLISH_ENABLED=1`. Llama a un **SDK de Python por subproceso** (`DOOHMAIN_PY`, `DOOHMAIN_SDK_DIR`) |
| **Space Eye** | `lib/server/space-eye.ts:31-55` | `SPACE_EYE_BASE_URL/USER/PASS`; login por HTTP y bearer |
| **MapTiler** (basemap) | `NEXT_PUBLIC_MAPTILER_KEY` | ADR 0030: el basemap de la flota **no lleva clave** |
| **DigitalOcean API / Cloudflare** | `apps/flota/ejecutor.mjs`, `dns.mjs` | Solo en el PADRE, usuario `altas` |

> [!warning] `DO_SPACES_*` no está en `infra/env/app.env.example`
> `storage.ts` las lee, pero el ejemplo de `app.env` no las declara. Una instancia
> aprovisionada hoy tiene la subida de media **apagada** salvo que alguien las añada a
> mano. **No verificado si es deliberado** — va a §10.

---

## 8 · Despliegue, respaldos y operación

### 8.1 · El modelo: PADRE, DEMO, instancias

| Pieza | Qué es |
|---|---|
| **PADRE** | `137.184.107.53`, sirve `space-os.io`. Se trabaja aquí. Arranca con **systemd**, no pm2 (`infra/systemd/spaces-web.service`, puerto 3000). Corre además el panel, el receptor y el ejecutor de altas |
| **DEMO** | Dentro del PADRE, puerto **3001**. Desde el 02/09 corre **como contenedor desde la imagen del registro**, no `next start`. Sigue el canal `beta`. Su nombre es **`prueba.space-os.io`** |
| **Instancias de cliente** | Un droplet, una base y un dominio por owner. Siguen el canal `estable`. Se actualizan solas por cron a las **04:17** |
| `demo.space-os.io` | La demostración **original**, en la máquina vieja. **Se eliminará** (ADR 0024). No confundirla con `prueba.space-os.io` |

### 8.2 · Servicios systemd

| Unit | Qué corre |
|---|---|
| `spaces-web.service` | La aplicación del PADRE (3000) |
| `spaces-demo.service` | DEMO (3001) |
| `flota-panel.service` | `node panel.mjs` — el panel de flota (ADR 0026) |
| `flota-reporte.service` | `node reporte.mjs` — el receptor de reportes (F6.4) |
| `flota-altas.service` + `.timer` | `node altas.mjs` — el ejecutor de altas (ADR 0027) |

> [!danger] `systemctl disable` **borra** la unidad, no la apaga
> Medido el 02/09: las units son **symlinks al repositorio**, así que `disable` las
> elimina. La vuelta atrás escrita en varias tarjetas no funciona. Aplica igual a
> `spaces-web` y a `spaces-demo`.

### 8.3 · Workflows

| Workflow | Disparo | Qué hace |
|---|---|---|
| `ci.yml` (221 líneas) | `push` | `typecheck --filter=web`, `test --filter=web --filter=flota`, los arneses `pruebas-provision.sh` y `pruebas-instalar-hijo.sh` (**con `--mutantes`**), `build --filter=web`, y un job aparte que corre `npm run test:e2e` tras el build |
| `release.yml` (307 líneas) | tag `v*.*.*` | Suite completa → construye la imagen → publica en **`beta`**. **El gate es el orden**: el push es el último paso del último job, que cuelga de `needs: pruebas` (`release.yml:11-16`) |
| `promover.yml` | `workflow_dispatch` | Mueve **`estable`** a una versión que hoy lleva `beta`. **No reconstruye.** Tres puertas: la versión es la beta de hoy · DEMO responde (`DEMO_URL`) · **el digest no cambió después de reetiquetar** |
| `lockfile-check.yml` | PR | `package.json` y `package-lock.json` en sync |

El registro es **un parámetro, nunca un literal**: `vars.REGISTRY` y `vars.REGISTRY_TIPO`
(`release.yml:22-25`). Los workflows **paran en seco** cuando faltan, a propósito.

> [!danger] `imagetools create` NO reetiqueta — medido el 02/09
> Envuelve el manifiesto en un índice nuevo y **cambia el digest**, que es justo lo que
> el criterio de aceptación de F2.4 prohíbe. Se sustituyó por **`crane copy`**, que
> reescribe los mismos bytes (`promover.yml:302-313`).

### 8.4 · La imagen

`Dockerfile`, tres etapas (`deps` → `build` → `runtime`), Node 20 Alpine, salida
`standalone`. Puntos que importan:

- Contexto de build = **raíz del monorepo** (`outputFileTracingRoot` en `../../`).
- `npm ci` y nunca `npm install` (`Dockerfile:33-38`).
- **La versión se sella dentro**: `ARG VERSION` → `ENV SPACE_OS_VERSION`
  (`Dockerfile:78-79`), y es lo que devuelve `/api/version`.
- `db/schema.sql` y `db/migrations` **viajan en la imagen** (`Dockerfile:94-95`), por eso
  `migrar.mjs` resuelve rutas desde su propio archivo y no desde `cwd`.
- `CMD ["node", "apps/web/server.js"]`.

### 8.5 · Respaldos

`infra/scripts/respaldo.sh` (345 líneas) lo **sourcea** `update.sh`; no es un programa
aparte. `update.sh` hace `pg_dump -Fc` antes de migrar y lo deja en el disco local —lo
que sirve para la vuelta atrás— y `respaldo.sh` lo **sube a un bucket y poda el disco**,
porque un respaldo que vive solo en la máquina que puede morir no es un respaldo
(`respaldo.sh:16-22`). Subcomandos: `subir`, `podar`, `destino`.

Los logs también salen del droplet, **filtrados**:
`/var/log/space-os/update-publicable.log` es lo que viaja al bucket; el crudo se queda
en `/var/log/space-os/update.log`.

### 8.6 · Ramas y remotos

- **`emiliano`** (`emiliano-cyber/spaces_dooh_new`) es el remoto vivo. `origin`
  (`CarlosMend87/spaces-dooh`) está muerto.
- Todo vive en **`main`** desde el 28/08. Rama actual del árbol raíz hoy: `main`, limpio.
- **251 commits desde el 01/09.**

---

## 9 · El plano de control: `apps/flota` y las licencias

### 9.1 · Los 18 módulos

| Archivo | Líneas | Qué es |
|---|---|---|
| `estado.mjs` | 631 | El panel CLI: consulta `/api/version` de cada instancia, fusiona con los reportes y decide `al-dia`/`rezagada`/`sin-respuesta` |
| `servidor.mjs` | 512 | El servidor HTTP del panel web. Rutas `/flota/` y `/flota/altas/` |
| `altas.mjs` | 296 | El bucle del ejecutor de altas |
| `reporte.mjs` | 263 | **El receptor de reportes.** Escucha en `127.0.0.1:8787`; nginx termina TLS |
| `cola.mjs` | 254 | La cola de solicitudes de alta |
| `avanzar.mjs` | 199 | Avanza una solicitud un paso de la máquina de estados |
| `vigilante.mjs` | 173 | Vigilancia |
| `diagnostico.mjs` | 164 | Traduce fallos de red a frases. **`EAI_AGAIN` y `ENOTFOUND` caen en la misma** (`diagnostico.mjs:24-25`) |
| `dns.mjs` | 152 | Cloudflare |
| `solicitudes.mjs` | 146 | Validación de la solicitud de alta |
| `inscribir.mjs` | 136 | Inscribe una instancia nueva en el inventario |
| `firmar-licencia.mjs` | 129 | **Emite o renueva la licencia de un hijo.** Lo corre una persona |
| `ejecutor.mjs` | 121 | La máquina de estados del alta (ADR 0027/0029) |
| `acceso.mjs` | 106 | Control de acceso del panel web |
| `comprobaciones.mjs` | 105 | Comprobaciones previas |
| `licencia.mjs` | 98 | **Construir, firmar y verificar** una licencia Ed25519 |
| `vigilar.mjs` | 29 | Entrada del vigilante |
| `panel.mjs` | 17 | Entrada del panel web |

`flota.json` (el inventario real) **no está en git a propósito**: sería una lista de
clientes con sus dominios dentro del repositorio. En git solo hay
`flota.example.json`, con dominios `.invalid` (RFC 2606).

### 9.2 · Licencias

- **Algoritmo: Ed25519.** La restricción que lo eligió es que la otra punta es **bash**:
  `openssl pkeyutl -verify -rawin` sabe comprobarlo en el droplet sin instalar nada
  (`licencia.mjs:4-6`).
- **Se firman los bytes exactos del archivo**, no un objeto reserializado
  (`licencia.mjs:14-18`). Un reordenamiento de claves rompería la firma en silencio.
- **La privada nunca sale del PADRE.** `firmar-licencia.mjs` **no viaja en la imagen**
  porque el `Dockerfile` construye con `--filter=web` (`licencia.mjs:7-13`).
- **La pública está en el repositorio**: `infra/licencias/space-os.pub`, **113 bytes**,
  creada el 15/09. Viaja con cada instalador y acaba en `/opt/space-os/space-os.pub`
  (`instalar-hijo.sh:647`). Tiene su propio `.gitattributes` mínimo para que no le
  cambien los finales de línea al viajar (commit `56e2376`).
- **La frase de paso se pide por terminal y nunca por argumento**: un argumento acaba en
  el historial del shell y en `ps` (`firmar-licencia.mjs:14-15`).

**Cómo verifica una instancia** (`update.sh:890-925`):

1. Existen `licencia.json`, `licencia.firma` y la pública. Si no → inválida.
2. `openssl pkeyutl -verify -pubin -rawin`. Si no valida → inválida.
3. **Solo entonces** se lee el JSON — decidir con un JSON sin firmar sería confiar en un
   archivo que cualquiera puede escribir.
4. **Anclaje**: la licencia tiene que decir **esta instancia** y **este dominio**. Una
   licencia firmada pero sin `instancia` se rechaza explícitamente, porque dos cadenas
   vacías coincidirían y una licencia sin dueño quedaría válida (`update.sh:906-911`).

**Los cinco estados** (`update.sh:928-960` y `apps/web/lib/licencia.ts:16`, con el banco
compartido `infra/licencias/estados.casos.tsv`):

| Estado | Cuándo | Qué pasa |
|---|---|---|
| `sana` | antes de `vence - aviso_dias` | nada |
| `aviso` | entre el aviso y el vencimiento | banda en la interfaz; **no bloquea** |
| `gracia` | entre vencer y `vence + gracia_dias` | banda; **no bloquea** |
| `vencida` | pasada la gracia | nginx sirve el sitio **`-sin-licencia`** y el contenedor se apaga |
| `invalida` | firma mala, ausente o ilegible | igual que vencida |
| `no-comprobable` | falta `openssl` o es < 3.0 | **NO apaga.** El problema es nuestro, no del cliente (`update.sh:965-985`) |

El apagado se hace **cambiando un symlink de nginx**, no con un `if` dentro de un
`location` ni con `error_page 502` — eso confundiría «la licencia venció» con «la
aplicación se cayó», que son las dos cosas que el panel existe para no mezclar
(`update.sh:1005-1010`).

> [!tip] Una firma Ed25519 se puede **reproducir**
> No aleatoriza. Dos corridas con la misma llave dieron la firma byte a byte idéntica
> (`vault/07-Agentes/diario/2026-09-15.md`). El día que alguien discuta una licencia, se
> vuelve a firmar y se compara.

---

## 10 · Zonas de riesgo (`vault/06-Operacion/zonas-de-riesgo.md`)

**La regla de oro:** si el cambio toca **sesión, tenant, migración o dinero**, es ROJO
aunque parezca de una línea.

| | Zona | Modo de fallo |
|---|---|---|
| **R1** | Autenticación y sesión | Un cambio en `exigir()` o en el gate deja entrar a quien no debe, o encierra a todos. Ya pasó: el 08/09 `exigir()` cortaba con 403 por los códigos de recuperación y `AuthGate` pintaba el error **encima** de la pantalla que había que ver |
| **R2** | Aislamiento por RLS | **No da error.** Usar `qRaw` donde tocaba `q` devuelve cero filas en silencio, o datos de otra empresa. Ya pasó dos veces. **Ampliado el 11/09**: con qué privilegios nace la base es R2 también — un `DATABASE_URL` con el rol de migración (`bypassrls`) atraviesa la RLS entera y **la instancia sirve sin dar un error** |
| **R3** | Migraciones ya aplicadas en producción | Editar una cambia su `sha256` y toda base que la tenga registrada aborta con **salida 3**. Excepción registrada única: T-04 (17/08) |
| **R4** | Dinero irreversible | Facturar o pagar dos veces. Mitigado desde el 28/08: las 8 rutas de dinero y compromisos piden la **contraseña de cambios** |
| **R5** | Borrados en cascada | `on delete cascade` sobre `tenants` y sobre contratos |
| **R6** | nginx y el proceso | Un `nginx -t` que no se corre deja el sitio caído. **Incluye el resolutor del PADRE** — cerrado el 15/09 |
| **R7** | Escritura de `instancia.env` / `app.env` | **CERRADA el 14/09.** `update.sh` **sourcea** `instancia.env`: un valor sin comillas hace que bash ejecute la segunda palabra. Lo cierra `entorno-instancia.sh` |

**Amarillas vigentes:** A1 módulos de dinero sin unitaria · A2 los archivos gigantes
(`arrendadores-repo.ts` 1466 líneas, `campanas-repo.ts` 1265, `sitios-repo.ts` 660) ·
A3 contratos públicos de API · A4 tipos compartidos · A5 enums de Postgres ·
A7 integraciones con subproceso (DOOHmain). **A6 —el `AuthProvider` muerto— RETIRADO el
27/08**, verificado hoy: `lib/auth-context.tsx` ya no existe.

> [!danger] Las pruebas unitarias **no ven** los fallos de RLS
> Simulan la base. Los dos peores fallos de aislamiento del proyecto pasaron las
> unitarias sin despeinarse. Todo lo que toque tenant o sesión necesita
> `cd apps/web && npm run test:e2e`. **`q` vs `qRaw`:** hoy usan `qRaw` **18 archivos**,
> todos en caminos pre-sesión o por token (`auth.ts`, `tenant.ts`, `usuarios-repo.ts`,
> `portal-repo.ts`, `firmas-repo.ts`, `identidades-repo.ts`, `password-reset-repo.ts`,
> `codigos-recuperacion-repo.ts`, `config-repo.ts`, `cambios.ts`, `propuestas-repo.ts`,
> y 7 route handlers). Cualquier `qRaw` nuevo fuera de esa lista es sospechoso.

---

## 11 · Pruebas

| Suite | Archivos | Casos (grep estático) | Cómo se corre |
|---|---|---|---|
| Unitarias `apps/web` | **103** | **1092** | `cd apps/web && npm test` (vitest, sin Docker) |
| e2e `apps/web` | **34** | **345** | `cd apps/web && npm run test:e2e` (Postgres real en el 5433, en serie, Next real en el 3311) |
| `apps/flota` | **15** | **286** | `cd apps/flota && npx vitest run` |
| `scripts/migrar.test.ts` | 1 | **20** | con las unitarias |

**Arneses de shell** (`infra/scripts/`), que no son vitest:

| Arnés | Líneas | Escenarios | Mutantes |
|---|---|---|---|
| `pruebas-update.sh` | 3390 | **136** | **61** |
| `pruebas-provision.sh` | 1012 | **23** | **11** (+1 centinela) |
| `pruebas-instalar-hijo.sh` | 507 | **6** | **3** |
| `pruebas-vuelta-atras-real.sh` | 248 | — | — |

Los mutantes **se validan antes de correrse**: cambian una sola línea, conservan el
número de líneas y `bash -n` los acepta. El ciclo anterior tuvo un falso verde porque un
`sed` mal escrito dejó el archivo vacío y «pasó» (`pruebas-update.sh:3071-3076`).
`pruebas-provision.sh` corre además un **centinela** —un mutante que no cambia nada— que
tiene que salir vivo, o el arnés está roto.

> [!danger] Las e2e exigen un `npm run build` HECHO ANTES, o fallan todas en falso
> `apps/web/lib/test/servidor-e2e.ts` arranca con `npx next start`, que **reutiliza el
> build y no construye nada**. En un worktree recién clonado no hay `.next/BUILD_ID` y
> **todos** los archivos mueren con «el servidor no respondió tras 60 s». El rojo no dice
> nada del código: dice que falta el build.
>
> **De los arneses, `pruebas-update.sh` NO está en `ci.yml`** — solo `pruebas-provision.sh`
> y `pruebas-instalar-hijo.sh`. Sigue siendo una decisión abierta (§13).

---

## 12 · Estado actual y defectos conocidos — al 2026-09-15

Fuentes: `docs/Traspaso_20260915.md` y `vault/07-Agentes/diario/2026-09-15.md`.

### 12.1 · 🔴 El canal `estable` sirve una imagen anterior al arreglo del middleware

**Dos imágenes distintas llevan sellado el mismo número de versión.**

| | config digest | subida | dice ser |
|---|---|---|---|
| `estable` | `ecadfa57aa43` | **09/09 07:29 UTC** | v0.5.0 |
| `v0.5.0` / `beta` | `3991335cd3bb` | 10/09 17:40 UTC | v0.5.0 |

El arreglo del middleware entró en `main` el **10/09 00:06 UTC** (PR #78), **dieciséis
horas después** de la imagen que sirve `estable`. La etiqueta `v0.5.0` **se movió** al
reconstruir; el canal se quedó con la primera.

La imagen del 09/09 ya tiene nombre propio: **`v0.5.0-09sep`**, con su digest
`sha256:d46c3aed5861…`. Es el sitio al que volver si la promoción sale mal.

**Lo arregla el PASO 3 de la tarjeta 07**: `Actions → "Promover a estable" → version:
v0.5.0`. **No hay que volver a etiquetar `v0.5.0`** — moverlo es lo que causó todo esto.

### 12.2 · 🔴 `g500` lleva seis días mandando a `localhost:3000`

```
curl -sS -o /dev/null -D - https://g500.space-os.io/spaces-dooh/inicio/
location: https://localhost:3000/spaces-dooh/login/
```

Quien abre su dominio sin sesión no llega a ninguna parte; solo entra quien teclee la
URL del login a mano. El cron de g500 **funciona**: baja religiosamente cada noche la
imagen equivocada y reporta `v0.5.0`, que es verdad y no sirve de nada.

### 12.3 · 🟡 `flota.json` compara contra una versión congelada del 27/08

En el PADRE, `flota.json` declara `"canales": { "estable": "v0.1.0-padre", "beta":
"v0.1.0-padre" }`. Consecuencias medidas:

- `estado.mjs:132` marca `al-dia` **solo** si la versión es exactamente la del canal, así
  que **todas** las instancias salen `rezagada`. **Cuando todo está en ámbar, el ámbar no
  avisa de nada.**
- **El único verde del panel es el más falso:** `padre` sale `al-dia` porque una fila
  congelada del 27/08 coincide con una referencia congelada del 27/08. Si el PADRE
  llevara semanas mudo, saldría igual de verde.
- `inventario` y `vallas` son las **filas de ejemplo** con dominios `.invalid`. Su
  `ENOTFOUND` es correcto, no una avería.
- **DEMO no aparece** en el inventario.

**Se arregla después de la tarjeta 01**, para no perder la foto que es su evidencia.

### 12.4 · 🟡 `firmar-licencia.mjs` no puede leer la frase de paso sin TTY

`apps/flota/firmar-licencia.mjs:40` lee de **`process.stdin`**. Bajo `script -q -c` o en
la **consola web del droplet** eso llega a EOF, el `await` de nivel superior nunca se
resuelve y node sale con **código 13 sin imprimir una sola línea**. `openssl` sí funciona
en los dos sitios porque abre `/dev/tty`.

**Hoy, tal como está, no se podría firmar la licencia de un cliente desde la consola del
droplet.** Un solo cambio —leer de `/dev/tty` y, si no hay tty, decirlo en castellano—
arregla eso **y** el bloque A0 de la tarjeta de llaves, cuyo verde era vacío.

### 12.5 · 🟡 Un gate que mira lo que no falla

El gate A4 de la tarjeta de llaves comprueba **permisos** y no **tamaño**. Un
`openssl pkey -pubout` que falla deja el `.pub` en **cero bytes con los permisos
correctos**: el `ls -l` sale exactamente como la tarjeta lo describe. Pasó el 15/09. Se
añadió el `wc -c`, **pero el patrón merece buscarse en las demás tarjetas**.

### 12.6 · 🟡 `release.yml` no se niega a construir una versión que ya existe

Es el defecto de raíz de todo lo de §12.1. Sigue abierto.

### 12.7 · ✅ Lo cerrado el 15/09

- **El resolutor del PADRE** (R6): `grep -c degraded` = **0** en un día entero, contra
  ~10 diarias el 12, 13 y 14, **sin reinicio de por medio** (`uptime -s` = 2026-08-21).
  Y quedó demostrado que mandan los archivos y no la memoria: `systemctl restart
  systemd-resolved` descarta lo que puso `resolvectl dns`, y los tres ámbitos siguen con
  los tres servidores.
- **Las llaves de licencia**: par Ed25519 en el PADRE, pública de 113 bytes en
  `infra/licencias/space-os.pub`, firma en verde y `Signature Verified Successfully`.

### 12.8 · Decisiones abiertas (no las decide un agente)

1. **Dónde vive la frase de paso** de la llave privada. Hoy solo la conoce quien la
   tecleó: si a esa persona le pasa algo, nadie puede firmar una renovación aunque la
   privada esté intacta.
2. **Qué hacer con la fila del `padre`** en el panel. No corre la imagen, así que
   compararlo contra un canal no significa nada, y es lo que produce el verde falso.
3. **`pruebas-update.sh` en CI** y el **`.gitattributes` del repositorio entero**. El
   15/09 se añadió uno **mínimo**, solo para la llave pública.

---

## 13 · Notas de la bóveda y de `CLAUDE.md` que ya NO coinciden con el código (DESFASADO)

> Esta es la sección más valiosa del inventario. Para cada punto: **qué dice el
> documento**, **qué mide el código hoy**, y **la diferencia**.

| # | Documento | Dice | Medido hoy (15/09) | Diferencia |
|---|---|---|---|---|
| **D1** | `vault/00-Indice/MOC-Proyecto.md:32` (actualizado 28/08) | **90** endpoints | **92** archivos `route.ts` | **+2** |
| **D2** | `vault/00-Indice/MOC-Proyecto.md:33` | **42** tablas | **40** | **−2** |
| **D3** | `vault/00-Indice/MOC-Proyecto.md:34` | **76** migraciones | **80** | **+4** |
| **D4** | `vault/00-Indice/MOC-Proyecto.md:35` | **24** ADR (`0001`–`0024`) | **32** (`0001`–`0032`) | **+8** |
| **D5** | `vault/02-Backend/api-endpoints.md:13` (28/08) | «los **90** endpoints» | **92** | **+2**. Y la tabla de esa nota **no incluye** `bootstrap` ni las rutas nuevas de códigos de recuperación |
| **D6** | `vault/04-Datos/esquema.md:14` (27/08) | **39** tablas, **74** migraciones, «`schema.sql` crea 28 y las migraciones las **11** restantes» | **40** tablas, **80** migraciones, **12** creadas por migración | La 12.ª es **`codigos_recuperacion`** (`20260907_codigos_recuperacion.sql`), posterior a esa nota |
| **D7** | `vault/04-Datos/migraciones.md:738` (10/09) | «Van **76** migraciones, y hay **42** tablas» | **80** y **40** | Además **se contradice con `esquema.md`**, que dice 39 tablas. Dos notas de la misma carpeta con dos cifras |
| **D8** | `vault/04-Datos/migraciones.md:305` | «la diferencia son **11 tablas**» (los testigos de `--instalacion-nueva`) | **12** | El propio `migrar.mjs:165-177` los **deriva**, así que el código ya está bien; es la prosa la que quedó vieja |
| **D9** | `CLAUDE.md` §2 | «**57** notas», «**753** enlaces sobre 57» | **69** notas | **+12**. Las 12 nuevas son diarios y notas de auditoría |
| **D10** | `CLAUDE.md` §1 y §2 | «los ADR van por la **0032**» en §1, pero la tabla de identidad copiada del MOC dice **24** | **32** | §1 está bien; la tabla no |
| **D11** | `CLAUDE.md` §4 | «**1005** unitarias en 94 archivos», «e2e de 12 a **29** archivos» | **1092** en **103**, y **34** archivos e2e | El propio `CLAUDE.md` avisa de que no se copien; esta línea documenta cuánto ha derivado |
| **D12** | `CLAUDE.md` §7 | «Quedan **DOS**: `F5.6` y `F5.7`» | **No verificable desde el repo.** El plan v3 y el tablero describen un estado del 02–03/09; el trabajo del 09–15/09 (alta en droplet propio, licencias, panel) **no está reflejado en el conteo de tareas** | El plan v3 (13/08) describe una arquitectura anterior al ADR 0032 (10/09) |
| **D13** | `vault/00-Indice/preguntas-abiertas.md` (31/08) · **P8** | «El `AuthProvider` muerto: ¿cuándo se retira?» | **`apps/web/lib/auth-context.tsx` NO EXISTE**, ni `app/_legacy/` | **Ya resuelta.** `zonas-de-riesgo.md:421` lo marca retirado el 27/08, pero `preguntas-abiertas.md` sigue listándola |
| **D14** | `preguntas-abiertas.md` · **P16** | «`vault/.obsidian/` no está en `.gitignore`» | **Sí lo está**: `.gitignore:11` | **Ya resuelta** |
| **D15** | `preguntas-abiertas.md` · **P18** | «`README.md` describe una arquitectura que ya no existe» | **Sigue siendo cierto**, verificado hoy (`README.md:5-28`) | Vigente, no desfasada |
| **D16** | `infra/systemd/spaces-demo.service` | `ExecStart=… next start -p 3001` **desde el repo clonado** | Desde el 02/09 (F3.5) **DEMO corre como contenedor desde la imagen del registro** | El archivo del repo describe el estado **anterior** a F3.5. El servidor no lo usa así |
| **D17** | `.github/workflows/promover.yml:125` | El mensaje de ayuda sugiere `DEMO_URL` = `https://demo.space-os.io/spaces-dooh` | La dirección buena es **`prueba.space-os.io`**; `demo.space-os.io` es la demo **original**, en la máquina vieja, que corre código del 11/08 | Copiar ese ejemplo **validaría la máquina equivocada** antes de promover |
| **D18** | Tarjeta 07, PASO 2 | Manda comprobar contra `demo.space-os.io` | `prueba.space-os.io` | Misma errata que D17, señalada en `Traspaso_20260915.md` |
| **D19** | `vault/01-Arquitectura/entorno-y-despliegue.md:203` (02/09) | «las **67** de `db/migrations/`» | **80** | **+13** |
| **D20** | `vault/02-Backend/api-endpoints.md:18-23` | Aviso correcto sobre no cablear el host | — | **No desfasada**, se anota porque sigue siendo la trampa más común al leer esa nota |

**Patrón que se repite, y que conviene nombrar:** el MOC y `CLAUDE.md` —los dos
documentos que un agente lee **primero**— son los que arrastran más cifras falsas,
porque nadie los revisa al cerrar una tarea concreta. `CLAUDE.md` §2 ya lo dice de sí
mismo («este archivo ya los tuvo mal»), y hoy vuelve a tenerlos mal: **seis cifras** en
la tabla del MOC y **tres** en `CLAUDE.md`.

---

## 14 · Lo que NO pude verificar

Esta sección es tan parte del inventario como el resto. Es el límite del reconocimiento.

### 14.1 · Por la restricción de solo lectura

1. **El recuento real de pruebas.** No se corrió `npm test` ni `npm run test:e2e`. Las
   cifras de §11 son **grep estático de `it(`/`test(`**: un `it.each` cuenta uno aquí y
   varios en el runner. **El número real es igual o mayor.** Para medirlo:
   `cd apps/web && npm run build && npm test && npm run test:e2e`.
2. **Que la suite esté en verde.** No se sabe. El último dato es del 31/08 (1009
   unitarias y 295 e2e en verde, al publicar `v0.0.1-rc2`).
3. **Nada de los arneses de shell se ejecutó.** Los 136/23/6 escenarios y los 61/11/3
   mutantes están **contados en el código**, no corridos.

### 14.2 · Por no tocar servidores ni bases

4. **Cuántas tablas tiene de verdad `spaces_prod`, la base de g500 o la de DEMO.** Las
   40 de §6 son las de una base levantada **desde el repositorio**. La propia
   `esquema.md` tiene esto abierto desde el 19/08 con dos cifras en conflicto (38 y 39).
   Se mide así, y lo tiene que correr una persona:
   ```
   sudo -u postgres psql -d <base> -Atc "select count(*) from information_schema.tables where table_schema='public'"
   sudo -u postgres psql -d <base> -Atc "select count(*) from schema_migrations"
   ```
5. **Cuántas migraciones tiene aplicadas cada instancia.** El 02/09 se midió `75` en
   DEMO (no 76: las 4 de `@tipo: datos` no entran sin `--con-datos`). Hoy serían **76**
   si se aplicaron las nuevas, pero **no está medido**.
6. **El contenido real de `flota.json` en el PADRE.** No está en git (a propósito). Lo de
   §12.3 viene de la lectura del 15/09 recogida en el diario, no de una medición propia.
7. **Qué versión corre cada instancia hoy.** El diario del 15/09 dice `g500` y `ensayo4`
   en `v0.5.0` (la del 09/09), DEMO en `v0.5.0`/`beta` (la del 10/09). **No reverificado.**
8. **Si `estable` sigue apuntando a la imagen del 09/09.** Depende de si alguien corrió
   ya el PASO 3. Se comprueba con:
   `curl -sS -o /dev/null -D - https://g500.space-os.io/spaces-dooh/inicio/` → si la
   `location` es **relativa**, ya se promovió.
9. **Los permisos reales de `/etc/space-os/flota-tokens.env`.** Tiene que ser **640
   `altas:flota`**. Si quedó `644`, cualquier cuenta de la máquina se lleva los tokens
   de toda la flota. No comprobado.
10. **Si el `.pub` que viajó a alguna instancia es el bueno.** El del repo mide 113 bytes
    (correcto). Lo que hay en `/opt/space-os/space-os.pub` de cada droplet, no se sabe.

### 14.3 · Preguntas de código que quedaron sin respuesta

11. **`DO_SPACES_*` no aparece en `infra/env/app.env.example`** pero `lib/server/storage.ts`
    las lee. ¿Es deliberado (la subida de media apagada por omisión en una instancia
    nueva) o es un hueco del aprovisionamiento? **No hay nada en el código ni en la
    bóveda que lo diga.**
12. **`ADMOBILIZE_API_KEY`, `CFDI_PAC_KEY`, `CMS_API_TOKEN`** aparecen en `process.env`
    pero no en ningún `.env.example` ni en `integraciones-externas.md`. Podrían ser
    restos de una integración planeada. **No verificado quién las lee de verdad** — y la
    trampa documentada de este repo es que importar ≠ estar montado: hay que mirar a los
    **importadores**, no solo al archivo.
13. **`/configuracion` no aparece en `nav.ts`.** La página existe
    (`app/(app)/(shell)/configuracion/page.tsx`) pero no está en la lista de módulos del
    menú. No se determinó por dónde se llega ni quién puede entrar.
14. **`vigilante.mjs` / `vigilar.mjs` no tienen unidad systemd** en `infra/systemd/`.
    ¿Se lanzan a mano, por cron, o todavía no se desplegaron? No está escrito.
15. **Cuántas tareas del plan v3 quedan realmente.** `CLAUDE.md` dice dos (`F5.6`, `F5.7`),
    pero el plan es del 13/08 y el ADR 0032 (10/09) cambió el modelo de alta. **Nadie ha
    reconciliado el plan con lo construido en septiembre**, y esa reconciliación es
    trabajo de una persona, no de un recuento.
16. **Si `pruebas-update.sh` —el arnés más grande, 3390 líneas y 136 escenarios— llegó a
    correrse alguna vez completo.** No está en `ci.yml` y no hay evidencia de su última
    corrida en `docs/evidencias/`.

---

## Relacionadas

[[00-Indice/MOC-Proyecto]] · [[00-Inventario/inventario-2026-08-11]] ·
[[01-Arquitectura/modelo-instancias-soberanas]] · [[01-Arquitectura/entorno-y-despliegue]] ·
[[02-Backend/api-endpoints]] · [[02-Backend/multi-tenancy-y-rls]] · [[04-Datos/esquema]] ·
[[04-Datos/migraciones]] · [[06-Operacion/zonas-de-riesgo]] · [[06-Operacion/convenciones]] ·
[[07-Agentes/diario/2026-09-15]]
