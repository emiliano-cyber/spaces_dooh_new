#!/usr/bin/env bash
# ============================================================================
#  respaldo.sh — copia de seguridad de TODO lo que hay en producción.
# ----------------------------------------------------------------------------
#  Se corre ANTES de tocar nada. No modifica producción: solo lee.
#
#    bash respaldo.sh                 # respalda en /root/respaldos/<fecha>
#    DESTINO=/mnt/otro bash respaldo.sh
#
#  QUE SE LLEVA
#    - la base de datos completa (mysqldump del contenedor de producción)
#    - las fotos (el volumen de storage, tal cual)
#    - backend/.env, que NO esta en el repositorio y sin el nada arranca
#    - los compose y los vhost de Apache
#    - un MANIFIESTO con tamanos, huellas y las instrucciones de vuelta atras
#
#  POR QUE VERIFICA EN VEZ DE CONFIAR. Un respaldo que nadie comprueba es una
#  carpeta con la forma de un respaldo. Aqui se cuenta que el volcado tenga las
#  tablas que tiene que tener y que no este vacio ANTES de decir que salio bien;
#  si algo falta, el script termina en rojo y lo dice.
# ============================================================================
set -euo pipefail

DESTINO="${DESTINO:-/root/respaldos}"
FECHA="$(date +%Y-%m-%d_%H%M)"
DIR="$DESTINO/space-eye-$FECHA"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ─── 1. Encontrar la pila de producción, sin adivinar nombres ───────────────
paso "1) Buscando la pila de producción"

CONT_MYSQL="$(docker ps --format '{{.Names}}' | grep -iE 'mysql' | grep -viE 'v2' | head -1 || true)"
CONT_BACK="$(docker ps --format '{{.Names}}' | grep -iE 'backend' | grep -viE 'v2' | head -1 || true)"

if [[ -z "$CONT_MYSQL" ]]; then
  rojo "No encuentro el contenedor de MySQL de producción. Contenedores vivos:"
  docker ps --format '  {{.Names}}  ({{.Image}})'
  exit 1
fi
echo "   MySQL:   $CONT_MYSQL"
echo "   Backend: ${CONT_BACK:-(no lo encontre; sigo, el volcado no lo necesita)}"

# La clave sale del propio contenedor: asi el respaldo no depende de que quien
# lo corre sepa la contrasena ni de que este escrita en otro sitio.
DB_PASS="$(docker exec "$CONT_MYSQL" printenv MYSQL_ROOT_PASSWORD 2>/dev/null || true)"
if [[ -z "$DB_PASS" ]]; then
  rojo "No pude leer MYSQL_ROOT_PASSWORD del contenedor. Sin eso no hay volcado."
  exit 1
fi

mkdir -p "$DIR"
echo "   Destino: $DIR"

# ─── 2. La base de datos ────────────────────────────────────────────────────
paso "2) Volcando la base de datos"
docker exec "$CONT_MYSQL" mysqldump \
  -uroot -p"$DB_PASS" \
  --single-transaction --quick --routines --triggers --events \
  --all-databases 2>/dev/null | gzip -9 > "$DIR/base-completa.sql.gz"

TAM_SQL=$(stat -c%s "$DIR/base-completa.sql.gz")
echo "   $(numfmt --to=iec "$TAM_SQL" 2>/dev/null || echo "$TAM_SQL bytes")"

# ─── 3. Las fotos ───────────────────────────────────────────────────────────
paso "3) Copiando las fotos"
if [[ -n "$CONT_BACK" ]]; then
  docker run --rm \
    --volumes-from "$CONT_BACK" \
    -v "$DIR:/respaldo" \
    alpine sh -c 'tar czf /respaldo/fotos.tar.gz -C /app storage 2>/dev/null || true'
  TAM_FOTOS=$(stat -c%s "$DIR/fotos.tar.gz" 2>/dev/null || echo 0)
  echo "   $(numfmt --to=iec "$TAM_FOTOS" 2>/dev/null || echo "$TAM_FOTOS bytes")"
else
  rojo "   Sin contenedor de backend no puedo llegar al volumen de fotos."
  TAM_FOTOS=0
