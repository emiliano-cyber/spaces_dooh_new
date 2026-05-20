# HANDOFF — Spaces DOOH

Documento de transferencia para continuar el desarrollo desde otra máquina.
Generado: **2026-05-20**.

Este documento NO contiene secretos. Los archivos sensibles (DB dump, `.env`s,
PM2 dump) viven en `~/spaces-dooh-secrets/` y deben transferirse manualmente
por canal seguro al nuevo equipo (USB encriptado, 1Password, scp directo).

---

## 1. Estado a la fecha

- **Producción:** Funcionando en droplet DigitalOcean `159.203.188.58`
  (hostname `ubuntu-s-2vcpu-2gb-90gb-intel-nyc1-01`). Un solo tenant activo:
  H3DM Media (`subdominioBase=market`, `dbSchema=tenant_h3dm` configurado,
  pero data físicamente en `tenant_template` — ver §6).
- **Último deploy:** commit `f86c17a` (PM2 fix), aplicado el 2026-05-18.
- **Stack:** Next.js 14, Fastify, Prisma 7.7 + PrismaPg adapter,
  PostgreSQL 16 multi-schema, Redis 7, BullMQ, PM2 fork mode, Nginx + Let's
  Encrypt, DigitalOcean Spaces (S3), Resend (email).
- **Métricas:** 15 OTs activas, 6 portal-clientes, ~26 sitios, ~621 evidencias.

---

## 2. Restauración en máquina nueva — paso a paso

### 2.1 Pre-requisitos

```bash
# Node 20.x (NO 22+ — engine warning en @prisma/streams-local)
nvm install 20 && nvm use 20

# Postgres 16 + Redis 7 (solo si quieres BD/cache local; opcional si vas
# contra prod directamente para desarrollo)
# Mac: brew install postgresql@16 redis
# WSL/Linux: apt install postgresql-16 redis-server
```

### 2.2 Clonar y restaurar

```bash
git clone git@github.com:CarlosMend87/spaces-dooh.git
cd spaces-dooh
npm ci

# Generar Prisma client ANTES del build (sin esto el build falla)
cd apps/api && npx prisma generate && cd ../..

# Verificar que typecheck pasa
npx turbo run typecheck
```

### 2.3 Restaurar secretos

Trae estos archivos del backup (`~/spaces-dooh-secrets/` en la máquina vieja)
al nuevo equipo, **fuera del repo**:

| Archivo origen | Destino |
|---|---|
| `~/spaces-dooh-secrets/api.env.prod` | Solo para referencia / deploys manuales. NO copiar al repo. |
| `~/spaces-dooh-secrets/api.env.local` | `apps/api/.env` (renombrar) |
| `~/spaces-dooh-secrets/web.env.local` | `apps/web/.env.local` |

`.gitignore` ya bloquea `.env*` — no se commitearán por accidente.

### 2.4 Restaurar BD localmente (opcional)

Si quieres una copia local de la BD de prod para desarrollar sin tocar
producción:

```bash
# Asume Postgres corriendo en localhost:5432 y DB "spaces_dev" creada
createdb spaces_dev
pg_restore -d spaces_dev --no-owner --no-acl \
  ~/spaces-dooh-secrets/db-backups/spaces_prod_20260520-125745.dump

# Apuntar apps/api/.env DATABASE_URL a:
#   postgresql://USER:PASS@localhost:5432/spaces_dev?schema=public
```

### 2.5 SSH al droplet desde el equipo nuevo

La llave actual del nuevo equipo NO está autorizada en el droplet. Hay 2
opciones:

**Opción A (recomendada):** generar nueva llave y agregarla al droplet
```bash
ssh-keygen -t ed25519 -C "claude@new-machine"
# Pedir al admin del droplet que agregue ~/.ssh/id_ed25519.pub a
# /root/.ssh/authorized_keys
```

**Opción B (lo que hemos venido haciendo):** SSH con password vía
`SSH_ASKPASS`. La contraseña actual de root está en
`~/spaces-dooh-secrets/api.env.prod` o se transfiere por canal seguro.
Ver patrón en `memory/reference_droplet-ssh.md`.

