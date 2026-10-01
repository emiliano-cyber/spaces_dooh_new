# Ensayo del alta de Space Eyes con la MISMA biblioteca que usa instalar-hijo.sh.
set -euo pipefail
R=$HOME/spaces-lf; H=$HOME/hijo
cd "$H/opt/eyes" 2>/dev/null && docker compose -p space-eyes --env-file "$H/etc/eyes.env" down -v >/dev/null 2>&1 || true
cd "$HOME"; rm -rf "$H"; mkdir -p "$H/etc" "$H/opt/eyes" "$H/respaldos"
. "$R/infra/scripts/entorno-instancia.sh"
. "$R/infra/scripts/eyes-alta.sh"
eyes_preparar_credenciales
reescribir_env_docker "$R/infra/env/app.env.example" "$(eyes_pares_app | sed -n 1p)" "$(eyes_pares_app | sed -n 2p)" "$(eyes_pares_app | sed -n 3p)" \
  | grep '^SPACE_EYE_' > "$H/etc/app-space-eye.env"
eyes_env "$R/infra/eyes/eyes.env.example" g500lab g500.localhost 127.0.0.1 space-eye:0.16.1-local > "$H/etc/eyes.env"
chmod 600 "$H/etc/eyes.env" "$H/etc/app-space-eye.env"
while IFS=$'\t' read -r origen destino modo; do
  d="$H/opt${destino#/opt/space-os}"; mkdir -p "$(dirname "$d")"; cp "$origen" "$d"; chmod "$modo" "$d"
done < <(eyes_archivos "$R")
ls -R "$H/opt" | tr '\n' ' '; echo
EYES_CONF="$H/etc/eyes.env" EYES_DIR="$H/opt/eyes" EYES_RESPALDOS="$H/respaldos" EYES_CANDADO="$H/eyes.lock" \
  bash "$H/opt/update-eyes.sh" 2>&1 | grep -v "Container\|Network\|Volume\|aplicando" | tail -4
