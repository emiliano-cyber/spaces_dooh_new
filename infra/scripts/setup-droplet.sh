#!/usr/bin/env bash
set -euo pipefail

# ─── setup-droplet.sh ─────────────────────────────────────────────────────────
# Configura un droplet Ubuntu 22.04 desde cero.
# Ejecutar como root: bash infra/scripts/setup-droplet.sh

if [[ "$EUID" -ne 0 ]]; then
  echo "Error: este script debe ejecutarse como root"
  exit 1
fi

echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  Spaces DOOH — Configuración del Droplet        │"
echo "│  Ubuntu 22.04 LTS                               │"
echo "└─────────────────────────────────────────────────┘"
echo ""

# ─── Sistema ──────────────────────────────────────────────────────────────────
echo "→ Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq
echo "  ✓ Sistema actualizado"

# ─── Docker ──────────────────────────────────────────────────────────
#
#  Lo UNICO que esta maquina necesita para correr el producto. Hasta el
#  2026-09-01 este guion instalaba Node por nvm y pm2, que es el modelo que murio
#  el 12/08: entonces el servidor construia y ejecutaba el codigo. Hoy no. Hoy
#  jala una imagen y la corre, y `update.sh` es enteramente `docker pull` y
#  `docker run`.
#
#  Se quito pm2 ademas por una razon medida: en el PADRE se PELEO POR EL PUERTO
#  contra systemd al reiniciar la maquina (trampa 6 del traspaso del 28/08).
#  Dejarlo instalado en cada instancia era repartir esa trampa por la flota.
#
#  Y se quito Node: desde hoy la imagen lleva `scripts/migrar.mjs` dentro, asi
#  que las migraciones corren en un contenedor efimero y el anfitrion no
#  necesita interprete para nada.
echo "→ Instalando Docker..."
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi
cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin

# Que sobreviva a un reinicio. Es la mitad del trato: `update.sh` deja el
# contenedor corriendo, y si la maquina se reinicia sin esto la instancia queda
# caida hasta que alguien mire.
systemctl enable docker
systemctl start docker
echo "  ✓ Docker $(docker --version | awk '{print $3}' | tr -d ,) instalado"

# ─── Nginx ────────────────────────────────────────────────────────────────────
echo "→ Instalando PostgreSQL..."
# Sin esto, `provision-instancia.sh` moria en su PRIMER comando: hace
# `sudo -u postgres psql` para crear los roles, y en un droplet recien nacido no
# habia ni servidor ni usuario `postgres`. Nadie lo vio porque nunca se
# aprovisiono una instancia: el --dry-run imprime ese comando, no lo ejecuta.
apt-get install -y -qq postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
echo "  ✓ PostgreSQL $(psql --version | awk '{print $3}') instalado"

echo "→ Instalando Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
echo "  ✓ Nginx instalado y habilitado"

# ─── Certbot ──────────────────────────────────────────────────────────────────
echo "→ Instalando Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx
echo "  ✓ Certbot instalado"

# ─── Cliente de S3, para que el respaldo y el log SALGAN del droplet ─────────
#  No es una comodidad. `respaldo.sh` sube el dump y `update.sh` sube el log a
#  Spaces, y los dos resuelven el cliente con `respaldo_cliente()`, que exige
#  `s3cmd` o `aws` en el PATH. Sin ninguno de los dos, esa ruta falla ABIERTO
#  —registra y devuelve 1 (`respaldo.sh:241-244`)—, o sea que el update sigue en
#  verde y la instancia se queda SIN respaldo fuera de la máquina sin que nadie
#  se entere. Se descubriría el día que la máquina se pierda, que es el único día
#  en que el respaldo remoto importa.
#
#  `s3cmd` y no `awscli`: pesa unos megas en vez de ~100, y es el que
#  `respaldo_cliente()` prefiere con `SPACES_CLIENTE=auto`.
#
#  Instalarlo NO configura nada: sin `SPACES_KEY`/`SPACES_SECRET` en
#  `instancia.env` sigue sin subirse nada, y el log lo dice con esas palabras.
echo "→ Instalando cliente de S3 (s3cmd)..."
apt-get install -y -qq s3cmd
echo "  ✓ s3cmd $(s3cmd --version 2>/dev/null | awk '{print $3}') instalado"