### 2.6 Verificar conectividad

```bash
# Local dev server
npm run dev   # turbo levanta api (3001) y web (3000)

# Test contra prod
curl -s https://market.adavailable.com/health
# Esperado: {"status":"ok","checks":{...}}
```

---

## 3. Producción — qué hay y dónde

### 3.1 Infraestructura

| Recurso | Ubicación | Credenciales |
|---|---|---|
| Droplet | `159.203.188.58` (DigitalOcean NYC1) | root + password en `api.env.prod` |
| Repo en droplet | `/var/www/Marketplace/spaces-dooh` | git pull desde main |
| Postgres | localhost:5432 en el droplet | DB `spaces_prod`, user `spaces_user` |
| Redis | localhost:6379 en el droplet | sin auth |
| DO Spaces | `spaces-dooh.nyc3.digitaloceanspaces.com` | Keys en `.env` (`DO_SPACES_KEY/SECRET`) |
| GitHub Action | `.github/workflows/deploy.yml` | Secrets: `DROPLET_IP`, `SSH_PRIVATE_KEY` |
| Email | Resend | `RESEND_API_KEY` en `.env` |
| DNS | adavailable.com / market.adavailable.com | (en cualquier registrar que usen) |

### 3.2 PM2 procesos (estado actual)

```
spaces-api   fork  puerto 3001  /var/www/.../apps/api/npm start
spaces-web   fork  puerto 3000  /var/www/.../apps/web/npm start
```

Configurado en `ecosystem.config.js` (commit `f86c17a`): `exec_mode:fork`,
`min_uptime:'10s'`, `max_restarts:10`, `kill_timeout:5000`.

PM2 startup persistente vía `pm2-root.service` (systemd). Si reinicias el
droplet, los procesos vuelven solos.

### 3.3 Deploy a producción

**Camino automatizado** (GitHub Action, una vez funcionando):

1. `git push origin main` desde tu equipo
2. Action corre: typecheck → build → SSH droplet → pull → npm ci → build
   → prisma migrate deploy → pm2 reload

**Camino manual** (el que hemos usado por el bug del Action):

```bash
ssh root@159.203.188.58
cd /var/www/Marketplace/spaces-dooh
git fetch origin main && git reset --hard origin/main
npm ci --prefer-offline
cd apps/api && npx prisma generate && cd ../..   # ← CRÍTICO, ver §6
npx turbo run build
cd apps/api && npx prisma migrate deploy && cd ../..
# Si la migración toca schemas de tenant, además:
# bash infra/scripts/migrate-all-tenants.sh
pm2 reload ecosystem.config.js --update-env
```

---

## 4. Trabajo reciente (últimas 2 semanas)

| Fecha | Commit | Qué |
|---|---|---|
| 05-18 | `f86c17a` | fix(pm2): fork mode + crash loop limits |
| 05-18 | `3c7008b` | feat: admin puede subir fotos en OT completada |
| 05-15 | `9fae10e` | feat: técnico móvil — galería además de cámara |
| 05-15 | `6bdb3ac` | feat: admin elimina fotos individuales |
| 05-15 | `0d36380` | feat: agrupar evidencias por día (Hoy, Ayer, fecha) |
| 05-15 | `f74b95e` | feat: editar fecha de visita y backdate al crear |
| 05-15 | `2c7a8aa` | feat: admin edita/agrega visitas en OT completada; cliente ve estructuradas |
| 05-15 | `c9ef096` | feat: visitas estructuradas tipo MODULOS/ELECTRICO |
| 05-15 | `9b2b625` | fix: OTs COMPLETADAS muestran 100% siempre |
| 05-14 | `14ea971` | fix: % avance cliente lee de 'Avance: NN%' |

(Ver `git log --oneline | head -30` para historial completo.)

---

## 5. Documentación adicional en el repo

