# Cambia la version de Space Eye del ensayo y corre el actualizador real.
#   bash cambiar-version.sh space-eye:0.16.1-local
sed -i "s|^EYES_IMAGEN=.*|EYES_IMAGEN=$1|" "$HOME/hijo/etc/eyes.env"
EYES_CONF="$HOME/hijo/etc/eyes.env" EYES_DIR="$HOME/hijo/opt/eyes" EYES_RESPALDOS="$HOME/hijo/respaldos" \
EYES_CANDADO="$HOME/hijo/eyes.lock" bash "$HOME/hijo/opt/update-eyes.sh" 2>&1 | grep -v "Container\|Network\|aplicando"
echo "codigo=${PIPESTATUS[0]}"
# El actualizador levanta la pila solo con su docker-compose.yml: sin el ajuste
# del ensayo, PUBLIC_BASE_URL vuelve a eyes.g500.localhost y los equipos
# simulados no pueden bajar sus actualizaciones (paso el 6-oct).
if [ -f "$HOME/hijo/opt/eyes/ensayo-local.yml" ]; then
  (cd "$HOME/hijo" && EYES_CONF="$HOME/hijo/etc/eyes.env" docker compose -p space-eyes -f opt/eyes/docker-compose.yml -f opt/eyes/ensayo-local.yml \
     --env-file etc/eyes.env up -d api >/dev/null 2>&1) && echo "ajuste del ensayo aplicado (ensayo-local.yml)"
fi
