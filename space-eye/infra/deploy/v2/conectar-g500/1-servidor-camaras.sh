#!/usr/bin/env bash
# ============================================================================
#  Pasos 1 a 3 en el SERVIDOR DE CÁMARAS (159.203.188.58), como root.
#  Publica https://eyes.g500.space-os.io (el espejo :4200) y crea la llave de
#  servicio de g500. NO toca :4000 (la flota) ni el compose de nadie.
#
#    bash 1-servidor-camaras.sh
#
#  Pide: un correo para Let's Encrypt, y usuario/contraseña de administrador
#  del Space Eye :4200 (para crear la llave). No guarda ninguna contraseña.
#  La LLAVE que imprime al final se muestra UNA vez: pásala al paso 5.
# ============================================================================
set -euo pipefail
D=eyes.g500.space-os.io
CONF=https://raw.githubusercontent.com/emiliano-cyber/spaces_dooh_new/main/space-eye/infra/apache/$D.conf
codigo() { curl -s -o /dev/null -m 10 -w '%{http_code}' "$1"; }

echo "== 0. Antes de tocar nada"
echo "   market.adavailable.com: $(codigo https://market.adavailable.com/)"
echo "   flota :4000:            $(codigo http://127.0.0.1:4000/api/app/version)"
echo "   espejo :4200:           $(codigo http://127.0.0.1:4200/api/app/version)"
[ "$(codigo http://127.0.0.1:4200/api/app/version)" != 000 ] || { echo "El espejo :4200 no responde: no sigo."; exit 1; }

echo "== 1. Sitio de Apache para $D"
a2enmod proxy proxy_http proxy_wstunnel ssl rewrite headers >/dev/null
curl -fsSL "$CONF" -o /etc/apache2/sites-available/$D.conf
read -r -p "   Correo para Let's Encrypt: " CORREO
# El certificado ANTES de habilitar el sitio: el archivo apunta a rutas que aún
# no existen, y habilitarlo antes tumbaría Apache al recargar (y con él a
# market.adavailable.com).
certbot certonly --apache -d "$D" --non-interactive --agree-tos -m "$CORREO"
a2ensite $D >/dev/null
apache2ctl configtest
systemctl reload apache2
sleep 2
echo "   https://$D:           $(codigo https://$D/api/app/version)   (401 = vivo, pide credencial)"
echo "   market.adavailable.com: $(codigo https://market.adavailable.com/)   (debe seguir igual)"
echo "   flota :4000:            $(codigo http://127.0.0.1:4000/api/app/version)   (debe seguir igual)"

echo "== 2. Llave de servicio de g500 en el espejo (solo ve equipos de g500)"
read -r -p "   Correo del administrador de Space Eye (:4200): " ADMIN
read -r -s -p "   Contraseña: " PASS; echo
TOKEN=$(curl -s -X POST http://127.0.0.1:4200/api/auth/login -H 'Content-Type: application/json' \
  -d "$(printf '{"email":"%s","password":"%s"}' "$ADMIN" "$PASS")" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
unset PASS
[ -n "$TOKEN" ] || { echo "   No pude entrar con ese usuario."; exit 1; }
RESP=$(curl -s -X POST http://127.0.0.1:4200/api/llaves -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nombre":"SPACE OS g500 (g500.space-os.io)","escritura":true,"owner":"g500"}')
LLAVE=$(printf '%s' "$RESP" | sed -n 's/.*"llave":"\([^"]*\)".*/\1/p')
[ -n "$LLAVE" ] || { echo "   No se creó la llave: $RESP"; exit 1; }

echo "== 3. ¿Ve sus cámaras?"
N=$(curl -s -H "Authorization: Bearer $LLAVE" "https://$D/api/devices?limit=500" | grep -o '"id":' | wc -l)
echo "   equipos de g500 visibles con la llave: $N"
echo
echo "LISTO. Llave de g500 (se muestra UNA vez, guárdala para el paso 5):"
echo "   $LLAVE"
