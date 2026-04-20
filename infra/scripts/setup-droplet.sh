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

# ─── Node.js 20 via nvm ───────────────────────────────────────────────────────
echo "→ Instalando Node.js 20 via nvm..."
export NVM_DIR="/root/.nvm"

if [[ ! -d "$NVM_DIR" ]]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 20
nvm use 20
nvm alias default 20

# Persist nvm in /etc/profile.d for all users
cat > /etc/profile.d/nvm.sh << 'EOF'
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
EOF

echo "  ✓ Node.js $(node --version) instalado"

# ─── PM2 ──────────────────────────────────────────────────────────────────────
echo "→ Instalando PM2..."
npm install -g pm2 --quiet
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
echo "  ✓ PM2 $(pm2 --version) instalado"

# ─── Nginx ────────────────────────────────────────────────────────────────────
echo "→ Instalando Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
echo "  ✓ Nginx instalado y habilitado"

# ─── Certbot ──────────────────────────────────────────────────────────────────
echo "→ Instalando Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx
echo "  ✓ Certbot instalado"

# ─── Firewall (ufw) ───────────────────────────────────────────────────────────
echo "→ Configurando firewall..."
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
echo "  ✓ ufw habilitado (22, 80, 443)"

# ─── Directorio del proyecto ──────────────────────────────────────────────────
echo "→ Creando directorio del proyecto..."
mkdir -p /var/www/spaces-dooh/logs
echo "  ✓ /var/www/spaces-dooh listo"

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  ✓ Droplet listo. Pasos siguientes:                        │"
echo "│                                                             │"
echo "│  1. Clonar el repo:                                        │"
echo "│     git clone <repo-url> /var/www/spaces-dooh              │"
echo "│                                                             │"
echo "│  2. Crear .env con las variables de producción:            │"
echo "│     cp .env.example apps/api/.env                          │"
echo "│     nano apps/api/.env                                     │"
echo "│                                                             │"
echo "│  3. Instalar dependencias y compilar:                      │"
echo "│     npm install && npm run build                           │"
echo "│                                                             │"
echo "│  4. Iniciar con PM2:                                       │"
echo "│     pm2 start ecosystem.config.js                         │"
echo "│     pm2 save                                               │"
echo "│                                                             │"
echo "│  5. Configurar Nginx:                                      │"
echo "│     cp infra/nginx/spaces.conf /etc/nginx/sites-available/│"
echo "│     ln -s /etc/nginx/sites-available/spaces.conf          │"
echo "│            /etc/nginx/sites-enabled/                      │"
echo "│     nginx -t && systemctl reload nginx                    │"
echo "│                                                             │"
echo "│  6. Obtener certificado SSL:                               │"
echo "│     certbot --nginx -d '*.{slug}.spaces.com'              │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
