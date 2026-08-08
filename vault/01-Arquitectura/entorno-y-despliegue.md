---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-07
tags: [despliegue, entorno, ci, env]
archivos:
  - apps/web/package.json
  - ecosystem.config.js
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - infra/nginx/demo.space-os.io.conf
  - db/docker-compose.yml
---

# Entorno y despliegue

## Local

```bash
# 1. Postgres (docker-compose expone el 5433, NO el 5432)
cd db && docker compose up -d

# 2. Aplicar esquema + migraciones
psql -d spaces -f db/schema.sql
# … y las 63 de db/migrations/ en orden lexicográfico ([[migraciones]])

# 3. La app
cd apps/web && npm run dev     # http://localhost:3000/spaces-dooh/
```

| Script | Qué hace | Dónde |
|---|---|---|
| `npm run dev` | Next dev | `apps/web/package.json:6` |
| `npm run build` | Next build | `apps/web/package.json:7` |
| `npm start` | `next start -p 3000` | `apps/web/package.json:8` |
| `npm test` | Vitest unitarias (~729) | `apps/web/package.json:10` |
| `npm run test:e2e` | Vitest integración (~55) | `apps/web/package.json:11` |
| `npm run typecheck` | `tsc --noEmit` | `apps/web/package.json:12` |

Las e2e necesitan una base aparte cuyo nombre **debe** terminar en `_e2e` o
`_test` (`apps/web/lib/test/db-e2e.ts`, `exigirBaseDePrueba()`). Ver
[[convenciones]].

## CI

| Workflow | Disparo | Qué corre |
|---|---|---|
| `ci.yml` | `pull_request` + push a `main` | typecheck → test → build (Node 20) |
| `lockfile-check.yml` | push + PR | `npm ci --dry-run` (Node 22) |
| `deploy.yml` | **`workflow_dispatch` manual** | backup → build → migraciones → `pm2 reload` |

> [!warning] No hay despliegue continuo
> `deploy.yml` solo corre a mano y **está desactualizado**. El despliegue real es
> manual por SSH. `ci.yml:1-30` documenta que el disparador es `pull_request` y
> **no** `pull_request_target` a propósito: el segundo daría secretos a código de
> un fork. No cambiarlo.

## Producción

| Pieza | Valor |
|---|---|
| Host | droplet DigitalOcean, IP vieja `209.97.146.136` (301 al dominio) |
| Dominio | `https://demo.space-os.io` |
| Ruta pública | `https://demo.space-os.io/spaces-dooh/` (`basePath`) |
| Directorio | `/var/www/Spaces` |
| Proceso | pm2 `spaces-web`, fork, 1 instancia, puerto 3000 |
| Usuario | `emiliano` (pm2 es por usuario: el daemon vive en `/home/emiliano/.pm2`) |
| Base | `spaces_prod`; las migraciones se aplican como `postgres` |
| Env | `apps/web/.env.production` (en el servidor, **no** en git) |
| Reverse proxy | nginx, `infra/nginx/demo.space-os.io.conf` |

> [!danger] `X-Forwarded-For $remote_addr` es deliberado
> `infra/nginx/demo.space-os.io.conf:123` **reemplaza** la cabecera en vez de
> añadir a la que mande el cliente. Eso es lo que impide que alguien elija su
> propio cubo de rate limit. Si se cambiara a `$proxy_add_x_forwarded_for`, el
> limitador del login se vuelve burlable mandando una IP inventada.

`infra/nginx/spaces.conf` y `infra/apache/spaces.conf` están **obsoletos**
(asumen el API Fastify archivado).

### `basePath` + `trailingSlash`: la trampa recurrente

`apps/web/next.config.mjs:8-9` fija `basePath: '/spaces-dooh'` y
`trailingSlash: true`. Toda URL absoluta que se registre en un tercero debe
llevar la barra final o la app responde 308 y el tercero no la sigue. Ya costó
un redespliegue con la ruta del logo, y `DESPLIEGUE_GOOGLE.txt:49-56` lo repite
para el redirect URI de Google.

## Variables de entorno

> Solo **nombres**. Los valores viven en `.env.production` del droplet y nunca
> deben copiarse aquí. `.gitignore:9-23` cubre `.env`, `.env.production` y los
> respaldos `.env*.bak*`.

### En uso por el código

| Variable | Para qué | Evidencia |
|---|---|---|
| `DATABASE_URL` | Conexión Postgres | `lib/server/db.ts:23` |
| `NODE_ENV` | Modo, default de `Secure`, pool en dev | `lib/server/auth.ts:148` |
| `COOKIE_SECURE` | Fuerza/apaga `Secure` en cookies | `lib/server/auth.ts:145-149` |
| `APP_URL` | Base de enlaces en correos | `app/api/auth/forgot/route.ts:50` |
| `HSTS` | Activa Strict-Transport-Security | `next.config.mjs:40` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo saliente | `lib/server/email.ts` |
| `RECORDATORIOS_TOKEN` | Autentica el cron; sin él la ruta da 503 | `app/api/recordatorios/route.ts` |
| `NEXT_PUBLIC_AUTOREGISTRO` | `'0'` apaga el alta pública | `app/api/signup/route.ts:18` |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD` | Apaga recuperar contraseña | `app/api/auth/forgot/route.ts:18` |
| `NEXT_PUBLIC_MAPTILER_KEY` | Mapas | `components/maps/SitiosMap.tsx` |
| `DO_SPACES_KEY/SECRET/ENDPOINT/BUCKET/CDN_URL` | Almacenamiento S3 | `lib/server/storage.ts:12-16` |
| `GOOGLE_OAUTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Acceso con Google | `lib/server/google-oauth.ts` |
| `SPACE_EYE_BASE_URL/USER/PASS` | Verificación por cámaras | `lib/server/space-eye.ts:20-22` |
| `DOOHMAIN_*` (5) | Publicación en pantallas vía SDK Python | `lib/server/doohmain.ts:8-13` |
| `ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY` | Conectores en modo demo | `lib/server/integraciones.ts` |
| `TZ` | Zona horaria | — |

### Solo pruebas
`DATABASE_URL_TEST`, `DATABASE_URL_TEST_APP`, `PUERTO_E2E`,
`PUERTO_DOBLE_GOOGLE`, `GOOGLE_DOBLE_SUB`, `GOOGLE_DOBLE_EMAIL`,
`GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT`, `SEED_PASSWORD`, `SMOKE_BASE`.

### Declaradas pero **no leídas** por `apps/web`

`JWT_SECRET`, `REDIS_URL`, `COOKIE_DOMAIN`, `LOG_LEVEL`, `NEXT_PUBLIC_TENANT_SLUG`
y `NEXT_PUBLIC_API_URL` (esta última solo la lee el `auth-context.tsx` muerto).
Son restos del backend archivado.

> [!bug] Discrepancia real
> `.env.production.example` declara **`RESEND_FROM`**, pero `lib/server/email.ts`
> lee **`EMAIL_FROM`**. Quien despliegue siguiendo la plantilla deja el correo
> apagado sin que nada lo diga. Ver [[preguntas-abiertas]].

## Relacionadas
[[vision-general]] · [[stack-y-dependencias]] · [[migraciones]] ·
[[zonas-de-riesgo]] · [[integraciones-externas]] · [[MOC-Proyecto]]
