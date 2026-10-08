#!/usr/bin/env bash
# ============================================================================
#  Paso 5 en el SERVIDOR DE G500 (142.93.113.106), como root.
#  Le dice a su SPACE OS dónde están sus cámaras y vuelve a levantar la app con
#  la configuración nueva. Si la app nueva no responde, regresa sola a la de
#  antes (mismo contenedor, mismo app.env de antes).
#
#    bash 2-servidor-g500.sh
#
#  Pide la LLAVE que imprimió el paso 1 (no se muestra al teclearla).
# ============================================================================
set -euo pipefail
ENV_APP=/etc/space-os/app.env
INST=/etc/space-os/instancia.env
C=space-os
URL=https://eyes.g500.space-os.io
salud() { curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3000/spaces-dooh/api/version/; }

[ -f "$ENV_APP" ] || { echo "No existe $ENV_APP: no sigo."; exit 1; }
docker inspect "$C" >/dev/null || { echo "No existe el contenedor $C: no sigo."; exit 1; }
echo "== 0. Antes: la app responde $(salud)"

read -r -s -p "Llave de g500 (del paso 1): " LLAVE; echo
case "$LLAVE" in se_*) ;; *) echo "Eso no parece una llave (empiezan con se_)."; exit 1 ;; esac

echo "== 1. Respaldo y app.env"
STAMP=$(date +%Y%m%d-%H%M%S)
cp -p "$ENV_APP" "$ENV_APP.antes-eyes-$STAMP"
# Reemplaza o agrega las dos líneas; lo demás no se toca.
pon() { if grep -q "^$1=" "$ENV_APP"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_APP"; else printf '%s=%s\n' "$1" "$2" >>"$ENV_APP"; fi; }
pon SPACE_EYE_BASE_URL "$URL"
pon SPACE_EYE_KEY "$LLAVE"
unset LLAVE
chmod 600 "$ENV_APP"
grep -E '^SPACE_EYE_BASE_URL=' "$ENV_APP"

echo "== 2. Volver a levantar la app con la configuración nueva"
IMAGEN=$(docker inspect -f '{{.Config.Image}}' "$C")
# Las mismas opciones con que la levanta update.sh (puertos, licencia montada...).
DOCKER_OPCIONES_APP=$(sed -n 's/^DOCKER_OPCIONES_APP=//p' "$INST" 2>/dev/null | tr -d '"' | tail -n1)
# Sin ellas NO se sigue: levantar la app sin la licencia montada la dejaria
# creyendo que no tiene licencia.
[ -n "$DOCKER_OPCIONES_APP" ] || { echo "No encontre DOCKER_OPCIONES_APP en $INST: no sigo."; exit 1; }
echo "   opciones: $DOCKER_OPCIONES_APP"
read -r -a OPC <<<"$DOCKER_OPCIONES_APP"
docker rename "$C" "$C-antes-eyes-$STAMP"
docker stop "$C-antes-eyes-$STAMP" >/dev/null
if docker run --detach --name "$C" --restart unless-stopped --env-file "$ENV_APP" "${OPC[@]}" "$IMAGEN" >/dev/null; then
  for _ in $(seq 1 24); do [ "$(salud)" = 200 ] && break; sleep 5; done
fi
if [ "$(salud)" != 200 ]; then
  echo "La app NUEVA no responde: regreso a la de antes."
  docker rm -f "$C" >/dev/null 2>&1 || true
  cp -p "$ENV_APP.antes-eyes-$STAMP" "$ENV_APP"
  docker rename "$C-antes-eyes-$STAMP" "$C"
  docker start "$C" >/dev/null
  exit 1
fi
docker rm "$C-antes-eyes-$STAMP" >/dev/null
echo "== 3. Listo: la app responde $(salud)."
echo "   Abre https://g500.space-os.io/spaces-dooh/space-eyes/ : deben salir sus equipos."
echo "   Si sigue saliendo la demostración, su licencia trae el módulo apagado:"
echo "   en el padre, node apps/flota/modulo.mjs --instancia g500 --activar space-eyes"
