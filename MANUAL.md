# Manual del Sistema — Spaces DOOH

Manual técnico y operativo de la plataforma. Explica cómo está construido el
sistema, cómo funciona la base de datos y cómo hacer las tareas comunes.

---

## 1. ¿Qué es Spaces DOOH?

Plataforma para gestionar publicidad exterior (**DOOH / OOH** — espectaculares,
pantallas digitales, vallas, etc.). Cubre cuatro grandes áreas de negocio:

- **Inmuebles** — el inventario de sitios físicos, contratos de arrendamiento,
  licencias y permisos, incidencias.
- **Comercial** — clientes, campañas, cotización, inventario disponible.
- **Operaciones** — órdenes de trabajo (OT) de montaje/mantenimiento, evidencias
  fotográficas del personal de campo.
- **Digital / Tráfico** — publicación de creatividades en pantallas vía
  conectores con CMS externos.

Es un sistema **multi-tenant**: una sola instalación puede dar servicio a varias
empresas (tenants), cada una con sus datos aislados.

---

## 2. Arquitectura general

Monorepo administrado con **npm workspaces** + **Turbo**.

```
spaces-dooh/
├── apps/
│   ├── api/      → Backend  (Fastify 5 + TypeScript)   — puerto 3001
│   └── web/      → Frontend (Next.js 14 + React 18)    — puerto 3000
├── packages/
│   ├── types/    → Tipos TypeScript compartidos (@spaces-dooh/types)
│   └── utils/    → Utilidades compartidas (@spaces-dooh/utils)
├── infra/        → Configs de servidor (nginx, apache, scripts de deploy)
└── .github/      → CI/CD (GitHub Actions)
```

**Stack principal:**

| Capa | Tecnología |
|---|---|
| Backend | Fastify 5, TypeScript |
| Frontend | Next.js 14, React 18, TanStack Query, Zustand, react-hook-form |
| Base de datos | PostgreSQL (vía Prisma 7 + `@prisma/adapter-pg`) |
| Colas / jobs | Redis + BullMQ |
| Almacenamiento de archivos | DigitalOcean Spaces (compatible S3) |
| Email | Resend |
| Autenticación | JWT (`jose`) + bcrypt (`bcryptjs`) |
| Validación | Zod |

---

## 3. Infraestructura de producción

Todo corre en **un solo droplet de DigitalOcean**:

| Dato | Valor |
|---|---|
| IP del servidor | `159.203.188.58` |
| Hostname | `ubuntu-s-2vcpu-2gb-90gb-intel-nyc1-01` (Ubuntu 24.04) |
| Ruta del código | `/var/www/Marketplace/spaces-dooh` |
| URL pública | `https://market.adavailable.com/spaces-dooh/` |

> ⚠️ **Nota:** los scripts del repo (`infra/scripts/`, `deploy.yml`) mencionan
> `/var/www/spaces-dooh`, pero la ruta real en el servidor es
> `/var/www/Marketplace/spaces-dooh`.

**Procesos (gestionados con PM2 — ver `ecosystem.config.js`):**

| Proceso | Qué es | Puerto |
|---|---|---|
| `spaces-api` | Backend Fastify | 3001 |
| `spaces-web` | Frontend Next.js | 3000 |

**Servicios locales en el mismo droplet:**

- **PostgreSQL** — en `localhost:5432`, base de datos `spaces_prod`.
- **Redis** — en `localhost:6379` (colas y caché).

Un **reverse proxy** (nginx/apache) recibe el tráfico de
`market.adavailable.com`, sirve el frontend bajo la ruta `/spaces-dooh` y
manda `/spaces-dooh/api/*` al backend.

```
Internet
   │
   ▼
market.adavailable.com   (reverse proxy)
   ├── /spaces-dooh/         → spaces-web  :3000  (Next.js, basePath /spaces-dooh)
   └── /spaces-dooh/api/     → spaces-api  :3001  (Fastify)
                                   │
                                   ├── PostgreSQL :5432  (spaces_prod)
                                   └── Redis      :6379
```