# ─── Firewall (ufw) ───────────────────────────────────────────────────────────
echo "→ Configurando firewall..."
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
echo "  ✓ ufw habilitado (22, 80, 443)"

# ─── Directorio del proyecto ──────────────────────────────────────────────────
echo "→ Creando directorio del proyecto..."
mkdir -p /var/www/Spaces/logs
echo "  ✓ /var/www/Spaces listo"

# ─── Resumen ──────────────────────────────────────────────────────────────────
#
#  ⚠️ ESTE EPILOGO SE CORRIGIO EL 2026-08-24 (defecto ④ del arranque del PADRE).
#  Lo que decia antes describia un producto que ya no existe: `apps/api` —el
#  backend Fastify, archivado en `_archive/api`—, la ruta `/var/www/spaces-dooh`
#  y un certificado COMODIN `*.{slug}.spaces.com`, del modelo de subdominios por
#  tenant que murio el 2026-08-12 y que el plan v3 descarta (T9).
#
#  No es cosmetico: este guion se convierte en `provision-instancia.sh` en la
#  Fase 5, asi que esto es lo ultimo que lee quien aprovisiona una instancia.
#  `apps/web/lib/aprovisionamiento-epilogo.test.ts` se pone rojo si vuelve.
#
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  ✓ Droplet listo. Pasos siguientes:                          │"
echo "│                                                              │"
echo "│  1. Clonar el repo:                                          │"
echo "│     git clone <repo-url> /var/www/Spaces                     │"
echo "│                                                              │"
echo "│  2. Instalar dependencias:                                   │"
echo "│     cd /var/www/Spaces && npm ci                             │"
echo "│                                                              │"
echo "│  3. Crear el .env de la instancia, y CERRARLO:               │"
echo "│     cp .env.production.example apps/web/.env.production      │"
echo "│     nano apps/web/.env.production                            │"
echo "│     chmod 600 apps/web/.env.production                       │"
echo "│     (nace 644, con la clave de la base dentro: defecto ⑦)    │"
echo "│                                                              │"
echo "│  4. Rol de la app, esquema y migraciones — EN ESE ORDEN:     │"
echo "│     sin el rol, la cadena aborta en la migracion 52 de 70    │"
echo "│     DATABASE_URL=... node scripts/migrar.mjs \\                │"
echo "│                        --instalacion-nueva                   │"
echo "│                                                              │"
echo "│  5. Compilar y arrancar con PM2:                             │"
echo "│     npm run build                                            │"
echo "│     pm2 start ecosystem.config.js && pm2 save                │"
echo "│                                                              │"
echo "│  6. Configurar Nginx (archivo VERSIONADO, no pegado a mano;  │"
echo "│     'nginx -t' dice ok sobre una config corrupta: defecto ⑧) │"
echo "│     cp infra/nginx/<instancia>.conf \\                        │"
echo "│        /etc/nginx/sites-available/spaces                     │"
echo "│     ln -s /etc/nginx/sites-available/spaces \\                │"
echo "│           /etc/nginx/sites-enabled/                          │"
echo "│     nginx -t && systemctl reload nginx                       │"
echo "│                                                              │"
echo "│  7. Certificado — UNO por instancia, por HTTP-01.            │"
echo "│     CERTIFICADO PRIMERO, server_name despues:                │"
echo "│     certbot certonly --webroot -w /var/www/html \\            │"
echo "│                      -d <dominio-de-la-instancia>            │"
echo "│                                                              │"
echo "│  8. El alta de la instancia (crea la organizacion y su       │"
echo "│     Dueno). Revisa que no queden marcadores puestos:         │"
echo "│     ORG_SLUG=... ADMIN_EMAIL=... \\                           │"
echo "│       node apps/web/scripts/bootstrap-auth.mjs               │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
