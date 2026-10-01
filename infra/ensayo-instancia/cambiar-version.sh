# Cambia la version de Space Eye del ensayo y corre el actualizador real.
#   bash cambiar-version.sh space-eye:0.16.1-local
sed -i "s|^EYES_IMAGEN=.*|EYES_IMAGEN=$1|" "$HOME/hijo/etc/eyes.env"
EYES_CONF="$HOME/hijo/etc/eyes.env" EYES_DIR="$HOME/hijo/opt/eyes" EYES_RESPALDOS="$HOME/hijo/respaldos" \
EYES_CANDADO="$HOME/hijo/eyes.lock" bash "$HOME/hijo/opt/update-eyes.sh" 2>&1 | grep -v "Container\|Network\|aplicando"
echo "codigo=${PIPESTATUS[0]}"
