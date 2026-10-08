#!/usr/bin/env bash
# ============================================================================
#  eyes-alta.sh — lo que el alta de una instancia hace por su Space Eye (ADR 0045).
# ----------------------------------------------------------------------------
#  Biblioteca: la cargan con `source` instalar-hijo.sh y provision-instancia.sh,
#  y la usa el ensayo local. Aqui va TODA la logica de Space Eyes en el alta; en
#  los guiones de alta quedan solo los ganchos, para que el cambio en esa zona
#  roja sea lo mas chico posible.
#
#  No escribe nada por su cuenta: devuelve contenido por la salida estandar y el
#  guion que la llama lo instala con su propio `escribir` (que respeta --dry-run).
#
#  Las dos credenciales con SPACE OS se generan UNA vez y van IGUALES a los dos
#  lados:
#     app.env  (la app)       SPACE_EYE_KEY / SPACE_EYE_PROVISION_TOKEN
#     eyes.env (Space Eye)    INSTANCIA_LLAVE / INSTANCIA_TESTIGO
#  Space Eye las registra al arrancar; nadie copia nada a mano.
# ============================================================================

# Una credencial con el formato que Space Eye reconoce: se_<12 hex>_<43>.
eyes_credencial() {
  printf 'se_%s_%s\n' "$(openssl rand -hex 6)" "$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
}

# Genera las dos credenciales en EYES_LLAVE y EYES_TESTIGO (si no venian ya).
eyes_preparar_credenciales() {
  EYES_LLAVE="${EYES_LLAVE:-$(eyes_credencial)}"
  EYES_TESTIGO="${EYES_TESTIGO:-$(eyes_credencial)}"
}

# Los pares para app.env, en el formato de reescribir_env_docker. La app le
# habla a su Space Eye por 127.0.0.1:4200 (los dos en el mismo droplet).
eyes_pares_app() {
  printf '%s\n' "SPACE_EYE_BASE_URL=http://127.0.0.1:4200" \
                "SPACE_EYE_KEY=$EYES_LLAVE" \
                "SPACE_EYE_PROVISION_TOKEN=$EYES_TESTIGO"
}

# eyes.env completo, sobre la plantilla. Uso:
#   eyes_env <plantilla> <owner> <dominio-de-la-instancia> <ip-publica> [imagen]
# Requiere entorno-instancia.sh cargado (reescribir_env_docker).
eyes_env() {
  local plantilla="$1" owner="$2" dominio="$3" ip="$4" imagen="${5:-}"
  local h; h() { openssl rand -hex 32; }
  reescribir_env_docker "$plantilla" \
    "INSTANCIA_OWNER=$owner" \
    "EYES_DOMINIO=eyes.$dominio" \
    "IP_PUBLICA=$ip" \
    "EYES_IMAGEN=$imagen" \
    "INSTANCIA_LLAVE=$EYES_LLAVE" \
    "INSTANCIA_TESTIGO=$EYES_TESTIGO" \
    "ADMIN_EMAIL=operacion@$dominio" \
    "ADMIN_PASSWORD=$(openssl rand -hex 12)" \
    "DB_PASSWORD=$(h)" \
    "JWT_SECRET=$(h)" \
    "JWT_DEVICE_SECRET=$(h)" \
    "WORKER_SECRET=$(h)" \
    "MEDIAMTX_PASS=$(h)" \
    "TURN_SECRET=$(h)"
}

# El cron de update-eyes.sh, a la par del de update.sh: comprueba cada 15 min y
# actualiza de madrugada (diez minutos despues que la app, para no coincidir).
eyes_cron() {
  cat <<'CRON'
# Space Eyes de esta instancia (ADR 0045). Escrito por el alta.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root /opt/space-os/update-eyes.sh --comprobar >> /var/log/space-os/eyes.log 2>&1 || { c=$?; [ $c -eq 75 ] || [ $c -eq 10 ]; }
27 4 * * * root /opt/space-os/update-eyes.sh >> /var/log/space-os/eyes.log 2>&1
CRON
}

# Los archivos que el alta instala, de donde salen y a donde van.
eyes_archivos() {
  local raiz="$1"
  printf '%s\t%s\t%s\n' \
    "$raiz/infra/eyes/docker-compose.yml" "/opt/space-os/eyes/docker-compose.yml" 640 \
    "$raiz/infra/eyes/mediamtx.yml"       "/opt/space-os/eyes/mediamtx.yml"       640 \
    "$raiz/infra/scripts/update-eyes.sh"  "/opt/space-os/update-eyes.sh"          750
}