- **`MANUAL.md`** (raíz) — manual técnico/operativo del sistema. Cubre
  arquitectura, modelos, flujos OOH/DOOH, jobs, comandos comunes. Léelo antes
  que cualquier otra cosa.
- **`README.md`** — quickstart básico.
- **`apps/api/prisma/schema.prisma`** — schema completo de la BD (23 modelos).
- **`apps/api/prisma/migrations/`** — historial de migraciones (11 archivos).
- **`infra/scripts/`** — scripts operativos:
  - `new-tenant.sh` — crear schema + roles + owner para un nuevo tenant
  - `migrate-all-tenants.sh` — propagar migraciones a tenants vivos (correr
    siempre que se haga `prisma migrate deploy` con cambios a `tenant_template`)
  - `setup-droplet.sh` — provisión inicial de servidor
  - `deploy.sh` — deploy manual (mismo flow que GH Action)

---

## 6. Bugs conocidos y deuda crítica

### 6.1 PrismaPg no aísla por schema (CRÍTICO)

Comprobado en prod el 2026-05-18: `count()` devuelve el mismo número sin
importar qué `schema` se pasa al adapter. Toda la data del tenant H3DM
físicamente vive en `tenant_template`, no en `tenant_h3dm` (que está vacío).
**Bloqueador para meter un segundo cliente** — los datos se mezclarían.

Investigar: ¿bug del adapter `@prisma/adapter-pg@7.7.0`? ¿Manera correcta de
pasar `{ schema }`? ¿`SET search_path` manual por query?

### 6.2 `prisma generate` falta en CI/CD (CRÍTICO)

`.github/workflows/deploy.yml` ejecuta `npm ci` + `turbo build` sin un
`npx prisma generate` intermedio. Como `npm ci` borra `node_modules/.prisma/`
y no hay postinstall, el build del API falla con
*"Module '@prisma/client' has no exported member 'PrismaClient'"*.

El Action llevaba **días fallando silenciosamente** antes de descubrirlo el
2026-05-18. Lo arreglé manualmente en prod pero NO está fixed en el
workflow todavía.

**Fix pendiente:** agregar paso `cd apps/api && npx prisma generate && cd ../..`
antes de `Build` en `deploy.yml`.

### 6.3 Migraciones de tenant no se propagan automáticamente

Cada migración modifica `tenant_template` (template). Los tenants vivos
(`tenant_h3dm`) requieren correr `infra/scripts/migrate-all-tenants.sh`
manualmente. Ya pasó con `visitasJson` el 2026-05-18 — la columna no llegó al
schema activo y el código fallaba silenciosamente.

**Fix pendiente:** agregar `bash infra/scripts/migrate-all-tenants.sh` al
deploy después de `prisma migrate deploy`.

### 6.4 Credenciales de connectors en base64 (no encriptado)

`connector.registry.ts:35` decodifica `credencialesEnc` con
`Buffer.from(..., 'base64')`. Es decodificación, no descifrado. Si la BD se
compromete, las API keys de Doohmain/Broadsign/Invian quedan expuestas en
texto.

### 6.5 Sin backup automatizado de Postgres

Antes del backup de hoy, no había `pg_dump` programado en el droplet. Si el
disco falla, se pierde todo. **Pendiente:** cron diario que dumpee a Spaces.

### 6.6 3 de 4 connectors son stubs

`broadsign.connector.ts`, `doohmain.connector.ts`, `invian.connector.ts` —
todos lanzan `throw new Error('credenciales no configuradas')` en
`publish/pause/resume/cancel/getDeliveryReport`. Solo `healthCheck` hace
HTTP real. **Únicamente `ManualConnector` funciona.**

### 6.7 13 FKs faltantes en schema Prisma

Muchas columnas `userId`/`sitioId` en `OrdenTrabajo`, `EvidenciaOT`,
`Incidencia`, `Creatividad`, `AuditLog`, `ComentarioPublico`,
`CampaignLine`, `Pantalla` etc. son `String` sueltos sin `@relation`. Por
eso el código abusa de `(prisma as any)` (101 ocurrencias). Hacer JOINs
eficientes está bloqueado.