---

## 4. La base de datos

### 4.1 Dónde está

PostgreSQL corre **dentro del mismo droplet** (no es un servicio externo ni un
cluster gestionado). La conexión está definida en `apps/api/.env` del servidor:

```
DATABASE_URL=postgresql://spaces_user:****@localhost:5432/spaces_prod?schema=public
```

Las credenciales reales viven solo en ese `.env` del droplet — no están en el
repositorio ni en los secrets de CI.

### 4.2 Diseño multi-tenant por schemas

La base usa **schemas de PostgreSQL** para aislar a cada tenant. El esquema
Prisma (`apps/api/prisma/schema.prisma`) declara dos schemas:

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["public", "tenant_template"]
}
```

| Schema | Para qué sirve |
|---|---|
| `public` | Tablas **globales**: tenants, usuarios, roles, tokens. |
| `tenant_template` | El **molde** de las tablas de negocio. |
| `tenant_<slug>` | Una copia del molde **por cada tenant** (ej. `tenant_h3dm`). |

Cuando se da de alta un tenant, se crea un schema nuevo (`tenant_h3dm`, etc.)
con todas las tablas de negocio. El campo `Tenant.dbSchema` apunta a ese schema.

### 4.3 Tablas del schema `public` (globales)

| Tabla | Contenido | Campos clave |
|---|---|---|
| `Tenant` | Las empresas/clientes del sistema | `subdominioBase` (slug único), `dbSchema`, `plan`, `activo` |
| `User` | Usuarios que entran al sistema | `tenantId`, `email`, `passwordHash`, `rolId`, `activo`. Único: `(tenantId, email)` |
| `Role` | Roles y sus permisos, por tenant | `tenantId`, `nombre`, `permisos[]`, `esBuiltin`. Único: `(tenantId, nombre)` |
| `RefreshToken` | Tokens de sesión de larga duración | `userId`, `tokenHash`, `expiresAt`, `revokedAt` |

### 4.4 Tablas del schema de tenant (negocio)

Cada `tenant_<slug>` contiene estas tablas, agrupadas por módulo:

**Inmuebles**
- `Sitio` — el inventario físico (espectacular, pantalla, valla…). Incluye
  ubicación (lat/lng), medidas y tres estatus: comercial, legal y operativo.
- `Arrendador` — dueños de los espacios.
- `ContratoArrendamiento` — contrato sitio↔arrendador, renta, vigencia.
- `PagoRenta` — pagos de cada contrato.
- `LicenciaPermiso` — permisos legales de cada sitio.
- `Incidencia` — problemas reportados en sitios (clima, vandalismo, legal…).

**Comercial**
- `Cliente` — anunciantes/agencias.
- `Campana` — campaña publicitaria de un cliente, con presupuesto y estado
  comercial. Puede exponer un `portalToken` público.
- `CampaignLine` — cada línea/renglón de la campaña (qué sitio, fechas, precio,
  tipo de venta).
- `Creatividad` — los archivos creativos (lonas, videos) de la campaña.

**Operaciones**
- `OrdenTrabajo` (OT) — trabajo de montaje/mantenimiento asignado a personal de
  campo. Incluye checklist, materiales, tiempos y estado.
- `EvidenciaOT` — fotos que sube el personal de campo como comprobante.

**Digital / Tráfico**
- `Pantalla` — pantallas digitales de un sitio (con su ID en el CMS externo).
- `TrafficOrder` — orden de publicación enviada a un conector/CMS.
- `ConnectorConfig` — credenciales y config de cada integración.

**Portal de cliente** (acceso externo de anunciantes)
- `PortalCliente` — login propio de clientes externos (tabla aparte de `User`).
- `PortalClienteSitio` — qué sitios puede ver cada cliente.
- `ComentarioPublico` — comentarios en OTs desde el portal.

**Auditoría**
- `AuditLog` — registro de acciones (quién hizo qué, sobre qué entidad).

### 4.5 Cómo el código habla con la base

`apps/api/src/db/client.ts` expone dos formas de acceso:

- **`publicPrisma`** — cliente Prisma fijo al schema `public`. Se usa para
  tenants, usuarios, roles y tokens.
- **`getPrismaForTenant(dbSchema)`** — devuelve un cliente Prisma apuntando al
  schema de un tenant específico. Se cachea uno por schema.

En cada request, el *tenant plugin* (ver §6) ya deja listo `request.prisma`
apuntando al schema correcto del tenant.

---

## 5. Autenticación y roles

### 5.1 Login y tokens

Flujo en `apps/api/src/core/auth/auth.service.ts`:

1. Se busca el `User` por `(tenantId, email)`.
2. Se valida la contraseña con **bcrypt** contra `passwordHash`.
3. Se resuelve el rol (ver abajo).
4. Se firma un **access token JWT** que dura **15 minutos** (contiene
   `tenantId`, `rol`, `permisos`, `nombre`, `email`).
5. Se genera un **refresh token** aleatorio que dura **7 días**; en la base solo
   se guarda su hash SHA-256. Al refrescar, el token viejo se revoca y se emite
   uno nuevo (**rotación**).

### 5.2 Roles

Los roles viven en la tabla `Role`, **uno por tenant**. El `User.rolId` se
resuelve buscando primero por `Role.nombre` y, si no, por `Role.id`
(`resolveRole()` en `auth.service.ts`).

> ⚠️ Si un usuario tiene un `rolId` que **no existe** como `Role` en su tenant,
> puede entrar pero se queda **sin permisos**.

**Roles en producción (tenant H3DM Media):**

```
owner, admin, inmuebles_manager, comercial_manager, seller,
trafficker, crew_chief, field_worker, auditor, operaciones_manager
```

El guard `rbac.guard.ts` da paso libre a `owner` y `admin`; el resto se valida
por la lista de `permisos` del rol.

### 5.3 Portal de cliente (acceso externo)

Es un login **separado**, en la tabla `PortalCliente` del schema del tenant — no
usa `User` ni `Role`. Sirve para que anunciantes externos vean el avance de sus
campañas. URL: `/spaces-dooh/portal/cliente/login/`.

---

## 6. Multi-tenant: cómo se resuelve el tenant en cada request

El *tenant plugin* (`apps/api/src/core/tenant/tenant.plugin.ts`) corre en cada
request (hook `onRequest`) y decide a qué tenant pertenece:

1. Se **excluyen** las rutas `/health` y `/portal/:token` (el portal resuelve el
   tenant desde el token de la campaña).
2. Para todo lo demás, busca el **slug** del tenant en este orden:
   - header `x-tenant-slug` (lo manda el frontend), o
   - extracción del hostname (ej. `westmedia.spaces.com` → `westmedia`), o
   - la variable de entorno `TENANT_SLUG`.
3. Busca el `Tenant` con `subdominioBase = slug`. Si no existe o está inactivo →
   `404 Tenant not found`.
4. Deja listos en el request: `request.tenant` y `request.prisma` (el cliente
   Prisma del schema de ese tenant).

---

## 7. Módulos de la aplicación

### Backend (`apps/api/src/`)

| Carpeta | Responsabilidad |
|---|---|
| `core/auth` | Login, logout, refresh, guard de permisos (RBAC) |
| `core/tenant` | Resolución de tenant por request |
| `core/audit` | Registro de auditoría |
| `core/email` | Envío de correos (Resend) |
| `core/upload` | Validación de archivos subidos |
| `core/events` | Bus de eventos interno (ej. `ot.completada`) |
| `db/` | Clientes Prisma y almacenamiento (Spaces/S3) |
| `modules/inmuebles` | Sitios, contratos, licencias, incidencias, alertas |
| `modules/operaciones` | Órdenes de trabajo y evidencias |
| `modules/comercial` | Campañas, clientes, inventario, readiness, portal |
| `modules/digital` | Tráfico / publicación digital |
| `modules/admin` | Gestión de usuarios, roles, tenant, config |
| `modules/portal-cliente` | Portal externo de clientes |
| `modules/dev` | Rutas de desarrollo |
| `connectors/` | Integraciones con CMS: `broadsign`, `doohmain`, `invian`, `manual` |
| `jobs/` | Tareas programadas con BullMQ (alertas de vencimiento, readiness) |

**Endpoints de salud:**
- `GET /health` — estado de base de datos, Redis y storage.
- `GET /health/ready` — listo o no listo (para readiness probes).

### Frontend (`apps/web/app/`)

Next.js con `basePath: '/spaces-dooh'`. Pantallas principales:

| Ruta | Pantalla |
|---|---|
| `/auth/login` | Login interno (usuarios `User`) |
| `/admin/*` | Usuarios, roles, config, audit log, portal-clientes |
| `/comercial/*` | Campañas, clientes, inventario, digital |
| `/inmuebles/*` | Sitios, arrendadores, contratos, alertas |
| `/operaciones/*` | Órdenes de trabajo, calendario, mis-sitios |
| `/portal/[token]` | Portal público de una campaña (sin login) |
| `/portal/cliente/*` | Portal de clientes externos (login propio) |

El frontend habla con el backend usando `NEXT_PUBLIC_API_URL` (ver
`apps/web/lib/api-client.ts`).

---

## 8. Despliegue (deploy)

### Automático (lo normal)

Definido en `.github/workflows/deploy.yml`. Se dispara con un **push a `main`**:

1. GitHub Actions hace checkout, instala dependencias, verifica tipos y compila.
2. Entra por SSH al droplet y ahí:
   - `git pull origin main`
   - `npm ci`
   - `turbo build`
   - `npx prisma migrate deploy` (aplica migraciones pendientes)
   - `pm2 reload ecosystem.config.js` (reinicia los procesos)

Los secrets de CI son solo `DROPLET_IP` y `SSH_PRIVATE_KEY`. La `DATABASE_URL`
**no** está en CI — vive en el `.env` del droplet.

### Manual

Existe `infra/scripts/deploy.sh` para hotfixes (hace lo mismo vía SSH).

### Migraciones de base de datos

Las migraciones están en `apps/api/prisma/migrations/`. Se aplican solas en cada
deploy con `prisma migrate deploy`. Historial actual:

```
20260408164348_init                  20260507000000_tipo_string_fix
20260408192200_inmuebles_init         20260512000000_portal_cliente
20260408211655_operaciones_init       20260512100000_labores_tracking
20260408220000_comercial_init         20260512200000_sesiones_laboral
20260423000000_campana_reporte_url
20260506000000_campo_reportes
```

---

## 9. Operaciones comunes

Todas estas se ejecutan **dentro del droplet** (`ssh root@159.203.188.58`).

### Conectarse a la base de datos

```bash
sudo -u postgres psql spaces_prod
```

Consultas útiles (dentro de `psql`):

```sql
-- Ver tenants
SELECT nombre, "subdominioBase", "dbSchema" FROM "Tenant";

-- Ver usuarios y sus roles
SELECT email, "rolId", activo FROM "User" ORDER BY email;

-- Ver roles disponibles
SELECT nombre FROM "Role";

-- Salir
\q
```

### Crear o actualizar usuarios

El script oficial es `apps/api/prisma/seeds/seed-add-users.ts`. Edita el arreglo
`USERS_TO_CREATE` y córrelo desde `apps/api`:

```bash
cd /var/www/Marketplace/spaces-dooh/apps/api
npx ts-node prisma/seeds/seed-add-users.ts --slug=market
```

- `--slug=` indica a qué tenant agregar los usuarios (por `subdominioBase`).
- El script hace **upsert**: si el usuario existe lo actualiza, si no lo crea.
- Las contraseñas se hashean con bcrypt automáticamente.

### Ver logs y estado de los procesos

```bash
pm2 list                 # estado de spaces-api y spaces-web
pm2 logs spaces-api      # logs del backend en vivo
pm2 logs spaces-web      # logs del frontend en vivo
```

### Reiniciar la aplicación

```bash
cd /var/www/Marketplace/spaces-dooh
pm2 reload ecosystem.config.js --update-env
```

### Verificar que el sistema está sano

```bash
curl https://market.adavailable.com/spaces-dooh/api/health
```

Debe responder `"status":"ok"` con los chequeos de base de datos, Redis y
storage.

### Otros seeds disponibles

| Script | Para qué |
|---|---|
| `prisma/seeds/seed-tenant.ts` | Crear un tenant nuevo |
| `prisma/seeds/seed-demo.ts` | Cargar datos de demostración |
| `prisma/seeds/seed-add-users.ts` | Agregar usuarios a un tenant existente |

---

## 10. Variables de entorno

Viven en `apps/api/.env` (backend) en el droplet. Plantilla de referencia:
`.env.production.example`.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `REDIS_URL` | Conexión a Redis |
| `JWT_SECRET` | Llave para firmar los tokens JWT |
| `TENANT_SLUG` | Tenant por defecto (fallback del tenant plugin) |
| `CORS_ORIGIN` | Orígenes permitidos para CORS |
| `COOKIE_DOMAIN` | Dominio de las cookies |
| `DO_SPACES_KEY` / `_SECRET` / `_ENDPOINT` / `_BUCKET` / `_CDN_URL` | Almacenamiento de archivos en DigitalOcean Spaces |
| `RESEND_API_KEY` / `RESEND_FROM` | Envío de correos |
| `NEXT_PUBLIC_API_URL` | URL del backend que usa el frontend |
| `NODE_ENV` / `PORT` / `LOG_LEVEL` | Entorno, puerto y nivel de logs |

El backend exige al arrancar (`server.ts`): `DATABASE_URL`, `JWT_SECRET`,
`REDIS_URL`.

---

## 11. Estado actual de producción

**Tenant activo (único):**

| Nombre | Slug | Schema | ID |
|---|---|---|---|
| H3DM Media | `market` | `tenant_h3dm` | `cmnz9q72q0000jai7rg3plt4x` |

**Usuarios dados de alta:**

| Email | Rol |
|---|---|
| `hm28443@gmail.com` | owner |
| `luis@h3dm.com.mx` | operaciones_manager |
| `fer@h3dm.com.mx` | field_worker |
| `carlos@adavailable.com` | operaciones_manager |
| `jochelo@adavailable.com` | operaciones_manager |
| `luis@adavailable.com` | field_worker |
| `tecnico1@adavailable.com` | field_worker |
| `operaciones@demo.com` | operaciones_manager |
| `trafico@demo.com` | trafficker |
| `vendedor@demo.com` | seller |

(El portal de cliente usa la tabla aparte `PortalCliente`, ej.
`paulina@westmedia.com`.)

---

## 12. Referencia rápida

| Necesito… | Comando / ubicación |
|---|---|
| Entrar al servidor | `ssh root@159.203.188.58` |
| Código en el servidor | `/var/www/Marketplace/spaces-dooh` |
| Entrar a la base | `sudo -u postgres psql spaces_prod` |
| Ver procesos | `pm2 list` |
| Ver logs | `pm2 logs spaces-api` |
| Reiniciar | `pm2 reload ecosystem.config.js` |
| Crear usuarios | `apps/api/prisma/seeds/seed-add-users.ts` |
| Esquema de la base | `apps/api/prisma/schema.prisma` |
| Config de procesos | `ecosystem.config.js` |
| Pipeline de deploy | `.github/workflows/deploy.yml` |
| Variables de entorno | `apps/api/.env` (en el droplet) |
| URL pública | `https://market.adavailable.com/spaces-dooh/` |

---

## 13. Recomendaciones de seguridad

- **Rotar las contraseñas** del usuario root del droplet y del usuario
  `spaces_user` de PostgreSQL.
- Pasar el acceso SSH del droplet a **llave SSH** en lugar de contraseña.
- No commitear archivos `.env` ni scripts con contraseñas en texto plano.
- Pedir a los usuarios nuevos que cambien su contraseña en el primer ingreso.