fi

# ─── 4. Lo que no esta en el repositorio ────────────────────────────────────
paso "4) Configuracion y vhosts"
mkdir -p "$DIR/config"
for f in backend/.env infra/docker-compose.ip.yml infra/docker-compose.prod.yml; do
  for raiz in "$PWD" "$PWD/.." /opt/space-eye /root/Space_eye /root/space-eye; do
    [[ -f "$raiz/$f" ]] && { cp "$raiz/$f" "$DIR/config/$(echo "$f" | tr '/' '_')"; echo "   $raiz/$f"; break; }
  done
done
if [[ -d /etc/apache2/sites-available ]]; then
  tar czf "$DIR/config/apache-sites.tar.gz" -C /etc/apache2 sites-available sites-enabled 2>/dev/null || true
  echo "   /etc/apache2/sites-*"
fi

# ─── 5. COMPROBAR el respaldo, que es el punto ──────────────────────────────
paso "5) Comprobando que el respaldo sirve"
FALLOS=0

TABLAS=$(zcat "$DIR/base-completa.sql.gz" | grep -c "^CREATE TABLE" || true)
echo "   tablas en el volcado: $TABLAS"
[[ "$TABLAS" -lt 10 ]] && { rojo "   POCAS TABLAS: el volcado no parece completo"; FALLOS=$((FALLOS+1)); }

for t in devices photos commands device_status api_keys; do
  if zcat "$DIR/base-completa.sql.gz" | grep -q "CREATE TABLE \`$t\`"; then
    echo "   ok  $t"
  else
    rojo "   FALTA la tabla $t"; FALLOS=$((FALLOS+1))
  fi
done

if ! zcat "$DIR/base-completa.sql.gz" | tail -5 | grep -q "Dump completed"; then
  rojo "   El volcado NO termina en 'Dump completed': se corto a la mitad"
  FALLOS=$((FALLOS+1))
fi

[[ "$TAM_FOTOS" -gt 0 ]] && tar tzf "$DIR/fotos.tar.gz" >/dev/null 2>&1 && echo "   ok  el tar de fotos se puede abrir"

# ─── 6. Manifiesto ──────────────────────────────────────────────────────────
paso "6) Manifiesto"
( cd "$DIR" && sha256sum ./* ./config/* 2>/dev/null > HUELLAS.txt || true )

cat > "$DIR/MANIFIESTO.txt" <<FIN
RESPALDO DE SPACE EYE — $FECHA
Servidor: $(hostname) · $(hostname -I 2>/dev/null | awk '{print $1}')

QUE HAY AQUI
  base-completa.sql.gz   todas las bases, con rutinas y disparadores
  fotos.tar.gz           el volumen de fotos (storage)
  config/                backend/.env, los compose y los vhost de Apache
  HUELLAS.txt            sha256 de cada archivo

COMO SE VUELVE ATRAS (si V2 sale mal)

  V2 vive en OTRA carpeta, con OTROS contenedores y OTROS volumenes, asi que
  para deshacerlo normalmente basta con apagarlo:

      docker compose -p space-eye-v2 down

  Producción no se toco en ningun momento: sigue en el 4000.

  Si ademas hubiera que restaurar la base de producción -solo si alguien la
  toco por error-:

      zcat base-completa.sql.gz | docker exec -i <contenedor-mysql> \\
        mysql -uroot -p<clave>

  Y las fotos:

      docker run --rm --volumes-from <contenedor-backend> \\
        -v \$PWD:/r alpine sh -c "cd /app && tar xzf /r/fotos.tar.gz"

  OJO: restaurar la base PISA lo que haya. Antes de hacerlo, vuelve a respaldar
  el estado actual, aunque parezca malo: un estado malo conocido es mejor que
  ninguno.
FIN

paso "RESULTADO"
if [[ "$FALLOS" -eq 0 ]]; then
  verde "Respaldo correcto y comprobado en $DIR"
  du -sh "$DIR"
else
  rojo "Respaldo con $FALLOS problema(s). NO sigas con el despliegue hasta resolverlo."
  exit 1
fi
