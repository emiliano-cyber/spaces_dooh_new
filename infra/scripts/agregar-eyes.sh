#!/usr/bin/env bash
# ============================================================================
#  agregar-eyes.sh — Space Eyes en una instancia que YA EXISTE (ADR 0041).
# ----------------------------------------------------------------------------
#  El alta con `--con-eyes` deja a una empresa nueva con su Space Eye dentro de
#  su droplet. Las que se crearon ANTES (g500, 08/10/2026) no lo tienen: su
#  módulo Space Eyes no tiene servidor de cámaras y un celular nuevo no tiene a
#  dónde registrarse. Esto hace en el droplet de la empresa, como root, lo
#  mismo que el alta, con las mismas piezas (eyes-alta.sh):
#
#    1. comprueba: app viva, IP del droplet, puertos libres
#    2. respalda /etc/space-os y el sitio de nginx
#    3. credenciales nuevas (o las que ya tenga), eyes.env, compose, cron
#    4. levanta la pila con update-eyes.sh (migra y comprueba salud)
#    5. nginx: el fragmento space-eyes.conf dentro del sitio del dominio
#    6. la app: SPACE_EYE_* en app.env y se vuelve a levantar; si no responde,
#       regresa sola a la de antes
#
#  SIN SUBDOMINIO: los equipos entran por el MISMO dominio de la instancia
#  (https://<dominio>/api/..., su droplet y nadie más). No hace falta otro
#  registro DNS ni otro nombre en el certificado. El video va a la IP.
#
#  Uso (desde una copia del repo en el droplet):
#    bash infra/scripts/agregar-eyes.sh --dominio g500.space-os.io --owner g500 \
#         [--imagen-tar /root/space-eye.tar] [--imagen space-eye:0.16.16] \
#         [--apk /root/space-eye.apk]
#
#  --imagen-tar: la imagen de Space Eye exportada con `docker save` (mientras
#  no haya registry para ella). --apk: publica esa app para que los celulares
#  la bajen de https://<dominio>/space-eye.apk.
#
#  Se puede correr otra vez: conserva credenciales y no duplica nada.
#  Para ensayar fuera de un droplet: CONF_DIR, OPT_DIR, SITES_DIR, SNIPPETS_DIR,
#  CRON_DIR, LOG_DIR, y SALTAR_NGINX=1 / SALTAR_APP=1.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=entorno-instancia.sh
source "$RAIZ/infra/scripts/entorno-instancia.sh"
# shellcheck source=eyes-alta.sh
source "$RAIZ/infra/scripts/eyes-alta.sh"

CONF_DIR="${CONF_DIR:-/etc/space-os}"
OPT_DIR="${OPT_DIR:-/opt/space-os}"
SITES_DIR="${SITES_DIR:-/etc/nginx/sites-available}"
SNIPPETS_DIR="${SNIPPETS_DIR:-/etc/nginx/snippets}"
CRON_DIR="${CRON_DIR:-/etc/cron.d}"
LOG_DIR="${LOG_DIR:-/var/log/space-os}"
CONTENEDOR="${CONTENEDOR:-space-os}"
PROYECTO_EYES="${PROYECTO_EYES:-space-eyes}"
DOMINIO="" OWNER="" CONTACTO="" IMAGEN_TAR="" IMAGEN="" APK="" IP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dominio) DOMINIO="$2"; shift 2 ;;
    --owner) OWNER="$2"; shift 2 ;;
    --contacto) CONTACTO="$2"; shift 2 ;;
    --imagen-tar) IMAGEN_TAR="$2"; shift 2 ;;
    --imagen) IMAGEN="$2"; shift 2 ;;
    --apk) APK="$2"; shift 2 ;;
    --ip) IP="$2"; shift 2 ;;
    *) echo "opción desconocida: $1" >&2; exit 2 ;;
  esac
