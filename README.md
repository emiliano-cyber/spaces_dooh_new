# Spaces DOOH

Plataforma multi-tenant para gestión de redes de publicidad exterior (OOH/DOOH).

## Stack

- **API** — Fastify + Prisma + PostgreSQL (multi-schema) + Redis + BullMQ
- **Web** — Next.js 14 (App Router) + React Query
- **Infra** — DigitalOcean Droplet + Nginx + PM2 + Let's Encrypt

## Desarrollo local

```bash
# Requisitos: Node 20, PostgreSQL, Redis

# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env con tu DATABASE_URL y REDIS_URL

# 3. Correr migraciones
cd apps/api && npx prisma migrate deploy

# 4. Crear tenant de desarrollo
./infra/scripts/new-tenant.sh \
  --slug=dev \
  --nombre="Dev Tenant" \
  --owner-email=admin@dev.com

# 5. Iniciar en modo desarrollo
npm run dev
```

El API queda en `http://localhost:3001` y el frontend en `http://localhost:3000`.

## Gestión de tenants

### Crear un tenant nuevo

```bash
./infra/scripts/new-tenant.sh \
  --slug=westmedia \
  --nombre="West Media" \
  --owner-email=owner@westmedia.com
```

El script es **idempotente**: si se ejecuta dos veces con el mismo slug no falla.

### Migrar todos los tenants existentes

```bash
# Ver qué schemas se migrarían (sin ejecutar)
./infra/scripts/migrate-all-tenants.sh --dry-run

# Ejecutar migraciones
./infra/scripts/migrate-all-tenants.sh
```

## Deploy en producción

### Primera vez — configurar el droplet

```bash
# En el droplet Ubuntu 22.04 (como root)
bash infra/scripts/setup-droplet.sh

# Clonar el repo
git clone <repo-url> /var/www/spaces-dooh
cd /var/www/spaces-dooh

# Crear .env de producción
cp apps/api/.env.example apps/api/.env
nano apps/api/.env   # completar DATABASE_URL, REDIS_URL, JWT_SECRET, etc.

# Instalar, compilar y arrancar
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save

# Configurar Nginx (reemplazar {TENANT_SLUG} con el slug real)
sed 's/{TENANT_SLUG}/westmedia/g' infra/nginx/spaces.conf \
  > /etc/nginx/sites-available/spaces.conf
ln -s /etc/nginx/sites-available/spaces.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Obtener certificado SSL wildcard
certbot --nginx -d '*.westmedia.spaces.com'
```

### Deploy continuo (GitHub Actions)

Cada push a `main` dispara el workflow `.github/workflows/deploy.yml` que:
1. Type-check + build en CI
2. SSH al droplet → `git pull` → `npm ci` → `turbo build` → `pm2 reload`

#### GitHub Secrets requeridos

| Secret | Descripción |
|--------|-------------|
| `DROPLET_IP` | IP pública del droplet de DigitalOcean |
| `SSH_PRIVATE_KEY` | Clave SSH privada con acceso root al droplet |

Para agregar los secrets: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

## Estructura del proyecto

```
spaces-dooh/
├── apps/
│   ├── api/          # Fastify API (puerto 3001)
│   └── web/          # Next.js frontend (puerto 3000)
├── packages/
│   ├── types/        # Tipos compartidos TypeScript
│   └── utils/        # Utilidades compartidas (permisos, etc.)
├── infra/
│   ├── nginx/
│   │   └── spaces.conf          # Configuración Nginx
│   └── scripts/
│       ├── new-tenant.sh        # Crear tenant nuevo
│       ├── migrate-all-tenants.sh # Migrar todos los tenants
│       └── setup-droplet.sh     # Configurar droplet nuevo
├── ecosystem.config.js          # PM2 — procesos de producción
└── .github/
    └── workflows/
        └── deploy.yml           # CI/CD pipeline
```