### 6.8 Event bus in-memory

`core/events/event-bus.ts` es `EventEmitter` de Node. En cluster
multi-proceso o multi-droplet, eventos se pierden. Acoplado a
`readiness.check()` reactivo.

---

## 7. Roadmap inmediato (orden de prioridad)

1. **Cron de `pg_dump` diario** al droplet (subiendo a Spaces). 30 min.
2. **Fix `deploy.yml`** — agregar `prisma generate` + `migrate-all-tenants`.
   1-2 h.
3. **Investigar fix de PrismaPg multi-tenant.** Sin esto no se puede
   onboardar segundo cliente. 1-2 semanas.
4. **Encriptación real de credenciales de connectors** (Node `crypto` con
   key en env). 1 día.
5. **Password reset** con Resend. 2 días.
6. **Monitoreo externo** (UptimeRobot apuntando a `/health`). 30 min.
7. **Completar un connector real** (el que pida el siguiente cliente). 2
   semanas.

Ver `git log` y la auditoría completa de 2026-05-19 (en el chat de Claude
Code, no documentada en repo) para el detalle del análisis.

---

## 8. Comandos comunes

```bash
# Desarrollo local
npm run dev                              # api + web en watch mode

# Type check / build
npx turbo run typecheck
npx turbo run build

# Tests (solo backend — frontend no tiene tests)
cd apps/api && npm test
cd apps/api && npx vitest tests/operaciones.test.ts   # un solo archivo

# Migraciones (después de cambiar schema.prisma)
cd apps/api
npx prisma migrate dev --name nombre_descriptivo
# IMPORTANTE: si la migración toca tablas de tenant, EDITARLA para que use
# tenant_template explícitamente, y luego correr migrate-all-tenants en deploy

# Reset Prisma client (después de pull con cambios de schema)
cd apps/api && npx prisma generate

# Seeds
cd apps/api && npx ts-node prisma/seeds/seed-demo.ts
cd apps/api && npx ts-node prisma/seeds/seed-add-users.ts

# Producción — pull logs
ssh root@159.203.188.58 'pm2 logs --lines 100'
ssh root@159.203.188.58 'pm2 list'

# Producción — restart un proceso específico
ssh root@159.203.188.58 'pm2 restart spaces-api'
```

---

## 9. Convenciones del proyecto

- **Idioma:** comentarios y commits en español, código en inglés (mayormente).
- **Commits:** formato `tipo: descripción` (feat/fix/refactor/docs/chore).
  Suelo agregar `Co-Authored-By: Claude Opus 4.7` al final cuando trabajo
  con Claude Code.
- **Branches:** trabajo directo en `main`. No hay feature branches en uso.
- **No mocks ni placeholders en frontend** — todas las páginas hablan con
  API real. Si necesitas mocks para tests, usalos en `apps/api/tests/` no
  en el frontend.
- **Sin emojis en código** salvo emojis decorativos en strings de UI
  (botones tipo `📷 Subir foto`).
- **Mobile:** `OTMovil.tsx` es el componente dedicado para campo. El resto
  asume desktop con `gridTemplateColumns` fijo (deuda conocida).

---

## 10. Contactos / referencias

- **Usuario principal del sistema:** `jose.lopez@h3dm.com.mx`
- **Owner del tenant H3DM:** `hm28443@gmail.com`
- **Repo:** `git@github.com:CarlosMend87/spaces-dooh.git`
- **Dominio prod:** `market.adavailable.com` (web), `market.adavailable.com/api`
  (API a través de proxy nginx)

---

**Si algo no compila o la BD no responde después de la restauración,
empezar por:**

1. ¿Corriste `npx prisma generate` en `apps/api/` después de `npm ci`?
2. ¿El `.env` de `apps/api/` apunta a la BD correcta (local vs prod)?
3. ¿Postgres está corriendo? ¿Redis está corriendo?
4. ¿Hay un proceso ocupando los puertos 3000/3001?
   (`lsof -i :3000` / `lsof -i :3001`)