done
paso() { printf '\n== %s\n' "$*"; }
falla() { printf 'FALLA: %s\n' "$*" >&2; exit 1; }
codigo() { curl -s -o /dev/null -m 8 -w '%{http_code}' "$@" || echo 000; }
[[ -n "$DOMINIO" && -n "$OWNER" ]] || { echo "Uso: --dominio <dominio> --owner <empresa> [--contacto correo]"; exit 2; }
[[ "$OWNER" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || falla "owner inválido: $OWNER"
APP_ENV="$CONF_DIR/app.env"
INST_ENV="$CONF_DIR/instancia.env"
EYES_ENV="$CONF_DIR/eyes.env"
SITIO="$SITES_DIR/$DOMINIO"

# ─── 1 · Comprobaciones ───────────────────────────────────────────────────
paso "1. Comprobaciones"
[[ -f "$APP_ENV" ]] || falla "no existe $APP_ENV: ¿es el droplet de una instancia?"
command -v docker >/dev/null || falla "no hay docker"
SALUD_APP="http://127.0.0.1:3000/spaces-dooh/api/version/"
if [[ "${SALTAR_APP:-0}" != 1 ]]; then
  [[ "$(codigo "$SALUD_APP")" == 200 ]] || falla "la app de la instancia no responde en $SALUD_APP"
fi
if [[ -z "$IP" ]]; then
  IP="$(curl -s -m 5 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
  [[ -n "$IP" ]] || IP="$(curl -s -m 5 https://api.ipify.org || true)"
fi
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || falla "no pude saber la IP pública de este droplet (usa --ip)"
echo "   IP pública: $IP"
if [[ "${SALTAR_NGINX:-0}" != 1 ]]; then
  [[ -f "$SITIO" ]] || falla "no existe el sitio de nginx $SITIO"
  grep -q "server_name $DOMINIO;" "$SITIO" || falla "$SITIO no sirve $DOMINIO"
  grep -q 'listen 443' "$SITIO" || falla "$SITIO no tiene bloque https"
fi
YA="$( [[ -f "$EYES_ENV" ]] && echo 1 || echo 0 )"
if [[ "$YA" == 0 ]]; then
  for p in 4200 8889 8554 3478; do
    ss -ltn 2>/dev/null | grep -q ":$p " && falla "el puerto $p ya está ocupado"
  done
fi
echo "   ya tenía Space Eye: $([[ $YA == 1 ]] && echo 'sí (se conservan sus credenciales)' || echo no)"

# ─── 2 · Respaldo ─────────────────────────────────────────────────────────
paso "2. Respaldo"
R="${RESPALDOS:-/root/respaldos}/agregar-eyes-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$R" && chmod 700 "$R"
cp -a "$CONF_DIR" "$R/space-os"
[[ -f "$SITIO" ]] && cp -p "$SITIO" "$R/nginx-$DOMINIO"
echo "   $R"

# ─── 3 · Imagen, credenciales y archivos ──────────────────────────────────
paso "3. Imagen, credenciales y archivos"
if [[ -n "$IMAGEN_TAR" ]]; then
  [[ -s "$IMAGEN_TAR" ]] || falla "no existe $IMAGEN_TAR"
  CARGADA="$( (gunzip -c "$IMAGEN_TAR" 2>/dev/null || cat "$IMAGEN_TAR") | docker load | sed -n 's/^Loaded image: //p' | tail -n1)"
  [[ -n "$CARGADA" ]] || falla "no se pudo cargar $IMAGEN_TAR"
  IMAGEN="${IMAGEN:-$CARGADA}"
  echo "   imagen cargada: $CARGADA"
fi
# Si ya tenía eyes.env se conservan sus credenciales (las conoce su SPACE OS).
if [[ "$YA" == 1 ]]; then
  EYES_LLAVE="$(sed -n 's/^INSTANCIA_LLAVE=//p' "$EYES_ENV" | tail -n1)"
  EYES_TESTIGO="$(sed -n 's/^INSTANCIA_TESTIGO=//p' "$EYES_ENV" | tail -n1)"
  [[ -n "$IMAGEN" ]] && sed -i "s|^EYES_IMAGEN=.*|EYES_IMAGEN=$IMAGEN|" "$EYES_ENV"
else
  [[ -n "$IMAGEN" ]] || falla "falta --imagen o --imagen-tar (aún no hay registry para Space Eye)"
  eyes_preparar_credenciales
  mkdir -p "$CONF_DIR"
  ( umask 077; eyes_env "$RAIZ/infra/eyes/eyes.env.example" "$OWNER" "$DOMINIO" "$IP" "$IMAGEN" > "$EYES_ENV" )
  chmod 600 "$EYES_ENV"
fi
mkdir -p "$OPT_DIR/eyes" "$LOG_DIR"
while IFS=$'\t' read -r origen destino modo; do
  destino="${destino/\/opt\/space-os/$OPT_DIR}"
  destino="${destino/\/etc\/nginx\/snippets/$SNIPPETS_DIR}"
  mkdir -p "$(dirname "$destino")"
  install -m "$modo" "$origen" "$destino"
done < <(eyes_archivos "$RAIZ")
mkdir -p "$CRON_DIR"; eyes_cron > "$CRON_DIR/space-os-eyes"; chmod 644 "$CRON_DIR/space-os-eyes"
echo "   eyes.env, compose, mediamtx.yml, update-eyes.sh, fragmento de nginx y cron en su lugar"
# Una instalación hecha con el diseño viejo (eyes.<dominio>) se corrige aquí:
# el dominio de los equipos es el de la instancia, no un subdominio.
if grep -q "^EYES_DOMINIO=eyes\." "$EYES_ENV"; then
  sed -i "s|^EYES_DOMINIO=.*|EYES_DOMINIO=$DOMINIO|" "$EYES_ENV"
  echo "   eyes.env: EYES_DOMINIO pasa a $DOMINIO (sin subdominio)"
fi

# ─── 4 · La pila ──────────────────────────────────────────────────────────
paso "4. Levantando Space Eye (update-eyes.sh migra y comprueba su salud)"
EYES_CONF="$EYES_ENV" EYES_DIR="$OPT_DIR/eyes" INSTANCIA_CONF="$INST_ENV" \
  EYES_RESPALDOS="${EYES_RESPALDOS:-/var/backups/space-os/eyes}" EYES_CANDADO="${EYES_CANDADO:-/run/lock/space-os-eyes.lock}" \
  bash "$OPT_DIR/update-eyes.sh" || falla "update-eyes.sh no pudo levantar Space Eye (la app no se tocó)"
OK=0; for _ in $(seq 1 24); do c="$(codigo http://127.0.0.1:4200/api/app/version)"; [[ "$c" == 401 || "$c" == 200 ]] && { OK=1; break; }; sleep 5; done
(( OK )) || falla "Space Eye no responde en 127.0.0.1:4200 (la app no se tocó)"
echo "   Space Eye vivo en 127.0.0.1:4200"
if [[ -n "$APK" ]]; then
  [[ -s "$APK" ]] || falla "no existe $APK"
  API="$(docker ps --filter "label=com.docker.compose.project=$PROYECTO_EYES" --filter "label=com.docker.compose.service=api" --format '{{.Names}}' | head -n1)"
  SHA="$(sha256sum "$APK" | cut -d' ' -f1)"; BYTES="$(stat -c%s "$APK")"
  VCODE="${APK_VERSION_CODE:-36}"; VNOMBRE="${APK_VERSION:-0.16.4}"
  printf '{"version":"%s","version_code":%s,"sha256":"%s","bytes":%s,"publicado":"%s"}\n' \
    "$VNOMBRE" "$VCODE" "$SHA" "$BYTES" "$(date -Iseconds)" > /tmp/space-eye.json
  docker cp "$APK" "$API:/descargas/space-eye.apk"
  docker cp /tmp/space-eye.json "$API:/descargas/space-eye.json"; rm -f /tmp/space-eye.json
  echo "   app $VNOMBRE publicada en https://$DOMINIO/space-eye.apk"
fi

# ─── 5 · nginx ────────────────────────────────────────────────────────────
# El sitio de la instancia ya existe y tiene su certificado: solo se le agrega
# la línea que incluye el fragmento, DENTRO del bloque https del dominio,
# justo después de su server_name. No se reescribe el resto del sitio.
INCLUIR='include /etc/nginx/snippets/space-eyes*.conf;'
if [[ "${SALTAR_NGINX:-0}" != 1 ]]; then
  paso "5. nginx: los equipos entran por https://$DOMINIO"
  cp -p "$SITIO" "$SITIO.nuevo"
  # Un sitio hecho con la plantilla vieja trae al final los bloques de
  # eyes.<dominio>. Se quitan: los equipos ya no entran por ahí.
  if grep -q "server_name eyes\.$DOMINIO;" "$SITIO.nuevo"; then
    awk -v marca="#  eyes.$DOMINIO" '
      index($0, marca) == 1 { corta = 1 }
      !corta { lineas[++n] = $0 }
      END {
        # La línea de ==== que abre el comentario de ese bloque también sobra.
        if (corta && n > 0 && lineas[n] ~ /^# =+$/) n--
        while (n > 0 && lineas[n] == "") n--
        for (i = 1; i <= n; i++) print lineas[i]
      }' "$SITIO.nuevo" > "$SITIO.tmp" && mv "$SITIO.tmp" "$SITIO.nuevo"
    grep -q "server_name eyes\.$DOMINIO;" "$SITIO.nuevo" && { rm -f "$SITIO.nuevo"; falla "no pude quitar los bloques de eyes.$DOMINIO de $SITIO (no se tocó)"; }
    echo "   se quitaron los bloques viejos de eyes.$DOMINIO"
  fi
  if grep -qF "$INCLUIR" "$SITIO.nuevo"; then
    echo "   el sitio ya incluía el fragmento de Space Eye"
  else
    awk -v dominio="$DOMINIO" -v incluir="$INCLUIR" '
      /listen 443/ { en443 = 1 }
      { print }
      en443 && !hecho && $1 == "server_name" && $2 == dominio ";" {
        print ""
        print "  # Space Eye de esta instancia: sus equipos entran por este mismo dominio."
        print "  " incluir
        hecho = 1
      }
      END { if (!hecho) exit 3 }' "$SITIO.nuevo" > "$SITIO.tmp" \
      || { rm -f "$SITIO.tmp" "$SITIO.nuevo"; falla "no encontré el server_name $DOMINIO del bloque https en $SITIO (no se tocó)"; }
    mv "$SITIO.tmp" "$SITIO.nuevo"
  fi
  if cmp -s "$SITIO" "$SITIO.nuevo"; then
    rm -f "$SITIO.nuevo"
  else
    mv "$SITIO.nuevo" "$SITIO"
    if ! nginx -t 2>/tmp/nginx-t.txt; then
      cat /tmp/nginx-t.txt; cp -p "$R/nginx-$DOMINIO" "$SITIO"
      falla "nginx -t falló: se dejó el sitio de antes (Space Eye quedó arriba, la app no se tocó)"
    fi
    systemctl reload nginx
  fi
  # Comprobación de punta a punta, por el dominio y desde fuera de docker.
  # El reload de nginx no es instantáneo: se le dan unos segundos.
  for _ in $(seq 1 10); do
    C_API="$(codigo --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/app/version")"
    [[ "$C_API" == 401 || "$C_API" == 200 ]] && break; sleep 1
  done
  [[ "$C_API" == 401 || "$C_API" == 200 ]] || falla "https://$DOMINIO/api/ no llega a Space Eye (dio $C_API)"
  echo "   https://$DOMINIO/api/ llega a Space Eye ($C_API) y la app sigue en /spaces-dooh"
fi

# ─── 6 · La app de la instancia ───────────────────────────────────────────
if [[ "${SALTAR_APP:-0}" != 1 ]]; then
  paso "6. La app de la instancia habla con su Space Eye"
  pon() { if grep -q "^$1=" "$APP_ENV"; then sed -i "s|^$1=.*|$1=$2|" "$APP_ENV"; else printf '%s=%s\n' "$1" "$2" >> "$APP_ENV"; fi; }
  while IFS= read -r par; do pon "${par%%=*}" "${par#*=}"; done < <(eyes_pares_app)
  chmod 600 "$APP_ENV"
  IMAGEN_APP="$(docker inspect -f '{{.Config.Image}}' "$CONTENEDOR")"
  OPCIONES="$(sed -n 's/^DOCKER_OPCIONES_APP=//p' "$INST_ENV" 2>/dev/null | tr -d '"' | tail -n1)"
  [[ -n "$OPCIONES" ]] || falla "no hay DOCKER_OPCIONES_APP en $INST_ENV (la app no se tocó; app.env sí: restáuralo de $R)"
  read -r -a OPC <<<"$OPCIONES"
  SELLO="$(date +%Y%m%d%H%M%S)"
  docker rename "$CONTENEDOR" "$CONTENEDOR-antes-eyes-$SELLO"
  docker stop "$CONTENEDOR-antes-eyes-$SELLO" >/dev/null
  if docker run --detach --name "$CONTENEDOR" --restart unless-stopped --env-file "$APP_ENV" "${OPC[@]}" "$IMAGEN_APP" >/dev/null; then
    for _ in $(seq 1 24); do [[ "$(codigo "$SALUD_APP")" == 200 ]] && break; sleep 5; done
  fi
  if [[ "$(codigo "$SALUD_APP")" != 200 ]]; then
    docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
    cp -p "$R/space-os/app.env" "$APP_ENV"
    docker rename "$CONTENEDOR-antes-eyes-$SELLO" "$CONTENEDOR"; docker start "$CONTENEDOR" >/dev/null
    falla "la app nueva no respondió: se regresó a la de antes (Space Eye sigue arriba)"
  fi
  docker rm "$CONTENEDOR-antes-eyes-$SELLO" >/dev/null
  echo "   la app responde con SPACE_EYE_BASE_URL=http://127.0.0.1:4200"
fi

# ─── Resumen ──────────────────────────────────────────────────────────────
paso "LISTO"
echo "   Space Eye de $OWNER: https://$DOMINIO (los equipos) · 127.0.0.1:4200 (su SPACE OS)"
echo "   Respaldo: $R"
echo "   Si su licencia trae el módulo apagado, en el padre:"
echo "     node apps/flota/modulo.mjs --instancia $OWNER --activar space-eyes"
