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
# ─── Que nada se pare a preguntar ─────────────────────────────────────────────
#
#  Este guion viaja por `ssh root@host 'bash -s'`: no hay terminal, y stdin lo
#  esta consumiendo bash para leer el propio guion. Cualquier dialogo que se abra
#  aqui espera una respuesta que NO puede llegar nunca.
#
#  Medido el 2026-09-03 en el ensayo de F5.6, y costo una hora: el `apt-get
#  upgrade` de abajo abre el menu de `needrestart` --«Which services should be
#  restarted?»-- que las imagenes de Ubuntu 22.04 de DigitalOcean traen puesto, y
#  se queda ahi. Colgado no da error: parece que va lento.
#
#  Demostrado repitiendolo: el MISMO guion sobre la MISMA maquina, con estas dos
#  lineas, termino en minutos.
#
#  Van AQUI y no en quien lanza el guion. Un alta que depende de que el operador
#  recuerde dos variables se cuelga el dia que no las recuerde.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

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
# El sitio de ejemplo de Ubuntu declara `default_server` en el puerto 80, y la
# plantilla de una instancia trae el SUYO a proposito (`instancia.conf.tpl:66`, el
# bloque que atrapa las peticiones por IP). Dos default_server y nginx se NIEGA a
# arrancar: «a duplicate default server for 0.0.0.0:80».
#
# Medido el 2026-09-04 en el ensayo de F5.6, y lo caro es cuando pasa: el vhost con
# TLS ya esta escrito en disco cuando `nginx -t` falla, asi que nginx sigue con la
# configuracion vieja cargada y NO ARRANCA en el siguiente reinicio. Un alta «casi
# terminada» deja una instancia que muere sola.
#
# Y el proyecto ya lo sabia: `infra/nginx/padre-ip.conf:25` lo dice desde que se
# monto el PADRE. La leccion existia, pero en un archivo que el alta no lee.
rm -f /etc/nginx/sites-enabled/default
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


# ─── Resumen ──────────────────────────────────────────────────────────────────
#
#  ⚠️ ESTE EPILOGO SE HA CORREGIDO DOS VECES, y las dos por lo mismo: describia
#  un modelo que ya no existe. Conviene saberlo antes de escribir aqui.
#
#  1.ª (2026-08-24, defecto ④ del arranque del PADRE) — mandaba a `apps/api`, el
#     backend Fastify archivado en `_archive/api`, a la ruta
#     `/var/www/spaces-dooh` y a un certificado COMODIN `*.{slug}.spaces.com`,
#     del modelo de subdominios por tenant que murio el 2026-08-12.
#
#  2.ª (2026-09-02) — mandaba a `git clone`, `npm ci`, `npm run build` y
#     `pm2 start ecosystem.config.js`. Eso es el modelo de REPO CLONADO, muerto
#     por el ADR 0019 (systemd sustituye a pm2 en el PADRE) y despues por el
#     modelo de contenedores, que F3.5 demostro funcionando el 02/09.
#     **Una instancia no clona el repositorio y no usa pm2**: corre un
#     contenedor que `update.sh` levanta desde la imagen del registro, y su
#     entorno son `/etc/space-os/{app,instancia}.env`, que los escribe el paso 4
#     de `provision-instancia.sh`.
#     Lo que lo volvia peor: `aprovisionamiento-epilogo.test.ts` EXIGIA que
#     apareciera `pm2`, asi que la prueba no lo permitia — lo obligaba.
#
#  Y esto es lo que hace que un epilogo equivocado cueste caro:
#  `provision-instancia.sh:330` mete este guion por `bash -s` DENTRO de su
#  propio recorrido, asi que lo de abajo se imprime **entre el paso 1 y el 2**,
#  con los pasos 2 a 7 a punto de correr solos. Un «pasos siguientes» aqui manda
#  a hacer a mano lo que el script hace el segundos despues.
#
#  Por eso ahora NO hay lista de pasos: solo lo que quedo instalado y quien
#  sigue. `apps/web/lib/aprovisionamiento-epilogo.test.ts` se pone rojo si
#  vuelve cualquiera de los dos modelos muertos.
#
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  ✓ BASE DEL SERVIDOR LISTA                                  │"
echo "│                                                             │"
echo "│  Quedo instalado:                                           │"
echo "│    Docker · PostgreSQL · nginx · certbot · s3cmd · ufw      │"
echo "│                                                             │"
echo "│  Esta maquina NO lleva el codigo del proyecto: una          │"
echo "│  instancia corre un CONTENEDOR desde la imagen del          │"
echo "│  registro, y lo levanta 'update.sh'. Aqui no se clona el    │"
echo "│  repositorio ni se compila nada.                            │"
echo "│                                                             │"
echo "│  QUIEN SIGUE: 'provision-instancia.sh', que llamo a este    │"
echo "│  guion y continua solo con la base de datos, el esquema,    │"
echo "│  el entorno, nginx y el actualizador. No hay que hacer      │"
echo "│  nada a mano entre este mensaje y el siguiente.             │"
echo "│                                                             │"
echo "│  Y si has corrido ESTE guion suelto, el recorrido           │"
echo "│  completo es:                                               │"
echo "│    ./infra/scripts/provision-instancia.sh --host <ip> \     │"
echo "│         --dominio <dominio> --instancia <nombre> --dry-run  │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
